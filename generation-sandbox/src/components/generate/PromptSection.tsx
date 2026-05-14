'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/ui/Icons';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/utils';
import Tooltip from '@/components/Tooltip';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';

type PromptMode = 'freeform' | 'customize';

interface PromptSectionProps {
    promptMode: PromptMode;
    setPromptMode: (mode: PromptMode) => void;
    prompt: string;
    setPrompt: (prompt: string) => void;
    title: string;
    setTitle: (title: string) => void;
    // Customize mode props
    selectedBlueprint: any;
    setSelectedBlueprint: (bp: any) => void;
    variables: Record<string, { value: string, default: string }>;
    setVariables: (vars: Record<string, { value: string, default: string }>) => void;
    rawTemplate: string;
    setRawTemplate: (t: string) => void;
    onSaveBlueprint: () => void;
    isSavingBlueprint: boolean;
    handleEnhancePrompt: () => void;
    enhancing: boolean;
    isCasual: boolean;
    referenceImage: { url: string } | null;
    loadingReference: boolean;
    onRemoveReference: () => void;
    onUploadReference: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onOpenGalleryPicker: () => void;
    onOpenPromptPicker: () => void;
    onGalleryRequest: () => void;
    hasUnsavedChanges?: boolean;
    isVisionEditEnabled: boolean;
    setIsVisionEditEnabled: (val: boolean) => void;
    hasStudioAccess?: boolean;
}

