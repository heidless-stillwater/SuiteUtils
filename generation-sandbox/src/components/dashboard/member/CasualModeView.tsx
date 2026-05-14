'use client';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icons } from '@/components/ui/Icons';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import WalletWisdom from './WalletWisdom';
import ConfirmationModal from '@/components/ConfirmationModal';
import { useTour } from '@/context/TourContext';
import CommunityPulse from '@/components/dashboard/CommunityPulse';

interface CasualModeViewProps {
    dashboardData: any;
}

export default function CasualModeView({ dashboardData }: CasualModeViewProps) {
    const { profile, credits } = dashboardData;
    const router = useRouter();
    const [isTourModalOpen, setIsTourModalOpen] = useState(false);
    const { startTour } = useTour();

    const handleTryStyle = (prompt: string) => {
        router.push(`/generate?prompt=${encodeURIComponent(prompt)}`);
    };

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Guided Welcome */}
            <section className="text-center py-4">
                <h1 id="dashboard-title" className="text-4xl md:text-5xl font-black gradient-text mb-4 tracking-tighter">
                    What will you create today, {profile?.displayName || 'Creator'}?
                </h1>
                <p className="text-lg text-foreground-muted max-w-2xl mx-auto font-medium">
                    Your imagination is the only limit. Start with a style below or jump into the studio.
                </p>
            </section>

            {/* Support Level: Wallet Wisdom */}
            <div id="wallet-wisdom">
                <WalletWisdom credits={credits} />
            </div>

            {/* Support Level: Starter Prompts */}
            <section id="starter-styles" className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black uppercase tracking-widest flex items-center gap-2">
                        <Icons.sparkles className="text-primary" size={20} />
                        Choose Your First Adventure
                    </h2>
                    <Button
                        id="studio-link"
                        variant="ghost"
                        size="sm"
                        className="text-xs font-bold text-primary"
                        onClick={() => router.push('/generate')}
                    >
                        View More Styles
                    </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[
                        { title: 'Neon Cyberpunk', style: 'Highly detailed, futuristic city, rainy streets, cinematic lighting', color: 'from-purple-500/20 to-blue-500/20' },
                        { title: 'Dreamy Watercolor', style: 'Soft edges, pastel colors, whimsical landscape, ethereal atmosphere', color: 'from-pink-500/20 to-yellow-500/20' },
                        { title: 'Epic Oil Painting', style: 'Thick brushstrokes, dramatic lighting, classical portrait style', color: 'from-orange-500/20 to-red-500/20' }
                    ].map((card, i) => (
                        <Card
                            key={i}
                            onClick={() => handleTryStyle(card.style)}
                            className={`p-6 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border-none bg-gradient-to-br ${card.color} group relative overflow-hidden`}
                        >
                            <div className="absolute right-0 bottom-0 opacity-10 group-hover:scale-110 transition-transform">
                                <Icons.image size={80} />
                            </div>
                            <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">{card.title}</h3>
                            <p className="text-xs text-foreground-muted leading-relaxed mb-4 italic">&quot;{card.style}&quot;</p>
                            <Button variant="secondary" size="sm" className="w-full font-bold bg-background/50 backdrop-blur-sm border-white/10 pointer-events-none">Try This Style</Button>
                        </Card>
                    ))}
                </div>
            </section>

            {/* Support Level: Clone an Exemplar */}
            <section id="clone-exemplars" className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black uppercase tracking-widest flex items-center gap-2">
                        <Icons.copy className="text-primary" size={20} />
                        Clone an Exemplar
                    </h2>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs font-bold text-primary"
                        onClick={() => router.push('/community')}
                    >
                        Explore the Collective
                    </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[
                        { title: 'The Stillwater Lake', style: 'A cinematic, ethereal landscape of a stillwater lake at twilight, glowing bioluminescent plants, floating mountain islands in the distance, hyper-realistic, 8K, serene deep blue and teal color palette', color: 'from-stillwater-deep/20 to-stillwater-teal/20' },
                        { title: 'Neon Vision', style: 'A high-detail cyberpunk portrait of a female cyborg with glowing neon circuit patterns on her skin, iridescent rain-slicked skin, cinematic lighting, ultra-sharp focus, vibrant magenta and primary blue accents', color: 'from-purple-500/20 to-primary/20' },
                        { title: 'Nature\'s Prism', style: 'Macro photography of an iridescent beetle shell reflecting a rainbow of metallic colors, hyper-detailed textures, soft bokeh background, 8K resolution, professional lighting', color: 'from-emerald-500/20 to-primary/20' }
                    ].map((card, i) => (
                        <Card
                            key={i}
                            onClick={() => handleTryStyle(card.style)}
                            className={`p-6 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border-none bg-gradient-to-br ${card.color} group relative overflow-hidden`}
                        >
                            <div className="absolute right-0 bottom-0 opacity-10 group-hover:scale-110 transition-transform">
                                <Icons.copy size={80} />
                            </div>
                            <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">{card.title}</h3>
                            <p className="text-xs text-foreground-muted leading-relaxed mb-4 italic">&quot;{card.style}&quot;</p>
                            <Button variant="secondary" size="sm" className="w-full font-bold bg-background/50 backdrop-blur-sm border-white/10 pointer-events-none">Clone This Recipe</Button>
                        </Card>
                    ))}
                </div>
            </section>

            {/* Community Engagement */}
            <div className="pt-8 border-t border-border/50">
                <div className="flex flex-wrap gap-4 mb-10">
                    <Button
                        variant="secondary"
                        onClick={() => router.push('/community')}
                        className="flex items-center gap-2 border-emerald-500/20 hover:border-emerald-500/50 group transition-all"
                    >
                        <Icons.globe size={18} className="group-hover:rotate-12 transition-transform text-emerald-500" />
                        Community Hub
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={() => router.push('/community/leaderboard')}
                        className="flex items-center gap-2 border-yellow-500/20 hover:border-yellow-500/50 group transition-all"
                    >
                        <Icons.trophy size={18} className="group-hover:scale-110 transition-transform text-yellow-500" />
                        Hall of Fame
                    </Button>
                </div>
                <CommunityPulse entries={dashboardData.recentCommunityEntries} />
            </div>

            {/* Support Level: Guided Tour Invite */}
            <Card variant="glass" className="p-6 bg-accent/5 border-accent/20 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center text-accent">
                        <Icons.info size={24} />
                    </div>
                    <div>
                        <p className="font-bold">New to AI Image Studio?</p>
                        <p className="text-xs text-foreground-muted">Check out our 1-minute guide to get the most out of your credits.</p>
                    </div>
                </div>
                <Button
                    variant="secondary"
                    className="border-accent/20 text-accent hover:bg-accent/10 whitespace-nowrap"
                    onClick={() => setIsTourModalOpen(true)}
                >
                    Take the Tour
                </Button>
            </Card>

            <ConfirmationModal
                isOpen={isTourModalOpen}
                title="Start Guided Tour?"
                message="This 1-minute tour will show you how to master the studio generator and manage your creative energy."
                confirmLabel="Start Tour"
                cancelLabel="Maybe Later"
                onConfirm={() => {
                    setIsTourModalOpen(false);
                    startTour();
                }}
                onCancel={() => setIsTourModalOpen(false)}
            />
        </div>
    );
}
