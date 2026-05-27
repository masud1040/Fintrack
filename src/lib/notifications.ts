import { db, AppNotification } from '../db';
import { startOfMonth, endOfMonth, subMonths, isBefore, startOfDay, format, isAfter, isSameDay, addDays, addWeeks, addMonths, addYears, set, setDay } from 'date-fns';
import { formatCurrency } from './utils';

export function triggerSystemNotification(title: string, message: string) {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'granted') {
      try {
        new Notification(title, { body: message });
      } catch (err) {
        console.warn('System Notification display failed:', err);
      }
    }
  }
}

async function addNotification(data: AppNotification) {
  try {
    await db.notifications.add(data);
    triggerSystemNotification(data.title, data.message);
  } catch (err) {
    console.warn('Failed to add notification:', err);
  }
}

export async function checkAndGenerateNotifications(userId: number | string) {
  const now = new Date();
  const today = startOfDay(now);

  // 1. Check for Overdue Debts
  const overdueDebts = await db.debts
    .where('userId').equals(userId)
    .and(d => d.status === 'unpaid' && isBefore(startOfDay(new Date(d.date)), today))
    .toArray();

  for (const debt of overdueDebts) {
    const exists = await db.notifications
      .where({ userId, title: `Overdue Debt: ${debt.person}` })
      .first();
    
    if (!exists) {
      await addNotification({
        userId,
        title: `Overdue Debt: ${debt.person}`,
        message: `You have an unpaid ${debt.type} of ${formatCurrency(debt.amount)} from ${format(new Date(debt.date), 'MMM d')}.`,
        type: 'warning',
        date: now,
        read: false,
        link: 'debts'
      });
    }
  }

  // 1.1 Check for Debts Due Tomorrow
  const tomorrow = startOfDay(addDays(now, 1));
  const upcomingDebts = await db.debts
    .where('userId').equals(userId)
    .and(d => d.status === 'unpaid' && d.dueDate !== undefined && isSameDay(new Date(d.dueDate), tomorrow))
    .toArray();

  for (const debt of upcomingDebts) {
    const reminderTitle = `Debt Due Tomorrow: ${debt.person}`;
    const exists = await db.notifications
      .where({ userId, title: reminderTitle })
      .and(n => isSameDay(new Date(n.date), now))
      .first();

    if (!exists) {
      await addNotification({
        userId,
        title: reminderTitle,
        message: `Reminder: You have a ${debt.type === 'payable' ? 'payment' : 'collection'} of ${formatCurrency(debt.amount)} due tomorrow with ${debt.person}.`,
        type: 'warning',
        date: now,
        read: false,
        link: 'debts'
      });
    }
  }

  // 2. Check for Upcoming Recurring Transactions (Next 24 hours)
  const recurring = await db.recurringTransactions.where('userId').equals(userId).toArray();
  for (const rt of recurring) {
    let nextDate = rt.lastGeneratedDate 
      ? getNextOccurrence(rt.lastGeneratedDate, rt.frequency)
      : startOfDay(new Date(rt.startDate));

    // Align to dueDate if specified
    if (rt.dueDate !== undefined) {
      if (rt.frequency === 'monthly') {
        nextDate = set(nextDate, { date: rt.dueDate });
      } else if (rt.frequency === 'weekly') {
        nextDate = setDay(nextDate, rt.dueDate);
      }
    }

    const oneDayFromNow = addDays(now, 1);

    if (isAfter(nextDate, now) && isBefore(nextDate, oneDayFromNow)) {
      const category = await db.categories.get(rt.categoryId);
      const upcomingTitle = `Upcoming: ${category?.name || 'Transaction'}`;
      
      const exists = await db.notifications
        .where({ userId, title: upcomingTitle })
        .and(n => isSameDay(new Date(n.date), now))
        .first();

      if (!exists) {
        await addNotification({
          userId,
          title: upcomingTitle,
          message: `Your recurring ${rt.type} of ${formatCurrency(rt.amount)} is due tomorrow.`,
          type: 'info',
          date: now,
          read: false,
          link: 'transactions'
        });
      }
    }
  }

  // 3. Monthly Report (Check on the 1st of every month)
  if (now.getDate() === 1) {
    const lastMonth = subMonths(now, 1);
    const monthYear = format(lastMonth, 'MMMM yyyy');
    const reportTitle = `Monthly Report: ${monthYear}`;
    
    const reportExists = await db.notifications
      .where({ userId, title: reportTitle })
      .first();

    if (!reportExists) {
      const start = startOfMonth(lastMonth);
      const end = endOfMonth(lastMonth);
      
      const txs = await db.transactions
        .where('userId').equals(userId)
        .and(t => isAfter(new Date(t.date), start) && isBefore(new Date(t.date), end))
        .toArray();

      const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const savings = income - expense;

      await addNotification({
        userId,
        title: reportTitle,
        message: `Last month summary: Income ${formatCurrency(income)}, Expense ${formatCurrency(expense)}. Savings: ${formatCurrency(savings)}.`,
        type: 'report',
        date: now,
        read: false,
        link: 'analytics'
      });
    }
  }

  // 4. Income Decrease Check
  if (now.getDate() >= 25) {
    const currentMonthStart = startOfMonth(now);
    const prevMonthStart = startOfMonth(subMonths(now, 1));
    const prevMonthEnd = endOfMonth(subMonths(now, 1));

    const currentTxs = await db.transactions
      .where('userId').equals(userId)
      .and(t => t.type === 'income' && isAfter(new Date(t.date), currentMonthStart))
      .toArray();

    const prevTxs = await db.transactions
      .where('userId').equals(userId)
      .and(t => t.type === 'income' && isAfter(new Date(t.date), prevMonthStart) && isBefore(new Date(t.date), prevMonthEnd))
      .toArray();

    const currentIncome = currentTxs.reduce((s, t) => s + t.amount, 0);
    const prevIncome = prevTxs.reduce((s, t) => s + t.amount, 0);

    if (prevIncome > 0 && currentIncome < prevIncome * 0.8) { // 20% drop
      const incomeDropTitle = `Income Alert: ${format(now, 'MMMM')}`;
      const exists = await db.notifications
        .where({ userId, title: incomeDropTitle })
        .first();

      if (!exists) {
        await addNotification({
          userId,
          title: incomeDropTitle,
          message: `Your income this month (${formatCurrency(currentIncome)}) is significantly lower than last month (${formatCurrency(prevIncome)}).`,
          type: 'warning',
          date: now,
          read: false,
          link: 'analytics'
        });
      }
    }
  }

  // 5. Expense vs Income Check (Current Month)
  const currentMonthStart = startOfMonth(now);
  const currentMonthTxs = await db.transactions
    .where('userId').equals(userId)
    .and(t => isAfter(new Date(t.date), currentMonthStart))
    .toArray();

  const currentIncome = currentMonthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const currentExpense = currentMonthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  if (currentExpense > currentIncome && currentIncome > 0) {
    const warningTitle = `Budget Alert: ${format(now, 'MMMM')}`;
    const exists = await db.notifications
      .where({ userId, title: warningTitle })
      .and(n => isSameDay(new Date(n.date), now))
      .first();

    if (!exists) {
      await addNotification({
        userId,
        title: warningTitle,
        message: `Your expenses (${formatCurrency(currentExpense)}) have exceeded your income (${formatCurrency(currentIncome)}) this month.`,
        type: 'warning',
        date: now,
        read: false,
        link: 'dashboard'
      });
    }
  }

  // 6. Critical Total Balance Check
  const accounts = await db.accounts.where('userId').equals(userId).toArray();
  const totalBalance = accounts.reduce((sum, acc) => sum + acc.currentBalance, 0);

  if (totalBalance < 200) {
    const criticalBalanceTitle = `Critical Balance Alert`;
    const exists = await db.notifications
      .where({ userId, title: criticalBalanceTitle })
      .and(n => isSameDay(new Date(n.date), now))
      .first();

    if (!exists) {
      await addNotification({
        userId,
        title: criticalBalanceTitle,
        message: `Your total balance (${formatCurrency(totalBalance)}) is below $200. Please add funds to your accounts.`,
        type: 'warning',
        date: now,
        read: false,
        link: 'accounts'
      });
    }
  }
}

function getNextOccurrence(date: Date, frequency: string): Date {
  const d = new Date(date);
  switch (frequency) {
    case 'daily': return addDays(d, 1);
    case 'weekly': return addWeeks(d, 1);
    case 'monthly': return addMonths(d, 1);
    case 'yearly': return addYears(d, 1);
    default: return d;
  }
}
