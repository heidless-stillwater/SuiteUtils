import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type { DeploymentRecord, DeployStatus } from './types';

const COLLECTION = 'deployments';

// ============================================================
// WRITE — Save a completed deploy record
// ============================================================

export interface SaveDeployOptions {
  suiteId: string;
  batchId: string;
  appId: string;
  displayName: string;
  environment: string;
  status: DeployStatus;
  startedAt: number; // epoch ms
  duration: number | null; // seconds
  deployMethod: string;
  hostingTarget: string | null;
  project: string;
  errorLogs: string | null;
  firebaseVersionId?: string | null;
  deployUrl?: string | null;
}

export async function saveDeployRecord(opts: SaveDeployOptions): Promise<string> {
  const record = {
    suiteId: opts.suiteId,
    batchId: opts.batchId,
    appId: opts.appId,
    displayName: opts.displayName,
    environment: opts.environment,
    status: opts.status,
    startedAt: Timestamp.fromMillis(opts.startedAt),
    completedAt: Timestamp.now(),
    duration: opts.duration,
    deployMethod: opts.deployMethod,
    hostingTarget: opts.hostingTarget,
    project: opts.project,
    errorLogs: opts.errorLogs,
    firebaseVersionId: opts.firebaseVersionId || null,
    cloudRunRevision: null,
    gitCommitSha: null,
    deployUrl: opts.deployUrl || null,
  };

  const ref = await addDoc(collection(db, COLLECTION), record);
  console.log(`[DeployService] Saved record: ${ref.id} (${opts.appId} → ${opts.status})`);
  return ref.id;
}

// ============================================================
// READ — Real-time listener for a suite's deploy history
// ============================================================

export function subscribeToDeployHistory(
  suiteId: string,
  onData: (records: DeploymentRecord[]) => void,
  onError?: (err: Error) => void,
  maxRecords = 50
): Unsubscribe {
  const q = query(
    collection(db, COLLECTION),
    where('suiteId', '==', suiteId),
    orderBy('startedAt', 'desc'),
    limit(maxRecords)
  );

  return onSnapshot(
    q,
    (snap) => {
      const records: DeploymentRecord[] = snap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<DeploymentRecord, 'id'>),
      }));
      onData(records);
    },
    (err) => {
      console.error('[DeployService] Snapshot error:', err.message);
      onError?.(err);
    }
  );
}

// ============================================================
// READ — One-shot fetch for expert system training data
// ============================================================

export async function fetchDeployHistory(
  suiteId: string,
  maxRecords = 100
): Promise<DeploymentRecord[]> {
  const q = query(
    collection(db, COLLECTION),
    where('suiteId', '==', suiteId),
    where('status', '==', 'live'),
    orderBy('startedAt', 'desc'),
    limit(maxRecords)
  );

  const snap = await getDocs(q);
  return snap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<DeploymentRecord, 'id'>),
  }));
}
