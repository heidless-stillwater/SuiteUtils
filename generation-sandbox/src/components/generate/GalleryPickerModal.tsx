'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icons } from '@/components/ui/Icons';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { GeneratedImage } from '@/lib/types';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { normalizeImageData } from '@/lib/image-utils';
import { useAuth } from '@/lib/auth-context';

interface GalleryPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (image: GeneratedImage) => void;
    mode?: 'reference' | 'prompt';
}

export default function GalleryPickerModal({ isOpen, onClose, onSelect, mode = 'reference' }: GalleryPickerModalProps) {
    const { user } = useAuth();
    const [images, setImages] = useState<GeneratedImage[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchImages = async () => {
            if (!user || !isOpen) return;

            setLoading(true);
            try {
                const imagesRef = collection(db, 'users', user.uid, 'images');
                const q = query(imagesRef, orderBy('createdAt', 'desc'), limit(50));
                const snapshot = await getDocs(q);
                const fetched = snapshot.docs.map(doc => normalizeImageData(doc.data(), doc.id));
                setImages(fetched);
            } catch (err) {
                console.error('Failed to fetch gallery images:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchImages();
    }, [user, isOpen]);

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-4xl max-h-[80vh] overflow-hidden"
                    >
                        <Card className="flex flex-col h-[80vh] border-border/50 shadow-2xl" variant="glass">
                            {/* Header */}
                            <div className="flex items-center justify-between p-6 border-b border-border/50">
                                <div>
                                    <h2 className="text-xl font-black tracking-tighter text-white uppercase">Your Gallery</h2>
                                    <p className="text-xs text-foreground-muted font-bold uppercase tracking-widest mt-1">
                                        {mode === 'reference' ? 'Select a reference image' : 'Select a prompt to import'}
                                    </p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={onClose}
                                    className="h-10 w-10 hover:bg-white/10"
                                >
                                    <Icons.close size={20} />
                                </Button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                                {loading ? (
                                    <div className="h-full flex flex-col items-center justify-center gap-4">
                                        <Icons.spinner className="w-8 h-8 animate-spin text-primary" />
                                        <p className="text-xs font-black uppercase tracking-widest text-foreground-muted">Loading your masterpieces...</p>
                                    </div>
                                ) : images.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center gap-6 text-center py-12">
                                        <div className="w-20 h-20 rounded-3xl bg-background-secondary border border-border flex items-center justify-center">
                                            <Icons.image size={32} className="text-foreground-muted" />
                                        </div>
                                        <div className="space-y-2">
                                            <h3 className="text-lg font-black text-white">NO IMAGES FOUND</h3>
                                            <p className="text-sm text-foreground-muted max-w-xs mx-auto">
                                                Generate some images first to use them as references.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                        {images.map((image) => (
                                            <motion.button
                                                key={image.id}
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                                onClick={() => onSelect(image)}
                                                className="group relative aspect-square rounded-xl overflow-hidden border border-border/50 bg-background-secondary hover:border-primary/50 transition-all shadow-lg hover:shadow-primary/20"
                                            >
                                                <img
                                                    src={image.imageUrl}
                                                    alt={image.prompt}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                />
                                                
                                                {/* Title Overlay */}
                                                <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                                                    <p className="text-[9px] font-black text-white uppercase tracking-wider truncate leading-tight">
                                                        {image.title || '<no title>'}
                                                    </p>
                                                </div>

                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20">
                                                    <Badge className="bg-primary text-white font-black text-[10px] uppercase shadow-lg shadow-primary/30">Select</Badge>
                                                </div>
                                            </motion.button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="p-4 border-t border-border/50 bg-background/50 flex justify-end">
                                <Button variant="secondary" onClick={onClose} className="font-black uppercase tracking-widest text-[10px]">
                                    Cancel
                                </Button>
                            </div>
                        </Card>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
