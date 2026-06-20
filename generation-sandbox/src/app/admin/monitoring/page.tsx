'use client';

import { useAdminMonitoring } from '@/hooks/useAdminMonitoring';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icons } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';

export default function MonitoringPage() {
    const { isBackingUp, backupStatus, handleTriggerBackup } = useAdminMonitoring();

    return (
        <div className="space-y-16 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Health Overview */}
            <div>
                <h2 className="text-2xl font-black uppercase tracking-tight mb-2">Infrastructure Health</h2>
                <p className="text-sm text-foreground-muted mb-8">Real-time status of critical system services.</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <HealthBar label="Gemini 2.5 API" value={99.9} status="99.9%" />
                    <HealthBar label="Firestore Latency" value={85} status="24ms" />
                    <HealthBar label="Cloud Storage" value={100} status="Operational" />
                </div>
            </div>

            {/* Infrastructure Operations */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card variant="glass" className="p-8 rounded-[2.5rem] border-border/50 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                        <Icons.database className="w-24 h-24" />
                    </div>

                    <h3 className="text-xl font-black uppercase tracking-tight mb-2">Data Integrity</h3>
                    <p className="text-sm text-foreground-muted mb-8">Manually snapshot the entire database, user documents, and image metadata.</p>

                    <div className="bg-background-secondary/50 border border-border/30 rounded-2xl p-6 mb-8 space-y-3">
                        <div className="flex justify-between text-xs font-black uppercase tracking-widest text-foreground-muted">
                            <span>Last Backup</span>
                            <span className="text-foreground">Feb 08, 14:22 UTC</span>
                        </div>
                        <div className="flex justify-between text-xs font-black uppercase tracking-widest text-foreground-muted">
                            <span>Retention Policy</span>
                            <span className="text-foreground">30 Days</span>
                        </div>
                    </div>

                    <Button
                        onClick={handleTriggerBackup}
                        disabled={isBackingUp}
                        size="lg"
                        className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs gap-3 shadow-xl shadow-primary/20"
                        isLoading={isBackingUp}
                    >
                        {!isBackingUp && <span className="text-xl">📦</span>}
                        Trigger Cloud Backup
                    </Button>

                    {backupStatus && (
                        <div className={cn(
                            "mt-6 p-4 rounded-xl border text-[10px] font-black uppercase tracking-widest flex items-center gap-3",
                            backupStatus.includes('Success')
                                ? "bg-success/5 border-success/20 text-success"
                                : "bg-primary/5 border-primary/20 text-primary"
                        )}>
                            <div className={cn("w-1.5 h-1.5 rounded-full", backupStatus.includes('Success') ? "bg-success" : "bg-primary")} />
                            {backupStatus}
                        </div>
                    )}
                </Card>

                <Card variant="glass" className="p-8 rounded-[2.5rem] border-border/50 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                        <Icons.error className="w-24 h-24" />
                    </div>

                    <h3 className="text-xl font-black uppercase tracking-tight mb-2 text-error">Critical Logs</h3>
                    <p className="text-sm text-foreground-muted mb-8">Recent generation blocks and system exceptions.</p>

                    <div className="space-y-4">
                        <LogItem
                            type="error"
                            title="Safety Block: OTHER"
                            message="User prompt triggered sensitive content filter."
                            time="14:32 UTC • NanoBanana"
                        />
                        <LogItem
                            type="info"
                            title="Rate Limit Hit"
                            message="Global concurrent generation capacity reached."
                            time="12:05 UTC • Model Distribution"
                        />
                    </div>
                </Card>
            </div>
        </div>
    );
}

function HealthBar({ label, value, status }: { label: string, value: number, status: string }) {
    return (
        <div className="space-y-3">
            <div className="flex justify-between items-end">
                <span className="text-[10px] font-black uppercase tracking-widest text-foreground-muted">{label}</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-success">{status}</span>
            </div>
            <div className="h-2.5 bg-background-secondary rounded-full overflow-hidden border border-border/30">
                <div
                    className="h-full bg-success shadow-[0_0_12px_rgba(34,197,94,0.3)]"
                    style={{ width: `${value}%` }}
                />
            </div>
        </div>
    );
}

function LogItem({ type, title, message, time }: { type: 'error' | 'info', title: string, message: string, time: string }) {
    return (
        <div className={cn(
            "p-5 rounded-2xl border flex items-start gap-4 transition-colors",
            type === 'error' ? "border-error/20 bg-error/5" : "border-border/50 bg-background-secondary/50 group hover:border-primary/20"
        )}>
            <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0",
                type === 'error' ? "bg-error/10 text-error" : "bg-primary/10 text-primary"
            )}>
                {type === 'error' ? '⚠️' : 'ℹ️'}
            </div>
            <div>
                <p className={cn("text-[10px] font-black uppercase tracking-widest mb-1", type === 'error' ? "text-error" : "text-primary")}>
                    {title}
                </p>
                <p className="text-sm font-medium leading-tight mb-2 pr-4">{message}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-foreground-muted opacity-40">{time}</p>
            </div>
        </div>
    );
}
