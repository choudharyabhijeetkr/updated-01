# Playwright Test Automation Dashboard

A production-grade, end-to-end automated testing platform and web dashboard for executing, monitoring, and reporting web test automation workflows across multiple browser engines and device viewports. Built with **Playwright**, **TypeScript**, **Express.js**, and **ExcelJS**.

---

## Table of Contents

- [Project Overview](#project-overview)
  - [Purpose & Scope](#purpose--scope)
  - [Complete Workflow](#complete-workflow)
  - [System Architecture](#system-architecture)
- [Key Features](#key-features)
- [Cross-Platform & Hardware Management](#cross-platform--hardware-management)
- [Project Structure](#project-structure)
- [System Requirements](#system-requirements)
- [Installation & Setup](#installation--setup)
- [Environment Variable Configuration](#environment-variable-configuration)
- [Available Commands](#available-commands)
- [Web Dashboard Overview](#web-dashboard-overview)
- [Reporting System](#reporting-system)
  - [Interactive HTML Report](#interactive-html-report)
  - [Excel Report](#excel-report)
  - [Shared Screenshots Directory](#shared-screenshots-directory)
- [Adding & Writing Custom Tests](#adding--writing-custom-tests)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)
- [Technologies Used](#technologies-used)
- [License](#license)

---

## Project Overview

### Purpose & Scope

The **Playwright Test Automation Dashboard** is a generic, framework-agnostic test execution engine and reporting dashboard. It allows teams to manage, trigger, monitor, and audit end-to-end automated web test suites (such as application forms, portal workflows, SaaS platforms, e-commerce checkout flows, and API integrations) through a responsive web interface or CLI.

The platform abstracts Playwright complexity by providing real-time Server-Sent Events (SSE) progress tracking, automated hardware concurrency safety guards, configurable retry policies, and self-contained **HTML** and **Excel** report generation.

### Complete Workflow

```text
 ┌─────────────────────────────────────────────────────────────────────────────────┐
 │                               1. WEB DASHBOARD                                  │
 │   User selects test scripts, browser engines, platforms, and retry limits.     │
 └──────────────────────────────────────┬──────────────────────────────────────────┘
                                        │
                                        ▼
 ┌─────────────────────────────────────────────────────────────────────────────────┐
 │                           2. EXPRESS BACKEND ROUTER                             │
 │   POST /api/run initializes execution session (runId) & target matrix calculation│
 └──────────────────────────────────────┬──────────────────────────────────────────┘
                                        │
                                        ▼
 ┌─────────────────────────────────────────────────────────────────────────────────┐
 │                        3. HARDWARE & CONFIG ENGINE                              │
 │   Memory Guard checks system RAM/CPU; generates temporary Playwright .mjs config│
 └──────────────────────────────────────┬──────────────────────────────────────────┘
                                        │
                                        ▼
 ┌─────────────────────────────────────────────────────────────────────────────────┐
 │                          4. PLAYWRIGHT RUNNER & SSE                             │
 │   Spawns `npx playwright test`. Streams live updates over Server-Sent Events.  │
 │   Custom baseTest fixture captures execution logs, screenshots, and URLs.      │
 └──────────────────────────────────────┬──────────────────────────────────────────┘
                                        │
                                        ▼
 ┌─────────────────────────────────────────────────────────────────────────────────┐
 │                           5. REPORT GENERATION                                  │
 │   • execution-report.html: Offline web report with date tabs & error modals   │
 │   • test-reports.xlsx: Formatted Excel spreadsheet with screenshot hyperlinks   │
 └──────────────────────────────────────┬──────────────────────────────────────────┘
                                        │
                                        ▼
 ┌─────────────────────────────────────────────────────────────────────────────────┐
 │                           6. UI SYNCHRONIZATION                                 │
 │   Dashboard updates progress meters, displays status badges, and renders        │
 │   interactive report iframe upon completion.                                    │
 └─────────────────────────────────────────────────────────────────────────────────┘
```

### System Architecture

The application is structured into four main layers:

1. **Frontend Web Dashboard (`/web`)**: A responsive single-page web app built with vanilla JavaScript, CSS3 flex/grid, and FontAwesome. Features live SSE event streams, dynamic search and filtering, test selection metrics, system health diagnostics, and embedded report viewing.
2. **Backend Express Server (`/server`)**: Node.js web server handling REST endpoints, static file routing, SSE broadcast connections, and system health checks.
3. **Execution Engine (`/server/services`)**: Manages process spawning, stdout/stderr parsing, queue execution, memory safety throttling, and dynamic Playwright configuration generation.
4. **Test Utilities & Specs (`/utils` & `/tests`)**: Shared Playwright test extension fixtures (`baseTest.ts`), step-by-step screenshot utilities, device viewports, and custom spec suites.

---

## Key Features

- **Generic & Extensible Framework**: Automates any web portal, web app, or multi-step form workflow.
- **Cross-Browser Support**: Concurrent or targeted execution across **Chromium** (Chrome/Edge), **Firefox**, and **WebKit** (Safari) browser engines.
- **Multi-Platform Viewports**: Pre-configured support for **Desktop (1920x1080)**, **Android (Pixel 5)**, and **iOS (iPhone 14)** viewports.
- **Dynamic Test Discovery**: Automatically scans and lists all test specifications in the directory defined by `TEST_DIR`.
- **Live SSE Progress Tracking**: Real-time test state updates (`PENDING` $\rightarrow$ `RUNNING` $\rightarrow$ `PASS` / `FAIL` / `RETRY_PASS` / `STOPPED`) pushed directly to the UI over Server-Sent Events.
- **Hardware Concurrency Safety Guard**: Auto-detects system CPU cores and available RAM to calculate optimal worker batching and throttle execution under memory pressure.
- **Configurable Retries & Headless Execution**: Toggle headless/headed browser windows and set retry limits (0 to 10 attempts) per test.
- **Report Preferences**: Toggle settings to exclude stopped runs, hide incomplete tests, and control explicit screenshot capture.
- **Interactive Offline HTML Reporting (`reports/execution-report.html`)**: Self-contained HTML report with date-wise tab navigation, date search picker, session accordions, status filters, screenshot links, and full stack trace modal viewers.
- **Formatted Excel Reporting (`reports/test-reports.xlsx`)**: Auto-maintained Excel workbook with separate date sheets (`YYYY-MM-DD`), color-coded status cells, and screenshot hyperlinks.
- **Shared Screenshots Artifacts (`/screenshots`)**: Single unified screenshot directory preventing file duplication across report formats.
- **System Health Diagnostics**: Real-time modal checking backend API reachability, Playwright installation, browser binary availability, and available system RAM/vCPU metrics.

---

## Cross-Platform & Hardware Management

The framework is engineered for full cross-platform compatibility across **Linux**, **macOS**, and **Windows** operating systems.

### OS Platform Detection & Browser Paths
- **Executable Path Verification**: The server checks browser binary installations directly on startup without launching full browser processes.
- **Linux Dependency Awareness**: Automatically detects Linux environments and reports host shared library prerequisites.

### Memory Safety Guard & Auto-Batching
Playwright test workers can consume significant memory when running multiple browser contexts in parallel. The built-in Memory Safety Guard prevents system freezes and crashes:
- **Auto-Calculated Batch Concurrency**: Inspects available vCPUs and total/free system RAM to set safe default parallel worker limits.
- **Dynamic Memory Throttling**: If free RAM drops below 600 MB, the engine automatically throttles execution batch size down to safe limits and alerts the user in the UI.

---

## Project Structure

```text
playwright-test-automation/
├── .env.example                   # Template for environment configuration
├── .gitignore                     # Git ignore rules for reports, node_modules, etc.
├── metadata.json                  # Application metadata and capabilities
├── package.json                   # Project dependencies and run scripts
├── playwright.config.ts           # Fallback static Playwright configuration
├── tsconfig.json                  # TypeScript compiler settings
├── README.md                      # Comprehensive project documentation
│
├── server/                        # Backend Express Application
│   ├── index.js                   # Express server entry point & static routes
│   ├── routes/
│   │   └── api.js                 # REST endpoints, SSE streams & health checks
│   └── services/
│       ├── configGenerator.js     # Dynamic Playwright .mjs config writer
│       ├── executionQueue.js      # Session queue & memory guard orchestrator
│       ├── sessionStore.js        # Single source of truth session database
│       ├── testRunner.js          # Child process spawner & stdout parser
│       ├── excelReportGenerator.js # Excel report (.xlsx) generator
│       └── htmlReportGenerator.js # Standalone HTML report (.html) generator
│
├── tests/                         # Test Suites & Assets
│   ├── assets/                    # Sample upload assets and test files
│   └── spec/                      # E2E Playwright test specifications (*.spec.ts)
│       ├── azerbaijan-visa.spec.ts
│       ├── bahrain-visa.spec.ts
│       └── ...
│
├── utils/                         # Shared Test Utilities & Fixtures
│   ├── baseTest.ts                # Extended Playwright test fixture & lifecycle hooks
│   ├── devices.ts                 # Viewport and device emulation profiles
│   ├── screenshot.ts             # Custom screenshot capture utility
│   ├── upload.ts                  # Document upload and file verification helpers
│   └── captcha/                   # Optional CAPTCHA handling utilities
│       └── captchaHelper.ts
│
├── web/                           # Frontend Dashboard SPA
│   ├── index.html                 # Main dashboard UI HTML
│   ├── style.css                  # Modern responsive design stylesheet
│   └── app.js                     # Dashboard state, SSE listener & UI controller
│
├── reports/                       # Generated Output Artifacts (Auto-created)
│   ├── execution-report.html      # Latest interactive HTML report
│   └── test-reports.xlsx          # Auto-updated Excel report workbook
│
└── screenshots/                   # Shared Screenshot Artifacts Directory
```

---

## System Requirements

| Requirement | Minimum / Recommended Specification |
| :--- | :--- |
| **Operating System** | Windows 10/11, macOS 12+, Linux (Ubuntu 20.04 LTS or newer) |
| **Node.js** | `>= 18.0.0` (Recommended: `Node.js 20.x LTS`) |
| **npm** | `>= 9.0.0` |
| **Playwright** | `^1.41.0` |
| **RAM** | Minimum: 4 GB \| Recommended: 8 GB+ for parallel multi-browser runs |
| **Disk Space** | ~1 GB (for Node packages, Playwright browser binaries, and screenshots) |
| **IDE** | VS Code (Recommended extension: *Playwright Test for VSCode*) |

---

## Installation & Setup

Follow these steps to set up the project environment:

### Step 1: Clone or Open the Workspace

```bash
git clone <repository-url>
cd playwright-test-automation
```

### Step 2: Install Node.js Dependencies

```bash
npm install
```

### Step 3: Install Playwright Browsers

Download the required browser binaries (Chromium, Firefox, WebKit):

```bash
# Install Chromium only
npx playwright install chromium

# Or install all supported engines
npx playwright install
```

### Step 4: Configure Environment Variables

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

---

## Environment Variable Configuration

All primary framework settings are driven by environment variables defined in `.env`:

```env
# APP_TITLE: Custom branding title displayed on the dashboard UI and generated reports
# Default: "Playwright Test Automation"
APP_TITLE=Playwright Test Automation

# TEST_DIR: Relative path from project root to test specification directory
# Default: "./tests/spec"
TEST_DIR=./tests/spec

# PORT: Server port for the Express backend and web dashboard
# Default: 3000
PORT=3000

# CI: Set to true in continuous integration environments
# Default: false
CI=false
```

### Explaining `APP_TITLE` & `TEST_DIR`

- **`APP_TITLE`**: Customizes application branding across the dashboard header, system health diagnostics modal, document title, and report metadata.
  - *Example*: `APP_TITLE="E2E Checkout Automation Suite"`
- **`TEST_DIR`**: Directs the test engine to scan a specific folder for test specification files (`*.spec.ts` or `*.spec.js`).
  - *Example*: `TEST_DIR="./tests/e2e/regression"`

---

## Available Commands

Execute these commands from the project root:

```bash
# Start the Web Dashboard and Express Server
npm start

# Development mode (alias for start)
npm run dev

# Explicitly start the server
npm run server

# Type-check TypeScript files without emitting code
npm run lint

# Compile TypeScript files
npm run build

# Run Playwright tests directly from CLI in headless mode
npm run test:dev

# Run Playwright tests directly from CLI in headed mode
npm run test:headed
```

---

## Web Dashboard Overview

Launch the dashboard by starting the server (`npm start`) and opening `http://localhost:3000` in your web browser.

### Configuration Controls
- **Browser Engines**: Checkbox selection for Chromium, Firefox, and WebKit.
- **Platforms**: Checkbox selection for Desktop, Android, and iOS viewports.
- **Headless Mode**: Toggle invisible background execution or visible browser windows.
- **Batch Concurrency**: Auto-calculated based on system hardware, manually adjustable from 1 to 10 workers.
- **Max Retries**: Set auto-retry attempts (0 to 10) on step failure.
- **Report Preferences**: Toggles to exclude stopped runs, hide incomplete tests, and enable explicit screenshot capture.

### Test Suites & Scripts Panel
- **Real-Time Search**: Filter test scripts by name, domain keyword, or filename.
- **Selection Actions**: Click individual test tiles, or use **Select All** / **Clear** controls.
- **Execution Summary Bar**: Dynamically calculates target executions:
  $$\text{Execution Target} = \text{Tests} \times \text{Engines} \times \text{Platforms}$$

### Execution Progress
- **Live SSE Streaming**: Displays completion percentage bar, elapsed time, and status badges (`PENDING`, `RUNNING`, `PASS`, `FAIL`, `CANCELLED`).
- **Stop Execution**: Immediate button to halt running child processes and cancel pending queue items safely.

---

## Reporting System

Reports are generated automatically upon test execution completion and updated on disk.

### Interactive HTML Report (`reports/execution-report.html`)

A standalone, interactive report displaying session histories and test outcomes.

- **Date-Wise Navigation Tabs**: Group run sessions by execution date (`YYYY-MM-DD`).
- **Date Search Picker**: Search and filter test runs by calendar date.
- **Embedded Snapshot Data (`__REPORT_DATA__`)**: Contains full JSON payload for client-side filtering and accordion interaction.
- **Error Trace Modal**: Click **View Details** on failed tests to open a popup with the complete stack trace and copy-to-clipboard functionality.
- **Screenshot Links**: Click **View Screenshot** to view captured full-resolution image artifacts.

### Excel Report (`reports/test-reports.xlsx`)

An automated Excel workbook generated using `ExcelJS`.

- **Date Worksheets**: Creates or appends rows to date sheets matching execution dates (`YYYY-MM-DD`).
- **Color-Coded Statuses**:
  - `PASS` / `RETRY_PASS`: Soft green background with dark green text.
  - `FAIL`: Soft red background with dark red text.
  - `RUNNING`: Soft blue background with dark blue text.
- **Direct Screenshot Links**: Hyperlinks pointing directly to captured images in `/screenshots`.

### Shared Screenshots Directory (`/screenshots`)

Screenshots captured during test execution are saved to a central `/screenshots` directory:
```text
screenshots/
└── <timestamp>/
    └── <spec-filename>/
        └── <step-name>.png
```
Both the HTML report and Excel workbook reference this shared directory, eliminating redundant copies.

---

## Adding & Writing Custom Tests

To add a new automated test suite to the framework:

### Step 1: Create a Spec File

Place your test file in the directory configured by `TEST_DIR` (e.g., `tests/spec/`):

```bash
touch tests/spec/login-workflow.spec.ts
```

### Step 2: Implement Test Using `baseTest` Fixture

Import `test` and `expect` from `utils/baseTest.ts` to automatically inherit execution timing, error trapping, and screenshot helpers:

```typescript
import { test, expect } from '../../utils/baseTest';
import { captureScreenshot } from '../../utils/screenshot';

test('User Login and Dashboard Workflow', async ({ page }, testInfo) => {
  // 1. Navigate to target portal
  await page.goto('https://example.com/login');

  // 2. Perform form actions
  await page.getByPlaceholder('Email').fill('user@example.com');
  await page.getByPlaceholder('Password').fill('SecurePassword123');
  await page.getByRole('button', { name: 'Sign In' }).click();

  // 3. Verify landing page
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

  // 4. Capture step screenshot (saved if Screenshot Capture mode is ON)
  await captureScreenshot(page, 'dashboard-landing', testInfo);
});
```

### Step 3: Refresh Dashboard

Reload or open the Web Dashboard (`http://localhost:3000`). The system will auto-detect the new file and display it in the **Test Suites & Scripts** list.

---

## Troubleshooting

| Problem | Potential Cause | Solution |
| :--- | :--- | :--- |
| **Port 3000 in Use** | Another process is bound to port 3000. | Stop the conflicting process or change `PORT=3001` in `.env`. |
| **Playwright Executable Missing** | Playwright browser binaries are not installed. | Run `npx playwright install chromium` or `npx playwright install`. |
| **Tests Missing from Dashboard** | `TEST_DIR` path is misconfigured or directory is empty. | Check `TEST_DIR` setting in `.env` and verify spec files end with `.spec.ts` or `.spec.js`. |
| **System Memory Throttled** | Available RAM is low (< 600 MB). | The Memory Guard auto-throttles concurrency. Reduce Batch Concurrency or close heavy background apps. |
| **Excel File Locked Warning** | Excel report file is locked or open in another application. | Close `reports/test-reports.xlsx` in Excel so the server can write updates. |

---

## Best Practices

1. **Use `baseTest` Import**: Always import `test` and `expect` from `utils/baseTest` instead of `@playwright/test` to ensure lifecycle hooks and status updates function correctly.
2. **Accessible Locators**: Prefer role-based and accessible locators (`getByRole`, `getByLabel`, `getByPlaceholder`) over brittle CSS paths.
3. **Explicit Screenshot Steps**: Call `captureScreenshot(page, 'step-name', testInfo)` at critical validation steps.
4. **Environment Configuration**: Store environment-specific URLs or credentials in `.env` or configuration files rather than hardcoding in specs.

---

## Technologies Used

- **Core Engine**: Node.js, TypeScript, Express.js
- **Browser Automation**: Playwright (`@playwright/test`)
- **Reporting Engines**: ExcelJS, HTML5, FontAwesome
- **Real-Time Event Engine**: Server-Sent Events (SSE)
- **Frontend UI**: Vanilla JavaScript (ES6+), CSS Flexbox & Grid

---

## License

This project is licensed under the [ISC License](LICENSE).
