import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { doc, setDoc, onSnapshot, Timestamp, collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';
import type { Suite, AppConfig, EnvironmentConfig } from '../lib/types';
import { STILLWATER_APPS } from '../lib/types';

interface SuiteContextType {
  currentSuite: Suite | null;
  suites: Suite[];
  loading: boolean;
  switchSuite: (suiteId: string) => void;
  createSuite: (name: string) => Promise<string>;
}

const SuiteContext = createContext<SuiteContextType | undefined>(undefined);

const SUITE_STORAGE_KEY = 'suiteutils-active-suite';

export function SuiteProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [suites, setSuites] = useState<Suite[]>([]);
  const [currentSuiteId, setCurrentSuiteId] = useState<string | null>(
    () => localStorage.getItem(SUITE_STORAGE_KEY)
  );
  const [loading, setLoading] = useState(true);

  const currentSuite = suites.find((s) => s.id === currentSuiteId) || suites[0] || null;

  // Load all suites for the current user
  useEffect(() => {
    if (!user) {
      setSuites([]);
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(collection(db, 'suites'), (snap) => {
      const loaded: Suite[] = [];
      snap.forEach((doc) => {
        const data = doc.data() as Omit<Suite, 'id'>;
        if (data.ownerId === user.uid) {
          loaded.push({ ...data, id: doc.id } as Suite);
        }
      });
      setSuites(loaded);

      // Auto-seed "Stillwater" suite if none exist
      if (loaded.length === 0) {
        seedDefaultSuite(user.uid);
      }

      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  // Persist suite selection
  useEffect(() => {
    if (currentSuite) {
      localStorage.setItem(SUITE_STORAGE_KEY, currentSuite.id);
    }
  }, [currentSuite]);

  const seedDefaultSuite = async (uid: string) => {
    const suiteRef = doc(collection(db, 'suites'));
    const apps: Record<string, AppConfig> = {};

    Object.entries(STILLWATER_APPS).forEach(([key, config]) => {
      const defaultEnv: EnvironmentConfig = {
        ...config.defaultEnv,
        lastDeployAt: null,
      };
      apps[key] = {
        displayName: config.displayName,
        path: config.path,
        database: config.database,
        environments: {
          production: defaultEnv,
          staging: {
            hostingTarget: null,
            deployMethod: config.defaultEnv.deployMethod,
            lastDeployAt: null,
            status: 'not-configured',
          },
          dev: {
            hostingTarget: null,
            deployMethod: config.defaultEnv.deployMethod,
            lastDeployAt: null,
            status: 'not-configured',
          },
        },
      };
    });

    const suite: Omit<Suite, 'id'> = {
      name: 'Stillwater',
      ownerId: uid,
      defaultThemeId: 'stillwater-midnight',
      themes: {},
      apps,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    await setDoc(suiteRef, suite);
    setCurrentSuiteId(suiteRef.id);
  };

  const switchSuite = useCallback((suiteId: string) => {
    setCurrentSuiteId(suiteId);
  }, []);

  const createSuite = useCallback(async (name: string): Promise<string> => {
    if (!user) throw new Error('Must be signed in');
    const suiteRef = doc(collection(db, 'suites'));
    const suite: Omit<Suite, 'id'> = {
      name,
      ownerId: user.uid,
      defaultThemeId: 'stillwater-midnight',
      themes: {},
      apps: {},
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    await setDoc(suiteRef, suite);
    return suiteRef.id;
  }, [user]);

  return (
    <SuiteContext.Provider
      value={{
        currentSuite,
        suites,
        loading,
        switchSuite,
        createSuite,
      }}
    >
      {children}
    </SuiteContext.Provider>
  );
}

export function useSuite() {
  const context = useContext(SuiteContext);
  if (!context) throw new Error('useSuite must be used within a SuiteProvider');
  return context;
}
