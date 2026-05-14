'use client';

import { GeneratedImage } from '@/lib/types';
import { Icons } from '@/components/ui/Icons';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import ShareButtons from '@/components/ShareButtons';
import { cn } from '@/lib/utils';

import { useRouter } from 'next/navigation';

interface PreviewSectionProps {
    generating: boolean;
    generatedImages: GeneratedImage[];
    selectedImageIndex: number;
    setSelectedImageIndex: (idx: number) => void;
    editedImage: string | null;
    setEditedImage: (img: string | null) => void;
    modality: string;
    aspectRatio: string;
    generationProgress: { current: number; total: number; message: string } | null;
    onShowTextEditor: () => void;
    onDownload: (format: 'png' | 'jpeg' | 'mp4') => void;
    promptSetID?: string;
    onSaveVariation?: () => void;
    onDeleteImage?: (id: string) => void;
    onGenerate?: () => void;
    compiledPrompt: string;
    isNewImageSet?: boolean;
    setIsNewImageSet?: (val: boolean) => void;
    onSaveDraftPrompt?: () => Promise<void>;
    onSaveArchitecturalDraft?: () => void;
    onCancel?: () => void;
    availableCredits?: number;
    currentCost?: number;
}

export default function PreviewSection({
    generating,
    generatedImages,
    selectedImageIndex,
    setSelectedImageIndex,
    editedImage,
    setEditedImage,
    modality,
    aspectRatio,
    generationProgress,
    onShowTextEditor,
    onDownload,
    promptSetID,
    onSaveVariation,
    onDeleteImage,
    onGenerate,
    compiledPrompt,
    isNewImageSet,
    setIsNewImageSet,
    onSaveDraftPrompt,
    onSaveArchitecturalDraft,
    onCancel,
    availableCredits = 0,
    currentCost = 1
}: PreviewSectionProps) {
    const router = useRouter();
    const currentImg = generatedImages[selectedImageIndex];
    const isVideo = modality === 'video' || currentImg?.settings?.modality === 'video' || !!currentImg?.videoUrl;

    return (
        <div className="lg:sticky lg:top-24 lg:self-start space-y-6">
            {/* Compiled Prompt Display */}
            <div className="p-4 border border-primary/20 bg-primary/5 rounded-2xl relative overflow-hidden group/compiled backdrop-blur-sm">
                <div className="absolute top-0 right-0 p-2 opacity-10 group-hover/compiled:opacity-30 transition-opacity pointer-events-none">
                    <Icons.zap size={40} className="text-primary rotate-12" />
                </div>
                <div className="flex items-center gap-2 mb-3">
                    <div className="flex flex-col gap-1.5">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-primary">Compiled Prompt</h3>
                        <p className="text-[11px] font-mono leading-relaxed text-foreground-muted">
                            Gray text means that you are using the default value. <span className="text-blue-400 font-bold bg-blue-400/10 px-1 py-0.5 rounded border border-blue-400/20">Blue text</span> means is been changed.
                        </p>
                    </div>
                </div>
                <div className="relative">
                    <div className="text-[11px] font-mono leading-relaxed text-foreground-muted bg-background/50 rounded-xl p-3 border border-border/50 max-h-32 overflow-y-auto custom-scrollbar whitespace-pre-wrap">
                        {compiledPrompt ? compiledPrompt.split(/(__DEF__.*?__DEF__|__VAL__.*?__VAL__)/).map((s, i) => {
                            if (s.startsWith('__DEF__')) {
                                return <span key={i} className="text-foreground-muted italic opacity-50">{s.replace(/__DEF__/g, '')}</span>;
                            }
                            if (s.startsWith('__VAL__')) {
                                return <span key={i} className="text-primary font-black bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">{s.replace(/__VAL__/g, '')}</span>;
                            }
                            return s;
                        }) : <span className="opacity-40 italic">Define your vision to see the compiled output...</span>}
                    </div>
                </div>
            </div>

            <Card className="p-5 flex flex-col" variant="glass">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex flex-col gap-1">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-foreground-muted">Master Preview</h3>
                        <h4 className="text-sm font-black uppercase tracking-widest text-primary truncate max-w-[200px]">
                            {currentImg?.title || '<no title>'}
                        </h4>
                    </div>
                    <div className="flex items-center gap-2">
                        {generatedImages.length > 0 && !generating && (
                            <span className="text-[10px] font-black uppercase py-1 px-2 bg-background-secondary rounded-lg border border-border">
                                {selectedImageIndex + 1} of {generatedImages.length}
                            </span>
                        )}
                    </div>
                </div>

                <div
                    className="relative bg-background-secondary rounded-2xl overflow-hidden flex items-center justify-center border border-border shadow-inner group/preview transition-all duration-500"
                    style={{ aspectRatio: aspectRatio.replace(':', '/') }}
                >
                    {generating ? (
                        <div className="text-center w-full px-12 animate-in fade-in duration-700">
                            <div className="relative w-20 h-20 mx-auto mb-8">
                                <Icons.spinner size={80} className="text-primary animate-spin opacity-20" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Icons.zap size={32} className="text-primary fill-primary animate-pulse" />
                                </div>
                            </div>
                            <p className="font-black text-xl mb-3 tracking-tighter italic">
                                {generationProgress ? `Crystallizing Image ${generationProgress.current}...` : 'Brewing Magic...'}
                            </p>

                            <div className="w-full bg-background-secondary border border-border h-2 rounded-full overflow-hidden mb-4 shadow-sm">
                                <div
                                    className="h-full bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_100%] animate-shimmer transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(255,255,255,0.3)]"
                                    style={{ width: `${generationProgress ? (generationProgress.current / generationProgress.total) * 100 : 8}%` }}
                                />
                            </div>

                            <p className="text-[10px] uppercase font-black tracking-[0.2em] text-foreground-muted animate-pulse">
                                {generationProgress?.message || 'Contacting Neural Engines...'}
                            </p>
                        </div>
                    ) : generatedImages.length > 0 ? (
                        <>
                            {isVideo && (currentImg?.videoUrl || editedImage) ? (
                                <video
                                    src={editedImage || currentImg?.videoUrl}
                                    controls
                                    autoPlay
                                    loop
                                    className="w-full h-full object-contain"
                                />
                            ) : (
                                <img
                                    src={editedImage || currentImg?.imageUrl}
                                    alt="Generated Output"
                                    className="w-full h-full object-contain animate-in zoom-in-95 duration-500"
                                />
                            )}

                            {/* Hover Overlay Actions */}
                            {!generating && (
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/preview:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-4 backdrop-blur-[2px]">
                                    <Button variant="secondary" size="icon" onClick={() => onDownload('png')} className="w-12 h-12 rounded-full bg-black/50 hover:bg-black/70 border-white/20 text-white backdrop-blur-md">
                                        <Icons.download size={20} />
                                    </Button>
                                    <Button variant="secondary" size="icon" onClick={onShowTextEditor} className="w-12 h-12 rounded-full bg-black/50 hover:bg-black/70 border-white/20 text-white backdrop-blur-md">
                                        <Icons.settings size={20} />
                                    </Button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-center p-12 group-hover/preview:bg-primary/5 transition-all duration-500 rounded-2xl border border-dashed border-border/50">
                            <div className="w-24 h-24 rounded-full bg-background-secondary flex items-center justify-center mx-auto mb-6 border border-dashed border-border group-hover/preview:border-primary/50 group-hover/preview:scale-110 transition-all duration-500">
                                <Icons.image size={48} className="text-foreground-muted group-hover/preview:text-primary transition-colors" />
                            </div>
                            <p className="text-xs font-black uppercase tracking-[0.2em] text-foreground-muted mb-8 italic">
                                Your creations will manifest here
                            </p>

                            {onGenerate && (
                                <Button
                                    variant="primary"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        onGenerate?.();
                                    }}
                                    className="h-12 px-8 font-black uppercase tracking-[0.25em] text-[11px] gap-3 shadow-xl shadow-primary/20 hover:shadow-primary/40 group/btn transition-all duration-500"
                                >
                                    <Icons.zap size={16} className="group-hover/btn:animate-pulse" />
                                    Generate Variation
                                </Button>
                            )}
                        </div>
                    )}
                </div>
                
                {/* Detailed Action Panel */}
                <div className="p-5 border-t border-border/50 space-y-4">
                    <div className="flex items-center justify-between">
                        {setIsNewImageSet && (
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <div className={cn(
                                    "w-4 h-4 rounded-md border flex items-center justify-center transition-all",
                                    isNewImageSet ? "bg-primary border-primary shadow-[0_0_8px_rgba(var(--primary-rgb),0.4)]" : "bg-white/5 border-white/20 group-hover:border-primary/50"
                                )}>
                                    {isNewImageSet && <Icons.sparkles size={10} className="text-white" />}
                                </div>
                                <input 
                                    type="checkbox" 
                                    checked={isNewImageSet} 
                                    onChange={e => setIsNewImageSet(e.target.checked)} 
                                    className="hidden" 
                                />
                                <span className="text-[10px] font-black uppercase tracking-widest text-foreground-muted group-hover:text-foreground transition-colors">
                                    Start New Image Set 
                                    <span className="text-foreground/20 lowercase tracking-normal font-medium ml-1">(breaks lineage)</span>
                                </span>
                            </label>
                        )}

                        {isNewImageSet && onSaveDraftPrompt && (
                            <button
                                onClick={onSaveDraftPrompt}
                                className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-primary hover:text-foreground px-2.5 py-1.5 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-lg transition-all animate-in fade-in zoom-in-95 duration-300"
                            >
                                <Icons.database size={10} />
                                Save New Set
                            </button>
                        )}
                    </div>

                    <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
                        {/* New Generation Button Location */}
                        <Button
                            onClick={onGenerate}
                            disabled={generating || availableCredits < currentCost}
                            variant="primary"
                            className="w-full h-16 text-lg font-black uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(var(--primary-rgb),0.2)] group relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer" />
                            {generating ? (
                                <div className="flex items-center justify-center gap-3">
                                    <Icons.spinner className="w-6 h-6 animate-spin" />
                                    <span>{modality === 'video' ? 'Synthesizing...' : 'Generating...'}</span>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center gap-3">
                                    <span>Generate Variation</span>
                                    <span className="flex items-center gap-1 px-2 py-0.5 bg-white/20 rounded text-[10px] ml-2">
                                        {currentCost} <Icons.zap size={10} />
                                    </span>
                                </div>
                            )}
                        </Button>

                        {generating && onCancel && (
                            <Button
                                onClick={onCancel}
                                variant="outline"
                                className="w-full h-12 text-xs font-black uppercase tracking-[0.2em] border-error/20 text-error hover:bg-error/10 hover:border-error/40 transition-all animate-in slide-in-from-top-2 duration-300"
                            >
                                <Icons.close size={14} className="mr-2" />
                                Cancel Generation
                            </Button>
                        )}

                        {generatedImages.length > 0 && !generating && (
                            <>
                                {modality === 'image' && (
                                    <Button
                                        variant="secondary"
                                        onClick={onShowTextEditor}
                                        className="w-full h-12 font-black uppercase tracking-widest gap-3 shadow-lg shadow-primary/20"
                                    >
                                        <Icons.settings size={18} />
                                        {editedImage ? 'Refine Text Layers' : 'Enrich with Text'}
                                    </Button>
                                )}

                                <div className="grid grid-cols-2 gap-3">
                                    <Button
                                        variant="secondary"
                                        onClick={() => onDownload('png')}
                                        className="h-11 font-black uppercase tracking-widest text-[10px]"
                                    >
                                        <Icons.download size={14} className="mr-2" />
                                        PNG
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        onClick={() => onDownload(modality === 'video' ? 'mp4' : 'jpeg')}
                                        className="h-11 font-black uppercase tracking-widest text-[10px]"
                                    >
                                        <Icons.download size={14} className="mr-2" />
                                        {modality === 'video' ? 'MP4' : 'JPEG'}
                                    </Button>
                                </div>
                                
                                <Button
                                    onClick={onSaveArchitecturalDraft}
                                    disabled={generating || !compiledPrompt.trim()}
                                    variant="ghost"
                                    className="w-full h-11 text-[10px] font-black uppercase tracking-[0.1em] border-none bg-background-secondary/50 hover:bg-background-secondary transition-colors"
                                >
                                    <Icons.database size={14} className="mr-2 opacity-70" />
                                    Save Architectural Draft
                                </Button>
                            </>
                        )}

                        {promptSetID && (
                            <Button
                                variant="ghost"
                                onClick={() => router.push(`/gallery?set=${promptSetID}`)}
                                className="w-full h-11 font-black uppercase tracking-widest text-[10px] text-primary hover:bg-primary/5 gap-2 border border-primary/20"
                            >
                                <Icons.image size={14} />
                                View This Set in Gallery
                            </Button>
                        )}

                        {editedImage && (
                            <div className="space-y-2 pt-2">
                                <Button
                                    variant="primary"
                                    onClick={onSaveVariation}
                                    className="w-full h-11 font-black uppercase tracking-widest text-[10px] gap-2 bg-green-500/20 text-green-400 hover:bg-green-500 hover:text-white border border-green-500/50"
                                >
                                    <Icons.database size={14} />
                                    Save Variation to Registry
                                </Button>
                                <button
                                    onClick={() => setEditedImage(null)}
                                    className="w-full text-[10px] font-black uppercase tracking-widest text-foreground-muted hover:text-primary transition-colors py-2"
                                >
                                    Reset to Pure Generation
                                </button>
                            </div>
                        )}

                        <div className="pt-6 mt-4 border-t border-border/50">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-[10px] font-black uppercase tracking-widest text-foreground-muted">Broadcast Creation</span>
                                <div className="h-px flex-1 bg-border/30 ml-4" />
                            </div>
                            <div className="flex justify-center">
                                <ShareButtons
                                    imageUrl={editedImage || currentImg?.videoUrl || currentImg?.imageUrl || ''}
                                    prompt={currentImg?.prompt || ''}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
}
