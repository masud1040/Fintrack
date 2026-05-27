import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { formatCurrency } from '../lib/utils';
import { Card } from './ui/Card';
import { Plus, Wallet, Trash2, Eye, EyeOff, Edit2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { Account } from '../db';
import { ConfirmModal } from './ui/ConfirmModal';

export function Accounts() {
  const { currentUser } = useAuth();
  const [isAdding, setIsAdding] = useState(false);
  const [showBalance, setShowBalance] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('Bank');
  const [initialBalance, setInitialBalance] = useState('');
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('');
  const [editBalance, setEditBalance] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const accounts = useLiveQuery(
    () => currentUser ? db.accounts.where('userId').equals(currentUser.id!).toArray() : [],
    [currentUser?.id]
  ) || [];

  const totalBalance = accounts.reduce((sum, acc) => sum + acc.currentBalance, 0);

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !initialBalance || !currentUser?.id) return;

    await db.accounts.add({
      userId: currentUser.id,
      name,
      type,
      initialBalance: Number(initialBalance),
      currentBalance: Number(initialBalance),
    });

    setName('');
    setInitialBalance('');
    setIsAdding(false);
  };

  const handleEditAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount?.id || !editName || editBalance === '') return;

    await db.accounts.update(editingAccount.id, {
      name: editName,
      type: editType,
      currentBalance: Number(editBalance),
    });

    setEditingAccount(null);
  };

  const startEditing = (account: Account) => {
    setEditingAccount(account);
    setEditName(account.name);
    setEditType(account.type);
    setEditBalance(account.currentBalance.toString());
  };

  const handleDelete = async (id: number) => {
    await db.accounts.delete(id);
  };

  if (!currentUser) {
    return (
      <div className="p-8 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-3xl mt-8">
        Please log in to manage your accounts.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight mb-2">Accounts</h2>
          <div className="flex items-center gap-3">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Balance:</p>
            <motion.div 
              key={totalBalance}
              initial={{ scale: 1.1, color: '#10b981' }}
              animate={{ scale: 1, color: 'inherit' }}
              transition={{ duration: 0.3 }}
              className="text-xl font-bold text-slate-900 dark:text-white"
            >
              {showBalance ? formatCurrency(totalBalance) : '••••••'}
            </motion.div>
            <button 
              onClick={() => setShowBalance(!showBalance)} 
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              {showBalance ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-medium transition-colors flex items-center gap-2 text-sm shrink-0"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Add Account</span>
        </button>
      </div>

      <AnimatePresence>
        {editingAccount && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Edit Account</h3>
                <button 
                  onClick={() => setEditingAccount(null)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleEditAccount} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Account Name
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Account Type
                  </label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  >
                    <option value="Bank">Bank</option>
                    <option value="Bkash">Bkash</option>
                    <option value="Nagad">Nagad</option>
                    <option value="Cash">Cash</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Current Balance
                  </label>
                  <input
                    type="number"
                    value={editBalance}
                    onChange={(e) => setEditBalance(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    step="0.01"
                    required
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingAccount(null)}
                    className="flex-1 py-3 rounded-xl font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold transition-colors shadow-lg shadow-indigo-500/20"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
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
              <form onSubmit={handleAddAccount} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Account Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="e.g. Main Bank"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Account Type
                    </label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    >
                      <option value="Bank">Bank</option>
                      <option value="Bkash">Bkash</option>
                      <option value="Nagad">Nagad</option>
                      <option value="Cash">Cash</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Initial Balance
                    </label>
                    <input
                      type="number"
                      value={initialBalance}
                      onChange={(e) => setInitialBalance(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="0.00"
                      step="0.01"
                      required
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="px-4 py-2 rounded-xl font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-medium transition-colors shadow-sm"
                  >
                    Save Account
                  </button>
                </div>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map((account) => (
          <Card key={account.id} className="p-6 flex flex-col justify-between group">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <Wallet size={24} />
              </div>
              <div className="flex gap-1.5 items-center">
                <button
                  onClick={() => startEditing(account)}
                  className="text-slate-400 hover:text-indigo-500 dark:text-slate-500 dark:hover:text-indigo-400 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Edit account"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => setDeleteId(account.id!)}
                  className="text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Delete account"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">
                {account.name} • {account.type}
              </p>
              <motion.h3 
                key={account.currentBalance}
                initial={{ scale: 1.05, color: '#10b981' }}
                animate={{ scale: 1, color: 'inherit' }}
                transition={{ duration: 0.3 }}
                className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50"
              >
                {showBalance ? formatCurrency(account.currentBalance) : '••••••'}
              </motion.h3>
            </div>
          </Card>
        ))}
        {accounts.length === 0 && !isAdding && (
          <div className="col-span-full text-center py-12 text-slate-500 dark:text-slate-400">
            No accounts found. Add one to get started.
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!deleteId}
        title="Delete Account?"
        message="Are you sure you want to delete this account? All associated data will be preserved but the account itself will be removed from your list."
        confirmText="Delete"
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
