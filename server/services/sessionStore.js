/**
 * sessionStore.js
 *
 * In-memory + async debounced disk persistence for sessions and executions.
 * Data file: data/store.json
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

class SessionStore {
  constructor() {
    this.sessions = [];            // array of session objects
    this.executionsById = {};      // map execId -> exec object
    this.settings = {
      excludeStoppedSessions: true,
      hideIncompleteTests: true,
      enableScreenshotCapture: false,
    };
    this.saveTimer = null;
    this.isDirty = false;
    this.isWriting = false;

    this.init();
    this.setupShutdownHooks();
  }

  init() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(STORE_FILE)) {
      try {
        const raw = fs.readFileSync(STORE_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        this.sessions = parsed.sessions || [];
        this.executionsById = parsed.executionsById || {};
        this.settings = {
          excludeStoppedSessions: true,
          hideIncompleteTests: true,
          enableScreenshotCapture: false,
          ...(parsed.settings || {}),
        };

        // Reset any RUNNING executions/sessions to PENDING on boot for auto-resume
        let modified = false;
        for (const id in this.executionsById) {
          const exec = this.executionsById[id];
          if (exec.status === 'RUNNING') {
            exec.status = 'PENDING';
            exec.error = '';
            modified = true;
          }
        }
        if (modified) {
          this.saveSync();
        }
      } catch (err) {
        console.error('[sessionStore] Error parsing store.json:', err.message);
        this.sessions = [];
        this.executionsById = {};
        this.settings = {
          excludeStoppedSessions: true,
          hideIncompleteTests: true,
        };
      }
    } else {
      this.saveSync();
    }
  }

  setupShutdownHooks() {
    const onExit = () => {
      if (this.isDirty) {
        this.saveSync();
      }
    };
    process.on('exit', onExit);
    process.on('SIGINT', () => { onExit(); process.exit(0); });
    process.on('SIGTERM', () => { onExit(); process.exit(0); });
  }

  /**
   * Schedule an asynchronous debounced write to store.json.
   * Default delay is 500ms.
   */
  save(delay = 500) {
    this.isDirty = true;
    if (this.saveTimer) return;

    this.saveTimer = setTimeout(() => {
      this.saveAsync();
    }, delay);
  }

  /**
   * Asynchronously writes current state to disk without blocking Node event loop.
   */
  async saveAsync() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (!this.isDirty || this.isWriting) return;

    this.isWriting = true;
    this.isDirty = false;

    try {
      await fs.promises.mkdir(DATA_DIR, { recursive: true });
      const data = {
        sessions: this.sessions,
        executionsById: this.executionsById,
        settings: this.settings,
      };
      await fs.promises.writeFile(STORE_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.error('[sessionStore] Async save error:', err.message);
      this.isDirty = true; // Re-mark dirty to retry on next cycle
    } finally {
      this.isWriting = false;
    }
  }

  /**
   * Synchronous fallback write for initialization and graceful exit.
   */
  saveSync() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const data = {
        sessions: this.sessions,
        executionsById: this.executionsById,
        settings: this.settings,
      };
      fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), 'utf8');
      this.isDirty = false;
    } catch (err) {
      console.error('[sessionStore] Error saving store.json synchronously:', err.message);
    }
  }

  nextRunNumber() {
    if (this.sessions.length === 0) return 1;
    const maxNum = Math.max(...this.sessions.map(s => s.runNumber || 0));
    return maxNum + 1;
  }

  upsertSession(session) {
    const idx = this.sessions.findIndex(s => s.id === session.id);
    if (idx >= 0) {
      this.sessions[idx] = { ...this.sessions[idx], ...session };
    } else {
      this.sessions.push(session);
    }
    this.save(500);
  }

  upsertExecution(exec) {
    this.executionsById[exec.id] = { ...this.executionsById[exec.id], ...exec };
    this.save(500);
  }

  getSession(id) {
    return this.sessions.find(s => s.id === id) || null;
  }

  getExecution(id) {
    return this.executionsById[id] || null;
  }

  getExecutionsForSession(sessionId) {
    const session = this.getSession(sessionId);
    if (!session || !Array.isArray(session.executionIds)) return [];
    return session.executionIds.map(id => this.executionsById[id]).filter(Boolean);
  }

  getAllSessions() {
    return this.sessions;
  }

  getAllData() {
    return {
      sessions: this.sessions,
      executionsById: this.executionsById,
      settings: this.settings || { excludeStoppedSessions: true, hideIncompleteTests: true },
    };
  }

  getSettings() {
    return this.settings || { excludeStoppedSessions: true, hideIncompleteTests: true };
  }

  updateSettings(newSettings) {
    this.settings = {
      ...this.getSettings(),
      ...newSettings,
    };
    this.save(100);
    return this.settings;
  }

  clear() {
    this.sessions = [];
    this.executionsById = {};
    this.save(100);
  }
}

module.exports = new SessionStore();

