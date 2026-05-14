import { useState, useRef, useEffect, useCallback } from 'react';

export interface Adjustments {
    brightness: number;
    contrast: number;
    saturation: number;
}

export interface CropRegion {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface FilterPreset {
    name: string;
    icon: string;
    adjustments: Adjustments;
    overlayColor?: string;
}

export const PRESET_FILTERS: FilterPreset[] = [
    { name: 'Original', icon: '🔄', adjustments: { brightness: 0, contrast: 0, saturation: 0 } },
    { name: 'Vivid', icon: '🌈', adjustments: { brightness: 5, contrast: 20, saturation: 40 } },
    { name: 'Warm', icon: '🌅', adjustments: { brightness: 10, contrast: 10, saturation: 15 }, overlayColor: 'rgba(255, 140, 50, 0.08)' },
    { name: 'Cool', icon: '❄️', adjustments: { brightness: 0, contrast: 10, saturation: -10 }, overlayColor: 'rgba(50, 100, 255, 0.08)' },
    { name: 'B&W', icon: '⚫', adjustments: { brightness: 5, contrast: 15, saturation: -100 } },
    { name: 'Vintage', icon: '📷', adjustments: { brightness: -5, contrast: -10, saturation: -30 }, overlayColor: 'rgba(180, 140, 80, 0.12)' },
    { name: 'Dramatic', icon: '🎭', adjustments: { brightness: -10, contrast: 40, saturation: 10 } },
    { name: 'Fade', icon: '🌫️', adjustments: { brightness: 15, contrast: -20, saturation: -15 } },
];

interface HistoryState {
    adjustments: Adjustments;
    rotation: number;
    flipH: boolean;
    flipV: boolean;
    filter: string;
}

export function useImageEditor(
    imageUrl: string,
    canvasRef: React.RefObject<HTMLCanvasElement>
) {
    // Refs
    const originalImageRef = useRef<HTMLImageElement | null>(null);
    const firstLoadImageRef = useRef<HTMLImageElement | null>(null);
    const bufferCanvasRef = useRef<HTMLCanvasElement | null>(null);

    // Basic State
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTool, setActiveTool] = useState<'none' | 'crop' | 'adjust' | 'filter'>('none');

    // Image Transforms State
    const [adjustments, setAdjustments] = useState<Adjustments>({ brightness: 0, contrast: 0, saturation: 0 });
    const [rotation, setRotation] = useState(0);
    const [flipH, setFlipH] = useState(false);
    const [flipV, setFlipV] = useState(false);
    const [activeFilter, setActiveFilter] = useState('Original');

