/**
 * excelReportGenerator.js
 *
 * Automatically maintains reports/test-reports.xlsx using sessionStore data as the single source of truth.
 * 
 * Key Features:
 * - Creates one worksheet per execution date (YYYY-MM-DD).
 * - Appends or updates rows for multiple executions on the same date.
 * - Never deletes previous execution history or rows.
 * - Adds "View Image" hyperlinks pointing directly to the original screenshot file without embedding images.
 * - Safely handles file lock / open file conditions so execution is never disrupted.
 */

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const store = require('./sessionStore');

const EXCEL_PATH = path.join(process.cwd(), 'reports', 'test-reports.xlsx');

function formatDateKey(dateInput) {
  if (!dateInput) return 'Unknown-Date';
  const dt = new Date(dateInput);
  if (isNaN(dt.getTime())) return 'Unknown-Date';
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatTestTitle(filename) {
  if (!filename) return '';
  let name = filename.replace(/\.(spec|test)\.(ts|js)$/i, '');
  name = name.replace(/[-_]/g, ' ');
  return name.split(' ')
    .map(word => word ? word.charAt(0).toUpperCase() + word.slice(1) : '')
    .join(' ');
}

async function updateExcelReportDisk() {
  try {
    const data = store.getAllData();
    const sessions = data.sessions || [];
    const executionsById = data.executionsById || {};
    const settings = data.settings || {};

    const dir = path.dirname(EXCEL_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const workbook = new ExcelJS.Workbook();
    let isNewFile = true;

    if (fs.existsSync(EXCEL_PATH)) {
      try {
        await workbook.xlsx.readFile(EXCEL_PATH);
        isNewFile = false;
      } catch (readErr) {
        console.warn('[excelReportGenerator] Existing Excel file unreadable or locked, initializing fresh workbook:', readErr.message);
      }
    }

    if (isNewFile) {
      workbook.creator = process.env.APP_TITLE || 'Playwright Test Automation';
      workbook.created = new Date();
    }

    // Group executions by date key (YYYY-MM-DD)
    const dateGroups = new Map();

    for (const session of sessions) {
      if (settings.excludeStoppedSessions && (session.status === 'STOPPED' || session.status === 'CANCELLED')) {
        continue;
      }

      const execIds = session.executionIds || [];

      for (const execId of execIds) {
        const exec = executionsById[execId];
        if (!exec) continue;

        if (settings.hideIncompleteTests && (exec.status === 'PENDING' || exec.status === 'RUNNING')) {
          continue;
        }

        const dateKey = formatDateKey(exec.startTime || exec.endTime || session.createdAt);
        if (!dateGroups.has(dateKey)) {
          dateGroups.set(dateKey, []);
        }
        dateGroups.get(dateKey).push({ session, exec });
      }
    }

    // If no session data exists and this is a new file, create today's worksheet with headers
    if (dateGroups.size === 0 && isNewFile) {
      const todayKey = formatDateKey(new Date());
      const ws = workbook.addWorksheet(todayKey);
      setupWorksheetHeaders(ws);
    }

    for (const [dateKey, items] of dateGroups.entries()) {
      let worksheet = workbook.getWorksheet(dateKey);
      if (!worksheet) {
        worksheet = workbook.addWorksheet(dateKey);
        setupWorksheetHeaders(worksheet);
      } else {
        // Ensure headers if worksheet was created blank
        if (worksheet.rowCount === 0) {
          setupWorksheetHeaders(worksheet);
        }
      }

      // Map existing exec IDs in this worksheet to row numbers (Exec ID is stored in hidden Column 11)
      const existingRowMap = new Map();
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Header row
        const execIdCell = row.getCell(11).value;
        if (execIdCell) {
          existingRowMap.set(String(execIdCell), rowNumber);
        }
      });

      for (const { session, exec } of items) {
        const attempts = exec.retries != null ? (exec.retries + 1) : 1;
        const durationStr = exec.duration != null ? `${exec.duration}s` : '—';
        const formattedTitle = formatTestTitle(exec.testScript) || exec.testScript;
        const envStr = `${exec.device || 'Desktop'} / ${exec.browser || 'Chromium'}`;
        const dateTimeStr = exec.startTime ? new Date(exec.startTime).toLocaleString() : new Date(session.createdAt).toLocaleString();

        // Prepare Captured URL
        let paymentUrlObj = '—';
        if (exec.paymentUrl && exec.paymentUrl !== 'N/A') {
          if (/^https?:\/\//i.test(exec.paymentUrl)) {
            paymentUrlObj = { text: 'Open URL', hyperlink: exec.paymentUrl, tooltip: 'Open Captured URL' };
          } else {
            paymentUrlObj = exec.paymentUrl;
          }
        }

        // Prepare Screenshot hyperlink
        let screenshotObj = '—';
        if (exec.screenshotPath && exec.screenshotPath !== 'N/A') {
          let targetUrl = exec.screenshotPath;
          if (targetUrl.startsWith('/screenshots/')) {
            targetUrl = '.' + targetUrl; // relative path from reports/ directory
          }
          screenshotObj = { text: 'View Image', hyperlink: targetUrl, tooltip: 'View Full Resolution Screenshot' };
        }

        const rowValues = [
          `Run #${session.runNumber}`,
          dateTimeStr,
          `${formattedTitle} (${exec.testScript})`,
          envStr,
          exec.status || 'UNKNOWN',
          `Attempt #${attempts}`,
          paymentUrlObj,
          screenshotObj,
          durationStr,
          exec.error || '—',
          exec.id,
        ];

        let targetRowNumber = existingRowMap.get(String(exec.id));
        let row;

        if (targetRowNumber) {
          row = worksheet.getRow(targetRowNumber);
          row.values = rowValues;
        } else {
          row = worksheet.addRow(rowValues);
          existingRowMap.set(String(exec.id), row.number);
        }

        formatDataRow(row, exec.status);
      }
    }

    // Save workbook safely
    try {
      await workbook.xlsx.writeFile(EXCEL_PATH);
    } catch (writeErr) {
      console.warn('[excelReportGenerator] Unable to write reports/test-reports.xlsx (file may be open or locked):', writeErr.message);
    }

    return EXCEL_PATH;
  } catch (err) {
    console.error('[excelReportGenerator] Unexpected error generating Excel report:', err.message);
    return null;
  }
}

