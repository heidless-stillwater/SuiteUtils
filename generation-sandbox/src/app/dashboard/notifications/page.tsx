'use client';

import { useEffect, useState } from 'react';
import { collection, query, orderBy, getDocs, doc, writeBatch, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { Notification } from '@/lib/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icons } from '@/components/ui/Icons';
import UserAvatar from '@/components/UserAvatar';

export default function NotificationsPage() {
    const { user, profile, loading: authLoading } = useAuth();
    const router = useRouter();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [actorPhotos, setActorPhotos] = useState<Record<string, string>>({});

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            router.push('/generate');
            return;
        }

        async function fetchNotifications() {
            try {
                setLoading(true);
                const notifRef = collection(db, 'users', user!.uid, 'notifications');
                const q = query(notifRef, orderBy('createdAt', 'desc'));
                const snapshot = await getDocs(q);

                const fetched = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as Notification));

                setNotifications(fetched);
            } catch (error) {
                console.error('[Notifications] Error fetching:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchNotifications();
    }, [user, authLoading, router]);

    // Fetch current profile photos for all actors
    useEffect(() => {
        if (notifications.length === 0) return;
        const actorIds = notifications
            .filter(n => n.actorId && !actorPhotos[n.actorId])
            .map(n => n.actorId);
        const uniqueActors = Array.from(new Set(actorIds));
        if (uniqueActors.length === 0) return;

        Promise.all(
            uniqueActors.map(async (actorId) => {
                try {
                    const actorDoc = await getDoc(doc(db, 'users', actorId));
                    const data = actorDoc.data();
                    return { actorId, photoURL: data?.photoURL || null };
                } catch {
                    return { actorId, photoURL: null };
                }
            })
        ).then(results => {
            const newPhotos: Record<string, string> = {};
            results.forEach(r => {
                if (r.photoURL && r.photoURL !== 'null' && r.photoURL !== 'undefined') {
                    newPhotos[r.actorId] = r.photoURL;
                }
            });
            if (Object.keys(newPhotos).length > 0) {
                setActorPhotos(prev => ({ ...prev, ...newPhotos }));
            }
        });
    }, [notifications]);

    const markAllAsRead = async () => {
        if (!user || notifications.length === 0) return;

        try {
            const batch = writeBatch(db);
            let hasUnread = false;

            notifications.forEach(n => {
                if (!n.read) {
                    const ref = doc(db, 'users', user.uid, 'notifications', n.id);
                    batch.update(ref, { read: true });
                    hasUnread = true;
                }
            });

            if (hasUnread) {
                await batch.commit();
                setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            }
        } catch (error) {
            console.error('[Notifications] Error marking all as read:', error);
        }
    };

    const getTimeAgo = (timestamp: any) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

        if (seconds < 60) return 'Just now';
        const mins = Math.floor(seconds / 60);
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    };

    if (loading || authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Icons.spinner className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen pb-20">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="text-xl font-bold bg-brand-gradient bg-clip-text text-transparent">
                            Studio Dashboard
                        </Link>
                        <span className="text-border">/</span>
                        <h1 className="text-sm font-bold uppercase tracking-widest text-foreground-muted">Activity History</h1>
                    </div>

                    <Button variant="secondary" onClick={() => router.push('/dashboard')} className="text-sm px-4 py-2">
                        ← Back to Studio
                    </Button>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 py-12">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-3xl font-black">Community Activity</h2>
                        <p className="text-foreground-muted mt-1">See who&apos;s engaging with your creations</p>
                    </div>

                    {notifications.some(n => !n.read) && (
                        <Button
                            variant="secondary"
                            onClick={markAllAsRead}
                            className="text-xs px-4 py-2"
                        >
                            Mark all as read
                        </Button>
                    )}
                </div>

                {notifications.length === 0 ? (
                    <Card variant="glass" className="text-center py-24 rounded-3xl">
                        <div className="text-7xl mb-6">📬</div>
                        <h3 className="text-2xl font-bold mb-2">No activity yet</h3>
                        <p className="text-foreground-muted max-w-sm mx-auto">
                            When people upvote, comment, or follow you, you&apos;ll see those updates right here.
                        </p>
                        <div className="mt-8 flex justify-center">
                            <Button onClick={() => router.push('/league')}>
                                Explore the Community Hub
                            </Button>
                        </div>
                    </Card>
                ) : (
                    <Card variant="glass" className="rounded-3xl overflow-hidden shadow-xl border-border/50 p-0">
                        <div className="divide-y divide-border/50">
                            {notifications.map((notif) => (
                                <Link
                                    key={notif.id}
                                    href={notif.type === 'follow' ? `/profile/${notif.actorId}` : `/league?entryId=${notif.entryId}`}
                                    className={`flex items-center gap-6 p-6 transition-all hover:bg-primary/5 group ${!notif.read ? 'bg-primary/5 border-l-4 border-primary' : ''}`}
                                >
                                    {/* Actor Photo */}
                                    <div className="relative flex-shrink-0">
                                        <UserAvatar
                                            src={actorPhotos[notif.actorId] || notif.actorPhotoURL || null}
                                            name={notif.actorName}
                                            size="lg"
                                            className="border-2 border-border group-hover:border-primary/50 shadow-lg"
                                        />
                                        <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-background rounded-full flex items-center justify-center text-sm shadow-xl ring-4 ring-background">
                                            {notif.type === 'vote' ? '❤️' : notif.type === 'comment' ? '💬' : '👤'}
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-lg leading-snug">
                                            <span className="font-bold text-foreground group-hover:text-primary transition-colors">{notif.actorName}</span>
                                            {notif.type === 'vote' && <span className="text-foreground-muted"> upvoted your creation</span>}
                                            {notif.type === 'comment' && <span className="text-foreground-muted"> left a comment</span>}
                                            {notif.type === 'follow' && <span className="text-foreground-muted"> started following you</span>}
                                            {notif.type === 'mention' && <span className="text-foreground-muted"> mentioned you in a comment</span>}
                                            {notif.type === 'system' && <span className="text-foreground-muted"> sent a system update</span>}
                                        </p>

                                        {(notif.type === 'comment' || notif.type === 'mention') && notif.text && (
                                            <p className="mt-2 p-3 bg-background-secondary/50 rounded-xl text-sm italic border-l-4 border-primary/20 text-foreground-muted line-clamp-2">
                                                &quot;{notif.text}&quot;
                                            </p>
                                        )}

                                        {notif.type === 'system' && notif.text && (
                                            <p className="mt-2 p-3 bg-blue-500/5 rounded-xl text-sm border-l-4 border-blue-500/20 text-foreground-muted">
                                                {notif.text}
                                            </p>
                                        )}

                                        <p className="text-xs font-black uppercase tracking-widest text-foreground-muted/50 mt-2">
                                            {getTimeAgo(notif.createdAt)}
                                        </p>
                                    </div>

                                    {/* Entry Preview */}
                                    {notif.entryImageUrl && (
                                        <div className="hidden sm:block flex-shrink-0 relative group-hover:scale-105 transition-transform duration-300">
                                            <img src={notif.entryImageUrl} alt="Notification Content" className="w-20 h-20 rounded-2xl object-cover border-2 border-border shadow-lg" />
                                            <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
                                        </div>
                                    )}
                                </Link>
                            ))}
                        </div>
                    </Card>
                )}
            </main>
        </div>
    );
}
