'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
    User,
    signInWithPopup,
    GoogleAuthProvider,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    getRedirectResult
} from 'firebase/auth';
import { doc, getDoc, setDoc, Timestamp, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile, UserRole, SubscriptionTier, AudienceMode, ADMIN_EMAILS, UserCredits, DAILY_ALLOWANCE, SystemConfig } from './types';

interface AuthContextType {
    user: User | null;
    profile: UserProfile | null;
    credits: UserCredits | null;
    loading: boolean;
    error: string | null;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
    refreshCredits: () => Promise<void>;
    switchRole: (role: UserRole) => Promise<void>;
    setAudienceMode: (mode: AudienceMode) => Promise<void>;
    effectiveRole: UserRole;
    isAdmin: boolean;
    isSu: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [credits, setCredits] = useState<UserCredits | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Determine effective role (considering role-switching)
    const effectiveRole: UserRole = profile?.actingAs || profile?.role || 'member';
    const isAdmin = profile?.role === 'admin' || profile?.role === 'su';
    const isSu = profile?.role === 'su';

    // --- Sovereign Identity Hardening ---
    const normalizeSubscription = (sub: any): SubscriptionTier => {
        if (!sub) return 'free';
        if (typeof sub === 'string') return sub as SubscriptionTier;
        
        // If it's the drifted metadata object, resolve to the highest tier detected
        if (typeof sub === 'object') {
            const keys = Object.keys(sub);
            if (keys.includes('activeSuites')) {
                const suites = sub.activeSuites || [];
                if (suites.includes('prompttool-pro') || suites.includes('accreditation-enterprise')) return 'pro';
                if (suites.includes('prompttool')) return 'pro';
            }
        }
        return 'free';
    };

    // Create or update user profile
    const createOrUpdateProfile = async (firebaseUser: User): Promise<UserProfile> => {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const existingProfile = userSnap.data() as UserProfile;
            // Update last login and any changed fields
            const isAdmin = ADMIN_EMAILS.includes(firebaseUser.email || '');
            
            // --- Deep Sync Strategy for Avatars ---
            const providerPhoto = firebaseUser.providerData.find(p => p.photoURL)?.photoURL;
            const currentPhoto = (existingProfile.photoURL && !['null', 'undefined', ''].includes(existingProfile.photoURL)) 
                ? existingProfile.photoURL 
                : (firebaseUser.photoURL || providerPhoto);

            const updatedProfile: UserProfile = {
                ...existingProfile,
                displayName: existingProfile.displayName || firebaseUser.displayName,
                photoURL: currentPhoto || null,
                subscription: normalizeSubscription(existingProfile.subscription),
                audienceMode: existingProfile.audienceMode || 'casual',
                role: existingProfile.role || (isAdmin ? 'admin' : 'member'),
                updatedAt: Timestamp.now(),
            };
            // Ensure username exists (legacy users)
            if (!updatedProfile.username) {
                const base = firebaseUser.displayName?.toLowerCase().replace(/\s+/g, '_') || 'user';
                updatedProfile.username = `${base}_${firebaseUser.uid.substring(0, 5)}`;
            }
            await setDoc(userRef, updatedProfile, { merge: true });
            return updatedProfile;
        }

        // New user - determine initial role
        const isAdmin = ADMIN_EMAILS.includes(firebaseUser.email || '');
        const base = firebaseUser.displayName?.toLowerCase().replace(/\s+/g, '_') || 'user';

        // Fetch System Config for Signup Incentives
        let initialBadges: string[] = [];
        try {
            const configSnap = await getDoc(doc(db, 'system', 'config'));
            if (configSnap.exists()) {
                const config = configSnap.data() as SystemConfig;
                if (config.incentives?.founderBadge?.enabled) {
                    initialBadges.push(config.incentives.founderBadge.badgeId);
                }
                if (config.incentives?.vanguardRole?.enabled) {
                    initialBadges.push(config.incentives.vanguardRole.roleId);
                }
            }
        } catch (e) {
            console.warn('[Auth] Failed to fetch signup incentives for badges', e);
        }

