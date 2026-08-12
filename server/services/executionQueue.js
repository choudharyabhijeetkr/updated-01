/**
 * executionQueue.js
 *
 * Owns the actual "run things one at a time" behavior.
 *
 * One click on Run Selected / Run All = one Session, containing N
 * Executions (Test × Browser × Device). Executions run strictly
 * sequentially, in the order they were created. Each execution's status
 * transitions exactly once through PENDING -> RUNNING -> a single
 * terminal state (PASSED / FAILED / CANCELLED / STOPPED) and is
 * broadcast to any connected SSE clients for that session as it changes.
 *
 * Queue rules (per spec):
 *   - Cancelling a PENDING execution marks it CANCELLED and the queue
 *     continues to the next one.
 *   - Stop marks the session stopRequested; the currently RUNNING
 *     execution is allowed to finish naturally, and every remaining
 *     PENDING execution is marked STOPPED without being started.
 *   - A failed execution does not stop the queue.
 */

const os = require('os');
const { v4: uuidv4 } = require('uuid');
const { runSingleExecution } = require('./testRunner');
const store = require('./sessionStore');
const { updateReportDisk, scheduleReportDiskUpdate } = require('./htmlReportGenerator');
const { updateExcelReportDisk } = require('./excelReportGenerator');

// Tracking worker startup staggering
let lastWorkerLaunchTime = 0;
const STAGGER_DELAY_MS = 1500; // 1.5s delay between starting worker browser instances

/**
 * Calculates dynamic safety limit for worker concurrency based on system specifications.
 * Checks total RAM, available free RAM, and CPU cores to calculate optimal defaults and safety caps.
 */
function getSystemMemoryStatus(requestedBatchSize = 5) {
  const totalMemMB = os.totalmem() / (1024 * 1024);
  const freeMemMB = os.freemem() / (1024 * 1024);
  const cpus = os.cpus();
  const cpuCores = cpus && cpus.length ? cpus.length : 2;

  // Dynamic safety cap based on available free RAM
  let safetyCap = 1;
  if (totalMemMB >= 14000 && freeMemMB >= 4000) {
    // High-end machine (16GB+ RAM with plenty free)
    safetyCap = 10;
  } else if (totalMemMB >= 7000 && freeMemMB >= 2500) {
    // Mid-high machine (8GB-16GB RAM with healthy free RAM)
    safetyCap = 4;
  } else if (freeMemMB >= 1200) {
    // Moderate machine (4GB-8GB RAM or ~1.5GB free)
    safetyCap = 2;
  } else {
    // Low RAM (<1.2GB free or <4GB system)
    safetyCap = 1;
  }

  // Calculate recommended default batch concurrency based on device specifications (RAM & CPU cores)
  // Each Playwright browser instance requires ~400MB RAM + ~1 vCPU thread for smooth parallel rendering
  let ramRecommended = 1;
  if (totalMemMB >= 15000) {
    ramRecommended = 8;
  } else if (totalMemMB >= 7000) {
    ramRecommended = 4;
  } else if (totalMemMB >= 3500) {
    ramRecommended = 2;
  } else {
    ramRecommended = 1;
  }

  const cpuRecommended = Math.max(1, cpuCores - 1);
  const recommendedBatch = Math.min(10, Math.max(1, Math.min(ramRecommended, cpuRecommended)));

  const parsedBatch = parseInt(requestedBatchSize, 10);
  const requested = (isNaN(parsedBatch) || parsedBatch < 1) ? recommendedBatch : Math.min(10, Math.max(1, parsedBatch));
  const effectiveConcurrency = Math.min(requested, safetyCap);

  return {
    recommendedBatch,
    requestedBatch: requested,
    safetyCap,
    effectiveConcurrency,
    totalMemMB: Math.round(totalMemMB),
    freeMemMB: Math.round(freeMemMB),
    cpuCores,
    isThrottled: effectiveConcurrency < requested
  };
}

// SSE connection registry: sessionId -> Set of express res objects
const sseClients = new Map();

function registerSseClient(sessionId, res, req) {
  if (!sseClients.has(sessionId)) {
    sseClients.set(sessionId, new Set());
  }
  sseClients.get(sessionId).add(res);

  const cleanup = () => {
    const clients = sseClients.get(sessionId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) sseClients.delete(sessionId);
    }
  };

  res.on('close', cleanup);
  if (req) {
    req.on('close', cleanup);
  }
}

function broadcast(sessionId, payload) {
  const clients = sseClients.get(sessionId);
  if (!clients || clients.size === 0) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const client of clients) {
    try {
      client.write(data);
      if (client.flush) client.flush();
    } catch (err) {
      console.error('[executionQueue] SSE write error:', err.message);
    }
  }
}

// Memory queue of pending execution IDs
const runQueue = [];
// Map of active running execution IDs per session: sessionId -> Set<execId>
const activeExecutions = new Map();

function getFormattedTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const min = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  return `${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}`;
}

function enqueueSession({ testFiles, browsers, devices, retries, headless, batchSize = 5 }) {
  const sessionId = uuidv4();
  const runNumber = store.nextRunNumber();
  const sessionTimestamp = getFormattedTimestamp();
  const settings = store.getSettings();
  const enableScreenshotCapture = !!settings.enableScreenshotCapture;

  const parsedBatch = parseInt(batchSize, 10);
  const validatedBatchSize = (isNaN(parsedBatch) || parsedBatch < 1) ? 5 : Math.min(10, Math.max(1, parsedBatch));

  const executionIds = [];
  const execsToCreate = [];

  for (const testScript of testFiles) {
    for (const device of devices) {
      for (const browser of browsers) {
        const execId = uuidv4();
        executionIds.push(execId);
        execsToCreate.push({
          id: execId,
          sessionId,
          testScript,
          testName: testScript.replace(/\.(spec|test)\.(ts|js)$/, '').replace(/[-_]/g, ' '),
          device,
          deviceType: device === 'Desktop' ? 'Desktop' : 'Mobile',
          browser,
          project: `${device}-${browser}`,
          viewport: 'N/A',
          status: 'PENDING',
          retries: 0,
          duration: null,
          paymentUrl: 'N/A',
          screenshotPath: 'N/A',
          error: '',
          failedStep: '',
          startTime: null,
          endTime: null,
        });
      }
    }
  }

  const session = {
    id: sessionId,
    runNumber,
    status: 'RUNNING',
    createdAt: new Date().toISOString(),
    completedAt: null,
    stopRequested: false,
    options: { testFiles, browsers, devices, retries, headless, batchSize: validatedBatchSize, sessionTimestamp, enableScreenshotCapture },
    executionIds,
  };

  store.upsertSession(session);
  for (const exec of execsToCreate) {
    store.upsertExecution(exec);
    runQueue.push(exec.id);
  }

  updateReportDisk({ immediate: true });

  process.nextTick(processQueue);

  return session;
}

function processQueue() {
  let i = 0;
  while (i < runQueue.length) {
    const execId = runQueue[i];
    const exec = store.getExecution(execId);
    if (!exec) {
      runQueue.splice(i, 1);
      continue;
    }

    const session = store.getSession(exec.sessionId);
    if (!session) {
      runQueue.splice(i, 1);
      continue;
    }

    // Handle session cancellation/stop
    if (session.stopRequested) {
      runQueue.splice(i, 1);
      if (exec.status === 'PENDING') {
        exec.status = 'STOPPED';
        exec.error = 'Stopped by user';
        exec.endTime = new Date().toISOString();
        store.upsertExecution(exec);
        broadcast(session.id, { type: 'executionUpdate', execution: exec });
      }
      checkSessionCompletion(session.id);
      continue;
    }

    // Handle item cancellation
    if (exec.status === 'CANCELLED') {
      runQueue.splice(i, 1);
      broadcast(session.id, { type: 'executionUpdate', execution: exec });
      checkSessionCompletion(session.id);
      continue;
    }

    const memStatus = getSystemMemoryStatus(session.options?.batchSize);
    const maxConcurrency = memStatus.effectiveConcurrency;

    let activeSet = activeExecutions.get(session.id);
    const isNewActiveSet = !activeSet;
    if (!activeSet) {
      activeSet = new Set();
      activeExecutions.set(session.id, activeSet);
    }

    if (activeSet.size < maxConcurrency) {
      const now = Date.now();
      const timeSinceLastLaunch = now - lastWorkerLaunchTime;
      if (lastWorkerLaunchTime > 0 && timeSinceLastLaunch < STAGGER_DELAY_MS) {
        setTimeout(processQueue, STAGGER_DELAY_MS - timeSinceLastLaunch);
        return;
      }

      lastWorkerLaunchTime = Date.now();

      if (isNewActiveSet && memStatus.isThrottled) {
        broadcast(session.id, {
          type: 'log',
          executionId: execId,
          text: `[Memory Guard] RAM: ${memStatus.freeMemMB}MB free / ${memStatus.totalMemMB}MB total. Concurrency throttled to ${maxConcurrency} worker(s) (Requested: ${memStatus.requestedBatch}).`
        });
      }

      // Remove exec from queue and add to active set
      runQueue.splice(i, 1);
      activeSet.add(execId);

      // Launch single test task asynchronously (does not block loop)
      runSingleTestTask(exec, session);
    } else {
      // Concurrency limit reached for this session, check next item in queue
      i++;
    }
  }
}

