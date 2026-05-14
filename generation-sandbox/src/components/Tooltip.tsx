'use client';

import React, { useState } from 'react';

interface TooltipProps {
    content: React.ReactNode;
    children: React.ReactNode;
    position?: 'top' | 'bottom' | 'left' | 'right';
    className?: string;
    width?: string;
}

export default function Tooltip({ content, children, position = 'top', className = '', width = 'w-64' }: TooltipProps) {
    const [isVisible, setIsVisible] = useState(false);

    const positionClasses = {
        top: 'bottom-full left-1/2 -translate-x-1/2 mb-3',
        bottom: 'top-full left-1/2 -translate-x-1/2 mt-3',
        left: 'right-full top-1/2 -translate-y-1/2 mr-3',
        right: 'left-full top-1/2 -translate-y-1/2 ml-3'
    };

    const arrowClasses = {
        top: 'top-full left-1/2 -translate-x-1/2 border-t-[#12121a]/95 border-x-transparent border-b-transparent',
        bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-[#12121a]/95 border-x-transparent border-t-transparent',
        left: 'left-full top-1/2 -translate-y-1/2 border-l-[#12121a]/95 border-y-transparent border-r-transparent',
        right: 'right-full top-1/2 -translate-y-1/2 border-r-[#12121a]/95 border-y-transparent border-l-transparent'
    };
    
    // Top position alignment
    const finalPosClass = position === 'top' ? 'bottom-full left-1/2 -translate-x-1/2 mb-3' : positionClasses[position];

    return (
        <div
            className={`relative inline-block ${className}`}
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
        >
            {children}
            {isVisible && (
                <div className={`absolute z-[1000] p-3 text-[11px] leading-relaxed text-foreground-muted bg-[#12121a]/95 border border-primary/20 rounded-xl shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-200 ${width} ${finalPosClass}`}>
                    <div className="relative z-10 font-medium">{content}</div>
                    <div className={`absolute border-[6px] ${arrowClasses[position]}`} />
                </div>
            )}
        </div>
    );
}
