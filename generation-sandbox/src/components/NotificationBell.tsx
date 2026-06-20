'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, writeBatch, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { Notification } from '@/lib/types';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import UserAvatar from '@/components/UserAvatar';
import { useToast } from '@/components/Toast';

export default function NotificationBell() {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const { showToast } = useToast();
    const isFirstLoad = useRef(true);
    // Track seen notification IDs to detect genuinely new ones for toasts
    const seenIds = useRef<Set<string>>(new Set());
    // Cache of actor profile photos fetched from Firestore
    const [actorPhotos, setActorPhotos] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!user) return;

        const notifRef = collection(db, 'users', user.uid, 'notifications');
        const q = query(notifRef, orderBy('createdAt', 'desc'), limit(20));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetched = snapshot.docs.map(d => ({
                id: d.id,
                ...d.data()
            } as Notification));

            // Show toasts for genuinely new unread notifications
            if (!isFirstLoad.current) {
                fetched
                    .filter(n => !n.read && !seenIds.current.has(n.id))
                    .forEach(n => {
                        const message =
                            n.type === 'vote' ? `❤️ ${n.actorName} upvoted your creation!` :
                                n.type === 'comment' ? `💬 ${n.actorName} commented on your work` :
                                    n.type === 'follow' ? `👤 ${n.actorName} started following you` :
                                        n.type === 'reaction' ? `${n.emoji || '🎉'} ${n.actorName} reacted to your work` :
                                            n.type === 'mention' ? `🏷️ ${n.actorName} mentioned you!` :
                                                '🔔 New notification';
                        showToast(message, 'info');
                    });
            }

            // Update seen-id tracking
            fetched.forEach(n => seenIds.current.add(n.id));

            setNotifications(fetched);
            setUnreadCount(fetched.filter(n => !n.read).length);
            isFirstLoad.current = false;
        });

        return () => unsubscribe();
    }, [user, showToast]);

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

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const markAllAsRead = async () => {
        if (!user || unreadCount === 0) return;

        try {
            const batch = writeBatch(db);
            notifications.filter(n => !n.read).forEach(n => {
                const ref = doc(db, 'users', user.uid, 'notifications', n.id);
                batch.update(ref, { read: true });
            });
            await batch.commit();
        } catch (error) {
            console.error('[Notifications] Error marking all as read:', error);
        }
    };

    const handleNotifClick = async (notif: Notification) => {
        if (!user || notif.read) return;

        try {
            const ref = doc(db, 'users', user.uid, 'notifications', notif.id);
            await updateDoc(ref, { read: true });
        } catch (error) {
            console.error('[Notifications] Error marking as read:', error);
        }
    };

    const renderNotifText = (notif: Notification) => {
        switch (notif.type) {
            case 'vote':
                return (
                    <span>
                        <span className="font-bold text-foreground">{notif.actorName}</span> upvoted your creation
                    </span>
                );
            case 'comment':
                return (
                    <span>
                        <span className="font-bold text-foreground">{notif.actorName}</span> commented:
                        <span className="text-foreground-muted block truncate mt-1 italic">&quot;{notif.text}&quot;</span>
                    </span>
                );
            case 'follow':
                return (
                    <span>
                        <span className="font-bold text-foreground">{notif.actorName}</span> started following you
                    </span>
                );
            case 'reaction':
                return (
                    <span>
                        <span className="font-bold text-foreground">{notif.actorName}</span> reacted {(notif as any).emoji || '🎉'} to your work
                    </span>
                );
            case 'mention':
                return (
                    <span>
                        <span className="font-bold text-foreground">{notif.actorName}</span> mentioned you in a comment:
                        <span className="text-foreground-muted block truncate mt-1 italic">&quot;{notif.text}&quot;</span>
                    </span>
                );
            case 'system':
                return <span>{notif.text}</span>;
            default:
                return <span>New interaction from {notif.actorName}</span>;
        }
    };

    const getLink = (notif: Notification) => {
        if (notif.type === 'follow') return `/profile/${notif.actorId}`;
        if (notif.entryId) return `/community?entry=${notif.entryId}`;
        return '/community';
    };

    const getTimeAgo = (timestamp: any) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

        if (seconds < 60) return 'just now';
        const mins = Math.floor(seconds / 60);
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        return date.toLocaleDateString();
    };

    if (!user) return null;

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-xl bg-background-secondary/50 border border-border hover:bg-background-tertiary transition-colors group"
            >
                <span className="text-xl group-hover:scale-110 transition-transform block">🔔</span>
                <AnimatePresence>
                    {unreadCount > 0 && (
                        <motion.span
                            key="badge"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-[10px] font-black text-white rounded-full flex items-center justify-center ring-4 ring-background"
                        >
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </motion.span>
                    )}
                </AnimatePresence>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.97 }}
                        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                        className="absolute right-0 mt-3 w-80 sm:w-96 z-50"
                    >
                        <Card className="rounded-2xl shadow-2xl overflow-hidden p-0 bg-zinc-950 border-zinc-800 ring-1 ring-white/10">
                            <div className="p-4 border-b border-border flex items-center justify-between bg-primary/5">
                                <h3 className="font-bold">Notifications</h3>
                                {unreadCount > 0 && (
                                    <button
                                        onClick={markAllAsRead}
                                        className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline"
                                    >
                                        Mark all as read
                                    </button>
                                )}
                            </div>

                            <div className="max-h-[70vh] overflow-y-auto custom-scrollbar">
                                {notifications.length === 0 ? (
                                    <div className="py-12 text-center text-foreground-muted">
                                        <div className="text-4xl mb-3 opacity-20">📭</div>
                                        <p className="text-sm">No notifications yet</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-border/50">
                                        {notifications.map((notif) => (
                                            <Link
                                                key={notif.id}
                                                href={getLink(notif)}
                                                onClick={() => {
                                                    handleNotifClick(notif);
                                                    setIsOpen(false);
                                                }}
                                                className={`flex items-start gap-4 p-4 transition-colors hover:bg-primary/5 group ${!notif.read ? 'bg-primary/5 border-l-4 border-primary' : ''}`}
                                            >
                                                <div className="relative flex-shrink-0">
                                                    <UserAvatar
                                                        src={actorPhotos[notif.actorId] || notif.actorPhotoURL || null}
                                                        name={notif.actorName}
                                                        size="md"
                                                        className="border border-border"
                                                    />
                                                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-background rounded-full flex items-center justify-center text-[10px] shadow-sm ring-2 ring-background">
                                                        {notif.type === 'vote' ? '❤️' :
                                                            notif.type === 'comment' ? '💬' :
                                                                notif.type === 'reaction' ? (notif.emoji || '🎉') :
                                                                    notif.type === 'mention' ? '🏷️' : '👤'}
                                                    </div>
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm leading-tight text-foreground-muted">
                                                        {renderNotifText(notif)}
                                                    </p>
                                                    <p className="text-[10px] font-bold text-foreground-muted/60 mt-1 uppercase tracking-tighter">
                                                        {getTimeAgo(notif.createdAt)}
                                                    </p>
                                                </div>

                                                {notif.entryImageUrl && (
                                                    <img src={notif.entryImageUrl} alt="Notification Entry" className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-border group-hover:scale-105 transition-transform" />
                                                )}
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <Link
                                href="/dashboard/notifications"
                                className="block py-3 text-center text-xs font-bold text-foreground-muted hover:text-primary transition-colors border-t border-border bg-background-secondary/50"
                                onClick={() => setIsOpen(false)}
                            >
                                View all activity
                            </Link>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
