import { format } from 'date-fns';
import { db } from '../db';
import { formatCurrency } from './utils';
import { generateHtmlPdf } from './htmlToPdfHelper';

/**
 * Minimal & Professional Executive Overall Wealth & Debt Summary Report
 */
export async function generatePDFReport(
  userId: number | string, 
  userName: string,
  phoneNumber?: string,
  companyName?: string
) {
  const transactions = await db.transactions.where('userId').equals(userId).reverse().sortBy('date');
  const categories = await db.categories.where('userId').equals(userId).toArray();
  const debts = await db.debts.where('userId').equals(userId).toArray();
  const accounts = await db.accounts.where('userId').equals(userId).toArray();

  let totalIncome = 0;
  let totalExpense = 0;
  transactions.forEach(tx => {
    if (tx.type === 'income') {
      totalIncome += tx.amount;
    } else {
      totalExpense += tx.amount;
    }
  });

  const netBalance = totalIncome - totalExpense;
  const currentTotalAccountBalance = accounts.reduce((sum, acc) => sum + (acc.currentBalance || 0), 0);
  const recentTxs = transactions.slice(0, 20);

  const htmlContent = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Hind+Siliguri:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
      * { box-sizing: border-box; }
    </style>
    <div style="padding: 36px 40px; background-color: #ffffff; font-family: 'Inter', 'Hind Siliguri', sans-serif; color: #0f172a; max-width: 794px; margin: 0 auto; box-sizing: border-box; line-height: 1.5;">
      
      <!-- Minimalist Executive Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 24px; border-bottom: 1.5px solid #e2e8f0; margin-bottom: 24px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 38px; height: 38px; background-color: #0f172a; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #ffffff; font-weight: 900; font-size: 16px; letter-spacing: -0.05em;">
            FT
          </div>
          <div>
            <div style="font-size: 18px; font-weight: 900; letter-spacing: -0.02em; color: #0f172a;">FinTrack</div>
            <div style="font-size: 10.5px; color: #64748b; font-weight: 500;">Financial Ledger & Wealth Management</div>
          </div>
        </div>
        
        <div style="text-align: right;">
          <div style="font-size: 14px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.04em;">PORTFOLIO SUMMARY</div>
          <div style="font-size: 11px; color: #64748b; font-weight: 500; margin-top: 2px;">সার্বিক আর্থিক স্থিতি ও বিবরণী</div>
          <div style="font-size: 10px; color: #94a3b8; margin-top: 4px;">Issued: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}</div>
        </div>
      </div>

      <!-- Account Holder & Metadata Box -->
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; font-size: 12px; margin-bottom: 24px;">
        <div>
          <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Account Holder / বিবরণী প্রাপক</div>
          <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 2px;">${userName}</div>
          ${phoneNumber ? `<div style="font-size: 11px; color: #475569; margin-top: 1px;">ফোন: ${phoneNumber}</div>` : ''}
          ${companyName ? `<div style="font-size: 11px; color: #475569; margin-top: 1px;">প্রতিষ্ঠান: ${companyName}</div>` : ''}
        </div>
        <div style="text-align: right;">
          <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Reporting Period</div>
          <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-top: 2px;">All-Time Cumulative Summary</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 1px;">সর্বমোট লেনদেন: ${transactions.length} টি</div>
        </div>
      </div>

      <!-- Executive KPI Cards -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 28px;">
        <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px;">
          <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">মোট আয় (Income)</div>
          <div style="font-size: 16px; font-weight: 800; color: #059669; margin-top: 4px; font-family: 'Inter', sans-serif;">+${formatCurrency(totalIncome)}</div>
          <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">সর্বমোট সংগৃহীত আয়</div>
        </div>

        <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px;">
          <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">মোট ব্যয় (Expense)</div>
          <div style="font-size: 16px; font-weight: 800; color: #dc2626; margin-top: 4px; font-family: 'Inter', sans-serif;">-${formatCurrency(totalExpense)}</div>
          <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">সর্বমোট মোট খরচ</div>
        </div>

        <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px;">
          <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">নিট উদ্বৃত্ত (Net Flow)</div>
          <div style="font-size: 16px; font-weight: 800; color: ${netBalance >= 0 ? '#0f172a' : '#dc2626'}; margin-top: 4px; font-family: 'Inter', sans-serif;">${netBalance >= 0 ? '+' : ''}${formatCurrency(netBalance)}</div>
          <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">আয় - ব্যয় স্থিতি</div>
        </div>

        <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px;">
          <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">বর্তমান মোট তহবিল</div>
          <div style="font-size: 16px; font-weight: 800; color: #2563eb; margin-top: 4px; font-family: 'Inter', sans-serif;">${formatCurrency(currentTotalAccountBalance)}</div>
          <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">হিসাবসমূহের স্থিতি</div>
        </div>
      </div>

      <!-- Recent Transactions Section -->
      <div style="margin-bottom: 28px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div style="font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em;">
            Recent Transactions (সাম্প্রতিক লেনদেনসমূহ)
          </div>
          <div style="font-size: 10.5px; color: #64748b;">সর্বশেষ ২০টি রেকর্ড</div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
          <thead>
            <tr style="background-color: #f8fafc; color: #475569; font-weight: 700; border-bottom: 1.5px solid #e2e8f0;">
              <th style="padding: 10px 12px; width: 40px; text-align: center;">SL</th>
              <th style="padding: 10px 12px; width: 95px;">Date (তারিখ)</th>
              <th style="padding: 10px 12px;">Description & Note (বিবরণ ও নোট)</th>
              <th style="padding: 10px 12px; width: 130px;">Category (ক্যাটাগরি)</th>
              <th style="padding: 10px 12px; width: 120px; text-align: right;">Amount (টাকা)</th>
            </tr>
          </thead>
          <tbody>
            ${recentTxs.map((tx, idx) => {
              const cat = categories.find(c => c.id === tx.categoryId);
              const isInc = tx.type === 'income';
              return `
                <tr style="border-bottom: 1px solid #f1f5f9; background-color: ${idx % 2 === 1 ? '#fafafa' : '#ffffff'};">
                  <td style="padding: 9px 12px; text-align: center; color: #94a3b8; font-size: 10.5px;">${idx + 1}</td>
                  <td style="padding: 9px 12px; color: #475569; font-weight: 500;">${format(new Date(tx.date), 'dd MMM yyyy')}</td>
                  <td style="padding: 9px 12px; color: #0f172a; font-weight: 500; font-family: 'Hind Siliguri', sans-serif;">${tx.note || '-'}</td>
                  <td style="padding: 9px 12px;">
                    <span style="display: inline-block; padding: 2px 6px; background-color: #f1f5f9; color: #475569; border-radius: 4px; font-size: 10px; font-weight: 600; font-family: 'Hind Siliguri', sans-serif;">
                      ${cat?.name || 'General'}
                    </span>
                  </td>
                  <td style="padding: 9px 12px; text-align: right; font-weight: 700; color: ${isInc ? '#059669' : '#dc2626'}; font-family: 'Inter', sans-serif;">
                    ${isInc ? '+' : '-'}${formatCurrency(tx.amount)}
                  </td>
                </tr>
              `;
            }).join('')}
            ${recentTxs.length === 0 ? `
              <tr>
                <td colspan="5" style="padding: 24px; text-align: center; color: #94a3b8; font-style: italic;">কোন লেনদেন পাওয়া যায়নি।</td>
              </tr>
            ` : ''}
          </tbody>
        </table>
      </div>

      <!-- Debts and Liabilities Section -->
      ${debts.length > 0 ? `
        <div style="margin-bottom: 28px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div style="font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em;">
              Debts & Liabilities Summary (দেনা-পাওনা বিবরণী)
            </div>
            <div style="font-size: 10.5px; color: #64748b;">মোট ${debts.length} টি এন্ট্রি</div>
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
            <thead>
              <tr style="background-color: #f8fafc; color: #475569; font-weight: 700; border-bottom: 1.5px solid #e2e8f0;">
                <th style="padding: 10px 12px; width: 40px; text-align: center;">SL</th>
                <th style="padding: 10px 12px;">Person (ব্যক্তি / প্রতিষ্ঠান)</th>
                <th style="padding: 10px 12px; width: 130px;">Type (ধরণ)</th>
                <th style="padding: 10px 12px; width: 110px;">Status (অবস্থা)</th>
                <th style="padding: 10px 12px; width: 130px; text-align: right;">Amount (টাকা)</th>
              </tr>
            </thead>
            <tbody>
              ${debts.map((d, index) => {
                const isReceivable = d.type === 'receivable';
                const isPaid = d.status === 'paid';
                return `
                  <tr style="border-bottom: 1px solid #f1f5f9; background-color: ${index % 2 === 1 ? '#fafafa' : '#ffffff'};">
                    <td style="padding: 9px 12px; text-align: center; color: #94a3b8; font-size: 10.5px;">${index + 1}</td>
                    <td style="padding: 9px 12px; font-weight: 600; color: #0f172a; font-family: 'Hind Siliguri', sans-serif;">${d.person}</td>
                    <td style="padding: 9px 12px;">
                      <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; background-color: ${isReceivable ? '#eff6ff' : '#fef2f2'}; color: ${isReceivable ? '#1d4ed8' : '#b91c1c'};">
                        ${isReceivable ? 'পাবো (Receivable)' : 'দেব (Payable)'}
                      </span>
                    </td>
                    <td style="padding: 9px 12px; font-weight: 600; font-size: 10.5px; color: ${isPaid ? '#059669' : '#d97706'};">
                      ${isPaid ? 'পরিশোধিত (Paid)' : 'বাকি (Unpaid)'}
                    </td>
                    <td style="padding: 9px 12px; text-align: right; font-weight: 700; color: #0f172a; font-family: 'Inter', sans-serif;">${formatCurrency(d.amount)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}

      <!-- Clean Minimal Footer -->
      <div style="margin-top: 36px; padding-top: 18px; border-top: 1.5px solid #e2e8f0; display: flex; justify-content: space-between; align-items: flex-end; font-size: 10.5px; color: #94a3b8;">
        <div>
          <div style="font-weight: 600; color: #64748b;">FinTrack Wealth Platform • Confidential Statement</div>
          <div style="margin-top: 2px;">Document Hash: BDT-${format(new Date(), 'yyyyMMdd')}-SUM-REPORT</div>
        </div>
        <div style="text-align: right;">
          <div style="color: #64748b; font-weight: 600;">Verified Digital Ledger Record</div>
          <div style="margin-top: 2px;">Page 1 of 1</div>
        </div>
      </div>

    </div>
  `;

  const safeFileName = `FinTrack_Summary_Report_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
  await generateHtmlPdf(htmlContent, { fileName: safeFileName, isThermalReceipt: false });
}

