import { useRef, useState, useEffect } from 'react';
import { Icons } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';
import { SortMode } from './CommunityHeader';
import { Button } from '@/components/ui/Button';

interface QuickLink {
    id: SortMode;
    label: string;
    icon: React.ReactNode;
    thumbnail?: string;
}

interface CommunityQuickLinksProps {
    activeSort: SortMode;
    onSortChange: (sort: SortMode) => void;
    thumbnails: string[];
}

export default function CommunityQuickLinks({ activeSort, onSortChange, thumbnails }: CommunityQuickLinksProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const links: QuickLink[] = [
        {
            id: 'influence',
            label: 'Most Influence',
            icon: <Icons.trophy size={16} />,
            thumbnail: thumbnails[0]
        },
        {
            id: 'creations',
            label: 'Most Popular',
            icon: <Icons.trophy size={16} />,
            thumbnail: thumbnails[1]
        },
        {
            id: 'images',
            label: 'Most Discussed',
            icon: <Icons.comment size={16} />,
            thumbnail: thumbnails[2]
        },
        {
            id: 'followed',
            label: 'Most Followed',
            icon: <Icons.follow size={16} />,
            thumbnail: thumbnails[4]
        },
        {
            id: 'liked',
            label: 'Most Liked',
            icon: <Icons.heart size={16} />,
            thumbnail: thumbnails[0]
        },
        {
            id: 'shared',
            label: 'Most Shared',
            icon: <Icons.share size={16} />,
            thumbnail: thumbnails[3]
        },
        {
            id: 'variations',
            label: 'Most Variations',
            icon: <Icons.variation size={16} />,
            thumbnail: thumbnails[1]
        },
        {
            id: 'recent',
            label: 'Most Recent',
            icon: <Icons.clock size={16} />,
            thumbnail: thumbnails[5]
        },
    ];

    const checkScroll = () => {
        if (scrollContainerRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
            setCanScrollLeft(scrollLeft > 10);
            setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
        }
    };

    useEffect(() => {
        checkScroll();
        window.addEventListener('resize', checkScroll);
        return () => window.removeEventListener('resize', checkScroll);
    }, []);

    const scroll = (direction: 'left' | 'right') => {
        if (scrollContainerRef.current) {
            const scrollAmount = 320; // Scroll roughly 2 items approx
            scrollContainerRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    return (
        <div className="mb-10 group/container">
            <h3 className="text-xs font-black uppercase tracking-widest text-foreground-muted mb-4 px-1">Quick Links</h3>

            <div className="relative">
                {/* Left Scroll Button */}
                {canScrollLeft && (
                    <div className="absolute left-0 top-0 bottom-4 w-16 bg-gradient-to-r from-background to-transparent z-10 flex items-center pointer-events-none">
                        <Button
                            variant="secondary"
                            size="icon"
                            onClick={() => scroll('left')}
                            className="w-10 h-10 rounded-full shadow-xl border-border/50 bg-background/80 backdrop-blur-md pointer-events-auto ml-1"
                        >
                            <Icons.chevronLeft size={20} />
                        </Button>
                    </div>
                )}

                {/* Right Scroll Button */}
                {canScrollRight && (
                    <div className="absolute right-0 top-0 bottom-4 w-16 bg-gradient-to-l from-background to-transparent z-10 flex items-center justify-end pointer-events-none">
                        <Button
                            variant="secondary"
                            size="icon"
                            onClick={() => scroll('right')}
                            className="w-10 h-10 rounded-full shadow-xl border-border/50 bg-background/80 backdrop-blur-md pointer-events-auto mr-1"
                        >
                            <Icons.chevronRight size={20} />
                        </Button>
                    </div>
                )}

                <div
                    ref={scrollContainerRef}
                    onScroll={checkScroll}
                    className="flex overflow-x-auto gap-4 pb-4 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 scroll-smooth"
                >
                    {links.map((link) => (
                        <button
                            key={link.id}
                            onClick={() => onSortChange(link.id)}
                            className={cn(
                                "flex-shrink-0 relative w-40 h-24 rounded-2xl overflow-hidden group transition-all duration-300",
                                activeSort === link.id
                                    ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-[1.02] shadow-xl shadow-primary/20"
                                    : "hover:scale-[1.02] hover:shadow-lg"
                            )}
                        >
                            {/* Background Thumbnail */}
                            {link.thumbnail ? (
                                <img
                                    src={link.thumbnail}
                                    alt={link.label}
                                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                />
                            ) : (
                                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20" />
                            )}

                            {/* Overlay */}
                            <div className={cn(
                                "absolute inset-0 transition-opacity duration-300",
                                activeSort === link.id
                                    ? "bg-primary/40"
                                    : "bg-black/40 group-hover:bg-black/20"
                            )} />

                            {/* Content */}
                            <div className="absolute inset-0 p-3 flex flex-col justify-between text-white">
                                <div className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20",
                                    activeSort === link.id ? "bg-white text-primary" : "bg-black/20"
                                )}>
                                    {link.icon}
                                </div>
                                <span className="font-bold text-sm tracking-tight drop-shadow-md">{link.label}</span>
                            </div>

                            {/* Active Indicator */}
                            {activeSort === link.id && (
                                <div className="absolute top-2 right-2 w-2 h-2 bg-white rounded-full animate-pulse" />
                            )}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
