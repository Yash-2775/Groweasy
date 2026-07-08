# GrowEasy AI-Powered CSV Importer

An intelligent full-stack CSV importer that extracts and normalizes CRM lead information from any arbitrary CSV format (Facebook Lead Exports, Google Ads Exports, Real Estate CRM exports, messy Excel sheets, etc.) and maps them into the standard **GrowEasy CRM format** using AI.

## 🚀 Key Features

*   **Intelligent AI Field Mapping:** Dynamically identifies customer names, emails, phones, addresses, and other details even under highly ambiguous or customized column headers (e.g., `Client_Name`, `Mail_ID`, `Contact Info`).
*   **Step-by-Step UI Wizard:**
    1.  **Upload CSV:** Drag-and-drop or select any CSV file.
    2.  **Interactive Preview:** Render parsed rows immediately in a beautiful, responsive spreadsheet-like table with horizontal/vertical scrolling, sticky headers, pagination, and real-time client-side search.
    3.  **AI Mapping & Batch Progress:** Watch the AI process records in real-time with visual progress bars, batch counters, elapsed time calculators, and active cancellation capabilities.
    4.  **Review Leads:** Compare successfully mapped leads and skipped records.
*   **Smart Normalization Rules:**
    *   **Phone Parsing:** Splits country codes (e.g., `+91`) from mobile numbers, saving them in dedicated fields while cleaning up dashes, spaces, and brackets.
    *   **Multiple Entries:** Automatically extracts the first email/mobile and appends secondary entries to the `crm_note`.
    *   **Strict ENUM Mapping:** Normalizes lead statuses to `GOOD_LEAD_FOLLOW_UP`, `DID_NOT_CONNECT`, `BAD_LEAD`, or `SALE_DONE`, and data sources to their validated categories.
    *   **Auto-Skipping:** Intelligently skips records lacking contact details (no email and no mobile number) and generates clear explanations for why they were skipped.
*   **Resilient Batch Pipeline:** Chunks large datasets into manageable batches (e.g., 25 rows) with an automatic **3-attempt retry mechanism** with exponential backoff on rate limits.
*   **Browser-Based API Key Control:** Users can enter their Gemini API Key directly in the UI settings drawer. It is stored securely in their local storage and sent via request headers, eliminating server-side credential leaks.
*   **Data Exports:** Download successfully extracted leads as a clean CRM-compatible CSV, or download skipped records with row-by-row failure explanations.
*   **Instant Mock Templates:** One-click testers for Facebook exports, Google Ads exports, and messy semicolon-delimited Excel sheets.

---

## 🛠️ Tech Stack

### Frontend
*   **Framework:** Next.js (App Router, TypeScript)
*   **Styling:** Vanilla CSS (Modern CSS properties, responsive grid systems, dark-mode-first glassmorphism, responsive tables, custom keyframe micro-animations)
*   **Icons:** Lucide React

### Backend
*   **Runtime:** Node.js (ES Modules)
*   **Framework:** Express
*   **CSV Parsing:** `csv-parse` (auto-detects delimiters like `,`, `;`, `\t` and respects RFC 4180 quotes)
*   **AI SDK:** `@google/generative-ai` (Gemini 1.5 Flash structured outputs with JSON schema enforcement)

---

## 📁 Repository Structure

```text
Groweasy_proj/
├── README.md
├── backend/
│   ├── index.js            # Express Entrypoint
│   ├── .env                # Port and Gemini Key Config
│   ├── package.json
│   └── src/
│       ├── controllers/
│       │   └── csvController.js  # Batch logic & Stats calculation
│       ├── routes/
│       │   └── api.js            # Express Routes (Parse, Extract)
│       └── utils/
│           ├── csvParser.js      # Robust CSV parsing
│           └── aiExtractor.js    # Gemini Structured Output API Integration
└── frontend/
    ├── package.json
    ├── next.config.ts
    ├── tsconfig.json
    └── src/
        ├── utils/
        │   └── csvParser.ts      # Fast client-side CSV parser for preview
        └── app/
            ├── layout.tsx        # SEO Meta & Theme script
            ├── globals.css       # Design tokens, layouts, tables, animations
            └── page.tsx          # Main wizard interface
```

---

## ⚡ Setup & Installation

### Prerequisites
*   Node.js (v18.0.0 or higher, v22 recommended)
*   NPM (v9.0.0 or higher)
*   A Gemini API Key (get one for free at [Google AI Studio](https://aistudio.google.com/))

### 1. Backend Setup
1.  Navigate to the `backend` directory:
    ```bash
    cd backend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Configure environment:
    *   Open the `.env` file.
    *   Set `PORT` (defaults to `5000`).
    *   *(Optional)* Add your `GEMINI_API_KEY=your_key_here`. (If left blank, you can enter it in the browser UI settings panel).
4.  Start the development server:
    ```bash
    npm run dev
    ```
    The API will run at `http://localhost:5000`.

### 2. Frontend Setup
1.  Navigate to the `frontend` directory:
    ```bash
    cd ../frontend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the Next.js development server:
    ```bash
    npm run dev
    ```
    The web app will run at `http://localhost:3000`.

---

## 🔍 How to Use the Application

1.  Open your browser and navigate to `http://localhost:3000`.
2.  Click the **Settings** button in the top-right corner.
3.  Paste your **Gemini API Key** and click **Save Configuration**.
4.  Choose one of the **Instant Mock Templates** (e.g., *Facebook Lead Export*) to populate the tool immediately, or drop a CSV file of your own.
5.  Inspect the spreadsheet **Preview Table** to verify that headers and columns align.
6.  Click **Confirm & Map via AI** in the footer actions.
7.  Watch the real-time AI progress indicator complete batches.
8.  Once complete, review the normalized leads in the **Extracted Leads** tab and failures in the **Skipped Records** tab.
9.  Export either list back into a standardized CSV structure.
