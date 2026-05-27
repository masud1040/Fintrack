import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, BazarList, BazarItem } from '../db';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Search, Trash2, Printer, Edit3, X, CheckSquare, Square, ShoppingBag, PlusCircle, CheckCircle2, FileText, ChevronRight, Download } from 'lucide-react';
import { format } from 'date-fns';
import { cn, formatCurrency, savePDF } from '../lib/utils';
import { setupPDFCustomFonts } from '../lib/pdfCustomFonts';
import { ConfirmModal } from './ui/ConfirmModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { generateHtmlPdf } from '../lib/htmlToPdfHelper';

export function BazarLists() {
  const { currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingList, setEditingList] = useState<BazarList | null>(null);
  const [viewingList, setViewingList] = useState<BazarList | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Form main states
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Form item list states (temp items before saving)
  const [tempItems, setTempItems] = useState<BazarItem[]>([]);
  const [product, setProduct] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');

  // Active print item state
  const [activePrintList, setActivePrintList] = useState<BazarList | null>(null);

  const bazarLists = useLiveQuery(
    () => {
      if (!currentUser?.id) return [];
      return db.bazarLists
        .where('userId')
        .equals(currentUser.id)
        .reverse()
        .sortBy('date')
        .then(arr => 
          arr.filter(list => 
            list.title.toLowerCase().includes(searchQuery.toLowerCase())
          )
        );
    },
    [currentUser?.id, searchQuery]
  ) || [];

  // If a list is selected, sync any changes from db
  const syncedViewingList = useLiveQuery(
    () => {
      if (!viewingList?.id) return null;
      return db.bazarLists.get(viewingList.id);
    },
    [viewingList?.id]
  );

  useEffect(() => {
    if (syncedViewingList) {
      setViewingList(syncedViewingList);
    }
  }, [syncedViewingList]);

  // Save/Update Bazar list
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !currentUser?.id) return;

    const calculatedTotal = tempItems.reduce((sum, item) => sum + Number(item.price || 0), 0);

    const listData = {
      userId: currentUser.id,
      title: title.trim(),
      items: tempItems,
      date: new Date(date),
      totalAmount: calculatedTotal,
    };

    if (editingList?.id) {
      await db.bazarLists.update(editingList.id, listData);
    } else {
      await db.bazarLists.add(listData);
    }

    resetForm();
  };

  // Add item to temp items list in form
  const handleAddTempItem = () => {
    if (!product.trim()) return;

    const newItem: BazarItem = {
      id: Math.random().toString(36).substring(2, 9),
      product: product.trim(),
      quantity: quantity.trim() || '1x',
      price: price ? Number(price) : 0,
      checked: false,
    };

    setTempItems([...tempItems, newItem]);
    setProduct('');
    setQuantity('');
    setPrice('');
  };

  // Remove item from temp items list in form
  const handleRemoveTempItem = (itemId: string) => {
    setTempItems(tempItems.filter(item => item.id !== itemId));
  };

  const startAddList = () => {
    setTitle('');
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setTempItems([]);
    setEditingList(null);
    setIsAdding(true);
  };

  const startEditing = (list: BazarList) => {
    setEditingList(list);
    setTitle(list.title);
    setDate(format(new Date(list.date), 'yyyy-MM-dd'));
    setTempItems([...list.items]);
    setIsAdding(true);
    setViewingList(null);
  };

  const resetForm = () => {
    setTitle('');
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setTempItems([]);
    setProduct('');
    setQuantity('');
    setPrice('');
    setEditingList(null);
    setIsAdding(false);
  };

  const handleDelete = async (id: number) => {
    await db.bazarLists.delete(id);
    if (viewingList?.id === id) {
      setViewingList(null);
    }
    setDeleteId(null);
  };

  // Toggle item checked status inside details list
  const handleToggleItemCheck = async (list: BazarList, itemId: string) => {
    const updatedItems = list.items.map(item => {
      if (item.id === itemId) {
        return { ...item, checked: !item.checked };
      }
      return item;
    });

    const calculatedTotal = updatedItems.reduce((sum, item) => sum + Number(item.price || 0), 0);

    await db.bazarLists.update(list.id!, {
      items: updatedItems,
      totalAmount: calculatedTotal,
    });
  };

  // Print Bazar List functionality
  const handlePrint = (list: BazarList) => {
    setActivePrintList(list);
    setTimeout(() => {
      const style = document.createElement('style');
      style.id = 'print-style-helper';
      style.innerHTML = `
        @media print {
          body * {
            visibility: hidden;
          }
          #print-section, #print-section * {
            visibility: visible;
          }
          #print-section {
            position: absolute;
            left: 50%;
            top: 50px;
            transform: translateX(-50%);
            width: 100%;
            max-width: 600px;
          }
        }
      `;
      document.head.appendChild(style);
      window.print();
      setTimeout(() => {
        const helper = document.getElementById('print-style-helper');
        if (helper) helper.remove();
      }, 1000);
    }, 200);
  };

  // Highly compatible PDF generation for Bazar List (especially on mobile)
  const handleDownloadBazarPDF = async (list: BazarList) => {
    const nowOutput = format(new Date(), 'dd MMM yyyy, hh:mm a');
    const listDateText = format(new Date(list.date), 'dd MMM yyyy');

    const totalItems = list.items.length;
    const collectedItems = list.items.filter(item => item.checked).length;
    
    // Aesthetic thermal receipt mock layout matching the first user image!
    const htmlContent = `
      <div style="padding: 24px 20px; background-color: #fcfcfc; color: #1e293b; font-family: 'JetBrains Mono', Courier, monospace; line-height: 1.5; font-size: 11px; max-width: 320px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); text-transform: uppercase;">
        <div style="text-align: center; margin-bottom: 12px;">
          <h1 style="font-size: 16px; font-weight: 800; letter-spacing: 1px; color: #0f172a; margin: 0 0 4px 0; font-family: 'Inter', system-ui, sans-serif;">CASH RECEIPT</h1>
          <p style="font-size: 9px; color: #64748b; margin: 0 0 2px 0;">FinTrack Shopping Ledger</p>
          <p style="font-size: 9px; color: #64748b; margin: 0 0 2px 0;">Dhaka, Bangladesh</p>
          <p style="font-size: 9px; color: #64748b; margin: 0;">User: ${currentUser?.name || 'Guest'}</p>
        </div>
        
        <div style="border-top: 1px dashed #cbd5e1; margin: 8px 0;"></div>
        
        <div style="font-size: 9px; color: #334155; margin-bottom: 10px; display: flex; flex-direction: column; gap: 2px;">
          <div style="display: flex; justify-content: space-between;">
            <span>LIST:</span>
            <span style="font-weight: 700; color: #0f172a; font-family: 'Inter', 'Hind Siliguri', sans-serif;">${list.title}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>DATE:</span>
            <span>${listDateText}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>PRINTED:</span>
            <span>${nowOutput}</span>
          </div>
        </div>
        
        <div style="border-top: 1px dashed #cbd5e1; margin: 8px 0;"></div>
        
        <div style="display: flex; flex-direction: column; gap: 8px; margin: 12px 0;">
          ${list.items.map((item, idx) => `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; font-size: 10px;">
              <div style="flex: 1; padding-right: 12px; display: flex; flex-direction: column;">
                <span style="font-weight: 600; color: #0f172a; font-family: 'Inter', 'Hind Siliguri', sans-serif; text-transform: none;">
                  ${idx + 1}. ${item.product}
                </span>
                <span style="font-size: 8px; color: #64748b; margin-top: 1px;">
                  QTY: ${item.quantity || '1X'} | ${item.checked ? '✓ collected' : '✗ pending'}
                </span>
              </div>
              <div style="font-weight: 700; color: #0f172a; font-family: 'Inter', sans-serif; min-width: 70px; text-align: right; shrink-0;">
                ${formatCurrency(item.price)}
              </div>
            </div>
          `).join('')}
          ${list.items.length === 0 ? `
            <div style="text-align: center; color: #94a3b8; font-size: 9px; padding: 10px 0;">
              no shopping items added yet
            </div>
          ` : ''}
        </div>
        
        <div style="border-top: 1px dashed #cbd5e1; margin: 8px 0;"></div>
        
        <div style="display: flex; flex-direction: column; gap: 3px; font-size: 10px; margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 800; color: #0f172a; margin-top: 4px;">
            <span>TOTAL:</span>
            <span>${formatCurrency(list.totalAmount)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; color: #64748b; font-size: 9px;">
            <span>ITEMS:</span>
            <span>${collectedItems}/${totalItems} collected</span>
          </div>
          <div style="display: flex; justify-content: space-between; color: #64748b; font-size: 9px;">
            <span>TAX (0%):</span>
            <span>BDT 0.00</span>
          </div>
          <div style="display: flex; justify-content: space-between; color: #64748b; font-size: 9px;">
            <span>BALANCE:</span>
            <span>${formatCurrency(list.totalAmount)}</span>
          </div>
        </div>
        
        <div style="border-top: 1px dashed #cbd5e1; margin: 8px 0 12px 0;"></div>
        
        <div style="text-align: center;">
          <p style="font-size: 12px; font-weight: 700; letter-spacing: 2px; color: #0f172a; margin: 0 0 6px 0; font-family: 'Inter', sans-serif;">THANK YOU</p>
          
          <!-- Barcode lines exactly replicating the receipt graphic! -->
          <div style="display: flex; justify-content: center; height: 26px; gap: 1px; margin: 6px auto; width: fit-content; max-width: 100%;">
            ${Array.from({ length: 42 }).map((_, i) => {
              const weights = [1, 2, 1, 3, 1, 1, 2, 1, 3, 2];
              const w = weights[i % weights.length];
              return `<div style="background-color: #0f172a; width: ${w}px; height: 100%;"></div>`;
            }).join('')}
          </div>
          
          <p style="font-size: 8px; color: #94a3b8; margin: 4px 0 0 0;">FINTRACK SECURE LOGISTICS REGISTRY © 2026</p>
        </div>
      </div>
    `;

    const safeFilename = `bazar_${list.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.pdf`;
    await generateHtmlPdf(htmlContent, { fileName: safeFilename, isThermalReceipt: true });
  };

  if (!currentUser) {
    return (
      <div className="p-8 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-3xl mt-8">
        Please log in to manage your Shopping (Bazar) lists.
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Search and Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">বাজার তালিকা (Bazar Lists)</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Create, manage and print your shopping/bazar lists.
          </p>
        </div>
        <button
          onClick={startAddList}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 text-sm shadow-md active:scale-95 shrink-0"
        >
          <Plus size={18} />
          বাজার তালিকা যোগ করুন
        </button>
      </div>

      <div className="relative max-w-2xl">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input
          type="text"
          placeholder="সার্চ করুন..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
        />
      </div>

      {/* Main List of Bazar Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {bazarLists.length === 0 ? (
          <div className="md:col-span-2 p-12 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingBag size={24} className="text-slate-400" />
            </div>
            <p className="text-lg font-bold text-slate-950 dark:text-white mb-1">কোন বাজার তালিকা নেই</p>
            <p className="text-sm">নতুন একটি বাজার তালিকা তৈরি করতে উপরের বাটনে ক্লিক করুন।</p>
          </div>
        ) : (
          bazarLists.map(list => {
            const completedCount = list.items.filter(i => i.checked).length;
            const totalCount = list.items.length;
            const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

            return (
              <motion.div
                key={list.id}
                layoutId={`bazar-card-${list.id}`}
                onClick={() => setViewingList(list)}
                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-[2rem] scroll-mt-20 shadow-sm hover:shadow-md cursor-pointer transition-shadow relative overflow-hidden group flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {list.title}
                    </h3>
                    <span className="text-xs text-slate-400 font-medium shrink-0">
                      {format(new Date(list.date), 'dd MMM yyyy')}
                    </span>
                  </div>

                  {/* Progress indicator */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1.5">
                      <span>আইটেম: {completedCount}/{totalCount} (সম্পূর্ণ)</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-indigo-600 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800/80">
                  <div>
                    <span className="text-xs text-slate-400 block font-medium">সর্বমোট মূল্য</span>
                    <span className="text-lg font-extrabold text-indigo-600 dark:text-indigo-400">
                      {formatCurrency(list.totalAmount)}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditing(list);
                      }}
                      className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 text-slate-400 dark:text-slate-500 transition-all active:scale-95"
                      title="Edit"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadBazarPDF(list);
                      }}
                      className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:text-emerald-600 text-slate-400 dark:text-slate-500 transition-all active:scale-95"
                      title="Download PDF"
                    >
                      <Download size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePrint(list);
                      }}
                      className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl hover:bg-sky-50 dark:hover:bg-sky-500/10 hover:text-sky-600 text-slate-400 dark:text-slate-500 transition-all active:scale-95"
                      title="Print"
                    >
                      <Printer size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(list.id!);
                      }}
                      className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 text-slate-400 dark:text-slate-500 transition-all active:scale-95"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Add / Edit Sheet Modal Overlay */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-6 max-w-lg w-full shadow-2xl flex flex-col max-h-[85vh]"
            >
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100 dark:border-slate-900">
                <h3 className="font-extrabold text-xl">
                  {editingList ? 'বাজার তালিকা সংশোধন করুন (Edit List)' : 'বাজার তালিকা তৈরি করুন (New List)'}
                </h3>
                <button 
                  onClick={resetForm}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSave} className="space-y-4 flex-1 overflow-y-auto pr-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2 border-b border-slate-100 dark:border-slate-900">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400">বাজার তালিকার নাম (Title)</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="যেমন: আজকের বাজার, সাপ্তাহিক বাজার"
                      className="w-full px-4 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400">তারিখ (Date)</label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-4 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      required
                    />
                  </div>
                </div>

                {/* Sub items builder */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest">পণ্য যোগ করুন (Add Items)</h4>
                  
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-5">
                      <input
                        type="text"
                        placeholder="পণ্য (e.g. পেঁয়াজ)"
                        value={product}
                        onChange={(e) => setProduct(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none"
                      />
                    </div>
                    <div className="col-span-3">
                      <input
                        type="text"
                        placeholder="পরিমান (e.g. ২ কেজি)"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none"
                      />
                    </div>
                    <div className="col-span-3">
                      <input
                        type="number"
                        placeholder="মূল্য"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none"
                      />
                    </div>
                    <div className="col-span-1 flex justify-center items-center">
                      <button
                        type="button"
                        onClick={handleAddTempItem}
                        className="text-indigo-600 hover:text-indigo-800 active:scale-95"
                      >
                        <PlusCircle size={24} />
                      </button>
                    </div>
                  </div>

                  {/* Temp items table list */}
                  <div className="border border-slate-100 dark:border-slate-900 rounded-2xl max-h-[180px] overflow-y-auto bg-slate-50/50 dark:bg-slate-900/10 p-2">
                    {tempItems.length === 0 ? (
                      <p className="text-xs text-center text-slate-400 py-6">কোন পণ্য যোগ করা হয়নি</p>
                    ) : (
                      <div className="space-y-1.5">
                        {tempItems.map((item, idx) => (
                          <div key={item.id} className="flex justify-between items-center text-xs p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 group shadow-sm">
                            <div className="flex-1 min-w-0">
                              <span className="font-bold text-slate-850 dark:text-slate-100">{item.product}</span>
                              <span className="ml-2 text-slate-400 font-medium">({item.quantity})</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-extrabold text-slate-700 dark:text-slate-400">{formatCurrency(item.price)}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveTempItem(item.id)}
                                className="text-slate-400 hover:text-red-500"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between font-extrabold pt-2 text-sm uppercase">
                  <span className="text-slate-500">মোট আনুমানিক মূল্য:</span>
                  <span className="text-lg text-indigo-600 dark:text-indigo-400">
                    {formatCurrency(tempItems.reduce((sum, item) => sum + Number(item.price || 0), 0))}
                  </span>
                </div>

                {/* Submit buttons */}
                <div className="flex justify-end gap-2 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-100 dark:border-slate-900 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-600/15"
                  >
                    তালিকায় যোগ করুন (Save)
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Item Details and Checkbox Interactivity Overlay */}
      <AnimatePresence>
        {viewingList && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md">
            <motion.div
              layoutId={`bazar-card-${viewingList.id}`}
              className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-6 max-w-lg w-full shadow-2xl flex flex-col max-h-[85vh]"
            >
              <div className="flex justify-between items-start mb-4 pb-2 border-b border-slate-100 dark:border-slate-900">
                <div>
                  <h3 className="font-extrabold text-xl text-indigo-600 dark:text-indigo-400">
                    {viewingList.title}
                  </h3>
                  <p className="text-xs text-slate-400 font-semibold mt-0.5">
                    {format(new Date(viewingList.date), 'PPPP')}
                  </p>
                </div>
                <button 
                  onClick={() => setViewingList(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-50 dark:bg-slate-900 rounded-xl"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Items checklist sorted: unchecked items on top, completed/checked items moved to the bottom */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 my-3">
                {viewingList.items.length === 0 ? (
                  <p className="text-sm text-center py-12 text-slate-500">কোন পণ্য নেই।</p>
                ) : (
                  [...viewingList.items]
                    .sort((a, b) => (a.checked ? 1 : 0) - (b.checked ? 1 : 0))
                    .map((item) => (
                      <div 
                        key={item.id}
                        onClick={() => handleToggleItemCheck(viewingList, item.id)}
                        className={cn(
                          "p-3.5 border rounded-2xl flex justify-between items-center transition-all cursor-pointer shadow-sm select-none",
                          item.checked 
                            ? "bg-slate-50/70 border-slate-100 text-slate-400 line-through dark:bg-slate-900/30 dark:border-slate-900" 
                            : "bg-white border-slate-100 hover:shadow-md dark:bg-slate-900 dark:border-slate-800"
                        )}
                      >
                        <div className="flex items-center gap-3.5 pr-2">
                          <button
                            type="button"
                            className="shrink-0 text-indigo-600 focus:outline-none"
                          >
                            {item.checked ? <CheckCircle2 size={22} className="text-emerald-500" /> : <Square size={22} className="text-slate-300 dark:text-slate-700 hover:text-indigo-600" />}
                          </button>
                          <div className="min-w-0">
                            <p className="font-bold text-sm leading-snug truncate">
                              {item.product}
                            </p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold mt-0.5">
                              পরিমান: {item.quantity}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={cn("text-sm font-extrabold", item.checked ? "text-slate-400" : "text-slate-900 dark:text-slate-200")}>
                            {formatCurrency(item.price)}
                          </span>
                        </div>
                      </div>
                    ))
                )}
              </div>

              {/* Bottom control summary block */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-900 space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-xs text-slate-400 block font-bold uppercase tracking-wider">টোটাল বাজার মূল্য</span>
                    <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                      {formatCurrency(viewingList.totalAmount)}
                    </span>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-full">
                    মোট পণ্য: {viewingList.items.length} 
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => startEditing(viewingList)}
                    className="py-3 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-2xl font-bold flex flex-col justify-center items-center gap-1 border border-slate-100 dark:border-slate-800 active:scale-95 transition-all text-xs"
                  >
                    <Edit3 size={15} /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadBazarPDF(viewingList)}
                    className="py-3 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl font-bold flex flex-col justify-center items-center gap-1 border border-slate-100 dark:border-slate-800/20 active:scale-95 transition-all text-xs"
                  >
                    <Download size={15} /> Download
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePrint(viewingList)}
                    className="py-3 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl font-bold flex flex-col justify-center items-center gap-1 border border-slate-100 dark:border-slate-800/20 active:scale-95 transition-all text-xs"
                  >
                    <Printer size={15} /> Print
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteId(viewingList.id!)}
                    className="py-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-2xl font-bold flex flex-col justify-center items-center gap-1 border border-slate-100 dark:border-slate-800/20 active:scale-95 transition-all text-xs"
                  >
                    <Trash2 size={15} /> Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={!!deleteId}
        title="বাজার তালিকা কি মুছে ফেলবেন?"
        message="আপনি কি এই বাজার তালিকাটি চিরতরে ডিলিট করতে চান? এই কাজ পুনরায় ফিরিয়ে আনা সম্ভব নয়।"
        confirmText="ডিলিট করুন"
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
      />

      {/* Hidden Printable Invoice template */}
      <div className="hidden">
        {activePrintList && (
          <div id="print-section" className="p-8 bg-white text-slate-900 font-sans max-w-lg border border-slate-300 rounded-xl my-4">
            <div className="text-center mb-6 pb-4 border-b border-solid border-slate-300">
              <h1 className="text-2xl font-extrabold tracking-wider uppercase mb-1">বাজার রসিদ (Bazar Receipt)</h1>
              <p className="text-sm font-bold text-slate-800">{activePrintList.title}</p>
              <p className="text-xs text-slate-500 mt-1">তারিখ: {format(new Date(activePrintList.date), 'PPP')}</p>
            </div>
            
            <table className="w-full text-left border-collapse mb-6 text-xs">
              <thead>
                <tr className="border-b-2 border-slate-400 text-slate-700">
                  <th className="py-2.5 font-bold">আইটেম/পণ্য (Item Name)</th>
                  <th className="py-2.5 text-center font-bold">পরিমান (Qty)</th>
                  <th className="py-2.5 text-right font-bold">মূল্য (Price)</th>
                </tr>
              </thead>
              <tbody>
                {activePrintList.items.map((item, idx) => (
                  <tr key={idx} className="border-b border-slate-200">
                    <td className="py-2.5 font-medium">{item.product} {item.checked ? ' (সংগৃহীত)' : ''}</td>
                    <td className="py-2.5 text-center text-slate-650">{item.quantity}</td>
                    <td className="py-2.5 text-right font-bold">{formatCurrency(item.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-between items-center text-sm font-black border-t-2 border-slate-400 pt-3.5">
              <span>সর্বমোট বাজার খরচ (Total Amount)</span>
              <span>{formatCurrency(activePrintList.totalAmount)}</span>
            </div>

            <div className="text-center text-[10px] text-slate-400 mt-10 border-t border-dashed border-slate-300 pt-3">
              Generated securely on FinTrack • Thank you!
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
