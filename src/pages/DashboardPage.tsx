import {
  Activity,
  Rocket,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Server,
  ArrowRight,
} from 'lucide-react';
import { useSuite } from '../contexts/SuiteContext';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

export function DashboardPage() {
  const { currentSuite } = useSuite();
  const { profile } = useAuth();

  const apps = currentSuite ? Object.entries(currentSuite.apps) : [];
  const liveApps = apps.filter(([_, a]) => a.environments.production?.status === 'live');
  const failedApps = apps.filter(([_, a]) => a.environments.production?.status === 'failed');

  return (
    <div className="page-enter space-y-8">
      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-bold text-white/90 mb-1">
          Welcome back, {profile?.displayName?.split(' ')[0] || 'Commander'}
        </h1>
        <p className="text-white/40 text-sm">
          {currentSuite?.name || 'Stillwater'} Operations Overview
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Server className="w-5 h-5" />}
          label="Total Apps"
          value={apps.length}
          accent="primary"
        />
        <StatCard
          icon={<CheckCircle2 className="w-5 h-5" />}
          label="Live"
          value={liveApps.length}
          accent="success"
        />
        <StatCard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="Issues"
          value={failedApps.length}
          accent={failedApps.length > 0 ? 'danger' : 'success'}
        />
        <StatCard
          icon={<Clock className="w-5 h-5" />}
          label="Last Deploy"
          value="—"
          accent="info"
          isText
        />
      </div>

      {/* App Registry Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white/80">App Registry</h2>
          <Link
            to="/deploy"
            className="btn-primary text-xs !px-4 !py-2"
          >
            <Rocket className="w-3.5 h-3.5" />
            Deploy
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {apps.map(([id, app]) => {
            const prodEnv = app.environments.production;
            const status = prodEnv?.status || 'not-configured';

            return (
              <div
                key={id}
                className="glass-card p-5 group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white/90 group-hover:text-primary transition-colors">
                      {app.displayName}
                    </h3>
                    <p className="text-[11px] text-white/30 mt-0.5 font-mono">
                      {app.database}
                    </p>
                  </div>
                  <StatusBadge status={status} />
                </div>

                <div className="space-y-2 text-xs text-white/40">
                  <div className="flex items-center justify-between">
                    <span>Method</span>
                    <span className="font-mono text-white/60">
                      {prodEnv?.deployMethod || '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Target</span>
                    <span className="font-mono text-white/60">
                      {prodEnv?.hostingTarget || 'Cloud Run'}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/5">
                  <Link
                    to="/deploy"
                    className="flex items-center gap-1.5 text-[11px] text-white/25 hover:text-primary transition-colors font-medium"
                  >
                    Deploy now
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-bold text-white/80 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link to="/deploy" className="glass-card p-5 flex items-center gap-4 group">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Rocket className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white/80">Deploy All</p>
              <p className="text-xs text-white/30">Batch deploy suite apps</p>
            </div>
          </Link>

          <Link to="/themes" className="glass-card p-5 flex items-center gap-4 group">
            <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
              <Activity className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white/80">Theme Studio</p>
              <p className="text-xs text-white/30">Edit design tokens</p>
            </div>
          </Link>

          <Link to="/history" className="glass-card p-5 flex items-center gap-4 group">
            <div className="w-11 h-11 rounded-xl bg-cyan-500/10 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors">
              <Clock className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white/80">Deploy History</p>
              <p className="text-xs text-white/30">View past deployments</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

// --- Sub-components ---

function StatCard({
  icon,
  label,
  value,
  accent,
  isText,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  accent: string;
  isText?: boolean;
}) {
  const colorMap: Record<string, string> = {
    primary: 'text-primary bg-primary/10',
    success: 'text-green-400 bg-green-400/10',
    danger: 'text-red-400 bg-red-400/10',
    warning: 'text-amber-400 bg-amber-400/10',
    info: 'text-cyan-400 bg-cyan-400/10',
  };

  return (
    <div className="glass-card-static p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${colorMap[accent]}`}>
          {icon}
        </div>
        <span className="premium-label">{label}</span>
      </div>
      <p className={`font-bold ${isText ? 'text-lg text-white/60' : 'text-3xl text-white/90'}`}>
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    live: 'badge-success',
    deploying: 'badge-warning',
    failed: 'badge-danger',
    'not-configured': 'badge-info',
  };

  return (
    <span className={`badge ${styles[status] || 'badge-info'}`}>
      <span className={`status-dot ${
        status === 'live' ? 'status-dot-live' :
        status === 'deploying' ? 'status-dot-deploying' :
        status === 'failed' ? 'status-dot-failed' :
        'status-dot-queued'
      }`} />
      {status}
    </span>
  );
}
