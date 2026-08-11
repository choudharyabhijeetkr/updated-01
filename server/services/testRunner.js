/**
 * testRunner.js
 *
 * Spawns Playwright for a SINGLE execution (testFile, browser, device),
 * parses stdout/stderr in real-time, and returns the result JSON written
 * by baseTest.ts.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { generateSingleExecutionConfig, writeConfig, cleanupConfig } = require('./configGenerator');

function cleanTempResultForExecution(testKey, device, browser) {
  const tempDir = path.join(process.cwd(), '.temp-results');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
    return;
  }
  const targetFile = path.join(tempDir, `${testKey}__${device}__${browser}.json`);
  if (fs.existsSync(targetFile)) {
    try { fs.unlinkSync(targetFile); } catch (_) {}
  }
}

function readResultJsonForExecution(testKey, device, browser) {
  const tempDir = path.join(process.cwd(), '.temp-results');
  const targetFile = path.join(tempDir, `${testKey}__${device}__${browser}.json`);
  if (!fs.existsSync(targetFile)) return null;

  try {
    const content = fs.readFileSync(targetFile, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`[testRunner] Failed to read result JSON for ${testKey}:`, err.message);
    return null;
  }
}

async function runSingleExecution({ testFile, browser, device, retries = 3, headless = true, enableScreenshotCapture = false, sessionTimestamp }, onEvent) {
  const testKey = path.basename(testFile).replace(/\.(spec|test)\.(ts|js)$/, '');
  cleanTempResultForExecution(testKey, device, browser);

  const configStr = generateSingleExecutionConfig({ testFile, browser, device, retries, headless });
  const configFilename = `.temp-run-${Date.now()}-${Math.floor(Math.random() * 10000)}.mjs`;
  const configPath = writeConfig(configStr, configFilename);

  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    let cmd = process.execPath;
    let args = [];
    let useShell = false;

    const cliPath = path.join(process.cwd(), 'node_modules', '@playwright/test', 'cli.js');
    if (fs.existsSync(cliPath)) {
      args = [cliPath, 'test', '--config', configPath];
    } else if (isWindows) {
      const localCmd = path.join(process.cwd(), 'node_modules', '.bin', 'playwright.cmd');
      if (fs.existsSync(localCmd)) {
        cmd = localCmd;
        args = ['test', '--config', configPath];
        useShell = true;
      } else {
        cmd = 'cmd.exe';
        args = ['/c', 'npx', 'playwright', 'test', '--config', configPath];
      }
    } else {
      cmd = 'npx';
      args = ['playwright', 'test', '--config', configPath];
    }

    console.log(`[testRunner] Spawning single execution for ${testFile} [${device}-${browser}]...`);

    let child;
    try {
      child = spawn(cmd, args, {
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: useShell,
        env: {
          ...process.env,
          NODE_ENV: 'test',
          ENABLE_SCREENSHOT_CAPTURE: enableScreenshotCapture ? 'true' : 'false',
          SESSION_TIMESTAMP: sessionTimestamp || new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19),
          CURRENT_SPEC_KEY: testKey,
        },
      });
    } catch (spawnErr) {
      console.error(`[testRunner] Synchronous spawn error for ${testKey}:`, spawnErr.message);
      cleanupConfig(configPath);
      return resolve({
        exitCode: 1,
        stdout: '',
        stderr: `Failed to spawn test process: ${spawnErr.message}`,
        resultJson: null,
      });
    }

    let stdoutData = '';
    let stderrData = '';

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdoutData += text;
      if (onEvent) {
        onEvent({ type: 'stdout', text });
      }
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderrData += text;
      if (onEvent) {
        onEvent({ type: 'stderr', text });
      }
    });

    child.on('close', (code) => {
      cleanupConfig(configPath);
      const resultJson = readResultJsonForExecution(testKey, device, browser);
      resolve({
        exitCode: code,
        stdout: stdoutData,
        stderr: stderrData,
        resultJson,
      });
    });

    child.on('error', (err) => {
      cleanupConfig(configPath);
      resolve({
        exitCode: 1,
        stdout: stdoutData,
        stderr: stderrData + '\n' + err.message,
        resultJson: null,
      });
    });
  });
}

module.exports = {
  runSingleExecution,
};
