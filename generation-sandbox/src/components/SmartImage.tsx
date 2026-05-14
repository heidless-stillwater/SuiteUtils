'use client';

import React, { useState } from 'react';

interface SmartImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    fallbackSize?: 'sm' | 'md' | 'lg';
}

export default function SmartImage({ fallbackSize = 'md', className = '', ...props }: SmartImageProps) {
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {fallbackSize !== 'sm' && (
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Unavailable</span>
                )}
            </div>
        );
    }

    return (
        <img
            {...props}
            alt={props.alt || 'Smart Image'}
            className={className}
            onError={() => setError(true)}
            loading="lazy"
        />
    );
}
