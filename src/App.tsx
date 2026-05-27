/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Accounts } from './components/Accounts';
import { Transactions } from './components/Transactions';
import { Analytics } from './components/Analytics';
import { Debts } from './components/Debts';
import { Notes } from './components/Notes';
import { BazarLists } from './components/BazarLists';
import { Profile } from './components/Profile';
import { AuthProvider } from './contexts/AuthContext';
import { RecurringProcessor } from './components/RecurringProcessor';

export default function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission().catch(err => {
          console.warn('System Notification permissions rejected:', err);
        });
      }
    }
  }, []);

  const renderContent = () => {
    switch (currentTab) {
      case 'dashboard':
        return <Dashboard onAddTransaction={() => setCurrentTab('transactions')} onNavigateToProfile={() => setCurrentTab('profile')} onNavigateToDebts={() => setCurrentTab('debts')} onNavigateToBazar={() => setCurrentTab('bazar')} />;
      case 'accounts':
        return <Accounts />;
      case 'transactions':
        return <Transactions />;
      case 'analytics':
        return <Analytics />;
      case 'debts':
        return <Debts />;
      case 'notes':
        return <Notes />;
      case 'bazar':
        return <BazarLists />;
      case 'profile':
        return <Profile />;
      default:
        return <Dashboard onAddTransaction={() => setCurrentTab('transactions')} onNavigateToProfile={() => setCurrentTab('profile')} onNavigateToDebts={() => setCurrentTab('debts')} onNavigateToBazar={() => setCurrentTab('bazar')} />;
    }
  };

  return (
    <AuthProvider>
      <RecurringProcessor />
      <Layout currentTab={currentTab} setCurrentTab={setCurrentTab}>
        {renderContent()}
      </Layout>
    </AuthProvider>
  );
}
