import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { formatCurrency, cn } from '../lib/utils';
import { motion } from 'motion/react';
import { Bell, ArrowDownLeft, ArrowUpRight, Users, Eye, EyeOff, AlertTriangle, ShoppingBag } from 'lucide-react';
import { format, startOfMonth } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';

export function Dashboard({ onAddTransaction, onNavigateToProfile, onNavigateToDebts, onNavigateToBazar }: { onAddTransaction: () => void, onNavigateToProfile?: () => void, onNavigateToDebts?: () => void, onNavigateToBazar?: () => void }) {
  const { currentUser } = useAuth();
  const [showBalance, setShowBalance] = useState(true);
  
  const accounts = useLiveQuery(
    () => currentUser ? db.accounts.where('userId').equals(currentUser.id!).toArray() : [],
    [currentUser?.id]
  ) || [];
  
  const transactions = useLiveQuery(
    () => currentUser ? db.transactions.where('userId').equals(currentUser.id!).reverse().sortBy('date').then(arr => arr.slice(0, 5)) : [],
    [currentUser?.id]
  ) || [];
  
  const categories = useLiveQuery(
    () => currentUser ? db.categories.where('userId').equals(currentUser.id!).toArray() : [],
    [currentUser?.id]
  ) || [];

  const totalBalance = accounts.reduce((sum, acc) => sum + acc.currentBalance, 0);
  const isLowBalance = totalBalance < 500;
  
  // Calculate total income and expense for the current month
  const currentMonthStart = startOfMonth(new Date());
  
  const monthlyTxs = useLiveQuery(
    () => currentUser ? db.transactions.where('userId').equals(currentUser.id!).and(t => new Date(t.date) >= currentMonthStart).toArray() : [],
    [currentUser?.id]
  ) || [];

  const totalIncome = monthlyTxs
    .filter(tx => tx.type === 'income')
    .reduce((sum, tx) => sum + tx.amount, 0);
    
  const totalExpense = monthlyTxs
    .filter(tx => tx.type === 'expense')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalVolume = totalIncome + totalExpense;
  const incomePercentage = totalVolume > 0 ? Math.round((totalIncome / totalVolume) * 100) : 0;
  const expensePercentage = totalVolume > 0 ? Math.round((totalExpense / totalVolume) * 100) : 0;

  const isExpenseWarning = totalExpense > totalIncome && totalIncome > 0;

  const getCategory = (id: number) => categories.find(c => c.id === id);

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <header className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-3">
          <div 
            className="w-12 h-12 rounded-full overflow-hidden bg-violet-100 border-2 border-white shadow-sm cursor-pointer hover:opacity-80 transition-opacity"
            onClick={onNavigateToProfile}
          >
            <img 
              src={currentUser?.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=Guest&backgroundColor=b6e3f4"} 
              alt="User" 
              className="w-full h-full object-cover" 
              referrerPolicy="no-referrer" 
            />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Good Morning</p>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
              {currentUser?.name || 'Guest'}
            </h1>
          </div>
        </div>
      </header>

      {/* Balance Card */}
      <motion.div
        layout
        className={cn(
          "rounded-[2rem] p-6 text-white shadow-xl relative overflow-hidden transition-colors duration-500",
          isLowBalance ? "bg-red-600 shadow-red-500/20" : "bg-[#2A2B3E]"
        )}
      >
        {/* Decorative background elements */}
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/5 rounded-full blur-2xl"></div>
        <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-violet-500/20 rounded-full blur-2xl"></div>
        
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <p className="text-slate-300 text-sm font-medium">Total Balance</p>
              {isLowBalance && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-white/20 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  <AlertTriangle size={10} /> Low
                </span>
              )}
            </div>
            <button 
              onClick={() => setShowBalance(!showBalance)}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors"
            >
              {showBalance ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
          </div>
          <h2 className="text-4xl font-bold tracking-tight mb-8">
            {showBalance 
              ? `$${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : '••••••••'
            }
          </h2>
          
          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                <ArrowDownLeft size={20} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-slate-300 font-medium mb-0.5">Income ({incomePercentage}%)</p>
                <p className="text-base font-bold">${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                <ArrowUpRight size={20} className="text-red-400" />
              </div>
              <div>
                <p className="text-xs text-slate-300 font-medium mb-0.5">Expense ({expensePercentage}%)</p>
                <p className="text-base font-bold">${totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Expense Warning */}
      {isExpenseWarning && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-4 rounded-3xl flex items-center gap-4"
        >
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div>
            <p className="text-sm font-bold text-red-900 dark:text-red-100">Budget Alert!</p>
            <p className="text-xs text-red-700 dark:text-red-300">Your expenses this month have exceeded your income. Consider reviewing your spending.</p>
          </div>
        </motion.div>
      )}

      {/* Quick Actions */}
      <section className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <button 
          onClick={onAddTransaction}
          className="bg-white dark:bg-slate-900 p-4 rounded-3xl shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border border-slate-100 dark:border-slate-800"
        >
          <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 flex items-center justify-center">
            <ArrowUpRight size={24} />
          </div>
          <span className="font-medium text-slate-900 dark:text-white text-sm">Add Transaction</span>
        </button>
        
        <button 
          onClick={onNavigateToDebts}
          className="bg-white dark:bg-slate-900 p-4 rounded-3xl shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border border-slate-100 dark:border-slate-800"
        >
          <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center">
            <Users size={24} />
          </div>
          <span className="font-medium text-slate-900 dark:text-white text-sm">Debit/Credit (দেনা পাওনা)</span>
        </button>

        <button 
          onClick={onNavigateToBazar}
          className="bg-white dark:bg-slate-900 p-4 rounded-3xl shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border border-slate-100 dark:border-slate-800 col-span-2 md:col-span-1"
        >
          <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <ShoppingBag size={24} />
          </div>
          <span className="font-medium text-slate-900 dark:text-white text-sm">Bazar List (বাজার তালিকা)</span>
        </button>
      </section>

      {/* Transactions Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Transactions</h3>
          <button 
            onClick={() => onAddTransaction()}
            className="text-sm text-slate-400 font-medium hover:text-slate-600 dark:hover:text-slate-300"
          >
            See All
          </button>
        </div>
        
        <div className="space-y-3">
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-3xl">
              {currentUser ? 'No transactions yet.' : 'Please log in to see your transactions.'}
            </div>
          ) : (
            transactions.map(tx => {
              const category = getCategory(tx.categoryId);
              const isExpense = tx.type === 'expense';

              return (
                <div key={tx.id} className="p-4 bg-white dark:bg-slate-900 rounded-3xl flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden p-2 border border-slate-100 dark:border-slate-700">
                      {/* Placeholder for brand logos based on category name, fallback to initial */}
                      <span className="font-bold text-slate-700 dark:text-slate-300 text-lg">
                        {category?.name.charAt(0).toUpperCase() || 'T'}
                      </span>
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white text-base">
                        {tx.note || category?.name || 'Store'}
                      </p>
                      <p className="text-xs text-slate-400 font-medium mt-0.5">
                        {category?.name || 'Category'} • {format(tx.date, 'dd MMMM yyyy')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={cn(
                      "font-bold text-base",
                      isExpense ? "text-slate-900 dark:text-white" : "text-emerald-500"
                    )}>
                      {isExpense ? '-' : '+'}${tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
