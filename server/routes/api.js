/**
 * api.js
 *
 * REST API routes for the test automation runner frontend.
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const os = require('os');
const store = require('../services/sessionStore');
const {
  enqueueSession,
  cancelExecution,
  stopSession,
  registerSseClient,
  getSystemMemoryStatus,
} = require('../services/executionQueue');
const { REPORT_PATH } = require('../services/htmlReportGenerator');

// ── GET /api/health-check ── lightweight system health check
router.get('/health-check', (req, res) => {
  try {
    const totalMemMB = Math.round(os.totalmem() / (1024 * 1024));
    const freeMemMB = Math.round(os.freemem() / (1024 * 1024));
    const cpus = os.cpus();
    const cpuCores = cpus && cpus.length ? cpus.length : 1;

    // Check Playwright package availability
    let playwrightAvailable = false;
    try {
      require.resolve('@playwright/test');
      playwrightAvailable = true;
    } catch (e) {
      try {
        require.resolve('playwright-core');
        playwrightAvailable = true;
      } catch (e2) {}
    }

    // Check installed browser binaries (instant path check, no launch)
    let chromiumInstalled = false;
    let firefoxInstalled = false;
    let webkitInstalled = false;

    try {
      const { chromium, firefox, webkit } = require('playwright-core');
      try {
        if (chromium.executablePath() && fs.existsSync(chromium.executablePath())) {
          chromiumInstalled = true;
        }
      } catch (e) {}
      try {
        if (firefox.executablePath() && fs.existsSync(firefox.executablePath())) {
          firefoxInstalled = true;
        }
      } catch (e) {}
      try {
        if (webkit.executablePath() && fs.existsSync(webkit.executablePath())) {
          webkitInstalled = true;
        }
      } catch (e) {}
    } catch (e) {}

    const isLowMemory = freeMemMB < 600;
    const isLinux = process.platform === 'linux';

    res.json({
      apiReachable: true,
      appTitle: process.env.APP_TITLE || 'Playwright Test Automation',
      playwrightAvailable,
      chromiumInstalled,
      firefoxInstalled,
      webkitInstalled,
      browserVerificationMode: 'executable_path_only',
      osPlatform: process.platform,
      osNote: isLinux
        ? 'Browser paths verified. Host environment must supply required OS shared libraries.'
        : 'Browser paths verified.',
      totalMemMB,
      freeMemMB,
      cpuCores,
      isLowMemory,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({
      apiReachable: false,
      error: err.message,
    });
  }
});

// ── GET /api/system-status ── return RAM metrics and safety limit
router.get('/system-status', (req, res) => {
  try {
    const requestedBatch = req.query.batch ? parseInt(req.query.batch, 10) : 5;
    const status = getSystemMemoryStatus(requestedBatch);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/tests ── list available test files
router.get('/tests', (req, res) => {
  try {
    const testDirRel = process.env.TEST_DIR || './tests/spec';
    const testsDir = path.resolve(process.cwd(), testDirRel);
    if (!fs.existsSync(testsDir)) {
      return res.json({ tests: [] });
    }
    const files = fs.readdirSync(testsDir)
      .filter((f) => f.endsWith('.spec.ts') || f.endsWith('.spec.js'));
    res.json({ tests: files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/sessions ── list all sessions + their executions
router.get('/sessions', (req, res) => {
  try {
    const sessions = store.getAllSessions();
    const result = sessions.map((s) => ({
      ...s,
      executions: store.getExecutionsForSession(s.id),
    }));
    res.json({ sessions: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/sessions/:id ── single session
router.get('/sessions/:id', (req, res) => {
  try {
    const session = store.getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const executions = store.getExecutionsForSession(session.id);
    res.json({ session: { ...session, executions } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/run ── start a new execution session
router.post('/run', (req, res) => {
  try {
    const { testFiles, browsers, devices, retries = 2, headless = true, batchSize = 5 } = req.body;

    if (!Array.isArray(testFiles) || testFiles.length === 0) {
      return res.status(400).json({ error: 'At least one testFile is required' });
    }
    if (!Array.isArray(browsers) || browsers.length === 0) {
      return res.status(400).json({ error: 'At least one browser is required' });
    }
    if (!Array.isArray(devices) || devices.length === 0) {
      return res.status(400).json({ error: 'At least one device is required' });
    }

    const session = enqueueSession({
      testFiles,
      browsers,
      devices,
      retries,
      headless,
      batchSize,
    });

    res.json({
      success: true,
      sessionId: session.id,
      runNumber: session.runNumber,
      totalExecutions: session.executionIds.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/executions/:id/cancel ── cancel pending execution
router.post('/executions/:id/cancel', (req, res) => {
  try {
    const result = cancelExecution(req.params.id);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ success: true, execution: result.execution });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/sessions/:id/stop ── stop entire session
router.post('/sessions/:id/stop', (req, res) => {
  try {
    const result = stopSession(req.params.id);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ success: true, session: result.session });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/sessions/:id/events ── SSE endpoint for live updates
router.get('/sessions/:id/events', (req, res) => {
  const session = store.getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  registerSseClient(session.id, res, req);

  // Send initial snapshot
  const executions = store.getExecutionsForSession(session.id);
  res.write(`data: ${JSON.stringify({ type: 'snapshot', session, executions })}\n\n`);
});

// ── GET /api/report ── HTML report metadata / existence check
router.get('/report', (req, res) => {
  const exists = fs.existsSync(REPORT_PATH);
  res.json({
    exists,
    path: exists ? '/reports/execution-report.html' : null,
  });
});

// ── GET /api/report/excel ── trigger fresh Excel report build & return path
router.get('/report/excel', async (req, res) => {
  try {
    const { updateExcelReportDisk } = require('../services/excelReportGenerator');
    await updateExcelReportDisk();
    const excelPath = path.join(process.cwd(), 'reports', 'test-reports.xlsx');
    const exists = fs.existsSync(excelPath);
    res.json({
      exists,
      path: exists ? '/reports/test-reports.xlsx' : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/settings ── get report & runner settings
router.get('/settings', (req, res) => {
  try {
    res.json({ settings: store.getSettings() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/settings ── update report & runner settings
router.post('/settings', (req, res) => {
  try {
    const { excludeStoppedSessions, hideIncompleteTests, enableScreenshotCapture } = req.body;
    const updated = store.updateSettings({
      ...(typeof excludeStoppedSessions === 'boolean' ? { excludeStoppedSessions } : {}),
      ...(typeof hideIncompleteTests === 'boolean' ? { hideIncompleteTests } : {}),
      ...(typeof enableScreenshotCapture === 'boolean' ? { enableScreenshotCapture } : {}),
    });
    const { updateReportDisk } = require('../services/htmlReportGenerator');
    updateReportDisk();
    res.json({ success: true, settings: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/reset ── clear all session history & reset report
router.post('/reset', (req, res) => {
  try {
    store.clear();
    const { updateReportDisk } = require('../services/htmlReportGenerator');
    updateReportDisk();
    res.json({ success: true, message: 'All report data and execution sessions reset.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
