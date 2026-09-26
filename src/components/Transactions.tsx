import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, TransactionType, Frequency } from '../db';
import { formatCurrency, cn, savePDF } from '../lib/utils';
import { setupPDFCustomFonts } from '../lib/pdfCustomFonts';
import { Card } from './ui/Card';
import { Plus, ArrowUpRight, ArrowDownRight, Calendar, Search, Trash2, List, Wallet, Pencil, Repeat, X, Clock, Eye, EyeOff, CheckCircle2, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, parseISO, addDays, addWeeks, addMonths, addYears, startOfDay, isWithinInterval } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { processRecurringTransactions } from '../lib/recurring';
import { ConfirmModal } from './ui/ConfirmModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { generateHtmlPdf } from '../lib/htmlToPdfHelper';
import { generateDailyIncomeExpenseReportPDF } from '../lib/pdfExport';
import { ChevronLeft, ChevronRight, FileText, CalendarDays, TrendingUp, TrendingDown, Scale } from 'lucide-react';

export function Transactions() {
  const { currentUser } = useAuth();
  const [isAdding, setIsAdding] = useState(false);
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [note, setNote] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  
  // Date Filtering Mode & Controls
  const [filterPeriodMode, setFilterPeriodMode] = useState<'month' | 'day' | 'range' | 'all'>('month');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1); // 1-12
  const [selectedSingleDate, setSelectedSingleDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  
  // View Switcher (Daily breakdown vs Chronological list)
  const [viewMode, setViewMode] = useState<'daily' | 'all'>('daily');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingRecurringId, setEditingRecurringId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  
  // Recurring states
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [dueDate, setDueDate] = useState<string>('');
  const [endDate, setEndDate] = useState('');
  const [showRecurringList, setShowRecurringList] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number, type: 'transaction' | 'recurring', data?: any } | null>(null);
  
  // Custom Receipt & Privacy States
  const [hideBalance, setHideBalance] = useState(false);
  const [activeInvoiceTx, setActiveInvoiceTx] = useState<any | null>(null);
  const [summaryType, setSummaryType] = useState<'expense' | 'income'>('expense');

  // Debt/Loan Link states
  const [isDebtLinked, setIsDebtLinked] = useState(false);
  const [debtLinkSelectionType, setDebtLinkSelectionType] = useState<'new' | 'repay'>('new');
  const [debtPersonName, setDebtPersonName] = useState('');
  const [selectedRepayDebtId, setSelectedRepayDebtId] = useState<string>('');

  const debts = useLiveQuery(
    () => currentUser ? db.debts.where('userId').equals(currentUser.id!).toArray() : [],
    [currentUser?.id]
  ) || [];

  const accounts = useLiveQuery(
    () => currentUser ? db.accounts.where('userId').equals(currentUser.id!).toArray() : [],
    [currentUser?.id]
  ) || [];
  
  const categories = useLiveQuery(
    async () => {
      if (!currentUser) return [];
      const cats = await db.categories.where('userId').equals(currentUser.id!).toArray();
      return cats.filter(c => c.type === type);
    },
    [type, currentUser?.id]
  ) || [];
  
  const allCategories = useLiveQuery(
    () => currentUser ? db.categories.where('userId').equals(currentUser.id!).toArray() : [],
    [currentUser?.id]
  ) || [];
  
  const transactions = useLiveQuery(
    () => currentUser ? db.transactions.where('userId').equals(currentUser.id!).reverse().sortBy('date') : [],
    [currentUser?.id]
  ) || [];

  const recurringTransactions = useLiveQuery(
    () => currentUser ? db.recurringTransactions.where('userId').equals(currentUser.id!).toArray() : [],
    [currentUser?.id]
  ) || [];

  const previousReceivablePersons = Array.from(
    new Set(
      debts
        .filter(d => d.type === 'receivable')
        .map(d => d.person.trim())
    )
  ).sort();

  const filteredTransactions = transactions.filter(tx => {
    const category = allCategories.find(c => c.id === tx.categoryId);
    const account = accounts.find(a => a.id === tx.accountId);
    const searchLower = searchTerm.toLowerCase();
    
    const matchesSearch = (
      (tx.note?.toLowerCase().includes(searchLower) || '') ||
      (category?.name.toLowerCase().includes(searchLower) || '') ||
      (account?.name.toLowerCase().includes(searchLower) || '')
    );

    const matchesType = filterType === 'all' || tx.type === filterType;

    const txDate = startOfDay(tx.date);

    let matchesPeriod = true;
    if (filterPeriodMode === 'month') {
      const d = new Date(tx.date);
      matchesPeriod = d.getFullYear() === selectedYear && (d.getMonth() + 1) === selectedMonth;
    } else if (filterPeriodMode === 'day') {
      matchesPeriod = format(txDate, 'yyyy-MM-dd') === selectedSingleDate;
    } else if (filterPeriodMode === 'range') {
      const matchesStartDate = !filterStartDate || txDate >= startOfDay(new Date(filterStartDate));
      const matchesEndDate = !filterEndDate || txDate <= startOfDay(new Date(filterEndDate));
      matchesPeriod = matchesStartDate && matchesEndDate;
    }

    return matchesSearch && matchesType && matchesPeriod;
  });

  // Calculate high-level financial summary for current active filter
  const totalIncome = filteredTransactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0);

  const totalExpense = filteredTransactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0);

  const netPeriodBalance = totalIncome - totalExpense;

  const totalAccountsBalance = accounts.reduce(
    (acc, a) => acc + (a.currentBalance || 0),
    0
  );

  // Group transactions for the "Daily Income & Expense" combined breakdown view
  const dailyGroupedMap: { [dateKey: string]: { date: Date; incomeList: any[]; expenseList: any[]; dayIncome: number; dayExpense: number } } = {};

  filteredTransactions.forEach(tx => {
    const d = new Date(tx.date);
    const dateKey = format(d, 'yyyy-MM-dd');
    if (!dailyGroupedMap[dateKey]) {
      dailyGroupedMap[dateKey] = {
        date: d,
        incomeList: [],
        expenseList: [],
        dayIncome: 0,
        dayExpense: 0,
      };
    }
    if (tx.type === 'income') {
      dailyGroupedMap[dateKey].incomeList.push(tx);
      dailyGroupedMap[dateKey].dayIncome += tx.amount;
    } else {
      dailyGroupedMap[dateKey].expenseList.push(tx);
      dailyGroupedMap[dateKey].dayExpense += tx.amount;
    }
  });

  const sortedDailyKeys = Object.keys(dailyGroupedMap).sort((a, b) => b.localeCompare(a));

  const monthNamesEng = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const monthNamesBn = [
    'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
    'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
  ];

  const getPeriodLabel = () => {
    if (filterPeriodMode === 'month') {
      return `${monthNamesEng[selectedMonth - 1]} ${selectedYear} (${monthNamesBn[selectedMonth - 1]} ${selectedYear})`;
    } else if (filterPeriodMode === 'day') {
      try {
        return format(parseISO(selectedSingleDate), 'dd MMMM yyyy (EEEE)');
      } catch {
        return selectedSingleDate;
      }
    } else if (filterPeriodMode === 'range') {
      return `${filterStartDate || 'শুরু'} থেকে ${filterEndDate || 'আজ'}`;
    }
    return 'All-Time (সকল লেনদেন)';
  };

  const handleDownloadFullDailyPDF = async () => {
    if (!currentUser) return;
    setIsGeneratingPdf(true);
    try {
      await generateDailyIncomeExpenseReportPDF({
        userId: currentUser.id!,
        userName: currentUser.name || 'User',
        userEmail: currentUser.email,
        phoneNumber: currentUser.phoneNumber,
        companyName: currentUser.companyName,
        periodLabel: getPeriodLabel(),
        transactions: filteredTransactions,
        accounts,
        categories: allCategories,
      });
    } catch (err) {
      console.error('Error generating daily PDF report:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleAddCategory = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newCategoryName || !currentUser?.id || isSavingCategory) return;
    
    setIsSavingCategory(true);
    try {
      const id = await db.categories.add({
        userId: currentUser.id,
        name: newCategoryName,
        type,
        color: '#' + Math.floor(Math.random()*16777215).toString(16)
      });
      
      setCategoryId(id.toString());
      setNewCategoryName('');
      setIsAddingCategory(false);
    } catch (err) {
      console.error('Error adding category:', err);
    } finally {
      setIsSavingCategory(false);
    }
  };

  const resetForm = () => {
    setAmount('');
    setNote('');
    setCategoryId('');
    setAccountId('');
    setEditingId(null);
    setEditingRecurringId(null);
    setIsAdding(false);
    setIsRecurring(false);
    setFrequency('monthly');
    setDueDate('');
    setEndDate('');

    // Clear debt linking states
    setIsDebtLinked(false);
    setDebtLinkSelectionType('new');
    setDebtPersonName('');
    setSelectedRepayDebtId('');
  };

  const handleCategoryChange = (catIdVal: string) => {
    setCategoryId(catIdVal);
    const selectedCat = categories.find(c => c.id === Number(catIdVal));
    if (selectedCat) {
      const nameLower = selectedCat.name.toLowerCase();
      const isDebtKeyword = nameLower.includes('ধার') || 
                            nameLower.includes('ঋণ') || 
                            nameLower.includes('দেনা') || 
                            nameLower.includes('পাওনা') || 
                            nameLower.includes('loan') || 
                            nameLower.includes('debt') || 
                            nameLower.includes('repay') || 
                            nameLower.includes('borrow') || 
                            nameLower.includes('lend');
      if (isDebtKeyword) {
        setIsDebtLinked(true);
        if (nameLower.includes('শোধ') || nameLower.includes('আদায়') || nameLower.includes('repay') || nameLower.includes('installment')) {
          setDebtLinkSelectionType('repay');
        } else {
          setDebtLinkSelectionType('new');
        }
      } else {
        setIsDebtLinked(false);
      }
    }
  };

  const handleEdit = (tx: any) => {
    setEditingId(tx.id);
    setEditingRecurringId(null);
    setAmount(tx.amount.toString());
    setType(tx.type);
    setCategoryId(tx.categoryId.toString());
    setAccountId(tx.accountId.toString());
    setDate(format(tx.date, 'yyyy-MM-dd'));
    setNote(tx.note || '');
    setIsRecurring(false);
    setIsAdding(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEditRecurring = (rt: any) => {
    setEditingRecurringId(rt.id);
    setEditingId(null);
    setAmount(rt.amount.toString());
    setType(rt.type);
    setCategoryId(rt.categoryId.toString());
    setAccountId(rt.accountId.toString());
    setDate(format(rt.startDate, 'yyyy-MM-dd'));
    setNote(rt.note || '');
    setIsRecurring(true);
    setFrequency(rt.frequency);
    setDueDate(rt.dueDate?.toString() || '');
    setEndDate(rt.endDate ? format(rt.endDate, 'yyyy-MM-dd') : '');
    setIsAdding(true);
    setShowRecurringList(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !categoryId || !accountId || !date || !currentUser?.id || isSaving) return;

    setIsSaving(true);
    try {
      const numAmount = Number(amount);
      const accId = Number(accountId);
      const catId = Number(categoryId);
      const txDate = new Date(date);

      if (editingId) {
        // ... existing edit logic ...
        const oldTx = await db.transactions.get(editingId);
        if (oldTx) {
          const oldAccount = await db.accounts.get(oldTx.accountId);
          if (oldAccount) {
            const revertedBalance = oldTx.type === 'income' 
              ? oldAccount.currentBalance - oldTx.amount 
              : oldAccount.currentBalance + oldTx.amount;
            await db.accounts.update(oldTx.accountId, { currentBalance: revertedBalance });
          }

          const newAccount = await db.accounts.get(accId);
          if (newAccount) {
            const newBalance = type === 'income' 
              ? newAccount.currentBalance + numAmount 
              : newAccount.currentBalance - numAmount;
            await db.accounts.update(accId, { currentBalance: newBalance });
          }

          await db.transactions.update(editingId, {
            amount: numAmount,
            type,
            categoryId: catId,
            accountId: accId,
            date: txDate,
            note,
          });
        }
      } else if (editingRecurringId) {
        await db.recurringTransactions.update(editingRecurringId, {
          amount: numAmount,
          type,
          categoryId: catId,
          accountId: accId,
          frequency,
          startDate: txDate,
          dueDate: dueDate ? Number(dueDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          note,
        });
      } else {
        // If linked to debt, we can optionally enhance the transaction note
        let finalNote = isRecurring ? `[Recurring] ${note}` : note;
        if (isDebtLinked) {
          if (debtLinkSelectionType === 'new' && debtPersonName.trim()) {
            finalNote = `${finalNote ? finalNote + ' ' : ''}(Lent/Borrowed: ${debtPersonName.trim()})`;
          } else if (debtLinkSelectionType === 'repay') {
            finalNote = `${finalNote ? finalNote + ' ' : ''}(Debt Repayment)`;
          }
        }

        // Create the initial transaction
        await db.transactions.add({
          userId: currentUser.id!,
          amount: numAmount,
          type,
          categoryId: catId,
          accountId: accId,
          date: txDate,
          note: finalNote,
        });

        const account = await db.accounts.get(accId);
        if (account) {
          const newBalance = type === 'income' 
            ? account.currentBalance + numAmount 
            : account.currentBalance - numAmount;
          await db.accounts.update(accId, { currentBalance: newBalance });
        }

        // Post-process Linked Debt/Loan updates
        if (isDebtLinked) {
          if (type === 'expense') {
            const personName = debtPersonName.trim();
            if (personName) {
              // Look for an existing unpaid receivable (lent) loan under this person
              const allDebts = await db.debts.where('userId').equals(currentUser.id!).toArray();
              const existingUnpaidReceivable = allDebts.find(
                d => d.person.trim().toLowerCase() === personName.toLowerCase() && 
                     d.type === 'receivable' && 
                     d.status === 'unpaid'
              );

              if (existingUnpaidReceivable) {
                const updatedAmount = existingUnpaidReceivable.amount + numAmount;
                const updatedRemaining = (existingUnpaidReceivable.remainingAmount ?? existingUnpaidReceivable.amount) + numAmount;
                
                await db.debts.update(existingUnpaidReceivable.id!, {
                  amount: updatedAmount,
                  remainingAmount: updatedRemaining,
                  note: note ? `${existingUnpaidReceivable.note || ''} | ${note}` : existingUnpaidReceivable.note
                });
              } else {
                // Create a new unpaid receivable (lent) debt
                await db.debts.add({
                  userId: currentUser.id!,
                  person: personName,
                  amount: numAmount,
                  type: 'receivable',
                  status: 'unpaid',
                  date: txDate,
                  note: note || `Added via transaction page`,
                  remainingAmount: numAmount,
                  payments: []
                });
              }
            }
          } else if (type === 'income' && selectedRepayDebtId) {
            const debt = await db.debts.get(Number(selectedRepayDebtId));
            if (debt) {
              const existingPayments = debt.payments || [];
              const updatedPayments = [
                ...existingPayments,
                {
                  amount: numAmount,
                  date: txDate,
                  note: note || `Repayment received via transaction page`,
                  accountId: accId
                }
              ];
              const currentTotalPaid = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
              const remaining = debt.amount - currentTotalPaid;
              const isFullyPaid = remaining <= 0;

              await db.debts.update(debt.id!, {
                payments: updatedPayments,
                remainingAmount: remaining >= 0 ? remaining : 0,
                status: isFullyPaid ? 'paid' : 'unpaid'
              });
            }
          }
        }

        // If recurring, add to recurringTransactions table
        if (isRecurring) {
          await db.recurringTransactions.add({
            userId: currentUser.id!,
            amount: numAmount,
            type,
            categoryId: catId,
            accountId: accId,
            frequency,
            startDate: txDate,
            dueDate: dueDate ? Number(dueDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            lastGeneratedDate: txDate,
            note,
          });
        }
      }

      resetForm();
      if (isRecurring || editingRecurringId) {
          processRecurringTransactions(currentUser.id!);
      }
    } catch (err) {
      console.error('Error adding transaction:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRecurring = async (id: number) => {
    await db.recurringTransactions.delete(id);
  };

  const handleDelete = async (tx: any) => {
    await db.transactions.delete(tx.id);
    
    const account = await db.accounts.get(tx.accountId);
    if (account) {
      // Reverse the transaction effect
      const newBalance = tx.type === 'income' 
        ? account.currentBalance - tx.amount 
        : account.currentBalance + tx.amount;
      await db.accounts.update(tx.accountId, { currentBalance: newBalance });
    }
  };

  const handleDownloadSingleTxReceipt = async (tx: any) => {
    const category = allCategories.find((c: any) => c.id === tx.categoryId);
    const account = accounts.find((a: any) => a.id === tx.accountId);
    const isExpense = tx.type === 'expense';
    const nowOutput = format(new Date(), 'dd MMM yyyy, hh:mm a');
    const displayDate = format(new Date(tx.date), 'dd MMMM yyyy');
    const displayTime = format(new Date(tx.date), 'hh:mm a');

    const htmlContent = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Hind+Siliguri:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
        * { box-sizing: border-box; }
      </style>
      <div style="padding: 36px 40px; background-color: #ffffff; color: #0f172a; font-family: 'Inter', 'Hind Siliguri', sans-serif; line-height: 1.5; max-width: 580px; margin: 0 auto; box-sizing: border-box;">
        
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; border-bottom: 1.5px solid #e2e8f0; margin-bottom: 24px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 34px; height: 34px; background-color: #0f172a; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #ffffff; font-weight: 900; font-size: 14px;">
              FT
            </div>
            <div>
              <div style="font-size: 16px; font-weight: 900; color: #0f172a; letter-spacing: -0.02em;">FinTrack</div>
              <div style="font-size: 10px; color: #64748b;">Transaction Voucher</div>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase;">${isExpense ? 'PAYMENT VOUCHER' : 'RECEIPT VOUCHER'}</div>
            <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">TXN-${tx.id || 'N/A'}</div>
          </div>
        </div>

        <!-- Main Amount Card -->
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
          <div style="font-size: 10.5px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">
            ${isExpense ? 'পরিশোধিত অর্থ (Total Debited)' : 'সংগৃহীত অর্থ (Total Credited)'}
          </div>
          <div style="font-size: 26px; font-weight: 900; color: ${isExpense ? '#dc2626' : '#059669'}; margin-top: 6px; font-family: 'Inter', sans-serif;">
            ${isExpense ? '-' : '+'}${formatCurrency(tx.amount)}
          </div>
          <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
            ${displayDate} at ${displayTime}
          </div>
        </div>

        <!-- Transaction Details Table -->
        <div style="margin-bottom: 24px;">
          <div style="font-size: 11px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 10px;">
            লেনদেন বিবরণী (Transaction Details)
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 11.5px;">
            <tbody>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 9px 0; color: #64748b; width: 40%;">ক্যাটাগরি / খাত</td>
                <td style="padding: 9px 0; font-weight: 600; color: #0f172a; text-align: right; font-family: 'Hind Siliguri', sans-serif;">${category?.name || 'General'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 9px 0; color: #64748b;">একাউন্ট / হিসাব</td>
                <td style="padding: 9px 0; font-weight: 600; color: #0f172a; text-align: right; font-family: 'Hind Siliguri', sans-serif;">${account?.name || 'Cash Wallet'}</td>
              </tr>
              ${tx.note ? `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 9px 0; color: #64748b;">নোট / বিবরণ</td>
                  <td style="padding: 9px 0; font-weight: 500; color: #0f172a; text-align: right; font-family: 'Hind Siliguri', sans-serif;">${tx.note}</td>
                </tr>
              ` : ''}
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 9px 0; color: #64748b;">লেনদেনের ধরণ</td>
                <td style="padding: 9px 0; font-weight: 600; color: #0f172a; text-align: right;">${tx.type === 'income' ? 'আয় (Direct Credit)' : 'ব্যয় (Direct Debit)'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 9px 0; color: #64748b;">অবস্থা (Status)</td>
                <td style="padding: 9px 0; font-weight: 700; color: #059669; text-align: right;">সফল (Completed)</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Footer -->
        <div style="margin-top: 32px; padding-top: 16px; border-top: 1.5px solid #e2e8f0; display: flex; justify-content: space-between; align-items: flex-end; font-size: 10px; color: #94a3b8;">
          <div>
            <div style="font-weight: 600; color: #64748b;">FinTrack Digital Ledger Voucher</div>
            <div style="margin-top: 2px;">Generated: ${nowOutput}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 600; color: #64748b;">Verified Transaction</div>
          </div>
        </div>

      </div>
    `;

    const safeFileName = `voucher_${category?.name?.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'tx'}_${format(new Date(tx.date), 'yyyyMMdd')}.pdf`;
    await generateHtmlPdf(htmlContent, { fileName: safeFileName, isThermalReceipt: false });
  };

  const handleDownloadPeriodReceipt = async (reportType: 'expense' | 'income') => {
    const isExpense = reportType === 'expense';
    const nowOutput = format(new Date(), 'dd MMM yyyy, hh:mm a');
    const periodTransactions = filteredTransactions.filter(tx => tx.type === reportType);
    const cumulativeTotal = periodTransactions.reduce((acc, tx) => acc + tx.amount, 0);

    const htmlContent = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Hind+Siliguri:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
        * { box-sizing: border-box; }
      </style>
      <div style="padding: 36px 40px; background-color: #ffffff; color: #0f172a; font-family: 'Inter', 'Hind Siliguri', sans-serif; line-height: 1.5; box-sizing: border-box; max-width: 794px; margin: 0 auto;">
        
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 22px; border-bottom: 1.5px solid #e2e8f0; margin-bottom: 24px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 38px; height: 38px; background-color: #0f172a; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #ffffff; font-weight: 900; font-size: 16px;">
              FT
            </div>
            <div>
              <div style="font-size: 18px; font-weight: 900; color: #0f172a; letter-spacing: -0.02em;">FinTrack</div>
              <div style="font-size: 10.5px; color: #64748b;">Financial Statement & Itemized Audit</div>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 14px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.04em;">
              ${isExpense ? 'EXPENSES STATEMENT (ব্যয় বিবরণী)' : 'INCOME STATEMENT (আয় বিবরণী)'}
            </div>
            <div style="font-size: 10px; color: #94a3b8; margin-top: 3px;">Generated: ${nowOutput}</div>
          </div>
        </div>

        <!-- Metric Cards -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px;">
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px;">
            <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">বিবরণীর ধরণ (Report Type)</div>
            <div style="font-size: 14px; font-weight: 800; color: ${isExpense ? '#dc2626' : '#059669'}; margin-top: 4px; font-family: 'Hind Siliguri', sans-serif;">
              ${isExpense ? 'খরচ বিবরণী (Expenses)' : 'আয় বিবরণী (Incomes)'}
            </div>
          </div>
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px;">
            <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">মোট লেনদেন সংখ্যা</div>
            <div style="font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 4px;">${periodTransactions.length} টি</div>
          </div>
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px;">
            <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">সর্বমোট পরিমাণ (Total)</div>
            <div style="font-size: 16px; font-weight: 800; color: ${isExpense ? '#dc2626' : '#059669'}; margin-top: 4px; font-family: 'Inter', sans-serif;">
              ${isExpense ? '-' : '+'}${formatCurrency(cumulativeTotal)}
            </div>
          </div>
        </div>

        <!-- Table -->
        <div style="margin-bottom: 28px;">
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 11px; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
            <thead>
              <tr style="background-color: #f8fafc; color: #475569; font-weight: 700; border-bottom: 1.5px solid #e2e8f0;">
                <th style="padding: 10px 12px; width: 40px; text-align: center;">SL</th>
                <th style="padding: 10px 12px; width: 95px;">Date (তারিখ)</th>
                <th style="padding: 10px 12px; width: 130px;">Category (ক্যাটাগরি)</th>
                <th style="padding: 10px 12px; width: 120px;">Account (হিসাব)</th>
                <th style="padding: 10px 12px;">Note (বিবরণ)</th>
                <th style="padding: 10px 12px; width: 120px; text-align: right;">Amount (টাকা)</th>
              </tr>
            </thead>
            <tbody>
              ${periodTransactions.length > 0 ? periodTransactions.map((tx, idx) => {
                const cat = allCategories.find((c: any) => c.id === tx.categoryId);
                const acc = accounts.find((a: any) => a.id === tx.accountId);
                return `
                  <tr style="border-bottom: 1px solid #f1f5f9; background-color: ${idx % 2 === 1 ? '#fafafa' : '#ffffff'};">
                    <td style="padding: 9px 12px; text-align: center; color: #94a3b8; font-size: 10.5px;">${idx + 1}</td>
                    <td style="padding: 9px 12px; color: #475569; font-weight: 500;">${format(new Date(tx.date), 'dd MMM yyyy')}</td>
                    <td style="padding: 9px 12px;">
                      <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; background-color: ${isExpense ? '#fef2f2' : '#ecfdf5'}; color: ${isExpense ? '#991b1b' : '#065f46'}; font-family: 'Hind Siliguri', sans-serif;">
                        ${cat?.name || 'Uncategorized'}
                      </span>
                    </td>
                    <td style="padding: 9px 12px; color: #475569; font-family: 'Hind Siliguri', sans-serif;">${acc?.name || 'Cash Wallet'}</td>
                    <td style="padding: 9px 12px; color: #0f172a; font-family: 'Hind Siliguri', sans-serif;">${tx.note || '-'}</td>
                    <td style="padding: 9px 12px; font-weight: 700; text-align: right; color: ${isExpense ? '#dc2626' : '#059669'}; font-family: 'Inter', sans-serif;">
                      ${isExpense ? '-' : '+'}${formatCurrency(tx.amount)}
                    </td>
                  </tr>
                `;
              }).join('') : `
                <tr>
                  <td colspan="6" style="padding: 24px; text-align: center; color: #94a3b8; font-style: italic;">কোন রেকর্ড পাওয়া যায়নি।</td>
                </tr>
              `}
              <tr style="background-color: #f8fafc; border-top: 1.5px solid #e2e8f0; font-weight: 800;">
                <td colspan="5" style="padding: 10px 12px; text-transform: uppercase; font-size: 10.5px; color: #475569;">
                  TOTAL CUMULATIVE VOLUME (সর্বমোট পরিমাণ)
                </td>
                <td style="padding: 10px 12px; text-align: right; color: ${isExpense ? '#dc2626' : '#059669'}; font-size: 12px; font-family: 'Inter', sans-serif;">
                  ${isExpense ? '-' : '+'}${formatCurrency(cumulativeTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Footer -->
        <div style="margin-top: 36px; padding-top: 18px; border-top: 1.5px solid #e2e8f0; display: flex; justify-content: space-between; align-items: flex-end; font-size: 10.5px; color: #94a3b8;">
          <div>
            <div style="font-weight: 600; color: #64748b;">FinTrack Wealth Platform • Ledger Statement</div>
            <div style="margin-top: 2px;">Document Hash: BDT-STMT-${format(new Date(), 'yyyyMMdd')}-X</div>
          </div>
          <div style="text-align: right;">
            <div style="color: #64748b; font-weight: 600;">Verified Digital Record</div>
            <div style="margin-top: 2px;">Page 1 of 1</div>
          </div>
        </div>

      </div>
    `;

    const reportFileName = `FinTrack_Statement_${reportType}_report.pdf`;
    await generateHtmlPdf(htmlContent, { fileName: reportFileName, isThermalReceipt: false });
  };

  if (!currentUser) {
    return (
      <div className="p-8 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-3xl mt-8">
        Please log in to manage your transactions.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <span>লেনদেন ও আর্থিক স্টেটমেন্ট</span>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
              Transactions
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            ফিল্টারকৃত সময়কাল: <strong className="text-indigo-600 dark:text-indigo-400 font-semibold">{getPeriodLabel()}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* PDF Download Button */}
          <button
            onClick={handleDownloadFullDailyPDF}
            disabled={isGeneratingPdf || filteredTransactions.length === 0}
            className="bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 px-3.5 py-2 rounded-xl font-bold transition-all text-xs flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            title="মাসিক দৈনিক আয় ও ব্যয় PDF ডাউনলোড করুন"
          >
            {isGeneratingPdf ? (
              <svg className="animate-spin h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <Download size={15} />
            )}
            <span>দৈনিক আয়-ব্যয় PDF</span>
          </button>

          <button
            onClick={() => {
              if (!isAdding) resetForm();
              else setIsAdding(false);
              if (!isAdding) setIsAdding(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 text-xs shrink-0 shadow-sm"
          >
            <Plus size={16} />
            <span>নতুন লেনদেন</span>
          </button>

          <button
            onClick={() => setShowRecurringList(true)}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            title="Manage Recurring Transactions"
          >
            <Repeat size={18} />
          </button>
        </div>
      </div>

      {/* 4 Financial KPI Summary Cards (Total Income, Total Expense, Net Balance, Total Cash in Hand) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        
        {/* Total Income Card */}
        <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-950/50 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
              মোট আয় (Income)
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <TrendingUp size={15} />
            </div>
          </div>
          <div className="mt-1.5 sm:mt-2">
            <h3 className="text-base sm:text-xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight font-mono truncate">
              {hideBalance ? "•••• BDT" : `+${formatCurrency(totalIncome)}`}
            </h3>
            <p className="text-[9.5px] sm:text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
              {filteredTransactions.filter(t => t.type === 'income').length} টি আয়ের লেনদেন
            </p>
          </div>
        </div>

        {/* Total Expense Card */}
        <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-red-100 dark:border-red-950/50 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
              মোট ব্যয় (Expense)
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
              <TrendingDown size={15} />
            </div>
          </div>
          <div className="mt-1.5 sm:mt-2">
            <h3 className="text-base sm:text-xl font-black text-red-600 dark:text-red-400 tracking-tight font-mono truncate">
              {hideBalance ? "•••• BDT" : `-${formatCurrency(totalExpense)}`}
            </h3>
            <p className="text-[9.5px] sm:text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
              {filteredTransactions.filter(t => t.type === 'expense').length} টি ব্যয়ের লেনদেন
            </p>
          </div>
        </div>

        {/* Net Savings / Balance Card */}
        <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-blue-100 dark:border-blue-950/50 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
              নিট সঞ্চয়/ব্যালেন্স
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Scale size={15} />
            </div>
          </div>
          <div className="mt-1.5 sm:mt-2">
            <h3 className={cn(
              "text-base sm:text-xl font-black tracking-tight font-mono truncate",
              netPeriodBalance >= 0 ? "text-blue-600 dark:text-blue-400" : "text-amber-600 dark:text-amber-400"
            )}>
              {hideBalance ? "•••• BDT" : `${netPeriodBalance >= 0 ? '+' : ''}${formatCurrency(netPeriodBalance)}`}
            </h3>
            <p className="text-[9.5px] sm:text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
              (মোট আয় - মোট ব্যয়)
            </p>
          </div>
        </div>

        {/* Total Available Account Balance Card (koto tk ache) */}
        <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-purple-100 dark:border-purple-950/50 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
              মোট জমা তহবিল
            </span>
            <button
              onClick={() => setHideBalance(!hideBalance)}
              className="p-1 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/50 transition-colors"
              title={hideBalance ? "ব্যালেন্স দেখান" : "লুকান"}
            >
              {hideBalance ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <div className="mt-1.5 sm:mt-2">
            <h3 className="text-base sm:text-xl font-black text-purple-600 dark:text-purple-400 tracking-tight font-mono truncate">
              {hideBalance ? "•••• BDT" : formatCurrency(totalAccountsBalance)}
            </h3>
            <p className="text-[9.5px] sm:text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
              {accounts.length} টি একাউন্টে মোট টাকা
            </p>
          </div>
        </div>

      </div>

      {/* Filter and Date Control Panel */}
      <Card className="p-4 sm:p-5 space-y-4">
        
        {/* Row 1: Filter Mode Selector Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs font-bold">
            
            {/* Month Mode Button */}
            <button
              onClick={() => setFilterPeriodMode('month')}
              className={cn(
                "px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5",
                filterPeriodMode === 'month'
                  ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              )}
            >
              <Calendar size={14} />
              <span>মাসিক ফিল্টার</span>
            </button>

            {/* Single Date Mode Button (e.g. 23rd) */}
            <button
              onClick={() => setFilterPeriodMode('day')}
              className={cn(
                "px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5",
                filterPeriodMode === 'day'
                  ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              )}
            >
              <CalendarDays size={14} />
              <span>নির্দিষ্ট তারিখ (যেমন ২৩ তারিখ)</span>
            </button>

            {/* Custom Range Button */}
            <button
              onClick={() => setFilterPeriodMode('range')}
              className={cn(
                "px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5",
                filterPeriodMode === 'range'
                  ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              )}
            >
              <FileText size={14} />
              <span>তারিখ রেঞ্জ</span>
            </button>

            {/* All Time Button */}
            <button
              onClick={() => setFilterPeriodMode('all')}
              className={cn(
                "px-3 py-1.5 rounded-lg transition-all",
                filterPeriodMode === 'all'
                  ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              )}
            >
              সব লেনদেন
            </button>
          </div>

          {/* View Mode: Daily vs All List */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold">
            <button
              onClick={() => setViewMode('daily')}
              className={cn(
                "px-3 py-1.5 rounded-lg transition-all flex items-center gap-1",
                viewMode === 'daily'
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              )}
            >
              <span>দৈনিক আয়-ব্যয় ছক</span>
            </button>
            <button
              onClick={() => setViewMode('all')}
              className={cn(
                "px-3 py-1.5 rounded-lg transition-all flex items-center gap-1",
                viewMode === 'all'
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              )}
            >
              <span>সকল তালিকা</span>
            </button>
          </div>
        </div>

        {/* Row 2: Date Selector Controls depending on active mode */}
        {filterPeriodMode === 'month' && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (selectedMonth === 1) {
                    setSelectedMonth(12);
                    setSelectedYear(prev => prev - 1);
                  } else {
                    setSelectedMonth(prev => prev - 1);
                  }
                }}
                className="p-1.5 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                title="Previous Month"
              >
                <ChevronLeft size={16} />
              </button>

              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold text-slate-800 dark:text-slate-100 outline-none"
              >
                {monthNamesEng.map((name, i) => (
                  <option key={i + 1} value={i + 1}>
                    {name} ({monthNamesBn[i]})
                  </option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold text-slate-800 dark:text-slate-100 outline-none"
              >
                {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>

              <button
                onClick={() => {
                  if (selectedMonth === 12) {
                    setSelectedMonth(1);
                    setSelectedYear(prev => prev + 1);
                  } else {
                    setSelectedMonth(prev => prev + 1);
                  }
                }}
                className="p-1.5 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                title="Next Month"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <button
              onClick={() => {
                const now = new Date();
                setSelectedYear(now.getFullYear());
                setSelectedMonth(now.getMonth() + 1);
              }}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              চলতি মাস এ যান (Current Month)
            </button>
          </div>
        )}

        {filterPeriodMode === 'day' && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase">তারিখ নির্বাচন:</span>
              <input
                type="date"
                value={selectedSingleDate}
                onChange={(e) => setSelectedSingleDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedSingleDate(format(new Date(), 'yyyy-MM-dd'))}
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100"
              >
                আজকে (Today)
              </button>
            </div>
          </div>
        )}

        {filterPeriodMode === 'range' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase shrink-0">হতে (From):</span>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase shrink-0">পর্যন্ত (To):</span>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        )}

        {/* Row 3: Search and Type Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="বিবরণ, ক্যাটাগরি বা একাউন্ট দিয়ে খুঁজুন..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-xs sm:text-sm"
            />
          </div>

          <div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-xs sm:text-sm font-semibold"
            >
              <option value="all">সব লেনদেন (আয় ও ব্যয়)</option>
              <option value="income">শুধুমাত্র আয় (Income Only)</option>
              <option value="expense">শুধুমাত্র ব্যয় (Expense Only)</option>
            </select>
          </div>
        </div>
      </Card>

      <AnimatePresence>
        {showRecurringList && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-2xl w-full shadow-2xl max-h-[80vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Repeat size={24} className="text-indigo-500" />
                  Recurring Transactions
                </h3>
                <button 
                  onClick={() => setShowRecurringList(false)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                {recurringTransactions.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    No recurring transactions set up.
                  </div>
                ) : (
                  recurringTransactions.map(rt => {
                    const category = allCategories.find(c => c.id === rt.categoryId);
                    const account = accounts.find(a => a.id === rt.accountId);
                    return (
                      <div key={rt.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center",
                            rt.type === 'expense' ? "bg-red-100 text-red-600 dark:bg-red-500/20" : "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20"
                          )}>
                            <Clock size={20} />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white">{category?.name}</p>
                            <p className="text-xs text-slate-500 flex items-center gap-1">
                              <Repeat size={10} /> Every {rt.frequency} • {account?.name}
                            </p>
                            {rt.dueDate !== undefined && (
                              <p className="text-[10px] text-indigo-500 font-bold mt-0.5">
                                {rt.frequency === 'monthly' ? `Due on the ${rt.dueDate}${rt.dueDate === 1 ? 'st' : (rt.dueDate === 2 ? 'nd' : (rt.dueDate === 3 ? 'rd' : 'th'))} of the month` : `Due every ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][rt.dueDate]}`}
                              </p>
                            )}
                            {rt.endDate && (
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                Ends: {format(rt.endDate, 'MMM d, yyyy')}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <p className={cn(
                            "font-bold",
                            rt.type === 'expense' ? "text-red-600" : "text-emerald-600"
                          )}>
                            {formatCurrency(rt.amount)}
                          </p>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleEditRecurring(rt)}
                              className="p-2 text-slate-400 hover:text-indigo-500 transition-colors"
                              title="Edit schedule"
                            >
                              <Pencil size={18} />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm({ id: rt.id!, type: 'recurring' })}
                              className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                              title="Delete schedule"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </div>
        )}
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card className="p-6 mb-6">
              <form onSubmit={handleAddTransaction} className="space-y-4">
                {/* Type Selection */}
                <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-full max-w-xs mx-auto mb-6">
                  <button
                    type="button"
                    onClick={() => { 
                      setType('expense'); 
                      setCategoryId(''); 
                      setIsDebtLinked(false);
                      setDebtPersonName('');
                      setSelectedRepayDebtId('');
                    }}
                    className={cn(
                      "flex-1 py-2 text-sm font-medium rounded-lg transition-all",
                      type === 'expense' ? "bg-white dark:bg-slate-700 text-red-600 dark:text-red-400 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    )}
                  >
                    Expense
                  </button>
                  <button
                    type="button"
                    onClick={() => { 
                      setType('income'); 
                      setCategoryId(''); 
                      setIsDebtLinked(false);
                      setDebtPersonName('');
                      setSelectedRepayDebtId('');
                    }}
                    className={cn(
                      "flex-1 py-2 text-sm font-medium rounded-lg transition-all",
                      type === 'income' ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    )}
                  >
                    Income
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Amount
                    </label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="0.00"
                      step="0.01"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Account
                    </label>
                    <select
                      value={accountId}
                      onChange={(e) => setAccountId(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      required
                    >
                      <option value="" disabled>Select Account</option>
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.currentBalance)})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Category
                    </label>
                    {isAddingCategory ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddCategory();
                            }
                          }}
                          disabled={isSavingCategory}
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:opacity-50"
                          placeholder="New category name"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleAddCategory()}
                          disabled={isSavingCategory}
                          className="bg-indigo-600 text-white px-3 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
                        >
                          {isSavingCategory ? '...' : 'Add'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsAddingCategory(false)}
                          disabled={isSavingCategory}
                          className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
                        >
                          X
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <select
                          value={categoryId}
                          onChange={(e) => handleCategoryChange(e.target.value)}
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                          required
                        >
                          <option value="" disabled>Select Category</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setIsAddingCategory(true)}
                          className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-3 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center"
                          title="Add new category"
                        >
                          <Plus size={18} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Note (Optional)
                    </label>
                    <input
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="What was this for?"
                    />
                  </div>

                  {/* Debt/Loan Linking UI */}
                  {!editingId && (
                    <div className={cn(
                      "md:col-span-2 p-5 rounded-2xl border transition-all duration-300 space-y-4",
                      isDebtLinked 
                        ? "bg-indigo-50/70 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800 shadow-sm" 
                        : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                    )}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                            isDebtLinked ? "bg-indigo-600 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                          )}>
                            <Wallet size={18} />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white block text-sm sm:text-base">
                              {type === 'expense' 
                                ? "🤝 টাকা ধার দিয়েছি? (Did you lend money?)" 
                                : "💸 পাওনা টাকা আদায়/ফেরত? (Collected Loan Repayment?)"}
                            </span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">
                              {type === 'expense'
                                ? "এই খরচটিকে দেনা-পাওনা পাতায় পাওনা (Receivable) হিসেবে যুক্ত করুন"
                                : "প্রাপ্ত আয়টিকে পূর্বের বকেয়া পাওনা টাকা আদায়ের সাথে লিংক করুন"}
                            </span>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={isDebtLinked}
                            onChange={(e) => {
                              setIsDebtLinked(e.target.checked);
                              if (e.target.checked) {
                                setDebtLinkSelectionType(type === 'expense' ? 'new' : 'repay');
                              } else {
                                setDebtPersonName('');
                                setSelectedRepayDebtId('');
                              }
                            }}
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                        </label>
                      </div>

                      {isDebtLinked && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="space-y-4 pt-3 border-t border-slate-200 dark:border-slate-800"
                        >
                          {type === 'expense' ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[11px] font-black text-slate-500 uppercase mb-1.5 tracking-wider font-sans">
                                  কাকে ধার দিয়েছেন? (Borrower Name) *
                                </label>
                                <input
                                  type="text"
                                  list="receivable-people-suggestions"
                                  value={debtPersonName}
                                  onChange={(e) => setDebtPersonName(e.target.value)}
                                  placeholder="নাম লিখুন বা আগের তালিকা থেকে সিলেক্ট করুন"
                                  className="w-full px-4 py-2.5 rounded-xl border border-slate-250 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-505 outline-none transition-all text-sm font-bold"
                                  required={isDebtLinked && type === 'expense'}
                                />
                                <datalist id="receivable-people-suggestions">
                                  {previousReceivablePersons.map((personName, idx) => (
                                    <option key={idx} value={personName} />
                                  ))}
                                </datalist>
                                <p className="text-[10px] text-slate-400 mt-1">
                                  পূর্বের দেনাদারদের নাম টাইপ করলেই দেখা যাবে। নতুন নামও লিখতে পারেন।
                                </p>
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">
                                  ঋণের বিবরণী (Loan Note - ঐচ্ছিক)
                                </label>
                                <input
                                  type="text"
                                  placeholder="মোবাইল বা অন্য কোনো তথ্য..."
                                  value={note}
                                  onChange={(e) => setNote(e.target.value)}
                                  className="w-full px-4 py-2.5 rounded-xl border border-slate-205 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-505 outline-none transition-all text-sm"
                                />
                              </div>
                            </div>
                          ) : (
                            <div>
                              <label className="block text-[11px] font-black text-slate-600 dark:text-slate-400 uppercase mb-1.5 tracking-wider font-sans">
                                কার থেকে বকেয়া টাকা আদায় হলো? (Select Active Outstanding Debtor) *
                              </label>
                              <select
                                value={selectedRepayDebtId}
                                onChange={(e) => setSelectedRepayDebtId(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-201 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-bold"
                                required={isDebtLinked && type === 'income'}
                              >
                                <option value="">-- দেনাদার বাছাই করুন (Select Debtor from outstanding) --</option>
                                {debts
                                  .filter(d => d.status === 'unpaid' && d.type === 'receivable')
                                  .map(d => (
                                    <option key={d.id} value={d.id}>
                                      {d.person} - lend: {formatCurrency(d.amount)} (বাকি পাওনা: {formatCurrency(d.remainingAmount ?? d.amount)})
                                    </option>
                                  ))}
                                {debts.filter(d => d.status === 'unpaid' && d.type === 'receivable').length === 0 && (
                                  <option disabled value="">কোনো সক্রিয় বকেয়া পাওনা টাকা বা দেনাদার পাওয়া যায়নি (No active unpaid receivables found)</option>
                                )}
                              </select>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </div>
                  )}

                  {!editingId && (
                    <div className={cn(
                      "md:col-span-2 p-4 rounded-2xl border transition-all duration-300",
                      isRecurring 
                        ? "bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30 shadow-sm" 
                        : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                    )}>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                            isRecurring ? "bg-indigo-600 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-500"
                          )}>
                            <Repeat size={20} />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white block">Recurring Schedule</span>
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Automatically generate transactions</span>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={isRecurring}
                            onChange={(e) => setIsRecurring(e.target.checked)}
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                        </label>
                      </div>

                      {isRecurring && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2"
                        >
                          <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                              Repeat Every
                            </label>
                            <div className="relative">
                              <select
                                value={frequency}
                                onChange={(e) => setFrequency(e.target.value as Frequency)}
                                className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm appearance-none"
                              >
                                <option value="daily">Day</option>
                                <option value="weekly">Week</option>
                                <option value="monthly">Month</option>
                                <option value="yearly">Year</option>
                              </select>
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                <Clock size={16} />
                              </div>
                            </div>
                          </div>
                          {(frequency === 'monthly' || frequency === 'weekly') && (
                            <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                                {frequency === 'monthly' ? 'Due Day of Month' : 'Due Day of Week'}
                              </label>
                              <div className="relative">
                                {frequency === 'monthly' ? (
                                  <input
                                    type="number"
                                    min="1"
                                    max="31"
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                    placeholder="1-31"
                                    className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                                  />
                                ) : (
                                  <select
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                    className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm appearance-none"
                                  >
                                    <option value="">Select Day</option>
                                    <option value="0">Sunday</option>
                                    <option value="1">Monday</option>
                                    <option value="2">Tuesday</option>
                                    <option value="3">Wednesday</option>
                                    <option value="4">Thursday</option>
                                    <option value="5">Friday</option>
                                    <option value="6">Saturday</option>
                                  </select>
                                )}
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                  <Calendar size={16} />
                                </div>
                              </div>
                            </div>
                          )}
                          <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                              Stop After (Optional)
                            </label>
                            <div className="relative">
                              <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                              />
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                <Calendar size={16} />
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={resetForm}
                    disabled={isSaving}
                    className="px-4 py-2 rounded-xl font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-medium transition-colors shadow-sm disabled:bg-indigo-400 flex items-center justify-center gap-2"
                  >
                    {isSaving && (
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    )}
                    {editingId ? 'Update Transaction' : (editingRecurringId ? 'Update Schedule' : 'Save Transaction')}
                  </button>
                </div>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Transactions View */}
      {filteredTransactions.length === 0 ? (
        <Card className="p-12 text-center text-slate-500 dark:text-slate-400">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <List size={24} className="text-slate-400" />
          </div>
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">কোনো লেনদেন পাওয়া যায়নি</p>
          <p className="text-sm">এই সময়কালে কোনো আয় বা ব্যয়ের রেকর্ড নেই। নতুন লেনদেন যোগ করুন।</p>
        </Card>
      ) : viewMode === 'daily' ? (
        /* Daily Grouped View (Date-by-Date Income & Expense side-by-side) */
        <div className="space-y-5">
          {sortedDailyKeys.map(dateKey => {
            const dayData = dailyGroupedMap[dateKey];
            const dayNet = dayData.dayIncome - dayData.dayExpense;

            return (
              <div 
                key={dateKey}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
              >
                {/* Daily Header Summary */}
                <div className="p-3 sm:px-5 sm:py-3.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
                  <div className="flex items-center gap-2 sm:gap-2.5">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-black text-xs sm:text-sm flex items-center justify-center shrink-0">
                      {format(dayData.date, 'dd')}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                        {format(dayData.date, 'dd MMMM yyyy, EEEE')}
                      </h4>
                      <p className="text-[9.5px] sm:text-[10px] text-slate-400">
                        দৈনিক লেনদেন: {dayData.incomeList.length + dayData.expenseList.length} টি
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[11px] sm:text-xs font-mono font-bold">
                    <span className="text-emerald-600 dark:text-emerald-400">
                      +{formatCurrency(dayData.dayIncome)}
                    </span>
                    <span className="text-red-600 dark:text-red-400">
                      -{formatCurrency(dayData.dayExpense)}
                    </span>
                    <span className={cn(
                      "px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[10px] sm:text-[11px]",
                      dayNet >= 0
                        ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300"
                        : "bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300"
                    )}>
                      নিট: {dayNet >= 0 ? '+' : ''}{formatCurrency(dayNet)}
                    </span>
                  </div>
                </div>

                {/* Day Details: Income Column & Expense Column */}
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-800">
                  
                  {/* Income Section for this Day */}
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        <ArrowUpRight size={14} />
                        <span>আয় (Income - {dayData.incomeList.length})</span>
                      </span>
                      <span className="text-xs font-mono font-black text-emerald-600">
                        +{formatCurrency(dayData.dayIncome)}
                      </span>
                    </div>

                    {dayData.incomeList.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2">কোনো আয় নেই</p>
                    ) : (
                      dayData.incomeList.map(tx => {
                        const category = allCategories.find(c => c.id === tx.categoryId);
                        const account = accounts.find(a => a.id === tx.accountId);

                        return (
                          <div
                            key={tx.id}
                            onClick={() => setActiveInvoiceTx(tx)}
                            className="p-2.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 border border-slate-150 dark:border-slate-800 transition-colors flex items-center justify-between gap-2 cursor-pointer group"
                          >
                            <div className="min-w-0">
                              <p className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                                {category?.name || 'Income'}
                              </p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                {account?.name} {tx.note && `• ${tx.note}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-bold text-xs font-mono text-emerald-600 dark:text-emerald-400">
                                +{formatCurrency(tx.amount)}
                              </span>
                              <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleEdit(tx); }}
                                  className="p-1 text-slate-400 hover:text-indigo-500 rounded"
                                >
                                  <Pencil size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ id: tx.id, type: 'transaction', data: tx }); }}
                                  className="p-1 text-slate-400 hover:text-red-500 rounded"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Expense Section for this Day */}
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                        <ArrowDownRight size={14} />
                        <span>ব্যয় (Expense - {dayData.expenseList.length})</span>
                      </span>
                      <span className="text-xs font-mono font-black text-red-600">
                        -{formatCurrency(dayData.dayExpense)}
                      </span>
                    </div>

                    {dayData.expenseList.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2">কোনো ব্যয় নেই</p>
                    ) : (
                      dayData.expenseList.map(tx => {
                        const category = allCategories.find(c => c.id === tx.categoryId);
                        const account = accounts.find(a => a.id === tx.accountId);

                        return (
                          <div
                            key={tx.id}
                            onClick={() => setActiveInvoiceTx(tx)}
                            className="p-2.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 hover:bg-red-50/50 dark:hover:bg-red-950/20 border border-slate-150 dark:border-slate-800 transition-colors flex items-center justify-between gap-2 cursor-pointer group"
                          >
                            <div className="min-w-0">
                              <p className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                                {category?.name || 'Expense'}
                              </p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                {account?.name} {tx.note && `• ${tx.note}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-bold text-xs font-mono text-red-600 dark:text-red-400">
                                -{formatCurrency(tx.amount)}
                              </span>
                              <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleEdit(tx); }}
                                  className="p-1 text-slate-400 hover:text-indigo-500 rounded"
                                >
                                  <Pencil size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ id: tx.id, type: 'transaction', data: tx }); }}
                                  className="p-1 text-slate-400 hover:text-red-500 rounded"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Chronological Standard Transaction List */
        <Card className="divide-y divide-slate-100 dark:divide-slate-800">
          {filteredTransactions.map(tx => {
            const category = allCategories.find(c => c.id === tx.categoryId);
            const account = accounts.find(a => a.id === tx.accountId);
            const isExpense = tx.type === 'expense';

            return (
              <div 
                key={tx.id} 
                onClick={() => setActiveInvoiceTx(tx)}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group gap-3 cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
                    isExpense ? "bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400" : "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                  )}>
                    {isExpense ? <ArrowDownRight size={24} /> : <ArrowUpRight size={24} />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-slate-100 text-base truncate">
                      {category?.name || 'Unknown'}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      <span className="flex items-center gap-1">
                        <Wallet size={12} />
                        {account?.name}
                      </span>
                      <span className="hidden xs:inline">•</span>
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {format(tx.date, 'MMM d, yyyy')}
                      </span>
                    </div>
                    {tx.note && (
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 italic line-clamp-1">
                        "{tx.note}"
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 ml-16 sm:ml-0 gap-y-2">
                  <div className={cn(
                    "font-bold text-lg whitespace-nowrap",
                    isExpense ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
                  )}>
                    {isExpense ? '-' : '+'}{formatCurrency(tx.amount)}
                  </div>
                  <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleEdit(tx); }}
                      className="p-2 text-slate-400 hover:text-indigo-500 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                      title="Edit transaction"
                    >
                      <Pencil size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ id: tx.id, type: 'transaction', data: tx }); }}
                      className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                      title="Delete transaction"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      <ConfirmModal
        isOpen={!!deleteConfirm}
        title={deleteConfirm?.type === 'recurring' ? 'Stop Recurring?' : 'Delete Transaction?'}
        message={deleteConfirm?.type === 'recurring' 
          ? 'Stop this recurring transaction? Future transactions will not be generated.' 
          : 'Are you sure you want to delete this transaction? This will also update your account balance.'}
        confirmText="Delete"
        onConfirm={() => {
          if (deleteConfirm?.type === 'recurring') {
            handleDeleteRecurring(deleteConfirm.id);
          } else if (deleteConfirm?.type === 'transaction') {
            handleDelete(deleteConfirm.data);
          }
        }}
        onCancel={() => setDeleteConfirm(null)}
      />

      {/* Mock-up Accompanying Single Transaction Invoice Modal */}
      <AnimatePresence>
        {activeInvoiceTx && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-[2.5rem] max-w-sm sm:max-w-md w-full shadow-2xl relative overflow-hidden p-6 border border-slate-100 dark:border-slate-800"
            >
              <button 
                onClick={() => setActiveInvoiceTx(null)}
                className="absolute right-5 top-5 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>

              {/* Status Graphic Checkmark */}
              <div className="flex flex-col items-center text-center mt-4">
                <div className={cn(
                  "w-14 h-14 rounded-full flex items-center justify-center mb-4 shadow-sm",
                  activeInvoiceTx.type === 'expense' ? "bg-red-50 dark:bg-red-500/10 text-red-500" : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500"
                )}>
                  <CheckCircle2 size={32} />
                </div>
                
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 tracking-wider uppercase mb-1">
                  {activeInvoiceTx.type === 'expense' ? 'You paid (ব্যয় পরিশোধিত)' : 'You received (আয় অর্জিত)'}
                </span>

                <h3 className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                  {formatCurrency(activeInvoiceTx.amount)}
                </h3>

                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  {format(new Date(activeInvoiceTx.date), 'PPPP')}
                </p>
              </div>

              {/* Invoice details body */}
              <div className="mt-8 space-y-4">
                <h4 className="text-xs font-bold text-slate-450 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">
                  Invoice details / রসিদ বিবরণী
                </h4>

                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-400 font-semibold dark:text-slate-500">Status</span>
                    <span className="text-emerald-500 font-bold flex items-center gap-1">
                      <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      Settled (সম্পন্ন)
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-400 font-semibold dark:text-slate-500">Transaction ID</span>
                    <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                      TXN-00{activeInvoiceTx.id}-HEX
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-400 font-semibold dark:text-slate-500">Category</span>
                    <span className="text-slate-700 dark:text-slate-300 font-semibold">
                      {allCategories.find((c: any) => c.id === activeInvoiceTx.categoryId)?.name || 'Uncategorized'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-400 font-semibold dark:text-slate-500">Account Wallet</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                      {accounts.find((a: any) => a.id === activeInvoiceTx.accountId)?.name || 'Default Cash'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-400 font-semibold dark:text-slate-500">Reference type</span>
                    <span className="text-slate-700 dark:text-slate-300 font-medium">
                      {activeInvoiceTx.type === 'expense' ? 'Expense Settled' : 'Credit Earned'}
                    </span>
                  </div>
                </div>

                {activeInvoiceTx.note && (
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs text-slate-500 italic">
                    "{activeInvoiceTx.note}"
                  </div>
                )}
              </div>

              {/* PDF download core launcher & close */}
              <div className="mt-8 space-y-2">
                <button
                  type="button"
                  onClick={() => handleDownloadSingleTxReceipt(activeInvoiceTx)}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-2xl font-bold transition-all active:scale-95 shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 flex items-center justify-center gap-2 text-sm"
                >
                  <Download size={18} />
                  Download PDF Invoice
                </button>
                <button
                  type="button"
                  onClick={() => setActiveInvoiceTx(null)}
                  className="w-full text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/45 py-3 rounded-xl font-bold transition-all text-sm"
                >
                  Close (বন্ধ করুন)
                </button>
              </div>

              {/* Watermark */}
              <div className="flex flex-col items-center justify-center mt-6 pt-4 border-t border-dashed border-slate-100 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 tracking-widest font-extrabold uppercase">
                  FinTrack secured ledger
                </span>
                <span className="text-[9px] text-slate-300 mt-1">
                  Terms of Service • Privacy Policy
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
