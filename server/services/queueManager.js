/**
 * queueManager.js
 *
 * Execution Queue & Session Persistence Manager.
 * Handles:
 *   - Sequential queue execution (Only 1 test combination runs at a time)
 *   - Disk persistence for execution sessions (reports/sessions.json)
 *   - Individual item cancellation (Pending -> Cancelled)
 *   - Session stop (Stop Queue -> Remaining Pending -> Stopped by User)
 *   - Live event broadcasting (SSE)
 *   - Auto-updating HTML reports after each execution item
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { runTests } = require('./testRunner');
const { generateHtmlReport } = require('./reportGenerator');

const SESSIONS_FILE = path.join(process.cwd(), 'reports', 'sessions.json');
const HISTORY_FILE = path.join(process.cwd(), 'reports', 'report-history.json');

class QueueManager {
  constructor() {
    this.sessions = new Map(); // id -> session object
    this.sseClients = new Map(); // sessionId -> Set(res)
    this.isProcessing = false;
    this.activeChildProcess = null;
    this.ensureStorage();
    this.loadFromDisk();
  }

  ensureStorage() {
    const dir = path.join(process.cwd(), 'reports');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  loadFromDisk() {
    try {
      if (fs.existsSync(SESSIONS_FILE)) {
        const raw = fs.readFileSync(SESSIONS_FILE, 'utf8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          let hasPendingSession = false;
          for (const session of data) {
            // Auto-resume RUNNING sessions on boot
            if (session.status === 'RUNNING' && !session.stopped) {
              let hasPendingItems = false;
              session.items.forEach(item => {
                if (item.status === 'RUNNING' || item.status === 'PENDING') {
                  item.status = 'PENDING';
                  item.error = '';
                  hasPendingItems = true;
                }
              });
              if (hasPendingItems) {
                hasPendingSession = true;
              }
            }
            this.sessions.set(session.id, session);
          }
          if (hasPendingSession) {
            process.nextTick(() => this.processQueue());
          }
        }
      }
    } catch (err) {
      console.error('[QueueManager] Error loading sessions from disk:', err.message);
    }
  }

  saveToDisk() {
    try {
      this.ensureStorage();
      const list = Array.from(this.sessions.values()).map(s => ({
        ...s,
        events: undefined // don't persist heavy SSE event logs to sessions.json
      }));
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(list, null, 2), 'utf8');
    } catch (err) {
      console.error('[QueueManager] Error saving sessions to disk:', err.message);
    }
  }

  getCompletedRunsCount() {
    if (!fs.existsSync(HISTORY_FILE)) return 0;
    try {
      const history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
      let count = 0;
      if (history && history.dates) {
        for (const dKey of Object.keys(history.dates)) {
          if (Array.isArray(history.dates[dKey])) {
            count += history.dates[dKey].length;
          }
        }
      }
      return count;
    } catch (err) {
      return 0;
    }
  }

  createSession(options) {
    const { browsers, devices, testFiles, retries = 2, headless = true, batchSize = 5 } = options;
    const sessionId = uuidv4();
    const runNumber = this.getCompletedRunsCount() + 1;

    const parsedBatch = parseInt(batchSize, 10);
    const validatedBatchSize = (isNaN(parsedBatch) || parsedBatch < 1) ? 5 : Math.min(10, Math.max(1, parsedBatch));

    // Create execution items sequentially
    const items = [];
    let itemIdx = 1;

    for (const testScript of testFiles) {
      for (const device of devices) {
        for (const browser of browsers) {
          const project = `${device}-${browser}`;
          items.push({
            id: `${sessionId}_${itemIdx++}`,
            testScript,
            testName: testScript.replace(/\.(spec|test)\.(ts|js)$/, '').replace(/[-_]/g, ' '),
            device,
            deviceType: device === 'Desktop' ? 'Desktop' : 'Mobile',
            browser,
            project,
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
      runId: sessionId,
      runNumber,
      status: 'RUNNING',
      stopped: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      options: { browsers, devices, testFiles, retries, headless, batchSize: validatedBatchSize },
      items,
      completed: 0,
      passed: 0,
      failed: 0,
      cancelled: 0,
      stoppedCount: 0,
      totalCombinations: items.length,
    };

    this.sessions.set(sessionId, session);
    this.saveToDisk();

    // Trigger background queue execution
    process.nextTick(() => this.processQueue());

    return session;
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  getLatestSession() {
    const list = Array.from(this.sessions.values());
    if (list.length === 0) return null;
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  }

  getAllSessions() {
    return Array.from(this.sessions.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  addSseClient(sessionId, res) {
    if (!this.sseClients.has(sessionId)) {
      this.sseClients.set(sessionId, new Set());
    }
    this.sseClients.get(sessionId).add(res);
  }

  removeSseClient(sessionId, res) {
    if (this.sseClients.has(sessionId)) {
      this.sseClients.get(sessionId).delete(res);
    }
  }

  broadcastSse(sessionId, eventData) {
    const clients = this.sseClients.get(sessionId);
    if (clients && clients.size > 0) {
      const payload = `data: ${JSON.stringify(eventData)}\n\n`;
      for (const client of clients) {
        try {
          client.write(payload);
          if (client.flush) client.flush();
        } catch (err) {
          console.error('[QueueManager] SSE write error:', err.message);
        }
      }
    }
  }

  cancelItem(sessionId, itemId) {
    const session = this.sessions.get(sessionId);
    if (!session) return { success: false, error: 'Session not found' };

    const item = session.items.find(i => i.id === itemId || i.id.endsWith(`_${itemId}`));
    if (!item) return { success: false, error: 'Execution item not found' };

    if (item.status === 'PENDING') {
      item.status = 'CANCELLED';
      item.error = 'Cancelled by User';
      session.cancelled++;
      session.updatedAt = new Date().toISOString();
      this.saveToDisk();

      this.broadcastSse(sessionId, {
        type: 'testResult',
        itemId: item.id,
        file: item.testScript,
        name: item.testName,
        project: item.project,
        status: 'CANCELLED',
        error: 'Cancelled by User',
        duration: 0,
      });

      this.updateHtmlReportForSession(session);
      return { success: true, item };
    }

    return { success: false, error: `Cannot cancel item in '${item.status}' state` };
  }

  stopSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return { success: false, error: 'Session not found' };

    session.stopped = true;
    session.status = 'STOPPED';
    session.updatedAt = new Date().toISOString();

    // Mark remaining PENDING & RUNNING items as STOPPED
    for (const item of session.items) {
      if (item.status === 'PENDING' || item.status === 'RUNNING') {
        item.status = 'STOPPED';
        item.error = 'Stopped by User';
        session.stoppedCount++;
      }
    }

    this.saveToDisk();

    this.broadcastSse(sessionId, {
      type: 'done',
      status: 'stopped',
      message: 'Execution stopped by user',
      detailedResults: this.formatDetailedResults(session),
    });

    this.updateHtmlReportForSession(session);
    return { success: true, session };
  }

  formatDetailedResults(session) {
    return session.items.map(i => ({
      testScript: i.testScript,
      testName: i.testName,
      device: i.device,
      deviceType: i.deviceType,
      browser: i.browser,
      viewport: i.viewport,
      status: i.status,
      retries: i.retries || 0,
      duration: i.duration || 0,
      paymentUrl: i.paymentUrl || 'N/A',
      screenshotPath: i.screenshotPath || 'N/A',
      error: i.error || '',
      failedStep: i.failedStep || '',
      startTime: i.startTime || session.createdAt,
      endTime: i.endTime || session.updatedAt,
    }));
  }

  updateHtmlReportForSession(session) {
    try {
      const detailedResults = this.formatDetailedResults(session);
      const htmlReportPath = generateHtmlReport(detailedResults, null, session.id, {
        browsers: session.options.browsers,
        devices: session.options.devices,
        testFiles: session.options.testFiles,
        runNumber: session.runNumber,
      });

      this.broadcastSse(session.id, {
        type: 'reportReady',
        htmlReportPath,
        totalCompletedRuns: this.getCompletedRunsCount(),
        detailedResults,
      });

      return htmlReportPath;
    } catch (err) {
      console.error('[QueueManager] HTML report generation failed:', err.message);
    }
  }

  async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      for (const session of this.sessions.values()) {
        if (session.status !== 'RUNNING') continue;

        console.log(`[QueueManager] Processing Session #${session.runNumber} (${session.id}) with ${session.items.length} executions target...`);

        this.broadcastSse(session.id, {
          type: 'init',
          totalRuns: session.totalCombinations,
          runNumber: session.runNumber,
        });

        for (const item of session.items) {
          // Check if session was stopped by user
          if (session.stopped) {
            if (item.status === 'PENDING' || item.status === 'RUNNING') {
              item.status = 'STOPPED';
              item.error = 'Stopped by User';
            }
            continue;
          }

          // Skip cancelled items
          if (item.status === 'CANCELLED') {
            console.log(`[QueueManager] Skipping cancelled item: ${item.testScript} [${item.project}]`);
            this.broadcastSse(session.id, {
              type: 'testResult',
              file: item.testScript,
              project: item.project,
              status: 'CANCELLED',
              name: item.testName,
            });
            continue;
          }

          // Only process pending items
          if (item.status !== 'PENDING') continue;

          item.status = 'RUNNING';
          item.startTime = new Date().toISOString();
          session.updatedAt = new Date().toISOString();
          this.saveToDisk();

          console.log(`[QueueManager] Starting execution item: ${item.testScript} [${item.project}]`);

          this.broadcastSse(session.id, {
            type: 'testStart',
            file: item.testScript,
            project: item.project,
            name: item.testName,
            status: 'RUNNING',
          });

          // Run single test combination
          try {
            const result = await runTests({
              browsers: [item.browser],
              devices: [item.device],
              testFiles: [item.testScript],
              retries: session.options.retries,
              headless: session.options.headless,
              workers: 1, // Strictly 1 execution at a time
            }, (event) => {
              // Internal test events can be forwarded if useful
            });

            // Read detailed test result written by baseTest.ts
            if (result && Array.isArray(result.detailedResults) && result.detailedResults.length > 0) {
              const resData = result.detailedResults[0];
              item.testName = resData.testName || item.testName;
              item.viewport = resData.viewport || 'N/A';
              item.status = resData.status || 'FAIL';
              item.retries = resData.retries || 0;
              item.duration = resData.duration || 0;
              item.paymentUrl = resData.paymentUrl || 'N/A';
              item.screenshotPath = resData.screenshotPath || 'N/A';
              item.error = resData.error || '';
              item.failedStep = resData.failedStep || '';
            } else {
              // Fallback status if no detailed JSON was emitted
              item.status = (result && result.exitCode === 0) ? 'PASS' : 'FAIL';
              if (result && result.stderr) item.error = result.stderr.substring(0, 300);
            }
          } catch (execErr) {
            console.error(`[QueueManager] Execution item error for ${item.testScript}:`, execErr.message);
            item.status = 'FAIL';
            item.error = execErr.message || 'Execution failed';
          }

          item.endTime = new Date().toISOString();
          session.updatedAt = new Date().toISOString();

          // Update session counters
          if (item.status === 'PASS' || item.status === 'RETRY_PASS') session.passed++;
          else if (item.status === 'FAIL') session.failed++;
          session.completed++;

          this.saveToDisk();

          console.log(`[QueueManager] Finished item: ${item.testScript} [${item.project}] -> ${item.status}`);

          this.broadcastSse(session.id, {
            type: 'testResult',
            file: item.testScript,
            project: item.project,
            name: item.testName,
            status: item.status,
            duration: item.duration,
            paymentUrl: item.paymentUrl,
            screenshotPath: item.screenshotPath,
            error: item.error,
          });

          // Update HTML report after every completed item
          this.updateHtmlReportForSession(session);
        }

        // Finalize session
        if (!session.stopped) {
          session.status = 'COMPLETED';
        }
        session.updatedAt = new Date().toISOString();
        this.saveToDisk();

        console.log(`[QueueManager] Session #${session.runNumber} (${session.id}) finalized with status '${session.status}'.`);

        this.broadcastSse(session.id, {
          type: 'done',
          status: session.status,
          detailedResults: this.formatDetailedResults(session),
        });

        this.updateHtmlReportForSession(session);
      }
    } catch (err) {
      console.error('[QueueManager] Fatal error in processQueue loop:', err);
    } finally {
      this.isProcessing = false;
    }
  }
}

const queueManager = new QueueManager();

module.exports = queueManager;
