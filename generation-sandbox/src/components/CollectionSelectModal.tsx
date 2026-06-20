'use client';

import { Collection } from '@/lib/types';
import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Icons } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';

interface CollectionSelectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (collectionId: string) => void;
    collections: Collection[];
    isProcessing: boolean;
    title?: string;
}

export default function CollectionSelectModal({
    isOpen,
    onClose,
    onSelect,
    collections,
    isProcessing,
    title = "Add to Collection"
}: CollectionSelectModalProps) {
    const [searchQuery, setSearchQuery] = useState('');

    if (!isOpen) return null;

    const filteredCollections = collections.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-background/80 backdrop-blur-sm"
                onClick={onClose}
            />
            <Card className="relative w-full max-w-md p-6 shadow-2xl bg-background rounded-3xl border border-border animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold">{title}</h2>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="p-2 hover:bg-background-secondary rounded-lg transition-colors"
                    >
                        <Icons.close size={20} />
                    </Button>
                </div>

                <div className="relative mb-4">
                    <Input
                        placeholder="Search collections..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="text-sm"
                        icon={<Icons.search size={16} className="text-foreground-muted" />}
                    />
                </div>

                <div className="max-h-[300px] overflow-y-auto custom-scrollbar space-y-1 pr-1">
                    {filteredCollections.length === 0 ? (
                        <div className="text-center py-8 text-foreground-muted">
                            <p className="text-sm">No collections found.</p>
                        </div>
                    ) : (
                        filteredCollections.map(col => (
                            <button
                                key={col.id}
                                onClick={() => onSelect(col.id)}
                                disabled={isProcessing}
                                className="w-full text-left px-4 py-3 rounded-xl hover:bg-primary/10 hover:text-primary transition-all flex items-center justify-between group disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-background-secondary flex items-center justify-center group-hover:bg-primary/20">
                                        📁
                                    </div>
                                    <span className="font-medium">{col.name}</span>
                                </div>
                                <span className="text-xs text-foreground-muted bg-background-secondary px-2 py-0.5 rounded-full">
                                    {col.imageCount || 0}
                                </span>
                            </button>
                        ))
                    )}
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <Button
                        variant="secondary"
                        onClick={onClose}
                        className="text-sm px-4 py-2"
                    >
                        Cancel
                    </Button>
                </div>

                {isProcessing && (
                    <div className="absolute inset-0 bg-background/40 backdrop-blur-[1px] flex items-center justify-center rounded-2xl">
                        <Icons.spinner className="w-8 h-8 animate-spin text-primary" />
                    </div>
                )}
            </Card>
        </div>
    );
}
