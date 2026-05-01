import { useState, useEffect } from 'react';
import { User, Mail, Shield, LogOut, Crown, Bell, MessageSquare, Save, Loader2, HardDrive, Database, Cloud } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const API_URL = 'http://localhost:5181';

export function SettingsPage() {
  const { profile, user, signOut, isSu, effectiveRole, switchRole } = useAuth();
  const [slackWebhook, setSlackWebhook] = useState('');
  const [discordWebhook, setDiscordWebhook] = useState('');
  const [strictMode, setStrictMode] = useState(false);
  const [activeStorageProvider, setActiveStorageProvider] = useState<'gcs' | 'google-drive'>('google-drive');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Fetch notifications
    fetch(`${API_URL}/api/notifications`)
      .then(res => res.json())
      .then(data => {
        setSlackWebhook(data.slackWebhook || '');
        setDiscordWebhook(data.discordWebhook || '');
      });

    // Fetch global settings
    fetch(`${API_URL}/api/settings`)
      .then(res => res.json())
      .then(data => {
        setStrictMode(data.strictMode || false);
        setActiveStorageProvider(data.activeStorageProvider || 'google-drive');
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        fetch(`${API_URL}/api/notifications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slackWebhook, discordWebhook })
        }),
        fetch(`${API_URL}/api/settings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ strictMode, activeStorageProvider })
        })
      ]);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  };

  if (!profile || !user) return null;

  return (
    <div className="page-enter space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white/90">Account Settings</h1>
        <p className="text-sm text-white/40 mt-1">Manage your profile and preferences</p>
      </div>

      <div className="glass-card-static p-6">
        <div className="flex items-start gap-5">
          {profile.photoURL ? (
            <img src={profile.photoURL} alt="" className="w-20 h-20 rounded-2xl border-2 border-white/10 shadow-lg" />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-primary/20 flex items-center justify-center text-primary text-2xl font-bold">
              {(profile.displayName || profile.email)?.[0]?.toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white/90">{profile.displayName || 'User'}</h2>
            <p className="text-sm text-white/40 mt-1">{profile.email}</p>
            <div className="flex items-center gap-2 mt-3">
              <span className="badge badge-primary"><Shield className="w-3 h-3" />{profile.role}</span>
              {effectiveRole !== profile.role && (
                <span className="badge badge-warning">Acting as: {effectiveRole}</span>
              )}
              <span className="badge badge-accent">{profile.subscription}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card-static p-6 space-y-4">
        <p className="premium-label mb-2">Account Details</p>
        <DetailRow icon={<User className="w-4 h-4 text-white/30" />} label="Display Name" value={profile.displayName || '—'} />
        <DetailRow icon={<Mail className="w-4 h-4 text-white/30" />} label="Email" value={profile.email} />
        <DetailRow icon={<Shield className="w-4 h-4 text-white/30" />} label="Role" value={profile.role} />
        <DetailRow icon={<Crown className="w-4 h-4 text-white/30" />} label="Subscription" value={profile.subscription} last />
      </div>

      {isSu && (
        <div className="glass-card-static p-6">
          <p className="premium-label mb-4">Role Switching (SU Only)</p>
          <div className="flex gap-2">
            {(['su', 'admin', 'member'] as const).map((role) => (
              <button key={role} onClick={() => switchRole(role)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  effectiveRole === role
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'bg-white/5 text-white/40 border border-white/5 hover:bg-white/10'
                }`}
              >{role.toUpperCase()}</button>
            ))}
          </div>
        </div>
      )}

      <div className="glass-card-static p-6 space-y-6 border-orange-500/10">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-orange-400" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-white/90">Safety Guardrails</h3>
        </div>

        <div className="flex items-center justify-between p-4 bg-orange-500/5 rounded-2xl border border-orange-500/10 group hover:border-orange-500/30 transition-all">
          <div className="flex-1 pr-8">
            <h4 className="text-sm font-bold text-white/90">Strict Mode (Health Check)</h4>
            <p className="text-[11px] text-white/40 mt-1 leading-relaxed">
              When enabled, deployments will be <span className="text-orange-400 font-bold uppercase">automatically blocked</span> if the target application health check returns <span className="text-red-400">DOWN</span>.
            </p>
          </div>
          <button 
            onClick={() => setStrictMode(!strictMode)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              strictMode ? 'bg-orange-500' : 'bg-white/10'
            }`}
          >
            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              strictMode ? 'translate-x-5' : 'translate-x-0'
            }`} />
          </button>
        </div>
      </div>
 
      <div className="glass-card-static p-6 space-y-6">
        <div className="flex items-center gap-3">
          <HardDrive className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-white/90">Storage Infrastructure</h3>
        </div>

        <p className="text-[11px] text-white/30 leading-relaxed">
          Select the primary storage backend for backups and migration archives.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => setActiveStorageProvider('google-drive')}
            className={`p-4 rounded-2xl border transition-all text-left group ${
              activeStorageProvider === 'google-drive' 
                ? 'bg-indigo-500/10 border-indigo-500/50' 
                : 'bg-white/5 border-white/10 hover:bg-white/10'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-indigo-500/20 rounded-lg group-hover:scale-110 transition-transform">
                <Cloud className="w-4 h-4 text-indigo-400" />
              </div>
              {activeStorageProvider === 'google-drive' && <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />}
            </div>
            <h4 className="text-sm font-bold text-white/90">Google Drive</h4>
            <p className="text-[10px] text-white/40 mt-1">Recommended for general suite backups.</p>
          </button>

          <button 
            onClick={() => setActiveStorageProvider('gcs')}
            className={`p-4 rounded-2xl border transition-all text-left group ${
              activeStorageProvider === 'gcs' 
                ? 'bg-amber-500/10 border-amber-500/50' 
                : 'bg-white/5 border-white/10 hover:bg-white/10'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-amber-500/20 rounded-lg group-hover:scale-110 transition-transform">
                <Database className="w-4 h-4 text-amber-400" />
              </div>
              {activeStorageProvider === 'gcs' && <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />}
            </div>
            <h4 className="text-sm font-bold text-white/90">Google Cloud Storage</h4>
            <p className="text-[10px] text-white/40 mt-1">Enterprise-tier resilience and high availability.</p>
          </button>
        </div>
      </div>

      <div className="glass-card-static p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Bell className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-white/90">Infrastructure Notifications</h3>
        </div>
        
        <p className="text-[11px] text-white/30 leading-relaxed">
          Receive real-time alerts on Slack or Discord for backup completions, deployment failures, and system events.
        </p>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-white/30 font-bold ml-1">Slack Webhook URL</label>
            <div className="relative">
              <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/10" />
              <input 
                type="password" 
                value={slackWebhook}
                onChange={(e) => setSlackWebhook(e.target.value)}
                placeholder="https://hooks.slack.com/services/..."
                className="w-full bg-black/40 border-white/10 rounded-xl text-xs text-white py-3 pl-10 pr-4 focus:ring-primary/40"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-white/30 font-bold ml-1">Discord Webhook URL</label>
            <div className="relative">
              <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/10" />
              <input 
                type="password" 
                value={discordWebhook}
                onChange={(e) => setDiscordWebhook(e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
                className="w-full bg-black/40 border-white/10 rounded-xl text-xs text-white py-3 pl-10 pr-4 focus:ring-primary/40"
              />
            </div>
          </div>

          <button 
            onClick={handleSave}
            disabled={saving}
            className="w-full btn-primary py-3 gap-2 mt-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving Config...' : 'Save Notification Settings'}
          </button>
        </div>
      </div>

      <button onClick={signOut} className="btn-danger w-full">
        <LogOut className="w-4 h-4" />Sign Out
      </button>
    </div>
  );
}

function DetailRow({ icon, label, value, last }: { icon: React.ReactNode; label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex items-center gap-4 py-3 ${last ? '' : 'border-b border-white/5'}`}>
      {icon}
      <div className="flex-1">
        <p className="text-xs text-white/40">{label}</p>
        <p className="text-sm text-white/80 font-medium capitalize">{value}</p>
      </div>
    </div>
  );
}
