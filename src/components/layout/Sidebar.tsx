
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Rocket,
  History,
  Palette,
  Settings,
  Database,
  ClipboardList,
  Layers,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  Zap,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSuite } from '../../contexts/SuiteContext';
import { SuiteSwitcher } from './SuiteSwitcher';

const NAV_ITEMS = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/deploy', icon: Rocket, label: 'Deploy Console' },
  { path: '/history', icon: History, label: 'Deploy History' },
  { path: '/workspace', icon: Layers, label: 'Workspace' },
  { path: '/backups', icon: Database, label: 'Backups' },
  { path: '/activity', icon: ClipboardList, label: 'Activity Log' },
  { path: '/themes', icon: Palette, label: 'Theme Studio' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { profile, signOut } = useAuth();
  const { activeJobCount } = useSuite();
  const location = useLocation();

  return (
    <aside
      className={`fixed left-0 top-0 h-screen z-40 flex flex-col transition-all duration-300 ease-out ${
        collapsed ? 'w-[72px]' : 'w-[260px]'
      }`}
      style={{
        background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)',
        backdropFilter: 'blur(24px)',
        borderRight: '1px solid rgba(148, 163, 184, 0.08)',
      }}
    >
      {/* Header / Suite Switcher */}
      <div className="p-4 border-b border-white/5">
        {collapsed ? (
          <div className="flex justify-center">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
          </div>
        ) : (
          <SuiteSwitcher />
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-white/40 hover:bg-white/5 hover:text-white/70'
              }`}
              title={collapsed ? item.label : undefined}
            >
              {!collapsed && (
                <span className="flex-1 truncate">{item.label}</span>
              )}
              
              <item.icon
                className={`w-[18px] h-[18px] flex-shrink-0 transition-colors ${
                  isActive ? 'text-primary' : 'text-white/30 group-hover:text-white/60'
                } ${collapsed ? '' : 'order-last'}`}
              />

              {/* Active Deployment Indicator (Small Pulse) */}
              {item.path === '/deploy' && activeJobCount > 0 && (
                <div className={`flex items-center gap-1.5 ${collapsed ? 'absolute -top-1 -right-1' : 'ml-2'}`}>
                  {!collapsed && (
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-md animate-pulse">
                      {activeJobCount}
                    </span>
                  )}
                  <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
                </div>
              )}

              {isActive && !collapsed && item.path !== '/deploy' && (
                <div className="ml-2 w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(13,148,136,0.6)]" />
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User Profile Section */}
      <div className="p-3 border-t border-white/5">
        {profile && !collapsed && (
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            {profile.photoURL ? (
              <img
                src={profile.photoURL}
                alt={profile.displayName || ''}
                className="w-8 h-8 rounded-full border border-white/10"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                {(profile.displayName || profile.email)?.[0]?.toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white/80 truncate">
                {profile.displayName || 'User'}
              </p>
              <p className="text-[10px] text-white/30 truncate">{profile.role}</p>
            </div>
          </div>
        )}

        {/* Sign Out */}
        <button
          onClick={signOut}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-white/30 hover:text-red-400 hover:bg-red-400/5 transition-all duration-200 text-sm"
          title="Sign Out"
        >
          <LogOut className="w-[18px] h-[18px]" />
          {!collapsed && <span>Sign Out</span>}
        </button>

        {/* Collapse Toggle */}
        <button
          onClick={onToggle}
          className="flex items-center gap-3 w-full px-3 py-2 mt-1 rounded-xl text-white/20 hover:text-white/50 hover:bg-white/5 transition-all duration-200 text-sm"
        >
          {collapsed ? (
            <ChevronsRight className="w-[18px] h-[18px]" />
          ) : (
            <>
              <ChevronsLeft className="w-[18px] h-[18px]" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
