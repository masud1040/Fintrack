import { collection, getDocs, query, where } from 'firebase/firestore';
import { db as firestoreDb } from './firebase';
import { db as dexieDb, restoreFromFirestore } from '../db';

export async function pullDataFromFirestore(userId: string) {
  const collections = ['accounts', 'categories', 'transactions', 'recurringTransactions', 'debts', 'notes', 'notifications', 'bazarLists'];
  const sdb = dexieDb as any;
  
  for (const colName of collections) {
    try {
      const q = query(collection(firestoreDb, colName), where('userId', '==', userId));
      const snapshot = await getDocs(q);
      
      const items: any[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        const restored = restoreFromFirestore(data);
        const numericId = Number(doc.id);
        restored.id = isNaN(numericId) ? doc.id : numericId;
        items.push(restored);
      });
      
      const table = sdb[colName];
      if (table) {
        // Temporarily stop replication while pulling records back to local cache
        sdb._isSyncing = true;
        try {
          // Clear previous local cache for this specific user
          await table.where('userId').equals(userId).delete();
          if (items.length > 0) {
            await table.bulkPut(items);
          }
        } finally {
          sdb._isSyncing = false;
        }
      }
    } catch (err) {
      console.error(`Error pulling collection ${colName} from Firestore:`, err);
    }
  }
}
