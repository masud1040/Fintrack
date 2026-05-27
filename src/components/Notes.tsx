import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Note } from '../db';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Search, Pin, Trash2, Download, X, Check, Palette, MoreVertical } from 'lucide-react';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import { cn, savePDF } from '../lib/utils';
import { setupPDFCustomFonts } from '../lib/pdfCustomFonts';
import { ConfirmModal } from './ui/ConfirmModal';

const COLORS = [
  { name: 'Default', value: 'bg-white dark:bg-slate-900' },
  { name: 'Red', value: 'bg-red-100 dark:bg-red-900/30' },
  { name: 'Orange', value: 'bg-orange-100 dark:bg-orange-900/30' },
  { name: 'Yellow', value: 'bg-yellow-100 dark:bg-yellow-900/30' },
  { name: 'Green', value: 'bg-green-100 dark:bg-green-900/30' },
  { name: 'Teal', value: 'bg-teal-100 dark:bg-teal-900/30' },
  { name: 'Blue', value: 'bg-blue-100 dark:bg-blue-900/30' },
  { name: 'Purple', value: 'bg-purple-100 dark:bg-purple-900/30' },
  { name: 'Pink', value: 'bg-pink-100 dark:bg-pink-900/30' },
];

export function Notes() {
  const { currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [showColorPalette, setShowColorPalette] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  
  // Form states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLORS[0].value);
  const [isPinned, setIsPinned] = useState(false);

  const notes = useLiveQuery(
    () => {
      if (!currentUser?.id) return [];
      let query = db.notes.where('userId').equals(currentUser.id);
      return query.toArray().then(arr => {
        return arr.filter(n => 
          n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
          n.content.toLowerCase().includes(searchQuery.toLowerCase())
        ).sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return b.date.getTime() - a.date.getTime();
        });
      });
    },
    [currentUser?.id, searchQuery]
  ) || [];

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!content.trim() && !title.trim()) {
      resetForm();
      return;
    }

    const noteData = {
      userId: currentUser!.id!,
      title: title.trim(),
      content: content.trim(),
      color: selectedColor,
      pinned: isPinned,
      date: new Date(),
    };

    if (editingNote?.id) {
      await db.notes.update(editingNote.id, noteData);
    } else {
      await db.notes.add(noteData);
    }

    resetForm();
  };

  const resetForm = () => {
    setTitle('');
    setContent('');
    setSelectedColor(COLORS[0].value);
    setIsPinned(false);
    setIsAdding(false);
    setShowColorPalette(false);
    setEditingNote(null);
  };

  const startEditing = (note: Note) => {
    setEditingNote(note);
    setTitle(note.title);
    setContent(note.content);
    setSelectedColor(note.color || COLORS[0].value);
    setIsPinned(note.pinned);
    setIsAdding(true);
    setShowColorPalette(false);
  };

  const handleDelete = async (id: number) => {
    await db.notes.delete(id);
  };

  const togglePin = async (note: Note) => {
    await db.notes.update(note.id!, { pinned: !note.pinned });
  };

  const downloadPDF = async (note: Note) => {
    const doc = new jsPDF();
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - margin * 2;
    
    // Load custom fonts
    const fontsLoaded = await setupPDFCustomFonts(doc);
    const titleFont = fontsLoaded ? 'Times New Roman' : 'helvetica';
    const bodyFont = fontsLoaded ? 'Hind Siliguri' : 'helvetica';
    
    let currentY = 30;
    
    // Title
    doc.setFont(titleFont, "bold");
    doc.setFontSize(22);
    doc.setTextColor(40, 40, 40);
    const splitTitle = doc.splitTextToSize(note.title || 'Untitled Note', contentWidth);
    doc.text(splitTitle, margin, currentY);
    currentY += (splitTitle.length * 8) + 5;
    
    // Date
    doc.setFont(titleFont, "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Created on: ${format(note.date, 'PPP p')}`, margin, currentY);
    currentY += 15;
    
    // Content
    doc.setFont(bodyFont, "normal");
    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);
    const splitContent = doc.splitTextToSize(note.content, contentWidth);
    
    for (let i = 0; i < splitContent.length; i++) {
      if (currentY > pageHeight - margin) {
        doc.addPage();
        currentY = margin;
        // set font again on new page to be safe
        doc.setFont(bodyFont, "normal");
        doc.setFontSize(11);
        doc.setTextColor(60, 60, 60);
      }
      doc.text(splitContent[i], margin, currentY);
      currentY += 7;
    }
    
    const fileName = `${note.title || 'note'}-${format(new Date(), 'yyyyMMdd')}.pdf`;
    await savePDF(doc, fileName);
  };

  if (!currentUser) {
    return (
      <div className="p-8 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-3xl mt-8">
        Please log in to manage your notes.
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Search Bar */}
      <div className="relative max-w-2xl mx-auto">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input
          type="text"
          placeholder="Search notes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
        />
      </div>

      {/* Add Note Area */}
      <div className="max-w-xl mx-auto">
        {!isAdding ? (
          <div 
            onClick={() => setIsAdding(true)}
            className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm cursor-text text-slate-500 flex items-center justify-between"
          >
            <span>Take a note...</span>
            <Plus size={20} />
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn("p-4 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800", selectedColor)}
          >
            <div className="flex items-center justify-between mb-2">
              <input
                type="text"
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-transparent font-bold text-lg outline-none placeholder:text-slate-400"
              />
              <button 
                onClick={() => setIsPinned(!isPinned)}
                className={cn("p-2 rounded-full hover:bg-black/5 transition-colors", isPinned ? "text-indigo-600" : "text-slate-400")}
              >
                <Pin size={20} fill={isPinned ? "currentColor" : "none"} />
              </button>
            </div>
            <textarea
              placeholder="Take a note..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full bg-transparent min-h-[100px] outline-none resize-none placeholder:text-slate-400"
              autoFocus
            />
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button 
                    onClick={() => setShowColorPalette(!showColorPalette)}
                    className="p-2 rounded-full hover:bg-black/5 text-slate-500 transition-colors"
                    title="Change color"
                  >
                    <Palette size={18} />
                  </button>
                  
                  <AnimatePresence>
                    {showColorPalette && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                        className="absolute bottom-full left-0 mb-2 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl grid grid-cols-5 gap-1.5 z-50 min-w-[160px]"
                      >
                        {COLORS.map(c => (
                          <button
                            key={c.name}
                            onClick={() => {
                              setSelectedColor(c.value);
                              setShowColorPalette(false);
                            }}
                            className={cn(
                              "w-6 h-6 rounded-full border border-slate-200 dark:border-slate-600 flex items-center justify-center transition-transform hover:scale-110",
                              c.value
                            )}
                            title={c.name}
                          >
                            {selectedColor === c.value && (
                              <Check size={12} className="text-slate-600 dark:text-slate-300" />
                            )}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {editingNote && (
                  <button 
                    type="button" 
                    onClick={() => setDeleteId(editingNote.id!)}
                    className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 mr-2 transition-colors"
                    title="Delete Note"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
                <button 
                  onClick={resetForm}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-black/5 rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleSave()}
                  className="px-4 py-2 text-sm font-bold bg-indigo-600 text-white rounded-lg shadow-sm hover:bg-indigo-700 transition-colors"
                >
                  {editingNote ? 'Update' : 'Save'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Notes Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <AnimatePresence mode="popLayout">
          {notes.map(note => (
            <motion.div
              key={note.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={cn(
                "group relative p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col h-fit min-h-[150px]",
                note.color || COLORS[0].value
              )}
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-bold text-slate-900 dark:text-white line-clamp-2">
                  {note.title || 'Untitled'}
                </h3>
                <button 
                  onClick={(e) => { e.stopPropagation(); togglePin(note); }}
                  className={cn(
                    "p-1.5 rounded-full hover:bg-black/5 transition-opacity",
                    note.pinned ? "text-indigo-600 opacity-100" : "text-slate-400 opacity-0 group-hover:opacity-100"
                  )}
                >
                  <Pin size={16} fill={note.pinned ? "currentColor" : "none"} />
                </button>
              </div>
              
              <div 
                onClick={() => startEditing(note)}
                className="flex-1 cursor-pointer text-slate-700 dark:text-slate-300 text-sm whitespace-pre-wrap line-clamp-[10]"
              >
                {note.content}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-900/10 dark:border-slate-100/10 pt-3 transition-opacity">
                <span className="text-[10px] text-slate-400 font-medium">
                  {format(note.date, 'MMM d, yyyy')}
                </span>
                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={() => downloadPDF(note)}
                    className="p-2 rounded-xl bg-slate-55/60 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    title="Download PDF"
                  >
                    <Download size={15} />
                  </button>
                  <button 
                    onClick={() => setDeleteId(note.id!)}
                    className="p-2 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 hover:text-red-600 dark:hover:text-red-300 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <ConfirmModal
        isOpen={!!deleteId}
        title="Delete Note?"
        message="Are you sure you want to delete this note? This action cannot be undone."
        confirmText="Delete"
        onConfirm={async () => {
          if (deleteId) {
            await handleDelete(deleteId);
            if (editingNote?.id === deleteId) {
              resetForm();
            }
            setDeleteId(null);
          }
        }}
        onCancel={() => setDeleteId(null)}
      />

      {notes.length === 0 && !isAdding && (
        <div className="text-center py-20">
          <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search size={32} className="text-slate-400" />
          </div>
          <p className="text-slate-500 dark:text-slate-400">No notes found.</p>
        </div>
      )}
    </div>
  );
}
