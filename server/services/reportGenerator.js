/**
 * reportGenerator.js
 *
 * Centralized report generation service (HTML and Excel reports).
 * Uses sessionStore data as the single source of truth for all reports.
 */

const { generateReportHtml, updateReportDisk: updateHtmlReportDisk, REPORT_PATH } = require('./htmlReportGenerator');
const { updateExcelReportDisk, EXCEL_PATH } = require('./excelReportGenerator');

async function updateReportDisk() {
  updateHtmlReportDisk();
  return await updateExcelReportDisk();
}

module.exports = {
  generateReportHtml,
  updateReportDisk,
  updateHtmlReportDisk,
  updateExcelReportDisk,
  REPORT_PATH,
  EXCEL_PATH,
};