function setupWorksheetHeaders(worksheet) {
  worksheet.columns = [
    { header: 'Run #', key: 'runNumber', width: 12 },
    { header: 'Date & Time', key: 'dateTime', width: 22 },
    { header: 'Test Script', key: 'testScript', width: 34 },
    { header: 'Environment', key: 'environment', width: 24 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Attempts', key: 'attempts', width: 14 },
    { header: 'Captured URL', key: 'paymentUrl', width: 20 },
    { header: 'Screenshot', key: 'screenshot', width: 16 },
    { header: 'Duration', key: 'duration', width: 12 },
    { header: 'Error Details', key: 'error', width: 45 },
    { header: 'Exec ID', key: 'execId', width: 36 },
  ];

  // Hide Exec ID column (Column 11)
  const col11 = worksheet.getColumn(11);
  col11.hidden = true;

  const headerRow = worksheet.getRow(1);
  headerRow.height = 28;

  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' }, // Slate dark header
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FF334155' } },
    };
  });
}

function formatDataRow(row, status) {
  row.height = 22;

  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cell.font = cell.font || { name: 'Arial', size: 9.5 };
    cell.alignment = {
      vertical: 'middle',
      horizontal: (colNumber === 1 || colNumber === 5 || colNumber === 6 || colNumber === 7 || colNumber === 8 || colNumber === 9) ? 'center' : 'left',
    };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    };

    // Style Status column (Col 5)
    if (colNumber === 5) {
      cell.font = { name: 'Arial', size: 9.5, bold: true };
      if (status === 'PASS' || status === 'RETRY_PASS') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
        cell.font.color = { argb: 'FF15803D' };
      } else if (status === 'FAIL') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        cell.font.color = { argb: 'FFDC2626' };
      } else if (status === 'RUNNING') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
        cell.font.color = { argb: 'FF1D4ED8' };
      } else {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        cell.font.color = { argb: 'FF475569' };
      }
    }

    // Style Hyperlinks (Col 7 Payment URL, Col 8 Screenshot)
    if ((colNumber === 7 || colNumber === 8) && typeof cell.value === 'object' && cell.value !== null && cell.value.hyperlink) {
      cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF0284C7' }, underline: true };
    }
  });
}

module.exports = {
  updateExcelReportDisk,
  EXCEL_PATH,
};