export default function PromptSection({
    promptMode,
    setPromptMode,
    prompt,
    setPrompt,
    title,
    setTitle,
    selectedBlueprint,
    setSelectedBlueprint,
    variables,
    setVariables,
    rawTemplate,
    setRawTemplate,
    onSaveBlueprint,
    isSavingBlueprint,
    handleEnhancePrompt,
    enhancing,
    isCasual,
    referenceImage,
    loadingReference,
    onRemoveReference,
    onUploadReference,
    onOpenGalleryPicker,
    onOpenPromptPicker,
    onGalleryRequest,
    hasUnsavedChanges,
    isVisionEditEnabled,
    setIsVisionEditEnabled,
    hasStudioAccess
}: PromptSectionProps) {
    return (
        <div className="space-y-6">
            <Card className="relative overflow-visible p-5 border-border shadow-sm transition-all duration-500" variant="glass">
                {/* Initial sparkle effect on entrance */}
                <motion.div
                    className="absolute -inset-[1px] rounded-[2rem] border-2 border-primary/50 pointer-events-none z-20"
                    initial={{ opacity: 1, scale: 1 }}
                    animate={{ opacity: 0, scale: 1.05 }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                />

                {/* Reference Image Preview */}
                {(loadingReference || referenceImage) && (
                    <div className="mb-6 p-3 bg-primary/5 border border-primary/20 rounded-xl flex items-center gap-4 relative animate-in slide-in-from-top-2 duration-300">
                        {loadingReference ? (
                            <div className="flex items-center gap-3 w-full">
                                <div className="w-12 h-12 rounded-lg bg-background-secondary flex items-center justify-center animate-pulse">
                                    <Icons.spinner size={16} className="animate-spin text-primary" />
                                </div>
                                <div className="text-xs font-bold text-foreground-muted animate-pulse">Analyzing reference...</div>
                            </div>
                        ) : (
                            <>
                                <div className="w-16 h-16 rounded-lg overflow-hidden border border-primary/20 shadow-md relative">
                                    <img src={referenceImage!.url} alt="Reference" className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Icons.history size={12} className="text-primary" />
                                        <span className="text-[10px] font-black text-primary uppercase tracking-wider">Variation mode active</span>
                                    </div>
                                    <p className="text-[10px] text-foreground-muted italic leading-tight">
                                        Using previous generation as visual reference
                                    </p>
                                </div>
                                <button
                                    onClick={onRemoveReference}
                                    className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-red-500/10 hover:text-red-500 transition-colors text-foreground-muted"
                                >
                                    <Icons.close size={14} />
                                </button>
                            </>
                        )}
                    </div>
                )}



                <CustomizeSection
                    selectedBlueprint={selectedBlueprint}
                    setSelectedBlueprint={setSelectedBlueprint}
                    variables={variables}
                    setVariables={setVariables}
                    rawTemplate={rawTemplate}
                    setRawTemplate={setRawTemplate}
                    onSaveBlueprint={onSaveBlueprint}
                    isSavingBlueprint={isSavingBlueprint}
                    title={title}
                    setTitle={setTitle}
                    handleEnhancePrompt={handleEnhancePrompt}
                    enhancing={enhancing}
                    onUploadReference={onUploadReference}
                    onOpenGalleryPicker={onOpenGalleryPicker}
                    onOpenPromptPicker={onOpenPromptPicker}
                    hasUnsavedChanges={hasUnsavedChanges}
                    isVisionEditEnabled={isVisionEditEnabled}
                    setIsVisionEditEnabled={setIsVisionEditEnabled}
                    hasStudioAccess={hasStudioAccess}
                />
            </Card>
        </div>
    );
}

function CustomizeSection({
    selectedBlueprint,
    setSelectedBlueprint,
    variables,
    setVariables,
    rawTemplate,
    setRawTemplate,
    onSaveBlueprint,
    isSavingBlueprint,
    title,
    setTitle,
    handleEnhancePrompt,
    enhancing,
    onUploadReference,
    onOpenGalleryPicker,
    onOpenPromptPicker,
    onGalleryRequest,
    isVisionEditEnabled,
    setIsVisionEditEnabled,
    hasStudioAccess
}: any) {
    const [blueprints, setBlueprints] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (!hasStudioAccess) return;
        
        const fetchBlueprints = async () => {
            const user = auth.currentUser;
            if (!user) {
                console.log('No user found for blueprint fetch');
                return;
            }

            setLoading(true);
            try {
                // Hardened: Filter by UID to comply with ownership-based rules
                const q = query(collection(db, 'blueprints'), where('uid', '==', user.uid));
                const snap = await getDocs(q);
                const bps = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setBlueprints(bps);
            } catch (err) {
                console.error('Failed to fetch blueprints:', err);
            } finally {
                setLoading(false);
            }
        };
        
        // Use auth state listener if currentUser is not yet available
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) {
                fetchBlueprints();
            }
        });

        return () => unsubscribe();
    }, [hasStudioAccess]);

    const handleSelect = (bp: any) => {
        setSelectedBlueprint(bp);
        setRawTemplate(bp.prompts?.[0] || bp.template || '');
    };

    const filteredBlueprints = blueprints.filter(bp => 
        (bp.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (bp.description || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleGalleryClick = (e: React.MouseEvent) => {
        onGalleryRequest();
    };

    const renderHighlightedTemplate = (text: string) => {
        if (!text) return null;
        
        // Regex for {{variable}} syntax
        const parts = text.split(/(\{\{.*?\}\})/g);
        return parts.map((part, i) => {
            if (part.startsWith('{{') && part.endsWith('}}')) {
                return (
                    <span 
                        key={i} 
                        className="text-white font-black bg-primary/40 px-1.5 py-0.5 rounded border border-primary/50 shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)]"
                    >
                        {part}
                    </span>
                );
            }
            return part;
        });
    };

    const highlightRef = React.useRef<HTMLDivElement>(null);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    const innerHighlightRef = React.useRef<HTMLDivElement>(null);

    const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
        if (innerHighlightRef.current) {
            // transform is more reliable than scrollTop on overflow:hidden divs
            innerHighlightRef.current.style.transform = `translateY(-${e.currentTarget.scrollTop}px) translateX(-${e.currentTarget.scrollLeft}px)`;
        }
    };

    return (
        <div className="space-y-6">
            <div className="space-y-4">
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground-muted ml-1">Creation Name</label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Enter a title for this creation (optional)..."
                        className="w-full bg-background-secondary border border-border rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-foreground-muted/50"
                    />
                </div>

                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-4">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground-muted ml-1">Your Vision (Template)</label>
                        
                        <div className="flex items-center gap-2">
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={handleGalleryClick}
                                className="h-7 px-3 bg-primary/10 border-primary/20 text-primary hover:bg-primary/20 transition-all font-black text-[9px] uppercase tracking-widest flex items-center gap-2"
                            >
                                <Icons.grid size={12} />
                                <span className="hidden sm:inline">Gallery</span>
                            </Button>
                            
                            <div className="w-px h-4 bg-border/50 mx-1" />

                            <input
                                type="file"
                                id="ref-upload-customize"
                                className="hidden"
                                accept="image/*"
                                onChange={onUploadReference}
                            />
                            <Tooltip content="Upload Reference">
                                <Button
                                    variant="secondary"
                                    size="icon"
                                    className="h-7 w-7 bg-background-secondary border-border/50 hover:border-primary/50 text-foreground-muted hover:text-primary transition-all"
                                    onClick={() => document.getElementById('ref-upload-customize')?.click()}
                                >
                                    <Icons.upload size={12} />
                                </Button>
                            </Tooltip>

                            <Tooltip content="Set Reference Image">
                                <Button
                                    variant="secondary"
                                    size="icon"
                                    className="h-7 w-7 bg-background-secondary border-border/50 hover:border-primary/50 text-foreground-muted hover:text-primary transition-all"
                                    onClick={onOpenGalleryPicker}
                                >
                                    <Icons.image size={12} />
                                </Button>
                            </Tooltip>

                            <Tooltip content="Import Prompt from Gallery">
                                <Button
                                    variant="secondary"
                                    size="icon"
                                    className="h-7 w-7 bg-background-secondary border-border/50 hover:border-primary/50 text-foreground-muted hover:text-primary transition-all"
                                    onClick={onOpenPromptPicker}
                                >
                                    <Icons.text size={12} />
                                </Button>
                            </Tooltip>

                            <div className="w-px h-4 bg-border/50 mx-1" />

                            <Tooltip content={isVisionEditEnabled ? "Lock Architecture" : "Unlock Architecture"}>
                                <Button
                                    variant="secondary"
                                    size="icon"
                                    className={cn(
                                        "h-7 w-7 transition-all border-none ring-1 flex items-center justify-center rounded-lg",
                                        isVisionEditEnabled 
                                            ? "bg-red-500/10 text-red-500 ring-red-500/30 hover:bg-red-500/20" 
                                            : "bg-green-500/10 text-green-500 ring-green-500/30 hover:bg-green-500/20"
                                    )}
                                    onClick={() => setIsVisionEditEnabled(!isVisionEditEnabled)}
                                >
                                    {isVisionEditEnabled ? <Icons.unlock size={12} /> : <Icons.lock size={12} />}
                                </Button>
                            </Tooltip>
                        </div>
                    </div>

                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleEnhancePrompt}
                        disabled={enhancing || !rawTemplate.trim()}
                        className="h-8 px-3 text-[9px] font-black uppercase tracking-widest bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/20 hover:from-purple-500/20 hover:to-pink-500/20 text-purple-600 transition-all"
                    >
                        {enhancing ? <Icons.spinner size={12} className="mr-2 animate-spin" /> : <Icons.wand size={12} className="mr-2" />}
                        Enhance Template
                    </Button>
                </div>

                <div className="relative group/vision">
                    {/* Highlight Layer — all text transparent, only variable BACKGROUNDS are visible */}
                {/* These colored backgrounds shine through the textarea's transparent background */}
                    <div 
                        ref={highlightRef}
                        className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl border border-transparent"
                        aria-hidden="true"
                    >
                        {/* Inner div moves via transform to sync with textarea scroll */}
                        <div ref={innerHighlightRef} className="pt-4 px-5 pb-10 text-sm leading-relaxed font-mono whitespace-pre-wrap break-words will-change-transform">
                            {rawTemplate ? rawTemplate.split(/({{.*?}})/g).map((part: string, i: number) => {
                                if (part.startsWith('{{') && part.endsWith('}}')) {
                                    const varKey = part.replace(/[{}]/g, '').trim().split(':')[0];
                                    const varData = variables[varKey];
                                    const isModified = varData && varData.value && varData.value !== varData.default && varData.default !== '<undefined>';
                                    if (isModified) {
                                        // Blue — variable filled in by user
                                        return <span key={i} className="text-blue-400">{part}</span>;
                                    }
                                    // Primary tint — unfilled placeholder (NO italic — italic skews character advance widths)
                                    return <span key={i} className="text-primary/60">{part}</span>;
                                }
                                return <span key={i} className="text-[#d1d5db]">{part}</span>;
                            }) : null}
                        </div>
                    </div>
                    
                    {/* Dark background sits behind the overlay */}
                    <div className="absolute inset-0 bg-[#0d0d0d] rounded-xl border border-border -z-10" />

                    <textarea
                        ref={textareaRef}
                        value={rawTemplate}
                        onChange={(e) => setRawTemplate(e.target.value)}
                        onScroll={handleScroll}
                        placeholder="Define your prompt architecture here using {{variable}} syntax..."
                        className={cn(
                            "vision-textarea w-full rounded-xl bg-transparent border border-border transition-all duration-200 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 min-h-[256px] resize-y pt-4 px-5 pb-12 text-sm leading-relaxed font-mono shadow-inner relative z-10 text-transparent caret-[#d1d5db]",
                            !isVisionEditEnabled && "cursor-not-allowed"
                        )}
                        spellCheck={false}
                        readOnly={!isVisionEditEnabled}
                    />
                    
                    <div className="absolute bottom-3 right-3 text-[10px] font-black px-2 py-0.5 rounded-full bg-background/80 border border-border text-foreground-muted z-20 backdrop-blur-sm">
                        {rawTemplate.length} / 2000
                    </div>
                </div>

                {Object.keys(variables).length > 0 && (
                    <div className="grid grid-cols-1 gap-4 p-4 bg-primary/5 rounded-2xl border border-primary/10">
                        {Object.keys(variables).map((key) => (
                            <div key={key} className="space-y-1.5 focus-within:transform focus-within:translate-x-1 transition-all">
                                <div className="flex justify-between items-center px-1">
                                    <label className="text-[10px] font-black text-primary uppercase flex items-center gap-2 tracking-widest opacity-60">
                                        <Icons.zap size={10} className="text-primary/50" />
                                        {key.replace(/_/g, ' ')}
                                    </label>
                                    <div className="flex items-center gap-4">
                                        {variables[key].value && variables[key].value !== variables[key].default && (
                                            <button 
                                                onClick={() => {
                                                    const val = variables[key].value;
                                                    const regex = new RegExp(`{{\\s*${key}\\s*(?::.*?)?\\s*}}`, 'g');
                                                    setRawTemplate(rawTemplate.replace(regex, `{{${key}:${val}}}`));
                                                }}
                                                className="text-[9px] font-black text-primary hover:text-white transition-colors uppercase tracking-widest"
                                            >
                                                [ Set as Default ]
                                            </button>
                                        )}
                                        {variables[key].value && variables[key].default && variables[key].default !== '<undefined>' && (
                                            <button 
                                                onClick={() => setVariables({ ...variables, [key]: { ...variables[key], value: variables[key].default } })} 
                                                className="text-[9px] font-black text-foreground-muted hover:text-primary transition-colors uppercase tracking-widest"
                                            >
                                                [ Use Default ]
                                            </button>
                                        )}
                                        {variables[key].value && (
                                            <button 
                                                onClick={() => setVariables({ ...variables, [key]: { ...variables[key], value: '' } })} 
                                                className="text-[9px] font-black text-foreground-muted hover:text-red-400 transition-colors uppercase tracking-widest"
                                            >
                                                [ Clear ]
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <input
                                    type="text"
                                    value={variables[key].value}
                                    onChange={(e) => setVariables({
                                        ...variables,
                                        [key]: { ...variables[key], value: e.target.value }
                                    })}
                                    placeholder={variables[key].default !== '<undefined>' ? `Override: ${variables[key].default}...` : `Insert ${key} context...`}
                                    className="w-full bg-background border border-border rounded-xl px-5 py-4 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-foreground-muted/40 shadow-inner"
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {!selectedBlueprint ? (
                <div className="space-y-4 pt-4 border-t border-border/50">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground-muted ml-1">Architectural Library</label>
                    </div>
                    <div className="relative">
                        <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
                        <input
                            type="text"
                            placeholder="Search blueprints..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-background-secondary border border-border rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {loading ? (
                            <div className="py-12 flex flex-col items-center justify-center gap-3">
                                <Icons.spinner className="w-6 h-6 animate-spin text-primary" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-foreground-muted">Hydrating Library...</p>
                            </div>
                        ) : (
                            filteredBlueprints.map((bp) => (
                                <button
                                    key={bp.id}
                                    onClick={() => handleSelect(bp)}
                                    className="p-4 rounded-2xl bg-background-secondary hover:bg-background border border-transparent hover:border-primary/30 transition-all text-left flex items-center gap-4 group"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                        <Icons.grid className="w-6 h-6 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors truncate">{bp.title}</h4>
                                        <p className="text-[10px] text-foreground-muted truncate uppercase tracking-tight">{bp.description || 'Architectural Blueprint'}</p>
                                    </div>
                                    <Icons.chevronRight className="w-4 h-4 text-foreground-muted group-hover:translate-x-1 transition-transform" />
                                </button>
                            ))
                        )}
                    </div>
                </div>
            ) : (
                <div className="space-y-6 pt-4 border-t border-border/50">
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => setSelectedBlueprint(null)}
                            className="flex items-center gap-2 text-[10px] font-black text-foreground-muted hover:text-primary uppercase tracking-widest transition-colors"
                        >
                            <Icons.arrowLeft size={14} />
                            Change Blueprint
                        </button>
                        <span className="text-[10px] font-black text-primary uppercase tracking-widest px-2 py-0.5 bg-primary/10 rounded-full">
                            {selectedBlueprint.title}
                        </span>
                    </div>

                    <div className="pt-4 border-t border-border/50">
                        <Button
                            variant="secondary"
                            size="sm"
                            className="w-full h-10 text-[10px] font-black uppercase tracking-widest bg-background-secondary hover:bg-background border-border/50 shadow-sm"
                            onClick={onSaveBlueprint}
                            disabled={isSavingBlueprint}
                        >
                            {isSavingBlueprint ? <Icons.spinner className="w-4 h-4 animate-spin mr-2" /> : <Icons.database className="w-4 h-4 mr-2" />}
                            Save Architectural Changes
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
