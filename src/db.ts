import Dexie, { type EntityTable } from 'dexie';

export type TransactionType = 'income' | 'expense';
export type DebtType = 'payable' | 'receivable';
export type DebtStatus = 'paid' | 'unpaid';
export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface User {
  id?: number | string;
  name: string;
  email: string;
  password?: string;
  avatar?: string;
  phoneNumber?: string;
  companyName?: string;
}

export interface Account {
  id?: number;
  userId: number | string;
  name: string;
  initialBalance: number;
  currentBalance: number;
  type: string; // e.g., 'Bkash', 'Nagad', 'Cash', 'Bank'
}

export interface Category {
  id?: number;
  userId: number | string;
  name: string;
  type: TransactionType;
  icon?: string;
  color?: string;
}

export interface Transaction {
  id?: number;
  userId: number | string;
  amount: number;
  type: TransactionType;
  categoryId: number;
  accountId: number;
  date: Date;
  note?: string;
}

export interface RecurringTransaction {
  id?: number;
  userId: number | string;
  amount: number;
  type: TransactionType;
  categoryId: number;
  accountId: number;
  frequency: Frequency;
  startDate: Date;
  endDate?: Date;
  lastGeneratedDate?: Date;
  dueDate?: number; // Day of month (1-31) or day of week (0-6)
  note?: string;
}

export interface AppNotification {
  id?: number;
  userId: number | string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'report';
  date: Date;
  read: boolean;
  link?: string;
}

export interface Debt {
  id?: number;
  userId: number | string;
  person: string;
  amount: number;
  type: DebtType;
  status: DebtStatus;
  date: Date;
  dueDate?: Date;
  note?: string;
  phoneNumber?: string;
  whatsappNumber?: string;
  remainingAmount?: number;
  payments?: Array<{
    amount: number;
    date: Date;
    note?: string;
    accountId?: number;
  }>;
}

export interface Note {
  id?: number;
  userId: number | string;
  title: string;
  content: string;
  color?: string;
  date: Date;
  pinned: boolean;
}

export interface BazarItem {
  id: string; // unique item id (client side string)
  product: string;
  quantity: string;
  price: number;
  checked: boolean;
}

export interface BazarList {
  id?: number;
  userId: number | string;
  title: string;
  items: BazarItem[];
  date: Date;
  totalAmount: number;
}

const db = new Dexie('ExpenseTrackerDB') as Dexie & {
  _isSyncing?: boolean;
  users: EntityTable<User, 'id'>;
  accounts: EntityTable<Account, 'id'>;
  categories: EntityTable<Category, 'id'>;
  transactions: EntityTable<Transaction, 'id'>;
  recurringTransactions: EntityTable<RecurringTransaction, 'id'>;
  notifications: EntityTable<AppNotification, 'id'>;
  debts: EntityTable<Debt, 'id'>;
  notes: EntityTable<Note, 'id'>;
  bazarLists: EntityTable<BazarList, 'id'>;
};

db.version(1).stores({
  accounts: '++id, name, type',
  categories: '++id, name, type',
  transactions: '++id, type, categoryId, accountId, date',
  debts: '++id, person, type, status, date'
});

db.version(2).stores({
  users: '++id, email',
  accounts: '++id, name, type, userId',
  categories: '++id, name, type, userId',
  transactions: '++id, type, categoryId, accountId, date, userId',
  debts: '++id, person, type, status, date, userId'
});

db.version(3).stores({
  recurringTransactions: '++id, userId, frequency, startDate'
});

db.version(4).stores({
  notifications: '++id, userId, date, read'
});

db.version(5).stores({
  notes: '++id, userId, title, date, pinned'
});

db.version(6).stores({
  debts: '++id, person, type, status, date, userId, phoneNumber, whatsappNumber'
});

db.version(7).stores({
  bazarLists: '++id, userId, title, date'
});

// Firebase real-time sync decorators
const COL_SYNC = [
  'accounts',
  'categories',
  'transactions',
  'recurringTransactions',
  'notifications',
  'debts',
  'notes',
  'bazarLists'
];

const sdb = db as any;
sdb._isSyncing = false;

function prepareForFirestore(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  if (Array.isArray(obj)) {
    return obj.map(item => prepareForFirestore(item));
  }
  if (typeof obj === 'object') {
    const result: any = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined) {
        result[key] = prepareForFirestore(val);
      }
    }
    return result;
  }
  return obj;
}

