import { Timestamp } from 'firebase/firestore';

// ============================================================
// ROLE & AUTH TYPES
// ============================================================

export type UserRole = 'su' | 'admin' | 'member';
export type SubscriptionTier = 'free' | 'pro' | 'enterprise';
export type AudienceMode = 'casual' | 'professional';

export const ADMIN_EMAILS: string[] = (
  import.meta.env.VITE_ADMIN_EMAILS || 'lockhart.r@gmail.com'
).split(',').map((e: string) => e.trim());

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  actingAs?: UserRole;
  subscription: SubscriptionTier;
  themeOverrideId: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================
// SUITE & APP TYPES
// ============================================================

export type DeployMethod = 'firebase' | 'cloud-build';
export type EnvironmentTag = 'production' | 'staging' | 'dev';
export type AppStatus = 'live' | 'deploying' | 'verifying' | 'failed' | 'not-configured' | 'stopped';

export interface EnvironmentConfig {
  hostingTarget: string | null;
  deployMethod: DeployMethod;
  lastDeployAt: Timestamp | null;
  status: AppStatus;
  deployUrl?: string | null;
}

export interface AppConfig {
  displayName: string;
  path: string;
  database: string;
  project?: string;
  environments: Record<EnvironmentTag, EnvironmentConfig>;
  health?: {
    status: 'healthy' | 'unhealthy' | 'degraded' | 'Unknown';
    lastChecked: string;
    responseTime: number;
    appVersion: string;
  };
}

