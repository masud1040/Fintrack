import { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, DebtType, DebtStatus, Debt } from '../db';
import { formatCurrency, cn, savePDF } from '../lib/utils';
import { setupPDFCustomFonts } from '../lib/pdfCustomFonts';
import { Card } from './ui/Card';
import { Plus, User, CheckCircle2, Circle, Trash2, Phone, MessageCircle, Download, Share2, X, Edit2, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { ConfirmModal } from './ui/ConfirmModal';
import { jsPDF } from 'jspdf';
import { generateHtmlPdf } from '../lib/htmlToPdfHelper';

export function Debts() {
  const { currentUser } = useAuth();
  const [isAdding, setIsAdding] = useState(false);
  const [person, setPerson] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<DebtType>('payable');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [activeTab, setActiveTab] = useState<'unpaid' | 'paid'>('unpaid');
  const [showReceipt, setShowReceipt] = useState<Debt | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [selectedDebtDetails, setSelectedDebtDetails] = useState<Debt | null>(null);
  const [isAddingRepayment, setIsAddingRepayment] = useState(false);
  const [repayAmount, setRepayAmount] = useState('');
  const [repayAccountId, setRepayAccountId] = useState<number | ''>('');
  const [repayDate, setRepayDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [repayNote, setRepayNote] = useState('');

  const debts = useLiveQuery(
    () => currentUser ? db.debts.where('userId').equals(currentUser.id!).reverse().sortBy('date') : [],
    [currentUser?.id]
  ) || [];

  const accounts = useLiveQuery(
    () => currentUser ? db.accounts.where('userId').equals(currentUser.id!).toArray() : [],
    [currentUser?.id]
  ) || [];

  const categories = useLiveQuery(
    () => currentUser ? db.categories.where('userId').equals(currentUser.id!).toArray() : [],
    [currentUser?.id]
  ) || [];

  const getSmsLink = (debt: Debt) => {
    if (!debt.phoneNumber) return '#';
    const amount = debt.amount;
    const counterpart = debt.person;
    const author = currentUser?.name || 'FinTrack User';
    
    let text = '';
    
    if (debt.type === 'receivable') {
      if (debt.status === 'unpaid') {
        text = `Dear ${counterpart}\nআপনার থেকে আমি ${amount} টাকা পাই অনুগ্রহ করে টাকা paid করুন।\n-${author}`;
      } else {
        text = `Dear ${counterpart}\nআপনি আমার ${amount} টাকা পরিশোধ করছেন।\n-${author}`;
      }
    } else {
      text = `Dear ${counterpart}\nআপনার ${amount} টাকা পরিশোধ করা হলো\n-${author}`;
    }
    
    const isIos = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const separator = isIos ? '&' : '?';
    return `sms:${debt.phoneNumber}${separator}body=${encodeURIComponent(text)}`;
  };

  const totalPayable = debts.filter(d => d.type === 'payable' && d.status === 'unpaid').reduce((sum, d) => sum + (d.remainingAmount !== undefined ? d.remainingAmount : d.amount), 0);
  const totalReceivable = debts.filter(d => d.type === 'receivable' && d.status === 'unpaid').reduce((sum, d) => sum + (d.remainingAmount !== undefined ? d.remainingAmount : d.amount), 0);

  const startEdit = (debt: Debt) => {
    setEditingDebt(debt);
    setPerson(debt.person);
    setAmount(String(debt.amount));
    setType(debt.type);
    setDate(format(new Date(debt.date), 'yyyy-MM-dd'));
    setDueDate(debt.dueDate ? format(new Date(debt.dueDate), 'yyyy-MM-dd') : '');
    setPhoneNumber(debt.phoneNumber || '');
    setWhatsappNumber(debt.whatsappNumber || '');
    setNote(debt.note || '');
    setIsAdding(true);
  };

  const handleCancelForm = () => {
    setEditingDebt(null);
    setPerson('');
    setAmount('');
    setType('payable');
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setDueDate('');
    setPhoneNumber('');
    setWhatsappNumber('');
    setNote('');
    setIsAdding(false);
  };

  const handleAddDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!person || !amount || !date || !currentUser?.id) return;

    const numAmount = Number(amount);
    let updatedRemaining = numAmount;
    let updatedStatus: DebtStatus = 'unpaid';

    if (editingDebt) {
      const totalPaid = (editingDebt.payments || []).reduce((sum, p) => sum + p.amount, 0);
      updatedRemaining = Math.max(0, numAmount - totalPaid);
      updatedStatus = updatedRemaining <= 0 ? 'paid' : 'unpaid';
    }

    const dataObj = {
      userId: currentUser.id,
      person,
      amount: numAmount,
      type,
      date: new Date(date),
      dueDate: dueDate ? new Date(dueDate) : undefined,
      note,
      phoneNumber: phoneNumber.trim(),
      whatsappNumber: whatsappNumber.trim(),
      remainingAmount: updatedRemaining,
      status: editingDebt ? updatedStatus : 'unpaid',
    };

    if (editingDebt && editingDebt.id) {
      await db.debts.update(editingDebt.id, dataObj);
    } else {
      await db.debts.add({
        ...dataObj,
        status: 'unpaid',
        remainingAmount: numAmount,
        payments: []
      });
    }

    handleCancelForm();
  };

  const handleDownloadPDFReceipt = async (debt: Debt) => {
    const nowOutput = format(new Date(), 'dd MMM yyyy, hh:mm a');
    const isPayable = debt.type === 'payable';
    const amountStr = formatCurrency(debt.amount);
    const dateStr = format(new Date(debt.date), 'dd MMMM yyyy');

    const htmlContent = `
      <div style="padding: 40px; background-color: #ffffff; color: #1e293b; font-family: 'Inter', system-ui, sans-serif; line-height: 1.5; font-size: 13px; max-width: 680px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px;">
          <div>
            <h1 style="font-size: 24px; font-weight: 850; color: #1e1b4b; margin: 0; tracking: -0.02em;">Payment Receipt</h1>
            <p style="font-size: 14px; font-weight: 500; color: #6366f1; margin: 4px 0 0 0; font-family: 'Hind Siliguri', sans-serif;">পরিশোধের রসিদ</p>
          </div>
          <div style="text-align: right;">
            <span style="font-weight: 800; color: #0f172a; font-size: 16px;">FinTrack</span>
            <p style="font-size: 11px; color: #64748b; margin: 2px 0 0 0;">Secure Debt Loop Registry</p>
          </div>
        </div>

        <!-- Main Banner with Total -->
        <div style="background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%); border: 1px solid #ddd6fe; border-radius: 12px; padding: 24px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <p style="font-size: 11px; font-weight: 700; color: #7c3aed; text-transform: uppercase; margin: 0; letter-spacing: 0.05em; font-family: 'Hind Siliguri', sans-serif;">
              ${isPayable ? 'YOU PAID (আপনি পরিশোধ করেছেন)' : 'YOU RECEIVED (আপনি আদায় করেছেন)'}
            </p>
            <h2 style="font-size: 32px; font-weight: 900; color: #1e1b4b; margin: 6px 0 0 0;">${amountStr}</h2>
          </div>
          <div style="text-align: right;">
            <p style="font-size: 11px; color: #64748b; margin: 0;">SETTLEMENT DATE</p>
            <p style="font-size: 13px; font-weight: 700; color: #1f2937; margin: 4px 0 0 0;">${dateStr}</p>
          </div>
        </div>

        <!-- Details Table style -->
        <h3 style="font-size: 14px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin: 0 0 12px 0; letter-spacing: 0.02em; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; font-family: 'Hind Siliguri', sans-serif;">
          INVOICE DETAILS (রসিদ বিবরণী)
        </h3>

        <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 30px;">
          <div style="display: flex; justify-content: space-between; padding-bottom: 8px; border-bottom: 1px solid #f1f5f9; font-size: 12px;">
            <span style="font-weight: 600; color: #64748b; font-family: 'Hind Siliguri', sans-serif;">Status (অবস্থা)</span>
            <span style="font-weight: 700; color: #10b981;">PROCESSED & SETTLED (সফলভাবে পরিশোধিত)</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding-bottom: 8px; border-bottom: 1px solid #f1f5f9; font-size: 12px;">
            <span style="font-weight: 600; color: #64748b; font-family: 'Hind Siliguri', sans-serif;">Receipt ID (রসিদ নং)</span>
            <span style="font-weight: 700; color: #1f2937;">REC-DEBT-00${debt.id || '9403'}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding-bottom: 8px; border-bottom: 1px solid #f1f5f9; font-size: 12px;">
            <span style="font-weight: 600; color: #64748b; font-family: 'Hind Siliguri', sans-serif;">Counterpart Person (ব্যক্তি)</span>
            <span style="font-weight: 700; color: #1f2937;">${debt.person}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding-bottom: 8px; border-bottom: 1px solid #f1f5f9; font-size: 12px;">
            <span style="font-weight: 600; color: #64748b; font-family: 'Hind Siliguri', sans-serif;">Type of Transaction (ধরণ)</span>
            <span style="font-weight: 700; color: #1f2937;">${isPayable ? 'Settled Payable (দেনা পরিশোধ)' : 'Settled Receivable (পাওনা আদায়)'}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding-bottom: 8px; border-bottom: 1px solid #f1f5f9; font-size: 12px;">
            <span style="font-weight: 600; color: #64748b; font-family: 'Hind Siliguri', sans-serif;">Registry Issuer (নিবন্ধক)</span>
            <span style="font-weight: 700; color: #1f2937;">${currentUser?.name || 'FinTrack User'}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding-bottom: 8px; border-bottom: 1px solid #f1f5f9; font-size: 12px;">
            <span style="font-weight: 600; color: #64748b; font-family: 'Hind Siliguri', sans-serif;">Date Printed (রসিদ তৈরীর সময়)</span>
            <span style="font-weight: 700; color: #1f2937;">${nowOutput}</span>
          </div>
        </div>

        <!-- Note Section -->
        ${debt.note ? `
          <div style="background-color: #fafafa; border: 1px solid #f0f0f0; border-radius: 8px; padding: 16px; margin-bottom: 40px;">
            <p style="font-size: 11px; font-weight: 700; color: #71717a; margin: 0 0 4px 0; text-transform: uppercase;">Note / বিবরণী</p>
            <p style="font-size: 13px; color: #3f3f46; font-style: italic; margin: 0; font-family: 'Hind Siliguri', sans-serif;">"${debt.note}"</p>
          </div>
        ` : ''}

        <!-- Footer -->
        <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center; font-size: 11px; color: #94a3b8; display: flex; flex-direction: column; gap: 4px;">
          <span>FinTrack secured digital ledger transaction statement. Generated with 256-bit indexing.</span>
          <span>Terms of Service and Privacy Policy apply. FinTrack © 2026. All rights reserved.</span>
        </div>
      </div>
    `;

    const safeFileName = `receipt_${debt.person.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`;
    await generateHtmlPdf(htmlContent, { fileName: safeFileName, isThermalReceipt: false });
  };

  const generateReceipt = (debt: Debt) => {
    // Keep canvas and regular PNG generation logic as fallback or alternative
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 600;
    canvas.height = 800;

    const gradient = ctx.createLinearGradient(0, 0, 0, 800);
    gradient.addColorStop(0, '#4f46e5');
    gradient.addColorStop(1, '#3730a3');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 600, 800);

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(40, 40, 520, 720, 30);
    ctx.fill();

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 32px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAYMENT RECEIPT', 300, 120);

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 160);
    ctx.lineTo(520, 160);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748b';
    ctx.font = '16px Inter, sans-serif';
    ctx.fillText('DATE', 80, 210);
    ctx.fillText('PERSON', 80, 290);
    ctx.fillText('TYPE', 80, 370);
    ctx.fillText('STATUS', 80, 450);

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 24px Inter, sans-serif';
    ctx.fillText(format(debt.date, 'MMMM d, yyyy'), 80, 245);
    ctx.fillText(debt.person, 80, 325);
    ctx.fillText(debt.type === 'payable' ? 'I Borrowed (দেনা)' : 'I Lent (পাওনা)', 80, 405);
    
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.roundRect(80, 465, 100, 40, 10);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.fillText('PAID', 105, 492);

    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.roundRect(80, 550, 440, 120, 20);
    ctx.fill();

    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.fillText('TOTAL AMOUNT', 110, 590);

    ctx.fillStyle = debt.type === 'payable' ? '#ef4444' : '#10b981';
    ctx.font = 'bold 48px Inter, sans-serif';
    ctx.fillText(formatCurrency(debt.amount), 110, 645);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'italic 16px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Thank you for the transaction!', 300, 720);
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText('Generated by Expense Tracker App', 300, 740);

    const link = document.createElement('a');
    link.download = `receipt-${debt.person}-${format(new Date(), 'yyyyMMdd')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const toggleStatus = async (debt: any) => {
    const newStatus: DebtStatus = debt.status === 'paid' ? 'unpaid' : 'paid';
    await db.debts.update(debt.id, { status: newStatus });
  };

  const handleDelete = async (id: number) => {
    await db.debts.delete(id);
  };

  const handleAddRepayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebtDetails || !repayAmount || !repayAccountId || !currentUser?.id) return;

    const repaymentAmt = Number(repayAmount);
    const selectedAcc = accounts.find(a => a.id === Number(repayAccountId));
    if (!selectedAcc) return;

    // 1. Update the Account Balance
    // If it's a receivable (lent): we receive money back (Income) -> Balance increases
    // If it's a payable (borrowed): we pay money back (Expense) -> Balance decreases
    const isReceivable = selectedDebtDetails.type === 'receivable';
    const newBalance = isReceivable 
      ? selectedAcc.currentBalance + repaymentAmt 
      : selectedAcc.currentBalance - repaymentAmt;

    await db.accounts.update(selectedAcc.id!, { currentBalance: newBalance });

    // 2. Add an automatic Transaction record of appropriate type
    const debtCat = categories.find(c => 
      c.type === (isReceivable ? 'income' : 'expense') && 
      (c.name.includes('ধার') || c.name.includes('Debt') || c.name.includes('Loan') || c.name.toLowerCase().includes('others') || c.name.toLowerCase().includes('অন্যান্য'))
    ) || categories[0];

    await db.transactions.add({
      userId: currentUser.id,
      amount: repaymentAmt,
      type: isReceivable ? 'income' : 'expense',
      categoryId: debtCat?.id || 1,
      accountId: selectedAcc.id!,
      date: new Date(repayDate),
      note: `Repayment received/made for: ${selectedDebtDetails.person} (${repayNote || 'N/A'})`
    });

    // 3. Update the Debt payments history
    const existingPayments = selectedDebtDetails.payments || [];
    const updatedPayments = [
      ...existingPayments,
      {
        amount: repaymentAmt,
        date: new Date(repayDate),
        note: repayNote,
        accountId: selectedAcc.id!
      }
    ];

    const currentTotalPaid = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
    const remaining = selectedDebtDetails.amount - currentTotalPaid;
    const isFullyPaid = remaining <= 0;

    await db.debts.update(selectedDebtDetails.id!, {
      payments: updatedPayments,
      remainingAmount: remaining >= 0 ? remaining : 0,
      status: isFullyPaid ? 'paid' : 'unpaid'
    });

    // Refresh details modal with updated information
    const updatedDebt = await db.debts.get(selectedDebtDetails.id!);
    if (updatedDebt) {
      setSelectedDebtDetails(updatedDebt);
    }

    // Reset payment form
    setRepayAmount('');
    setRepayAccountId('');
    setRepayDate(format(new Date(), 'yyyy-MM-dd'));
    setRepayNote('');
    setIsAddingRepayment(false);
  };

  if (!currentUser) {
    return (
      <div className="p-8 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-3xl mt-8">
        Please log in to manage your debts and loans.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Debit/Credit (দেনা পাওনা)</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            These records do not affect your main total balance.
          </p>
        </div>
        <button
          onClick={() => {
            if (isAdding && editingDebt) {
              handleCancelForm();
            } else {
              if (isAdding) {
                handleCancelForm();
              } else {
                setIsAdding(true);
              }
            }
          }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-medium transition-colors flex items-center gap-2 text-sm shadow-sm shrink-0"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">{editingDebt ? 'New Record' : 'Add Record'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-6 bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/20">
          <p className="text-red-600 dark:text-red-400 font-medium mb-2">Total Payable (দেনা)</p>
          <h3 className="text-3xl font-bold text-red-700 dark:text-red-300">
            {formatCurrency(totalPayable)}
          </h3>
        </Card>
        <Card className="p-6 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20">
          <p className="text-emerald-600 dark:text-emerald-400 font-medium mb-2">Total Receivable (পাওনা)</p>
          <h3 className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">
            {formatCurrency(totalReceivable)}
          </h3>
        </Card>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card className="p-6 mb-6">
              <form onSubmit={handleAddDebt} className="space-y-4">
                <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-full max-w-xs mx-auto mb-6">
                  <button
                    type="button"
                    onClick={() => setType('payable')}
                    className={cn(
                      "flex-1 py-2 text-sm font-medium rounded-lg transition-all",
                      type === 'payable' ? "bg-white dark:bg-slate-700 text-red-600 dark:text-red-400 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    )}
                  >
                    I Borrowed (দেনা)
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('receivable')}
                    className={cn(
                      "flex-1 py-2 text-sm font-medium rounded-lg transition-all",
                      type === 'receivable' ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    )}
                  >
                    I Lent (পাওনা)
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Person Name
                    </label>
                    <input
                      type="text"
                      value={person}
                      onChange={(e) => setPerson(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="e.g. John Doe"
                      required
                    />
                  </div>
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
                      Due Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Phone Number (Optional)
                    </label>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="e.g. 017XXXXXXXX"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      WhatsApp Number (Optional)
                    </label>
                    <input
                      type="tel"
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="e.g. 88017XXXXXXXX"
                    />
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
                      placeholder="Reason for loan/debt"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={handleCancelForm}
                    className="px-4 py-2 rounded-xl font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-medium transition-colors shadow-sm"
                  >
                    {editingDebt ? 'Update Record' : 'Save Record'}
                  </button>
                </div>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('unpaid')}
          className={cn(
            "px-6 py-3 text-sm font-medium transition-all relative",
            activeTab === 'unpaid' ? "text-indigo-600" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          Unpaid Records
          {activeTab === 'unpaid' && (
            <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('paid')}
          className={cn(
            "px-6 py-3 text-sm font-medium transition-all relative",
            activeTab === 'paid' ? "text-indigo-600" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          Paid History
          {activeTab === 'paid' && (
            <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
          )}
        </button>
      </div>

      <Card className="divide-y divide-slate-100 dark:divide-slate-800">
        {debts.filter(d => d.status === activeTab).length === 0 ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <User size={24} className="text-slate-400" />
            </div>
            <p className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-1">No {activeTab} records found</p>
            <p className="text-sm">Keep track of money you owe or are owed.</p>
          </div>
        ) : (
          debts.filter(d => d.status === activeTab).map(debt => {
            const isPayable = debt.type === 'payable';
            const isPaid = debt.status === 'paid';

            return (
              <div key={debt.id} className={cn(
                "p-4 flex flex-col sm:flex-row sm:items-center justify-between transition-colors group gap-4",
                isPaid ? "bg-slate-50/50 dark:bg-slate-900/50" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
              )}>
                <div className="flex items-center gap-4 flex-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleStatus(debt); }}
                    className={cn(
                      "p-1 rounded-full transition-colors shrink-0 z-10",
                      isPaid ? "text-emerald-500" : "text-slate-300 hover:text-indigo-500 dark:text-slate-600"
                    )}
                  >
                    {isPaid ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                  </button>
                  <div 
                    onClick={() => setSelectedDebtDetails(debt)} 
                    className="flex-1 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <p className={cn(
                        "font-semibold text-base hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors",
                        isPaid ? "text-slate-500 line-through" : "text-slate-900 dark:text-slate-100"
                      )}>
                        {debt.person}
                      </p>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {debt.phoneNumber && (
                          <>
                            <a
                              href={`tel:${debt.phoneNumber}`}
                              className="p-1.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-colors"
                              title="Call"
                            >
                              <Phone size={14} />
                            </a>
                            <a
                              href={getSmsLink(debt)}
                              className="p-1.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-colors"
                              title="Direct SMS"
                            >
                              <MessageSquare size={14} />
                            </a>
                          </>
                        )}
                        {debt.whatsappNumber && (
                          <a
                            href={`https://wa.me/${debt.whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(
                              debt.type === 'receivable'
                                ? (debt.status === 'unpaid'
                                  ? `Dear ${debt.person}\nআপনার থেকে আমি ${debt.amount} টাকা পাই অনুগ্রহ করে টাকা paid করুন।\n-${currentUser?.name || 'FinTrack User'}`
                                  : `Dear ${debt.person}\nআপনি আমার ${debt.amount} টাকা পরিশোধ করছেন।\n-${currentUser?.name || 'FinTrack User'}`)
                                : `Dear ${debt.person}\nআপনার ${debt.amount} টাকা পরিশোধ করা হলো\n-${currentUser?.name || 'FinTrack User'}`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition-colors"
                            title="WhatsApp"
                          >
                            <MessageCircle size={14} />
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full font-medium",
                        isPayable ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                      )}>
                        {isPayable ? 'You Owe' : 'Owed to You'}
                      </span>
                      <span>•</span>
                      <span>{format(debt.date, 'MMM d, yyyy')}</span>
                      {debt.dueDate && (
                        <>
                          <span>•</span>
                          <span className={cn(
                            "font-bold",
                            new Date(debt.dueDate) < new Date() && debt.status === 'unpaid' ? "text-red-500" : "text-indigo-500"
                          )}>
                            Due: {format(debt.dueDate, 'MMM d, yyyy')}
                          </span>
                        </>
                      )}
                    </div>
                    {debt.note && (
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 italic">
                        "{debt.note}"
                      </p>
                    )}
                  </div>
                </div>
                 <div className="flex items-center justify-between sm:justify-end gap-4">
                  <div className="text-right">
                    <div className={cn(
                      "font-bold text-lg",
                      isPaid ? "text-slate-500" : (isPayable ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400")
                    )}>
                      {formatCurrency(debt.remainingAmount !== undefined ? debt.remainingAmount : debt.amount)}
                    </div>
                    {!isPaid && debt.remainingAmount !== undefined && debt.remainingAmount < debt.amount && (
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                        Original: {formatCurrency(debt.amount)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startEdit(debt)}
                      className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                      title="Edit"
                    >
                      <Edit2 size={18} />
                    </button>
                    {isPaid && (
                      <button
                        onClick={() => setShowReceipt(debt)}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-colors"
                        title="View Receipt"
                      >
                        <Download size={18} />
                      </button>
                    )}
                    <button
                      onClick={() => setDeleteId(debt.id!)}
                      className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </Card>

      <ConfirmModal
        isOpen={!!deleteId}
        title="Delete Record?"
        message="Are you sure you want to delete this record? This action cannot be undone."
        confirmText="Delete"
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
      />

      {/* Mock-up Accompanying Interactive Settlement Receipt Modal */}
      <AnimatePresence>
        {showReceipt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-[2.5rem] max-w-sm sm:max-w-md w-full shadow-2xl relative overflow-hidden p-6 border border-slate-100 dark:border-slate-800"
            >
              <button 
                onClick={() => setShowReceipt(null)}
                className="absolute right-5 top-5 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>

              {/* Status Graphic Checkmark */}
              <div className="flex flex-col items-center text-center mt-4">
                <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-4 shadow-sm">
                  <CheckCircle2 size={32} />
                </div>
                
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 tracking-wider uppercase mb-1">
                  {showReceipt.type === 'payable' ? 'You paid (পরিশোধিত)' : 'You received (আদায়কৃত)'}
                </span>

                <h3 className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                  {formatCurrency(showReceipt.amount)}
                </h3>

                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  {format(new Date(showReceipt.date), 'PPPP')}
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
                      Processed (সম্পন্ন)
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-400 font-semibold dark:text-slate-500">Receipt ID</span>
                    <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                      REC-DEBT-00{showReceipt.id}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-400 font-semibold dark:text-slate-500">Account category</span>
                    <span className="text-slate-700 dark:text-slate-300 font-semibold">
                      Personal Debt Ledger
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-400 font-semibold dark:text-slate-500">Person</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                      {showReceipt.person}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-400 font-semibold dark:text-slate-500">Reference type</span>
                    <span className="text-slate-700 dark:text-slate-300 font-medium">
                      {showReceipt.type === 'payable' ? 'Owed Settlement' : 'Lent Collection'}
                    </span>
                  </div>
                </div>

                {showReceipt.note && (
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs text-slate-500 italic">
                    "{showReceipt.note}"
                  </div>
                )}
              </div>

              {/* PDF download core launcher & close */}
              <div className="mt-8 space-y-2">
                <button
                  onClick={() => handleDownloadPDFReceipt(showReceipt)}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-2xl font-bold transition-all active:scale-95 shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 flex items-center justify-center gap-2 text-sm"
                >
                  <Download size={18} />
                  Download PDF Receipt
                </button>
                <button
                  onClick={() => setShowReceipt(null)}
                  className="w-full text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/45 py-3 rounded-xl font-bold transition-all text-sm"
                >
                  Close (বন্ধ করুন)
                </button>
              </div>

              {/* Subtle branding matching bottom Tilia watermark */}
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

      {/* Detailed Person Debt Card details overlay */}
      <AnimatePresence>
        {selectedDebtDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-950 rounded-[2.5rem] max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl relative border border-slate-100 dark:border-slate-800 p-6 md:p-8 custom-scrollbar"
            >
              {/* Close Button */}
              <button 
                onClick={() => { setSelectedDebtDetails(null); setIsAddingRepayment(false); }}
                className="absolute right-6 top-6 p-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={18} />
              </button>

              {/* Avatar and Person Name */}
              <div className="flex items-center gap-4 mb-6 border-b border-slate-100 dark:border-slate-800 pb-5">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold text-2xl flex items-center justify-center shadow-sm shrink-0">
                  {selectedDebtDetails.person.trim().charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white leading-tight font-sans">
                    {selectedDebtDetails.person}
                  </h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1.5 font-medium">
                    <span className={cn(
                      "w-2 h-2 rounded-full inline-block",
                      selectedDebtDetails.type === 'receivable' ? "bg-emerald-500" : "bg-red-500"
                    )} />
                    {selectedDebtDetails.type === 'receivable' ? 'Lent (ধারে দিয়েছি)' : 'Borrowed (ধারে নিয়েছি)'}
                    • Status: {selectedDebtDetails.status === 'paid' ? 'Paid (পরিশোধিত)' : 'Unpaid (বাকি আছে)'}
                  </p>
                </div>
              </div>

              {/* Bento Grid Summary statistics */}
              {(() => {
                const totalAmount = selectedDebtDetails.amount;
                const totalPaid = selectedDebtDetails.status === 'paid' 
                  ? totalAmount 
                  : (selectedDebtDetails.payments?.reduce((sum, p) => sum + p.amount, 0) || 0);
                const rAmount = selectedDebtDetails.status === 'paid' 
                  ? 0 
                  : (selectedDebtDetails.remainingAmount !== undefined ? selectedDebtDetails.remainingAmount : (totalAmount - totalPaid));
                const paymentsCount = selectedDebtDetails.payments?.length || 0;
                const lastPayment = selectedDebtDetails.payments && selectedDebtDetails.payments.length > 0 
                  ? format(new Date(selectedDebtDetails.payments[selectedDebtDetails.payments.length - 1].date), 'dd MMM yyyy') 
                  : 'N/A';

                return (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                        <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Total Loan (মোট ধার)</span>
                        <span className="text-lg font-black text-slate-900 dark:text-white font-mono">{formatCurrency(totalAmount)}</span>
                      </div>
                      <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                        <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Total Repaid (মোট পরিশোধিত)</span>
                        <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">{formatCurrency(totalPaid)}</span>
                      </div>
                      <div className="p-4 rounded-3xl bg-amber-55/65 dark:bg-amber-950/10 border border-amber-100/30 dark:border-amber-950/10 col-span-2">
                        <span className="text-[11px] font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider block mb-1">Remaining Balance (বাকি ঋণ)</span>
                        <span className="text-2xl font-black text-amber-700 dark:text-amber-400 font-mono">{formatCurrency(rAmount)}</span>
                      </div>
                    </div>

                    {/* Meta Indicators row */}
                    <div className="flex justify-between items-center bg-slate-50/60 dark:bg-slate-905/40 p-3 rounded-2xl border border-slate-100/50 dark:border-slate-900 text-xs text-slate-500 dark:text-slate-400 font-medium">
                      <span>Repayments (পরিশোধ সংখ্যা): <strong className="text-slate-800 dark:text-slate-200 font-bold">{paymentsCount} বার</strong></span>
                      <span>Last Activity: <strong className="text-slate-800 dark:text-slate-200 font-bold">{lastPayment}</strong></span>
                    </div>

                    {/* Timeline Transaction History (আয়-ব্যয় লেনদেন ইতিহাস) */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-black uppercase tracking-widest text-slate-405 dark:text-slate-500 border-b border-slate-105 dark:border-slate-800 pb-2 flex items-center justify-between font-sans">
                        <span>Transaction History (লেনদেন বিবরণী)</span>
                        {selectedDebtDetails.phoneNumber && (
                          <span className="font-mono text-[10px] text-slate-400 dark:text-slate-600 normal-case">Contact: {selectedDebtDetails.phoneNumber}</span>
                        )}
                      </h4>

                      <div className="relative pl-6 space-y-4 max-h-[160px] overflow-y-auto custom-scrollbar pr-2 py-1">
                        {/* Vertical Timeline line */}
                        <div className="absolute left-2.5 top-2.5 bottom-2.5 w-0.5 bg-slate-100 dark:bg-slate-800" />

                        {/* First node: Creation */}
                        <div className="relative">
                          {/* Circle dot marker */}
                          <div className={cn(
                            "absolute -left-[20px] top-1.5 w-2.5 h-2.5 rounded-full ring-4",
                            selectedDebtDetails.type === 'receivable' ? "bg-emerald-500 ring-emerald-50 dark:ring-emerald-950" : "bg-red-500 ring-red-50 dark:ring-red-950"
                          )} />
                          <div className="text-xs">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-slate-805 dark:text-slate-200">
                                {selectedDebtDetails.type === 'receivable' ? 'Lent Loan Initiated' : 'Borrowed Loan Initiated'}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">{format(new Date(selectedDebtDetails.date), 'dd MMM yyyy')}</span>
                            </div>
                            <span className="text-[11px] text-slate-500 font-bold">Principal: {formatCurrency(selectedDebtDetails.amount)}</span>
                            {selectedDebtDetails.note && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 italic">"{selectedDebtDetails.note}"</p>}
                          </div>
                        </div>

                        {/* Payment history nodes */}
                        {selectedDebtDetails.payments?.map((payment, pIdx) => {
                          const pmAccount = accounts.find(a => a.id === payment.accountId);
                          return (
                            <div key={pIdx} className="relative">
                              {/* Circle dot marker */}
                              <div className="absolute -left-[20px] top-1.5 w-2.5 h-2.5 rounded-full bg-indigo-500 ring-4 ring-indigo-50 dark:ring-indigo-950" />
                              <div className="text-xs">
                                <div className="flex justify-between items-center">
                                  <span className="font-bold text-slate-800 dark:text-slate-200">
                                    Repayment Installment ({pIdx + 1})
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono">{format(new Date(payment.date), 'dd MMM yyyy')}</span>
                                </div>
                                <div className="flex justify-between text-[11px] mt-0.5">
                                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">+{formatCurrency(payment.amount)}</span>
                                  {pmAccount && <span className="text-slate-400 font-medium font-mono">via {pmAccount.name}</span>}
                                </div>
                                {payment.note && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 italic">"{payment.note}"</p>}
                              </div>
                            </div>
                          );
                        })}

                        {(!selectedDebtDetails.payments || selectedDebtDetails.payments.length === 0) && (
                          <div className="text-xs text-slate-400 dark:text-slate-500 py-2 italic text-center">
                            No partial repayments have been registered. (কোনো আংশিক পরিশোধ করা হয়নি)
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Add Partial Repayment Form Trigger */}
                    {selectedDebtDetails.status === 'unpaid' && (
                      <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                        {!isAddingRepayment ? (
                          <button
                            type="button"
                            onClick={() => setIsAddingRepayment(true)}
                            className="w-full bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 py-3 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-300 transition-all flex items-center justify-center gap-2"
                          >
                            <Plus size={14} /> Add Partial Payment (আংশিক পরিশোধ যোগ করুন)
                          </button>
                        ) : (
                          <form onSubmit={handleAddRepayment} className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-3xl border border-slate-200/50 dark:border-slate-850 space-y-3">
                            <h5 className="text-xs font-black text-slate-800 dark:text-slate-205 uppercase">New Repayment Details</h5>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">Repay Amount</label>
                                <input
                                  type="number"
                                  value={repayAmount}
                                  onChange={(e) => setRepayAmount(e.target.value)}
                                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-indigo-500 outline-none"
                                  placeholder="0.00"
                                  max={rAmount}
                                  step="0.01"
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">Account Paid To/From</label>
                                <select
                                  value={repayAccountId}
                                  onChange={(e) => setRepayAccountId(e.target.value ? Number(e.target.value) : '')}
                                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-indigo-500 outline-none"
                                  required
                                >
                                  <option value="">Select Account</option>
                                  {accounts.map(acc => (
                                    <option key={acc.id} value={acc.id}>{acc.name} (${acc.currentBalance})</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">Repay Date</label>
                                <input
                                  type="date"
                                  value={repayDate}
                                  onChange={(e) => setRepayDate(e.target.value)}
                                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-indigo-500 outline-none"
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">Note / Reference</label>
                                <input
                                  type="text"
                                  value={repayNote}
                                  onChange={(e) => setRepayNote(e.target.value)}
                                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-indigo-500 outline-none"
                                  placeholder="installment info"
                                />
                              </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                              <button
                                type="button"
                                onClick={() => setIsAddingRepayment(false)}
                                className="px-3 py-1.5 text-[11px] font-bold text-slate-505 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                className="px-4 py-1.5 text-[11px] font-black bg-indigo-600 text-white rounded-xl shadow-sm hover:bg-indigo-700"
                              >
                                Submit Payment
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    )}

                    {/* Action buttons (Download statement receipt or close) */}
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setSelectedDebtDetails(null)}
                        className="w-full bg-slate-900 hover:bg-slate-850 dark:bg-indigo-650 dark:hover:bg-indigo-700 text-white py-3.5 rounded-2xl font-bold transition-all text-xs"
                      >
                        Done (সম্পন্ন)
                      </button>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hidden Canvas for Receipt Generation */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
