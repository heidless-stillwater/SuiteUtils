'use client';

import { useAdminSettings } from '@/hooks/useAdminSettings';
import StatusModal from '@/components/StatusModal';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Icons } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { SignupIncentives, SystemConfig } from '@/lib/types';
import { SecretsManager } from './SecretsManager';

export default function AdminSettingsPage() {
    const {
        config,
        isSaving,
        modalStatus,
        setModalStatus,
        handleSave,
        loading
    } = useAdminSettings();

    // Local state for form editing
    const [localConfig, setLocalConfig] = useState<SystemConfig | null>(null);

    useEffect(() => {
        if (config && !localConfig) {
            setLocalConfig(config);
        }
    }, [config]);

    if (loading || !localConfig) {
        return (
            <div className="flex items-center justify-center p-24">
                <Icons.spinner className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    const updateIncentive = (key: keyof SignupIncentives, updates: any) => {
        setLocalConfig({
            ...localConfig,
            incentives: {
                ...localConfig.incentives,
                [key]: {
                    ...localConfig.incentives[key],
                    ...updates
                }
            }
        });
    };

    return (
        <div className="max-w-4xl space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
            <StatusModal
                status={modalStatus}
                onClose={() => setModalStatus('idle')}
            />

            {/* Announcement Banner */}
            <Card variant="glass" className="p-8 rounded-[2.5rem] border-border/50 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Icons.globe className="w-24 h-24" />
                </div>

                <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl">📢</div>
                    <div>
                        <h3 className="text-xl font-black uppercase tracking-tight">Global Announcement</h3>
                        <p className="text-xs text-foreground-muted font-bold uppercase tracking-widest opacity-60">Visible on all generation interfaces</p>
                    </div>
                </div>

                <div className="space-y-6">
                    <textarea
                        value={localConfig.announcement}
                        onChange={(e) => setLocalConfig({ ...localConfig, announcement: e.target.value })}
                        className="w-full bg-[#0a0a0f] text-white border border-border/50 rounded-2xl p-6 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[150px] transition-all resize-none shadow-inner"
                        placeholder="Enter announcement text..."
                    />
                    <div className="flex items-center gap-3 group cursor-pointer">
                        <div className="relative flex items-center">
                            <input
                                type="checkbox"
                                id="show-banner"
                                checked={localConfig.showBanner}
                                onChange={(e) => setLocalConfig({ ...localConfig, showBanner: e.target.checked })}
                                className="w-5 h-5 rounded-md border-border bg-background checked:bg-primary checked:border-primary transition-all cursor-pointer appearance-none border-2"
                            />
                            {localConfig.showBanner && <Icons.check className="absolute w-3.5 h-3.5 text-white left-0.5 pointer-events-none transition-opacity font-black" />}
                        </div>
                        <label htmlFor="show-banner" className="text-xs font-black uppercase tracking-widest text-foreground-muted group-hover:text-foreground transition-colors cursor-pointer">
                            Display banner to all active users
                        </label>
                    </div>
                </div>
            </Card>

            {/* Signup Incentives */}
            <Card variant="glass" className="p-8 rounded-[2.5rem] border-border/50">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center text-2xl">🎁</div>
                    <div>
                        <h3 className="text-xl font-black uppercase tracking-tight">Signup Incentives</h3>
                        <p className="text-xs text-foreground-muted font-bold uppercase tracking-widest opacity-60">Attract new users with these rewards</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <IncentiveControl
                        title="Welcome Credits"
                        description="One-time credits for new accounts"
                        enabled={localConfig.incentives.welcomeCredits.enabled}
                        onToggle={(enabled) => updateIncentive('welcomeCredits', { enabled })}
                    >
                        <Input
                            type="number"
                            value={localConfig.incentives.welcomeCredits.amount}
                            onChange={(e) => updateIncentive('welcomeCredits', { amount: parseInt(e.target.value) || 0 })}
                            className="w-24 h-10 px-3 bg-background border-border/50 rounded-xl text-xs font-black"
                        />
                        <span className="text-[10px] font-black uppercase tracking-widest text-foreground-muted">Credits</span>
                    </IncentiveControl>

                    <IncentiveControl
                        title="Founder Badge"
                        description="Permanent 'Early Access' badge"
                        enabled={localConfig.incentives.founderBadge.enabled}
                        onToggle={(enabled) => updateIncentive('founderBadge', { enabled })}
                    >
                        <Select
                            value={localConfig.incentives.founderBadge.badgeId}
                            onChange={(e) => updateIncentive('founderBadge', { badgeId: e.target.value })}
                            className="h-10 text-[10px] font-black uppercase tracking-widest"
                        >
                            <option value="og">OG Member</option>
                            <option value="verified">Verified</option>
                            <option value="elite">Elite Creator</option>
                        </Select>
                    </IncentiveControl>

                    <IncentiveControl
                        title="Master Pass"
                        description="Temporary Pro feature evaluation"
                        enabled={localConfig.incentives.masterPass.enabled}
                        onToggle={(enabled) => updateIncentive('masterPass', { enabled })}
                    >
                        <Input
                            type="number"
                            value={localConfig.incentives.masterPass.durationHours}
                            onChange={(e) => updateIncentive('masterPass', { durationHours: parseInt(e.target.value) || 0 })}
                            className="w-24 h-10 px-3 bg-background border-border/50 rounded-xl text-xs font-black"
                        />
                        <span className="text-[10px] font-black uppercase tracking-widest text-foreground-muted">Hours</span>
                    </IncentiveControl>

                    <IncentiveControl
                        title="Community Boost"
                        description="First post visibility multiplier"
                        enabled={localConfig.incentives.communityBoost.enabled}
                        onToggle={(enabled) => updateIncentive('communityBoost', { enabled })}
                    >
                        <Input
                            type="number"
                            step="0.1"
                            value={localConfig.incentives.communityBoost.multiplier}
                            onChange={(e) => updateIncentive('communityBoost', { multiplier: parseFloat(e.target.value) || 1 })}
                            className="w-24 h-10 px-3 bg-background border-border/50 rounded-xl text-xs font-black"
                        />
                        <span className="text-[10px] font-black uppercase tracking-widest text-foreground-muted">Scale</span>
                    </IncentiveControl>

                    <IncentiveControl
                        title="Knowledge Bounty"
                        description="Credits for prompt recipe clones"
                        enabled={localConfig.incentives.knowledgeBounty.enabled}
                        onToggle={(enabled) => updateIncentive('knowledgeBounty', { enabled })}
                    >
                        <Input
                            type="number"
                            value={localConfig.incentives.knowledgeBounty.rewardAmount}
                            onChange={(e) => updateIncentive('knowledgeBounty', { rewardAmount: parseInt(e.target.value) || 0 })}
                            className="w-24 h-10 px-3 bg-background border-border/50 rounded-xl text-xs font-black"
                        />
                        <span className="text-[10px] font-black uppercase tracking-widest text-foreground-muted">Credits</span>
                    </IncentiveControl>

                    <IncentiveControl
                        title="Vanguard Role"
                        description="Access to experimental weights"
                        enabled={localConfig.incentives.vanguardRole.enabled}
                        onToggle={(enabled) => updateIncentive('vanguardRole', { enabled })}
                    >
                        <Select
                            value={localConfig.incentives.vanguardRole.roleId}
                            onChange={(e) => updateIncentive('vanguardRole', { roleId: e.target.value })}
                            className="h-10 text-[10px] font-black uppercase tracking-widest"
                        >
                            <option value="vanguard">Vanguard</option>
                            <option value="alpha">Alpha Tester</option>
                        </Select>
                    </IncentiveControl>
                </div>
            </Card>

            {/* Model & Safety Config */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card variant="glass" className="p-8 rounded-[2.5rem] border-border/50">
                    <h3 className="text-sm font-black uppercase tracking-widest mb-6 flex items-center gap-3">
                        <span className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center text-sm">🤖</span>
                        Engine Selection
                    </h3>
                    <div className="space-y-4">
                        <EngineOption
                            id="flash"
                            name="Gemini 2.5 Flash"
                            description="Fastest, economical, stable."
                            selected={localConfig.defaultModel === 'flash'}
                            onSelect={() => setLocalConfig({ ...localConfig, defaultModel: 'flash' })}
                        />
                        <EngineOption
                            id="pro"
                            name="Gemini 3.0 Pro (Exp)"
                            description="Highest quality, slower generation."
                            selected={localConfig.defaultModel === 'pro'}
                            onSelect={() => setLocalConfig({ ...localConfig, defaultModel: 'pro' })}
                            highlight
                        />
                    </div>
                </Card>

                <Card variant="glass" className="p-8 rounded-[2.5rem] border-border/50">
                    <h3 className="text-sm font-black uppercase tracking-widest mb-6 flex items-center gap-3">
                        <span className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center text-sm">🛡️</span>
                        Safety Thresholds
                    </h3>
                    <div className="space-y-6">
                        <Select
                            value={localConfig.safetyThreshold}
                            onChange={(e) => setLocalConfig({ ...localConfig, safetyThreshold: e.target.value as any })}
                            className="text-xs font-black uppercase tracking-widest"
                        >
                            <option value="strict">Strict (BLOCK_LOW_AND_ABOVE)</option>
                            <option value="medium">Standard (BLOCK_MEDIUM_AND_ABOVE)</option>
                            <option value="permissive">Permissive (BLOCK_ONLY_HIGH)</option>
                        </Select>
                        <div className="p-5 rounded-2xl bg-primary/5 border border-primary/10">
                            <p className="text-[10px] font-black uppercase tracking-widest text-primary/70 mb-2 flex items-center gap-2">
                                <Icons.info size={12} /> System Note
                            </p>
                            <p className="text-[10px] font-medium text-foreground-muted leading-relaxed uppercase tracking-tighter">
                                These settings apply globally but can be overridden by specific user profile rules.
                            </p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Action Bar */}
            <div className="flex justify-end pr-4">
                <Button
                    onClick={() => handleSave(localConfig)}
                    disabled={isSaving}
                    size="lg"
                    className="px-12 h-14 font-black uppercase tracking-widest shadow-2xl shadow-primary/25 rounded-2xl text-xs"
                    isLoading={isSaving}
                >
                    Save Global Settings
                </Button>
            </div>

            <hr className="border-border/50" />

            {/* API Secrets Management */}
            <SecretsManager />
        </div>
    );
}

function IncentiveControl({ title, description, enabled, onToggle, children }: {
    title: string;
    description: string;
    enabled: boolean;
    onToggle: (enabled: boolean) => void;
    children?: React.ReactNode;
}) {
    return (
        <div className={cn(
            "p-6 rounded-3xl border transition-all space-y-4",
            enabled ? "bg-primary/5 border-primary/20 shadowed" : "bg-background-secondary/50 border-border/50 opacity-60"
        )}>
            <div className="flex items-center justify-between">
                <div>
                    <h4 className="text-sm font-black uppercase tracking-tight">{title}</h4>
                    <p className="text-[10px] text-foreground-muted font-bold uppercase tracking-tighter">{description}</p>
                </div>
                <div
                    onClick={() => onToggle(!enabled)}
                    className={cn(
                        "w-10 h-5 rounded-full relative cursor-pointer transition-all",
                        enabled ? "bg-primary" : "bg-border"
                    )}
                >
                    <div className={cn(
                        "absolute top-1 w-3 h-3 rounded-full bg-white transition-all",
                        enabled ? "right-1" : "left-1"
                    )} />
                </div>
            </div>
            {enabled && (
                <div className="flex items-center gap-3 pt-2">
                    {children}
                </div>
            )}
        </div>
    );
}

function EngineOption({ id, name, description, selected, onSelect, highlight }: {
    id: string,
    name: string,
    description: string,
    selected: boolean,
    onSelect: () => void,
    highlight?: boolean
}) {
    return (
        <label className={cn(
            "flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer group",
            selected
                ? "bg-primary/5 border-primary shadow-lg shadow-primary/5"
                : "bg-background-secondary/50 border-border/30 hover:border-primary/50"
        )}>
            <div className="relative flex items-center">
                <input
                    type="radio"
                    name="model"
                    checked={selected}
                    onChange={onSelect}
                    className="w-5 h-5 border-2 border-border bg-background checked:bg-primary checked:border-primary transition-all cursor-pointer appearance-none rounded-full"
                />
                {selected && <div className="absolute w-2 h-2 bg-white rounded-full left-1.5" />}
            </div>
            <div>
                <p className={cn(
                    "text-xs font-black uppercase tracking-widest",
                    highlight ? "text-accent" : "text-foreground",
                    selected && !highlight ? "text-primary" : ""
                )}>
                    {name}
                </p>
                <p className="text-[10px] text-foreground-muted font-bold uppercase tracking-tighter opacity-60">
                    {description}
                </p>
            </div>
        </label>
    );
}