async function runSingleTestTask(exec, session) {
  exec.status = 'RUNNING';
  exec.startTime = new Date().toISOString();
  store.upsertExecution(exec);
  broadcast(session.id, { type: 'executionUpdate', execution: exec });

  try {
    const result = await runSingleExecution(
      {
        testFile: exec.testScript,
        browser: exec.browser,
        device: exec.device,
        retries: exec.retries,
        headless: session.options?.headless,
        enableScreenshotCapture: session.options?.enableScreenshotCapture,
        sessionTimestamp: session.options?.sessionTimestamp,
      },
      (evt) => broadcast(session.id, { type: 'log', executionId: exec.id, ...evt })
    );

    const rj = result.resultJson;
    if (rj) {
      exec.status = rj.status || (result.exitCode === 0 ? 'PASS' : 'FAIL');
      exec.duration = rj.duration || 0;
      exec.paymentUrl = rj.paymentUrl || 'N/A';
      exec.screenshotPath = rj.screenshotPath || 'N/A';
      exec.error = rj.error || '';
      exec.failedStep = rj.failedStep || '';
      if (rj.testName) exec.testName = rj.testName;
      if (rj.retries !== undefined) exec.retries = rj.retries;
    } else {
      exec.status = result.exitCode === 0 ? 'PASS' : 'FAIL';
      const rawErr = (result.stderr || result.stdout || '').trim();
      if (rawErr) exec.error = rawErr.substring(0, 300);
    }
  } catch (err) {
    exec.status = 'FAIL';
    exec.error = err.message || 'Execution error';
  } finally {
    exec.endTime = new Date().toISOString();
    store.upsertExecution(exec);
    broadcast(session.id, { type: 'executionUpdate', execution: exec });

    // Clean up active set
    const activeSet = activeExecutions.get(session.id);
    if (activeSet) {
      activeSet.delete(exec.id);
      if (activeSet.size === 0) {
        activeExecutions.delete(session.id);
      }
    }

    scheduleReportDiskUpdate(5000);
    checkSessionCompletion(session.id);

    // Immediately trigger processQueue to pull the next test into the freed slot
    process.nextTick(processQueue);
  }
}

function checkSessionCompletion(sessionId) {
  const session = store.getSession(sessionId);
  if (!session || session.status !== 'RUNNING') return;

  const execs = store.getExecutionsForSession(sessionId);
  const allTerminal = execs.every((e) =>
    ['PASS', 'FAIL', 'CANCELLED', 'STOPPED', 'RETRY_PASS'].includes(e.status)
  );

  if (allTerminal) {
    session.status = session.stopRequested ? 'STOPPED' : 'COMPLETED';
    session.completedAt = new Date().toISOString();
    store.upsertSession(session);
    updateReportDisk({ immediate: true });
    updateExcelReportDisk().catch((err) => {
      console.warn('[executionQueue] Session end Excel update warning:', err.message);
    });
    broadcast(sessionId, { type: 'sessionDone', session });
  }
}

function cancelExecution(execId) {
  const exec = store.getExecution(execId);
  if (!exec) return { success: false, error: 'Execution not found' };
  if (exec.status !== 'PENDING') {
    return { success: false, error: `Cannot cancel execution in state ${exec.status}` };
  }

  exec.status = 'CANCELLED';
  exec.error = 'Cancelled by user';
  store.upsertExecution(exec);
  updateReportDisk();

  broadcast(exec.sessionId, { type: 'executionUpdate', execution: exec });
  return { success: true, execution: exec };
}

function stopSession(sessionId) {
  const session = store.getSession(sessionId);
  if (!session) return { success: false, error: 'Session not found' };

  session.stopRequested = true;
  store.upsertSession(session);

  // Mark all PENDING executions in this session as STOPPED immediately
  const execs = store.getExecutionsForSession(sessionId);
  for (const exec of execs) {
    if (exec.status === 'PENDING') {
      exec.status = 'STOPPED';
      exec.error = 'Stopped by user';
      store.upsertExecution(exec);
      broadcast(sessionId, { type: 'executionUpdate', execution: exec });
    }
  }

  updateReportDisk({ immediate: true });
  updateExcelReportDisk().catch((err) => {
    console.warn('[executionQueue] Stop session Excel update warning:', err.message);
  });
  checkSessionCompletion(sessionId);

  return { success: true, session };
}

function resumePendingExecutions() {
  const sessions = store.getAllSessions();
  let hasPending = false;
  for (const session of sessions) {
    if (session.status === 'RUNNING' && !session.stopRequested) {
      const execs = store.getExecutionsForSession(session.id);
      for (const exec of execs) {
        if (exec.status === 'PENDING' || exec.status === 'RUNNING') {
          exec.status = 'PENDING';
          exec.error = '';
          store.upsertExecution(exec);
          if (!runQueue.includes(exec.id)) {
            runQueue.push(exec.id);
            hasPending = true;
          }
        }
      }
    }
  }
  if (hasPending) {
    process.nextTick(processQueue);
  }
}

process.nextTick(resumePendingExecutions);

module.exports = {
  enqueueSession,
  cancelExecution,
  stopSession,
  registerSseClient,
  getSystemMemoryStatus,
};
