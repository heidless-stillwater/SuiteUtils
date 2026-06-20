'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { CURATED_FONTS } from '@/lib/fonts';
import { FontOption } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Icons } from '@/components/ui/Icons';

interface TextOverlayEditorProps {
    imageUrl: string;
    onClose: () => void;
    onSave: (dataUrl: string) => void;
}

export default function TextOverlayEditor({ imageUrl, onClose, onSave }: TextOverlayEditorProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [text, setText] = useState('Your Text Here');
    const [selectedFont, setSelectedFont] = useState<FontOption>(CURATED_FONTS[0]);
    const [fontSize, setFontSize] = useState(48);
    const [textColor, setTextColor] = useState('#ffffff');
    const [textY, setTextY] = useState(0.8); // Percentage from top
    const [textX, setTextX] = useState(0.5); // Percentage from left
    const [isDragging, setIsDragging] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const imgRef = useRef<HTMLImageElement | null>(null);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        const img = imgRef.current;

        if (!canvas || !ctx || !img) return;

        // Set canvas size to match image
        canvas.width = img.width;
        canvas.height = img.height;

        // Clear and draw image
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        // Configure text
        ctx.fillStyle = textColor;
        ctx.font = `${fontSize}px "${selectedFont.family}"`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Add optional shadow for readability
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        // Calculate position
        const x = canvas.width * textX;
        const y = canvas.height * textY;

        // Draw text
        ctx.fillText(text, x, y);
    }, [text, selectedFont, fontSize, textColor, textX, textY]);

    // Initialize image
    useEffect(() => {
        setImageLoaded(false);
        const img = new Image();

        // Use proxy for remote URLs to bypass CORS issues in Canvas
        const targetUrl = imageUrl.startsWith('http')
            ? `/api/download?url=${encodeURIComponent(imageUrl)}`
            : imageUrl;

        img.crossOrigin = 'anonymous';
        img.src = targetUrl;

        img.onload = () => {
            imgRef.current = img;
            setImageLoaded(true);
            draw();
        };

        img.onerror = () => {
            console.error('[TextOverlayEditor] Failed to load image:', imageUrl);
            onClose(); // Close editor if image can't be loaded
            alert('Failed to load image for editing. This might be due to a connection issue or missing permissions.');
        };
    }, [imageUrl, draw, onClose]);

    useEffect(() => {
        if (imageLoaded) {
            draw();
        }
    }, [draw, imageLoaded]);

    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        setTextX(x / canvas.width);
        setTextY(y / canvas.height);
    };

    const handleExport = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const dataUrl = canvas.toDataURL('image/png');
        onSave(dataUrl);
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4">
            <style jsx global>{`
                ${CURATED_FONTS.map(f => `@import url('${f.googleFontsUrl}');`).join('\n')}
            `}</style>

            <div className="w-full max-w-6xl flex flex-col lg:flex-row gap-8 bg-background p-6 rounded-2xl border border-border">
                {/* Left: Canvas Area */}
                <div className="flex-1 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold">Text Overlay Editor</h2>
                        <p className="text-xs text-foreground-muted">Click image to reposition text</p>
                    </div>

                    <div className="relative aspect-auto bg-black rounded-lg overflow-hidden flex items-center justify-center cursor-crosshair border border-border/50">
                        {!imageLoaded && <Icons.spinner className="w-8 h-8 animate-spin text-primary" />}
                        <canvas
                            ref={canvasRef}
                            onClick={handleCanvasClick}
                            className="max-w-full max-h-[70vh] object-contain"
                        />
                    </div>
                </div>

                {/* Right: Controls */}
                <div className="w-full lg:w-80 flex flex-col gap-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1.5 text-foreground-muted uppercase tracking-wider">Your Message</label>
                            <textarea
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-background-secondary border border-border text-foreground transition-all duration-200 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 placeholder:text-foreground-muted min-h-[100px] resize-none"
                                placeholder="Enter text..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1.5 text-foreground-muted uppercase tracking-wider">Font Family</label>
                            <Select
                                value={selectedFont.family}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                                    const font = CURATED_FONTS.find(f => f.family === e.target.value);
                                    if (font) setSelectedFont(font);
                                }}
                            >
                                {CURATED_FONTS.map(font => (
                                    <option key={font.family} value={font.family} style={{ fontFamily: font.family }}>
                                        {font.family}
                                    </option>
                                ))}
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1.5 text-foreground-muted uppercase tracking-wider">Size</label>
                                <Input
                                    type="number"
                                    value={fontSize}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFontSize(Number(e.target.value))}
                                    min={10}
                                    max={500}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1.5 text-foreground-muted uppercase tracking-wider">Color</label>
                                <div className="flex gap-2">
                                    <input
                                        type="color"
                                        value={textColor}
                                        onChange={(e) => setTextColor(e.target.value)}
                                        className="h-[43px] w-full p-1 bg-background-secondary border border-border rounded-xl cursor-pointer"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-auto pt-6 border-t border-border flex flex-col gap-3">
                        <Button
                            onClick={handleExport}
                            className="w-full py-4 text-lg"
                        >
                            Apply & Download
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={onClose}
                            className="w-full"
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
