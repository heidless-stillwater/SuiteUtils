import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { GeneratedImage, Collection } from '@/lib/types';
import { normalizeImageData } from '@/lib/image-utils';
import { Input } from '@/components/ui/Input';
import { Icons } from '@/components/ui/Icons';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export default function GlobalSearch() {
    const { user } = useAuth();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [results, setResults] = useState<{
        images: GeneratedImage[];
        collections: Collection[];
    }>({ images: [], collections: [] });
    const [isLoading, setIsLoading] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const performSearch = async (val: string) => {
        if (!user || val.length < 2) {
            setResults({ images: [], collections: [] });
            return;
        }

        setIsLoading(true);
        const term = val.toLowerCase().trim();

        try {
            const colRef = collection(db, 'users', user.uid, 'collections');
            const colSnap = await getDocs(query(colRef, orderBy('createdAt', 'desc'), limit(50)));
            const allCollections = colSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Collection));

            const filteredCollections = allCollections.filter(c =>
                c.name.toLowerCase().includes(term) ||
                c.tags?.some(tag => tag.toLowerCase().includes(term))
            ).slice(0, 5);

            const imgRef = collection(db, 'users', user.uid, 'images');
            const imgSnap = await getDocs(query(imgRef, orderBy('createdAt', 'desc'), limit(100)));
            const allImages = imgSnap.docs.map(doc => normalizeImageData(doc.data(), doc.id));

            const filteredImages = allImages.filter(img =>
                img.prompt.toLowerCase().includes(term) ||
                img.tags?.some(tag => tag.toLowerCase().includes(term))
            ).slice(0, 5);

            setResults({
                collections: filteredCollections,
                images: filteredImages
            });
        } catch (error) {
            console.error('Global search error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchQuery) performSearch(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    return (
        <div className="relative flex-1 max-w-md mx-4" ref={containerRef}>
            <div className="relative">
                <Input
                    placeholder="Search images, collections, tags..."
                    value={searchQuery}
                    onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    className="h-10 text-sm shadow-sm"
                    icon={<Icons.search size={16} />}
                />
                {isLoading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Icons.spinner className="w-4 h-4 animate-spin text-primary" />
                    </div>
                )}
            </div>

            {isOpen && (searchQuery.length >= 2) && (
                <div className="absolute top-full mt-2 w-full z-[100] animate-in slide-in-from-top-2 duration-200">
                    <Card variant="glass" className="bg-background/95 backdrop-blur-xl border border-border shadow-2xl p-0 overflow-hidden">
                        <div className="max-h-[70vh] overflow-y-auto scrollbar-hide p-2">
                            {/* Collections Section */}
                            {results.collections.length > 0 && (
                                <div className="mb-4">
                                    <h3 className="text-[10px] font-black text-foreground-muted uppercase tracking-widest px-3 py-2">Collections</h3>
                                    <div className="space-y-1">
                                        {results.collections.map(col => (
                                            <button
                                                key={col.id}
                                                onClick={() => {
                                                    router.push(`/collections/${col.id}`);
                                                    setIsOpen(false);
                                                    setSearchQuery('');
                                                }}
                                                className="w-full text-left px-3 py-2 hover:bg-primary/10 rounded-xl transition-all flex items-center gap-3 group"
                                            >
                                                <div className="w-10 h-10 rounded-lg bg-background-secondary border border-border flex items-center justify-center text-primary font-bold overflow-hidden">
                                                    {col.coverImageUrl ? (
                                                        <img src={col.coverImageUrl} className="w-full h-full object-cover" alt="" />
                                                    ) : (
                                                        <Icons.stack size={20} className="text-foreground-muted opacity-50" />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">{col.name}</div>
                                                    <div className="text-[10px] font-black uppercase tracking-tight text-foreground-muted">{col.imageCount} images</div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Images Section */}
                            {results.images.length > 0 && (
                                <div>
                                    <h3 className="text-[10px] font-black text-foreground-muted uppercase tracking-widest px-3 py-2">Images</h3>
                                    <div className="space-y-1">
                                        {results.images.map(img => (
                                            <button
                                                key={img.id}
                                                onClick={() => {
                                                    router.push(`/gallery?selected=${img.id}`);
                                                    setIsOpen(false);
                                                    setSearchQuery('');
                                                }}
                                                className="w-full text-left px-3 py-2 hover:bg-primary/10 rounded-xl transition-all flex items-center gap-3 group"
                                            >
                                                <div className="w-12 h-12 rounded-lg overflow-hidden bg-background-secondary border border-border flex-shrink-0">
                                                    <img src={img.imageUrl} className="w-full h-full object-cover" alt="" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-tight italic">&quot;{img.prompt}&quot;</div>
                                                    <div className="text-[9px] font-black uppercase tracking-wider text-foreground-muted mt-1">{img.settings.quality} • {img.settings.aspectRatio}</div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {results.collections.length === 0 && results.images.length === 0 && !isLoading && (
                                <div className="py-12 text-center">
                                    <div className="w-12 h-12 rounded-full bg-background-secondary flex items-center justify-center mx-auto mb-4">
                                        <Icons.search className="w-6 h-6 text-foreground-muted opacity-30" />
                                    </div>
                                    <div className="text-sm font-bold text-foreground-muted">No results for &quot;{searchQuery}&quot;</div>
                                </div>
                            )}
                        </div>

                        <div className="p-2 bg-background-secondary/50 border-t border-border mt-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    router.push(`/gallery?q=${encodeURIComponent(searchQuery)}`);
                                    setIsOpen(false);
                                    setSearchQuery('');
                                }}
                                className="w-full text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary-hover hover:bg-primary/5"
                            >
                                See all results in Gallery
                                <Icons.arrowRight size={12} className="ml-2" />
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
