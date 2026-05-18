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
    const { profile, credits, ecosystemStatus } = dashboardData;
    const router = useRouter();
    const statusLoading = ecosystemStatus?.loading;
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

            {/* --- Stillwater Ecosystem Suite Status --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {statusLoading ? (
                    <div className="md:col-span-3 h-[120px] glass-card bg-black/60 flex flex-col items-center justify-center gap-3 animate-pulse border-2 border-primary/20">
                        <Icons.spinner className="w-8 h-8 text-primary animate-spin" />
                        <span className="text-[11px] font-black uppercase tracking-[0.3em] text-primary/80">Synchronizing Ecosystem Status...</span>
                    </div>
                ) : (
                    [
                    { 
                        name: 'Stillwater Studio', 
                        id: 'studio', 
                        url: '#', 
                        icon: '✨', 
                        desc: 'AI Generation & Refinement',
                        isCurrent: true 
                    },
                    { 
                        name: 'Resources', 
                        id: 'resources', 
                        url: 'http://localhost:3002/resources', 
                        icon: '📚', 
                        desc: 'Premium Assets & Guides' 
                    },
                    { 
                        name: 'Master Registry', 
                        id: 'registry', 
                        url: 'http://localhost:5173', 
                        icon: '📋', 
                        desc: 'Production Assets & Export' 
                    }
                ].map((app) => {
                    const isUnlocked = profile?.suiteSubscription?.activeSuites?.includes(app.id) || profile?.role === 'admin' || profile?.role === 'su';
                    return (
                        <div 
                            key={app.id}
                            onClick={() => !app.isCurrent && window.open(app.url, '_blank')}
                            className={`glass-card p-5 group cursor-pointer transition-all duration-500 border-x-0 border-t-0 border-b-2 ${
                                app.isCurrent 
                                ? 'border-primary/50 bg-primary/5 shadow-lg shadow-primary/5' 
                                : isUnlocked 
                                    ? 'border-emerald-500/30 hover:border-emerald-500/60 bg-white/5' 
                                    : 'border-white/5 hover:border-white/20'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl group-hover:scale-110 transition-transform duration-500">{app.icon}</span>
                                    <div>
                                        <h4 className="text-[11px] font-black uppercase tracking-widest text-white/90">{app.name}</h4>
                                        <p className="text-[10px] text-foreground-muted font-bold">{app.desc}</p>
                                    </div>
                                </div>
                                {isUnlocked ? (
                                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                                        <Icons.check size={12} className="text-emerald-500" />
                                    </div>
                                ) : (
                                    <div className="w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                                        <Icons.lock size={12} className="text-white/40" />
                                    </div>
                                )}
                            </div>
                            
                            <div className="flex items-center justify-between mt-4 overflow-hidden">
                                <div className="flex items-center gap-2">
                                    <div className={`h-1.5 w-1.5 rounded-full ${isUnlocked ? 'bg-emerald-500 animate-pulse' : 'bg-white/20'}`} />
                                    <span className={`text-[9px] font-black uppercase tracking-tighter ${isUnlocked ? 'text-emerald-400' : 'text-foreground-muted'}`}>
                                        {app.isCurrent ? 'Active Session' : isUnlocked ? 'Unlocked' : 'Encrypted'}
                                    </span>
                                </div>
                                {!app.isCurrent && (
                                    <Icons.arrowRight size={12} className="text-foreground-muted group-hover:translate-x-1 transition-transform" />
                                )}
                            </div>
                        </div>
                    );
                })
                )}
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
