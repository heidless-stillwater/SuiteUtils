'use client';

import { useCollections } from '@/hooks/useCollections';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import CollectionCard from '@/components/CollectionCard';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Icons } from '@/components/ui/Icons';

function CollectionsContent() {
    const { user, loading: authLoading } = useAuth();
    const {
        collections,
        isLoading,
        isCreating,
        handleCreate,
        handleDelete,
        handleRename,
        handleTogglePrivacy
    } = useCollections();

    const searchParams = useSearchParams();
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const q = searchParams.get('q');
        if (q) setSearchQuery(q);
    }, [searchParams]);

    const filteredCollections = collections.filter(col => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return true;
        const nameMatch = col.name.toLowerCase().includes(query);
        const tagMatch = col.tags?.some(tag => tag.toLowerCase().includes(query));
        return nameMatch || tagMatch;
    });

    const triggerCreate = async () => {
        const name = window.prompt('Define your new collection:');
        if (name) await handleCreate(name);
    };

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Icons.spinner className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center bg-background selection:bg-primary/20">
                <div className="w-24 h-24 bg-primary/10 rounded-[2.5rem] flex items-center justify-center text-4xl mb-8 border border-primary/20">🔒</div>
                <h1 className="text-4xl font-black uppercase tracking-tight mb-4">Access Restricted</h1>
                <p className="text-foreground-muted mb-8 max-w-sm font-medium">Please sign in to manage your artistic collections and organize your generated assets.</p>
                <Link href="/">
                    <Button size="lg" className="px-12 h-14 rounded-2xl font-black uppercase tracking-widest text-xs">Sign In Required</Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background pb-32">
            <div className="max-w-7xl mx-auto px-6 py-12 space-y-12">
                {/* Header Section */}
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 border-b border-border/50 pb-12">
                    <div className="space-y-4">
                        <Link href="/dashboard" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-foreground-muted hover:text-primary transition-colors">
                            <Icons.arrowLeft size={12} /> Back to Hub
                        </Link>
                        <div>
                            <h1 className="text-5xl font-black uppercase tracking-[calc(-0.02em)]">My Collections</h1>
                            <p className="text-foreground-muted mt-2 font-medium">Curate, organize and manage your generated visual identity.</p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="relative w-full sm:w-80 group">
                            <Icons.search className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground-muted group-focus-within:text-primary transition-colors z-10" size={16} />
                            <Input
                                type="text"
                                placeholder="Search folders or tags..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-12 h-14 bg-background-secondary/50 border-border/50 rounded-2xl focus:ring-primary/20 shadow-inner"
                            />
                        </div>
                        <Button
                            onClick={triggerCreate}
                            disabled={isCreating}
                            size="lg"
                            className="w-full sm:w-auto px-8 h-14 rounded-2xl font-black uppercase tracking-widest text-xs gap-3 shadow-xl shadow-primary/20"
                            isLoading={isCreating}
                        >
                            {!isCreating && <Icons.plus size={18} />}
                            New Folder
                        </Button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                            <div key={i} className="aspect-[4/3] rounded-[2.5rem] bg-background-secondary/50 border border-border/30 animate-pulse" />
                        ))}
                    </div>
                ) : collections.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 bg-background-secondary/10 rounded-[3rem] border border-dashed border-border/50 text-center">
                        <div className="w-20 h-20 bg-background-secondary rounded-3xl flex items-center justify-center mb-8 text-4xl border border-border/50 shadow-inner">📁</div>
                        <h2 className="text-2xl font-black uppercase tracking-tight mb-2">No Collections Defined</h2>
                        <p className="text-foreground-muted mb-8 max-w-xs font-medium">Start your curation journey by creating your first folder to organize your generations.</p>
                        <Button variant="outline" onClick={triggerCreate} className="px-8 h-12 rounded-xl font-black uppercase tracking-widest text-[10px]">
                            Initialize Collection
                        </Button>
                    </div>
                ) : filteredCollections.length === 0 ? (
                    <Card variant="glass" className="text-center py-32 rounded-[3rem] border border-border/50">
                        <div className="text-6xl mb-6 opacity-20">🔍</div>
                        <h2 className="text-2xl font-black uppercase tracking-tight mb-2">Zero Matches Found</h2>
                        <p className="text-foreground-muted mb-10 font-medium">No collections align with your current search criteria.</p>
                        <Button
                            variant="ghost"
                            onClick={() => setSearchQuery('')}
                            className="text-primary font-black uppercase tracking-widest text-xs hover:bg-primary/5 px-8"
                        >
                            Reset Filter
                        </Button>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                        {filteredCollections.map(collection => (
                            <CollectionCard
                                key={collection.id}
                                collection={collection}
                                onDelete={handleDelete}
                                onRename={handleRename}
                                onTogglePrivacy={handleTogglePrivacy}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function CollectionsPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Icons.spinner className="w-8 h-8 animate-spin text-primary" />
            </div>
        }>
            <CollectionsContent />
        </Suspense>
    );
}
