'use client';

import React, { useRef, useState } from 'react';
import { useImageEditor, PRESET_FILTERS, Adjustments } from '@/hooks/image-editor/useImageEditor';
import { Button } from '@/components/ui/Button';

interface ImageEditorProps {
    imageUrl: string;
    imageId: string;
    onClose: () => void;
    onSave: (dataUrl: string, saveAsNew: boolean) => void;
}

type EditorTool = 'none' | 'crop' | 'adjust' | 'filter';

export default function ImageEditor({ imageUrl, imageId, onClose, onSave }: ImageEditorProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [saving, setSaving] = useState(false);

    const {
        loading, error,
        activeTool, setActiveTool,
        adjustments, setAdjustments,
        rotation,
        flipH, flipV,
        activeFilter,
        cropRegion, setCropRegion,
        isCropping,
        history,
        originalDimensions,
        hasChanges,
        handleAdjustmentChange,
        applyFilter,
        rotateRight, rotateLeft,
        toggleFlipH, toggleFlipV,
        applyCrop,
        undo,
        resetAll,
        pushHistory,
        handleCropMouseDown,
        handleCropMouseMove,
        handleCropMouseUp: onCropMouseUpHook
    } = useImageEditor(imageUrl, canvasRef);

    // Wrapper for mouse up to handle clearing crop start
    const handleCropMouseUp = () => {
        onCropMouseUpHook();
    };

    const handleSave = async (saveAsNew: boolean) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        setSaving(true);
        try {
            // Re-render without crop overlay
            const prevTool = activeTool;
            setActiveTool('none');

            // Wait for re-render to clear overlays
            await new Promise(resolve => setTimeout(resolve, 100));

            const dataUrl = canvas.toDataURL('image/png', 1.0);
            onSave(dataUrl, saveAsNew);

            // Restore tool if needed, though usually we close or navigate away
            if (prevTool) setActiveTool(prevTool);
        } catch (err) {
            console.error('Failed to export image:', err);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 z-[70] bg-black flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <p className="text-white/60 font-medium animate-pulse">Loading editor...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="fixed inset-0 z-[70] bg-black flex items-center justify-center">
                <div className="text-center space-y-4">
                    <div className="text-6xl">❌</div>
                    <p className="text-white/80">{error}</p>
                    <Button onClick={onClose} className="px-6 py-2">Close</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[70] bg-black flex flex-col">
            {/* Header Toolbar */}
            <header className="h-14 bg-[#1a1a2e] border-b border-white/10 flex items-center justify-between px-4 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onClose}
                        className="text-white/70 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
                        title="Close Editor"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    <div className="h-6 w-px bg-white/20" />
                    <h2 className="text-white font-bold text-sm tracking-wide">✏️ Image Editor</h2>
                </div>

                <div className="flex items-center gap-2">
                    {/* Undo */}
                    <button
                        onClick={undo}
                        disabled={history.length === 0}
                        className="text-white/70 hover:text-white disabled:text-white/20 transition-colors p-2 rounded-lg hover:bg-white/10 disabled:hover:bg-transparent"
                        title="Undo"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                    </button>
                    {/* Reset */}
                    <button
                        onClick={resetAll}
                        disabled={!hasChanges}
                        className="text-white/70 hover:text-white disabled:text-white/20 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/10 disabled:hover:bg-transparent text-xs font-bold"
                    >
                        Reset
                    </button>

                    <div className="h-6 w-px bg-white/20" />

                    {/* Save buttons */}
                    <button
                        onClick={() => handleSave(true)}
                        disabled={saving || !hasChanges}
                        className="bg-white/10 hover:bg-white/20 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-30"
                    >
                        {saving ? 'Saving...' : 'Save as Copy'}
                    </button>
                    <button
                        onClick={() => handleSave(false)}
                        disabled={saving || !hasChanges}
                        className="bg-primary hover:bg-primary-hover text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-lg shadow-primary/30 disabled:opacity-30"
                    >
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </header>

            {/* Main Editor Area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Tool Panel */}
                <aside className="w-16 bg-[#1a1a2e] border-r border-white/10 flex flex-col items-center py-4 gap-1 flex-shrink-0">
                    {[
                        { tool: 'crop' as EditorTool, icon: '✂️', label: 'Crop' },
                        { tool: 'adjust' as EditorTool, icon: '🎨', label: 'Adjust' },
                        { tool: 'filter' as EditorTool, icon: '✨', label: 'Filters' },
                    ].map(({ tool, icon, label }) => (
                        <button
                            key={tool}
                            onClick={() => setActiveTool(activeTool === tool ? 'none' : tool)}
                            className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all ${activeTool === tool
                                ? 'bg-primary text-white shadow-lg shadow-primary/30'
                                : 'text-white/60 hover:text-white hover:bg-white/10'
                                }`}
                            title={label}
                        >
                            <span className="text-lg">{icon}</span>
                            <span className="text-[9px] font-bold uppercase tracking-tight">{label}</span>
                        </button>
                    ))}

                    <div className="w-8 h-px bg-white/10 my-2" />

                    {/* Transform Tools */}
                    <button onClick={rotateLeft} className="w-10 h-10 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center" title="Rotate Left">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    </button>
                    <button onClick={rotateRight} className="w-10 h-10 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center" title="Rotate Right">
                        <svg className="w-5 h-5 scale-x-[-1]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    </button>
                    <button onClick={toggleFlipH} className={`w-10 h-10 rounded-lg transition-all flex items-center justify-center ${flipH ? 'bg-primary/30 text-primary' : 'text-white/60 hover:text-white hover:bg-white/10'}`} title="Flip Horizontal">
                        <span className="text-sm font-bold">↔</span>
                    </button>
                    <button onClick={toggleFlipV} className={`w-10 h-10 rounded-lg transition-all flex items-center justify-center ${flipV ? 'bg-primary/30 text-primary' : 'text-white/60 hover:text-white hover:bg-white/10'}`} title="Flip Vertical">
                        <span className="text-sm font-bold">↕</span>
                    </button>
                </aside>

                {/* Canvas Area */}
                <div className="flex-1 flex items-center justify-center bg-[#0d0d1a] p-8 overflow-hidden relative">
                    <canvas
                        ref={canvasRef}
                        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                        style={{ cursor: activeTool === 'crop' ? 'crosshair' : 'default' }}
                        onMouseDown={handleCropMouseDown}
                        onMouseMove={handleCropMouseMove}
                        onMouseUp={handleCropMouseUp}
                        onMouseLeave={handleCropMouseUp}
                    />

                    {/* Crop Apply Button */}
                    {activeTool === 'crop' && cropRegion && cropRegion.width > 5 && cropRegion.height > 5 && !isCropping && (
                        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-3">
                            <button
                                onClick={() => { setCropRegion(null); }}
                                className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-sm font-bold backdrop-blur-sm transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={applyCrop}
                                className="bg-primary hover:bg-primary-hover text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-primary/30 transition-all"
                            >
                                Apply Crop ✓
                            </button>
                        </div>
                    )}
                </div>

                {/* Right Sidebar - Contextual Panel */}
                {activeTool !== 'none' && (
                    <aside className="w-72 bg-[#1a1a2e] border-l border-white/10 overflow-y-auto flex-shrink-0">
                        {/* Crop Panel */}
                        {activeTool === 'crop' && (
                            <div className="p-4 space-y-4">
                                <h3 className="text-white font-bold text-sm flex items-center gap-2">
                                    <span>✂️</span> Crop
                                </h3>
                                <p className="text-white/50 text-xs">
                                    Click and drag on the image to select the area you want to keep.
                                </p>
                                {cropRegion && cropRegion.width > 5 && (
                                    <div className="bg-white/5 rounded-xl p-3 space-y-2">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-white/50">Size</span>
                                            <span className="text-white font-mono">{Math.round(cropRegion.width)} × {Math.round(cropRegion.height)}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Adjustments Panel */}
                        {activeTool === 'adjust' && (
                            <div className="p-4 space-y-5">
                                <h3 className="text-white font-bold text-sm flex items-center gap-2">
                                    <span>🎨</span> Adjustments
                                </h3>

                                {([
                                    { key: 'brightness' as keyof Adjustments, label: 'Brightness', icon: '☀️' },
                                    { key: 'contrast' as keyof Adjustments, label: 'Contrast', icon: '◐' },
                                    { key: 'saturation' as keyof Adjustments, label: 'Saturation', icon: '🎨' },
                                ]).map(({ key, label, icon }) => (
                                    <div key={key} className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-white/70 text-xs font-medium flex items-center gap-1.5">
                                                <span>{icon}</span> {label}
                                            </label>
                                            <span className="text-white/50 text-xs font-mono w-10 text-right">
                                                {adjustments[key] > 0 ? '+' : ''}{adjustments[key]}
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min="-100"
                                            max="100"
                                            value={adjustments[key]}
                                            onChange={(e) => handleAdjustmentChange(key, parseInt(e.target.value))}
                                            className="w-full accent-primary h-1.5 rounded-full appearance-none bg-white/10 cursor-pointer"
                                        />
                                    </div>
                                ))}

                                <button
                                    onClick={() => {
                                        pushHistory();
                                        setAdjustments({ brightness: 0, contrast: 0, saturation: 0 });
                                    }}
                                    className="w-full text-xs text-white/50 hover:text-white py-2 transition-colors"
                                >
                                    Reset Adjustments
                                </button>
                            </div>
                        )}

                        {/* Filters Panel */}
                        {activeTool === 'filter' && (
                            <div className="p-4 space-y-4">
                                <h3 className="text-white font-bold text-sm flex items-center gap-2">
                                    <span>✨</span> Filters
                                </h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {PRESET_FILTERS.map((filter) => (
                                        <button
                                            key={filter.name}
                                            onClick={() => applyFilter(filter)}
                                            className={`p-3 rounded-xl transition-all text-center ${activeFilter === filter.name
                                                ? 'bg-primary/20 border-2 border-primary text-white ring-2 ring-primary/30'
                                                : 'bg-white/5 border-2 border-transparent text-white/70 hover:text-white hover:bg-white/10'
                                                }`}
                                        >
                                            <span className="text-xl block mb-1">{filter.icon}</span>
                                            <span className="text-[10px] font-bold uppercase tracking-wide">{filter.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </aside>
                )}
            </div>

            {/* Status Bar */}
            <footer className="h-8 bg-[#1a1a2e] border-t border-white/10 flex items-center justify-between px-4 flex-shrink-0">
                <div className="flex items-center gap-4 text-[10px] text-white/40 font-mono">
                    {originalDimensions && (
                        <>
                            <span>{originalDimensions.width} × {originalDimensions.height}px</span>
                            {rotation !== 0 && <span>Rotated {rotation}°</span>}
                            {flipH && <span>Flipped H</span>}
                            {flipV && <span>Flipped V</span>}
                        </>
                    )}
                </div>
                <div className="text-[10px] text-white/30">
                    {hasChanges ? '● Unsaved changes' : 'No changes'}
                </div>
            </footer>
        </div>
    );
}
