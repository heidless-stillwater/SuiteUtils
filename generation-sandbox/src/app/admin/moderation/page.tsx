'use client';

import { useAdminModeration } from '@/hooks/useAdminModeration';
import { Icons } from '@/components/ui/Icons';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import Link from 'next/link';
import { ReportedEntryCard } from '../components/ReportedEntryCard';

export default function ModerationDashboard() {
    const {
        reportedEntries,
        reportedComments,
        loading,
        actioningId,
        handleAction,
        handleCommentAction
    } = useAdminModeration();

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
                <Icons.spinner className="w-10 h-10 animate-spin text-primary" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground-muted">Scanning Moderation Queue</p>
            </div>
        );
    }

    return (
        <div className="space-y-16 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Reported Entries Section */}
            <div className="space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black uppercase tracking-tight">Reported Entries</h2>
                        <p className="text-sm text-foreground-muted">Review flagged league entries and maintain community guidelines.</p>
                    </div>
                </div>

                {reportedEntries.length === 0 ? (
                    <Card variant="glass" className="rounded-[2.5rem] p-20 text-center border-dashed border-2 bg-background-secondary/20">
                        <div className="text-6xl mb-6">✅</div>
                        <h3 className="text-2xl font-black uppercase tracking-tight mb-2">Queue Clear</h3>
                        <p className="text-sm text-foreground-muted font-medium">There are no reported league entries to review right now.</p>
                    </Card>
                ) : (
                    <div className="grid gap-8">
                        {reportedEntries.map((entry) => (
                            <ReportedEntryCard
                                key={entry.id}
                                entry={entry}
                                isActioning={actioningId === entry.id}
                                onAction={(action) => handleAction(entry.id, action)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Reported Comments Section */}
            <div className="space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black uppercase tracking-tight">Reported Comments</h2>
                        <p className="text-sm text-foreground-muted">Manage flagged user comments and maintain a healthy community environment.</p>
                    </div>
                </div>

                {reportedComments.length === 0 ? (
                    <Card variant="glass" className="rounded-[2.5rem] p-16 text-center border-dashed border-2 opacity-70 bg-background-secondary/10">
                        <div className="text-4xl mb-4 opacity-50">✨</div>
                        <h3 className="text-xl font-black uppercase tracking-tight mb-1 text-foreground">No Reported Comments</h3>
                    </Card>
                ) : (
                    <div className="space-y-6">
                        {reportedComments.map((comment) => (
                            <Card key={comment.id} variant="glass" className="p-8 flex flex-col md:flex-row gap-8 border-l-4 border-l-error bg-error/5 rounded-3xl group">
                                <div className="flex-1 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] font-black uppercase tracking-widest bg-error text-white px-3 py-1 rounded-full shadow-lg shadow-error/20">
                                                {comment.reportCount} Reports
                                            </span>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-foreground-muted opacity-40">
                                                ID: {comment.id}
                                            </span>
                                        </div>
                                        <Link href={`/league?entry=${comment.entryId}`} target="_blank" className="text-[10px] font-black tracking-widest uppercase text-primary hover:underline">
                                            View Context ↗
                                        </Link>
                                    </div>
                                    <div className="p-6 bg-background/50 rounded-2xl border border-border/30 italic group-hover:border-error/20 transition-colors">
                                        <p className="text-lg font-medium text-foreground/90">&quot;{comment.text}&quot;</p>
                                    </div>
                                    <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-foreground-muted opacity-60">
                                        <span className="bg-background-secondary px-2 py-0.5 rounded">User: {comment.userId}</span>
                                        <span className="opacity-20">•</span>
                                        <span>{comment.createdAt?.seconds ? new Date(comment.createdAt.seconds * 1000).toLocaleString() : 'Unknown date'}</span>
                                    </div>
                                </div>
                                <div className="flex flex-col justify-center gap-3 min-w-[180px]">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => handleCommentAction(comment, 'dismiss')}
                                        disabled={actioningId === comment.id}
                                        className="h-10 text-[10px] font-black uppercase tracking-widest hover:bg-success/10 hover:text-success hover:border-success/30"
                                        isLoading={actioningId === comment.id}
                                    >
                                        Dismiss All
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={() => handleCommentAction(comment, 'delete')}
                                        disabled={actioningId === comment.id}
                                        className="h-10 text-[10px] font-black uppercase tracking-widest bg-error hover:bg-error-hover shadow-lg shadow-error/20"
                                        isLoading={actioningId === comment.id}
                                    >
                                        Delete Comment
                                    </Button>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
