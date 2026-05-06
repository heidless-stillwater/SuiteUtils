import { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Filter,
  Search,
  TrendingUp,
  BarChart3,
  Calendar,
  RotateCcw,
  Loader2,
  X,
  ExternalLink,
  WifiOff,
  RefreshCw,
} from 'lucide-react';
import { useSuite } from '../contexts/SuiteContext';
import { subscribeToDeployHistory } from '../lib/deployment-service';
import { formatDuration } from '../lib/expert-system';
import type { DeploymentRecord } from '../lib/types';
import { API_URL } from '../lib/api-config';
import { parseDate } from '../lib/utils';

interface Release {
  releaseId: string;
  name?: string;
  versionName?: string;
  createTime?: string;
  status?: string;
  type?: string;
  fileCount?: number;
  versionBytes?: string;
  message?: string;
  duration?: number | null;
  deployUrl?: string | null;
  // enriched on client
  appId?: string;
  appName?: string;
  hostingTarget?: string | null;
}

interface RollbackState {
  active: boolean;
  stage: string;
  message: string;
  error?: string;
  url?: string;
  duration?: number;
}

export function DeployHistoryPage() {
  const { currentSuite } = useSuite();
  const [firestoreRecords, setFirestoreRecords] = useState<DeploymentRecord[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [filterApp, setFilterApp] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');

  // Rollback confirmation modal
  const [confirmRelease, setConfirmRelease] = useState<Release | null>(null);
  // Per-release rollback progress
  const [rollbackState, setRollbackState] = useState<Record<string, RollbackState>>({});

  // ── Firestore real-time subscription ─────────────────────
  useEffect(() => {
    if (!currentSuite) return;
    setLoading(true);
    setApiError(null);

    const unsub = subscribeToDeployHistory(
      currentSuite.id,
      (records) => {
        setFirestoreRecords(records);
        // Map to Release shape so the rest of the UI is unchanged
        const mapped: Release[] = records.map((r) => {
          const appConfig = currentSuite.apps[r.appId];
          return {
            releaseId: r.id,
            name: r.id,
            versionName: r.firebaseVersionId || undefined,
            createTime: r.startedAt
              ? parseDate(r.startedAt).toISOString()
              : undefined,
            status: r.status,
            type: r.status === 'live' ? 'DEPLOY' : r.status.toUpperCase(),
            fileCount: undefined,
            versionBytes: r.buildSize ? String(r.buildSize) : undefined,
            message: r.errorLogs || undefined,
            appId: r.appId,
            appName: r.displayName || appConfig?.displayName || r.appId,
            hostingTarget: appConfig?.environments?.production?.hostingTarget || null,
            duration: r.duration,
            deployUrl: r.deployUrl || null,
          };
        });
        setReleases(mapped);
        setLoading(false);
      },
      (err) => {
        setApiError(err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [currentSuite]);

  // ── Fallback: load from Hosting API if Firestore is empty ─
  const fetchReleases = useCallback(async () => {
    if (!currentSuite) return;
    if (firestoreRecords.length > 0) return; // Firestore has data, skip
    setLoading(true);
    setApiError(null);

    try {
      const apps = Object.entries(currentSuite.apps).filter(
        ([, app]) => app.environments.production?.hostingTarget
      );
      const results: Release[] = [];
      await Promise.allSettled(
        apps.map(async ([appId, app]) => {
          const target = app.environments.production.hostingTarget!;
          try {
            const res = await fetch(
              `${API_URL}/api/releases/${target}?project=${app.project || 'heidless-apps-2'}`
            );
            if (!res.ok) return;
            const data = await res.json();
            const enriched = (data.releases || []).map((r: Release) => ({
              ...r,
              appId,
              appName: app.displayName,
              hostingTarget: target,
            }));
            results.push(...enriched);
          } catch { /* skip */ }
        })
      );
      results.sort((a, b) => (b.createTime || '').localeCompare(a.createTime || ''));
      setReleases(results);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Failed to load releases');
    } finally {
      setLoading(false);
    }
  }, [currentSuite, firestoreRecords.length]);

  useEffect(() => {
    fetchReleases();
  }, [fetchReleases]);

  const startRollback = useCallback(async (release: Release) => {
    if (!release.versionName || !release.hostingTarget) return;
    setConfirmRelease(null);

    const key = release.releaseId;
    setRollbackState((prev) => ({
      ...prev,
      [key]: { active: true, stage: 'rolling-back', message: 'Starting rollback...' },
    }));

    try {
      const response = await fetch(`${API_URL}/api/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostingTarget: release.hostingTarget,
          versionName: release.versionName,
        }),
      });

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            setRollbackState((prev) => ({
              ...prev,
              [key]: {
                active: data.stage !== 'live' && data.stage !== 'failed',
                stage: data.stage,
                message: data.message || prev[key]?.message,
                error: data.error,
                url: data.url,
                duration: data.duration,
              },
            }));
          } catch {
            // skip
          }
        }
      }

      // Refresh releases after a short delay
      setTimeout(() => fetchReleases(), 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Rollback error';
      setRollbackState((prev) => ({
        ...prev,
        [key]: { active: false, stage: 'failed', message: msg, error: msg },
      }));
    }
  }, [fetchReleases]);

  const appNames = currentSuite ? Object.values(currentSuite.apps).map((a) => a.displayName) : [];

  const filtered = releases.filter((r) => {
    if (filterApp !== 'all' && r.appName !== filterApp) return false;
    if (filterStatus !== 'all' && r.type !== filterStatus) return false;
    if (search && !r.appName?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalDeploys = releases.length;
  const successCount = releases.filter((r) => r.type === 'DEPLOY').length;
  const successRate = totalDeploys > 0 ? Math.round((successCount / totalDeploys) * 100) : 0;

  function formatDate(iso?: string) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  function formatBytes(bytes?: string) {
    if (!bytes) return '—';
    const n = parseInt(bytes, 10);
    if (isNaN(n)) return '—';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  }

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white/90">Deploy History</h1>
          <p className="text-sm text-white/40 mt-1">
            Live release history from Firebase Hosting — click Rollback to restore any version
          </p>
        </div>
        <button
          onClick={fetchReleases}
          disabled={loading}
          className="btn-ghost text-xs flex items-center gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* API Error */}
      {apiError && (
        <div className="glass-card-static p-4 border border-amber-500/20 flex items-start gap-3">
          <WifiOff className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-white/80 font-medium">Could not load releases</p>
            <p className="text-xs text-white/40 mt-1 font-mono">{apiError}</p>
            <p className="text-xs text-white/30 mt-1">
              Make sure the API server is running:{' '}
              <code className="bg-white/10 px-1.5 py-0.5 rounded text-primary font-mono">npm run dev:api</code>
            </p>
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card-static p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="premium-label">Total Releases</p>
            <p className="text-2xl font-bold text-white/90">
              {loading ? <Loader2 className="w-5 h-5 animate-spin text-white/30" /> : totalDeploys}
            </p>
          </div>
        </div>
        <div className="glass-card-static p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-green-500/10 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <p className="premium-label">Success Rate</p>
            <p className="text-2xl font-bold text-green-400">
              {loading ? '—' : `${successRate}%`}
            </p>
          </div>
        </div>
        <div className="glass-card-static p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-cyan-500/10 flex items-center justify-center">
            <RotateCcw className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <p className="premium-label">Rollback Available</p>
            <p className="text-2xl font-bold text-white/90">
              {loading ? '—' : releases.filter((r) => r.versionName).length}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search apps..."
            className="input-cinematic !pl-10"
          />
        </div>
        <select
          value={filterApp}
          onChange={(e) => setFilterApp(e.target.value)}
          className="bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white/60 outline-none"
        >
          <option value="all">All Apps</option>
          {appNames.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white/60 outline-none"
        >
          <option value="all">All Types</option>
          <option value="DEPLOY">Deploy</option>
          <option value="ROLLBACK">Rollback</option>
        </select>
      </div>

      {/* History Table */}
      <div className="glass-card-static overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-white/30">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading release history...</span>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/20">App</th>
                <th className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/20">Type</th>
                <th className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/20">Release ID</th>
                <th className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/20">Duration</th>
                <th className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/20">Size</th>
                <th className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/20">Date</th>
                <th className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((release, idx) => {
                const rb = rollbackState[release.releaseId];
                const isRollingBack = rb?.active;
                const isDone = rb && !rb.active;
                const isFirst = idx === 0 || filtered[idx - 1]?.appId !== release.appId;
                const canRollback = !!release.versionName && release.type !== 'ROLLBACK';

                return (
                  <tr
                    key={`${release.appId}-${release.releaseId}`}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-5 py-3.5 text-sm font-semibold text-white/80">
                      <div className="flex items-center gap-2">
                        <a
                          href={`https://${release.hostingTarget}.web.app`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-primary transition-colors flex items-center gap-1.5 group"
                        >
                          {release.appName}
                          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                        </a>
                        {isFirst && idx === 0 && (
                          <span className="badge badge-success text-[9px]">Latest</span>
                        )}
                      </div>
                      <a
                        href={`https://${release.hostingTarget}.web.app`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-white/25 font-mono mt-0.5 hover:text-primary/60 transition-colors"
                      >
                        {release.hostingTarget}.web.app
                      </a>
                    </td>

                    <td className="px-5 py-3.5">
                      <span className={`badge ${release.type === 'ROLLBACK' ? 'badge-warning' : 'badge-success'} flex items-center gap-1 w-fit`}>
                        {release.type === 'ROLLBACK' ? (
                          <RotateCcw className="w-3 h-3" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3" />
                        )}
                        {release.type || 'DEPLOY'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <a
                        href={`https://${release.hostingTarget}.web.app`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs font-mono text-white/40 hover:text-primary transition-colors group"
                      >
                        {release.releaseId}
                        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    </td>
                    <td className="px-5 py-3.5 text-sm font-mono text-white/40">
                      {release.duration != null ? (
                        <div className="flex items-center gap-1.5" title={`${release.duration} seconds`}>
                          <Clock className="w-3.5 h-3.5" />
                          {formatDuration(release.duration)}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-sm font-mono text-white/40">
                      {formatBytes(release.versionBytes)}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-white/40">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(release.createTime)}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {/* Rollback progress */}
                      {isRollingBack && (
                        <div className="flex items-center gap-2 text-amber-400 text-xs">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>{rb.message}</span>
                        </div>
                      )}
                      {isDone && rb.stage === 'live' && (
                        <div className="flex items-center gap-2 text-green-400 text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Live in {rb.duration}s</span>
                          {rb.url && (
                            <a href={rb.url} target="_blank" rel="noopener noreferrer" className="underline">
                              View ↗
                            </a>
                          )}
                        </div>
                      )}
                      {isDone && rb.stage === 'failed' && (
                        <div className="flex items-center gap-2 text-red-400 text-xs">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Failed</span>
                        </div>
                      )}
                      {!rb && canRollback && (
                        <button
                          onClick={() => setConfirmRelease(release)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-cyan-400/10 text-white/40 hover:text-cyan-400 text-xs font-semibold transition-all"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Rollback
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-12 text-white/20">
            <Filter className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No releases found</p>
            <p className="text-xs mt-1 text-white/10">
              {releases.length === 0
                ? 'Deploy an app first, or check the API server is running'
                : 'Try adjusting your filters'}
            </p>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmRelease && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card-static p-6 max-w-md w-full space-y-4 border border-cyan-400/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-400/10 flex items-center justify-center">
                  <RotateCcw className="w-5 h-5 text-cyan-400" />
                </div>
                <h2 className="text-lg font-bold text-white/90">Confirm Rollback</h2>
              </div>
              <button
                onClick={() => setConfirmRelease(null)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/30 hover:text-white/60 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-black/30 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-white/40">App</span>
                <span className="text-white/80 font-semibold">{confirmRelease.appName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/40">Site</span>
                <span className="text-white/60 font-mono">{confirmRelease.hostingTarget}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/40">Release</span>
                <span className="text-white/60 font-mono">{confirmRelease.releaseId}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/40">Date</span>
                <span className="text-white/60">{formatDate(confirmRelease.createTime)}</span>
              </div>
            </div>

            <p className="text-sm text-white/50">
              This will instantly restore{' '}
              <span className="text-cyan-400 font-semibold">{confirmRelease.hostingTarget}.web.app</span>{' '}
              to this release. No rebuild required — takes ~2 seconds.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setConfirmRelease(null)}
                className="btn-ghost flex-1"
              >
                Cancel
              </button>
              <button
                onClick={() => startRollback(confirmRelease)}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Roll Back Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
