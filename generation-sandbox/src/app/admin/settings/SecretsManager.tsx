'use client';
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icons } from '@/components/ui/Icons';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

export function SecretsManager() {
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteModalState, setDeleteModalState] = useState<{ isOpen: boolean; key: string }>({ 
    isOpen: false, 
    key: '' 
  });
  const [saveModalState, setSaveModalState] = useState<{ isOpen: boolean; key: string; value: string }>({
    isOpen: false,
    key: '',
    value: ''
  });

  useEffect(() => {
    fetchSecrets();
  }, []);

  const fetchSecrets = async () => {
    try {
      const res = await fetch('/api/admin/config');
      if (res.ok) {
        const data = await res.json();
        setSecrets(data);
      }
    } catch (err) {
      console.error('Failed to fetch secrets');
    } finally {
      setLoading(false);
    }
  };

  const triggerAddSecret = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey || !newValue) return;
    setSaveModalState({ isOpen: true, key: newKey, value: newValue });
  };

  const handleAddSecret = async () => {
    setSaving(true);
    const { key, value } = saveModalState;
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });

      if (res.ok) {
        setNewKey('');
        setNewValue('');
        setSaveModalState({ isOpen: false, key: '', value: '' });
        await fetchSecrets();
      }
    } catch (err) {
      console.error('Failed to save secret');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSecret = async () => {
    const key = deleteModalState.key;
    try {
      const res = await fetch('/api/admin/config', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });

      if (res.ok) {
        setDeleteModalState({ isOpen: false, key: '' });
        await fetchSecrets();
      }
    } catch (err) {
      console.error('Failed to delete secret');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Icons.spinner className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-black uppercase tracking-tight">Secrets & API Keys</h3>
          <p className="text-sm text-foreground-muted">Manage global encrypted configuration across the suite.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full">
          <Icons.shield className="w-3 h-3 text-amber-500" />
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">AES-256 Encrypted</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {Object.entries(secrets).map(([key, value]) => (
          <Card key={key} variant="glass" className="p-4 flex items-center justify-between border-border/50 group">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center border border-primary/10">
                <Icons.lock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-black uppercase tracking-widest text-foreground">{key}</p>
                <code className="text-[10px] text-foreground-muted font-mono">{value}</code>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setDeleteModalState({ isOpen: true, key })}
              className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500"
            >
              <Icons.delete className="w-4 h-4" />
            </Button>
          </Card>
        ))}

        {Object.keys(secrets).length === 0 && (
          <div className="py-12 text-center text-foreground-muted text-sm italic border border-dashed border-border/50 rounded-3xl">
            No global secrets configured yet.
          </div>
        )}
      </div>

      <Card variant="glass" className="p-6 border-primary/20 bg-black/30 backdrop-blur-xl">
        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-6 flex items-center gap-2">
          <Icons.plus className="w-3 h-3" />
          Add New Suite Secret
        </h4>
        <form onSubmit={triggerAddSecret} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest px-1 text-white/50">Key Name</label>
              <input 
                type="text" 
                placeholder="STILLWATER_AI_TOKEN"
                className="w-full bg-black/40 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3 text-sm font-mono text-white placeholder:text-white/20 focus:ring-2 focus:ring-primary/50 transition-all outline-none"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest px-1 text-white/50">Value (will be encrypted)</label>
              <input 
                type="password" 
                placeholder="••••••••••••••••"
                className="w-full bg-black/40 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3 text-sm font-mono text-white placeholder:text-white/20 focus:ring-2 focus:ring-primary/50 transition-all outline-none"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button 
              type="submit" 
              disabled={saving}
              className="gap-2 font-black uppercase tracking-widest text-xs h-10 px-6"
              isLoading={saving}
            >
              <Icons.plus className="w-3 h-3" />
              Save Secret
            </Button>
          </div>
        </form>
      </Card>

      <ConfirmModal 
        isOpen={deleteModalState.isOpen}
        onClose={() => setDeleteModalState({ isOpen: false, key: '' })}
        onConfirm={handleDeleteSecret}
        variant="danger"
        title="Delete Secret?"
        description={`This will permanently remove ${deleteModalState.key} from the global configuration store. Any app relying on this secret will fall back to local environment variables.`}
        confirmText="Delete Permanently"
      />

      <ConfirmModal 
        isOpen={saveModalState.isOpen}
        onClose={() => setSaveModalState({ isOpen: false, key: '', value: '' })}
        onConfirm={handleAddSecret}
        isLoading={saving}
        title="Deploy New Secret?"
        description={`Updating ${saveModalState.key} will encrypt the value and propagate it to all applications in the suite.`}
        confirmText="Encrypt & Save"
      />
    </div>
  );
}
