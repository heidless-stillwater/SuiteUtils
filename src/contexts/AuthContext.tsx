import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User } from 'firebase/auth';
import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc, setDoc, Timestamp, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import type { UserProfile, UserRole } from '../lib/types';
import { ADMIN_EMAILS } from '../lib/types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  switchRole: (role: UserRole) => Promise<void>;
  effectiveRole: UserRole;
  isAdmin: boolean;
  isSu: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const effectiveRole: UserRole = profile?.actingAs || profile?.role || 'member';
  const isAdmin = profile?.role === 'admin' || profile?.role === 'su';
  const isSu = profile?.role === 'su';

  // Create or update user profile in suiteutils-db-0
  const createOrUpdateProfile = useCallback(async (firebaseUser: User): Promise<UserProfile> => {
    const userRef = doc(db, 'users', firebaseUser.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const existing = userSnap.data() as UserProfile;
      const providerPhoto = firebaseUser.providerData.find(p => p.photoURL)?.photoURL;
      const currentPhoto = existing.photoURL || firebaseUser.photoURL || providerPhoto || null;

      const updated: UserProfile = {
        ...existing,
        displayName: existing.displayName || firebaseUser.displayName,
        photoURL: currentPhoto,
        updatedAt: Timestamp.now(),
      };
      await setDoc(userRef, updated, { merge: true });
      return updated;
    }

    // New user
    const isAdminUser = ADMIN_EMAILS.includes(firebaseUser.email || '');
    const newProfile: UserProfile = {
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL,
      role: isAdminUser ? 'admin' : 'member',
      subscription: 'free',
      themeOverrideId: null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    await setDoc(userRef, newProfile);
    return newProfile;
  }, []);

  // Auth state listener
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const userProfile = await createOrUpdateProfile(firebaseUser);
          setProfile(userProfile);
        } catch (err) {
          console.error('[Auth] Profile sync error:', err);
          setError('Failed to sync profile');
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubAuth();
  }, [createOrUpdateProfile]);

  // Real-time profile listener
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        setProfile(snap.data() as UserProfile);
      }
    });
    return () => unsub();
  }, [user]);

  const signInWithGoogle = useCallback(async () => {
    try {
      setError(null);
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (snap.exists()) setProfile(snap.data() as UserProfile);
  }, [user]);

  const switchRole = useCallback(async (role: UserRole) => {
    if (!user || !isSu) return;
    await setDoc(doc(db, 'users', user.uid), { actingAs: role, updatedAt: Timestamp.now() }, { merge: true });
  }, [user, isSu]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        error,
        signInWithGoogle,
        signOut,
        refreshProfile,
        switchRole,
        effectiveRole,
        isAdmin,
        isSu,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