export interface Suite {
  id: string;
  name: string;
  ownerId: string;
  ownerEmail?: string;
  gcpProjectId?: string;
  defaultThemeId: string | null;
  themes: Record<string, Theme>;
  apps: Record<string, AppConfig>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================
// DEPLOYMENT TYPES
// ============================================================

export type DeployStatus = 'queued' | 'building' | 'deploying' | 'verifying' | 'live' | 'failed' | 'paused' | 'stopped';

export interface DeploymentRecord {
  id: string;
  suiteId: string;
  batchId: string;
  appId: string;
  displayName: string;         // human-readable app name stored at write time
  environment: EnvironmentTag;
  status: DeployStatus;
  startedAt: Timestamp;
  completedAt: Timestamp | null;
  duration: number | null;
  buildSize: number | null;
  errorLogs: string | null;
  deployMethod: DeployMethod;
  deployUrl: string | null;    // live URL captured from SSE response
  // Rollback metadata
  firebaseVersionId: string | null;
  cloudRunRevision: string | null;
  gitCommitSha: string | null;
  logs?: string[];
}

export interface DeployBatch {
  id: string;
  suiteId: string;
  apps: string[];
  status: 'running' | 'completed' | 'failed' | 'paused';
  startedAt: Timestamp;
  completedAt: Timestamp | null;
  successCount: number;
  failureCount: number;
}

// ============================================================
// EXPERT SYSTEM TYPES
// ============================================================

export interface DeployEstimate {
  appId: string;
  estimatedDuration: number; // seconds
  confidence: number; // 0-1
  sampleSize: number;
  reasoning: string;
}

// ============================================================
// THEME TYPES
// ============================================================

export interface ThemeToken {
  key: string;
  value: string;
  category: 'color' | 'gradient' | 'typography' | 'spacing' | 'shadow' | 'radius' | 'kinetic' | 'glass';
  label: string;
}

export interface Theme {
  id: string;
  name: string;
  tokens: Record<string, string>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================
// STILLWATER DEFAULT REGISTRY
// ============================================================

export const STILLWATER_APPS: Record<string, Omit<AppConfig, 'environments'> & { defaultEnv: Omit<EnvironmentConfig, 'lastDeployAt'> }> = {
  'ag-video-system': {
    displayName: 'Video System v1.0',
    path: '~/projects/ag-video-system',
    database: 'autovideo-db-0',
    defaultEnv: { 
      hostingTarget: 'stillwater-video-system', 
      deployMethod: 'cloud-build', 
      status: 'live',
      deployUrl: 'https://stillwater-video-system-02.web.app'
    },
  },
  'prompttool': {
    displayName: 'PromptTool v1.0',
    path: '~/projects/PromptTool',
    database: 'prompttool-db-0',
    defaultEnv: { hostingTarget: 'stillwater-prompt-tool', deployMethod: 'firebase', status: 'live' },
  },
  'promptresources': {
    displayName: 'PromptResources v1.0',
    path: '~/projects/PromptResources',
    database: 'promptresources-db-0',
    defaultEnv: { hostingTarget: 'stillwater-prompt-resources', deployMethod: 'firebase', status: 'live' },
  },
  'promptmasterspa': {
    displayName: 'PromptMaster v1.1',
    path: '~/projects/PromptMasterSPA',
    database: 'promptmaster-spa-db-0',
    defaultEnv: { 
      hostingTarget: 'stillwater-prompt-master', 
      deployMethod: 'firebase', 
      status: 'live',
      deployUrl: 'https://stillwater-prompt-master-02.web.app'
    },
  },
  'promptaccreditation': {
    displayName: 'PromptAccreditation v1.0',
    path: '~/projects/PromptAccreditation',
    database: 'promptaccreditation-db-0',
    defaultEnv: { 
      hostingTarget: 'stillwater-prompt-accreditation', 
      deployMethod: 'cloud-build', 
      status: 'live',
      deployUrl: 'https://stillwater-prompt-accreditation-02.web.app'
    },
  },
  'plantune': {
    displayName: 'PlanTune v1.0',
    path: '~/projects/PlanTune',
    database: 'plantune-db-0',
    defaultEnv: { 
      hostingTarget: 'stillwater-plan-tune', 
      deployMethod: 'cloud-build', 
      status: 'live',
      deployUrl: 'https://stillwater-plan-tune-02.web.app'
    },
  },
  'suiteutils': {
    displayName: 'SuiteUtils v1.0',
    path: '~/projects/SuiteUtils',
    database: 'suiteutils-db-0',
    project: 'stillwater-sovereign-01',
    defaultEnv: { hostingTarget: 'suite-utils', deployMethod: 'firebase', status: 'live' },
  },
  'persona': {
    displayName: 'persona v1.0',
    path: '~/projects/Persona',
    database: 'persona-db-0',
    project: 'stillwater-sovereign-01',
    defaultEnv: { 
      hostingTarget: 'stillwater-persona', 
      deployMethod: 'cloud-build', 
      status: 'live',
      deployUrl: 'https://stillwater-persona-02.web.app'
    },
  },
  'urlshortener': {
    displayName: 'URLShortener v1.0',
    path: '~/projects/URLShortener',
    database: 'urlshortener-db-0',
    defaultEnv: { 
      hostingTarget: 'stillwater-url-shortener', 
      deployMethod: 'cloud-build', 
      status: 'live',
      deployUrl: 'https://stillwater-url-shortener-02.web.app'
    },
  },
  'tokenmarket': {
    displayName: 'TokenMarket v1.0',
    path: '~/projects/TokenMarket',
    database: 'tokenmarket-db-0',
    project: 'stillwater-sovereign-01',
    defaultEnv: { 
      hostingTarget: 'stillwater-token-market', 
      deployMethod: 'firebase', 
      status: 'live',
      deployUrl: 'https://stillwater-token-market-02.web.app'
    },
  },
};

// ============================================================
// SHARED SESSION TYPES
// ============================================================

/** The three planning files that constitute a session snapshot */
export interface SessionFiles {
  task_plan: string;   // contents of task_plan.md
  progress: string;    // contents of progress.md
  findings: string;    // contents of findings.md
}

/** A single immutable version entry in the session history array */
export interface SessionVersion {
  version: number;
  updatedAt: Timestamp;
  updatedBy: {
    uid: string;
    displayName: string;
  };
  files: SessionFiles;
}

/**
 * Top-level Firestore document.
 * Path: sessions/{userId}/{projectSlug}/{sessionId}
 */
export interface SharedSession {
  sessionId: string;       // planning-with-files plan ID (e.g. "2026-05-25-suiteutils-...")
  projectSlug: string;     // e.g. "suiteutils", "prompttool"
  userId: string;          // owner UID
  displayName: string;     // owner display name at time of last push
  updatedAt: Timestamp;    // timestamp of latest push
  files: SessionFiles;     // latest snapshot of all three planning files
  history: SessionVersion[]; // append-only version log
}

/** A lightweight list-row version of SharedSession (no history array) */
export type SharedSessionSummary = Omit<SharedSession, 'history'> & {
  historyCount: number;
};

/** Filter options for listing sessions */
export type SessionScope = 'mine' | 'all' | 'project';

