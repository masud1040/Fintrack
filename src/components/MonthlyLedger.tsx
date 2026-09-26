import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Transaction, TransactionType } from '../db';
import { formatCurrency, cn } from '../lib/utils';
import { Card } from './ui/Card';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
  Wallet,
  X,
  Clock,
  Eye,
  FileText,
  Filter,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Info,
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, getDaysInMonth, startOfDay } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { generateMonthlyLedgerPDF } from '../lib/pdfExport';

interface MonthlyLedgerProps {
  onNavigateToTransactions?: () => void;
}

export function MonthlyLedger({ onNavigateToTransactions }: MonthlyLedgerProps) {
  const { currentUser } = useAuth();

  // Period Selector: Selected Year and Month (1-12)
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1); // 1-12

  // Display Mode: 'active' (only days with transactions) or 'all' (all 1-30/31 days)
  const [displayMode, setDisplayMode] = useState<'active' | 'all'>('active');

  // Popup Modal State for Date Details
  const [selectedDateDetails, setSelectedDateDetails] = useState<{
    dateStr: string; // yyyy-MM-dd
    dayNum: number;
    fullDate: Date;
  } | null>(null);

  // Quick Add Transaction Modal State
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [quickAmount, setQuickAmount] = useState('');
  const [quickType, setQuickType] = useState<TransactionType>('expense');
  const [quickCategoryId, setQuickCategoryId] = useState('');
  const [quickAccountId, setQuickAccountId] = useState('');
  const [quickNote, setQuickNote] = useState('');
  const [quickDate, setQuickDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isSubmittingQuick, setIsSubmittingQuick] = useState(false);

  // PDF Generation State
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Live queries
  const accounts = useLiveQuery(
    () => currentUser ? db.accounts.where('userId').equals(currentUser.id!).toArray() : [],
    [currentUser?.id]
  ) || [];

  const categories = useLiveQuery(
    () => currentUser ? db.categories.where('userId').equals(currentUser.id!).toArray() : [],
    [currentUser?.id]
  ) || [];

  const transactions = useLiveQuery(
    () => currentUser ? db.transactions.where('userId').equals(currentUser.id!).toArray() : [],
    [currentUser?.id]
  ) || [];

  const monthNamesEng = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const monthNamesBng = [
    'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
    'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
  ];

  const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  const toBanglaNumber = (num: number | string) => {
    return String(num).replace(/\d/g, d => banglaDigits[parseInt(d, 10)]);
  };

  const getBanglaWeekday = (dateObj: Date) => {
    const day = dateObj.getDay();
    const days = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
    return days[day];
  };

  // Month navigation handlers
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  // Filter transactions strictly for this month & year
  const monthlyTransactions = transactions.filter(tx => {
    const d = new Date(tx.date);
    return d.getFullYear() === selectedYear && (d.getMonth() + 1) === selectedMonth;
  });

  // Calculate monthly totals
  let monthlyTotalIncome = 0;
  let monthlyTotalExpense = 0;

  monthlyTransactions.forEach(tx => {
    if (tx.type === 'income') {
      monthlyTotalIncome += tx.amount;
    } else {
      monthlyTotalExpense += tx.amount;
    }
  });

  const monthlyNetBalance = monthlyTotalIncome - monthlyTotalExpense;
  const currentTotalAccountBalance = accounts.reduce((sum, acc) => sum + (acc.currentBalance || 0), 0);

  // Group transactions day by day
  const daysCountInMonth = getDaysInMonth(new Date(selectedYear, selectedMonth - 1));
  const dailyDataMap: {
    [dayNum: number]: {
      dayNum: number;
      dateObj: Date;
      dateStr: string;
      incomeList: Transaction[];
      expenseList: Transaction[];
      dayIncome: number;
      dayExpense: number;
      dayNet: number;
      hasTransactions: boolean;
    };
  } = {};

  // Initialize all days of the month
  for (let i = 1; i <= daysCountInMonth; i++) {
    const dateObj = new Date(selectedYear, selectedMonth - 1, i);
    const dateStr = format(dateObj, 'yyyy-MM-dd');
    dailyDataMap[i] = {
      dayNum: i,
      dateObj,
      dateStr,
      incomeList: [],
      expenseList: [],
      dayIncome: 0,
      dayExpense: 0,
      dayNet: 0,
      hasTransactions: false,
    };
  }

  // Populate dailyDataMap with transactions
  monthlyTransactions.forEach(tx => {
    const d = new Date(tx.date);
    const dayNum = d.getDate();
    if (dailyDataMap[dayNum]) {
      dailyDataMap[dayNum].hasTransactions = true;
      if (tx.type === 'income') {
        dailyDataMap[dayNum].incomeList.push(tx);
        dailyDataMap[dayNum].dayIncome += tx.amount;
      } else {
        dailyDataMap[dayNum].expenseList.push(tx);
        dailyDataMap[dayNum].dayExpense += tx.amount;
      }
      dailyDataMap[dayNum].dayNet = dailyDataMap[dayNum].dayIncome - dailyDataMap[dayNum].dayExpense;
    }
  });

  // Days list for table
  const allDaysList = Object.values(dailyDataMap).sort((a, b) => a.dayNum - b.dayNum);
  const activeDaysList = allDaysList.filter(d => d.hasTransactions);
  const displayedDays = displayMode === 'active' ? activeDaysList : allDaysList;

  // Handler to open Day Details Modal
  const handleRowClick = (dayData: typeof allDaysList[0]) => {
    setSelectedDateDetails({
      dateStr: dayData.dateStr,
      dayNum: dayData.dayNum,
      fullDate: dayData.dateObj,
    });
  };

  // Handler for Quick Add Transaction Submission
  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !quickAmount || !quickCategoryId || !quickAccountId) return;

    setIsSubmittingQuick(true);
    try {
      const amt = parseFloat(quickAmount);
      const chosenAccount = accounts.find(a => a.id === parseInt(quickAccountId));

      // 1. Add Transaction
      await db.transactions.add({
        userId: currentUser.id!,
        amount: amt,
        type: quickType,
        categoryId: parseInt(quickCategoryId),
        accountId: parseInt(quickAccountId),
        date: new Date(quickDate),
        note: quickNote.trim() || undefined,
      });

      // 2. Update Account Balance
      if (chosenAccount && chosenAccount.id) {
        const newBal = quickType === 'income'
          ? chosenAccount.currentBalance + amt
          : chosenAccount.currentBalance - amt;
        await db.accounts.update(chosenAccount.id, { currentBalance: newBal });
      }

      // Reset form
      setQuickAmount('');
      setQuickNote('');
      setIsQuickAdding(false);
    } catch (err) {
      console.error('Error in quick adding transaction:', err);
    } finally {
      setIsSubmittingQuick(false);
    }
  };

  // PDF Export
  const handleExportPDF = async () => {
    if (!currentUser) return;
    setIsGeneratingPdf(true);
    try {
      await generateMonthlyLedgerPDF({
        userId: currentUser.id!,
        userName: currentUser.name || 'User',
        userEmail: currentUser.email,
        phoneNumber: currentUser.phoneNumber,
        companyName: currentUser.companyName,
        year: selectedYear,
        month: selectedMonth,
        transactions: monthlyTransactions,
        accounts,
        categories,
      });
    } catch (err) {
      console.error('Error generating ledger PDF:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Day Details currently active
  const activeDayObj = selectedDateDetails ? dailyDataMap[selectedDateDetails.dayNum] : null;

  return (
    <div className="space-y-4 sm:space-y-6 max-w-5xl mx-auto pb-12 w-full">
      
      {/* Header & Month Filter Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 sm:p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <Calendar size={20} className="sm:w-[22px] sm:h-[22px]" />
              </span>
              <h2 className="text-lg sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                মাসিক ৩০ দিনের হিসাব শিট
              </h2>
            </div>
            <p className="text-[11px] sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              মাস ভিত্তিক দৈনিক আয়, ব্যয় ও নিট খতিয়ান বিবরণী
            </p>
          </div>

          {/* Action Buttons: PDF Download & Quick Add */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleExportPDF}
              disabled={isGeneratingPdf || monthlyTransactions.length === 0}
              className={cn(
                "flex-1 sm:flex-none px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 transition-all shadow-sm",
                monthlyTransactions.length > 0
                  ? "bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                  : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed"
              )}
            >
              <Download size={15} className={cn(isGeneratingPdf && "animate-bounce")} />
              <span>{isGeneratingPdf ? 'PDF হচ্ছে...' : 'PDF ডাউনলোড'}</span>
            </button>

            <button
              onClick={() => {
                setQuickDate(format(new Date(selectedYear, selectedMonth - 1, Math.min(new Date().getDate(), daysCountInMonth)), 'yyyy-MM-dd'));
                if (categories.length > 0) setQuickCategoryId(categories[0].id!.toString());
                if (accounts.length > 0) setQuickAccountId(accounts[0].id!.toString());
                setIsQuickAdding(true);
              }}
              className="flex-1 sm:flex-none px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-violet-600 hover:bg-violet-700 text-white flex items-center justify-center gap-1.5 shadow-sm transition-colors"
            >
              <Plus size={15} />
              <span>+ হিসাব যোগ</span>
            </button>
          </div>
        </div>

        {/* Month Selector Bar */}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Previous / Next Month Navigator */}
          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 p-1 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
            <button
              onClick={handlePrevMonth}
              className="p-2 rounded-xl hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
              title="পূর্ববর্তী মাস"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="px-2 text-center min-w-[120px] sm:min-w-[140px]">
              <div className="font-extrabold text-xs sm:text-sm md:text-base text-slate-900 dark:text-white">
                {monthNamesBng[selectedMonth - 1]} {toBanglaNumber(selectedYear)}
              </div>
              <div className="text-[9.5px] sm:text-[10px] text-slate-400 font-medium">
                {monthNamesEng[selectedMonth - 1]} {selectedYear}
              </div>
            </div>
            <button
              onClick={handleNextMonth}
              className="p-2 rounded-xl hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
              title="পরবর্তী মাস"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Month & Year Jump Dropdowns & Mode Toggle */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 flex-1 sm:flex-none">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="flex-1 sm:flex-none px-2.5 py-1.5 sm:py-2 text-xs font-semibold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-violet-500"
              >
                {monthNamesBng.map((mName, idx) => (
                  <option key={idx} value={idx + 1}>
                    {mName} ({monthNamesEng[idx]})
                  </option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="px-2.5 py-1.5 sm:py-2 text-xs font-semibold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-violet-500"
              >
                {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map((yr) => (
                  <option key={yr} value={yr}>
                    {toBanglaNumber(yr)} ({yr})
                  </option>
                ))}
              </select>
            </div>

            {/* Display Mode Toggle */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold w-full sm:w-auto justify-center">
              <button
                onClick={() => setDisplayMode('active')}
                className={cn(
                  "flex-1 sm:flex-none px-2.5 py-1 rounded-lg transition-all text-center",
                  displayMode === 'active'
                    ? "bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
                )}
              >
                হিসাবের দিন ({activeDaysList.length})
              </button>
              <button
                onClick={() => setDisplayMode('all')}
                className={cn(
                  "flex-1 sm:flex-none px-2.5 py-1 rounded-lg transition-all text-center",
                  displayMode === 'all'
                    ? "bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
                )}
              >
                সব {daysCountInMonth} দিন
              </button>
            </div>

          </div>

        </div>
      </div>

      {/* 4 Summary Highlight Cards for the Month */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        
        {/* Total Income */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3 sm:p-4 rounded-2xl shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
              মাসের মোট আয়
            </span>
            <span className="p-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg shrink-0">
              <ArrowUpRight size={13} />
            </span>
          </div>
          <div className="text-base sm:text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono truncate">
            +{formatCurrency(monthlyTotalIncome)}
          </div>
          <div className="text-[9.5px] sm:text-[10px] text-slate-400 mt-0.5 truncate">
            {monthlyTransactions.filter(t => t.type === 'income').length} টি আয়ের লেনদেন
          </div>
        </div>

        {/* Total Expense */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3 sm:p-4 rounded-2xl shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
              মাসের মোট ব্যয়
            </span>
            <span className="p-1 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-lg shrink-0">
              <ArrowDownRight size={13} />
            </span>
          </div>
          <div className="text-base sm:text-xl font-black text-rose-600 dark:text-rose-400 font-mono truncate">
            -{formatCurrency(monthlyTotalExpense)}
          </div>
          <div className="text-[9.5px] sm:text-[10px] text-slate-400 mt-0.5 truncate">
            {monthlyTransactions.filter(t => t.type === 'expense').length} টি ব্যয়ের লেনদেন
          </div>
        </div>

        {/* Monthly Net Balance */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3 sm:p-4 rounded-2xl shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
              মাসের নিট স্থিতি
            </span>
            <span className="p-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg shrink-0">
              <Scale size={13} />
            </span>
          </div>
          <div className={cn(
            "text-base sm:text-xl font-black font-mono truncate",
            monthlyNetBalance >= 0 ? "text-indigo-600 dark:text-indigo-400" : "text-rose-600 dark:text-rose-400"
          )}>
            {monthlyNetBalance >= 0 ? '+' : ''}{formatCurrency(monthlyNetBalance)}
          </div>
          <div className="text-[9.5px] sm:text-[10px] text-slate-400 mt-0.5 truncate">
            (মোট আয় - মোট ব্যয়)
          </div>
        </div>

        {/* Current Total Balance Across Accounts & Pocket */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3 sm:p-4 rounded-2xl shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
              পকেট ও মোট তহবিল
            </span>
            <span className="p-1 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-lg shrink-0">
              <Wallet size={13} />
            </span>
          </div>
          <div className="text-base sm:text-xl font-black text-blue-600 dark:text-blue-400 font-mono truncate">
            {formatCurrency(currentTotalAccountBalance)}
          </div>
          <div className="text-[9.5px] sm:text-[10px] text-slate-400 mt-0.5 truncate">
            ক্যাশ ও একাউন্টে জমা টাকা
          </div>
        </div>

      </div>

      {/* Main 30-Day Clean Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
        
        {/* Table Top Info */}
        <div className="p-3.5 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-violet-600 shrink-0"></span>
            <span className="font-extrabold text-xs sm:text-base text-slate-900 dark:text-white">
              {monthNamesBng[selectedMonth - 1]} মাসের দৈনিক হিসাব তালিকা
            </span>
            <span className="text-[11px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
              {displayedDays.length} টি দিন
            </span>
          </div>

          <div className="text-[10.5px] sm:text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Info size={13} className="text-violet-500 shrink-0" />
            <span>তারিখে ক্লিক করে বিস্তারিত দেখুন</span>
          </div>
        </div>

        {/* Minimal Table */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[340px] sm:min-w-[500px]">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 text-[11px] sm:text-xs font-bold uppercase tracking-wider border-b border-slate-200/80 dark:border-slate-800">
                <th className="py-3 px-3 sm:px-5">তারিখ (Date)</th>
                <th className="py-3 px-2 sm:px-4 text-right text-emerald-600 dark:text-emerald-400">আয় (Income)</th>
                <th className="py-3 px-2 sm:px-4 text-right text-rose-600 dark:text-rose-400">ব্যয় (Expense)</th>
                <th className="py-3 px-2 sm:px-4 text-right text-slate-900 dark:text-white">নিট (Net)</th>
                <th className="py-3 px-2 sm:px-3 text-center w-12 sm:w-16">দেখুন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs sm:text-sm">
              {displayedDays.length > 0 ? (
                displayedDays.map((dayData, idx) => {
                  const dayNumFormatted = String(dayData.dayNum).padStart(2, '0');
                  const isPositiveNet = dayData.dayNet > 0;
                  const isNegativeNet = dayData.dayNet < 0;

                  return (
                    <tr
                      key={dayData.dayNum}
                      onClick={() => handleRowClick(dayData)}
                      className={cn(
                        "transition-colors cursor-pointer group hover:bg-violet-50/50 dark:hover:bg-violet-950/20 active:bg-violet-100/50 dark:active:bg-violet-900/30",
                        dayData.hasTransactions
                          ? (idx % 2 === 1 ? "bg-slate-50/30 dark:bg-slate-900/40" : "bg-white dark:bg-slate-900")
                          : "bg-white/40 dark:bg-slate-900/40 opacity-70"
                      )}
                    >
                      {/* Date Column */}
                      <td className="py-2.5 sm:py-3.5 px-3 sm:px-5">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl font-black text-[11px] sm:text-xs flex items-center justify-center transition-transform group-hover:scale-105 shrink-0",
                            dayData.hasTransactions
                              ? "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 font-mono"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-400 font-mono"
                          )}>
                            {dayNumFormatted}
                          </span>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm truncate">
                              {toBanglaNumber(dayNumFormatted)} {monthNamesBng[selectedMonth - 1]}
                            </div>
                            <div className="text-[9.5px] sm:text-[10px] text-slate-400 truncate">
                              {getBanglaWeekday(dayData.dateObj)}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Income Column */}
                      <td className="py-2.5 sm:py-3.5 px-2 sm:px-4 text-right font-bold font-mono">
                        {dayData.dayIncome > 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm">
                            +{formatCurrency(dayData.dayIncome)}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-700">-</span>
                        )}
                      </td>

                      {/* Expense Column */}
                      <td className="py-2.5 sm:py-3.5 px-2 sm:px-4 text-right font-bold font-mono">
                        {dayData.dayExpense > 0 ? (
                          <span className="text-rose-600 dark:text-rose-400 text-xs sm:text-sm">
                            -{formatCurrency(dayData.dayExpense)}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-700">-</span>
                        )}
                      </td>

                      {/* Net Column */}
                      <td className="py-2.5 sm:py-3.5 px-2 sm:px-4 text-right font-extrabold font-mono text-xs sm:text-sm">
                        {dayData.hasTransactions ? (
                          <span className={cn(
                            isPositiveNet && "text-slate-900 dark:text-white",
                            isNegativeNet && "text-rose-600 dark:text-rose-400",
                            dayData.dayNet === 0 && "text-slate-500"
                          )}>
                            {isPositiveNet ? '+' : ''}{formatCurrency(dayData.dayNet)}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-700 font-normal">-</span>
                        )}
                      </td>

                      {/* View Action */}
                      <td className="py-2.5 sm:py-3.5 px-2 sm:px-3 text-center">
                        <span className="inline-flex items-center justify-center p-1 sm:p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:bg-violet-600 group-hover:text-white transition-colors">
                          <Eye size={14} />
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400">
                    <Calendar size={28} className="mx-auto mb-2 opacity-30" />
                    <p className="font-semibold text-xs sm:text-sm">এই মাসে কোন লেনদেনের হিসাব পাওয়া যায়নি।</p>
                    <p className="text-[11px] text-slate-500 mt-1">উপরে "+ হিসাব যোগ" বাটনে ক্লিক করে হিসাব যুক্ত করুন।</p>
                  </td>
                </tr>
              )}
            </tbody>

            {/* Sticky Table Footer Summary Row */}
            {monthlyTransactions.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100/95 dark:bg-slate-800/95 font-black border-t-2 border-slate-300 dark:border-slate-700 text-xs sm:text-sm">
                  <td className="py-3 sm:py-4 px-3 sm:px-5 text-slate-900 dark:text-white uppercase tracking-wider">
                    সর্বমোট (TOTAL)
                  </td>
                  <td className="py-3 sm:py-4 px-2 sm:px-4 text-right text-emerald-600 dark:text-emerald-400 font-mono">
                    +{formatCurrency(monthlyTotalIncome)}
                  </td>
                  <td className="py-3 sm:py-4 px-2 sm:px-4 text-right text-rose-600 dark:text-rose-400 font-mono">
                    -{formatCurrency(monthlyTotalExpense)}
                  </td>
                  <td className="py-3 sm:py-4 px-2 sm:px-4 text-right font-mono text-slate-900 dark:text-white">
                    {monthlyNetBalance >= 0 ? '+' : ''}{formatCurrency(monthlyNetBalance)}
                  </td>
                  <td className="py-3 sm:py-4 px-2 sm:px-3 text-center">
                    <CheckCircle2 size={15} className="mx-auto text-violet-600" />
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Day Details Pop-up Modal */}
      <AnimatePresence>
        {selectedDateDetails && activeDayObj && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-[2rem] sm:rounded-3xl p-4 sm:p-6 max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden relative"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 font-mono font-black text-sm flex items-center justify-center">
                      {String(activeDayObj.dayNum).padStart(2, '0')}
                    </span>
                    <div>
                      <h3 className="font-extrabold text-base md:text-lg text-slate-900 dark:text-white">
                        {toBanglaNumber(activeDayObj.dayNum)} {monthNamesBng[selectedMonth - 1]} {toBanglaNumber(selectedYear)}
                      </h3>
                      <p className="text-xs text-slate-400 font-medium">
                        {getBanglaWeekday(activeDayObj.dateObj)} • {format(activeDayObj.dateObj, 'dd MMMM yyyy')}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedDateDetails(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Day Metrics Mini Cards */}
              <div className="grid grid-cols-3 gap-2 my-4">
                <div className="bg-emerald-50 dark:bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-200/50 dark:border-emerald-800/30 text-center">
                  <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">দৈনিক আয়</div>
                  <div className="text-xs md:text-sm font-black text-emerald-700 dark:text-emerald-300 mt-0.5 font-mono">
                    +{formatCurrency(activeDayObj.dayIncome)}
                  </div>
                </div>

                <div className="bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-xl border border-rose-200/50 dark:border-rose-800/30 text-center">
                  <div className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase">দৈনিক ব্যয়</div>
                  <div className="text-xs md:text-sm font-black text-rose-700 dark:text-rose-300 mt-0.5 font-mono">
                    -{formatCurrency(activeDayObj.dayExpense)}
                  </div>
                </div>

                <div className="bg-slate-100 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                  <div className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">দৈনিক নিট</div>
                  <div className={cn(
                    "text-xs md:text-sm font-black mt-0.5 font-mono",
                    activeDayObj.dayNet >= 0 ? "text-slate-900 dark:text-white" : "text-rose-600 dark:text-rose-400"
                  )}>
                    {activeDayObj.dayNet >= 0 ? '+' : ''}{formatCurrency(activeDayObj.dayNet)}
                  </div>
                </div>
              </div>

              {/* Transactions List */}
              <div className="space-y-4 max-h-[340px] overflow-y-auto pr-1">
                
                {/* Income List */}
                {activeDayObj.incomeList.length > 0 && (
                  <div>
                    <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1.5">
                      <ArrowUpRight size={14} />
                      <span>আয়ের তালিকা ({activeDayObj.incomeList.length} টি)</span>
                    </div>
                    <div className="space-y-2">
                      {activeDayObj.incomeList.map((tx) => {
                        const cat = categories.find(c => c.id === tx.categoryId);
                        const acc = accounts.find(a => a.id === tx.accountId);
                        return (
                          <div
                            key={tx.id}
                            className="bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 p-3 rounded-2xl flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-xs text-slate-900 dark:text-white">
                                  {cat?.name || 'Income'}
                                </span>
                                {acc && (
                                  <span className="text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                                    <Wallet size={10} />
                                    {acc.name} {acc.type === 'Cash' ? '(পকেট)' : ''}
                                  </span>
                                )}
                              </div>
                              {tx.note && (
                                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 italic font-medium">
                                  "{tx.note}"
                                </p>
                              )}
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {format(new Date(tx.date), 'hh:mm a')}
                              </div>
                            </div>
                            <div className="text-right font-black text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                              +{formatCurrency(tx.amount)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Expense List */}
                {activeDayObj.expenseList.length > 0 && (
                  <div>
                    <div className="text-xs font-bold text-rose-600 dark:text-rose-400 mb-2 flex items-center gap-1.5">
                      <ArrowDownRight size={14} />
                      <span>ব্যয়ের তালিকা ({activeDayObj.expenseList.length} টি)</span>
                    </div>
                    <div className="space-y-2">
                      {activeDayObj.expenseList.map((tx) => {
                        const cat = categories.find(c => c.id === tx.categoryId);
                        const acc = accounts.find(a => a.id === tx.accountId);
                        return (
                          <div
                            key={tx.id}
                            className="bg-rose-50/40 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 p-3 rounded-2xl flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-xs text-slate-900 dark:text-white">
                                  {cat?.name || 'Expense'}
                                </span>
                                {acc && (
                                  <span className="text-[10px] font-semibold bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                                    <Wallet size={10} />
                                    {acc.name} {acc.type === 'Cash' ? '(পকেট)' : ''}
                                  </span>
                                )}
                              </div>
                              {tx.note && (
                                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 italic font-medium">
                                  "{tx.note}"
                                </p>
                              )}
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {format(new Date(tx.date), 'hh:mm a')}
                              </div>
                            </div>
                            <div className="text-right font-black text-rose-600 dark:text-rose-400 font-mono text-sm">
                              -{formatCurrency(tx.amount)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Empty State for Day */}
                {!activeDayObj.hasTransactions && (
                  <div className="py-8 text-center text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                    <Calendar size={28} className="mx-auto mb-1.5 opacity-40" />
                    <p className="text-xs font-bold text-slate-500">এই তারিখে কোন লেনদেন নেই</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">নিচের বোতাম থেকে এই তারিখে লেনদেন যুক্ত করুন।</p>
                  </div>
                )}

              </div>

              {/* Modal Footer Actions */}
              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                <button
                  onClick={() => {
                    const dateStr = activeDayObj.dateStr;
                    setSelectedDateDetails(null);
                    setQuickDate(dateStr);
                    if (categories.length > 0) setQuickCategoryId(categories[0].id!.toString());
                    if (accounts.length > 0) setQuickAccountId(accounts[0].id!.toString());
                    setIsQuickAdding(true);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs md:text-sm flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Plus size={16} />
                  <span>+ এই তারিখে যোগ করুন</span>
                </button>

                <button
                  onClick={() => setSelectedDateDetails(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs md:text-sm transition-colors"
                >
                  বন্ধ করুন
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quick Add Transaction Modal */}
      <AnimatePresence>
        {isQuickAdding && (
          <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-[2rem] sm:rounded-3xl p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl relative"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-extrabold text-base md:text-lg text-slate-900 dark:text-white">
                  লেনদেন যুক্ত করুন
                </h3>
                <button
                  onClick={() => setIsQuickAdding(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleQuickAddSubmit} className="space-y-4 mt-4">
                
                {/* Income / Expense Switcher */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => {
                      setQuickType('expense');
                      const expCats = categories.filter(c => c.type === 'expense');
                      if (expCats.length > 0) setQuickCategoryId(expCats[0].id!.toString());
                    }}
                    className={cn(
                      "py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all",
                      quickType === 'expense'
                        ? "bg-rose-600 text-white shadow-sm"
                        : "text-slate-600 dark:text-slate-400"
                    )}
                  >
                    <ArrowDownRight size={14} />
                    <span>খরচ / ব্যয় (-)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setQuickType('income');
                      const incCats = categories.filter(c => c.type === 'income');
                      if (incCats.length > 0) setQuickCategoryId(incCats[0].id!.toString());
                    }}
                    className={cn(
                      "py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all",
                      quickType === 'income'
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-slate-600 dark:text-slate-400"
                    )}
                  >
                    <ArrowUpRight size={14} />
                    <span>জমা / আয় (+)</span>
                  </button>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                    টাকার পরিমাণ (Amount ৳) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={quickAmount}
                    onChange={(e) => setQuickAmount(e.target.value)}
                    placeholder="যেমন: 500"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-base outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>

                {/* Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                    তারিখ (Date) *
                  </label>
                  <input
                    type="date"
                    required
                    value={quickDate}
                    onChange={(e) => setQuickDate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium text-sm outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>

                {/* Account / Pocket Source */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                    একাউন্ট / পকেট টাকা (Account) *
                  </label>
                  <select
                    value={quickAccountId}
                    onChange={(e) => setQuickAccountId(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium text-sm outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    <option value="" disabled>একাউন্ট সিলেক্ট করুন</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.type === 'Cash' ? 'পকেট ক্যাশ' : acc.type}) - অবশিষ্ট: ৳{acc.currentBalance}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                    ক্যাটাগরি (Category) *
                  </label>
                  <select
                    value={quickCategoryId}
                    onChange={(e) => setQuickCategoryId(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium text-sm outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    <option value="" disabled>ক্যাটাগরি সিলেক্ট করুন</option>
                    {categories.filter(c => c.type === quickType).map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Note / Description */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                    বিবরণ / নোট (Note - Optional)
                  </label>
                  <input
                    type="text"
                    value={quickNote}
                    onChange={(e) => setQuickNote(e.target.value)}
                    placeholder="যেমন: নাস্তা, গাড়ি ভাড়া, বেতন..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium text-sm outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={isSubmittingQuick}
                    className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm transition-colors shadow-sm"
                  >
                    {isSubmittingQuick ? 'সংরক্ষণ হচ্ছে...' : 'যুক্ত করুন'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsQuickAdding(false)}
                    className="px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm transition-colors"
                  >
                    বাতিল
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
