import { useState } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Filter,
  Search,
  TrendingUp,
  BarChart3,
  Calendar,
} from 'lucide-react';
import { formatDuration } from '../lib/expert-system';
import { useSuite } from '../contexts/SuiteContext';

// Demo data for history (Firestore integration in Phase 3+)
const DEMO_HISTORY = [
  { id: '1', app: 'PromptTool', status: 'live', duration: 98, method: 'firebase', date: '2026-04-28', env: 'production' },
  { id: '2', app: 'PromptMasterSPA', status: 'live', duration: 112, method: 'firebase', date: '2026-04-28', env: 'production' },
  { id: '3', app: 'PlanTune', status: 'failed', duration: 245, method: 'cloud-build', date: '2026-04-27', env: 'production' },
  { id: '4', app: 'PromptResources', status: 'live', duration: 87, method: 'firebase', date: '2026-04-27', env: 'production' },
  { id: '5', app: 'ag-video-system', status: 'live', duration: 105, method: 'firebase', date: '2026-04-26', env: 'production' },
  { id: '6', app: 'PromptAccreditation', status: 'live', duration: 94, method: 'firebase', date: '2026-04-26', env: 'production' },
  { id: '7', app: 'PlanTune', status: 'live', duration: 310, method: 'cloud-build', date: '2026-04-25', env: 'production' },
  { id: '8', app: 'PromptTool', status: 'live', duration: 101, method: 'firebase', date: '2026-04-24', env: 'production' },
];

export function DeployHistoryPage() {
  const [filterApp, setFilterApp] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');
  const { currentSuite } = useSuite();

  const apps = currentSuite ? Object.values(currentSuite.apps).map((a) => a.displayName) : [];

  const filtered = DEMO_HISTORY.filter((d) => {
    if (filterApp !== 'all' && d.app !== filterApp) return false;
    if (filterStatus !== 'all' && d.status !== filterStatus) return false;
    if (search && !d.app.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalDeploys = DEMO_HISTORY.length;
  const successRate = Math.round(
    (DEMO_HISTORY.filter((d) => d.status === 'live').length / totalDeploys) * 100
  );
  const avgDuration = Math.round(
    DEMO_HISTORY.filter((d) => d.status === 'live').reduce((s, d) => s + d.duration, 0) /
    DEMO_HISTORY.filter((d) => d.status === 'live').length
  );

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white/90">Deploy History</h1>
        <p className="text-sm text-white/40 mt-1">
          Track, analyze, and audit all deployment operations
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card-static p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="premium-label">Total Deploys</p>
            <p className="text-2xl font-bold text-white/90">{totalDeploys}</p>
          </div>
        </div>
        <div className="glass-card-static p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-green-500/10 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <p className="premium-label">Success Rate</p>
            <p className="text-2xl font-bold text-green-400">{successRate}%</p>
          </div>
        </div>
        <div className="glass-card-static p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-cyan-500/10 flex items-center justify-center">
            <Clock className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <p className="premium-label">Avg Duration</p>
            <p className="text-2xl font-bold text-white/90">{formatDuration(avgDuration)}</p>
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
          {apps.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white/60 outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="live">Success</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* History Table */}
      <div className="glass-card-static overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/20">App</th>
              <th className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/20">Status</th>
              <th className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/20">Duration</th>
              <th className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/20">Method</th>
              <th className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/20">Environment</th>
              <th className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/20">Date</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((deploy) => (
              <tr
                key={deploy.id}
                className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
              >
                <td className="px-5 py-3.5 text-sm font-semibold text-white/80">
                  {deploy.app}
                </td>
                <td className="px-5 py-3.5">
                  <span className={`badge ${deploy.status === 'live' ? 'badge-success' : 'badge-danger'}`}>
                    {deploy.status === 'live' ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : (
                      <AlertTriangle className="w-3 h-3" />
                    )}
                    {deploy.status === 'live' ? 'Success' : 'Failed'}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-sm font-mono text-white/60">
                  {formatDuration(deploy.duration)}
                </td>
                <td className="px-5 py-3.5">
                  <span className="badge badge-primary text-[9px]">{deploy.method}</span>
                </td>
                <td className="px-5 py-3.5">
                  <span className="badge badge-accent text-[9px]">{deploy.env}</span>
                </td>
                <td className="px-5 py-3.5 text-sm text-white/40 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {deploy.date}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-white/20">
            <Filter className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No deployments match your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
