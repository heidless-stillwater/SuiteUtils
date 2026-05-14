'use client';

import { cn } from '@/lib/utils';
import { useState } from 'react';

interface UserAvatarProps {
    src?: string | null;
    name?: string | null;
    className?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    border?: boolean;
}

const SIZE_CLASSES = {
    sm: 'w-8 h-8 text-[10px]',
    md: 'w-10 h-10 text-xs',
    lg: 'w-14 h-14 text-xl',
    xl: 'w-20 h-20 text-2xl',
};

/** Deterministic colour from a name string */
function nameToColor(name: string): string {
    const colors = [
        'bg-rose-500', 'bg-pink-500', 'bg-fuchsia-500', 'bg-purple-500',
        'bg-violet-500', 'bg-indigo-500', 'bg-blue-500', 'bg-sky-500',
        'bg-cyan-500', 'bg-teal-500', 'bg-emerald-500', 'bg-green-500',
        'bg-lime-500', 'bg-amber-500', 'bg-orange-500', 'bg-red-500',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

export default function UserAvatar({
    src,
    name,
    className,
    size = 'md',
    border = true,
}: UserAvatarProps) {
    const [imgError, setImgError] = useState(false);

    const hasValidSrc = !!src && src !== 'null' && src !== 'undefined' && src.length > 5 && !imgError;

    const initials = (name || 'A')
        .split(' ')
        .filter(Boolean)
        .map(w => w[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();

    const bgColor = nameToColor(name || 'User');

    if (hasValidSrc) {
        return (
            <img
                src={src!}
                alt={name || 'User'}
                className={cn(
                    'rounded-full object-cover flex-shrink-0',
                    border && 'border border-border',
                    SIZE_CLASSES[size],
                    className,
                )}
                onError={() => setImgError(true)}
            />
        );
    }

    // Initials fallback — colourful circle with the user's initials
    return (
        <div
            className={cn(
                'rounded-full flex-shrink-0 flex items-center justify-center font-black text-white select-none',
                border && 'border border-border',
                bgColor,
                SIZE_CLASSES[size],
                className,
            )}
        >
            {initials}
        </div>
    );
}
