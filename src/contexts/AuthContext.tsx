import React, { createContext, useContext, useState, useEffect } from 'react';
import { db, User } from '../db';
import { Capacitor } from '@capacitor/core';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile as updateFirebaseProfile,
  deleteUser,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { auth, db as firestoreDb, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, setDoc, deleteDoc, writeBatch, query, collection, where, getDocs } from 'firebase/firestore';
import { pullDataFromFirestore } from '../lib/syncManager';

interface AuthContextType {
  currentUser: User | null;
  login: (email: string, pass: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginAsGuest: () => Promise<void>;
  signup: (name: string, email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (name: string, avatar: string, phoneNumber?: string, companyName?: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
  authError: string | null;
  clearAuthError: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const cached = localStorage.getItem('fintrack_local_session');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(() => {
    // If we have a cached local session, we can skip immediate hard blocking load screen
    return !localStorage.getItem('fintrack_local_session');
  });

  useEffect(() => {
    // Set explicit Local Persistence
    setPersistence(auth, browserLocalPersistence).catch(err => {
      console.warn('Firebase persistence setting error:', err);
    });

    // Handle redirect results if we signed in via redirect
    getRedirectResult(auth).catch((error: any) => {
      console.warn('Firebase Redirect Auth Error:', error);
      let errMsg = 'গুগল লগইন ব্যর্থ হয়েছে।';
      if (error.code === 'auth/unauthorized-domain') {
        errMsg = 'এই ডোমেইনটি (Domain) ফায়ারবেস ডোমেইন তালিকায় অনুমোদিত নয়। দয়া করে ফায়ারবেস কনসোলে Settings -> Authorized Domains-এ এটি যোগ করুন।';
      }
      setAuthError(errMsg);
    });

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setIsLoading(true);
        try {
          // 1. Check if profile exists in Firestore /user
          const userDocRef = doc(firestoreDb, 'users', firebaseUser.uid);
          let userDoc;
          try {
            userDoc = await getDoc(userDocRef);
          } catch (getErr) {
            handleFirestoreError(getErr, OperationType.GET, `users/${firebaseUser.uid}`);
          }
          
          let name = firebaseUser.displayName || 'User';
          let email = firebaseUser.email || '';
          let avatar = firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}&backgroundColor=b6e3f4`;
          let phoneNumber = '';
          let companyName = '';
          
          if (userDoc && userDoc.exists()) {
            const data = userDoc.data();
            name = data.name || name;
            email = data.email || email;
            avatar = data.avatar || avatar;
            phoneNumber = data.phoneNumber || '';
            companyName = data.companyName || '';
          } else {
            // First time Google Sign In profile seed
            try {
              await setDoc(userDocRef, { name, email, avatar, phoneNumber, companyName });
            } catch (setErr) {
              handleFirestoreError(setErr, OperationType.CREATE, `users/${firebaseUser.uid}`);
            }
          }

          const localUser: User = {
            id: firebaseUser.uid,
            name,
            email,
            avatar,
            phoneNumber,
            companyName
          };

          // 2. Synchronize Cloud Firestore records down to local Dexie Cache for offline use
          await pullDataFromFirestore(firebaseUser.uid);

          setCurrentUser(localUser);
          localStorage.setItem('currentUserId', firebaseUser.uid);
          localStorage.setItem('fintrack_local_session', JSON.stringify(localUser));
        } catch (error) {
          console.error('Error loading user profile:', error);
        } finally {
          setIsLoading(false);
        }
      } else {
        // If there was a cached local session on reload, keep it unless they explicitly signed out!
        const cached = localStorage.getItem('fintrack_local_session');
        if (!cached) {
          setCurrentUser(null);
          localStorage.removeItem('currentUserId');
        } else {
          try {
            const cachedUser = JSON.parse(cached);
            setCurrentUser(cachedUser);
            localStorage.setItem('currentUserId', cachedUser.id);
          } catch (e) {
            setCurrentUser(null);
            localStorage.removeItem('currentUserId');
          }
        }
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, pass: string) => {
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error: any) {
      let msg = 'Invalid email or password';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        msg = 'Invalid credentials';
      } else if (error.code === 'auth/invalid-email') {
        msg = 'Invalid email address';
      } else if (error.code === 'auth/operation-not-allowed') {
        msg = 'ইমেইল/পাসওয়ার্ড সাইন-ইন বন্ধ রয়েছে। দয়া করে নিচের "Google" বাটনে ক্লিক করে লগইন করুন।';
      }
      setAuthError(msg);
      throw error;
    }
  };

  const loginWithGoogle = async () => {
    setAuthError(null);
    
    // Check if we are running in an APK / Native mobile app where Firebase Web popup/redirect is blocked natively
    if (Capacitor.isNativePlatform()) {
      const errMsg = 'অ্যান্ড্রয়েড অ্যাপ (APK) এর ভেতর সরাসরি গুগল লগইন করা সম্ভব নয়। গুগল লগইন সফল করতে অনুগ্রহ করে ইমেইল ও পাসওয়ার্ড দিয়ে একাউন্ট তৈরি (Signup) করুন অথবা আমাদের স্পেশাল ওয়েবসাইট সংস্করণ ব্যবহার করুন (যেখানে গুগল লগইন ও পিডিএফ ডাউনলোড উভয়ই শতভাগ সচল রয়েছে)।';
      setAuthError(errMsg);
      throw new Error('Google Sign-In is not supported inside standard Android WebView. Please use Email/Password signup or the Web app version.');
    }

    try {
      const provider = new GoogleAuthProvider();
      // Use redirect directly on mobile web, or in embedded webviews
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isMobile) {
        await signInWithRedirect(auth, provider);
      } else {
        try {
          await signInWithPopup(auth, provider);
        } catch (popupErr: any) {
          console.warn('Popup blocked, trying redirect fallback:', popupErr);
          if (popupErr.code === 'auth/popup-blocked' || popupErr.code === 'auth/cancelled-popup-request') {
            await signInWithRedirect(auth, provider);
          } else {
            throw popupErr;
          }
        }
      }
    } catch (error: any) {
      console.warn('Google Auth Error: ', error);
      let errMsg = 'গুগল লগইন এর পপআপ ব্রাউজার দ্বারা ব্লক করা হয়েছে। দয়া করে স্ক্রিনের উপরে বা নিচে থাকা "Open in new tab" বাটনে ক্লিক করে নতুন ট্যাবে ট্রাই করুন।';
      if (error.code === 'auth/popup-closed-by-user') {
        errMsg = 'লগইন পপআপ বন্ধ করা হয়েছে। পুনরায় চেষ্টা করুন বা নতুন ট্যাবে ট্রাই করুন।';
      } else if (error.code === 'auth/unauthorized-domain') {
        errMsg = 'এই ডোমেইনটি (Domain) ফায়ারবেসে অনুমোদিত নয়। দয়া করে ফায়ারবেস কনসোলে Authentication -> Settings -> Authorized Domains-এ আপনার ডোমেইনটি যোগ করুন।';
      } else if (error.message) {
        errMsg = `Google error: ${error.message}`;
      }
      setAuthError(errMsg);
      throw error;
    }
  };

  const signup = async (name: string, email: string, pass: string) => {
    setAuthError(null);
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, pass);
      const firebaseUser = userCred.user;
      const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}&backgroundColor=b6e3f4`;

      // Update Firebase Auth Profile
      await updateFirebaseProfile(firebaseUser, {
        displayName: name,
        photoURL: avatar
      });

      // Write profile to cloud users collection
      await setDoc(doc(firestoreDb, 'users', firebaseUser.uid), {
        name,
        email,
        avatar
      });

      // Clear local cache temporarily to start fresh
      const collections = ['accounts', 'categories', 'transactions', 'recurringTransactions', 'debts', 'notes', 'notifications'];
      const sdb = db as any;
      sdb._isSyncing = true;
      try {
        for (const col of collections) {
          await sdb[col].where('userId').equals(firebaseUser.uid).delete();
        }
      } finally {
        sdb._isSyncing = false;
      }

      // Seed default categories - they will automatically replicate to Firestore via patched db.ts
      await db.categories.bulkAdd([
        { name: 'Food', type: 'expense', color: '#EF4444', userId: firebaseUser.uid as any },
        { name: 'Transport', type: 'expense', color: '#F59E0B', userId: firebaseUser.uid as any },
        { name: 'Shopping', type: 'expense', color: '#3B82F6', userId: firebaseUser.uid as any },
        { name: 'Salary', type: 'income', color: '#10B981', userId: firebaseUser.uid as any },
      ]);

      // Seed default account with 0 balance
      await db.accounts.add({
        name: 'Cash',
        type: 'cash',
        initialBalance: 0,
        currentBalance: 0,
        userId: firebaseUser.uid as any,
      });

    } catch (error: any) {
      let msg = 'Error signing up';
      if (error.code === 'auth/email-already-in-use') {
        msg = 'Email already exists';
      } else if (error.code === 'auth/weak-password') {
        msg = 'Password should be at least 6 characters';
      } else if (error.code === 'auth/operation-not-allowed') {
        msg = 'ইমেইল অ্যাকাউন্ট তৈরি করা আপাতত সচল নেই। গুগল (Google) সাইন-ইন সচল আছে, অনুগ্রহ করে নিচের Google বাটনে ক্লিক করে লগইন করুন।';
      }
      setAuthError(msg);
      throw error;
    }
  };

  const loginAsGuest = async () => {
    setAuthError(null);
    setIsLoading(true);
    try {
      const guestId = 'guest_user';
      const localUser: User = {
        id: guestId,
        name: 'Guest User (ডেমো)',
        email: 'guest@example.com',
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=Guest&backgroundColor=b6e3f4`,
        phoneNumber: '',
        companyName: ''
      };

      // Seed default categories
      const existingCats = await db.categories.where('userId').equals(guestId).toArray();
      if (existingCats.length === 0) {
        await db.categories.bulkAdd([
          { name: 'خوراک (Food)', type: 'expense', color: '#EF4444', userId: guestId as any },
          { name: 'যাতায়াত (Transport)', type: 'expense', color: '#F59E0B', userId: guestId as any },
          { name: 'কেনাকাটা (Shopping)', type: 'expense', color: '#3B82F6', userId: guestId as any },
          { name: 'বেতন (Salary)', type: 'income', color: '#10B981', userId: guestId as any },
        ]);
      }

      const existingAccs = await db.accounts.where('userId').equals(guestId).toArray();
      if (existingAccs.length === 0) {
        await db.accounts.add({
          name: 'নগদ টাকা (Cash)',
          type: 'cash',
          initialBalance: 0,
          currentBalance: 0,
          userId: guestId as any,
        });
      }

      setCurrentUser(localUser);
      localStorage.setItem('currentUserId', guestId);
      localStorage.setItem('fintrack_local_session', JSON.stringify(localUser));
    } catch (error: any) {
      console.error('Guest login error:', error);
      setAuthError('ডেমো লগইন এ সমস্যা হয়েছে।');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    localStorage.removeItem('fintrack_local_session');
    localStorage.removeItem('currentUserId');
    await signOut(auth).catch(() => {});
    setCurrentUser(null);
  };

  const updateProfile = async (name: string, avatar: string, phoneNumber?: string, companyName?: string) => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      if (currentUser && currentUser.id === 'guest_user') {
        const updatedUser: User = {
          id: 'guest_user',
          name,
          email: currentUser.email,
          avatar,
          phoneNumber: phoneNumber || '',
          companyName: companyName || ''
        };
        setCurrentUser(updatedUser);
        localStorage.setItem('fintrack_local_session', JSON.stringify(updatedUser));
      }
      return;
    }

    // Update Auth profile.
    await updateFirebaseProfile(firebaseUser, {
      displayName: name,
      photoURL: avatar
    });

    // Write to Firestore db
    await setDoc(doc(firestoreDb, 'users', firebaseUser.uid), {
      name,
      email: firebaseUser.email || '',
      avatar,
      phoneNumber: phoneNumber || '',
      companyName: companyName || ''
    }, { merge: true });

    // Update locally too
    const updatedUser: User = {
      id: firebaseUser.uid,
      name,
      email: firebaseUser.email || currentUser?.email || '',
      avatar,
      phoneNumber: phoneNumber || '',
      companyName: companyName || ''
    };
    setCurrentUser(updatedUser);
    localStorage.setItem('fintrack_local_session', JSON.stringify(updatedUser));
  };

  const deleteAccount = async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;

    const userId = firebaseUser.uid;

    // Remove Firestore entries (Clean up cloud storage)
    const collections = ['accounts', 'categories', 'transactions', 'recurringTransactions', 'debts', 'notes', 'notifications'];
    for (const colName of collections) {
      try {
        const q = query(collection(firestoreDb, colName), where('userId', '==', userId));
        const snap = await getDocs(q);
        const batch = writeBatch(firestoreDb);
        snap.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
      } catch (e) {
        console.error(`Error deleting collection ${colName} from Firestore`, e);
      }
    }

    // Suppress local replication and delete Dexie tables
    const sdb = db as any;
    sdb._isSyncing = true;
    try {
      for (const col of collections) {
        await sdb[col].where('userId').equals(userId).delete();
      }
    } finally {
      sdb._isSyncing = false;
    }

    // Delete Firestore profile
    await deleteDoc(doc(firestoreDb, 'users', userId));

    // Finally delete Firebase Auth User
    await deleteUser(firebaseUser);
    setCurrentUser(null);
  };

  const clearAuthError = () => setAuthError(null);

  return (
    <AuthContext.Provider value={{ 
      currentUser, 
      login, 
      loginWithGoogle,
      loginAsGuest,
      signup, 
      logout, 
      updateProfile, 
      deleteAccount, 
      authError, 
      clearAuthError,
      isLoading
    }}>
      {children}
    </AuthContext.Provider>
  );
};
