import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Users, 
  UserPlus, 
  Shield, 
  Trash2, 
  Clock, 
  Mail, 
  ChevronLeft,
  AlertCircle,
  CheckCircle2,
  Zap,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Invitation {
  id: string;
  email: string;
  role: 'viewer' | 'operator' | 'admin';
  status: 'pending' | 'accepted' | 'expired';
  createdAt: string;
}

const InvitationPage: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [searchParams] = useSearchParams();
  const invitationCode = searchParams.get('code');
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'viewer' | 'operator' | 'admin'>('viewer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // For Acceptance Flow
  const [targetInvitation, setTargetInvitation] = useState<Invitation | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (invitationCode) {
      fetchTargetInvitation();
    } else {
      fetchInvitations();
    }
  }, [workspaceId, invitationCode]);

  const fetchTargetInvitation = async () => {
    setLoading(true);
    try {
      // In a real app, we'd have a specific "get invitation by code" endpoint
      // For now, we list all for the workspace and find the one with the ID
      const res = await fetch(`http://localhost:5181/api/workspaces/${workspaceId}/invitations`);
      const data = await res.json();
      const found = data.find((i: Invitation) => i.id === invitationCode);
      if (!found) throw new Error('Invitation code invalid or expired');
      setTargetInvitation(found);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchInvitations = async () => {
    try {
      const res = await fetch(`http://localhost:5181/api/workspaces/${workspaceId}/invitations`);
      const data = await res.json();
      setInvitations(data);
    } catch (err) {
      console.error('Failed to fetch invitations:', err);
    }
  };

  const handleAccept = async () => {
    if (!targetInvitation) return;
    setAccepting(true);
    try {
      const res = await fetch(`http://localhost:5181/api/invitations/${targetInvitation.id}/accept`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error('Failed to accept invitation');
      
      setSuccess('Welcome to the workspace! Redirecting...');
      setTimeout(() => navigate('/workspace'), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAccepting(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`http://localhost:5181/api/workspaces/${workspaceId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role, invitedBy: user?.email || 'admin' })
      });

      if (!res.ok) throw new Error('Failed to create invitation');
      
      setSuccess(`Invitation sent to ${email}`);
      setEmail('');
      fetchInvitations();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (invId: string) => {
    if (!confirm('Are you sure you want to revoke this invitation?')) return;

    try {
      const res = await fetch(`http://localhost:5181/api/workspaces/${workspaceId}/invitations/${invId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to revoke invitation');
      fetchInvitations();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // ---------------------------------------------------------
  // RENDER: ACCEPTANCE FLOW
  // ---------------------------------------------------------
  if (invitationCode) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="glass-card p-10 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-accent to-primary" />
            
            <div className="flex justify-center mb-8">
              <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center text-primary shadow-[0_0_50px_rgba(13,148,136,0.2)]">
                <Zap className="w-10 h-10 fill-primary/20" />
              </div>
            </div>

            <h1 className="text-3xl font-bold text-white mb-2">You're Invited!</h1>
            <p className="text-white/40 text-sm mb-10">
              Join the <span className="text-primary font-bold">{workspaceId}</span> workspace on SuiteUtils.
            </p>

            {loading ? (
              <div className="flex flex-col items-center gap-4 py-8">
                <Clock className="w-8 h-8 text-white/20 animate-spin" />
                <p className="text-xs text-white/20 uppercase tracking-widest font-black">Validating Code...</p>
              </div>
            ) : error ? (
              <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl mb-8">
                <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
                <p className="text-red-400 font-bold">{error}</p>
                <button 
                  onClick={() => navigate('/')}
                  className="mt-4 text-xs text-white/40 hover:text-white underline font-bold uppercase tracking-widest"
                >
                  Return to Dashboard
                </button>
              </div>
            ) : success ? (
              <div className="p-8 bg-primary/10 border border-primary/20 rounded-2xl mb-8 animate-in zoom-in duration-300">
                <CheckCircle2 className="w-10 h-10 text-primary mx-auto mb-4" />
                <p className="text-primary font-bold text-lg">{success}</p>
              </div>
            ) : targetInvitation && (
              <div className="space-y-8">
                <div className="p-6 bg-white/5 rounded-2xl border border-white/10 text-left">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold">
                      {targetInvitation.email[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{targetInvitation.email}</p>
                      <p className="text-[10px] text-white/30 uppercase tracking-widest">Invited Email</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-white/5">
                    <span className="text-[10px] uppercase tracking-widest text-white/30 font-black">Role Granted</span>
                    <span className="px-3 py-1 bg-primary/20 text-primary rounded-full text-[10px] font-black uppercase tracking-widest border border-primary/30">
                      {targetInvitation.role}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleAccept}
                  disabled={accepting}
                  className="w-full group h-14 bg-primary hover:bg-primary/90 text-white font-bold rounded-2xl transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {accepting ? 'Joining...' : 'Accept Invitation'}
                  {!accepting && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                </button>

                <p className="text-[10px] text-white/20 uppercase tracking-widest leading-relaxed">
                  By joining, you agree to the workspace policies <br /> set by the administrator.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------
  // RENDER: MANAGEMENT FLOW (FALLBACK)
  // ---------------------------------------------------------
  return (
    <div className="page-enter space-y-8">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-white/10 rounded-xl transition-colors"
        >
          <ChevronLeft className="w-6 h-6 text-white/40" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-white">Team Management</h1>
          <p className="text-white/40 text-sm">Workspace ID: <span className="text-primary font-mono">{workspaceId}</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Invite Form */}
        <div className="lg:col-span-1">
          <div className="glass-card-static p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-primary/10 rounded-2xl">
                <UserPlus className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-white">Invite Member</h2>
            </div>

            <form onSubmit={handleInvite} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-white/30 mb-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <input 
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="teammate@example.com"
                    className="w-full h-12 pl-12 pr-4 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:border-primary/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-white/30 mb-2">Assigned Role</label>
                <select 
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:border-primary/50 appearance-none cursor-pointer"
                >
                  <option value="viewer">Viewer (Read-only)</option>
                  <option value="operator">Operator (Backups & Deploys)</option>
                  <option value="admin">Admin (Full Access)</option>
                </select>
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full h-14 bg-primary hover:bg-primary/90 text-white font-bold rounded-2xl transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send Invitation'}
              </button>

              {error && (
                <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}
              
              {success && (
                <div className="flex items-center gap-2 p-4 bg-primary/10 border border-primary/20 rounded-xl text-primary text-sm font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  {success}
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Invitations List */}
        <div className="lg:col-span-2">
          <div className="glass-card-static overflow-hidden">
            <div className="p-8 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/5 rounded-2xl">
                  <Clock className="w-6 h-6 text-white/20" />
                </div>
                <h2 className="text-xl font-bold text-white">Pending Invitations</h2>
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-white/20 bg-white/5 px-3 py-1 rounded-full">
                {invitations.length} Total
              </span>
            </div>

            <div className="divide-y divide-white/5">
              {invitations.length === 0 ? (
                <div className="p-20 text-center text-white/10 italic">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-10" />
                  <p>No pending invitations for this workspace</p>
                </div>
              ) : (
                invitations.map((inv) => (
                  <div key={inv.id} className="p-6 flex items-center justify-between hover:bg-white/[0.02] transition-colors group">
                    <div className="flex items-center gap-6">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/40 to-accent/40 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                        {inv.email[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-white text-lg">{inv.email}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="flex items-center gap-1.5 text-[10px] text-primary uppercase font-black tracking-widest">
                            <Shield className="w-3 h-3" />
                            {inv.role}
                          </span>
                          <span className="text-white/10">•</span>
                          <span className="text-[10px] text-white/20 uppercase font-bold tracking-widest">
                            Invited {new Date(inv.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => handleRevoke(inv.id)}
                      className="p-3 text-white/10 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                      title="Revoke Invitation"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvitationPage;
