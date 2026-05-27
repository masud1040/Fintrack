import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { processRecurringTransactions } from '../lib/recurring';
import { checkAndGenerateNotifications } from '../lib/notifications';

export function RecurringProcessor() {
  const { currentUser } = useAuth();

  useEffect(() => {
    if (currentUser?.id) {
      processRecurringTransactions(currentUser.id);
      checkAndGenerateNotifications(currentUser.id);
      
      // Check every hour if the app stays open
      const interval = setInterval(() => {
        processRecurringTransactions(currentUser.id!);
        checkAndGenerateNotifications(currentUser.id!);
      }, 1000 * 60 * 60);

      return () => clearInterval(interval);
    }
  }, [currentUser?.id]);

  return null;
}
