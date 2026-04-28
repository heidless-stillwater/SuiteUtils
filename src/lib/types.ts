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
export type AppStatus = 'live' | 'deploying' | 'failed' | 'not-configured';

export interface EnvironmentConfig {
  hostingTarget: string | null;
  deployMethod: DeployMethod;
  lastDeployAt: Timestamp | null;
  status: AppStatus;
}

export interface AppConfig {
  displayName: string;
  path: string;
  database: string;
  project: string;
  environments: Record<EnvironmentTag, EnvironmentConfig>;
}

export interface Suite {
  id: string;
  name: string;
  ownerId: string;
  defaultThemeId: string | null;
  themes: Record<string, Theme>;
  apps: Record<string, AppConfig>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================
// DEPLOYMENT TYPES
// ============================================================

export type DeployStatus = 'queued' | 'building' | 'deploying' | 'live' | 'failed' | 'paused' | 'stopped';

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
    displayName: 'ag-video-system',
    path: '~/projects/ag-video-system',
    database: 'autovideo-db-0',
    project: 'heidless-apps-0',
    defaultEnv: { hostingTarget: 'videosystem-v0', deployMethod: 'firebase', status: 'live' },
  },
  'prompttool': {
    displayName: 'PromptTool',
    path: '~/projects/PromptTool',
    database: 'prompttool-db-0',
    project: 'heidless-apps-0',
    defaultEnv: { hostingTarget: 'prompttool-v0', deployMethod: 'firebase', status: 'live' },
  },
  'promptresources': {
    displayName: 'PromptResources',
    path: '~/projects/PromptResources',
    database: 'promptresources-db-0',
    project: 'heidless-apps-0',
    defaultEnv: { hostingTarget: 'promptresources-v0', deployMethod: 'firebase', status: 'live' },
  },
  'promptmasterspa': {
    displayName: 'PromptMasterSPA',
    path: '~/projects/PromptMasterSPA',
    database: 'promptmaster-db-0',
    project: 'heidless-apps-0',
    defaultEnv: { hostingTarget: 'promptmaster-v0', deployMethod: 'firebase', status: 'live' },
  },
  'promptaccreditation': {
    displayName: 'PromptAccreditation',
    path: '~/projects/PromptAccreditation',
    database: 'promptaccreditation-db-0',
    project: 'heidless-apps-0',
    defaultEnv: { hostingTarget: 'promptaccreditation-v0', deployMethod: 'firebase', status: 'live' },
  },
  'plantune': {
    displayName: 'PlanTune',
    path: '~/projects/PlanTune',
    database: 'plantune-db-0',
    project: 'heidless-apps-0',
    defaultEnv: { hostingTarget: null, deployMethod: 'cloud-build', status: 'live' },
  },
  'suiteutils': {
    displayName: 'SuiteUtils',
    path: '~/projects/SuiteUtils',
    database: 'suiteutils-db-0',
    project: 'heidless-apps-0',
    defaultEnv: { hostingTarget: 'suiteutils-v0', deployMethod: 'firebase', status: 'not-configured' },
  },
};
