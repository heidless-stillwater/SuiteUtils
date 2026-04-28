import { User, Mail, Shield, LogOut, Crown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function SettingsPage() {
  const { profile, user, signOut, isSu, effectiveRole, switchRole } = useAuth();

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
