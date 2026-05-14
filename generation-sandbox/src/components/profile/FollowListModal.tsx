'use client';

import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card } from '@/components/ui/Card';
import { Icons } from '@/components/ui/Icons';
import { Button } from '@/components/ui/Button';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

interface FollowListModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    type: 'followers' | 'following';
    title: string;
}

interface FollowUser {
    uid: string;
    displayName: string;
    photoURL: string | null;
    followedAt: any;
}

export default function FollowListModal({
    isOpen,
    onClose,
    userId,
    type,
    title
}: FollowListModalProps) {
    const [users, setUsers] = useState<FollowUser[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isOpen || !userId) return;

        async function fetchUsers() {
            try {
                setLoading(true);
                const colRef = collection(db, 'users', userId, type);
                const q = query(colRef, orderBy('followedAt', 'desc'), limit(50));
                const snapshot = await getDocs(q);

                const fetched = snapshot.docs.map(doc => ({
                    ...doc.data()
                } as FollowUser));

                setUsers(fetched);
            } catch (error) {
                console.error(`[FollowListModal] Error fetching ${type}:`, error);
            } finally {
                setLoading(false);
            }
        }

        fetchUsers();
    }, [isOpen, userId, type]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-background/80 backdrop-blur-md"
                onClick={onClose}
            />

            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="w-full max-w-md relative z-10"
            >
                <Card variant="glass" className="p-0 rounded-[2.5rem] overflow-hidden shadow-2xl border-primary/20">
                    <div className="p-6 border-b border-border flex items-center justify-between bg-primary/5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                <Icons.user className="text-primary" size={20} />
                            </div>
                            <h3 className="font-black tracking-tight text-xl">{title}</h3>
                        </div>
                        <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-background-secondary rounded-full">
                            <Icons.close size={20} />
                        </Button>
                    </div>

                    <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                        {loading ? (
                            <div className="py-20 flex flex-col items-center justify-center gap-4">
                                <Icons.spinner className="w-8 h-8 animate-spin text-primary" />
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground-muted">Retrieving List</p>
                            </div>
                        ) : users.length === 0 ? (
                            <div className="py-20 text-center">
                                <p className="text-4xl mb-4 opacity-20">👥</p>
                                <p className="text-sm text-foreground-muted font-medium italic">No users found in this list</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border/50">
                                {users.map((user) => (
                                    <Link
                                        key={user.uid}
                                        href={`/profile/${user.uid}`}
                                        onClick={onClose}
                                        className="flex items-center gap-4 p-4 hover:bg-primary/5 transition-colors group"
                                    >
                                        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-border group-hover:border-primary/50 transition-colors shadow-sm">
                                            {user.photoURL && user.photoURL !== 'null' ? (
                                                <img src={user.photoURL} alt={user.displayName || 'User'} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full bg-background-tertiary flex items-center justify-center font-bold text-primary">
                                                    {(user.displayName || 'A').charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-foreground group-hover:text-primary transition-colors truncate">
                                                {user.displayName}
                                            </p>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-foreground-muted/60 mt-0.5">
                                                Joined Community
                                            </p>
                                        </div>
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Icons.arrowRight size={16} className="text-primary" />
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="p-4 bg-background-secondary/50 border-t border-border">
                        <Button variant="secondary" onClick={onClose} className="w-full font-black uppercase tracking-widest text-[10px] h-10">
                            Close
                        </Button>
                    </div>
                </Card>
            </motion.div>
        </div>
    );
}
