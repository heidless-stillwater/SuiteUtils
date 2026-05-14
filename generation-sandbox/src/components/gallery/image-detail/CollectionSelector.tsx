import { useState } from 'react';
import { Collection } from '@/lib/types';
import { Icons } from '@/components/ui/Icons';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

interface CollectionSelectorProps {
    collections: Collection[];
    selectedIds: string[];
    onToggle: (collectionId: string) => void;
    onCreate?: (name: string) => void;
}

export default function CollectionSelector({ collections, selectedIds, onToggle, onCreate }: CollectionSelectorProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [newCollectionName, setNewCollectionName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const selectedCollections = collections.filter(c => selectedIds.includes(c.id));

    const handleCreate = async () => {
        if (!newCollectionName.trim() || !onCreate) return;
        setIsCreating(true);
        try {
            await onCreate(newCollectionName.trim());
            setNewCollectionName('');
        } catch (error) {
            console.error('[CollectionSelector] Create error:', error);
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
                <label className="text-[10px] text-foreground-muted uppercase tracking-[0.2em] font-black block">Collections</label>
                <button
                    onClick={() => setIsEditing(!isEditing)}
                    className={cn(
                        "text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 px-2 py-1 rounded-md",
                        isEditing
                            ? "bg-primary/10 text-primary border border-primary/20"
                            : "text-foreground-muted hover:text-primary hover:bg-primary/5"
                    )}
                >
                    {isEditing ? 'Close' : 'Manage'}
                    <Icons.settings size={10} className={cn(isEditing && "rotate-90", "transition-transform")} />
                </button>
            </div>

            {!isEditing ? (
                <div className="flex flex-wrap gap-1.5 min-h-[24px]">
                    {selectedCollections.length > 0 ? (
                        selectedCollections.map(col => (
                            <Badge key={col.id} variant="secondary" className="text-[10px] py-0 px-2 h-5 bg-primary/10 text-primary border-primary/20 font-bold">
                                {col.name}
                            </Badge>
                        ))
                    ) : (
                        <p className="text-[11px] text-foreground-muted italic px-1 opacity-60">Not in any collection</p>
                    )}
                </div>
            ) : (
                <div className="bg-background border border-border rounded-xl p-3 shadow-xl space-y-2 max-h-64 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-1 duration-200">
                    {onCreate && (
                        <div className="space-y-2 mb-3">
                            <label className="text-[9px] font-black uppercase tracking-widest text-primary/70 px-1">Create New</label>
                            <div className="flex items-center gap-2 p-1 bg-background/50 rounded-lg border border-border/50 focus-within:border-primary/40 transition-colors">
                                <input
                                    type="text"
                                    value={newCollectionName}
                                    onChange={(e) => setNewCollectionName(e.target.value)}
                                    placeholder="New collection name..."
                                    className="bg-transparent border-none text-foreground rounded-lg px-2 py-1 text-xs flex-1 outline-none placeholder:text-foreground-muted/50"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleCreate();
                                        }
                                    }}
                                    autoFocus
                                />
                                <button
                                    onClick={handleCreate}
                                    disabled={isCreating || !newCollectionName.trim()}
                                    className="p-1.5 hover:bg-primary/20 text-primary disabled:opacity-30 transition-all rounded-md"
                                    title="Create Collection"
                                >
                                    {isCreating ? <Icons.spinner className="w-4 h-4 animate-spin" /> : <Icons.plus className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="space-y-1">
                        {onCreate && collections.length > 0 && (
                            <label className="text-[9px] font-black uppercase tracking-widest text-foreground-muted px-1 block mb-1">Your Collections</label>
                        )}
                        {collections.map(col => {
                            const isSelected = selectedIds.includes(col.id);
                            return (
                                <label
                                    key={col.id}
                                    className={cn(
                                        "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all border group/item",
                                        isSelected
                                            ? 'bg-primary/10 border-primary/20 shadow-sm'
                                            : 'hover:bg-background border-transparent'
                                    )}
                                >
                                    <div className={cn(
                                        "w-4 h-4 rounded border flex items-center justify-center transition-all",
                                        isSelected
                                            ? 'bg-primary border-primary text-white shadow-[0_0_10px_rgba(99,102,241,0.4)]'
                                            : 'border-border bg-background group-hover/item:border-primary/50'
                                    )}>
                                        {isSelected && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>}
                                    </div>
                                    <span className={cn(
                                        "text-xs truncate flex-1 font-medium",
                                        isSelected ? "text-foreground font-bold" : "text-foreground/70"
                                    )}>{col.name}</span>
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={isSelected}
                                        onChange={() => onToggle(col.id)}
                                    />
                                </label>
                            );
                        })}
                        {collections.length === 0 && (
                            <div className="text-[11px] text-foreground-muted italic text-center py-4 bg-background/20 rounded-lg border border-dashed border-border/50">
                                {onCreate ? "No collections yet. Create your first one above!" : "No collections available."}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