/**
 * Highly Polished, Minimalist & Professional Monthly Financial Statement
 */
export async function generateMonthlyPDFReport(
  userId: number | string,
  userName: string,
  userEmail: string,
  year: number,
  month: number, // 1-12
  phoneNumber?: string,
  companyName?: string
) {
  const allTransactions = await db.transactions.where('userId').equals(userId).toArray();
  const filteredTransactions = allTransactions.filter(tx => {
    const txDate = new Date(tx.date);
    return txDate.getFullYear() === year && (txDate.getMonth() + 1) === month;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const categories = await db.categories.where('userId').equals(userId).toArray();
  const accounts = await db.accounts.where('userId').equals(userId).toArray();

  const incomeItems = filteredTransactions.filter(tx => tx.type === 'income');
  const expenseItems = filteredTransactions.filter(tx => tx.type === 'expense');

  let totalIncome = 0;
  let totalExpense = 0;

  incomeItems.forEach(tx => { totalIncome += tx.amount; });
  expenseItems.forEach(tx => { totalExpense += tx.amount; });

  const netBalance = totalIncome - totalExpense;
  const currentTotalAccountBalance = accounts.reduce((sum, acc) => sum + (acc.currentBalance || 0), 0);

  const monthNamesEng = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthNamesBng = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
  const periodStr = `${monthNamesEng[month - 1]} ${year} (${monthNamesBng[month - 1]} ${year})`;

  const htmlContent = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Hind+Siliguri:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
      * { box-sizing: border-box; }
    </style>
    <div style="padding: 36px 40px; background-color: #ffffff; font-family: 'Inter', 'Hind Siliguri', sans-serif; color: #0f172a; max-width: 794px; margin: 0 auto; box-sizing: border-box; line-height: 1.5;">
      
      <!-- Minimalist Executive Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 24px; border-bottom: 1.5px solid #e2e8f0; margin-bottom: 24px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 38px; height: 38px; background-color: #0f172a; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #ffffff; font-weight: 900; font-size: 16px; letter-spacing: -0.05em;">
            FT
          </div>
          <div>
            <div style="font-size: 18px; font-weight: 900; letter-spacing: -0.02em; color: #0f172a;">FinTrack</div>
            <div style="font-size: 10.5px; color: #64748b; font-weight: 500;">Financial Statement & Account Audit</div>
          </div>
        </div>
        
        <div style="text-align: right;">
          <div style="font-size: 14px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.04em;">MONTHLY STATEMENT</div>
          <div style="font-size: 11px; color: #64748b; font-weight: 500; margin-top: 2px;">মাসিক অর্থনৈতিক আয়-ব্যয় প্রতিবেদন</div>
          <div style="font-size: 10px; color: #94a3b8; margin-top: 4px;">Issued: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}</div>
        </div>
      </div>

      <!-- Account Holder & Metadata Box -->
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; font-size: 12px; margin-bottom: 24px;">
        <div>
          <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Account Holder / হিসাবধারী</div>
          <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 2px;">${userName}</div>
          ${userEmail ? `<div style="font-size: 11px; color: #64748b; margin-top: 1px;">${userEmail}</div>` : ''}
          ${phoneNumber ? `<div style="font-size: 11px; color: #475569; margin-top: 1px;">ফোন: ${phoneNumber}</div>` : ''}
          ${companyName ? `<div style="font-size: 11px; color: #475569; margin-top: 1px;">প্রতিষ্ঠান: ${companyName}</div>` : ''}
        </div>
        <div style="text-align: right;">
          <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Statement Period / সময়কাল</div>
          <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 2px; font-family: 'Hind Siliguri', sans-serif;">${periodStr}</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 1px;">মোট লেনদেন: ${filteredTransactions.length} টি</div>
        </div>
      </div>

      <!-- 4 Highlight KPI Summary Cards -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 28px;">
        <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px;">
          <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">মাসের মোট আয়</div>
          <div style="font-size: 16px; font-weight: 800; color: #059669; margin-top: 4px; font-family: 'Inter', sans-serif;">+${formatCurrency(totalIncome)}</div>
          <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">${incomeItems.length} টি আয়ের উৎস</div>
        </div>

        <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px;">
          <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">মাসের মোট ব্যয়</div>
          <div style="font-size: 16px; font-weight: 800; color: #dc2626; margin-top: 4px; font-family: 'Inter', sans-serif;">-${formatCurrency(totalExpense)}</div>
          <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">${expenseItems.length} টি ব্যয়ের খাত</div>
        </div>

        <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px;">
          <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">মাসের নিট সঞ্চয় / স্থিতি</div>
          <div style="font-size: 16px; font-weight: 800; color: ${netBalance >= 0 ? '#0f172a' : '#dc2626'}; margin-top: 4px; font-family: 'Inter', sans-serif;">${netBalance >= 0 ? '+' : ''}${formatCurrency(netBalance)}</div>
          <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">আয় - ব্যয় উদ্বৃত্ত</div>
        </div>

        <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px;">
          <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">বর্তমান মোট তহবিল</div>
          <div style="font-size: 16px; font-weight: 800; color: #2563eb; margin-top: 4px; font-family: 'Inter', sans-serif;">${formatCurrency(currentTotalAccountBalance)}</div>
          <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">সব একাউন্টে জমা টাকা</div>
        </div>
      </div>

      <!-- Income Table Section -->
      <div style="margin-bottom: 28px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <div style="font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 6px;">
            <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: #059669;"></span>
            Income Breakdown (আয়ের খাত ও বিবরণী)
          </div>
          <div style="font-size: 11px; font-weight: 700; color: #059669;">মোট: +${formatCurrency(totalIncome)}</div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
          <thead>
            <tr style="background-color: #f8fafc; color: #475569; font-weight: 700; border-bottom: 1.5px solid #e2e8f0;">
              <th style="padding: 9px 12px; width: 40px; text-align: center;">SL</th>
              <th style="padding: 9px 12px; width: 90px;">Date (তারিখ)</th>
              <th style="padding: 9px 12px; width: 140px;">Category (ক্যাটাগরি)</th>
              <th style="padding: 9px 12px;">Description / Note (বিবরণ ও নোট)</th>
              <th style="padding: 9px 12px; width: 120px; text-align: right;">Amount (টাকা)</th>
            </tr>
          </thead>
          <tbody>
            ${incomeItems.map((tx, idx) => {
              const cat = categories.find(c => c.id === tx.categoryId);
              return `
                <tr style="border-bottom: 1px solid #f1f5f9; background-color: ${idx % 2 === 1 ? '#fafafa' : '#ffffff'};">
                  <td style="padding: 8px 12px; text-align: center; color: #94a3b8; font-size: 10.5px;">${idx + 1}</td>
                  <td style="padding: 8px 12px; color: #475569; font-weight: 500;">${format(new Date(tx.date), 'dd MMM yyyy')}</td>
                  <td style="padding: 8px 12px;">
                    <span style="display: inline-block; padding: 2px 6px; background-color: #ecfdf5; color: #065f46; border-radius: 4px; font-size: 10px; font-weight: 600; font-family: 'Hind Siliguri', sans-serif;">
                      ${cat?.name || 'Income'}
                    </span>
                  </td>
                  <td style="padding: 8px 12px; color: #0f172a; font-family: 'Hind Siliguri', sans-serif;">${tx.note || '-'}</td>
                  <td style="padding: 8px 12px; text-align: right; font-weight: 700; color: #059669; font-family: 'Inter', sans-serif;">+${formatCurrency(tx.amount)}</td>
                </tr>
              `;
            }).join('')}
            ${incomeItems.length === 0 ? `
              <tr>
                <td colspan="5" style="padding: 18px; text-align: center; color: #94a3b8; font-style: italic;">এই মাসে কোন আয়ের লেনদেন পাওয়া যায়নি।</td>
              </tr>
            ` : ''}
            <tr style="background-color: #f8fafc; border-top: 1.5px solid #e2e8f0; font-weight: 800;">
              <td colspan="4" style="padding: 10px 12px; text-transform: uppercase; font-size: 10.5px; color: #475569;">SUBTOTAL INCOME (মোট আয়)</td>
              <td style="padding: 10px 12px; text-align: right; color: #059669; font-size: 12px; font-family: 'Inter', sans-serif;">+${formatCurrency(totalIncome)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Expense Table Section -->
      <div style="margin-bottom: 28px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <div style="font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 6px;">
            <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: #dc2626;"></span>
            Expense Breakdown (ব্যয়ের খাত ও বিবরণী)
          </div>
          <div style="font-size: 11px; font-weight: 700; color: #dc2626;">মোট: -${formatCurrency(totalExpense)}</div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
          <thead>
            <tr style="background-color: #f8fafc; color: #475569; font-weight: 700; border-bottom: 1.5px solid #e2e8f0;">
              <th style="padding: 9px 12px; width: 40px; text-align: center;">SL</th>
              <th style="padding: 9px 12px; width: 90px;">Date (তারিখ)</th>
              <th style="padding: 9px 12px; width: 140px;">Category (ক্যাটাগরি)</th>
              <th style="padding: 9px 12px;">Description / Note (বিবরণ ও নোট)</th>
              <th style="padding: 9px 12px; width: 120px; text-align: right;">Amount (টাকা)</th>
            </tr>
          </thead>
          <tbody>
            ${expenseItems.map((tx, idx) => {
              const cat = categories.find(c => c.id === tx.categoryId);
              return `
                <tr style="border-bottom: 1px solid #f1f5f9; background-color: ${idx % 2 === 1 ? '#fafafa' : '#ffffff'};">
                  <td style="padding: 8px 12px; text-align: center; color: #94a3b8; font-size: 10.5px;">${idx + 1}</td>
                  <td style="padding: 8px 12px; color: #475569; font-weight: 500;">${format(new Date(tx.date), 'dd MMM yyyy')}</td>
                  <td style="padding: 8px 12px;">
                    <span style="display: inline-block; padding: 2px 6px; background-color: #fef2f2; color: #991b1b; border-radius: 4px; font-size: 10px; font-weight: 600; font-family: 'Hind Siliguri', sans-serif;">
                      ${cat?.name || 'Expense'}
                    </span>
                  </td>
                  <td style="padding: 8px 12px; color: #0f172a; font-family: 'Hind Siliguri', sans-serif;">${tx.note || '-'}</td>
                  <td style="padding: 8px 12px; text-align: right; font-weight: 700; color: #dc2626; font-family: 'Inter', sans-serif;">-${formatCurrency(tx.amount)}</td>
                </tr>
              `;
            }).join('')}
            ${expenseItems.length === 0 ? `
              <tr>
                <td colspan="5" style="padding: 18px; text-align: center; color: #94a3b8; font-style: italic;">এই মাসে কোন ব্যয়ের লেনদেন পাওয়া যায়নি।</td>
              </tr>
            ` : ''}
            <tr style="background-color: #f8fafc; border-top: 1.5px solid #e2e8f0; font-weight: 800;">
              <td colspan="4" style="padding: 10px 12px; text-transform: uppercase; font-size: 10.5px; color: #475569;">SUBTOTAL EXPENSE (মোট ব্যয়)</td>
              <td style="padding: 10px 12px; text-align: right; color: #dc2626; font-size: 12px; font-family: 'Inter', sans-serif;">-${formatCurrency(totalExpense)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Clean Minimal Footer -->
      <div style="margin-top: 36px; padding-top: 18px; border-top: 1.5px solid #e2e8f0; display: flex; justify-content: space-between; align-items: flex-end; font-size: 10.5px; color: #94a3b8;">
        <div>
          <div style="font-weight: 600; color: #64748b;">FinTrack Wealth Platform • Monthly Audit Statement</div>
          <div style="margin-top: 2px;">Document Hash: BDT-${format(new Date(), 'yyyyMMdd')}-MTH-${month}-${year}</div>
        </div>
        <div style="text-align: right;">
          <div style="color: #64748b; font-weight: 600;">Verified Digital Ledger Record</div>
          <div style="margin-top: 2px;">Page 1 of 1</div>
        </div>
      </div>

    </div>
  `;

  const formattedPeriodName = monthNamesEng[month - 1].toLowerCase();
  const safeFileName = `FinTrack_Statement_${formattedPeriodName}_${year}.pdf`;
  await generateHtmlPdf(htmlContent, { fileName: safeFileName, isThermalReceipt: false });
}

/**
 * High-Fidelity, Minimal & Ultra-Professional Daily Income & Expense Combined Statement
 * Displays full month (or selected date/range) day by day with:
 * - Total Monthly Income
 * - Total Monthly Expense
 * - Monthly Net Balance
 * - Current Total Cash & Account Balance (Remaining money in accounts)
 * - Day-by-Day combined table with separate income & expense items, daily subtotals, and daily nets.
 */
export async function generateDailyIncomeExpenseReportPDF(params: {
  userId: number | string;
  userName: string;
  userEmail?: string;
  phoneNumber?: string;
  companyName?: string;
  periodLabel: string;
  transactions: any[];
  accounts: any[];
  categories: any[];
}) {
  const {
    userName,
    userEmail,
    phoneNumber,
    companyName,
    periodLabel,
    transactions,
    accounts,
    categories
  } = params;

  // Calculate overall metrics for the period
  let totalIncome = 0;
  let totalExpense = 0;

  transactions.forEach(tx => {
    if (tx.type === 'income') {
      totalIncome += tx.amount;
    } else {
      totalExpense += tx.amount;
    }
  });

  const netPeriodBalance = totalIncome - totalExpense;
  const currentTotalAccountBalance = accounts.reduce((sum, acc) => sum + (acc.currentBalance || 0), 0);

  // Group transactions by date (yyyy-MM-dd)
  const dateMap: { [dateKey: string]: { date: Date; incomeList: any[]; expenseList: any[]; dayIncome: number; dayExpense: number } } = {};

  transactions.forEach(tx => {
    const d = new Date(tx.date);
    const dateKey = format(d, 'yyyy-MM-dd');
    if (!dateMap[dateKey]) {
      dateMap[dateKey] = {
        date: d,
        incomeList: [],
        expenseList: [],
        dayIncome: 0,
        dayExpense: 0,
      };
    }
    if (tx.type === 'income') {
      dateMap[dateKey].incomeList.push(tx);
      dateMap[dateKey].dayIncome += tx.amount;
    } else {
      dateMap[dateKey].expenseList.push(tx);
      dateMap[dateKey].dayExpense += tx.amount;
    }
  });

  // Sort dates descending
  const sortedDates = Object.keys(dateMap).sort((a, b) => b.localeCompare(a));
  const nowOutput = format(new Date(), 'dd MMM yyyy, hh:mm a');

  const htmlContent = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Hind+Siliguri:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
      * { box-sizing: border-box; }
    </style>
    <div style="padding: 36px 40px; background-color: #ffffff; font-family: 'Inter', 'Hind Siliguri', sans-serif; color: #0f172a; max-width: 794px; margin: 0 auto; box-sizing: border-box; line-height: 1.45;">
      
      <!-- Minimalist Executive Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 22px; border-bottom: 1.5px solid #e2e8f0; margin-bottom: 22px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 38px; height: 38px; background-color: #0f172a; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #ffffff; font-weight: 900; font-size: 16px; letter-spacing: -0.05em;">
            FT
          </div>
          <div>
            <div style="font-size: 18px; font-weight: 900; letter-spacing: -0.02em; color: #0f172a;">FinTrack</div>
            <div style="font-size: 10.5px; color: #64748b; font-weight: 500;">Daily Financial Ledger & Cash Flow Audit</div>
          </div>
        </div>
        
        <div style="text-align: right;">
          <div style="font-size: 14px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.04em;">DAILY FINANCIAL STATEMENT</div>
          <div style="font-size: 11px; color: #64748b; font-weight: 500; margin-top: 2px;">দৈনিক আয়-ব্যয় ও আর্থিক স্থিতি বিবরণী</div>
          <div style="font-size: 10px; color: #94a3b8; margin-top: 4px;">Generated: ${nowOutput}</div>
        </div>
      </div>

      <!-- User & Period Information Box -->
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; font-size: 12px; margin-bottom: 22px;">
        <div>
          <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">হিসাবধারী (Prepared For)</div>
          <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 2px;">${userName || 'User'}</div>
          ${userEmail ? `<div style="font-size: 11px; color: #64748b; margin-top: 1px;">${userEmail}</div>` : ''}
          ${phoneNumber ? `<div style="font-size: 11px; color: #475569; margin-top: 1px;">ফোন: ${phoneNumber}</div>` : ''}
          ${companyName ? `<div style="font-size: 11px; color: #475569; margin-top: 1px;">প্রতিষ্ঠান: ${companyName}</div>` : ''}
        </div>
        <div style="text-align: right;">
          <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">বিবরণীর সময়কাল (Statement Period)</div>
          <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 2px; font-family: 'Hind Siliguri', sans-serif;">${periodLabel}</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 1px;">মোট লেনদেন: ${transactions.length} টি (${sortedDates.length} দিন)</div>
        </div>
      </div>

      <!-- 4 Executive Highlight KPI Summary Cards -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 24px;">
        
        <!-- Total Income Box -->
        <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px;">
          <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em;">সর্বমোট আয় (Income)</div>
          <div style="font-size: 16px; font-weight: 800; color: #059669; margin-top: 4px; font-family: 'Inter', sans-serif;">+${formatCurrency(totalIncome)}</div>
          <div style="font-size: 9.5px; color: #94a3b8; margin-top: 2px;">${transactions.filter(t => t.type === 'income').length} টি আয়ের উৎস</div>
        </div>

        <!-- Total Expense Box -->
        <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px;">
          <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em;">সর্বমোট ব্যয় (Expense)</div>
          <div style="font-size: 16px; font-weight: 800; color: #dc2626; margin-top: 4px; font-family: 'Inter', sans-serif;">-${formatCurrency(totalExpense)}</div>
          <div style="font-size: 9.5px; color: #94a3b8; margin-top: 2px;">${transactions.filter(t => t.type === 'expense').length} টি ব্যয়ের খাত</div>
        </div>

        <!-- Net Monthly Balance Box -->
        <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px;">
          <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em;">মাসের নিট সঞ্চয়/ব্যালেন্স</div>
          <div style="font-size: 16px; font-weight: 800; color: ${netPeriodBalance >= 0 ? '#0f172a' : '#dc2626'}; margin-top: 4px; font-family: 'Inter', sans-serif;">${netPeriodBalance >= 0 ? '+' : ''}${formatCurrency(netPeriodBalance)}</div>
          <div style="font-size: 9.5px; color: #94a3b8; margin-top: 2px;">(আয় - ব্যয় এর স্থিতি)</div>
        </div>

        <!-- Total Available Balance Across Accounts Box -->
        <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px;">
          <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em;">বর্তমান মোট জমা/ক্যাশ</div>
          <div style="font-size: 16px; font-weight: 800; color: #2563eb; margin-top: 4px; font-family: 'Inter', sans-serif;">${formatCurrency(currentTotalAccountBalance)}</div>
          <div style="font-size: 9.5px; color: #94a3b8; margin-top: 2px;">সব একাউন্টে মোট জমা</div>
        </div>

      </div>

      <!-- Section Title: Daily Breakdown -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1.5px solid #e2e8f0;">
        <div style="font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.04em; display: flex; align-items: center; gap: 6px;">
          <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: #0f172a;"></span>
          দৈনিক আয় ও ব্যয় বিস্তারিত তালিকা (Daily Breakdown)
        </div>
        <div style="font-size: 10.5px; color: #64748b; font-weight: 500;">একত্রে প্রতিদিনের হিসাব</div>
      </div>

      <!-- Day-by-Day Minimalist Table -->
      <table style="width: 100%; border-collapse: collapse; font-size: 10.5px; margin-bottom: 22px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
        <thead>
          <tr style="background-color: #f8fafc; color: #475569; text-align: left; font-weight: 700; border-bottom: 1.5px solid #e2e8f0;">
            <th style="padding: 9px 10px; width: 95px; border-right: 1px solid #e2e8f0;">তারিখ (Date)</th>
            <th style="padding: 9px 10px; border-right: 1px solid #e2e8f0;">আয়ের খাত ও বিবরণ (Income)</th>
            <th style="padding: 9px 10px; width: 85px; text-align: right; border-right: 1px solid #e2e8f0; color: #059669;">দৈনিক আয়</th>
            <th style="padding: 9px 10px; border-right: 1px solid #e2e8f0;">ব্যয়ের খাত ও বিবরণ (Expense)</th>
            <th style="padding: 9px 10px; width: 85px; text-align: right; border-right: 1px solid #e2e8f0; color: #dc2626;">দৈনিক ব্যয়</th>
            <th style="padding: 9px 10px; width: 85px; text-align: right; color: #0f172a;">দৈনিক নিট</th>
          </tr>
        </thead>
        <tbody>
          ${sortedDates.length > 0 ? sortedDates.map((dateKey, idx) => {
            const dayData = dateMap[dateKey];
            const rowBg = idx % 2 === 1 ? '#fafafa' : '#ffffff';
            const dayNet = dayData.dayIncome - dayData.dayExpense;

            const incomeDetails = dayData.incomeList.map(tx => {
              const cat = categories.find(c => c.id === tx.categoryId);
              return `<div style="margin-bottom: 2px;"><span style="color: #059669; font-weight: 600; font-family: 'Hind Siliguri', sans-serif;">${cat?.name || 'Income'}</span>: <span style="font-weight: 600;">${formatCurrency(tx.amount)}</span>${tx.note ? ` <span style="color:#64748b; font-size:9.5px;">(${tx.note})</span>` : ''}</div>`;
            }).join('');

            const expenseDetails = dayData.expenseList.map(tx => {
              const cat = categories.find(c => c.id === tx.categoryId);
              return `<div style="margin-bottom: 2px;"><span style="color: #dc2626; font-weight: 600; font-family: 'Hind Siliguri', sans-serif;">${cat?.name || 'Expense'}</span>: <span style="font-weight: 600;">${formatCurrency(tx.amount)}</span>${tx.note ? ` <span style="color:#64748b; font-size:9.5px;">(${tx.note})</span>` : ''}</div>`;
            }).join('');

            return `
              <tr style="background-color: ${rowBg}; border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 10px; border-right: 1px solid #e2e8f0; font-weight: 600; color: #0f172a; vertical-align: top;">
                  <div>${format(dayData.date, 'dd MMM yyyy')}</div>
                  <div style="font-size: 9px; color: #64748b; font-weight: 500;">${format(dayData.date, 'EEEE')}</div>
                </td>
                <td style="padding: 8px 10px; border-right: 1px solid #e2e8f0; vertical-align: top;">
                  ${incomeDetails || '<span style="color:#cbd5e1; font-style: italic;">-</span>'}
                </td>
                <td style="padding: 8px 10px; border-right: 1px solid #e2e8f0; text-align: right; font-weight: 700; color: #059669; vertical-align: top; font-family: 'Inter', sans-serif;">
                  ${dayData.dayIncome > 0 ? `+${formatCurrency(dayData.dayIncome)}` : '৳০.০০'}
                </td>
                <td style="padding: 8px 10px; border-right: 1px solid #e2e8f0; vertical-align: top;">
                  ${expenseDetails || '<span style="color:#cbd5e1; font-style: italic;">-</span>'}
                </td>
                <td style="padding: 8px 10px; border-right: 1px solid #e2e8f0; text-align: right; font-weight: 700; color: #dc2626; vertical-align: top; font-family: 'Inter', sans-serif;">
                  ${dayData.dayExpense > 0 ? `-${formatCurrency(dayData.dayExpense)}` : '৳০.০০'}
                </td>
                <td style="padding: 8px 10px; text-align: right; font-weight: 700; color: ${dayNet >= 0 ? '#0f172a' : '#dc2626'}; vertical-align: top; font-family: 'Inter', sans-serif;">
                  ${dayNet >= 0 ? '+' : ''}${formatCurrency(dayNet)}
                </td>
              </tr>
            `;
          }).join('') : `
            <tr>
              <td colspan="6" style="padding: 24px; text-align: center; color: #94a3b8; font-style: italic;">এই সময়ে কোন আয় বা ব্যয় লেনদেন পাওয়া যায়নি।</td>
            </tr>
          `}

          <!-- Clean Grand Totals Row -->
          <tr style="background-color: #f8fafc; font-weight: 800; font-size: 11px; color: #0f172a; border-top: 2px solid #0f172a;">
            <td colspan="2" style="padding: 10px 10px; text-transform: uppercase; border-right: 1px solid #e2e8f0; letter-spacing: 0.04em;">
              সর্বমোট সারাংশ (GRAND TOTALS)
            </td>
            <td style="padding: 10px 10px; text-align: right; color: #059669; border-right: 1px solid #e2e8f0; font-family: 'Inter', sans-serif;">
              +${formatCurrency(totalIncome)}
            </td>
            <td style="padding: 10px 10px; border-right: 1px solid #e2e8f0;"></td>
            <td style="padding: 10px 10px; text-align: right; color: #dc2626; border-right: 1px solid #e2e8f0; font-family: 'Inter', sans-serif;">
              -${formatCurrency(totalExpense)}
            </td>
            <td style="padding: 10px 10px; text-align: right; color: ${netPeriodBalance >= 0 ? '#0f172a' : '#dc2626'}; font-family: 'Inter', sans-serif;">
              ${netPeriodBalance >= 0 ? '+' : ''}${formatCurrency(netPeriodBalance)}
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Accounts Balance Breakdown Section -->
      <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px;">
        <div style="font-size: 11.5px; font-weight: 800; color: #0f172a; margin-bottom: 10px; text-transform: uppercase; display: flex; justify-content: space-between; align-items: center; letter-spacing: 0.03em;">
          <span>🏦 একাউন্ট ও নগদ জমার বর্তমান অবস্থা (Account Balances)</span>
          <span style="font-size: 11px; color: #059669; font-weight: 700;">মোট অবশিষ্ট তহবিল: ${formatCurrency(currentTotalAccountBalance)}</span>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; font-size: 10.5px;">
          ${accounts.map(acc => `
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #0f172a; font-family: 'Hind Siliguri', sans-serif;">${acc.name}</strong>
                <div style="font-size: 9px; color: #64748b;">${acc.type || 'Wallet'}</div>
              </div>
              <div style="font-weight: 700; color: ${acc.currentBalance >= 0 ? '#0f172a' : '#dc2626'}; font-family: 'Inter', sans-serif;">
                ${formatCurrency(acc.currentBalance)}
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Legal / Assurance Note -->
      <div style="font-size: 10px; color: #64748b; line-height: 1.5; padding: 10px 14px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 20px;">
        📌 <strong>নোট:</strong> উপরোক্ত বিবরণীটি আপনার নির্বাচিত সময়সীমার প্রতিদিনের আয় ও ব্যয়কে একত্রে সুশৃঙ্খলভাবে উপস্থাপন করে। মোট জমা টাকা আপনার একাউন্টসমূহের বর্তমান স্থিতি নির্দেশ করে।
      </div>

      <!-- Bottom Signature & Verification Stamp -->
      <div style="display: flex; justify-content: space-between; align-items: flex-end; padding-top: 14px; border-top: 1.5px solid #e2e8f0; font-size: 10px; color: #64748b;">
        <div>
          <div style="font-weight: 600; color: #0f172a;">FinTrack Personal Wealth Ledger</div>
          <div style="font-size: 9px; color: #94a3b8; margin-top: 2px;">Document Hash: BDT-${format(new Date(), 'yyyyMMdd')}-DAILY-AUDIT</div>
        </div>
        <div style="text-align: center; border-top: 1px solid #cbd5e1; padding-top: 4px; min-width: 140px;">
          <div style="font-weight: 700; color: #0f172a;">${userName || 'Authorized User'}</div>
          <div style="font-size: 9px; color: #94a3b8;">ডিজিটাল স্বাক্ষর / অনুমোদিত</div>
        </div>
      </div>

    </div>
  `;

  const cleanPeriod = periodLabel.replace(/[^a-zA-Z0-9_\u0980-\u09FF]/g, '_').toLowerCase();
  const safeFileName = `FinTrack_Daily_Statement_${cleanPeriod}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  await generateHtmlPdf(htmlContent, { fileName: safeFileName, isThermalReceipt: false });
}

/**
 * Minimal & Professional Monthly 30-Day Ledger PDF Report
 * Displays only dates with transactions, income and expense notes, day subtotals and grand net.
 */
export async function generateMonthlyLedgerPDF(params: {
  userId: number | string;
  userName: string;
  userEmail?: string;
  phoneNumber?: string;
  companyName?: string;
  year: number;
  month: number; // 1-12
  transactions: any[];
  accounts: any[];
  categories: any[];
}) {
  const {
    userName,
    userEmail,
    phoneNumber,
    companyName,
    year,
    month,
    transactions,
    accounts,
    categories
  } = params;

  const monthNamesEng = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthNamesBng = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
  const periodTitle = `${monthNamesBng[month - 1]} ${year} (${monthNamesEng[month - 1]} ${year})`;

  // Filter transactions strictly for this month & year
  const monthlyTxs = transactions.filter(tx => {
    const d = new Date(tx.date);
    return d.getFullYear() === year && (d.getMonth() + 1) === month;
  });

  let totalIncome = 0;
  let totalExpense = 0;

  monthlyTxs.forEach(tx => {
    if (tx.type === 'income') {
      totalIncome += tx.amount;
    } else {
      totalExpense += tx.amount;
    }
  });

  const netBalance = totalIncome - totalExpense;
  const currentTotalAccountBalance = accounts.reduce((sum, acc) => sum + (acc.currentBalance || 0), 0);

  // Group by date (yyyy-MM-dd) - only dates with transactions
  const dateMap: { [key: string]: { date: Date; incomeList: any[]; expenseList: any[]; dayIncome: number; dayExpense: number } } = {};

  monthlyTxs.forEach(tx => {
    const d = new Date(tx.date);
    const dateKey = format(d, 'yyyy-MM-dd');
    if (!dateMap[dateKey]) {
      dateMap[dateKey] = {
        date: d,
        incomeList: [],
        expenseList: [],
        dayIncome: 0,
        dayExpense: 0
      };
    }
    if (tx.type === 'income') {
      dateMap[dateKey].incomeList.push(tx);
      dateMap[dateKey].dayIncome += tx.amount;
    } else {
      dateMap[dateKey].expenseList.push(tx);
      dateMap[dateKey].dayExpense += tx.amount;
    }
  });

  // Sort dates ascending (01 to 30/31)
  const sortedDates = Object.keys(dateMap).sort((a, b) => a.localeCompare(b));
  const issuedDate = format(new Date(), 'dd MMM yyyy, hh:mm a');

  const htmlContent = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Hind+Siliguri:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
      * { box-sizing: border-box; }
    </style>
    <div style="padding: 36px 40px; background-color: #ffffff; font-family: 'Inter', 'Hind Siliguri', sans-serif; color: #0f172a; max-width: 794px; margin: 0 auto; box-sizing: border-box; line-height: 1.45;">
      
      <!-- Minimalist Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; border-bottom: 1.5px solid #e2e8f0; margin-bottom: 20px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 40px; height: 40px; background-color: #0f172a; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #ffffff; font-weight: 900; font-size: 16px; letter-spacing: -0.05em;">
            FT
          </div>
          <div>
            <div style="font-size: 19px; font-weight: 900; letter-spacing: -0.02em; color: #0f172a;">FinTrack</div>
            <div style="font-size: 11px; color: #64748b; font-weight: 500;">Monthly 30-Day Financial Ledger & Statement</div>
          </div>
        </div>
        
        <div style="text-align: right;">
          <div style="font-size: 14px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.04em;">MONTHLY 30-DAY LEDGER</div>
          <div style="font-size: 11px; color: #64748b; font-weight: 500; margin-top: 2px;">মাসিক ৩০ দিনের আয়-ব্যয় খতিয়ান</div>
          <div style="font-size: 10px; color: #94a3b8; margin-top: 4px;">Issued: ${issuedDate}</div>
        </div>
      </div>

      <!-- Account Holder & Month Metadata -->
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; font-size: 12px; margin-bottom: 20px;">
        <div>
          <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">হিসাবধারী (Account Holder)</div>
          <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-top: 2px;">${userName || 'User'}</div>
          ${userEmail ? `<div style="font-size: 11px; color: #64748b; margin-top: 1px;">${userEmail}</div>` : ''}
          ${phoneNumber ? `<div style="font-size: 11px; color: #475569; margin-top: 1px;">ফোন: ${phoneNumber}</div>` : ''}
          ${companyName ? `<div style="font-size: 11px; color: #475569; margin-top: 1px;">প্রতিষ্ঠান: ${companyName}</div>` : ''}
        </div>
        <div style="text-align: right;">
          <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">হিসাবের মাস (Statement Month)</div>
          <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-top: 2px; font-family: 'Hind Siliguri', sans-serif;">${periodTitle}</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 1px;">মোট হিসাবের দিন: ${sortedDates.length} দিন (${monthlyTxs.length} টি লেনদেন)</div>
        </div>
      </div>

      <!-- 4 KPI Summary Cards -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 22px;">
        <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px;">
          <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em;">মাসের মোট আয়</div>
          <div style="font-size: 16px; font-weight: 800; color: #059669; margin-top: 4px; font-family: 'Inter', sans-serif;">+${formatCurrency(totalIncome)}</div>
          <div style="font-size: 9.5px; color: #94a3b8; margin-top: 2px;">${monthlyTxs.filter(t => t.type === 'income').length} টি আয়ের উৎস</div>
        </div>

        <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px;">
          <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em;">মাসের মোট ব্যয়</div>
          <div style="font-size: 16px; font-weight: 800; color: #dc2626; margin-top: 4px; font-family: 'Inter', sans-serif;">-${formatCurrency(totalExpense)}</div>
          <div style="font-size: 9.5px; color: #94a3b8; margin-top: 2px;">${monthlyTxs.filter(t => t.type === 'expense').length} টি ব্যয়ের খাত</div>
        </div>

        <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px;">
          <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em;">মাসের নিট স্থিতি</div>
          <div style="font-size: 16px; font-weight: 800; color: ${netBalance >= 0 ? '#0f172a' : '#dc2626'}; margin-top: 4px; font-family: 'Inter', sans-serif;">${netBalance >= 0 ? '+' : ''}${formatCurrency(netBalance)}</div>
          <div style="font-size: 9.5px; color: #94a3b8; margin-top: 2px;">(আয় - ব্যয়ের অবশিষ্ট)</div>
        </div>

        <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px;">
          <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em;">বর্তমান মোট তহবিল</div>
          <div style="font-size: 16px; font-weight: 800; color: #2563eb; margin-top: 4px; font-family: 'Inter', sans-serif;">${formatCurrency(currentTotalAccountBalance)}</div>
          <div style="font-size: 9.5px; color: #94a3b8; margin-top: 2px;">পকেট ও ব্যাংক জমা</div>
        </div>
      </div>

      <!-- Clean Daily Breakdown Table (Only dates with transactions) -->
      <table style="width: 100%; border-collapse: collapse; font-size: 10.5px; margin-bottom: 22px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
        <thead>
          <tr style="background-color: #f8fafc; color: #475569; text-align: left; font-weight: 700; border-bottom: 1.5px solid #e2e8f0;">
            <th style="padding: 9px 10px; width: 90px; border-right: 1px solid #e2e8f0;">তারিখ (Date)</th>
            <th style="padding: 9px 10px; border-right: 1px solid #e2e8f0;">আয়ের খাত ও বিবরণ (Income Note)</th>
            <th style="padding: 9px 10px; width: 85px; text-align: right; border-right: 1px solid #e2e8f0; color: #059669;">দৈনিক আয়</th>
            <th style="padding: 9px 10px; border-right: 1px solid #e2e8f0;">ব্যয়ের খাত ও বিবরণ (Expense Note)</th>
            <th style="padding: 9px 10px; width: 85px; text-align: right; border-right: 1px solid #e2e8f0; color: #dc2626;">দৈনিক ব্যয়</th>
            <th style="padding: 9px 10px; width: 85px; text-align: right; color: #0f172a;">দৈনিক নিট</th>
          </tr>
        </thead>
        <tbody>
          ${sortedDates.length > 0 ? sortedDates.map((dateKey, idx) => {
            const dayData = dateMap[dateKey];
            const rowBg = idx % 2 === 1 ? '#fafafa' : '#ffffff';
            const dayNet = dayData.dayIncome - dayData.dayExpense;

            const incomeDetails = dayData.incomeList.map(tx => {
              const cat = categories.find(c => c.id === tx.categoryId);
              return `<div style="margin-bottom: 2px;"><span style="color: #059669; font-weight: 600; font-family: 'Hind Siliguri', sans-serif;">${cat?.name || 'Income'}</span>: <span style="font-weight: 600;">${formatCurrency(tx.amount)}</span>${tx.note ? ` <span style="color:#64748b; font-size:9.5px;">(${tx.note})</span>` : ''}</div>`;
            }).join('');

            const expenseDetails = dayData.expenseList.map(tx => {
              const cat = categories.find(c => c.id === tx.categoryId);
              return `<div style="margin-bottom: 2px;"><span style="color: #dc2626; font-weight: 600; font-family: 'Hind Siliguri', sans-serif;">${cat?.name || 'Expense'}</span>: <span style="font-weight: 600;">${formatCurrency(tx.amount)}</span>${tx.note ? ` <span style="color:#64748b; font-size:9.5px;">(${tx.note})</span>` : ''}</div>`;
            }).join('');

            return `
              <tr style="background-color: ${rowBg}; border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 10px; border-right: 1px solid #e2e8f0; font-weight: 600; color: #0f172a; vertical-align: top;">
                  <div style="font-family: 'Inter', sans-serif; font-size: 11px;">${format(dayData.date, 'dd MMM yyyy')}</div>
                  <div style="font-size: 9px; color: #64748b; font-weight: 500;">${format(dayData.date, 'EEEE')}</div>
                </td>
                <td style="padding: 8px 10px; border-right: 1px solid #e2e8f0; vertical-align: top;">
                  ${incomeDetails || '<span style="color:#cbd5e1; font-style: italic;">-</span>'}
                </td>
                <td style="padding: 8px 10px; border-right: 1px solid #e2e8f0; text-align: right; font-weight: 700; color: #059669; vertical-align: top; font-family: 'Inter', sans-serif;">
                  ${dayData.dayIncome > 0 ? `+${formatCurrency(dayData.dayIncome)}` : '৳০.০০'}
                </td>
                <td style="padding: 8px 10px; border-right: 1px solid #e2e8f0; vertical-align: top;">
                  ${expenseDetails || '<span style="color:#cbd5e1; font-style: italic;">-</span>'}
                </td>
                <td style="padding: 8px 10px; border-right: 1px solid #e2e8f0; text-align: right; font-weight: 700; color: #dc2626; vertical-align: top; font-family: 'Inter', sans-serif;">
                  ${dayData.dayExpense > 0 ? `-${formatCurrency(dayData.dayExpense)}` : '৳০.০০'}
                </td>
                <td style="padding: 8px 10px; text-align: right; font-weight: 700; color: ${dayNet >= 0 ? '#0f172a' : '#dc2626'}; vertical-align: top; font-family: 'Inter', sans-serif;">
                  ${dayNet >= 0 ? '+' : ''}${formatCurrency(dayNet)}
                </td>
              </tr>
            `;
          }).join('') : `
            <tr>
              <td colspan="6" style="padding: 24px; text-align: center; color: #94a3b8; font-style: italic;">এই মাসে কোন আয় বা ব্যয় লেনদেন পাওয়া যায়নি।</td>
            </tr>
          `}

          <!-- Clean Grand Totals Row -->
          <tr style="background-color: #f8fafc; font-weight: 800; font-size: 11px; color: #0f172a; border-top: 2px solid #0f172a;">
            <td colspan="2" style="padding: 10px 10px; text-transform: uppercase; border-right: 1px solid #e2e8f0; letter-spacing: 0.04em;">
              সর্বমোট সারাংশ (GRAND TOTALS)
            </td>
            <td style="padding: 10px 10px; text-align: right; color: #059669; border-right: 1px solid #e2e8f0; font-family: 'Inter', sans-serif;">
              +${formatCurrency(totalIncome)}
            </td>
            <td style="padding: 10px 10px; border-right: 1px solid #e2e8f0;"></td>
            <td style="padding: 10px 10px; text-align: right; color: #dc2626; border-right: 1px solid #e2e8f0; font-family: 'Inter', sans-serif;">
              -${formatCurrency(totalExpense)}
            </td>
            <td style="padding: 10px 10px; text-align: right; color: ${netBalance >= 0 ? '#0f172a' : '#dc2626'}; font-family: 'Inter', sans-serif;">
              ${netBalance >= 0 ? '+' : ''}${formatCurrency(netBalance)}
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Accounts Balance Breakdown Section -->
      <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px;">
        <div style="font-size: 11.5px; font-weight: 800; color: #0f172a; margin-bottom: 10px; text-transform: uppercase; display: flex; justify-content: space-between; align-items: center; letter-spacing: 0.03em;">
          <span>🏦 একাউন্ট ও পকেট ক্যাশের বর্তমান অবস্থা (Account Balances)</span>
          <span style="font-size: 11px; color: #059669; font-weight: 700;">মোট অবশিষ্ট তহবিল: ${formatCurrency(currentTotalAccountBalance)}</span>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; font-size: 10.5px;">
          ${accounts.map(acc => `
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #0f172a; font-family: 'Hind Siliguri', sans-serif;">${acc.name}</strong>
                <div style="font-size: 9px; color: #64748b;">${acc.type || 'Wallet'}</div>
              </div>
              <div style="font-weight: 700; color: ${acc.currentBalance >= 0 ? '#0f172a' : '#dc2626'}; font-family: 'Inter', sans-serif;">
                ${formatCurrency(acc.currentBalance)}
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Legal / Assurance Note -->
      <div style="font-size: 10px; color: #64748b; line-height: 1.5; padding: 10px 14px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 20px;">
        📌 <strong>নোট:</strong> শুধুমাত্র যে তারিখে হিসাব নথিভুক্ত রয়েছে সেই তারিখগুলো বিস্তারিত আয়-ব্যয় ও নোট সহ প্রতিবেদনে অন্তর্ভুক্ত করা হয়েছে।
      </div>

      <!-- Bottom Signature & Verification Stamp -->
      <div style="display: flex; justify-content: space-between; align-items: flex-end; padding-top: 14px; border-top: 1.5px solid #e2e8f0; font-size: 10px; color: #64748b;">
        <div>
          <div style="font-weight: 600; color: #0f172a;">FinTrack Monthly Statement Ledger</div>
          <div style="font-size: 9px; color: #94a3b8; margin-top: 2px;">Document Hash: BDT-${year}${String(month).padStart(2, '0')}-LEDGER-30D</div>
        </div>
        <div style="text-align: center; border-top: 1px solid #cbd5e1; padding-top: 4px; min-width: 140px;">
          <div style="font-weight: 700; color: #0f172a;">${userName || 'Authorized User'}</div>
          <div style="font-size: 9px; color: #94a3b8;">ডিজিটাল স্বাক্ষর / অনুমোদিত</div>
        </div>
      </div>

    </div>
  `;

  const safeFileName = `FinTrack_30Day_Ledger_${monthNamesEng[month - 1]}_${year}.pdf`;
  await generateHtmlPdf(htmlContent, { fileName: safeFileName, isThermalReceipt: false });
}

