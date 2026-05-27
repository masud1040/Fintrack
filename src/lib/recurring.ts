import { db, RecurringTransaction, Frequency } from '../db';
import { addDays, addWeeks, addMonths, addYears, isBefore, isAfter, startOfDay, isEqual, set, setDay } from 'date-fns';

export async function processRecurringTransactions(userId: number | string) {
  const recurring = await db.recurringTransactions.where('userId').equals(userId).toArray();
  const now = startOfDay(new Date());

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

    // If startDate is in the future, don't generate yet
    if (isAfter(nextDate, now)) continue;

    const generatedTransactions = [];
    const lastGeneratedDate = rt.lastGeneratedDate ? new Date(rt.lastGeneratedDate) : null;

    while (isBefore(nextDate, now) || isEqual(nextDate, now)) {
      // Check if we passed the end date
      if (rt.endDate && isAfter(nextDate, startOfDay(new Date(rt.endDate)))) break;

      // Avoid duplicates if something went wrong (though the loop logic should handle it)
      if (lastGeneratedDate && (isBefore(nextDate, lastGeneratedDate) || isEqual(nextDate, lastGeneratedDate))) {
          nextDate = getNextOccurrence(nextDate, rt.frequency);
          continue;
      }

      generatedTransactions.push({
        userId: rt.userId,
        amount: rt.amount,
        type: rt.type,
        categoryId: rt.categoryId,
        accountId: rt.accountId,
        date: new Date(nextDate),
        note: rt.note ? `[Recurring] ${rt.note}` : '[Recurring]',
      });

      const currentNext = nextDate;
      nextDate = getNextOccurrence(nextDate, rt.frequency);
      
      // Update the recurring transaction record's lastGeneratedDate
      await db.recurringTransactions.update(rt.id!, { lastGeneratedDate: currentNext });
    }

    if (generatedTransactions.length > 0) {
      await db.transactions.bulkAdd(generatedTransactions);
      
      // Update account balances
      for (const t of generatedTransactions) {
        const account = await db.accounts.get(t.accountId);
        if (account) {
          const newBalance = t.type === 'income' 
            ? account.currentBalance + t.amount 
            : account.currentBalance - t.amount;
          await db.accounts.update(t.accountId, { currentBalance: newBalance });
        }
      }
    }
  }
}

function getNextOccurrence(date: Date, frequency: Frequency): Date {
  switch (frequency) {
    case 'daily': return addDays(date, 1);
    case 'weekly': return addWeeks(date, 1);
    case 'monthly': return addMonths(date, 1);
    case 'yearly': return addYears(date, 1);
  }
}
