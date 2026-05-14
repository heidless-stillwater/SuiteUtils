'use client';

import React, { useState } from 'react';

interface SmartVideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
    fallbackSize?: 'sm' | 'md' | 'lg';
}

export default function SmartVideo({ fallbackSize = 'md', className = '', ...props }: SmartVideoProps) {
    const [error, setError] = useState(false);

    if (error) {
        const sizeClasses = {
            sm: 'w-8 h-8',
            md: 'w-12 h-12',
            lg: 'w-20 h-20'
        };

        return (
            <div className={`flex flex-col items-center justify-center bg-background-secondary rounded-xl p-4 text-foreground-muted ${className}`}>
                <svg className={`${sizeClasses[fallbackSize]} opacity-20 mb-2`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {fallbackSize !== 'sm' && (
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Unavailable</span>
                )}
            </div>
        );
    }

    return (
        <video
            {...props}
            className={className}
            onError={() => setError(true)}
            muted
            playsInline
        />
    );
}
