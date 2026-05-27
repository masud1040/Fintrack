import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, User as UserIcon, ArrowRight, Edit2, Check, Download, FileText, Camera, Trash2, ShieldCheck, Code, Share2, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Analytics } from './Analytics';
import { generatePDFReport, generateMonthlyPDFReport } from '../lib/pdfExport';
import { db } from '../db';
import { ConfirmModal } from './ui/ConfirmModal';

export function Profile() {
  const { currentUser, login, signup, logout, updateProfile, deleteAccount, authError, clearAuthError, loginWithGoogle } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  
  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Edit states
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhoneNumber, setEditPhoneNumber] = useState('');
  const [editCompanyName, setEditCompanyName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [imageError, setImageError] = useState('');

  // Report states
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportType, setReportType] = useState<'general' | 'monthly'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth() + 1); // 1-12
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [isGenerating, setIsGenerating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await signup(name, email, password);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveProfile = async () => {
    if (editName.trim()) {
      await updateProfile(editName, currentUser?.avatar || '', editPhoneNumber, editCompanyName);
      setIsEditing(false);
    }
  };

  const handleDownloadReport = async () => {
    if (!currentUser?.id) return;
    setIsGenerating(true);
    try {
      if (reportType === 'general') {
        await generatePDFReport(
          currentUser.id,
          currentUser.name,
          currentUser.phoneNumber,
          currentUser.companyName
        );
      } else {
        await generateMonthlyPDFReport(
          currentUser.id,
          currentUser.name,
          currentUser.email || '',
          selectedYear,
          selectedMonth,
          currentUser.phoneNumber,
          currentUser.companyName
        );
      }
      setShowReportModal(false);
    } catch (error) {
      console.error('Error generating PDF report:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportJSON = async () => {
    if (!currentUser?.id) return;
    const userId = currentUser.id;
    
    const data = {
      user: currentUser,
      accounts: await db.accounts.where('userId').equals(userId).toArray(),
      categories: await db.categories.where('userId').equals(userId).toArray(),
      transactions: await db.transactions.where('userId').equals(userId).toArray(),
      debts: await db.debts.where('userId').equals(userId).toArray(),
      notes: await db.notes.where('userId').equals(userId).toArray(),
      recurring: await db.recurringTransactions.where('userId').equals(userId).toArray(),
      notifications: await db.notifications.where('userId').equals(userId).toArray(),
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FinTrack_Backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setImageError('Image size should be less than 5MB');
        setTimeout(() => setImageError(''), 3000);
        return;
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        await updateProfile(currentUser?.name || '', base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  if (currentUser) {
    return (
      <div className="space-y-8 pb-8">
        <header className="pt-2 mb-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Profile & Analysis</h1>
        </header>
        
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 shadow-sm text-center relative">
          <button 
            onClick={() => {
              if (isEditing) {
                handleSaveProfile();
              } else {
                setEditName(currentUser.name);
                setEditPhoneNumber(currentUser.phoneNumber || '');
                setEditCompanyName(currentUser.companyName || '');
                setIsEditing(true);
              }
            }}
            className="absolute top-6 right-6 p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            {isEditing ? <Check size={20} className="text-emerald-500" /> : <Edit2 size={20} />}
          </button>

          <div className="relative w-24 h-24 mx-auto mb-4 group">
            <div className="w-full h-full rounded-full overflow-hidden bg-violet-100 border-4 border-white dark:border-slate-800 shadow-lg">
              <img src={currentUser.avatar} alt="User" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <label 
              htmlFor="avatar-upload" 
              className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              <Camera size={24} />
            </label>
            <input 
              id="avatar-upload" 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleAvatarUpload}
            />
          </div>

          {imageError && (
            <div className="flex items-center justify-center gap-2 text-red-500 text-xs mb-4 animate-pulse">
              <AlertCircle size={14} />
              {imageError}
            </div>
          )}
          
          {isEditing ? (
            <div className="space-y-3 max-w-[280px] mx-auto text-left mb-6">
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 mb-1">
                  Name (নাম)
                </label>
                <input 
                  type="text" 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl py-2 px-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-violet-500 outline-none"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 mb-1">
                  Phone Number (ফোন নাম্বার)
                </label>
                <input 
                  type="tel" 
                  value={editPhoneNumber}
                  onChange={(e) => setEditPhoneNumber(e.target.value)}
                  placeholder="e.g. 017XXXXXXXX"
                  className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl py-2 px-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-violet-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 mb-1">
                  Company / Company Branch (কোম্পানি / ডিপার্টমেন্ট)
                </label>
                <input 
                  type="text" 
                  value={editCompanyName}
                  onChange={(e) => setEditCompanyName(e.target.value)}
                  placeholder="e.g. Acme Corp / Admin"
                  className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl py-2 px-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-violet-500 outline-none"
                />
              </div>
            </div>
          ) : (
            <div className="mb-6 space-y-1 select-none">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{currentUser.name}</h2>
              {currentUser.phoneNumber && (
                <p className="text-sm text-slate-600 dark:text-slate-300 font-semibold">📞 {currentUser.phoneNumber}</p>
              )}
              {currentUser.companyName && (
                <p className="text-sm text-slate-550 dark:text-slate-400 font-medium">💼 {currentUser.companyName}</p>
              )}
              <p className="text-xs text-slate-400 dark:text-slate-500">{currentUser.email}</p>
            </div>
          )}
          
          <button 
            onClick={() => logout()}
            className="w-full py-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Log Out
          </button>
        </div>

        {/* App Info & Privacy */}
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Data & Reports</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => setShowReportModal(true)}
              className="flex flex-col items-center justify-center p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
              id="pdf-report-trigger-btn"
            >
              <FileText size={24} className="mb-2" />
              <span className="text-sm font-bold">PDF Report</span>
            </button>
            <button 
              onClick={handleExportJSON}
              className="flex flex-col items-center justify-center p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors"
            >
              <Download size={24} className="mb-2" />
              <span className="text-sm font-bold">Export JSON</span>
            </button>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800"></div>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
              <Code size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">Developer Info</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                This application was built by <span className="font-bold text-violet-600 dark:text-violet-400">Saiful Alam Masud</span>.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">Cloud Sync & Security</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Your records are safely backed up in the cloud via <span className="font-bold">Firebase Firestore</span> for multi-device login, while cached locally in IndexedDB to support seamless offline actions.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <button 
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full py-4 rounded-2xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 font-bold hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 size={20} />
              Delete Account & Data
            </button>
          </div>
        </div>

        <ConfirmModal
          isOpen={showDeleteConfirm}
          title="Delete Account & Data?"
          message="Are you absolutely sure? This will permanently delete your account and ALL your financial data. This action cannot be undone."
          confirmText="Yes, Delete Everything"
          onConfirm={deleteAccount}
          onCancel={() => setShowDeleteConfirm(false)}
        />

        {/* Beautiful PDF Report Options Modal */}
        <AnimatePresence>
          {showReportModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-2xl border border-slate-100 dark:border-slate-800"
                id="pdf-report-modal"
              >
                <h3 className="text-xl font-bold text-slate-950 dark:text-white mb-2">
                  ফাইন্যান্সিয়াল রিপোর্ট ডাউনলোড (PDF)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 font-medium">
                  আপনার আয় ও ব্যয়ের তথ্য সুন্দর ও সুশৃঙ্খল টেবিল আকারে পিডিএফ রিপোর্টে ডাউনলোড করুন।
                </p>

                <div className="space-y-4 mb-6">
                  {/* Select Report Type */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wider">
                      রিপোর্টের ধরণ
                    </label>
                    <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-950 p-1.5 rounded-2xl">
                      <button
                        type="button"
                        onClick={() => setReportType('monthly')}
                        className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
                          reportType === 'monthly'
                            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                        }`}
                        id="monthly-report-tab-btn"
                      >
                        মাসিক ভিত্তিক (Monthly)
                      </button>
                      <button
                        type="button"
                        onClick={() => setReportType('general')}
                        className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
                          reportType === 'general'
                            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                        }`}
                        id="general-report-tab-btn"
                      >
                        অল-টাইম (Full)
                      </button>
                    </div>
                  </div>

                  {reportType === 'monthly' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-3"
                    >
                      {/* Month dropdown */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-1.5 uppercase tracking-wider">
                          মাস নির্বাচন করুন
                        </label>
                        <select
                          value={selectedMonth}
                          onChange={(e) => setSelectedMonth(Number(e.target.value))}
                          className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-violet-500 outline-none text-sm font-semibold"
                          id="report-month-select"
                        >
                          <option value={1}>জানুয়ারি (January)</option>
                          <option value={2}>ফেব্রুয়ারি (February)</option>
                          <option value={3}>মার্চ (March)</option>
                          <option value={4}>এপ্রিল (April)</option>
                          <option value={5}>মে (May)</option>
                          <option value={6}>জুন (June)</option>
                          <option value={7}>জুলাই (July)</option>
                          <option value={8}>আগস্ট (August)</option>
                          <option value={9}>সেপ্টেম্বর (September)</option>
                          <option value={10}>অক্টোবর (October)</option>
                          <option value={11}>নভেম্বর (November)</option>
                          <option value={12}>ডিসেম্বর (December)</option>
                        </select>
                      </div>

                      {/* Year input */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-1.5 uppercase tracking-wider">
                          সাল নির্বাচন করুন
                        </label>
                        <select
                          value={selectedYear}
                          onChange={(e) => setSelectedYear(Number(e.target.value))}
                          className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-violet-500 outline-none text-sm font-semibold"
                          id="report-year-select"
                        >
                          <option value={2025}>2025</option>
                          <option value={2026}>2026</option>
                          <option value={2027}>2027</option>
                          <option value={2028}>2028</option>
                        </select>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowReportModal(false)}
                    className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-bold transition-all"
                  >
                    বন্ধ করুন
                  </button>
                  <button
                    type="button"
                    disabled={isGenerating}
                    onClick={handleDownloadReport}
                    className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-2xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    {isGenerating ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        প্রস্তুত হচ্ছে...
                      </>
                    ) : (
                      <>
                        <Download size={14} />
                        ডাউনলোড করুন
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Comprehensive Analytics Section */}
        <div className="pt-4">
          <Analytics />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-8 max-w-sm mx-auto pt-4">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 rounded-2xl flex items-center justify-center mx-auto mb-6 rotate-3 shadow-sm">
          <UserIcon size={32} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          {isLogin ? 'Welcome Back' : 'Create Account'}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          {isLogin ? 'Enter your details to access your account' : 'Sign up to start tracking your finances'}
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {authError && (
          <div className="p-3 bg-red-50 dark:bg-red-500/10 text-red-500 text-sm rounded-xl text-center">
            {authError}
          </div>
        )}

        <AnimatePresence mode="popLayout">
          {!isLogin && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -20 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -20 }}
              className="relative"
            >
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="text" 
                placeholder="Full Name" 
                required={!isLogin}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl py-4 pl-12 pr-4 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-violet-500 outline-none shadow-sm"
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="email" 
            placeholder="Email Address" 
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl py-4 pl-12 pr-4 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-violet-500 outline-none shadow-sm"
          />
        </div>

        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="password" 
            placeholder="Password" 
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl py-4 pl-12 pr-4 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-violet-500 outline-none shadow-sm"
          />
        </div>

        {isLogin && (
          <div className="flex justify-end">
            <button type="button" className="text-sm font-medium text-violet-600 dark:text-violet-400 hover:underline">
              Forgot password?
            </button>
          </div>
        )}

        <button 
          type="submit"
          className="w-full py-4 rounded-2xl bg-[#ff6b4a] text-white font-bold hover:bg-[#ff5733] transition-colors shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2 mt-2"
        >
          {isLogin ? 'Log In' : 'Sign Up'}
          <ArrowRight size={20} />
        </button>

        <div className="flex items-center my-4">
          <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
          <span className="px-3 text-xs text-slate-400 font-medium uppercase tracking-wider">Or continue with</span>
          <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
        </div>

        <button 
          type="button"
          onClick={loginWithGoogle}
          className="w-full py-4 rounded-2xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors shadow-sm flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5 mr-1" viewBox="0 0 24 24">
            <path fill="#EA4335" d="M12 5.04c1.67 0 3.19.57 4.38 1.69l3.27-3.27C17.65 1.58 14.99 1 12 1 7.24 1 3.2 3.73 1.24 7.72l3.86 3C6.03 7.6 8.79 5.04 12 5.04z" />
            <path fill="#4285F4" d="M23.49 12.27c0-.82-.07-1.61-.21-2.38H12v4.51h6.44c-.28 1.48-1.11 2.73-2.37 3.58l3.68 2.85c2.15-1.98 3.74-4.89 3.74-8.56z" />
            <path fill="#FBBC05" d="M5.1 14.41c-.24-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29L1.24 6.83C.45 8.39 0 10.14 0 12s.45 3.61 1.24 5.17l3.86-2.76z" />
            <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.68-2.85c-1.02.68-2.33 1.1-4.28 1.1-3.21 0-5.97-2.56-6.9-5.68l-3.86 2.76C3.2 20.27 7.24 23 12 23z" />
          </svg>
          Google
        </button>

        {/* Iframe Login Helper Notice */}
        <div className="mt-6 p-4 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 rounded-2xl text-xs space-y-2 text-slate-650 dark:text-slate-300 shadow-sm leading-relaxed text-left">
          <p className="font-extrabold text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
            <AlertCircle size={14} className="shrink-0 text-indigo-500" />
            লগইন কাজ করছে না (Iframe & Provider Setup)?
          </p>
          <p>
            প্রজেক্টের সিকিউরিটি পলিসি ও ব্রাউজার সিকিউরিটির জন্য নিচের নিয়মটি অনুসরণ করুন:
          </p>
          <ul className="list-decimal pl-4 space-y-1.5">
            <li>
              <strong>১. গুগল সাইন-ইন ব্যবহার করুন:</strong> এই ডেমো প্রোজেক্টে সিকিউরিটি কারণে ইমেইল/পাসওয়ার্ড দিয়ে নতুন অ্যাকাউন্ট সাইন-আপ করার প্রোভাইডার বন্ধ (Disabled) রয়েছে। কিন্তু <strong>Google Login সম্পূর্ণ চালু (Enabled) আছে</strong>!
            </li>
            <li>
              <strong>২. নতুন ট্যাবে ওপেন করুন:</strong> গুগল এআই স্টুডিওর প্রিভিউ উন্ডোটি একটি ইন-অ্যাপ ফ্রেম (Iframe) এর মাঝে থাকার কারণে সরাসরি গুগল লগইন বাটনে চাপ দিলে ব্রাউজার পপআপ ব্লক করে দেয়।
            </li>
            <li className="font-bold text-slate-800 dark:text-white">
              ৩. সমাধান: মোবাইল বা কম্পিউটারের প্রিভিউ স্ক্রিনের উপরে বা নিচে থাকা "Open in new tab" (নতুন ট্যাব আইকন) বাটনে ক্লিক করে প্রজেক্টটি সরাসরি ব্রাউজারে ওপেন করুন এবং Google দিয়ে ইনস্ট্যান্ট লগইন সম্পন্ন করুন।
            </li>
          </ul>
        </div>
      </form>

      <div className="text-center mt-8">
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button 
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              clearAuthError();
            }}
            className="font-bold text-violet-600 dark:text-violet-400 hover:underline"
          >
            {isLogin ? 'Sign up' : 'Log in'}
          </button>
        </p>
      </div>
    </div>
  );
}
