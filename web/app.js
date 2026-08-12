/**
 * app.js
 *
 * Frontend script for the Visa Test Automation Dashboard.
 * Includes unified button state management, accessibility feedback, and async task tracking.
 */

document.addEventListener('DOMContentLoaded', () => {
  // UI Elements
  const testList = document.getElementById('testList');
  const testCount = document.getElementById('testCount');
  const selectAllBtn = document.getElementById('selectAllBtn');
  const deselectAllBtn = document.getElementById('deselectAllBtn');
  const testSearch = document.getElementById('testSearch');

  const runSelectedBtn = document.getElementById('runSelectedBtn');
  const runAllBtn = document.getElementById('runAllBtn');

  const summaryTests = document.getElementById('summaryTests');
  const summaryBrowsers = document.getElementById('summaryBrowsers');
  const summaryDevices = document.getElementById('summaryDevices');
  const summaryEquation = document.getElementById('summaryEquation');

  const progressPanel = document.getElementById('progressPanel');
  const sessionHeader = document.getElementById('sessionHeader');
  const passCount = document.getElementById('passCount');
  const failCount = document.getElementById('failCount');
  const pendingCount = document.getElementById('pendingCount');
  const completedCount = document.getElementById('completedCount');
  const totalCombinationsCount = document.getElementById('totalCombinationsCount');
  const progressBar = document.getElementById('progressBar');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  const resultsList = document.getElementById('resultsList');
  const stopExecutionBtn = document.getElementById('stopExecutionBtn');

  const reportPanel = document.getElementById('reportPanel');
  const openHtmlReportBtn = document.getElementById('openHtmlReportBtn');
  const openFolderBtn = document.getElementById('openFolderBtn');
  const resetDataBtn = document.getElementById('resetDataBtn');

  // Statistics UI Elements
  const statTotal = document.getElementById('statTotal');
  const statSelected = document.getElementById('statSelected');
  const statFiltered = document.getElementById('statFiltered');
  const statFilteredPill = document.getElementById('statFilteredPill');
  const clearSearchBtn = document.getElementById('clearSearchBtn');

  // Settings UI Elements
  const settingExcludeStopped = document.getElementById('settingExcludeStopped');
  const settingHideIncomplete = document.getElementById('settingHideIncomplete');
  const settingEnableScreenshot = document.getElementById('settingEnableScreenshot');

  // State
  let allTests = [];
  let selectedTests = new Set();
  let currentSearchTerm = '';
  let currentSessionId = null;
  let sseSource = null;

  // Active operation state flags
  let isRunActive = false;
  let isStartingRun = false;
  let isStoppingRun = false;
  let isResettingData = false;

  // ── Centralized Button State Management ──
  function updateButtonStates() {
    const browsers = getSelectedBrowsers();
    const devices = getSelectedDevices();
    const filteredTests = getFilteredTests();
    const selectedCount = selectedTests.size;
    const totalCount = allTests.length;
    const hasConfig = browsers.length > 0 && devices.length > 0;

    // 1. Run Selected Button
    if (runSelectedBtn) {
      if (isStartingRun) {
        runSelectedBtn.disabled = true;
        runSelectedBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting...';
      } else {
        runSelectedBtn.innerHTML = '<i class="fas fa-play"></i> Run Selected';
        runSelectedBtn.disabled = isRunActive || selectedCount === 0 || !hasConfig;
      }
    }

    // 2. Run All Button
    if (runAllBtn) {
      if (isStartingRun) {
        runAllBtn.disabled = true;
        runAllBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting...';
      } else {
        runAllBtn.innerHTML = '<i class="fas fa-forward"></i> Run All';
        runAllBtn.disabled = isRunActive || totalCount === 0 || !hasConfig;
      }
    }

    // 3. Selection Toolbar Buttons
    if (selectAllBtn) {
      selectAllBtn.disabled = isRunActive || isStartingRun || filteredTests.length === 0;
    }
    if (deselectAllBtn) {
      deselectAllBtn.disabled = isRunActive || isStartingRun || selectedCount === 0;
    }

    // 4. Stop Execution Button
    if (stopExecutionBtn) {
      if (isStoppingRun) {
        stopExecutionBtn.disabled = true;
        stopExecutionBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Stopping...';
      } else if (isRunActive) {
        stopExecutionBtn.disabled = false;
        stopExecutionBtn.innerHTML = '<i class="fas fa-stop-circle"></i> Stop Execution';
      } else {
        stopExecutionBtn.disabled = true;
        stopExecutionBtn.innerHTML = '<i class="fas fa-stop-circle"></i> Stop Execution';
      }
    }

    // 5. Reset / Clear Reports Button
    if (resetDataBtn) {
      if (isResettingData) {
        resetDataBtn.disabled = true;
        resetDataBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Resetting...';
      } else {
        resetDataBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Clear Reports / Reset Test Data';
        resetDataBtn.disabled = isRunActive || isStartingRun;
      }
    }
  }

  // ── Helpers ──
  function formatTestTitle(filename) {
    let name = filename.replace(/\.(spec|test)\.(ts|js)$/i, '');
    name = name.replace(/[-_]/g, ' ');
    return name.split(' ')
      .map(word => word ? word.charAt(0).toUpperCase() + word.slice(1) : '')
      .join(' ');
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function highlightText(text, keyword) {
    const escaped = escapeHtml(text);
    if (!keyword || !keyword.trim()) return escaped;

    const searchTerm = keyword.trim();
    const escapedKeyword = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedKeyword})`, 'gi');

    return escaped.replace(regex, '<mark class="search-highlight">$1</mark>');
  }

  // ── Fetch tests from API ──
  async function loadTests() {
    try {
      const res = await fetch('/api/tests');
      const data = await res.json();
      allTests = data.tests || [];
      renderTestGrid();
      updateSummary();
    } catch (err) {
      console.error('Failed to load tests:', err);
      if (testList) {
        testList.innerHTML = `<div class="error-state"><p>Error loading tests: ${err.message}</p></div>`;
      }
    } finally {
      updateButtonStates();
    }
  }

  function getFilteredTests() {
    if (!currentSearchTerm.trim()) return allTests;
    const term = currentSearchTerm.toLowerCase().trim();
    return allTests.filter(test => {
      const title = formatTestTitle(test).toLowerCase();
      const filename = test.toLowerCase();
      return title.includes(term) || filename.includes(term);
    });
  }

  function renderTestGrid() {
    if (!testList) return;

    const filteredTests = getFilteredTests();

    // Update statistics
    if (statTotal) statTotal.textContent = allTests.length.toString();
    if (statSelected) statSelected.textContent = selectedTests.size.toString();

    if (currentSearchTerm.trim()) {
      if (statFiltered) statFiltered.textContent = filteredTests.length.toString();
      if (statFilteredPill) statFilteredPill.classList.remove('hidden');
      if (clearSearchBtn) clearSearchBtn.classList.remove('hidden');
    } else {
      if (statFilteredPill) statFilteredPill.classList.add('hidden');
      if (clearSearchBtn) clearSearchBtn.classList.add('hidden');
    }

    if (allTests.length === 0) {
      testList.innerHTML = '<div class="empty-state"><i class="fas fa-folder-open"></i><p>No spec files found in configured test directory</p></div>';
      updateButtonStates();
      return;
    }

    if (filteredTests.length === 0) {
      testList.innerHTML = `
        <div class="no-results-state">
          <div class="no-results-icon"><i class="fas fa-search-minus"></i></div>
          <h4>No tests found</h4>
          <p>No matching test scripts found for "<strong>${escapeHtml(currentSearchTerm)}</strong>".</p>
          <button class="btn btn-sm btn-secondary" id="resetSearchBtn"><i class="fas fa-undo"></i> Clear Filter</button>
        </div>
      `;
      const resetBtn = document.getElementById('resetSearchBtn');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          if (testSearch) testSearch.value = '';
          currentSearchTerm = '';
          renderTestGrid();
        });
      }
      updateButtonStates();
      return;
    }

    testList.innerHTML = filteredTests.map(test => {
      const isSelected = selectedTests.has(test);
      const titleFormatted = formatTestTitle(test);
      const titleHighlighted = highlightText(titleFormatted, currentSearchTerm);
      const filenameHighlighted = highlightText(test, currentSearchTerm);

      return `
        <div class="test-card ${isSelected ? 'selected' : ''}" 
             data-file="${escapeHtml(test)}" 
             role="checkbox" 
             aria-checked="${isSelected}" 
             tabindex="0"
             title="${escapeHtml(titleFormatted)} (${escapeHtml(test)})">
          <div class="test-card-checkbox">
            <i class="fas ${isSelected ? 'fa-check' : ''}"></i>
          </div>
          <div class="test-card-content">
            <div class="test-card-title">${titleHighlighted}</div>
            <div class="test-card-filename"><i class="far fa-file-code"></i> ${filenameHighlighted}</div>
          </div>
        </div>
      `;
    }).join('');

    // Attach click & keyboard listeners to test cards
    testList.querySelectorAll('.test-card').forEach(card => {
      const testFile = card.getAttribute('data-file');

      const toggleCard = () => {
        if (selectedTests.has(testFile)) {
          selectedTests.delete(testFile);
        } else {
          selectedTests.add(testFile);
        }
        renderTestGrid();
        updateSummary();
      };

      card.addEventListener('click', toggleCard);

      card.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          toggleCard();
        }
      });
    });

    updateButtonStates();
  }

  // ── Search filter listener ──
  if (testSearch) {
    testSearch.addEventListener('input', (e) => {
      currentSearchTerm = e.target.value;
      renderTestGrid();
    });
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      if (testSearch) testSearch.value = '';
      currentSearchTerm = '';
      renderTestGrid();
    });
  }

  // ── Selection Buttons ──
  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', () => {
      if (isRunActive || isStartingRun) return;
      const visibleTests = getFilteredTests();
      visibleTests.forEach(t => selectedTests.add(t));
      renderTestGrid();
      updateSummary();
    });
  }

  if (deselectAllBtn) {
    deselectAllBtn.addEventListener('click', () => {
      if (isRunActive || isStartingRun) return;
      selectedTests.clear();
      renderTestGrid();
      updateSummary();
    });
  }

  // Listen to configuration checkboxes
  document.querySelectorAll('.browser-checkbox, .device-checkbox').forEach(cb => {
    cb.addEventListener('change', updateSummary);
  });

  function getSelectedBrowsers() {
    return Array.from(document.querySelectorAll('.browser-checkbox:checked')).map(cb => cb.value);
  }

  function getSelectedDevices() {
    return Array.from(document.querySelectorAll('.device-checkbox:checked')).map(cb => cb.value);
  }

  function updateSummary() {
    const browsers = getSelectedBrowsers();
    const devices = getSelectedDevices();
    const testCountNum = selectedTests.size;

    if (summaryTests) summaryTests.textContent = `${testCountNum} Test${testCountNum === 1 ? '' : 's'}`;
    if (summaryBrowsers) summaryBrowsers.textContent = `${browsers.length} (${browsers.join(', ') || 'None'})`;
    if (summaryDevices) summaryDevices.textContent = `${devices.length} (${devices.join(', ') || 'None'})`;

    const totalExecs = testCountNum * browsers.length * devices.length;
    if (summaryEquation) {
      summaryEquation.textContent = `${testCountNum} Tests × ${browsers.length} Engine${browsers.length === 1 ? '' : 's'} × ${devices.length} Platform${devices.length === 1 ? '' : 's'} = ${totalExecs} Executions`;
    }

    updateButtonStates();
  }

  // ── Start Execution ──
  async function startRun(testFiles) {
    if (isRunActive || isStartingRun || !testFiles || testFiles.length === 0) return;

    isStartingRun = true;
    updateButtonStates();

    const browsers = getSelectedBrowsers();
    const devices = getSelectedDevices();
    const retries = parseInt(document.getElementById('retryCount')?.value || '2', 10);
    const rawBatchSize = parseInt(document.getElementById('batchSize')?.value || '5', 10);
    const batchSize = isNaN(rawBatchSize) ? 5 : Math.min(10, Math.max(1, rawBatchSize));
    const headless = document.getElementById('headlessMode')?.checked ?? true;

    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testFiles, browsers, devices, retries, headless, batchSize }),
      });

      const data = await res.json();
      if (!data.success) {
        alert('Failed to start run: ' + (data.error || 'Unknown error'));
        isStartingRun = false;
        updateButtonStates();
        return;
      }

      currentSessionId = data.sessionId;
      isRunActive = true;
      showProgressPanel(data.sessionId, data.runNumber, data.totalExecutions, batchSize);
      connectSse(data.sessionId);
    } catch (err) {
      console.error('Error starting run:', err);
      alert('Network error starting run: ' + err.message);
    } finally {
      isStartingRun = false;
      updateButtonStates();
    }
  }

  if (runSelectedBtn) {
    runSelectedBtn.addEventListener('click', () => {
      startRun(Array.from(selectedTests));
    });
  }

  if (runAllBtn) {
    runAllBtn.addEventListener('click', () => {
      startRun(allTests);
    });
  }

  if (stopExecutionBtn) {
    stopExecutionBtn.addEventListener('click', async () => {
      if (!currentSessionId || !isRunActive || isStoppingRun) return;
      isStoppingRun = true;
      updateButtonStates();
      try {
        await fetch(`/api/sessions/${currentSessionId}/stop`, { method: 'POST' });
      } catch (err) {
        console.error('Error stopping session:', err);
      } finally {
        isStoppingRun = false;
        updateButtonStates();
      }
    });
  }

  function showProgressPanel(sessionId, runNumber, totalExecs, batchSize = 5) {
    if (progressPanel) progressPanel.style.display = 'block';
    if (sessionHeader) sessionHeader.textContent = `Execution Session #${runNumber}`;
    const sessionSubtext = document.getElementById('sessionSubtext');
    if (sessionSubtext) {
      sessionSubtext.textContent = `Target: ${totalExecs} Executions | Batch Size: ${batchSize} Simultaneous`;
    }
    if (totalCombinationsCount) totalCombinationsCount.textContent = totalExecs.toString();
    if (resultsList) resultsList.innerHTML = '';
    updateProgressUI(0, 0, totalExecs, 0, totalExecs);
  }

  function updateProgressUI(passed, failed, pending, completed, total) {
    if (passCount) passCount.textContent = passed.toString();
    if (failCount) failCount.textContent = failed.toString();
    if (pendingCount) pendingCount.textContent = pending.toString();
    if (completedCount) completedCount.textContent = completed.toString();

    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    if (progressFill) progressFill.style.width = `${pct}%`;
    if (progressText) progressText.textContent = `${pct}%`;
  }

  // ── SSE Connection ──
  function connectSse(sessionId) {
    if (sseSource) sseSource.close();

    sseSource = new EventSource(`/api/sessions/${sessionId}/events`);

    sseSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleSseEvent(data);
      } catch (err) {
        console.error('Error parsing SSE data:', err);
      }
    };

    sseSource.onerror = (err) => {
      console.warn('SSE connection error:', err);
    };
  }

  function handleSseEvent(data) {
    if (data.type === 'snapshot') {
      renderExecutions(data.executions);
    } else if (data.type === 'executionUpdate') {
      upsertExecutionItem(data.execution);
    } else if (data.type === 'sessionDone') {
      if (sseSource) sseSource.close();
      isRunActive = false;
      updateButtonStates();
      checkReportAvailable();
    }
  }

  const executionMap = new Map();

  function renderExecutions(executions) {
    executionMap.clear();
    if (resultsList) resultsList.innerHTML = '';
    let passed = 0, failed = 0, pending = 0, completed = 0;
    let hasActive = false;

    for (const exec of executions) {
      executionMap.set(exec.id, exec);
      if (exec.status === 'PASS' || exec.status === 'RETRY_PASS') passed++;
      else if (exec.status === 'FAIL') failed++;
      else if (exec.status === 'PENDING') pending++;

      if (['RUNNING', 'PENDING'].includes(exec.status)) {
        hasActive = true;
      }

      if (['PASS', 'FAIL', 'CANCELLED', 'STOPPED', 'RETRY_PASS'].includes(exec.status)) {
        completed++;
      }

      appendOrUpdateExecRow(exec);
    }

    isRunActive = hasActive;
    updateButtonStates();
    updateProgressUI(passed, failed, pending, completed, executions.length);
  }

  function upsertExecutionItem(exec) {
    executionMap.set(exec.id, exec);
    appendOrUpdateExecRow(exec);

    let passed = 0, failed = 0, pending = 0, completed = 0;
    let hasActive = false;

    for (const e of executionMap.values()) {
      if (e.status === 'PASS' || e.status === 'RETRY_PASS') passed++;
      else if (e.status === 'FAIL') failed++;
      else if (e.status === 'PENDING') pending++;

      if (['RUNNING', 'PENDING'].includes(e.status)) {
        hasActive = true;
      }

      if (['PASS', 'FAIL', 'CANCELLED', 'STOPPED', 'RETRY_PASS'].includes(e.status)) {
        completed++;
      }
    }

    isRunActive = hasActive;
    updateButtonStates();
    updateProgressUI(passed, failed, pending, completed, executionMap.size);
  }

  function getStatusBadgeHtml(status) {
    switch (status) {
      case 'PASS':
        return `<span class="status-badge status-PASS"><i class="fas fa-check-circle"></i> PASS</span>`;
      case 'RETRY_PASS':
        return `<span class="status-badge status-PASS"><i class="fas fa-check-circle"></i> RETRY PASS</span>`;
      case 'FAIL':
        return `<span class="status-badge status-FAIL"><i class="fas fa-times-circle"></i> FAIL</span>`;
      case 'RUNNING':
        return `<span class="status-badge status-RUNNING"><i class="fas fa-spinner fa-spin"></i> RUNNING</span>`;
      case 'PENDING':
        return `<span class="status-badge status-PENDING"><i class="fas fa-clock"></i> PENDING</span>`;
      case 'CANCELLED':
        return `<span class="status-badge status-CANCELLED"><i class="fas fa-ban"></i> CANCELLED</span>`;
      case 'STOPPED':
        return `<span class="status-badge status-STOPPED"><i class="fas fa-stop-circle"></i> STOPPED</span>`;
      default:
        return `<span class="status-badge status-PENDING">${escapeHtml(status || 'UNKNOWN')}</span>`;
    }
  }

  function getDeviceIcon(device) {
    if (/android/i.test(device)) return 'fa-android';
    if (/ios/i.test(device)) return 'fa-apple';
    return 'fa-desktop';
  }

  function getBrowserIcon(browser) {
    if (/firefox/i.test(browser)) return 'fa-firefox-browser';
    if (/webkit|safari/i.test(browser)) return 'fa-safari';
    return 'fa-chrome';
  }

  // ─── Modal Management ───
  const errorModal = document.getElementById('errorModal');
  const errorModalTitle = document.getElementById('errorModalTitle');
  const errorModalMeta = document.getElementById('errorModalMeta');
  const errorModalTrace = document.getElementById('errorModalTrace');
  const errorModalCloseBtn = document.getElementById('errorModalCloseBtn');
  const errorModalOkBtn = document.getElementById('errorModalOkBtn');
  const errorModalCopyBtn = document.getElementById('errorModalCopyBtn');

  const executionErrorStore = new Map();

  window.openErrorModal = function(execId) {
    const errorData = executionErrorStore.get(execId);
    if (!errorData || !errorModal) return;

    if (errorModalMeta) {
      errorModalMeta.innerHTML = `
        <strong>${escapeHtml(errorData.title)}</strong> &bull; 
        <span>${escapeHtml(errorData.device)} / ${escapeHtml(errorData.browser)}</span>
      `;
    }
    if (errorModalTrace) {
      errorModalTrace.textContent = errorData.error;
    }

    errorModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  };

  function closeErrorModal() {
    if (!errorModal) return;
    errorModal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  if (errorModalCloseBtn) errorModalCloseBtn.addEventListener('click', closeErrorModal);
  if (errorModalOkBtn) errorModalOkBtn.addEventListener('click', closeErrorModal);

  if (errorModal) {
    errorModal.addEventListener('click', (e) => {
      if (e.target === errorModal) closeErrorModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && errorModal && !errorModal.classList.contains('hidden')) {
      closeErrorModal();
    }
  });

  if (errorModalCopyBtn) {
    errorModalCopyBtn.addEventListener('click', () => {
      if (errorModalTrace && errorModalTrace.textContent) {
        errorModalCopyBtn.disabled = true;
        navigator.clipboard.writeText(errorModalTrace.textContent).then(() => {
          const origText = errorModalCopyBtn.innerHTML;
          errorModalCopyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
          setTimeout(() => {
            errorModalCopyBtn.innerHTML = origText;
            errorModalCopyBtn.disabled = false;
          }, 2000);
        }).catch(err => {
          console.error('Failed to copy error:', err);
          errorModalCopyBtn.disabled = false;
        });
      }
    });
  }

  function appendOrUpdateExecRow(exec) {
    if (!resultsList) return;
    let row = document.getElementById(`exec-row-${exec.id}`);
    if (!row) {
      row = document.createElement('tr');
      row.id = `exec-row-${exec.id}`;
      row.className = 'exec-tr-row';
      resultsList.appendChild(row);
    }

    const cancelBtnHtml = exec.status === 'PENDING'
      ? `<button id="cancel-btn-${exec.id}" class="btn-table btn-table-cancel" onclick="cancelExec('${exec.id}')"><i class="fas fa-ban"></i> Cancel</button>`
      : '<span class="empty-cell">—</span>';

    const attempts = exec.retries != null ? (exec.retries + 1) : 1;
    const attemptBadge = `<span class="exec-attempts">Attempt #${attempts}</span>`;

    const payUrlHtml = (exec.paymentUrl && exec.paymentUrl !== 'N/A')
      ? `<a href="${escapeHtml(exec.paymentUrl)}" target="_blank" class="btn-table btn-table-url"><i class="fas fa-external-link-alt"></i> Open URL</a>`
      : '<span class="empty-cell">—</span>';

    const screenshotHtml = (exec.screenshotPath && exec.screenshotPath !== 'N/A')
      ? `<a href="${escapeHtml(exec.screenshotPath)}" target="_blank" class="btn-table btn-table-screenshot"><i class="fas fa-image"></i> View Screenshot</a>`
      : '<span class="empty-cell">—</span>';

    const statusBadge = getStatusBadgeHtml(exec.status);
    const durationText = exec.duration != null ? `${exec.duration}s` : '—';
    const formattedTitle = formatTestTitle(exec.testScript);

    let errorHtml = '<span class="empty-cell">—</span>';
    if (exec.error && exec.error.trim()) {
      executionErrorStore.set(exec.id, {
        title: formattedTitle || exec.testScript,
        device: exec.device,
        browser: exec.browser,
        error: exec.error
      });

      const shortErr = exec.error.length > 35 ? exec.error.substring(0, 35) + '…' : exec.error;
      errorHtml = `
        <div class="error-cell-wrapper">
          <span class="error-preview" title="${escapeHtml(exec.error)}">${escapeHtml(shortErr)}</span>
          <button type="button" class="btn-table btn-table-details" onclick="openErrorModal('${exec.id}')">
            <i class="fas fa-external-link-alt"></i> View Details
          </button>
        </div>
      `;
    }

    row.innerHTML = `
      <td>
        <div class="test-script-cell">
          <strong class="test-title">${escapeHtml(formattedTitle)}</strong>
          <span class="test-file">${escapeHtml(exec.testScript)}</span>
        </div>
      </td>
      <td>
        <div class="env-cell">
          <span class="platform-chip"><i class="${exec.device === 'Android' ? 'fab' : exec.device === 'iOS' ? 'fab' : 'fas'} ${getDeviceIcon(exec.device)}"></i> ${escapeHtml(exec.device)}</span>
          <span class="engine-chip"><i class="fab ${getBrowserIcon(exec.browser)}"></i> ${escapeHtml(exec.browser)}</span>
        </div>
      </td>
      <td>${statusBadge}</td>
      <td>${attemptBadge}</td>
      <td>${payUrlHtml}</td>
      <td>${screenshotHtml}</td>
      <td><span class="duration-badge">${escapeHtml(durationText)}</span></td>
      <td>${errorHtml}</td>
      <td>${cancelBtnHtml}</td>
    `;
  }

  window.cancelExec = async function(execId) {
    const btn = document.getElementById(`cancel-btn-${execId}`);
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cancelling...';
    }
    try {
      await fetch(`/api/executions/${execId}/cancel`, { method: 'POST' });
    } catch (err) {
      console.error('Error cancelling execution:', err);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-ban"></i> Cancel';
      }
    }
  };

  async function loadLatestSession() {
    try {
      const res = await fetch('/api/sessions');
      const data = await res.json();
      const sessions = data.sessions || [];
      if (sessions.length === 0) {
        isRunActive = false;
        updateButtonStates();
        return;
      }

      const latest = sessions[sessions.length - 1];
      if (!latest || !latest.executions) {
        isRunActive = false;
        updateButtonStates();
        return;
      }

      currentSessionId = latest.id;
      showProgressPanel(
        latest.id,
        latest.runNumber,
        latest.executions.length,
        latest.options?.batchSize || 5
      );
      renderExecutions(latest.executions);

      if (latest.status === 'RUNNING' || latest.status === 'PENDING') {
        connectSse(latest.id);
      }
    } catch (err) {
      console.error('Failed to load session history:', err);
      isRunActive = false;
      updateButtonStates();
    }
  }

  async function checkReportAvailable() {
    try {
      const res = await fetch('/api/report');
      const data = await res.json();
      if (reportPanel) {
        reportPanel.style.display = 'block';
      }
      const iframe = document.getElementById('reportFrame');
      if (iframe && data.path) {
        iframe.src = data.path + '?t=' + Date.now();
      }

      // Check session history to properly manage action button states
      try {
        const sessRes = await fetch('/api/sessions');
        const sessData = await sessRes.json();
        const hasData = Array.isArray(sessData.sessions) && sessData.sessions.length > 0;
        if (openHtmlReportBtn) openHtmlReportBtn.disabled = !hasData;
        if (openFolderBtn) openFolderBtn.disabled = !hasData;
        if (resetDataBtn) resetDataBtn.disabled = !hasData || isRunActive || isStartingRun || isResettingData;
      } catch (e) {
        if (openHtmlReportBtn) openHtmlReportBtn.disabled = !data.exists;
        if (openFolderBtn) openFolderBtn.disabled = !data.exists;
      }
    } catch (err) {
      console.error('Error checking report:', err);
    }
  }

  if (openHtmlReportBtn) {
    openHtmlReportBtn.addEventListener('click', () => {
      window.open('/reports/execution-report.html', '_blank');
    });
  }

  if (openFolderBtn) {
    openFolderBtn.addEventListener('click', () => {
      window.open('/reports/execution-report.html', '_blank');
    });
  }

  if (resetDataBtn) {
    resetDataBtn.addEventListener('click', async () => {
      if (isRunActive || isResettingData) return;
      if (confirm('Are you sure you want to clear all test execution history and reset HTML reports?')) {
        isResettingData = true;
        updateButtonStates();
        try {
          const res = await fetch('/api/reset', { method: 'POST' });
          const data = await res.json();
          if (data.success) {
            if (progressPanel) progressPanel.style.display = 'none';
            if (resultsList) resultsList.innerHTML = '';
            currentSessionId = null;
            isRunActive = false;
            checkReportAvailable();
          } else {
            alert('Failed to reset data: ' + (data.error || 'Unknown error'));
          }
        } catch (err) {
          console.error('Error resetting report data:', err);
          alert('Error resetting data: ' + err.message);
        } finally {
          isResettingData = false;
          updateButtonStates();
        }
      }
    });
  }

  async function loadSettings() {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.settings) {
        if (settingExcludeStopped) settingExcludeStopped.checked = !!data.settings.excludeStoppedSessions;
        if (settingHideIncomplete) settingHideIncomplete.checked = !!data.settings.hideIncompleteTests;
        if (settingEnableScreenshot) settingEnableScreenshot.checked = !!data.settings.enableScreenshotCapture;
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  }

  async function updateSettings() {
    try {
      const scrollPos = window.scrollY;
      const payload = {
        excludeStoppedSessions: settingExcludeStopped ? settingExcludeStopped.checked : false,
        hideIncompleteTests: settingHideIncomplete ? settingHideIncomplete.checked : false,
        enableScreenshotCapture: settingEnableScreenshot ? settingEnableScreenshot.checked : false,
      };
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        const iframe = document.getElementById('reportFrame');
        if (iframe) {
          iframe.src = '/reports/execution-report.html?t=' + Date.now();
        }
        window.scrollTo({ top: scrollPos, behavior: 'instant' });
      }
    } catch (err) {
      console.error('Failed to update settings:', err);
    }
  }

  if (settingExcludeStopped) {
    settingExcludeStopped.addEventListener('change', updateSettings);
  }
  if (settingHideIncomplete) {
    settingHideIncomplete.addEventListener('change', updateSettings);
  }
  if (settingEnableScreenshot) {
    settingEnableScreenshot.addEventListener('change', updateSettings);
  }

  // ── Help Guide Modal ──
  const helpGuideBtn = document.getElementById('helpGuideBtn');
  const helpGuideModal = document.getElementById('helpGuideModal');
  const helpGuideModalCloseBtn = document.getElementById('helpGuideModalCloseBtn');
  const helpGuideOkBtn = document.getElementById('helpGuideOkBtn');

  function openHelpGuideModal() {
    if (helpGuideModal) helpGuideModal.classList.remove('hidden');
  }

  function closeHelpGuideModal() {
    if (helpGuideModal) helpGuideModal.classList.add('hidden');
  }

  if (helpGuideBtn) {
    helpGuideBtn.addEventListener('click', openHelpGuideModal);
  }
  if (helpGuideModalCloseBtn) {
    helpGuideModalCloseBtn.addEventListener('click', closeHelpGuideModal);
  }
  if (helpGuideOkBtn) {
    helpGuideOkBtn.addEventListener('click', closeHelpGuideModal);
  }

  if (helpGuideModal) {
    helpGuideModal.addEventListener('click', (e) => {
      if (e.target === helpGuideModal) closeHelpGuideModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && helpGuideModal && !helpGuideModal.classList.contains('hidden')) {
      closeHelpGuideModal();
    }
  });

  // Initial load
  loadSettings();
  loadTests();
  loadLatestSession();
  checkReportAvailable();
  checkSystemStatus(true);
  updateButtonStates();

  // ── System Memory & Device Specs Status Check ──
  const memoryGuardBadge = document.getElementById('memoryGuardBadge');
  const memoryGuardHint = document.getElementById('memoryGuardHint');
  const batchSizeInput = document.getElementById('batchSize');
  let userHasManuallyChangedBatch = false;

  async function checkSystemStatus(isInitial = false) {
    try {
      const rawVal = batchSizeInput ? parseInt(batchSizeInput.value, 10) : 5;
      const requested = isNaN(rawVal) || rawVal < 1 ? 5 : rawVal;
      const res = await fetch(`/api/system-status?batch=${requested}`);
      if (!res.ok) return;
      const data = await res.json();

      // Auto-adjust default batch concurrency if on initial load and user hasn't typed a custom value
      if (isInitial && batchSizeInput && !userHasManuallyChangedBatch && data.recommendedBatch) {
        if (parseInt(batchSizeInput.value, 10) !== data.recommendedBatch) {
          batchSizeInput.value = data.recommendedBatch;
        }
      }

      const totalGB = data.totalMemMB ? (data.totalMemMB / 1024).toFixed(1) : '4.0';

      if (memoryGuardBadge) {
        if (data.isThrottled) {
          memoryGuardBadge.textContent = `Throttled: Max ${data.effectiveConcurrency} Safe (${data.freeMemMB}MB Free)`;
          memoryGuardBadge.style.backgroundColor = '#f59e0b';
          memoryGuardBadge.style.color = '#ffffff';
        } else {
          memoryGuardBadge.textContent = `Auto-Detected: ${data.recommendedBatch} Safe (${data.cpuCores || 2} vCPU, ${totalGB}GB RAM)`;
          memoryGuardBadge.style.backgroundColor = '';
          memoryGuardBadge.style.color = '';
        }
      }

      if (memoryGuardHint) {
        if (data.isThrottled) {
          memoryGuardHint.textContent = `RAM Safety Guard active: Requested ${data.requestedBatch}, auto-throttling to max ${data.effectiveConcurrency} worker(s) to prevent system freeze.`;
        } else {
          memoryGuardHint.textContent = `Auto-calculated ${data.recommendedBatch} parallel workers for your hardware (${data.cpuCores || 2} vCPUs, ${totalGB}GB RAM, ${data.freeMemMB}MB free).`;
        }
      }
    } catch (err) {
      console.warn('Failed to fetch system status:', err);
    }
  }

  if (batchSizeInput) {
    batchSizeInput.addEventListener('input', () => {
      userHasManuallyChangedBatch = true;
      checkSystemStatus(false);
    });
  }

  // ── Lightweight System Health & Connection Status Indicator ──
  const serverStatusBadge = document.getElementById('serverStatus');
  const serverStatusText = document.getElementById('serverStatusText');
  const healthStatusModal = document.getElementById('healthStatusModal');
  const closeHealthModalBtn = document.getElementById('closeHealthModalBtn');
  const closeHealthModalFooterBtn = document.getElementById('closeHealthModalFooterBtn');
  const recheckHealthBtn = document.getElementById('recheckHealthBtn');
  const recheckIcon = document.getElementById('recheckIcon');
  const healthBannerDot = document.getElementById('healthBannerDot');
  const healthBannerText = document.getElementById('healthBannerText');
  const healthCheckList = document.getElementById('healthCheckList');
  const healthGuidanceBox = document.getElementById('healthGuidanceBox');
  const healthGuidanceText = document.getElementById('healthGuidanceText');

  async function runLightweightHealthCheck() {
    if (recheckIcon) recheckIcon.classList.add('fa-spin');

    try {
      const res = await fetch('/api/health-check');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      renderHealthStatus(data);
    } catch (err) {
      console.warn('Health check failed:', err);
      renderHealthStatus({
        apiReachable: false,
        playwrightAvailable: false,
        chromiumInstalled: false,
        firefoxInstalled: false,
        webkitInstalled: false,
        totalMemMB: 0,
        freeMemMB: 0,
        cpuCores: 0,
        isLowMemory: false,
        specCount: 0,
        error: err.message,
      });
    } finally {
      if (recheckIcon) recheckIcon.classList.remove('fa-spin');
    }
  }

  function renderHealthStatus(data) {
    // Determine overall state: 'ready' | 'warning' | 'error' | 'disconnected'
    let state = 'ready';
    let overallText = 'System Ready — All mandatory checks passed';
    let badgeText = 'System Ready';

    if (!data.apiReachable) {
      state = 'disconnected';
      overallText = 'Disconnected — Backend Server Unreachable';
      badgeText = 'Disconnected';
    } else if (!data.playwrightAvailable || (!data.chromiumInstalled && !data.firefoxInstalled && !data.webkitInstalled)) {
      state = 'error';
      overallText = 'Critical Error — System cannot execute test suite';
      badgeText = 'Critical Error';
    } else if (!data.chromiumInstalled || !data.firefoxInstalled || !data.webkitInstalled || data.isLowMemory) {
      state = 'warning';
      overallText = 'Action Needed — System functional with warnings';
      badgeText = 'Action Needed';
    }

    // 0. Update App Title Heading if provided by server
    if (data.appTitle) {
      const appHeading = document.getElementById('appTitleHeading');
      if (appHeading) appHeading.textContent = data.appTitle;
      document.title = `${data.appTitle} Dashboard`;
    }

    // 1. Update Header Badge
    if (serverStatusBadge) {
      serverStatusBadge.className = `status-badge clickable-status-badge status-${state}`;
    }
    if (serverStatusText) {
      serverStatusText.textContent = badgeText;
    }

    // 2. Update Modal Banner
    if (healthBannerDot) {
      healthBannerDot.className = `health-banner-dot status-${state}`;
    }
    if (healthBannerText) {
      healthBannerText.textContent = overallText;
    }

    // 3. Render Checklist Grid
    if (healthCheckList) {
      const items = [
        {
          title: 'Backend API',
          subtitle: data.apiReachable ? 'Express server active on port 3000' : 'Server endpoint unreachable',
          status: data.apiReachable ? 'ready' : 'disconnected',
          badge: data.apiReachable ? 'Connected' : 'Offline',
          icon: 'fa-server'
        },
        {
          title: 'SSE Stream Connection',
          subtitle: 'Real-time execution updates channel',
          status: 'ready',
          badge: 'Active',
          icon: 'fa-network-wired'
        },
        {
          title: 'Playwright Framework',
          subtitle: data.playwrightAvailable ? 'Core @playwright/test library loaded' : 'Package @playwright/test missing',
          status: data.playwrightAvailable ? 'ready' : 'error',
          badge: data.playwrightAvailable ? 'Available' : 'Missing',
          icon: 'fa-vial'
        },
        {
          title: 'Chromium Engine',
          subtitle: data.chromiumInstalled ? 'Chromium browser binary ready' : 'Chromium binary not downloaded',
          status: data.chromiumInstalled ? 'ready' : 'warning',
          badge: data.chromiumInstalled ? 'Installed' : 'Missing',
          icon: 'fa-chrome'
        },
        {
          title: 'Firefox Engine',
          subtitle: data.firefoxInstalled ? 'Firefox browser binary ready' : 'Firefox binary not downloaded',
          status: data.firefoxInstalled ? 'ready' : 'warning',
          badge: data.firefoxInstalled ? 'Installed' : 'Missing',
          icon: 'fa-firefox-browser'
        },
        {
          title: 'WebKit Engine',
          subtitle: data.webkitInstalled ? 'WebKit Safari engine ready' : 'WebKit binary not downloaded',
          status: data.webkitInstalled ? 'ready' : 'warning',
          badge: data.webkitInstalled ? 'Installed' : 'Missing',
          icon: 'fa-safari'
        },
        {
          title: 'System Memory & CPU',
          subtitle: `${data.freeMemMB}MB free / ${data.totalMemMB}MB total (${data.cpuCores} vCPUs)`,
          status: data.isLowMemory ? 'warning' : 'ready',
          badge: data.isLowMemory ? 'Low RAM' : 'Adequate',
          icon: 'fa-microchip'
        }
      ];

      healthCheckList.innerHTML = items.map(item => {
        let iconHtml = '';
        let badgeClass = '';
        if (item.status === 'ready') {
          iconHtml = '<i class="fas fa-check-circle text-success health-card-icon" style="color: #16a34a;"></i>';
          badgeClass = 'badge-ready';
        } else if (item.status === 'warning') {
          iconHtml = '<i class="fas fa-exclamation-triangle text-warning health-card-icon" style="color: #d97706;"></i>';
          badgeClass = 'badge-warning';
        } else if (item.status === 'error') {
          iconHtml = '<i class="fas fa-times-circle text-danger health-card-icon" style="color: #dc2626;"></i>';
          badgeClass = 'badge-error';
        } else {
          iconHtml = '<i class="fas fa-minus-circle text-muted health-card-icon" style="color: #94a3b8;"></i>';
          badgeClass = 'badge-muted';
        }

        return `
          <div class="health-card">
            <div class="health-card-left">
              ${iconHtml}
              <div class="health-card-info">
                <span class="health-card-title">${escapeHtml(item.title)}</span>
                <span class="health-card-subtitle">${escapeHtml(item.subtitle)}</span>
              </div>
            </div>
            <span class="health-card-badge ${badgeClass}">${escapeHtml(item.badge)}</span>
          </div>
        `;
      }).join('');
    }

    // 4. Render Action Guidance Box if any issues exist
    const tips = [];
    if (!data.apiReachable) {
      tips.push('Ensure the Express backend server is running on port 3000.');
    }
    if (!data.playwrightAvailable) {
      tips.push('Run <code>npm install</code> in terminal to install @playwright/test.');
    }

    const missingBrowsers = [];
    if (!data.chromiumInstalled) missingBrowsers.push('chromium');
    if (!data.firefoxInstalled) missingBrowsers.push('firefox');
    if (!data.webkitInstalled) missingBrowsers.push('webkit');

    if (missingBrowsers.length > 0) {
      tips.push(`To run tests on all engines, install missing browsers: <code>npx playwright install ${missingBrowsers.join(' ')}</code>`);
    }

    if (data.isLowMemory) {
      tips.push(`Free RAM is low (${data.freeMemMB}MB). Lower the Batch Concurrency setting to avoid memory throttling.`);
    }

    if (healthGuidanceBox && healthGuidanceText) {
      if (tips.length > 0) {
        healthGuidanceText.innerHTML = tips.map(t => `<p>&bull; ${t}</p>`).join('');
        healthGuidanceBox.classList.remove('hidden');
      } else {
        healthGuidanceBox.classList.add('hidden');
      }
    }
  }

  // Modal Open / Close Handlers
  function openHealthModal() {
    if (healthStatusModal) healthStatusModal.classList.remove('hidden');
  }

  function closeHealthModal() {
    if (healthStatusModal) healthStatusModal.classList.add('hidden');
  }

  if (serverStatusBadge) {
    serverStatusBadge.addEventListener('click', openHealthModal);
  }
  if (closeHealthModalBtn) {
    closeHealthModalBtn.addEventListener('click', closeHealthModal);
  }
  if (closeHealthModalFooterBtn) {
    closeHealthModalFooterBtn.addEventListener('click', closeHealthModal);
  }
  if (recheckHealthBtn) {
    recheckHealthBtn.addEventListener('click', runLightweightHealthCheck);
  }

  if (healthStatusModal) {
    healthStatusModal.addEventListener('click', (e) => {
      if (e.target === healthStatusModal) closeHealthModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && healthStatusModal && !healthStatusModal.classList.contains('hidden')) {
      closeHealthModal();
    }
  });

  // Run health check ONCE on initial dashboard load
  runLightweightHealthCheck();

  // ─── DYNAMIC GLOBAL FLOATING TOOLTIP SYSTEM ───
  // Creates a single portal element directly on <body> to bypass all card/grid overflow and stacking contexts.
  let globalTooltipEl = document.getElementById('global-floating-tooltip');
  if (!globalTooltipEl) {
    globalTooltipEl = document.createElement('div');
    globalTooltipEl.id = 'global-floating-tooltip';
    globalTooltipEl.className = 'global-floating-tooltip';
    globalTooltipEl.innerHTML = `
      <div id="globalTooltipContent"></div>
      <div class="tooltip-arrow" id="globalTooltipArrow"></div>
    `;
    document.body.appendChild(globalTooltipEl);
  }

  let activeTooltipContainer = null;

  function positionFloatingTooltip(container) {
    if (!globalTooltipEl || !container) return;
    const sourcePopup = container.querySelector('.tooltip-popup');
    if (!sourcePopup) return;

    const contentEl = document.getElementById('globalTooltipContent');
    const arrowEl = document.getElementById('globalTooltipArrow');
    if (!contentEl || !arrowEl) return;

    // Populate content
    contentEl.innerHTML = sourcePopup.innerHTML;

    // Check special width mode (e.g. screenshot guide)
    if (sourcePopup.classList.contains('screenshot-tooltip')) {
      globalTooltipEl.classList.add('screenshot-tooltip-mode');
    } else {
      globalTooltipEl.classList.remove('screenshot-tooltip-mode');
    }

    // Get trigger target icon bounds
    const triggerIcon = container.querySelector('.tooltip-icon') || container;
    const rect = triggerIcon.getBoundingClientRect();
    const triggerCenterX = rect.left + rect.width / 2;

    // Make visible temporarily offscreen to measure real rendered dimensions
    globalTooltipEl.style.left = '-9999px';
    globalTooltipEl.style.top = '-9999px';
    globalTooltipEl.classList.add('visible');

    const tooltipWidth = globalTooltipEl.offsetWidth;
    const tooltipHeight = globalTooltipEl.offsetHeight;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const gap = 8; // Margin between icon and tooltip
    const screenMargin = 12; // Minimum gap from viewport edges

    // 1. VERTICAL POSITIONING (TOP vs BOTTOM)
    // Default to TOP position
    let placement = 'top';
    let top = rect.top - tooltipHeight - gap;

    // Check if placing above would bleed past top edge of screen
    if (top < screenMargin) {
      // Flip to place below icon
      placement = 'bottom';
      top = rect.bottom + gap;

      // If placing below also bleeds past bottom of screen, clamp top
      if (top + tooltipHeight > viewportHeight - screenMargin) {
        top = viewportHeight - tooltipHeight - screenMargin;
      }
    }

    // Double check top clamping if screen height is very small
    if (top < screenMargin) {
      top = screenMargin;
    }

    // 2. HORIZONTAL POSITIONING (CENTERED over icon, clamped inside screen margins)
    let left = triggerCenterX - tooltipWidth / 2;

    if (left < screenMargin) {
      left = screenMargin;
    } else if (left + tooltipWidth > viewportWidth - screenMargin) {
      left = viewportWidth - tooltipWidth - screenMargin;
    }

    // 3. ARROW POSITIONING (Points directly to icon center)
    let arrowX = triggerCenterX - left;
    // Clamp arrow position inside rounded box bounds (14px from left/right edges)
    arrowX = Math.max(14, Math.min(arrowX, tooltipWidth - 14));

    // Apply computed fixed positions
    globalTooltipEl.style.left = `${Math.round(left)}px`;
    globalTooltipEl.style.top = `${Math.round(top)}px`;

    globalTooltipEl.classList.remove('placement-top', 'placement-bottom');
    globalTooltipEl.classList.add(`placement-${placement}`);

    arrowEl.style.left = `${Math.round(arrowX - 6)}px`;
  }

  function hideFloatingTooltip() {
    if (!globalTooltipEl) return;
    globalTooltipEl.classList.remove('visible');
    activeTooltipContainer = null;
  }

  // Delegated Event Listeners for Tooltips
  document.addEventListener('mouseover', (e) => {
    const container = e.target.closest('.info-tooltip-container');
    if (container) {
      activeTooltipContainer = container;
      positionFloatingTooltip(container);
    }
  });

  document.addEventListener('mouseout', (e) => {
    const container = e.target.closest('.info-tooltip-container');
    if (container && activeTooltipContainer === container) {
      hideFloatingTooltip();
    }
  });

  document.addEventListener('focusin', (e) => {
    const container = e.target.closest('.info-tooltip-container');
    if (container) {
      activeTooltipContainer = container;
      positionFloatingTooltip(container);
    }
  });

  document.addEventListener('focusout', (e) => {
    const container = e.target.closest('.info-tooltip-container');
    if (container && activeTooltipContainer === container) {
      hideFloatingTooltip();
    }
  });

  window.addEventListener('scroll', () => {
    if (activeTooltipContainer) {
      positionFloatingTooltip(activeTooltipContainer);
    }
  }, { passive: true });

  window.addEventListener('resize', () => {
    if (activeTooltipContainer) {
      positionFloatingTooltip(activeTooltipContainer);
    }
  }, { passive: true });
});
