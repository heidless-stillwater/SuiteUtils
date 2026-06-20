'use client';

import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/Toast';

interface ReactionPickerProps {
    entryId: string;
    reactions: Record<string, string[]>; // emoji -> [userIds]
    onReact: (emoji: string) => void;
    isReactingEmoji?: string | null;
}

const COMMON_EMOJIS = ['🔥', '🚀', '🎨', '❤️', '👏'];

export default function ReactionPicker({
    entryId,
    reactions,
    onReact,
    isReactingEmoji
}: ReactionPickerProps) {
    const { user } = useAuth();
    const { showToast } = useToast();

    const handleReactClick = (emoji: string) => {
        if (!user) {
            showToast('Please sign in to react', 'error');
            return;
        }
        onReact(emoji);
    };

    return (
        <div className="flex flex-wrap items-center gap-2">
            {COMMON_EMOJIS.map(emoji => {
                const userIds = reactions[emoji] || [];
                const hasReacted = user ? userIds.includes(user.uid) : false;
                const count = userIds.length;
                const isProcessing = isReactingEmoji === emoji;

                if (count === 0 && !user) return null; // Only show if count > 0 for guests

                return (
                    <button
                        key={emoji}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleReactClick(emoji);
                        }}
                        disabled={!!isReactingEmoji}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-bold transition-all border ${hasReacted
                            ? 'bg-primary/10 border-primary text-primary'
                            : 'bg-background-secondary/50 border-border hover:border-primary/50 text-foreground-muted hover:text-foreground'
                            } ${isProcessing ? 'opacity-50 cursor-wait' : ''}`}
                    >
                        <span>{emoji}</span>
                        {count > 0 && <span className="text-xs">{count}</span>}
                    </button>
                );
            })}
        </div>
    );
}
