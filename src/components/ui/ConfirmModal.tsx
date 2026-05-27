import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning' | 'info';
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'danger'
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const variantClasses = {
    danger: 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/20',
    warning: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-500/20',
    info: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20'
  };

  const iconClasses = {
    danger: 'text-red-600 bg-red-50 dark:bg-red-500/10',
    warning: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10',
    info: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10'
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 max-w-md w-full shadow-2xl relative overflow-hidden"
        >
          <button 
            onClick={onCancel}
            className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X size={20} />
          </button>

          <div className="flex flex-col items-center text-center">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${iconClasses[variant]}`}>
              <AlertTriangle size={32} />
            </div>
            
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              {title}
            </h3>
            
            <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
              {message}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <button
                onClick={onCancel}
                className="flex-1 py-4 rounded-2xl font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors order-2 sm:order-1"
              >
                {cancelText}
              </button>
              <button
                onClick={() => {
                  onConfirm();
                  onCancel();
                }}
                className={`flex-1 py-4 rounded-2xl font-bold transition-all shadow-lg order-1 sm:order-2 ${variantClasses[variant]}`}
              >
                {confirmText}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
