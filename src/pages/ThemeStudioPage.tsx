import { useState } from 'react';
import { Check, Palette, Download, Upload, Eye, Sparkles } from 'lucide-react';
import { BUILT_IN_THEMES, applyTheme, resetTheme, getTokensByCategory, exportTheme } from '../lib/theme-service';
import type { Theme } from '../lib/types';
import { Timestamp } from 'firebase/firestore';

export function ThemeStudioPage() {
  const [activeThemeId, setActiveThemeId] = useState('stillwater-midnight');
  const [editingTheme, setEditingTheme] = useState<Theme | null>(null);
  const [previewTokens, setPreviewTokens] = useState<Record<string, string> | null>(null);

  const handleApply = (theme: typeof BUILT_IN_THEMES[0]) => {
    const fullTheme: Theme = {
      ...theme,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    applyTheme(fullTheme);
    setActiveThemeId(theme.id);
  };

  const handleReset = () => {
    resetTheme();
    setActiveThemeId('stillwater-midnight');
  };

  const handleEdit = (theme: typeof BUILT_IN_THEMES[0]) => {
    setEditingTheme({
      ...theme,
      tokens: { ...theme.tokens },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    setPreviewTokens({ ...theme.tokens });
  };

  const handleTokenChange = (key: string, value: string) => {
    if (!previewTokens) return;
    const updated = { ...previewTokens, [key]: value };
    setPreviewTokens(updated);
    // Live preview
    document.documentElement.style.setProperty(key, value);
  };

  const handleExport = (theme: typeof BUILT_IN_THEMES[0]) => {
    const fullTheme: Theme = {
      ...theme,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    const json = exportTheme(fullTheme);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${theme.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-enter space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white/90">Theme Studio</h1>
          <p className="text-sm text-white/40 mt-1">
            Design and apply themes across the Stillwater ecosystem
          </p>
        </div>
        <button onClick={handleReset} className="btn-ghost text-xs">
          Reset to Default
        </button>
      </div>

      {/* Theme Gallery */}
      <div>
        <p className="premium-label mb-4">Built-in Themes</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {BUILT_IN_THEMES.map((theme) => (
            <div
              key={theme.id}
              className={`glass-card p-5 relative group ${
                activeThemeId === theme.id ? 'border-primary/30 shadow-[0_0_30px_rgba(13,148,136,0.1)]' : ''
              }`}
            >
              {/* Active Indicator */}
              {activeThemeId === theme.id && (
                <div className="absolute top-3 right-3">
                  <span className="badge badge-success text-[8px]">
                    <Check className="w-3 h-3" />
                    Active
                  </span>
                </div>
              )}

              {/* Theme Name */}
              <h3 className="text-sm font-bold text-white/90 mb-3">{theme.name}</h3>

              {/* Color Swatches */}
              <div className="flex gap-1.5 mb-4">
                {['--bg-primary', '--bg-secondary', '--accent-primary', '--accent-secondary', '--success', '--warning', '--danger'].map(
                  (key) => (
                    <div
                      key={key}
                      className="w-7 h-7 rounded-lg border border-white/10"
                      style={{ background: theme.tokens[key] }}
                      title={key}
                    />
                  )
                )}
              </div>

              {/* Text Preview */}
              <div
                className="p-3 rounded-xl mb-4 text-xs"
                style={{
                  background: theme.tokens['--bg-secondary'],
                  color: theme.tokens['--text-primary'],
                }}
              >
                <p style={{ color: theme.tokens['--text-primary'] }}>Primary Text</p>
                <p style={{ color: theme.tokens['--text-secondary'] }}>Secondary Text</p>
                <p style={{ color: theme.tokens['--text-muted'] }}>Muted Text</p>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleApply(theme)}
                  className="btn-primary text-xs flex-1 !py-2"
                  disabled={activeThemeId === theme.id}
                >
                  <Eye className="w-3.5 h-3.5" />
                  Apply
                </button>
                <button
                  onClick={() => handleEdit(theme)}
                  className="btn-secondary text-xs !py-2 !px-3"
                >
                  <Palette className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleExport(theme)}
                  className="btn-ghost text-xs !py-2 !px-3"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Token Editor (shown when editing) */}
      {editingTheme && previewTokens && (
        <div className="glass-card-static p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold text-white/90">
                Editing: {editingTheme.name}
              </h2>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEditingTheme(null);
                  setPreviewTokens(null);
                  handleReset();
                  if (activeThemeId) {
                    const active = BUILT_IN_THEMES.find((t) => t.id === activeThemeId);
                    if (active) handleApply(active);
                  }
                }}
                className="btn-ghost text-xs"
              >
                Cancel
              </button>
              <button className="btn-primary text-xs">
                Save Theme
              </button>
            </div>
          </div>

          {/* Token Categories */}
          <div className="space-y-6">
            {Object.entries(getTokensByCategory(previewTokens)).map(
              ([category, tokens]) =>
                tokens.length > 0 && (
                  <div key={category}>
                    <p className="premium-label mb-3">{category}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {tokens.map(({ key, value, label }) => (
                        <div
                          key={key}
                          className="flex items-center gap-3 p-3 bg-white/[0.02] rounded-xl border border-white/5"
                        >
                          <input
                            type="color"
                            value={value.startsWith('#') ? value : '#0d9488'}
                            onChange={(e) => handleTokenChange(key, e.target.value)}
                            className="w-8 h-8 rounded-lg border-0 cursor-pointer bg-transparent"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-white/70 truncate">
                              {label}
                            </p>
                            <p className="text-[10px] text-white/25 font-mono">{key}</p>
                          </div>
                          <input
                            type="text"
                            value={value}
                            onChange={(e) => handleTokenChange(key, e.target.value)}
                            className="w-24 text-[11px] font-mono text-white/50 bg-black/30 border border-white/5 rounded-lg px-2 py-1 outline-none focus:border-primary/50"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )
            )}
          </div>
        </div>
      )}

      {/* Future: User Override Notice */}
      <div className="glass-card-static p-5 flex items-center gap-4 opacity-40">
        <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center">
          <Palette className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white/60">User Theme Overrides</p>
          <p className="text-xs text-white/30">
            Individual users will be able to override the suite default theme. Coming in a future release.
          </p>
        </div>
        <span className="badge badge-warning text-[8px] ml-auto">Planned</span>
      </div>
    </div>
  );
}
