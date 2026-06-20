'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icons } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';

interface BulkTagModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (tags: string[]) => void;
    isProcessing: boolean;
    selectedPrompts?: string[];
}

export default function BulkTagModal({
    isOpen,
    onClose,
    onApply,
    isProcessing,
    selectedPrompts = []
}: BulkTagModalProps) {
    const { user } = useAuth();
    const [tagInput, setTagInput] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);

    // Fetch AI suggestions when modal opens
    useEffect(() => {
        if (isOpen && selectedPrompts.length > 0 && user) {
            const fetchSuggestions = async () => {
                setLoadingSuggestions(true);
                try {
                    const token = await user.getIdToken();
                    const response = await fetch('/api/ai/suggest-tags', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ prompts: selectedPrompts.slice(0, 5) }) // Limit to 5 prompts for speed/cost
                    });
                    const data = await response.json();
                    if (data.success && data.tags) {
                        setSuggestions(data.tags);
                    }
                } catch (err) {
                    console.error('Failed to fetch suggestions:', err);
                } finally {
                    setLoadingSuggestions(false);
                }
            };
            fetchSuggestions();
        } else if (!isOpen) {
            // Reset state when closing
            setTags([]);
            setTagInput('');
            setSuggestions([]);
        }
    }, [isOpen, selectedPrompts, user]);

    if (!isOpen) return null;

    const handleAddTag = (tag?: string) => {
        const value = tag || tagInput;
        const trimmed = value.trim().toLowerCase().replace(/^#/, '');
        if (trimmed && !tags.includes(trimmed)) {
            setTags([...tags, trimmed]);
            if (!tag) setTagInput('');

            // Remove from suggestions if it was there
            setSuggestions(prev => prev.filter(s => s.toLowerCase() !== trimmed));
        }
    };

    const handleRemoveTag = (tagToRemove: string) => {
        setTags(tags.filter(t => t !== tagToRemove));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddTag();
        }
    };

    const handleSubmit = () => {
        if (tags.length > 0) {
            onApply(tags);
        }
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-background/80 backdrop-blur-sm"
                onClick={onClose}
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="w-full max-w-md"
            >
                <Card variant="glass" className="relative p-6 shadow-2xl border-primary/20 overflow-hidden">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <Icons.wand size={20} className="text-primary" />
                            </div>
                            <h2 className="text-xl font-bold">Bulk Tag Images</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-background-secondary rounded-lg transition-colors"
                        >
                            <Icons.close size={20} />
                        </button>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-widest text-foreground-muted ml-1">Current Tags</label>
                            <div className="flex flex-wrap gap-2 min-h-[44px] p-2 bg-background-secondary/50 rounded-xl border border-border">
                                <AnimatePresence>
                                    {tags.map(tag => (
                                        <motion.span
                                            key={tag}
                                            initial={{ opacity: 0, scale: 0.8 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.8 }}
                                            className="inline-flex items-center gap-1 px-3 py-1 bg-primary text-white text-[10px] font-bold rounded-full border border-primary/20 shadow-lg shadow-primary/10"
                                        >
                                            #{tag}
                                            <button onClick={() => handleRemoveTag(tag)} className="hover:text-red-200 transition-colors">
                                                <Icons.close size={10} />
                                            </button>
                                        </motion.span>
                                    ))}
                                </AnimatePresence>
                                {tags.length === 0 && (
                                    <span className="text-xs text-foreground-muted italic py-1.5 px-2">Click suggestions or type below...</span>
                                )}
                            </div>
                        </div>

                        {/* AI Suggestions Section */}
                        {(loadingSuggestions || suggestions.length > 0) && (
                            <div className="space-y-3 p-4 bg-purple-500/5 rounded-2xl border border-purple-500/10">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Icons.sparkles size={12} className="text-purple-500 animate-pulse" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-purple-600">AI Suggested Tags</span>
                                    </div>
                                    {loadingSuggestions && <Icons.spinner size={10} className="animate-spin text-purple-400" />}
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {loadingSuggestions ? (
                                        Array.from({ length: 4 }).map((_, i) => (
                                            <div key={i} className="h-6 w-16 bg-purple-200/20 rounded-full animate-pulse" />
                                        ))
                                    ) : (
                                        suggestions.map(suggestion => (
                                            <button
                                                key={suggestion}
                                                onClick={() => handleAddTag(suggestion)}
                                                className="px-3 py-1 bg-background border border-purple-500/20 text-[10px] font-bold rounded-full text-purple-600 hover:bg-purple-500 hover:text-white transition-all transform hover:scale-105 active:scale-95 shadow-sm"
                                            >
                                                + {suggestion}
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-foreground-muted ml-1">Add Custom Tag</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Type and press Enter..."
                                    value={tagInput}
                                    onChange={(e) => setTagInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    className="w-full pl-4 pr-12 py-3 bg-background-secondary border border-border rounded-xl outline-none focus:ring-4 focus:ring-primary/10 text-sm transition-all shadow-inner"
                                    autoFocus
                                />
                                <button
                                    onClick={() => handleAddTag()}
                                    disabled={!tagInput.trim()}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-primary hover:text-primary-hover disabled:opacity-50 transition-colors"
                                >
                                    <Icons.plus size={20} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 flex gap-3">
                        <Button
                            variant="secondary"
                            onClick={onClose}
                            className="flex-1 text-xs font-black uppercase tracking-widest h-11"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handleSubmit}
                            disabled={tags.length === 0 || isProcessing}
                            className="flex-1 text-xs font-black uppercase tracking-widest h-11 shadow-lg shadow-primary/20"
                        >
                            {isProcessing ? (
                                <div className="flex items-center gap-2">
                                    <Icons.spinner size={14} className="animate-spin" />
                                    Applying...
                                </div>
                            ) : (
                                `Tag ${tags.length} labels`
                            )}
                        </Button>
                    </div>

                    {isProcessing && (
                        <div className="absolute inset-0 bg-background/40 backdrop-blur-[1px] flex items-center justify-center z-50">
                            <Icons.spinner className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    )}
                </Card>
            </motion.div>
        </div>
    );
}