export function restoreFromFirestore(obj: any): any {
  const result = { ...obj };
  for (const key of Object.keys(result)) {
    if (typeof result[key] === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(result[key])) {
      result[key] = new Date(result[key]);
    } else if (result[key] && typeof result[key] === 'object' && result[key].seconds !== undefined) {
      result[key] = new Date(result[key].seconds * 1000);
    }
  }
  return result;
}

// Decorate each table to seamlessly sync with Firebase Firestore
COL_SYNC.forEach(tableName => {
  const table = sdb[tableName];
  if (!table) return;

  const originalAdd = table.add.bind(table);
  const originalUpdate = table.update.bind(table);
  const originalDelete = table.delete.bind(table);
  const originalBulkAdd = table.bulkAdd ? table.bulkAdd.bind(table) : null;
  const originalPut = table.put ? table.put.bind(table) : null;

  table.add = async (obj: any, key?: any) => {
    const id = await originalAdd(obj, key);
    if (sdb._isSyncing) return id;

    try {
      const { auth, db: firestoreDb } = await import('./lib/firebase');
      const { doc, setDoc } = await import('firebase/firestore');
      const uid = auth.currentUser?.uid;
      if (uid) {
        const prepared = prepareForFirestore({ ...obj, id, userId: uid });
        await setDoc(doc(firestoreDb, tableName, String(id)), prepared);
      }
    } catch (e) {
      console.error(`Firebase real-time sync failed for add (table: ${tableName}):`, e);
    }
    return id;
  };

  table.update = async (id: any, changes: any) => {
    const updated = await originalUpdate(id, changes);
    if (sdb._isSyncing) return updated;

    try {
      const { auth, db: firestoreDb } = await import('./lib/firebase');
      const { doc, setDoc } = await import('firebase/firestore');
      const uid = auth.currentUser?.uid;
      if (uid) {
        const fullObj = await table.get(id);
        if (fullObj) {
          const prepared = prepareForFirestore({ ...fullObj, userId: uid });
          await setDoc(doc(firestoreDb, tableName, String(id)), prepared);
        }
      }
    } catch (e) {
      console.error(`Firebase real-time sync failed for update (table: ${tableName}):`, e);
    }
    return updated;
  };

  table.delete = async (id: any) => {
    await originalDelete(id);
    if (sdb._isSyncing) return;

    try {
      const { auth, db: firestoreDb } = await import('./lib/firebase');
      const { doc, deleteDoc } = await import('firebase/firestore');
      const uid = auth.currentUser?.uid;
      if (uid) {
        await deleteDoc(doc(firestoreDb, tableName, String(id)));
      }
    } catch (e) {
      console.error(`Firebase real-time sync failed for delete (table: ${tableName}):`, e);
    }
  };

  if (originalPut) {
    table.put = async (obj: any, key?: any) => {
      const id = await originalPut(obj, key);
      if (sdb._isSyncing) return id;

      try {
        const { auth, db: firestoreDb } = await import('./lib/firebase');
        const { doc, setDoc } = await import('firebase/firestore');
        const uid = auth.currentUser?.uid;
        if (uid) {
          const prepared = prepareForFirestore({ ...obj, id, userId: uid });
          await setDoc(doc(firestoreDb, tableName, String(id)), prepared);
        }
      } catch (e) {
        console.error(`Firebase real-time sync failed for put (table: ${tableName}):`, e);
      }
      return id;
    };
  }

  if (originalBulkAdd) {
    table.bulkAdd = async (items: any[], keys?: any, options?: any) => {
      const ids = await originalBulkAdd(items, keys, options);
      if (sdb._isSyncing) return ids;

      try {
        const { auth, db: firestoreDb } = await import('./lib/firebase');
        const { doc, setDoc } = await import('firebase/firestore');
        const uid = auth.currentUser?.uid;
        if (uid) {
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const itemId = ids[i] || item.id;
            if (itemId) {
              const prepared = prepareForFirestore({ ...item, id: itemId, userId: uid });
              await setDoc(doc(firestoreDb, tableName, String(itemId)), prepared);
            }
          }
        }
      } catch (e) {
        console.error(`Firebase real-time sync failed for bulkAdd (table: ${tableName}):`, e);
      }
      return ids;
    };
  }
});

export { db };
