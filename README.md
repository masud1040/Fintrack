# FinTrack - Personal Finance Manager

FinTrack is a modern, privacy-focused, offline-first personal finance tracking application. It helps you manage your income, expenses, bank accounts, debts, and shopping lists while keeping your data secured and synchronized.

---

## 🌟 Key Features

- **📊 Comprehensive Dashboard**: Real-time visualization of your net worth, income vs. expenses, multi-account balance cards, and interactive financial charts.
- **💸 Transaction Ledger**: Easy transaction tracking categorised as *Income*, *Expense*, or *Transfer* with tags, descriptions, and account balances.
- **🏦 Manage Accounts**: Track cash, bank accounts, mobile financial services (bKash, Nagad, Rocket), and cards with full transaction histories.
- **📝 Bazar (Shopping) Lists**: Create and manage checklists for shopping, estimate total costs, track real-time spending, and download beautiful digital cash receipts.
- **🤝 Debt and Loan Tracker**: Keep tabs on money you owe (payables) and money owed to you (receivables). 
  - Dynamic interest/repayment logging.
  - Multi-channel instant payment reminders: **WhatsApp Integration** and Direct SMS.
  - Custom canvas-rendered digital receipts with direct export.
- **📁 Data Portability & Reports**: Export top-quality monthly corporate financial statements or standard all-time wealth summaries as premium-styled PDFs.
- **🔔 Notification Center**: Timely smart reminders for upcoming recurring transactions, budget limits, overdue loans, and dramatic income decrease warnings.
- **☁️ Firebase Synchronization**: Live cloud persistence and secure database backups, allowing full offline usability powered by Dexie IndexedDB cache.

---

## 🛠️ Technology Stack

- **Frontend Core**: [React 19](https://react.dev/) + [Vite](https://vitejs.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS 4.0](https://tailwindcss.com/)
- **Animations**: [Motion](https://motion.dev/) (formerly Framer Motion)
- **Database (Offline Cache)**: [Dexie.js](https://dexie.org/) (IndexedDB wrapper)
- **Database (Cloud Integration)**: [Firebase Firestore](https://firebase.google.com/) for multi-device sync
- **Data Visualizations**: [Recharts](https://recharts.org/) (Dynamic SVG charts) & HTML5 Canvas API
- **Utilities**: `date-fns` for date formatting, `jsPDF` for PDF generation, `lucide-react` for graphics and icons.

---

## 🚀 Getting Started

To get a local clone running on your machine, follow these simple steps:

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.x or newer)
- `npm` or `yarn`

### 1. Installation
Clone the repository and install all project dependencies from the root directory:
```bash
npm install
```

### 2. Configure Environment Secrets
Create a `.env` or `.env.local` file in the root folder and add your Gemini API configuration (optional for smart summaries):
```env
GEMINI_API_KEY="YOUR_ACTUAL_GEMINI_API_KEY"
APP_URL="http://localhost:3000"
```

### 3. Running Locally
Run the development server locally:
```bash
npm run dev
```

The application will be running and accessible at `http://localhost:3000`.

### 4. Direct Production Build
Compile and bundle the production assets into the optimized `dist/` directory:
```bash
npm run build
```

---

## 🛡️ License & Copyright

Designed and developed with ❤️ for personal financial empowerment and secure accounting integrity. All rights reserved © 2026.