        const newProfile: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName,
            username: `${base}_${firebaseUser.uid.substring(0, 5)}`,
            photoURL: firebaseUser.photoURL,
            role: isAdmin ? 'admin' : 'member',
            subscription: 'free',
            audienceMode: 'casual',
            badges: initialBadges,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        };

        await setDoc(userRef, newProfile);
        return newProfile;
    };

    // Create or reset user credits
    const createOrUpdateCredits = async (userId: string, subscription: SubscriptionTier): Promise<UserCredits> => {
        const creditsRef = doc(db, 'users', userId, 'data', 'credits');
        const creditsSnap = await getDoc(creditsRef);
        const now = Timestamp.now();

        if (creditsSnap.exists()) {
            const existingCredits = creditsSnap.data() as UserCredits;

            // Check if daily reset is needed
            let lastResetDate: Date;
            if (existingCredits.lastDailyReset && typeof (existingCredits.lastDailyReset as any).toDate === 'function') {
                lastResetDate = (existingCredits.lastDailyReset as any).toDate();
            } else if (existingCredits.lastDailyReset) {
                lastResetDate = new Date(existingCredits.lastDailyReset as any);
            } else {
                lastResetDate = new Date(0); // Fallback to epoch if missing
            }

            const today = new Date();
            const isNewDay = lastResetDate.toDateString() !== today.toDateString();

            if (isNewDay) {
                const updatedCredits: UserCredits = {
                    ...existingCredits,
                    dailyAllowanceUsed: 0,
                    dailyAllowance: DAILY_ALLOWANCE[subscription],
                    lastDailyReset: now,
                };
                await setDoc(creditsRef, updatedCredits);
                return updatedCredits;
            }

            return existingCredits;
        }

        // New user credits
        let initialBalance = 0;
        try {
            const configSnap = await getDoc(doc(db, 'system', 'config'));
            if (configSnap.exists()) {
                const config = configSnap.data() as SystemConfig;
                if (config.incentives?.welcomeCredits?.enabled) {
                    initialBalance = config.incentives.welcomeCredits.amount;
                }
            }
        } catch (e) {
            console.warn('[Auth] Failed to fetch signup incentives for credits', e);
        }

        const newCredits: UserCredits = {
            balance: initialBalance,
            dailyAllowance: DAILY_ALLOWANCE[subscription],
            dailyAllowanceUsed: 0,
            lastDailyReset: now,
            expiresAt: null,
            totalPurchased: 0, // Incentive credits aren't "purchased"
            totalUsed: 0,
        };

        await setDoc(creditsRef, newCredits);

        // Record the incentive transaction if balance > 0
        if (initialBalance > 0) {
            const txRef = doc(db, 'users', userId, 'data', 'credits', 'transactions', 'welcome_bonus');
            await setDoc(txRef, {
                type: 'daily_allowance', // Closest type for now
                amount: initialBalance,
                description: 'Stillwater Welcome Pack',
                createdAt: now,
            });
        }

        return newCredits;
    };

    // Manual refresh is now mostly redundant due to onSnapshot, but keeping for compatibility
    const refreshProfile = useCallback(async () => {
        if (!user) return;
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            setProfile(userSnap.data() as UserProfile);
        }
    }, [user]);

    const refreshCredits = useCallback(async () => {
        if (!user) return;
        const creditsRef = doc(db, 'users', user.uid, 'data', 'credits');
        const creditsSnap = await getDoc(creditsRef);
        if (creditsSnap.exists()) {
            setCredits(creditsSnap.data() as UserCredits);
        }
    }, [user]);

    // Sign in with Google
    const signInWithGoogle = async () => {
        try {
            setError(null);
            const provider = new GoogleAuthProvider();
            // Force account selection every time
            provider.setCustomParameters({
                prompt: 'select_account'
            });
            await signInWithPopup(auth, provider);
        } catch (err: any) {
            setError(err.message);
            console.error('Sign in error:', err);
        }
    };

    // Sign out
    const signOut = async () => {
        try {
            await firebaseSignOut(auth);
            setProfile(null);
            setCredits(null);
            // Redirect to landing page after sign-out
            window.location.href = '/';
        } catch (err: any) {
            setError(err.message);
            console.error('Sign out error:', err);
        }
    };

    // Switch role for admin/su users
    const switchRole = async (role: UserRole) => {
        if (!user || !profile) return;
        if (profile.role !== 'admin' && profile.role !== 'su') {
            setError('Only admin or su users can switch roles');
            return;
        }

        const userRef = doc(db, 'users', user.uid);
        const update = role === profile.role ? { actingAs: null } : { actingAs: role };
        await setDoc(userRef, update, { merge: true });
        await refreshProfile();
    };

    // Set audience mode (casual or professional)
    const setAudienceMode = async (mode: AudienceMode) => {
        if (!user || !profile) return;

        // Optimistic update for instant UI feedback
        const previousMode = profile.audienceMode;
        setProfile({ ...profile, audienceMode: mode });

        try {
            const userRef = doc(db, 'users', user.uid);
            await setDoc(userRef, { audienceMode: mode }, { merge: true });
        } catch (err: any) {
            console.error('[Auth] Failed to set audience mode:', err);
            setError(err.message);
            // Revert optimistic update on failure
            setProfile({ ...profile, audienceMode: previousMode });
        }
    };

    // Auth and Data Listeners
    useEffect(() => {
        let unsubscribeProfile: (() => void) | null = null;
        let unsubscribeCredits: (() => void) | null = null;

        // Catch any silent errors from the Google Sign-in redirect bounce
        getRedirectResult(auth).then((result) => {
            if (result) {
                console.log('[Auth] Redirect result captured successfully.');
            }
        }).catch((err) => {
            console.error('[Auth] Silent Redirect Failure Caught:', err);
            setError(`Authentication failed: ${err.message}`);
        });

        const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
            setLoading(true);
            try {
                if (firebaseUser) {
                    setUser(firebaseUser);
                    console.log('[Auth] User logged in:', firebaseUser.uid);

                    // Ensure profile and credits exist
                    const initialProfile = await createOrUpdateProfile(firebaseUser);
                    await createOrUpdateCredits(firebaseUser.uid, initialProfile.subscription);

                    // Set up real-time listeners
                    const userRef = doc(db, 'users', firebaseUser.uid);
                    unsubscribeProfile = onSnapshot(userRef, (doc) => {
                        if (doc.exists()) {
                            const data = doc.data() as UserProfile;
                            setProfile({
                                ...data,
                                subscription: normalizeSubscription(data.subscription)
                            });
                        }
                    });

                    const creditsRef = doc(db, 'users', firebaseUser.uid, 'data', 'credits');
                    unsubscribeCredits = onSnapshot(creditsRef, (doc) => {
                        if (doc.exists()) {
                            const data = doc.data() as UserCredits;
                            setCredits(data);
                        }
                    });

                } else {
                    setUser(null);
                    setProfile(null);
                    setCredits(null);
                    if (unsubscribeProfile) unsubscribeProfile();
                    if (unsubscribeCredits) unsubscribeCredits();
                }
            } catch (err: any) {
                setError(err.message);
                console.error('Auth state error:', err);
            } finally {
                setLoading(false);
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribeProfile) unsubscribeProfile();
            if (unsubscribeCredits) unsubscribeCredits();
        };
    }, []);

    return (
        <AuthContext.Provider
            value={{
                user,
                profile,
                credits,
                loading,
                error,
                signInWithGoogle,
                signOut,
                refreshProfile,
                refreshCredits,
                switchRole,
                setAudienceMode,
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
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
