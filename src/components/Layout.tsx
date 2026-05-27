import { useState, useEffect } from 'react';
import { Home, CreditCard, Equal, Calendar, User, Moon, Sun, Bell, AlertCircle, StickyNote, ShoppingBag } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { NotificationCenter } from './NotificationCenter';
import { RecurringProcessor } from './RecurringProcessor';

interface LayoutProps {
  children: React.ReactNode;
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export function Layout({ children, currentTab, setCurrentTab }: LayoutProps) {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved) {
        return saved === 'dark';
      }
      // If no saved preference, check system preference
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });
  const { currentUser } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  const unreadNotifications = useLiveQuery(
    () => currentUser ? db.notifications.where('userId').equals(currentUser.id!).and(n => !n.read).toArray() : [],
    [currentUser?.id]
  ) || [];

  const unreadCount = unreadNotifications.length;

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const navItems: Array<{ id: string; icon: any; isFab?: boolean }> = [
    { id: 'dashboard', icon: Home },
    { id: 'accounts', icon: CreditCard },
    { id: 'bazar', icon: ShoppingBag },
    { id: 'transactions', icon: Calendar },
    { id: 'notes', icon: StickyNote },
    { id: 'profile', icon: User },
  ];

  const handleTabClick = (id: string) => {
    if (id === 'menu') {
      // Toggle a menu or just navigate
      setCurrentTab('transactions');
    } else {
      setCurrentTab(id);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50 transition-colors duration-300 flex flex-col md:flex-row font-sans">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shrink-0">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
            FinTrack
          </h1>
          <button
            onClick={() => setIsDark(!isDark)}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button
            onClick={() => setIsNotificationOpen(true)}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-900" />
            )}
          </button>
        </div>
        
        <nav className="flex-1 space-y-2 relative">
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={cn(
                  "w-full flex items-center space-x-3 px-4 py-3 rounded-2xl transition-all duration-200 relative overflow-hidden",
                  isActive
                    ? "text-violet-600 dark:text-violet-400 font-bold"
                    : "text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-600 dark:hover:text-slate-300"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="desktopActiveTab"
                    className="absolute inset-0 bg-violet-50 dark:bg-violet-500/10 -z-10"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
                <item.icon size={20} className={cn(item.isFab && "text-slate-400")} />
                <span className="capitalize">{item.id}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-24 md:pb-0 relative">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 bg-white dark:bg-slate-950 sticky top-0 z-40 border-b border-slate-100 dark:border-slate-900">
          <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
            FinTrack
          </h1>
          <button
            onClick={() => setIsNotificationOpen(true)}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative"
          >
            <Bell size={22} className="text-slate-600 dark:text-slate-400" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-950" />
            )}
          </button>
        </header>

        {/* Mobile Theme Toggle */}
        <div className="md:hidden fixed bottom-28 right-6 z-50">
          <button
            onClick={() => setIsDark(!isDark)}
            className="w-12 h-12 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center shadow-lg border border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 transition-transform active:scale-95"
          >
            {isDark ? <Sun size={24} /> : <Moon size={24} />}
          </button>
        </div>
        
        <div className="p-4 md:p-8 max-w-md mx-auto md:max-w-5xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Bottom Nav for Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 pb-6 pt-2 px-6 z-50 rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.05)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.2)]">
        <div className="flex justify-between items-center relative h-12">
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            
            if (item.isFab) {
              return (
                <motion.div 
                  key={item.id} 
                  className="relative"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <button
                    onClick={() => handleTabClick(item.id)}
                    className="w-10 h-10 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full flex items-center justify-center transition-transform"
                  >
                    <item.icon size={18} strokeWidth={2} />
                  </button>
                </motion.div>
              );
            }

            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className="relative p-3 flex flex-col items-center justify-center group"
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    className="absolute -top-6 w-12 h-12 bg-violet-600 rounded-full shadow-lg shadow-violet-500/40 -z-10"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
                
                <motion.div
                  animate={{
                    y: isActive ? -24 : 0,
                    color: isActive ? '#ffffff' : (isDark ? '#475569' : '#cbd5e1'),
                    scale: isActive ? 1.1 : 1
                  }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  className="relative z-10"
                >
                  <item.icon 
                    size={24} 
                    strokeWidth={isActive ? 2.5 : 2} 
                  />
                </motion.div>

                {isActive && (
                  <motion.span
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 4 }}
                    className="text-[10px] font-bold text-violet-600 absolute top-6"
                  >
                    {item.id.charAt(0).toUpperCase() + item.id.slice(1)}
                  </motion.span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Notification Center */}
      <NotificationCenter 
        isOpen={isNotificationOpen} 
        onClose={() => setIsNotificationOpen(false)} 
        onNavigate={setCurrentTab}
      />

      {/* Background Processors */}
      <RecurringProcessor />

      {/* Warning Modal */}
      <AnimatePresence>
        {showWarning && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl"
            >
              <div className="w-16 h-16 bg-orange-100 dark:bg-orange-500/20 text-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-xl font-bold text-center text-slate-900 dark:text-white mb-2">
                Account Required
              </h3>
              <p className="text-center text-slate-500 dark:text-slate-400 mb-6">
                Please log in or create an account to start adding your financial data.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowWarning(false)}
                  className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowWarning(false);
                    setCurrentTab('profile');
                  }}
                  className="flex-1 py-3 rounded-xl bg-[#ff6b4a] text-white font-bold hover:bg-[#ff5733] transition-colors"
                >
                  Create Account
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
