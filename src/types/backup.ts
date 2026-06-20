export interface BackupFile {
  id: string;
  name: string;
  fullPath: string;
  size?: string;
  modifiedTime?: string;
  createdTime?: string;
  timestamp?: number;
  type?: 'full' | 'database' | 'storage';
  scope?: string;
  apps?: string[];
  includeStorage?: boolean;
  checksum?: string;
  isLegacy?: boolean;
  status?: 'active' | 'archived';
  storageStatus?: 'success' | 'failed' | 'skipped';
  stats?: {
    totalSize: number;
    durationMs: number;
    fileCount?: number;
  };
  trigger?: {
    type: 'manual' | 'scheduled';
    user?: string;
  };
}

export interface BackupEvent {
  step: 'db' | 'storage' | 'zip' | 'cloud' | 'complete' | 'error' | 'info' | 'queued';
  message: string;
  appId?: string;
  percent?: number;
  metrics?: {
    totalSize: number;
    transferredSize: number;
    elapsed: number;
    eta: number;
    speed: number;
  };
}
