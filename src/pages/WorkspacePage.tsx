import { useState, useEffect } from 'react';
import { 
  Layers, 
  Plus, 
  Trash2, 
  ExternalLink, 
  Database, 
  Folder, 
  Save,
  Loader2,
  AlertCircle,
  Users,
  UserPlus,
  Mail,
  Shield
} from 'lucide-react';
import { useSuite } from '../contexts/SuiteContext';
import { useAuth } from '../contexts/AuthContext';

const API_URL = 'http://localhost:5181';

interface AppConfig {
  id: string;
  name: string;
  dbId: string;
  projectPath: string;
  hostingTarget?: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

export function WorkspacePage() {
  const { currentSuite } = useSuite();
  const { user, workspaceRole, isViewer } = useAuth();
  const [activeTab, setActiveTab] = useState<'apps' | 'team' | 'settings'>('apps');
  const [apps, setApps] = useState<AppConfig[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New Invitation Form
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');

  // New App Form
  const [showAdd, setShowAdd] = useState(false);
  const [newApp, setNewApp] = useState<Partial<AppConfig>>({
    id: '',
    name: '',
    dbId: '',
    projectPath: '',
    hostingTarget: ''
  });

  useEffect(() => {
    if (!currentSuite?.id) return;

    const fetchData = async () => {
      try {
        const [appRes, invRes] = await Promise.all([
          fetch(`${API_URL}/api/workspaces/current`, {
            headers: { 'x-workspace-id': currentSuite.id }
          }),
          fetch(`${API_URL}/api/workspaces/${currentSuite.id}/invitations`)
        ]);
        const appData = await appRes.json();
        const invData = await invRes.json();
        setApps(appData.apps || []);
        setInvitations(invData || []);
      } catch (err) {
        console.error('Failed to fetch workspace data:', err);
        setError('Failed to load workspace configuration.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentSuite?.id]);

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/workspaces/${currentSuite?.id}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: inviteEmail, 
          role: inviteRole, 
          invitedBy: user?.email 
        })
      });
      const data = await res.json();
      setInvitations([...invitations, data]);
      setInviteEmail('');
      setShowInvite(false);
    } catch (err) {
      setError('Failed to send invitation');
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await fetch(`${API_URL}/api/invitations/${id}`, { method: 'DELETE' });
      setInvitations(invitations.filter(i => i.id !== id));
    } catch (err) {
      setError('Failed to revoke invitation');
    }
  };

  const handleSave = async (updatedApps: AppConfig[]) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/workspaces/${currentSuite?.id}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-workspace-id': currentSuite?.id || ''
        },
        body: JSON.stringify({ apps: updatedApps })
      });
      if (!res.ok) throw new Error('Failed to save changes');
      setApps(updatedApps);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const addApp = () => {
    if (!newApp.id || !newApp.name) return;
    const updated = [...apps, newApp as AppConfig];
    handleSave(updated);
    setNewApp({ id: '', name: '', dbId: '', projectPath: '', hostingTarget: '' });
    setShowAdd(false);
  };

  const removeApp = (id: string) => {
    const updated = apps.filter(a => a.id !== id);
    handleSave(updated);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="page-enter space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white/90 mb-1">Workspace Config</h1>
          <p className="text-white/40 text-sm">
            Manage the application registry for <span className="text-primary font-bold">{currentSuite?.name}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 p-1 bg-white/5 rounded-2xl border border-white/10">
          <button 
            onClick={() => setActiveTab('apps')}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'apps' ? 'bg-primary text-white shadow-lg' : 'text-white/40 hover:text-white/60'
            }`}
          >
            Applications
          </button>
          <button 
            onClick={() => setActiveTab('team')}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'team' ? 'bg-primary text-white shadow-lg' : 'text-white/40 hover:text-white/60'
            }`}
          >
            Team Members
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'settings' ? 'bg-primary text-white shadow-lg' : 'text-white/40 hover:text-white/60'
            }`}
          >
            Settings
          </button>
        </div>
        {!isViewer && (
          <button 
            onClick={() => activeTab === 'apps' ? setShowAdd(true) : setShowInvite(true)}
            className="h-12 px-6 bg-primary/10 text-primary hover:bg-primary/20 rounded-2xl transition-all font-bold text-sm flex items-center gap-2 border border-primary/20"
          >
            {activeTab === 'apps' ? <Plus className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            {activeTab === 'apps' ? 'Add App' : 'Invite Member'}
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-sm">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {activeTab === 'apps' ? (
        <div className="grid grid-cols-1 gap-4">
          {apps.map((app) => (
            <div key={app.id} className="glass-card-static p-6 flex items-center justify-between group">
              <div className="flex items-center gap-6">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
                  <Layers className="w-6 h-6 text-white/20" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white/90">{app.name}</h3>
                  <div className="flex items-center gap-4 mt-1 text-xs text-white/30">
                    <span className="flex items-center gap-1.5">
                      <Database className="w-3 h-3" />
                      {app.dbId}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Folder className="w-3 h-3" />
                      {app.projectPath}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => removeApp(app.id)}
                  className="p-2 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                  title="Remove App"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : activeTab === 'team' ? (
        <div className="space-y-4">
          <div className="glass-card-static p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                {user?.email?.[0].toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-bold text-white/90">{user?.email} <span className="ml-2 text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full uppercase">{workspaceRole || 'Member'}</span></p>
                <p className="text-xs text-white/30 italic">You</p>
              </div>
            </div>
          </div>

          {/* Active Team */}
          <div className="grid grid-cols-1 gap-4">
            {invitations.filter(i => i.status === 'accepted').map((inv) => (
              <div key={inv.id} className="glass-card-static p-6 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold">
                    {inv.email[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white/90">{inv.email} <span className="ml-2 text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full uppercase">{inv.role}</span></p>
                    <p className="text-xs text-white/30 italic">Active Member</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/20 px-2 mt-8">Pending Invitations</h3>
          
          {invitations.filter(i => i.status === 'pending').length === 0 ? (
            <p className="text-sm text-white/10 italic px-2">No pending invitations</p>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {invitations.filter(i => i.status === 'pending').map((inv) => (
                <div key={inv.id} className="glass-card-static p-6 flex items-center justify-between group border-dashed border-white/10 bg-transparent">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                      <Mail className="w-5 h-5 text-white/20" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white/80">{inv.email}</p>
                      <p className="text-[10px] text-white/20 uppercase font-black tracking-widest mt-0.5">{inv.role} • Invited on {new Date(inv.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleRevoke(inv.id)}
                    className="p-2 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                    title="Revoke Invitation"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="max-w-2xl space-y-6">
          <div className="glass-card-static p-8">
            <h3 className="text-xl font-bold text-white mb-6">General Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-white/30 mb-2">Workspace Name</label>
                <input 
                  defaultValue={currentSuite?.name}
                  className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:border-primary/50"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-white/30 mb-2">Workspace ID</label>
                <input 
                  readOnly
                  value={currentSuite?.id}
                  className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-white/40 outline-none cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          <div className="glass-card-static p-8 border-red-500/20">
            <h3 className="text-xl font-bold text-red-400 mb-2">Danger Zone</h3>
            <p className="text-xs text-white/30 mb-6">Irreversible actions for this workspace.</p>
            <button className="px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl font-bold text-sm transition-all">
              Delete Workspace
            </button>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md p-8 animate-in zoom-in duration-200">
            <h2 className="text-xl font-bold text-white mb-6">Add New Application</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-white/30 mb-2">Internal ID</label>
                <input 
                  value={newApp.id}
                  onChange={e => setNewApp({...newApp, id: e.target.value})}
                  className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:border-primary/50"
                  placeholder="e.g. my-app-0"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-white/30 mb-2">Display Name</label>
                <input 
                  value={newApp.name}
                  onChange={e => setNewApp({...newApp, name: e.target.value})}
                  className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:border-primary/50"
                  placeholder="e.g. My Dashboard"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-white/30 mb-2">Project Path</label>
                <input 
                  value={newApp.projectPath}
                  onChange={e => setNewApp({...newApp, projectPath: e.target.value})}
                  className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:border-primary/50"
                  placeholder="~/projects/..."
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-white/30 mb-2">Database ID</label>
                <input 
                  value={newApp.dbId}
                  onChange={e => setNewApp({...newApp, dbId: e.target.value})}
                  className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:border-primary/50"
                  placeholder="postgres-db-0"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => setShowAdd(false)}
                className="flex-1 h-12 rounded-xl bg-white/5 text-white/60 font-bold hover:bg-white/10 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={addApp}
                className="flex-1 h-12 rounded-xl bg-primary text-white font-bold hover:bg-primary/80 transition-all shadow-lg shadow-primary/20"
              >
                Add App
              </button>
            </div>
          </div>
        </div>
      )}

      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md p-8 animate-in zoom-in duration-200">
            <h2 className="text-xl font-bold text-white mb-6">Invite Team Member</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-white/30 mb-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <input 
                    type="email"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    className="w-full h-12 pl-12 pr-4 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:border-primary/50"
                    placeholder="teammate@example.com"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-white/30 mb-2">Workspace Role</label>
                <div className="grid grid-cols-3 gap-3">
                  {['viewer', 'operator', 'admin'].map(role => (
                    <button
                      key={role}
                      onClick={() => setInviteRole(role)}
                      className={`h-12 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                        inviteRole === role 
                          ? 'bg-primary/20 border-primary text-primary' 
                          : 'bg-white/5 border-white/10 text-white/30 hover:bg-white/10'
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-white/20 mt-3 leading-relaxed">
                  {inviteRole === 'viewer' && 'Can only view health, logs, and dashboard.'}
                  {inviteRole === 'operator' && 'Can trigger deployments, backups, and restores.'}
                  {inviteRole === 'admin' && 'Full control including inviting others and editing workspace apps.'}
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => setShowInvite(false)}
                className="flex-1 h-12 rounded-xl bg-white/5 text-white/60 font-bold hover:bg-white/10 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleInvite}
                disabled={saving || !inviteEmail}
                className="flex-1 h-12 rounded-xl bg-primary text-white font-bold hover:bg-primary/80 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Send Invite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
