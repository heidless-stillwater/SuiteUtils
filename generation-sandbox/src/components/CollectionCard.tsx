'use client';

import { Collection } from '@/lib/types';
import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SmartImage from '@/components/SmartImage';
import { Card } from '@/components/ui/Card';
import { Icons } from '@/components/ui/Icons';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

interface CollectionCardProps {
    collection: Collection;
    onDelete?: (id: string) => void;
    onRename?: (id: string, newName: string) => void;
    onTogglePrivacy?: (id: string, currentPrivacy: 'public' | 'private') => void;
}

export default function CollectionCard({ collection, onDelete, onRename, onTogglePrivacy }: CollectionCardProps) {
    const router = useRouter();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState(collection.name);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleRenameSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (renameValue.trim() && renameValue !== collection.name) {
            onRename?.(collection.id, renameValue.trim());
        }
        setIsRenaming(false);
    };

    const handleDelete = () => {
        if (window.confirm('Are you sure you want to delete this collection? Images will stay in your gallery.')) {
            onDelete?.(collection.id);
        }
        setIsMenuOpen(false);
    };

    return (
        <Card variant="glass" className="group relative p-0 overflow-hidden border-border/50 hover:border-primary/50 transition-all duration-300 rounded-[2rem]">
            {/* Clickable Image Area */}
            <Link
                href={`/collections/${collection.id}`}
                className="block aspect-[4/3] bg-background-secondary relative overflow-hidden"
            >
                {collection.coverImageUrl ? (
                    <SmartImage
                        src={collection.coverImageUrl}
                        alt={collection.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-foreground-muted bg-background-secondary/50">
                        <Icons.stack className="w-12 h-12 opacity-20" />
                    </div>
                )}

                {/* Overlays */}
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                {/* Privacy Badge */}
                <div className="absolute top-4 left-4">
                    <Badge
                        variant={collection.privacy === 'public' ? 'success' : 'glass'}
                        className="gap-1.5 shadow-lg backdrop-blur-md"
                    >
                        {collection.privacy === 'public' ? <Icons.globe size={10} /> : <Icons.shield size={10} />}
                        {collection.privacy === 'public' ? 'Public' : 'Private'}
                    </Badge>
                </div>
            </Link>

            {/* Info Section */}
            <div className="p-6 relative">
                <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                        {isRenaming ? (
                            <form onSubmit={handleRenameSubmit} className="flex items-center gap-2">
                                <Input
                                    type="text"
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    autoFocus
                                    onBlur={() => setIsRenaming(false)}
                                    className="h-8 text-sm font-black px-2 py-1"
                                />
                            </form>
                        ) : (
                            <Link href={`/collections/${collection.id}`} className="block group/title">
                                <h3 className="text-base font-black tracking-tight truncate group-hover/title:text-primary transition-colors">
                                    {collection.name}
                                </h3>
                            </Link>
                        )}
                        <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-foreground-muted opacity-60">
                                {collection.imageCount || 0} Assets
                            </span>
                            <div className="w-1 h-1 rounded-full bg-border" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-primary/70">
                                Collection
                            </span>
                        </div>

                        {/* Tags Display */}
                        {collection.tags && collection.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-4">
                                {collection.tags.slice(0, 2).map(tag => (
                                    <button
                                        key={tag}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            router.push(`/gallery?tag=${tag}`);
                                        }}
                                        className="text-[9px] font-black uppercase px-2 py-1 rounded-lg bg-background-secondary border border-border/50 text-foreground-muted hover:border-primary/30 hover:text-primary transition-all"
                                    >
                                        #{tag}
                                    </button>
                                ))}
                                {collection.tags.length > 2 && (
                                    <span className="text-[9px] font-black uppercase px-2 py-1 rounded-lg bg-background-secondary text-foreground-muted opacity-40">
                                        +{collection.tags.length - 2}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Menu Button */}
                    <div className="relative" ref={menuRef}>
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsMenuOpen(!isMenuOpen);
                            }}
                            className="p-2 hover:bg-background-secondary rounded-xl text-foreground-muted hover:text-foreground transition-all border border-transparent hover:border-border"
                        >
                            <Icons.more size={18} />
                        </button>

                        {/* Dropdown Menu */}
                        {isMenuOpen && (
                            <div className="absolute right-0 top-full mt-2 w-48 bg-background-secondary border border-border/50 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right backdrop-blur-xl">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsRenaming(true);
                                        setIsMenuOpen(false);
                                    }}
                                    className="w-full text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-primary/5 hover:text-primary flex items-center gap-3 transition-colors"
                                >
                                    <Icons.settings size={14} /> Rename
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onTogglePrivacy?.(collection.id, collection.privacy);
                                        setIsMenuOpen(false);
                                    }}
                                    className="w-full text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-primary/5 hover:text-primary flex items-center gap-3 transition-colors"
                                >
                                    {collection.privacy === 'public' ? <Icons.shield size={14} /> : <Icons.globe size={14} />}
                                    {collection.privacy === 'public' ? 'Make Private' : 'Make Public'}
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        router.push(`/collections/${collection.id}`);
                                    }}
                                    className="w-full text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-primary/5 hover:text-primary flex items-center gap-3 transition-colors"
                                >
                                    <Icons.grid size={14} /> Manage Assets
                                </button>
                                <div className="h-px bg-border/50 mx-4" />
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete();
                                    }}
                                    className="w-full text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-error/5 text-error flex items-center gap-3 transition-colors"
                                >
                                    <Icons.delete size={14} /> Delete
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Card>
    );
}
