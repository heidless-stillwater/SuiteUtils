import { GeneratedImage } from '@/lib/types';
import { useState } from 'react';

interface ImageDisplayProps {
    image: GeneratedImage;
    onPrev: () => void;
    onNext: () => void;
}

export default function ImageDisplay({ image, onPrev, onNext }: ImageDisplayProps) {
    const [error, setError] = useState(false);

    return (
        <div className="flex-1 bg-background-secondary flex items-center justify-center p-4 overflow-hidden relative group">
            {/* Navigation Buttons Overlay */}
            <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none z-20">
                <button
                    onClick={(e) => { e.stopPropagation(); onPrev(); }}
                    className="w-12 h-12 flex items-center justify-center bg-black/50 hover:bg-black/80 text-white rounded-full transition-all pointer-events-auto shadow-lg border border-white/10 group/nav"
                    title="Previous Image (Arrow Left)"
                >
                    <svg className="w-6 h-6 group-hover/nav:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onNext(); }}
                    className="w-12 h-12 flex items-center justify-center bg-black/50 hover:bg-black/80 text-white rounded-full transition-all pointer-events-auto shadow-lg border border-white/10 group/nav"
                    title="Next Image (Arrow Right)"
                >
                    <svg className="w-6 h-6 group-hover/nav:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19l7-7-7-7" />
                    </svg>
                </button>
            </div>

            {error ? (
                <div className="flex flex-col items-center justify-center text-foreground-muted">
                    <svg className="w-20 h-20 opacity-20 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm font-black uppercase tracking-widest opacity-40">Media Unavailable</span>
                </div>
            ) : (image.videoUrl || image.settings?.modality === 'video') ? (
                <video
                    key={image.id + '-video'}
                    src={image.videoUrl || image.imageUrl}
                    className="max-w-full max-h-full rounded-lg shadow-xl"
                    controls
                    loop
                    muted
                    playsInline
                    preload="auto"
                    onError={() => setError(true)}
                />
            ) : (
                <img
                    src={image.imageUrl}
                    alt={image.prompt}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-xl"
                    onError={(e) => {
                        console.error('Image load error for URL:', image.imageUrl);
                        setError(true);
                    }}
                />
            )}

            {/* Community badge */}
            {image.publishedToCommunity && (
                <div className="absolute top-4 left-4 z-10 bg-yellow-500/90 text-white text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1 shadow-lg pointer-events-none">
                    🏆 Published to Community Hub
                </div>
            )}
        </div>
    );
}

