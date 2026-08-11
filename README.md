# Visa Test Automation Dashboard

A production-grade, end-to-end automated testing platform and web dashboard for validating complex online visa application workflows across multiple browser engines and device viewports. Built with **Playwright**, **TypeScript**, **Express.js**, and **ExcelJS**.

---

## Table of Contents

- [Project Overview](#project-overview)
  - [Purpose](#purpose)
  - [Complete Workflow](#complete-workflow)
  - [Overall Architecture](#overall-architecture)
- [Features](#features)
- [Project Structure](#project-structure)
- [System Requirements](#system-requirements)
- [Installation](#installation)
- [Dependencies](#dependencies)
- [Available Commands](#available-commands)
- [Configuration](#configuration)
  - [Web Dashboard Settings](#web-dashboard-settings)
  - [Playwright Test Configuration](#playwright-test-configuration)
  - [Environment Variables](#environment-variables)
- [How to Use](#how-to-use)
- [Execution Logic](#execution-logic)
- [Run Progress](#run-progress)
- [HTML Report](#html-report)
- [Excel Report](#excel-report)
- [Reports Folder](#reports-folder)
- [Adding a New Test](#adding-a-new-test)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)
- [Technologies Used](#technologies-used)
- [FAQ](#faq)
- [License](#license)
- [Author](#author)

---

## Project Overview

### Purpose

The **Visa Test Automation Dashboard** provides an automated framework designed to execute, monitor, and report end-to-end web test automation scripts for online visa processing portals (such as Bahrain eVisa, Azerbaijan eVisa, etc.). 

Applying for eVisas involves filling multi-step web forms, handling dynamic CAPTCHAs, uploading identity documents (passports, flight itineraries, hotel bookings, proof of funds), and reaching payment gateways. This platform automates these multi-device workflows and provides real-time progress monitoring alongside comprehensive **Excel** and **offline HTML** reporting.

### Complete Workflow

```
 ┌─────────────────────────────────────────────────────────────────────────────────┐
 │                               1. WEB DASHBOARD                                  │
 │   User selects test scripts, browsers, devices, retries, and execution mode.    │
 └──────────────────────────────────────┬──────────────────────────────────────────┘
                                        │
                                        ▼
 ┌─────────────────────────────────────────────────────────────────────────────────┐
 │                           2. EXPRESS BACKEND ROUTER                             │
 │   POST /api/run creates a session ID (runId) & total target calculations.        │
 └──────────────────────────────────────┬──────────────────────────────────────────┘
                                        │
                                        ▼
 ┌─────────────────────────────────────────────────────────────────────────────────┐
 │                           3. DYNAMIC CONFIG ENGINE                              │
 │   Generates .temp-run-config.mjs targeting selected (Tests × Browsers × Devices)  │
 └──────────────────────────────────────┬──────────────────────────────────────────┘
                                        │
                                        ▼
 ┌─────────────────────────────────────────────────────────────────────────────────┐
 │                          4. PLAYWRIGHT RUNNER & SSE                             │
 │   Spawns `npx playwright test`. Streams live status updates over SSE.            │
 │   Custom baseTest captures step logs, failure screenshots, and payment URLs.    │
 └──────────────────────────────────────┬──────────────────────────────────────────┘
                                        │
                                        ▼
 ┌─────────────────────────────────────────────────────────────────────────────────┐
 │                           5. REPORT GENERATION                                  │
 │   • report.xlsx: Embeds full screenshot images directly into Excel cells        │
 │   • report.html: Offline web document with date tabs, history, and base64 images│
 └──────────────────────────────────────┬──────────────────────────────────────────┘
                                        │
                                        ▼
 ┌─────────────────────────────────────────────────────────────────────────────────┐
 │                           6. UI SYNCHRONIZATION                                 │
 │   Dashboard updates progress bar to 100%, updates completed session counts,      │
 │   and renders interactive HTML report inside an embedded frame.                 │
 └─────────────────────────────────────────────────────────────────────────────────┘
```

### Overall Architecture

The application is structured into four primary layers:

1. **Frontend Web Dashboard (`/web`)**: A responsive, vanilla JavaScript SPA (Single Page Application) with real-time SSE event listeners, dynamic search, selection metrics, and embedded iframe report viewing.
2. **Backend Express Server (`/server`)**: Node.js web server exposing REST endpoints, Server-Sent Events (SSE) streaming connections, and system file system triggers.
3. **Execution Engine (`/server/services`)**: Spawns Playwright processes with dynamically written configuration files, parses CLI stdout/stderr line-by-line, and manages execution session state.
4. **Test Fixtures & Utilities (`/utils` & `/tests`)**: Extended Playwright test runners (`baseTest.ts`) with automatic screenshot capture on failure, CAPTCHA solver utilities, and multi-file document upload handlers.

---

## Features

- **End-to-End Playwright Automation**: Full cross-browser automation capable of handling complex forms, input masks, dropdowns, and file uploads.
- **Multi-Browser Support**: Configurable execution across **Chrome**, **Firefox**, **Safari (WebKit)**, and **Edge** browser engines.
- **Multi-Device Simulation**: Pre-configured support for **Desktop (1920x1080)**, **Android (Pixel 5)**, and **iPhone 14** viewports.
- **Session-Based Execution Architecture**: Grouping execution by session (`runId`) where one run command triggers a single consolidated batch.
- **Run Selected & Run All Modes**: Flexibility to target specific spec files or run the entire test suite simultaneously.
- **Live SSE Progress Tracking**: Real-time progress updates sent directly from the test runner to the dashboard over Server-Sent Events (SSE).
- **Single Source of Truth UI**: Synchronized execution lifecycle (`Pending` $\rightarrow$ `Running` $\rightarrow$ `PASS` / `FAIL` / `SKIPPED`) guaranteeing no item remains pending post-run.
- **Configurable Retries & Headless Mode**: Toggle between Headless and Headed browser execution with custom retry limits (0 to 5).
- **Automated Failure Screenshots**: Captures full-page screenshots automatically upon test failure or step timeouts.
- **Payment URL Auto-Extraction**: Captures payment gateway URLs automatically when tests reach final confirmation steps.
- **Native Excel Reporting (`reports/report.xlsx`)**: Generates formatted Excel spreadsheets with **cell-embedded screenshot images**, color-coded statuses, summary metrics, and frozen headers using `ExcelJS`.
- **Self-Contained Offline HTML Report (`reports/report.html`)**: Complete standalone HTML report with date-wise tab navigation, historical run logging (`report-history.json`), search, status filters, and embedded Base64 image viewports.
- **CAPTCHA & Document Upload Helper**: Custom solvers for triple-Base64 encoded CAPTCHA endpoints and file upload validation.
- **Folder & Download Integration**: Direct buttons to download reports or open local report folders on the server host machine.

---

## Project Structure

```text
visa-test-automation/
├── .env.example                   # Template for environment variables
├── .gitignore                     # Git ignore file configuration
├── metadata.json                  # Application metadata and runtime settings
├── package.json                   # Project manifest, scripts, and dependencies
├── playwright.config.ts           # Fallback static Playwright configuration
├── tsconfig.json                  # TypeScript compiler settings
├── README.md                      # Project documentation
│
├── server/                        # Backend Express Application
│   ├── index.js                   # Server entry point & static file routing
│   ├── routes/
│   │   └── api.js                 # REST endpoints and SSE stream controllers
│   └── services/
│       ├── configGenerator.js     # Dynamic Playwright .mjs config generator
│       ├── testRunner.js          # Child process spawner & stdout stream parser
│       ├── reportGenerator.js     # Excel report (.xlsx) generator with cell images
│       └── htmlReportGenerator.js # Offline HTML report (.html) & history manager
│
├── tests/                         # E2E Automated Test Suites
│   ├── assets/
│   │   └── 10kb.jpg               # Sample test upload asset
│   └── spec/
│       ├── azerbaijan-visa.spec.ts# Azerbaijan eVisa application test script
│       └── bahrain-visa.spec.ts   # Bahrain eVisa application test script
│
├── utils/                         # Shared Test Utilities & Fixtures
│   ├── baseTest.ts                # Extended Playwright test fixture & screenshot hooks
│   ├── devices.ts                 # Browser and device viewport dictionary
│   ├── upload.ts                  # Document upload waiter and validator
│   └── captcha/
│       └── captchaHelper.ts       # CAPTCHA interceptor & Base64 decoder
│
├── web/                           # Frontend Dashboard SPA
│   ├── index.html                 # Main dashboard UI structure
│   ├── style.css                  # Custom styling and responsive design
│   └── app.js                     # Dashboard state management & SSE event handlers
│
└── reports/                       # Generated Output Artifacts (Auto-created)
    ├── report.xlsx                # Latest generated Excel report
    ├── report.html                # Interactive offline HTML report
    ├── report-history.json        # Persistent JSON history database
    └── screenshots/               # Failure screenshot image directory
```

---

## System Requirements

| Requirement | Minimum / Recommended Specification |
| :--- | :--- |
| **Operating System** | Windows 10/11, macOS 12+, Linux (Ubuntu 20.04 LTS or newer) |
| **Node.js** | `>= 18.0.0` (Recommended: `Node.js 20.x LTS`) |
| **npm** | `>= 9.0.0` |
| **Playwright** | `^1.41.0` (Chromium binary required) |
| **RAM** | Minimum: 4 GB \| Recommended: 8 GB+ for multi-worker parallel runs |
| **Disk Space** | ~1 GB (for Node dependencies, Playwright browser binaries, and screenshots) |
| **Network** | Active Internet connection required for live website interaction |
| **IDE** | VS Code (Recommended extension: *Playwright Test for VSCode*) |

---

## Installation

Follow these steps to set up the project on your local machine or server:

### Step 1: Clone the Repository

```bash
git clone https://github.com/your-username/visa-test-automation.git
cd visa-test-automation
```

### Step 2: Ensure Node.js & npm are Installed

Verify your Node.js version:

```bash
node -v
npm -v
```

> **Note:** If Node.js is missing, download it from [nodejs.org](https://nodejs.org/).

### Step 3: Install npm Dependencies

Install all required runtime and development dependencies:

```bash
npm install
```

### Step 4: Install Playwright Browsers

Download the browser binaries (Chromium, Firefox, WebKit) required by Playwright:

```bash
npx playwright install chromium
```

To install all supported browsers:

```bash
npx playwright install
```

### Step 5: Environment Setup

Copy `.env.example` to create `.env` (optional, default port is `3000`):

```bash
cp .env.example .env
```

---

## Dependencies

The project uses the following dependencies specified in `package.json`:

| Package | Version | Type | Purpose |
| :--- | :--- | :--- | :--- |
| `express` | `^4.18.2` | Runtime | Web framework serving REST APIs, static files, and SSE streams |
| `exceljs` | `^4.4.0` | Runtime | Generates Excel files (`.xlsx`) with native cell image embedding |
| `glob` | `^10.3.10` | Runtime | File and directory pattern matching utility |
| `open` | `^10.0.3` | Runtime | Opens files and folders in the OS file explorer |
| `os` | `^0.1.2` | Runtime | Provides system CPU and platform architecture information |
| `uuid` | `^9.0.0` | Runtime | Generates unique session IDs (`runId`) for execution tracking |
| `@playwright/test` | `^1.41.0` | Dev | End-to-end browser automation framework and test runner |
| `typescript` | `^5.3.3` | Dev | TypeScript language compiler and type checker |

---

## Available Commands

Run these scripts from the project root using `npm`:

```bash
# Start the Web Dashboard and Express Server
npm start

# Development mode (alias for start)
npm run dev

# Explicitly start the server
npm run server

# Compile TypeScript files
npm run build

# Type check codebase without emitting output
npm run lint

# Execute Playwright tests directly from CLI in headless mode
npm run test:dev

# Execute Playwright tests directly from CLI in headed mode
npm run test:headed
```

---

## Configuration

### Web Dashboard Settings

The web interface allows runtime configuration before triggering execution:

- **Browser Selection**: Toggle Chrome, Firefox, Safari, and Edge.
- **Device Selection**: Toggle Desktop (1920x1080), iPhone 14, and Android.
- **Headless Mode**: Checkbox to toggle between invisible background execution (`true`) and visible browser windows (`false`).
- **Retries**: Set max retry count per test on failure (Default: `3`).

### Playwright Test Configuration

`playwright.config.ts` controls fallback CLI runs:

- `timeout`: `120,000 ms` (2 minutes per test execution).
- `expect.timeout`: `30,000 ms` (30 seconds per assertion).
- `fullyParallel`: `true` (executes projects simultaneously).
- `ignoreHTTPSErrors`: `true` (bypasses SSL certificate warnings on target portals).

### Environment Variables

Configuration options defined in `.env`:

```env
# Server Port (Default: 3000)
PORT=3000

# CI Environment Flag
CI=false
```

---

## How to Use

### 1. Launch the Server

Start the application server:

```bash
npm start
```

You should see output similar to:

```text
┌─────────────────────────────────────────────────────┐
│       VISA TEST AUTOMATION DASHBOARD                │
├─────────────────────────────────────────────────────┤
│  Local:   http://localhost:3000                     │
│                                                     │
│  Place test files in: tests/spec/                   │
│  File pattern: *.spec.ts or *.spec.js               │
│  Reports saved to: reports/                         │
└─────────────────────────────────────────────────────┘
```

### 2. Open the Dashboard

Open your web browser and navigate to: `http://localhost:3000`

### 3. Select Tests & Target Configurations

1. **Test Scripts**: Select checkboxes for individual test files (e.g., `bahrain-visa.spec.ts`).
2. **Browsers**: Select target browsers (e.g., `Chrome`).
3. **Devices**: Select target viewports (e.g., `Desktop`, `iPhone 14`).
4. **Execution Summary Card**: Observe the real-time execution target calculation:
   $$\text{Selected Executions} = \text{Tests} \times \text{Browsers} \times \text{Devices}$$

### 4. Execute Tests

- Click **Run Selected** to run chosen tests.
- Click **Run All** to run every spec file in `tests/spec/`.

### 5. Monitor Live Progress

Watch the **Run Progress** section update in real-time over Server-Sent Events (SSE):
- View overall session completion percentage bar.
- Track status badges (`Pending` $\rightarrow$ `Running` $\rightarrow$ `PASS` / `FAIL`).
- Review live duration timers and pass/fail counters.

### 6. Analyze Reports

Upon session completion:
- View the embedded **HTML Report** directly inside the dashboard panel.
- Click **Open HTML Report** to open the full interactive report in a new tab.
- Click **Download Excel Report** to save `report.xlsx` with embedded failure screenshots.
- Click **Open Reports Folder** to reveal output files in your system file explorer.

---

## Execution Logic

Every run operation follows a strict execution matrix logic:

$$\text{Total Executions} = N_{\text{Tests}} \times M_{\text{Browsers}} \times K_{\text{Devices}}$$

### Example Execution Calculation

If you select:
- **2 Test Scripts**: `bahrain-visa.spec.ts`, `azerbaijan-visa.spec.ts`
- **1 Browser**: `Chrome`
- **3 Devices**: `Desktop`, `iPhone 14`, `Android`

$$\text{Total Executions} = 2 \times 1 \times 3 = 6 \text{ Executions}$$

### Session Architecture Definitions

- **Execution Session (`runId`)**: One user click on "Run Selected" or "Run All" creates a single unique session ID (`UUIDv4`) and increments the total run history counter (`Run #N`).
- **Combination Item**: A single test script bound to a specific browser and device project (e.g., `bahrain-visa.spec.ts [Desktop-Chrome]`).
- **Dynamic Config**: Generated at runtime as `.temp-run-config.mjs` to ensure Playwright only executes the exact requested matrix, avoiding wasteful runs.

---

## Run Progress

The **Run Progress** panel maintains a strict **Single Source of Truth** synchronized with backend event streams.

### Combination State Lifecycle

```text
[ Pending ]  ───( Test Starts )───►  [ Running ]  ───( Test Finishes )───►  [ PASS / FAIL / SKIPPED ]
```

### Counter Definitions

- **Total**: Total target combinations ($N \times M \times K$).
- **Completed**: Sum of all finished executions ($\text{Pass} + \text{Fail} + \text{Skipped}$).
- **Pending**: Remaining queued items ($\text{Total} - \text{Completed}$).
- **Progress Bar Percentage**: Calculated dynamically:
  $$\text{Progress \%} = \left( \frac{\text{Completed}}{\text{Total}} \right) \times 100$$

> **Guaranteed Lifecycle Rule:** When a session finishes, the dashboard automatically verifies that no item remains in `Pending` state. Any remaining unresolved combination is updated to its final result from the test runner.

---

## HTML Report

The interactive HTML report is located at `reports/report.html`.

### Key Capabilities

1. **Date-Wise Navigation Tabs**: Automatically groups runs into calendar date tabs (`YYYY-MM-DD`).
2. **Session Accordions**: Each execution session is saved chronologically under its execution timestamp.
3. **Embedded Screenshots**: Screenshot thumbnails are encoded as Base64 strings, rendering the HTML file completely self-contained and viewable offline without external file dependencies.
4. **Search & Filter Controls**: Filter results by test status (`ALL`, `PASS`, `FAIL`) or search by test name and device keyword.
5. **Captured Payment URLs**: Payment gateway links captured during execution are highlighted and clickable.

---

## Excel Report

The Excel report is saved to `reports/report.xlsx` using `ExcelJS`.

### Structure & Highlights

- **Native Image Embedding**: Screenshot images are embedded directly into worksheet cells (`Column N`), styled with fixed cell row heights (120pt) and image dimensions.
- **Color-Coded Statuses**:
  - `PASS`: Light green fill (`#D4EDDA`) with dark green text (`#155724`).
  - `FAIL`: Light red fill (`#F8D7DA`) with dark red text (`#721C24`).
- **Auto-Filter & Frozen Header**: Headers are frozen on Row 1 with automatic filtering enabled across all columns.
- **Summary Worksheet**: Contains high-level session statistics, overall pass rate percentages, and run metadata.

---

## Reports Folder

All runtime generated files are stored in `reports/`:

```text
reports/
├── report.xlsx           # Generated Excel report containing embedded screenshot images
├── report.html           # Standalone interactive offline HTML report
├── report-history.json   # Persistent JSON database tracking historical test runs across sessions
└── screenshots/          # Image files captured on test failure
    ├── bahrain-visa-Bahrain-Visa-Application-Desktop-Chrome.png
    └── bahrain-visa-Bahrain-Visa-Application-iPhone-14-Chrome.png
```

---

## Adding a New Test

To add a new automated visa workflow test:

### Step 1: Create a Spec File

Create a new file in `tests/spec/` with the extension `.spec.ts`:

```bash
touch tests/spec/dubai-visa.spec.ts
```

### Step 2: Implement Test Script

Use the shared `baseTest` fixture so your test inherits failure handling, screenshot capture, and CAPTCHA helpers:

```typescript
import { test, expect } from '../../utils/baseTest';

test('Dubai Visa Application', async ({ page, waitForCaptcha }) => {
  // 1. Set up CAPTCHA listener if needed
  const captchaPromise = waitForCaptcha(page);

  // 2. Navigate to visa application portal
  await page.goto('https://example-visa-portal.com/apply');

  // 3. Fill form fields
  await page.getByRole('textbox', { name: 'Full Name' }).fill('John Doe');
  await page.getByRole('textbox', { name: 'Passport Number' }).fill('A12345678');

  // 4. Resolve CAPTCHA
  const captchaText = await captchaPromise;
  await page.getByRole('textbox', { name: 'Captcha' }).fill(captchaText);

  // 5. Submit application
  await page.getByRole('button', { name: 'Submit' }).click();

  // 6. Verify payment page redirect
  await expect(page.getByRole('heading', { name: 'Payment' })).toBeVisible({ timeout: 30000 });
});
```

### Step 3: Refresh Dashboard

Reload the Web Dashboard (`http://localhost:3000`). The application will automatically detect `dubai-visa.spec.ts` and list it under **Available Tests**.

---

## Troubleshooting

### Common Issues & Fixes

| Problem | Cause | Solution |
| :--- | :--- | :--- |
| **Port 3000 in Use** | Another node instance or server is running on port `3000`. | Stop the existing process or run: <br>`npx kill-port 3000` or change `PORT=3001` in `.env`. |
| **Playwright Executable Missing** | Playwright browser binaries are not installed. | Run: <br>`npx playwright install chromium` |
| **Test Timeout Exceeded (30000ms)** | Target visa website loaded slowly or captcha failed. | Check network connectivity or increase timeout in `playwright.config.ts`. |
| **"tests/spec directory not found"** | Missing test directory structure. | Ensure `tests/spec/` exists at root level. |
| **Excel File Locked** | `reports/report.xlsx` is open in Microsoft Excel while a run completes. | Close Excel before running tests so the file writer can save updates. |

---

## Best Practices

1. **Use `baseTest` Fixture**: Always import `test` and `expect` from `utils/baseTest` instead of `@playwright/test` to ensure automatic screenshot capture and CAPTCHA tracking.
2. **Handle Dynamic Selectors**: Use role-based or accessible locators (`getByRole`, `getByLabel`, `getByPlaceholder`) to make scripts resilient against UI updates.
3. **Resilient File Uploads**: Use explicit input targeting for document upload fields (`input[type="file"]`) and validate success state elements.
4. **Clean Asset Management**: Store reusable upload test assets inside `tests/assets/`.

---

## Technologies Used

- **Core Engine**: Node.js, TypeScript, Express.js
- **Browser Automation**: Playwright (`@playwright/test`)
- **Report Engines**: ExcelJS, HTML5, Base64 Image Encoder
- **Real-Time Communication**: Server-Sent Events (SSE)
- **UI & Design**: Vanilla JavaScript (ES6+), FontAwesome Icons, Modern CSS3 Flexbox/Grid

---

## FAQ

#### Q: Can I run tests in visible (non-headless) browser mode?
**A:** Yes. Uncheck the **Headless Mode** checkbox in the Web Dashboard UI or run `npm run test:headed` from the terminal.

#### Q: How are screenshot images stored in the Excel report?
**A:** `reportGenerator.js` reads failure screenshots as binary buffers and embeds them directly into Excel cell objects using `ExcelJS` native drawing API.

#### Q: Can I view HTML reports on a machine without internet access?
**A:** Yes. `htmlReportGenerator.js` embeds all CSS styles, JavaScript logic, and screenshot images as inline Base64 data URLs, making `report.html` 100% self-contained and offline-capable.

---

## License

This project is licensed under the [ISC License](LICENSE).

---

## Author

**Visa Test Automation Team**
- Email: `support@example.com`
- Repository: `https://github.com/your-username/visa-test-automation`