    // Crop State
    const [cropRegion, setCropRegion] = useState<CropRegion | null>(null);
    const [isCropping, setIsCropping] = useState(false);
    const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null);
    const [appliedCrops, setAppliedCrops] = useState<ImageData[]>([]); // For undo logic if needed

    // History
    const [history, setHistory] = useState<HistoryState[]>([]);

    // Trigger redraw
    const [lastProcessedState, setLastProcessedState] = useState<string>('');

    // Load Image
    useEffect(() => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        // Use proxy to avoid CORS issues
        const proxyUrl = `/api/download?url=${encodeURIComponent(imageUrl)}`;
        img.src = proxyUrl;

        img.onload = () => {
            originalImageRef.current = img;
            if (!firstLoadImageRef.current) {
                firstLoadImageRef.current = img;
            }
            setLoading(false);
        };

        img.onerror = () => {
            setError('Failed to load image for editing');
            setLoading(false);
        };
    }, [imageUrl]);

    // Push explicitly to history
    const pushHistory = useCallback(() => {
        setHistory(prev => [...prev, {
            adjustments: { ...adjustments },
            rotation,
            flipH,
            flipV,
            filter: activeFilter
        }]);
    }, [adjustments, rotation, flipH, flipV, activeFilter]);

    // Core Processing Logic: Update the buffer canvas with transforms & pixel manipulation
    const updateBaseImage = useCallback(() => {
        const img = originalImageRef.current;
        if (!img) return;

        // Create or get buffer canvas
        if (!bufferCanvasRef.current) {
            bufferCanvasRef.current = document.createElement('canvas');
        }
        const buffer = bufferCanvasRef.current;
        const bctx = buffer.getContext('2d', { willReadFrequently: true });
        if (!bctx) return;

        // Calculate dimensions based on rotation
        const isRotated = rotation === 90 || rotation === 270;
        const srcW = img.width;
        const srcH = img.height;
        buffer.width = isRotated ? srcH : srcW;
        buffer.height = isRotated ? srcW : srcH;

        // Apply transforms (rotate/flip)
        bctx.save();
        bctx.translate(buffer.width / 2, buffer.height / 2);
        bctx.rotate((rotation * Math.PI) / 180);
        bctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
        bctx.drawImage(img, -srcW / 2, -srcH / 2, srcW, srcH);
        bctx.restore();

        // Pixel manipulation (brightness, contrast, saturation)
        if (adjustments.brightness !== 0 || adjustments.contrast !== 0 || adjustments.saturation !== 0) {
            const imageData = bctx.getImageData(0, 0, buffer.width, buffer.height);
            const data = imageData.data;

            const brightnessOffset = adjustments.brightness * 2.55;
            const contrastFactor = (259 * (adjustments.contrast + 255)) / (255 * (259 - adjustments.contrast));
            const saturationFactor = 1 + adjustments.saturation / 100;

            for (let i = 0; i < data.length; i += 4) {
                // Brightness
                data[i] += brightnessOffset;
                data[i + 1] += brightnessOffset;
                data[i + 2] += brightnessOffset;

                // Contrast
                data[i] = contrastFactor * (data[i] - 128) + 128;
                data[i + 1] = contrastFactor * (data[i + 1] - 128) + 128;
                data[i + 2] = contrastFactor * (data[i + 2] - 128) + 128;

                // Saturation
                const gray = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
                data[i] = gray + saturationFactor * (data[i] - gray);
                data[i + 1] = gray + saturationFactor * (data[i + 1] - gray);
                data[i + 2] = gray + saturationFactor * (data[i + 2] - gray);

                // Clamp
                data[i] = Math.max(0, Math.min(255, data[i]));
                data[i + 1] = Math.max(0, Math.min(255, data[i + 1]));
                data[i + 2] = Math.max(0, Math.min(255, data[i + 2]));
            }
            bctx.putImageData(imageData, 0, 0);
        }

        // Apply overlay color (filter tint)
        const currentFilter = PRESET_FILTERS.find(f => f.name === activeFilter);
        if (currentFilter?.overlayColor) {
            bctx.fillStyle = currentFilter.overlayColor;
            bctx.fillRect(0, 0, buffer.width, buffer.height);
        }

        setLastProcessedState(Date.now().toString());
    }, [adjustments, rotation, flipH, flipV, activeFilter]);

    // Helpers
    const getDisplayScale = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return 1;
        const displayWidth = canvas.getBoundingClientRect().width;
        if (displayWidth === 0) return 1;
        return canvas.width / displayWidth;
    }, [canvasRef]);

    // Render to main canvas
    const renderCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const buffer = bufferCanvasRef.current;
        if (!canvas || !buffer) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = buffer.width;
        canvas.height = buffer.height;

        // Draw processed image
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(buffer, 0, 0);

        // Draw crop overlay
        if (activeTool === 'crop' && cropRegion) {
            const displayScale = getDisplayScale();
            const scaledCrop = {
                x: cropRegion.x * displayScale,
                y: cropRegion.y * displayScale,
                width: cropRegion.width * displayScale,
                height: cropRegion.height * displayScale,
            };

            // Overlay styling
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(0, 0, canvas.width, scaledCrop.y); // Top
            ctx.fillRect(0, scaledCrop.y + scaledCrop.height, canvas.width, canvas.height - scaledCrop.y - scaledCrop.height); // Bottom
            ctx.fillRect(0, scaledCrop.y, scaledCrop.x, scaledCrop.height); // Left
            ctx.fillRect(scaledCrop.x + scaledCrop.width, scaledCrop.y, canvas.width - scaledCrop.x - scaledCrop.width, scaledCrop.height); // Right

            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.strokeRect(scaledCrop.x, scaledCrop.y, scaledCrop.width, scaledCrop.height);

            // Rule of thirds
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 1;
            for (let i = 1; i < 3; i++) {
                ctx.beginPath();
                ctx.moveTo(scaledCrop.x + (scaledCrop.width / 3) * i, scaledCrop.y);
                ctx.lineTo(scaledCrop.x + (scaledCrop.width / 3) * i, scaledCrop.y + scaledCrop.height);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(scaledCrop.x, scaledCrop.y + (scaledCrop.height / 3) * i);
                ctx.lineTo(scaledCrop.x + scaledCrop.width, scaledCrop.y + (scaledCrop.height / 3) * i);
                ctx.stroke();
            }
        }
    }, [activeTool, cropRegion, getDisplayScale, canvasRef]);

    // Effects to trigger updates
    useEffect(() => {
        if (!loading && originalImageRef.current) {
            updateBaseImage();
        }
    }, [loading, adjustments, rotation, flipH, flipV, activeFilter, updateBaseImage]);

    useEffect(() => {
        if (!loading) {
            renderCanvas();
        }
    }, [activeTool, cropRegion, lastProcessedState, renderCanvas]);


    // Action Handlers
    const applyCrop = () => {
        const canvas = canvasRef.current;
        if (!canvas || !cropRegion) return;

        const displayScale = getDisplayScale();
        const scaledCrop = {
            x: Math.round(cropRegion.x * displayScale),
            y: Math.round(cropRegion.y * displayScale),
            width: Math.round(cropRegion.width * displayScale),
            height: Math.round(cropRegion.height * displayScale),
        };

        if (scaledCrop.width < 10 || scaledCrop.height < 10) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        setAppliedCrops(prev => [...prev, ctx.getImageData(0, 0, canvas.width, canvas.height)]);

        const croppedData = ctx.getImageData(scaledCrop.x, scaledCrop.y, scaledCrop.width, scaledCrop.height);

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = scaledCrop.width;
        tempCanvas.height = scaledCrop.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) return;

        tempCtx.putImageData(croppedData, 0, 0);

        const newImg = new Image();
        newImg.src = tempCanvas.toDataURL('image/png');
        newImg.onload = () => {
            originalImageRef.current = newImg;
            setCropRegion(null);
            setActiveTool('none');
            updateBaseImage();
        };
    };

    const undo = () => {
        if (history.length === 0) return;
        const prev = history[history.length - 1];
        setHistory(h => h.slice(0, -1));
        setAdjustments(prev.adjustments);
        setRotation(prev.rotation);
        setFlipH(prev.flipH);
        setFlipV(prev.flipV);
        setActiveFilter(prev.filter);
    };

    const resetAll = () => {
        if (firstLoadImageRef.current) {
            originalImageRef.current = firstLoadImageRef.current;
        }
        setAdjustments({ brightness: 0, contrast: 0, saturation: 0 });
        setRotation(0);
        setFlipH(false);
        setFlipV(false);
        setActiveFilter('Original');
        setCropRegion(null);
        setActiveTool('none');
        setHistory([]);
        setAppliedCrops([]);
        updateBaseImage();
    };

    const handleAdjustmentChange = (key: keyof Adjustments, value: number) => {
        if (activeFilter !== 'Original') {
            setActiveFilter('Original');
        }
        setAdjustments(prev => ({ ...prev, [key]: value }));
    };

    const applyFilter = (filter: FilterPreset) => {
        pushHistory();
        setAdjustments(filter.adjustments);
        setActiveFilter(filter.name);
    };

    // Crop Mouse Interactions
    const handleCropMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (activeTool !== 'crop') return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setCropStart({ x, y });
        setIsCropping(true);
        setCropRegion({ x, y, width: 0, height: 0 });
    };

    const handleCropMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isCropping || !cropStart) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        setCropRegion({
            x: Math.min(cropStart.x, x),
            y: Math.min(cropStart.y, y),
            width: Math.abs(x - cropStart.x),
            height: Math.abs(y - cropStart.y),
        });
    };

    const handleCropMouseUp = () => {
        setIsCropping(false);
        setCropStart(null);
    };

    return {
        // State
        loading, error,
        activeTool, setActiveTool,
        adjustments, setAdjustments,
        rotation,
        flipH, flipV,
        activeFilter,
        cropRegion, setCropRegion,
        isCropping,
        history,
        originalDimensions: originalImageRef.current ? { width: originalImageRef.current.width, height: originalImageRef.current.height } : null,
        hasChanges: adjustments.brightness !== 0 || adjustments.contrast !== 0 || adjustments.saturation !== 0 || rotation !== 0 || flipH || flipV || appliedCrops.length > 0,

        // Actions
        handleAdjustmentChange,
        applyFilter,
        rotateRight: () => { pushHistory(); setRotation(r => (r + 90) % 360); },
        rotateLeft: () => { pushHistory(); setRotation(r => (r + 270) % 360); },
        toggleFlipH: () => { pushHistory(); setFlipH(h => !h); },
        toggleFlipV: () => { pushHistory(); setFlipV(v => !v); },
        applyCrop,
        undo,
        resetAll,
        pushHistory,

        // Canvas Interactions
        handleCropMouseDown,
        handleCropMouseMove,
        handleCropMouseUp
    };
}
