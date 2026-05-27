import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, AppNotification } from '../db';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, Check, Trash2, Info, AlertTriangle, TrendingDown, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { ConfirmModal } from './ui/ConfirmModal';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
}

export function NotificationCenter({ isOpen, onClose, onNavigate }: NotificationCenterProps) {
  const { currentUser } = useAuth();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  
  const notifications = useLiveQuery(
    () => currentUser ? db.notifications.where('userId').equals(currentUser.id!).reverse().sortBy('date') : [],
    [currentUser?.id]
  ) || [];

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllAsRead = async () => {
    if (!currentUser?.id) return;
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id!);
    if (unreadIds.length > 0) {
      await db.notifications.bulkUpdate(unreadIds.map(id => ({ key: id, changes: { read: true } })));
    }
  };

  const markAsRead = async (id: number) => {
    await db.notifications.update(id, { read: true });
  };

  const deleteNotification = async (id: number) => {
    await db.notifications.delete(id);
  };

  const clearAll = async () => {
    if (!currentUser?.id) return;
    await db.notifications.where('userId').equals(currentUser.id!).delete();
    setShowClearConfirm(false);
  };

  const getIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'warning': return <AlertTriangle size={20} className="text-orange-500" />;
      case 'report': return <FileText size={20} className="text-indigo-500" />;
      case 'success': return <Check size={20} className="text-emerald-500" />;
      default: return <Info size={20} className="text-blue-500" />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-end p-4 bg-slate-900/20 backdrop-blur-sm md:p-8">
          <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.95 }}
            className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl flex flex-col max-h-[80vh]"
          >
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Bell size={24} className="text-slate-900 dark:text-white" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Notifications</h3>
              </div>
              <div className="flex items-center gap-2">
                {notifications.length > 0 && (
                  <button 
                    onClick={() => setShowClearConfirm(true)}
                    className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                    title="Clear all"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
                <button 
                  onClick={onClose}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {notifications.length === 0 ? (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                  <Bell size={48} className="mx-auto mb-4 opacity-20" />
                  <p className="font-medium">No notifications yet</p>
                  <p className="text-sm">We'll notify you about reports and alerts.</p>
                </div>
              ) : (
                notifications.map(n => (
                  <div 
                    key={n.id}
                    className={cn(
                      "p-4 rounded-2xl border transition-all relative group",
                      n.read 
                        ? "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800" 
                        : "bg-indigo-50/50 dark:bg-indigo-500/5 border-indigo-100 dark:border-indigo-500/20"
                    )}
                  >
                    <div className="flex gap-4">
                      <div className="shrink-0 mt-1">
                        {getIcon(n.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate pr-6">
                            {n.title}
                          </h4>
                          <span className="text-[10px] text-slate-400 whitespace-nowrap">
                            {format(new Date(n.date), 'MMM d, h:mm a')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
                          {n.message}
                        </p>
                        <div className="flex items-center gap-3">
                          {n.link && (
                            <button 
                              onClick={() => {
                                onNavigate(n.link!);
                                markAsRead(n.id!);
                                onClose();
                              }}
                              className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                            >
                              View Details
                            </button>
                          )}
                          {!n.read && (
                            <button 
                              onClick={() => markAsRead(n.id!)}
                              className="text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                            >
                              Mark as read
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => deleteNotification(n.id!)}
                      className="absolute top-4 right-4 p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {unreadCount > 0 && (
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
                <button 
                  onClick={markAllAsRead}
                  className="w-full py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Mark all as read
                </button>
              </div>
            )}

            <ConfirmModal
              isOpen={showClearConfirm}
              title="Clear Notifications?"
              message="Are you sure you want to clear all notifications? This action cannot be undone."
              confirmText="Clear All"
              onConfirm={clearAll}
              onCancel={() => setShowClearConfirm(false)}
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
