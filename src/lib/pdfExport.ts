import { format } from 'date-fns';
import { db } from '../db';
import { formatCurrency } from './utils';
import { generateHtmlPdf } from './htmlToPdfHelper';

/**
 * Standard All-time Wealth & Debt Summary Report using robust HTML-to-PDF
 * Completely solves Bengali font shaping issues.
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
  const recentTxs = transactions.slice(0, 15); // Show top 15 recent transactions for elegance

  const htmlContent = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Hind+Siliguri:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
    </style>
    <div style="padding: 30px; background-color: #f8fafc; font-family: 'Inter', 'Hind Siliguri', sans-serif; color: #1e293b; max-width: 794px; margin: 0 auto; box-sizing: border-box;">
      
      <!-- top corporate header banner identical to the design -->
      <div style="background-color: #1e3a8a; padding: 24px 40px; color: #ffffff; display: flex; justify-content: space-between; align-items: center; border-radius: 12px 12px 0 0; box-sizing: border-box;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <!-- Hexagon gold emblem -->
          <div style="width: 32px; height: 32px; background-color: #facc15; border-radius: 8px; display: flex; align-items: center; justify-content: center; padding: 4px; border: 3px solid #1e3a8a; box-sizing: border-box;">
            <div style="width: 14px; height: 14px; border: 3px solid #ffffff; transform: rotate(45deg);"></div>
          </div>
          <div>
            <div style="font-size: 16px; font-weight: 800; letter-spacing: 0.05em; line-height: 1.1; font-family: 'Inter', sans-serif;">FINTRACK</div>
            <div style="font-size: 10px; opacity: 0.8; letter-spacing: 0.02em; font-family: 'Inter', sans-serif;">Corporation</div>
          </div>
        </div>
        
        <!-- Classic Swiss grid dot elements identical to the design image -->
        <div style="display: flex; flex-direction: column; gap: 4px; opacity: 0.6;">
          <div style="display: flex; gap: 4px;"><div style="width: 4px; height: 4px; background-color: #ffffff; border-radius: 50%;"></div><div style="width: 4px; height: 4px; background-color: #ffffff; border-radius: 50%;"></div><div style="width: 4px; height: 4px; background-color: #ffffff; border-radius: 50%;"></div></div>
          <div style="display: flex; gap: 4px;"><div style="width: 4px; height: 4px; background-color: #ffffff; border-radius: 50%;"></div><div style="width: 4px; height: 4px; background-color: #ffffff; border-radius: 50%;"></div><div style="width: 4px; height: 4px; background-color: #ffffff; border-radius: 50%;"></div></div>
          <div style="display: flex; gap: 4px;"><div style="width: 4px; height: 4px; background-color: #ffffff; border-radius: 50%;"></div><div style="width: 4px; height: 4px; background-color: #ffffff; border-radius: 50%;"></div><div style="width: 4px; height: 4px; background-color: #ffffff; border-radius: 50%;"></div></div>
        </div>
      </div>

      <!-- Main report Title -->
      <div style="padding: 28px 40px 10px 40px;">
        <h1 style="color: #d97706; font-size: 32px; font-weight: 900; margin: 0 0 4px 0; letter-spacing: -0.02em;">Overall Portfolio Summary</h1>
        <p style="font-size: 14px; color: #64748b; margin: 0 0 16px 0; font-weight: 500;">আর্থিক পোর্টফোলিও সামগ্রিক বিবরণী প্রতিবেদন</p>
      </div>

      <!-- Prepared Information box matching the layout of the reference image -->
      <div style="margin: 0 40px 24px 40px; padding: 18px 24px; background-color: #f1f5f9; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; border: 1.5px solid #e2e8f0; font-size: 13px;">
        <div style="line-height: 1.5;">
          <p style="margin: 0 0 4px 0; color: #1e293b;"><strong style="color: #0f172a; font-weight: 700;">Prepared by:</strong> ${userName}</p>
          ${phoneNumber ? `<p style="margin: 0 0 4px 0; color: #1e293b;"><strong style="color: #0f172a; font-weight: 700;">Phone (ফোন):</strong> ${phoneNumber}</p>` : ''}
          ${companyName ? `<p style="margin: 0 0 4px 0; color: #1e293b;"><strong style="color: #0f172a; font-weight: 700;">Company/Dept (কোম্পানি/শাখা):</strong> ${companyName}</p>` : ''}
          <p style="margin: 0; color: #1e293b;"><strong style="color: #0f172a; font-weight: 700;">Department:</strong> Personal Finance Wealth Report</p>
        </div>
        <div style="text-align: right;">
          <p style="margin: 0; font-size: 14px; font-weight: 700; color: #2563eb;">
            <span style="color: #1e3a8a;">Period:</span> All-Time Summary
          </p>
          <p style="margin: 4px 0 0 0; font-size: 10px; color: #64748b;">Report Generated: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}</p>
        </div>
      </div>

      <!-- Gold Circle Bullets for Sections -->
      <div style="display: flex; align-items: center; gap: 8px; margin: 24px 40px 12px 40px; font-size: 15px; font-weight: 700; color: #0f172a;">
        <span style="width: 10px; height: 10px; border-radius: 50%; background-color: #d97706; display: inline-block;"></span> 
        Overview Balance (আর্থিক স্থিতি) :
      </div>

      <!-- Quick stats tables -->
      <div style="margin: 0 40px 24px 40px; display: grid; grid-template-cols: repeat(3, 1fr); gap: 16px; width: calc(100% - 80px);">
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid #e2e8f0;">
          <thead>
            <tr style="background-color: #e2e8f0; text-align: left; font-weight: bold; color: #1e293b;">
              <th style="padding: 10px 12px; border: 1px solid #cbd5e1; text-align: center;">Total Income (মোট আয়)</th>
              <th style="padding: 10px 12px; border: 1px solid #cbd5e1; text-align: center;">Total Expenses (মোট ব্যয়)</th>
              <th style="padding: 10px 12px; border: 1px solid #cbd5e1; text-align: center;">Net Balance (নিট অবশিষ্ট)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding: 12px; font-weight: 700; text-align: center; color: #059669; font-size: 14px; border: 1px solid #e2e8f0;">${formatCurrency(totalIncome)}</td>
              <td style="padding: 12px; font-weight: 700; text-align: center; color: #dc2626; font-size: 14px; border: 1px solid #e2e8f0;">${formatCurrency(totalExpense)}</td>
              <td style="padding: 12px; font-weight: 900; text-align: center; color: ${netBalance >= 0 ? '#1e3a8a' : '#991b1b'}; font-size: 14px; border: 1px solid #e2e8f0; background-color: #fef08a;">${formatCurrency(netBalance)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style="display: flex; align-items: center; gap: 8px; margin: 24px 40px 12px 40px; font-size: 15px; font-weight: 700; color: #0f172a;">
        <span style="width: 10px; height: 10px; border-radius: 50%; background-color: #d97706; display: inline-block;"></span> 
        Recent Transactions Details (আয় ও ব্যয় তালিকা) :
      </div>

      <!-- Transaction details table matching the requested Corporate format -->
      <div style="margin: 0 40px 24px 40px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid #e2e8f0;">
          <thead>
            <tr style="background-color: #cbd5e1; text-align: left; color: #0f172a; font-weight: bold;">
              <th style="padding: 10px 12px; width: 40px; text-align: center; border: 1px solid #cbd5e1;">No.</th>
              <th style="padding: 10px 12px; width: 90px; border: 1px solid #cbd5e1;">Date (তারিখ)</th>
              <th style="padding: 10px 12px; border: 1px solid #cbd5e1;">Description / Note (বিবরণ)</th>
              <th style="padding: 10px 12px; width: 110px; border: 1px solid #cbd5e1;">Category (ক্যাটাগরি)</th>
              <th style="padding: 10px 12px; width: 130px; text-align: right; border: 1px solid #cbd5e1;">Amount (টাকা)</th>
            </tr>
          </thead>
          <tbody>
            ${recentTxs.map((tx, idx) => {
              const cat = categories.find(c => c.id === tx.categoryId);
              const isInc = tx.type === 'income';
              const rowBg = idx % 2 === 1 ? '#f8fafc' : '#ffffff';
              return `
                <tr style="background-color: ${rowBg}; border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px; text-align: center; border-right: 1px solid #e2e8f0; color: #64748b;">${idx + 1}.</td>
                  <td style="padding: 10px; border-right: 1px solid #e2e8f0; color: #475569;">${format(new Date(tx.date), 'dd MMM yyyy')}</td>
                  <td style="padding: 10px; border-right: 1px solid #e2e8f0; font-weight: 500; font-family: 'Hind Siliguri', 'Inter', sans-serif;">${tx.note || '-'}</td>
                  <td style="padding: 10px; border-right: 1px solid #e2e8f0; font-family: 'Hind Siliguri', 'Inter', sans-serif;">${cat?.name || 'General'}</td>
                  <td style="padding: 10px; text-align: right; font-weight: 700; color: ${isInc ? '#059669' : '#dc2626'};">
                    ${isInc ? '+' : '-'}${formatCurrency(tx.amount)}
                  </td>
                </tr>
              `;
            }).join('')}
            ${recentTxs.length === 0 ? `
              <tr>
                <td colspan="5" style="padding: 24px; text-align: center; color: #94a3b8; font-style: italic;">No transactions recorded.</td>
              </tr>
            ` : ''}
            <!-- Bottom total strip in Gold matching the reference design -->
            <tr style="background-color: #facc15; font-weight: bold; font-size: 12px; color: #000000; border-top: 2.5px solid #d97706;">
              <td colspan="4" style="padding: 12px; text-transform: uppercase;">Total Active Ledger Volume (সর্বমোট লেনদেন ভলিউম)</td>
              <td style="padding: 12px; text-align: right;">${formatCurrency(totalIncome + totalExpense)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      ${debts.length > 0 ? `
        <div style="display: flex; align-items: center; gap: 8px; margin: 24px 40px 12px 40px; font-size: 15px; font-weight: 700; color: #0f172a;">
          <span style="width: 10px; height: 10px; border-radius: 50%; background-color: #d97706; display: inline-block;"></span> 
          Debts & Loans Summary (দেনা-পাওনা বিবরণী) :
        </div>

        <div style="margin: 0 40px 24px 40px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid #e2e8f0;">
            <thead>
              <tr style="background-color: #cbd5e1; text-align: left; color: #0f172a; font-weight: bold;">
                <th style="padding: 10px 12px; width: 40px; text-align: center; border: 1px solid #cbd5e1;">No.</th>
                <th style="padding: 10px 12px; border: 1px solid #cbd5e1;">Person (ব্যক্তি)</th>
                <th style="padding: 10px 12px; border: 1px solid #cbd5e1;">Type (ধরণ)</th>
                <th style="padding: 10px 12px; border: 1px solid #cbd5e1;">Status (অবস্থা)</th>
                <th style="padding: 10px 12px; width: 140px; text-align: right; border: 1px solid #cbd5e1;">Amount (টাকার পরিমাণ)</th>
              </tr>
            </thead>
            <tbody>
              ${debts.map((d, index) => {
                const isReceivable = d.type === 'receivable';
                const isPaid = d.status === 'paid';
                return `
                  <tr style="background-color: ${index % 2 === 1 ? '#f8fafc' : '#ffffff'}; border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 10px; text-align: center; border-right: 1px solid #e2e8f0; color: #64748b;">${index + 1}.</td>
                    <td style="padding: 10px; border-right: 1px solid #e2e8f0; font-weight: 600; font-family: 'Hind Siliguri', 'Inter', sans-serif;">${d.person}</td>
                    <td style="padding: 10px; border-right: 1px solid #e2e8f0; font-weight: 500;">
                      ${isReceivable ? '<span style="color: #2563eb;">RECEIVABLE (পাবো)</span>' : '<span style="color: #e11d48;">PAYABLE (দেব)</span>'}
                    </td>
                    <td style="padding: 10px; border-right: 1px solid #e2e8f0; font-weight: 600; color: ${isPaid ? '#059669' : '#dc2626'}">
                      ${isPaid ? 'PAID (পরিশোধিত)' : 'UNPAID (বাকি)'}
                    </td>
                    <td style="padding: 10px; text-align: right; font-weight: 700; color: #1e293b;">${formatCurrency(d.amount)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}

      <!-- Note Section identical layout matching reference image -->
      <div style="display: flex; align-items: center; gap: 8px; margin: 24px 40px 8px 40px; font-size: 14px; font-weight: 700; color: #0f172a;">
        <span style="width: 10px; height: 10px; border-radius: 50%; background-color: #d97706; display: inline-block;"></span> Note :
      </div>
      <div style="margin: 0 40px 32px 40px; font-size: 12px; color: #475569; font-family: 'Hind Siliguri', 'Inter', sans-serif; line-height: 1.6;">
        This automated statement contains an all-time summarized report of your assets, liabilities, and income flow records. Rest assured that your transactions are securely serialized locally on your mobile interface ledger structure.
        <br />
         এই বিবরণীতে আপনার অল-টাইম আয়, ব্যয়, সম্পদ এবং দায়সমূহের নিয়মিত হিসাব অন্তর্ভুক্ত করা হয়েছে। এটি সম্পূর্ণ সুরক্ষিত এবং শুধুমাত্র আপনার ডিভাইসের লোকাল স্টোরেজে সংরক্ষিত।
      </div>

      <!-- Bottom footer styling with a real image curved segment in cyan/accent tone -->
      <div style="position: relative; margin-top: 36px; padding: 24px 40px; border-top: 1.5px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #94a3b8; box-sizing: border-box;">
        <div>FinTrack Ledger System © 2026 • Terms & Privacy Assurance</div>
        <div>Page 1 of 1</div>
        <!-- Right corner circular curve match graphic -->
        <div style="position: absolute; bottom: 0; right: 0; width: 60px; height: 60px; border-top-left-radius: 100%; border: 12px solid #3b82f6; border-right: none; border-bottom: none; opacity: 0.25;"></div>
      </div>

    </div>
  `;

  const safeFileName = `FinTrack_Summary_Report_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
  await generateHtmlPdf(htmlContent, { fileName: safeFileName, isThermalReceipt: false });
}

/**
 * Highly Polished, High-Fidelity Corporate Monthly Financial Statement Report creator
 * Matches the reference image provided with beautiful Bengali font rendering using browser canvas proxies.
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
  // Retrieve target month's transactions
  const allTransactions = await db.transactions.where('userId').equals(userId).toArray();
  const filteredTransactions = allTransactions.filter(tx => {
    const txDate = new Date(tx.date);
    return txDate.getFullYear() === year && (txDate.getMonth() + 1) === month;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const categories = await db.categories.where('userId').equals(userId).toArray();

  const incomeItems = filteredTransactions.filter(tx => tx.type === 'income');
  const expenseItems = filteredTransactions.filter(tx => tx.type === 'expense');

  let totalIncome = 0;
  let totalExpense = 0;

  incomeItems.forEach(tx => { totalIncome += tx.amount; });
  expenseItems.forEach(tx => { totalExpense += tx.amount; });

  const netBalance = totalIncome - totalExpense;

  // Render Month names in Bengali & English
  const monthNamesEng = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthNamesBng = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
  const periodStr = `${monthNamesEng[month - 1]} ${year} (${monthNamesBng[month - 1]} ${year})`;

  const htmlContent = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Hind+Siliguri:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
    </style>
    <div style="padding: 30px; background-color: #f8fafc; font-family: 'Inter', 'Hind Siliguri', sans-serif; color: #1e293b; max-width: 794px; margin: 0 auto; box-sizing: border-box;">
      
      <!-- Top banner identical to FINANCES Corporation from reference image -->
      <div style="background-color: #1e3a8a; padding: 24px 40px; color: #ffffff; display: flex; justify-content: space-between; align-items: center; border-radius: 12px 12px 0 0; box-sizing: border-box;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <!-- Hexagon Gold Brand Symbol -->
          <div style="width: 32px; height: 32px; background-color: #facc15; border-radius: 8px; display: flex; align-items: center; justify-content: center; padding: 4px; border: 3px solid #1e3a8a; box-sizing: border-box;">
            <div style="width: 14px; height: 14px; border: 3px solid #ffffff; transform: rotate(45deg);"></div>
          </div>
          <div>
            <div style="font-size: 16px; font-weight: 800; letter-spacing: 0.05em; line-height: 1.1; font-family: 'Inter', sans-serif;">FINTRACK</div>
            <div style="font-size: 10px; opacity: 0.8; letter-spacing: 0.02em; font-family: 'Inter', sans-serif;">Corporation</div>
          </div>
        </div>
        
        <!-- Standard Decorative blue-gray Swiss Grid Dots -->
        <div style="display: flex; flex-direction: column; gap: 4px; opacity: 0.6;">
          <div style="display: flex; gap: 4px;"><div style="width: 4px; height: 4px; background-color: #ffffff; border-radius: 50%;"></div><div style="width: 4px; height: 4px; background-color: #ffffff; border-radius: 50%;"></div><div style="width: 4px; height: 4px; background-color: #ffffff; border-radius: 50%;"></div></div>
          <div style="display: flex; gap: 4px;"><div style="width: 4px; height: 4px; background-color: #ffffff; border-radius: 50%;"></div><div style="width: 4px; height: 4px; background-color: #ffffff; border-radius: 50%;"></div><div style="width: 4px; height: 4px; background-color: #ffffff; border-radius: 50%;"></div></div>
          <div style="display: flex; gap: 4px;"><div style="width: 4px; height: 4px; background-color: #ffffff; border-radius: 50%;"></div><div style="width: 4px; height: 4px; background-color: #ffffff; border-radius: 50%;"></div><div style="width: 4px; height: 4px; background-color: #ffffff; border-radius: 50%;"></div></div>
        </div>
      </div>

      <!-- Heading matching the styling: Income Expense Report in yellow/gold accent -->
      <div style="padding: 28px 40px 10px 40px;">
        <h1 style="color: #d97706; font-size: 32px; font-weight: 900; margin: 0 0 4px 0; letter-spacing: -0.02em; font-family: 'Inter', sans-serif;">Income Expense Report</h1>
        <p style="font-size: 14px; color: #64748b; margin: 0 0 16px 0; font-weight: 500;">মাসিক অর্থনৈতিক আয় ও ব্যয় প্রতিবেদন</p>
      </div>

      <!-- Prepared Information box matching the layout of reference image -->
      <div style="margin: 0 40px 24px 40px; padding: 18px 24px; background-color: #f1f5f9; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; border: 1.5px solid #e2e8f0; font-size: 13px;">
        <div style="line-height: 1.5;">
          <p style="margin: 0 0 4px 0; color: #1e293b;"><strong style="color: #0f172a; font-weight: 700;">Prepared by:</strong> ${userName}</p>
          ${phoneNumber ? `<p style="margin: 0 0 4px 0; color: #1e293b;"><strong style="color: #0f172a; font-weight: 700;">Phone (ফোন):</strong> ${phoneNumber}</p>` : ''}
          ${companyName ? `<p style="margin: 0 0 4px 0; color: #1e293b;"><strong style="color: #0f172a; font-weight: 700;">Company/Dept (কোম্পানি/শাখা):</strong> ${companyName}</p>` : ''}
          <p style="margin: 0; color: #1e293b;"><strong style="color: #0f172a; font-weight: 700;">Department:</strong> Finance Ledger</p>
        </div>
        <div style="text-align: right;">
          <p style="margin: 0; font-size: 14px; font-weight: 700; color: #2563eb;">
            <span style="color: #1e3a8a;">Period:</span> ${periodStr}
          </p>
          <p style="margin: 4px 0 0 0; font-size: 10px; color: #64748b;">Report Generated: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}</p>
        </div>
      </div>

      <!-- Gold circle Bullet points identical to image -->
      <div style="display: flex; align-items: center; gap: 8px; margin: 24px 40px 12px 40px; font-size: 15px; font-weight: 700; color: #0f172a;">
        <span style="width: 10px; height: 10px; border-radius: 50%; background-color: #d97706; display: inline-block;"></span> 
        Income Details (আয় বিবরণী) :
      </div>

      <!-- Income table from image -->
      <div style="margin: 0 40px 24px 40px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid #e2e8f0;">
          <thead>
            <tr style="background-color: #ebd39e; text-align: left; color: #0f172a; font-weight: bold; font-family: 'Inter', sans-serif;">
              <th style="padding: 10px 12px; width: 60px; text-align: center; border: 1px solid #cbd5e1; background-color: #e2e8f0;">No.</th>
              <th style="padding: 10px 12px; border: 1px solid #cbd5e1; background-color: #e2e8f0;">Income Description</th>
              <th style="padding: 10px 12px; width: 140px; text-align: right; border: 1px solid #cbd5e1; background-color: #e2e8f0;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${incomeItems.map((tx, idx) => {
              const cat = categories.find(c => c.id === tx.categoryId);
              return `
                <tr style="background-color: ${idx % 2 === 1 ? '#f8fafc' : '#ffffff'}; border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px; text-align: center; border-right: 1px solid #e2e8f0; color: #64748b;">${idx + 1}.</td>
                  <td style="padding: 10px; border-right: 1px solid #e2e8f0; font-family: 'Hind Siliguri', 'Inter', sans-serif; font-weight: 500;">
                    ${cat?.name || 'Uncategorized'} ${tx.note ? ` - <span style="font-size: 11px; color:#64748b; font-weight: normal;">${tx.note}</span>` : ''}
                    <span style="font-size: 10px; color: #94a3b8; font-weight: 300; margin-left: 8px;">(${format(new Date(tx.date), 'dd MMM')})</span>
                  </td>
                  <td style="padding: 10px; text-align: right; font-weight: 700; color: #0f172a;">${formatCurrency(tx.amount)}</td>
                </tr>
              `;
            }).join('')}
            ${incomeItems.length === 0 ? `
              <tr>
                <td colspan="3" style="padding: 20px; text-align: center; color: #94a3b8; font-style: italic;">No income transactions recorded for this period. (কোন আয় পাওয়া যায়নি)</td>
              </tr>
            ` : ''}
            <!-- Bottom SOLID yellow total strip exactly like the image -->
            <tr style="background-color: #facc15; font-weight: 800; font-size: 13px; color: #000000; border-top: 2px solid #d97706;">
              <td colspan="2" style="padding: 12px; text-transform: uppercase; font-family: 'Inter', sans-serif;">TOTAL INCOME (সর্বমোট আয়)</td>
              <td style="padding: 12px; text-align: right; font-family: 'Inter', sans-serif;">${formatCurrency(totalIncome)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Expense details header gold circle -->
      <div style="display: flex; align-items: center; gap: 8px; margin: 24px 40px 12px 40px; font-size: 15px; font-weight: 700; color: #0f172a;">
        <span style="width: 10px; height: 10px; border-radius: 50%; background-color: #d97706; display: inline-block;"></span> 
        Expense Details (ব্যয় বিবরণী) :
      </div>

      <!-- Expense table from image -->
      <div style="margin: 0 40px 24px 40px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid #e2e8f0;">
          <thead>
            <tr style="background-color: #ebd39e; text-align: left; color: #0f172a; font-weight: bold; font-family: 'Inter', sans-serif;">
              <th style="padding: 10px 12px; width: 60px; text-align: center; border: 1px solid #cbd5e1; background-color: #e2e8f0;">No.</th>
              <th style="padding: 10px 12px; border: 1px solid #cbd5e1; background-color: #e2e8f0;">Expense Description</th>
              <th style="padding: 10px 12px; width: 140px; text-align: right; border: 1px solid #cbd5e1; background-color: #e2e8f0;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${expenseItems.map((tx, idx) => {
              const cat = categories.find(c => c.id === tx.categoryId);
              return `
                <tr style="background-color: ${idx % 2 === 1 ? '#f8fafc' : '#ffffff'}; border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px; text-align: center; border-right: 1px solid #e2e8f0; color: #64748b;">${idx + 1}.</td>
                  <td style="padding: 10px; border-right: 1px solid #e2e8f0; font-family: 'Hind Siliguri', 'Inter', sans-serif; font-weight: 500;">
                    ${cat?.name || 'Uncategorized'} ${tx.note ? ` - <span style="font-size: 11px; color:#64748b; font-weight: normal;">${tx.note}</span>` : ''}
                    <span style="font-size: 10px; color: #94a3b8; font-weight: 300; margin-left: 8px;">(${format(new Date(tx.date), 'dd MMM')})</span>
                  </td>
                  <td style="padding: 10px; text-align: right; font-weight: 700; color: #0f172a;">${formatCurrency(tx.amount)}</td>
                </tr>
              `;
            }).join('')}
            ${expenseItems.length === 0 ? `
              <tr>
                <td colspan="3" style="padding: 20px; text-align: center; color: #94a3b8; font-style: italic;">No expense transactions recorded for this period. (কোন ব্যয় পাওয়া যায়নি)</td>
              </tr>
            ` : ''}
            <!-- Bottom SOLID yellow total strip exactly like the image -->
            <tr style="background-color: #facc15; font-weight: 800; font-size: 13px; color: #000000; border-top: 2px solid #d97706;">
              <td colspan="2" style="padding: 12px; text-transform: uppercase; font-family: 'Inter', sans-serif;">TOTAL EXPENSE (সর্বমোট ব্যয়)</td>
              <td style="padding: 12px; text-align: right; font-family: 'Inter', sans-serif;">${formatCurrency(totalExpense)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Net profit / balance stats -->
      <div style="margin: 24px 40px; padding: 12px 20px; background-color: ${netBalance >= 0 ? '#ecfdf5' : '#fef2f2'}; border: 1.5px solid ${netBalance >= 0 ? '#a7f3d0' : '#fecaca'}; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
        <span style="font-weight: 700; color: ${netBalance >= 0 ? '#047857' : '#b91c1c'}">NET BALANCE / PROFIT (নিট মুনাফা / অবশিষ্ট) :</span>
        <span style="font-size: 15px; font-weight: 900; color: ${netBalance >= 0 ? '#065f46' : '#991b1b'}">${formatCurrency(netBalance)}</span>
      </div>

      <!-- Note Section from image -->
      <div style="display: flex; align-items: center; gap: 8px; margin: 24px 40px 8px 40px; font-size: 14px; font-weight: 700; color: #0f172a;">
        <span style="width: 10px; height: 10px; border-radius: 50%; background-color: #d97706; display: inline-block;"></span> Note :
      </div>
      <div style="margin: 0 40px 32px 40px; font-size: 12px; color: #475569; font-family: 'Hind Siliguri', 'Inter', sans-serif; line-height: 1.6;">
        This financial report analyzes the income, expenses, and net profit for the specified period. Generated securely on FinTrack Ledger.
        <br />
        এই আর্থিক প্রতিবেদনটি উপরোক্ত নির্দিষ্ট সময়ের আয়, ব্যয় এবং নিট অবশিষ্ট মুনাফা বিশ্লেষণ করে। বিবরণীটি অত্যন্ত নির্ভুলভাবে আপনার অ্যাকাউন্ট ডেটা ভিত্তি করে প্রস্তুত করা হয়েছে।
      </div>

      <!-- Bottom footer graphics with curved corner segments like the template image -->
      <div style="position: relative; margin-top: 36px; padding: 24px 40px; border-top: 1.5px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #94a3b8; box-sizing: border-box;">
        <div>FinTrack Ledger System © 2026 • Generation Code: FX-68-SEC</div>
        <div>Page 1 of 1</div>
        <!-- Bottom right curve mimicking the image -->
        <div style="position: absolute; bottom: 0; right: 0; width: 60px; height: 60px; border-top-left-radius: 100%; border: 12px solid #3b82f6; border-right: none; border-bottom: none; opacity: 0.25;"></div>
      </div>

    </div>
  `;

  const formattedPeriodName = monthNamesEng[month - 1].toLowerCase();
  const safeFileName = `FinTrack_Report_${formattedPeriodName}_${year}.pdf`;
  await generateHtmlPdf(htmlContent, { fileName: safeFileName, isThermalReceipt: false });
}
