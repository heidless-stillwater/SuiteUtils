import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { doc, setDoc, onSnapshot, Timestamp, collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { useWorkspace } from './WorkspaceContext';
import type { Suite, AppConfig, EnvironmentConfig } from '../lib/types';
import { STILLWATER_APPS, ADMIN_EMAILS } from '../lib/types';
import { API_URL } from '../lib/api-config';
import { sanitize } from '../lib/utils';

interface SuiteContextType {
  currentSuite: Suite | null;
  suites: Suite[];
  loading: boolean;
  dbError: string | null;
  switchSuite: (suiteId: string) => void;
  createSuite: (name: string) => Promise<string>;
  updateAppStatus: (suiteId: string, appId: string, env: string, status: string) => Promise<void>;
  activeJobCount: number;
}

const SuiteContext = createContext<SuiteContextType | undefined>(undefined);

export function SuiteProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, setWorkspaceRole } = useAuth();
  const { activeWorkspaceId } = useWorkspace();
  const [suites, setSuites] = useState<Suite[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [activeJobCount, setActiveJobCount] = useState(0);

  const currentSuite = suites.find((s) => s.id === activeWorkspaceId) || suites[0] || null;

  // Load all suites for the current user
  useEffect(() => {
    if (!user || !profile) {
      setSuites([]);
      setLoading(false);
      return;
    }

    let unsub: (() => void) | null = null;
    let retryTimeout: any = null;
    let isActive = true;

    const subscribe = (attempt = 1) => {
      if (!isActive) return;

      unsub = onSnapshot(
        collection(db, 'suites'),
        (snap) => {
          console.log(`[SuiteContext] Received snapshot with ${snap.size} suites`);
          const loaded: Suite[] = [];
          snap.forEach((docSnap) => {
            try {
              const data = docSnap.data() as Omit<Suite, 'id'>;
              console.log(`[SuiteContext] Loading suite: ${data.name} (Owner: ${data.ownerId})`);
              const isAdmin = ADMIN_EMAILS.includes(user.email || '');
              if (data.ownerId === user.uid || (docSnap.id === 'stillwater-suite' && isAdmin)) {
                // Self-healing: Migrate legacy infrastructure to heidless-apps-2
                let needsSync = false;
                if (data.apps) {
                  Object.entries(STILLWATER_APPS).forEach(([appId, config]) => {
                    // 1. Migrate/fix existing apps
                    const app = data.apps[appId];
                    if (app) {
                      // Fix status for suiteutils if needed
                      if (appId === 'suiteutils' && app.environments?.production && app.environments.production.status !== 'live') {
                        app.environments.production.status = 'live';
                        needsSync = true;
                      }
                      // Migrate hosting targets and deploy methods
                      if (app.environments?.production) {
                        const currentHosting = app.environments.production.hostingTarget;
                        const targetHosting = config.defaultEnv.hostingTarget;
                        const currentMethod = app.environments.production.deployMethod;
                        const targetMethod = config.defaultEnv.deployMethod;

                        if (currentHosting !== targetHosting || currentMethod !== targetMethod) {
                          app.environments.production.hostingTarget = targetHosting;
                          app.environments.production.deployMethod = targetMethod;
                          needsSync = true;
                        }
                      }
                      // Ensure project is set and updated to sovereign GCP project
                      if (!app.project || app.project === 'heidless-apps-0' || app.project === 'heidless-apps-2' || app.project === 'stillwater-sovereign-01') {
                        app.project = 'stillwater-sovereign-02';
                        needsSync = true;
                      }
                      // Ensure path is synced with the static registry (case casing self-healing)
                      if (app.path !== config.path) {
                        console.log(`[SuiteContext] Self-healing path casing for ${appId}: ${app.path} -> ${config.path}`);
                        app.path = config.path;
                        needsSync = true;
                      }
                    }
                  });

                  // 2. Add missing apps from registry
                  Object.entries(STILLWATER_APPS).forEach(([appId, config]) => {
                    if (!data.apps[appId]) {
                      console.log(`[SuiteContext] Found missing app in registry: ${appId}. Adding...`);
                      data.apps[appId] = {
                        displayName: config.displayName,
                        path: config.path,
                        database: config.database,
                        project: config.project || 'stillwater-sovereign-02',
                        environments: {
                          production: { ...config.defaultEnv, lastDeployAt: null },
                          staging: { hostingTarget: null, deployMethod: config.defaultEnv.deployMethod, lastDeployAt: null, status: 'not-configured' },
                          dev: { hostingTarget: null, deployMethod: config.defaultEnv.deployMethod, lastDeployAt: null, status: 'not-configured' },
                        },
                      };
                      needsSync = true;
                    }
                  });
                }

                if (needsSync) {
                  console.log(`[SuiteContext] Syncing updated config for suite: ${data.name}`);
                  setDoc(docSnap.ref, { apps: data.apps }, { merge: true }).catch((err: any) => {
                    console.error('[SuiteContext] Failed to sync config:', err.message);
                  });
                }

                loaded.push(sanitize({ ...data, id: docSnap.id } as Suite));
              }
            } catch (err: any) {
              console.error('[SuiteContext] Error parsing suite document:', docSnap.id, err.message);
            }
          });
          
          console.log(`[SuiteContext] Found ${loaded.length} suites for user ${user.uid}`);
          setSuites(loaded);

          // Auto-seed "Stillwater" suite if none exist
          if (loaded.length === 0) {
            console.log('[SuiteContext] No suites found, seeding default Stillwater suite...');
            seedDefaultSuite(user.uid);
          }

          setLoading(false);
          setDbError(null);
        },
        (error) => {
          console.warn(`[SuiteContext] Subscription attempt ${attempt} failed:`, error.message);
          
          // Retry on permission error if it might be an auth race condition
          if (error.code === 'permission-denied' && attempt < 3) {
            retryTimeout = setTimeout(() => {
              console.log(`[SuiteContext] Retrying subscription (attempt ${attempt + 1})...`);
              subscribe(attempt + 1);
            }, 1000);
          } else {
            console.error('[SuiteContext] Firestore listener error:', error);
            setDbError(error.message);
            setLoading(false);
          }
        }
      );
    };

    subscribe();

    return () => {
      isActive = false;
      if (unsub) unsub();
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [user, profile]);

  // Update role in AuthContext (Prioritize SaaS Invitation over Firestore Ownership)
  useEffect(() => {
    if (currentSuite) {
      // Update role in AuthContext (Prioritize SaaS Invitation over Firestore Ownership)
      if (user) {
        fetch(`${API_URL}/api/workspaces/${currentSuite.id}/my-role?email=${user.email}`)
          .then(res => res.json())
          .then(data => {
            if (data.role) {
              setWorkspaceRole(data.role);
            } else if (currentSuite.ownerId === user.uid) {
              setWorkspaceRole('admin');
            } else {
              setWorkspaceRole('viewer');
            }
          })
          .catch(() => {
            if (currentSuite.ownerId === user.uid) setWorkspaceRole('admin');
            else setWorkspaceRole('viewer');
          });
      }
    } else {
      setWorkspaceRole(null);
    }
  }, [currentSuite, user, setWorkspaceRole]);

  // Poll for active deployments to show in sidebar
  useEffect(() => {
    const fetchActiveJobs = async () => {
      try {
        const res = await fetch(`${API_URL}/api/deploy/active`);
        if (res.ok) {
          const jobs = await res.json() as any[];
          const running = jobs.filter(j => j.status === 'building' || j.status === 'deploying' || j.status === 'verifying');
          setActiveJobCount(running.length);
        }
      } catch (err) {
        // Silently fail polling
      }
    };

    fetchActiveJobs();
    const interval = setInterval(fetchActiveJobs, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, []);

  const seedDefaultSuite = async (uid: string) => {
    const suiteRef = doc(db, 'suites', 'stillwater-suite');
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
        project: config.project || 'stillwater-sovereign-02',
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

    try {
      await setDoc(suiteRef, suite);
      console.log('[SuiteContext] Default suite seeded successfully:', suiteRef.id);
    } catch (err) {
      console.error('[SuiteContext] Failed to seed default suite:', err);
    }
  };

  const switchSuite = useCallback((suiteId: string) => {
    // Legacy - WorkspaceContext now handles switching via setActiveWorkspaceId
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

  const updateAppStatus = useCallback(async (suiteId: string, appId: string, env: string, status: string, deployUrl?: string) => {
    const suiteRef = doc(db, 'suites', suiteId);
    const updateData: any = {
      [`apps.${appId}.environments.${env}.status`]: status
    };
    if (deployUrl) {
      updateData[`apps.${appId}.environments.${env}.deployUrl`] = deployUrl;
    }
    await setDoc(suiteRef, updateData, { merge: true });
  }, []);

  return (
    <SuiteContext.Provider
      value={{
        currentSuite,
        suites,
        loading,
        dbError,
        switchSuite,
        createSuite,
        updateAppStatus,
        activeJobCount,
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
