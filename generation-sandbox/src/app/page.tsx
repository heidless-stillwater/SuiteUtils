'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icons } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { SystemConfig } from '@/lib/types';
import Image from 'next/image';

export default function HomePage() {
    const { user, loading, signInWithGoogle } = useAuth();
    const router = useRouter();
    const [config, setConfig] = useState<SystemConfig | null>(null);

    // Redirect to dashboard if logged in
    useEffect(() => {
        if (!loading && user) {
            router.push('/dashboard');
        }
    }, [user, loading, router]);

    // Fetch system config for dynamic incentives
    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const snap = await getDoc(doc(db, 'system', 'config'));
                if (snap.exists()) {
                    setConfig(snap.data() as SystemConfig);
                }
            } catch (e) {
                console.warn('Failed to fetch landing page config', e);
            }
        };
        fetchConfig();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
                <Icons.spinner className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-[#0a0a0f] text-foreground selection:bg-primary/30">
            {/* Nav */}
            <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-6 transition-all duration-300">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-2 group cursor-pointer">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-stillwater-teal flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
                            <Icons.sparkles className="text-white w-6 h-6" />
                        </div>
                        <span className="text-xl font-black uppercase tracking-tighter">Stillwater <span className="text-primary">Studio</span></span>
                    </div>
                    <Button
                        onClick={signInWithGoogle}
                        variant="ghost"
                        className="text-xs font-black uppercase tracking-widest hover:bg-white/5"
                    >
                        Join the Collective
                    </Button>
                </div>
            </nav>

            {/* Hero Section: The Anatomy of a Prompt */}
            <section className="relative min-h-screen flex flex-col items-center justify-center pt-32 pb-12 px-6 overflow-hidden">
                <div className="absolute inset-0 z-0">
                    <Image
                        src="/assets/landing/hero-anatomy.png"
                        alt="Expert Generation"
                        fill
                        className="object-cover opacity-20 mix-blend-luminosity scale-105"
                        priority
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f] via-transparent to-[#0a0a0f]" />
                </div>

                <div className="relative z-10 w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    <div className="space-y-8 animate-in fade-in slide-in-from-left-8 duration-1000">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
                            <span className="w-2 h-2 rounded-full bg-stillwater-teal animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/70">Powered exclusively by NanoBanana</span>
                        </div>

                        <h1 className="text-5xl md:text-8xl font-black uppercase tracking-tighter leading-[0.85]">
                            The <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-stillwater-teal to-accent">Stillwater</span> <br />
                            Collective
                        </h1>

                        <p className="text-lg md:text-xl text-foreground-muted max-w-xl font-medium">
                            Don&apos;t just generate. Master the craft. Join a guild of artists sharing the blueprints behind the world&apos;s most stunning AI imagery.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
                            <Button
                                onClick={signInWithGoogle}
                                size="lg"
                                className="h-16 px-12 group relative overflow-hidden bg-primary hover:bg-primary-hover rounded-2xl shadow-2xl shadow-primary/20"
                            >
                                <span className="relative z-10 flex items-center gap-3 text-sm font-black uppercase tracking-widest">
                                    Claim Your Membership
                                    <Icons.arrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </span>
                            </Button>
                            <p className="text-[10px] uppercase font-black tracking-widest opacity-40">Novice Friendly • Master Driven</p>
                        </div>
                    </div>

                    {/* Anatomy Card */}
                    <div className="relative animate-in fade-in slide-in-from-right-8 duration-1000 delay-300">
                        <Card variant="glass" className="p-8 rounded-[3rem] border-white/5 bg-white/[0.02] backdrop-blur-2xl shadow-2xl backdrop-glow">
                            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden mb-8 border border-white/10 shadow-lg">
                                <Image src="/assets/landing/hero-anatomy.png" alt="Anatomy Visual" fill className="object-cover" />
                            </div>

                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-primary">Anatomy of an Exemplar</span>
                                    <div className="flex gap-1">
                                        {[1, 2, 3].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/20" />)}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="p-4 rounded-xl bg-[#0a0a0f]/80 border border-white/5 font-mono text-xs leading-relaxed group hover:border-primary/50 transition-colors">
                                        <p className="text-white/40 mb-1 font-bold uppercase tracking-tighter text-[9px]">The Master Prompt</p>
                                        <span className="text-primary-hover">Subject:</span> Futuristic Greenhouse Architecture, <span className="text-stillwater-teal">Atmosphere:</span> Iridescent Light Refraction, <span className="text-accent">Style:</span> Shot on Phase One XF, 8K Ultra Detailed...
                                    </div>
                                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between group cursor-pointer hover:bg-primary/10 transition-all">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-primary">Novice Blueprint</p>
                                            <p className="text-[10px] text-foreground-muted font-bold uppercase tracking-tighter">&quot;Futuristic [Place] with [Color] lighting&quot;</p>
                                        </div>
                                        <Icons.play className="text-primary w-4 h-4" />
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </section>

            {/* The Collective Showcase */}
            <section className="py-32 px-6 relative overflow-hidden">
                <div className="max-w-7xl mx-auto space-y-16">
                    <div className="flex flex-col md:flex-row justify-between items-end gap-8">
                        <div className="space-y-4">
                            <span className="text-[10px] font-black uppercase tracking-widest text-accent">Curated Expertise</span>
                            <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter">Collective <br />Exemplars</h2>
                        </div>
                        <p className="text-foreground-muted font-medium max-w-sm">Every image in the collective is a lesson. Clone the prompt, learn the weights, master the model.</p>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { id: 1, title: 'Bioluminescent Canopy', prompt: 'Master-grade character lighting with NanoBanana...' },
                            { id: 2, title: 'Iridescent Synthesis', prompt: 'Prismatic light refraction through structural glass...' },
                            { id: 3, title: 'Cyber-Samurai 2.0', prompt: 'Highly detailed portrait with vibrant neon circuit...', },
                            { id: 4, title: 'Ethereal Stillwater', prompt: 'Serene landscape of bioluminescent plants at twilight...' }
                        ].map((card) => (
                            <div key={card.id} className="aspect-[3/4] rounded-3xl bg-white/[0.02] border border-white/10 overflow-hidden relative group cursor-pointer">
                                <Image
                                    src={`/assets/landing/community-${card.id}.png`}
                                    alt={card.title}
                                    fill
                                    className="object-cover opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700 grayscale group-hover:grayscale-0"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-0 group-hover:opacity-80 transition-opacity" />
                                <div className="absolute bottom-6 left-6 right-6 opacity-0 group-hover:opacity-100 transition-all translate-y-4 group-hover:translate-y-0 duration-500">
                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-0.5">Neural Identity</p>
                                            <h4 className="text-sm font-black uppercase text-white truncate leading-tight">
                                                {card.title}
                                            </h4>
                                        </div>
                                        <p className="text-[10px] font-medium text-white/50 line-clamp-2 italic leading-snug">
                                            &quot;{card.prompt}&quot;
                                        </p>
                                        <div className="flex gap-2">
                                            <div className="px-2 py-1 rounded-md bg-white/10 text-[8px] font-black uppercase hover:bg-primary transition-colors">Clone</div>
                                            <div className="px-2 py-1 rounded-md bg-white/10 text-[8px] font-black uppercase hover:bg-white/20 transition-colors">Inspect</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Collective Incentives */}
            {config?.incentives && (
                <section className="py-32 px-6">
                    <div className="max-w-4xl mx-auto">
                        <div className="text-center mb-16 space-y-4">
                            <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter">Member <span className="text-primary">Privileges</span></h2>
                            <p className="text-foreground-muted font-bold uppercase tracking-widest text-xs">Join the collective and claim your starter kit</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Standard Rewards */}
                            <Card variant="glass" className="p-8 rounded-[2.5rem] border-white/5 bg-white/[0.01] transition-all hover:bg-white/[0.03]">
                                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl mb-6">🪙</div>
                                <h3 className="text-lg font-black uppercase tracking-tight mb-2">Welcome Kit</h3>
                                <p className="text-[10px] text-foreground-muted font-medium mb-4">Start with {config.incentives.welcomeCredits.amount} studio credits and a {config.incentives.masterPass.durationHours}h Master Pass.</p>
                                <div className="h-1 w-8 bg-primary rounded-full" />
                            </Card>

                            {/* Knowledge Bounty */}
                            {config.incentives.knowledgeBounty?.enabled && (
                                <Card variant="glass" className="p-8 rounded-[2.5rem] border-primary/20 bg-primary/5 transition-all hover:scale-105 active:scale-95 cursor-pointer">
                                    <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-2xl mb-6">🚀</div>
                                    <h3 className="text-lg font-black uppercase tracking-tight mb-2 text-primary">Knowledge Bounty</h3>
                                    <p className="text-[10px] text-foreground/70 font-medium mb-4">Earn {config.incentives.knowledgeBounty.rewardAmount} credits every time the community clones your prompt blueprints.</p>
                                    <div className="h-1 w-8 bg-primary rounded-full shadow-[0_0_10px_var(--primary)]" />
                                </Card>
                            )}

                            {/* Status */}
                            <Card variant="glass" className="p-8 rounded-[2.5rem] border-white/5 bg-white/[0.01] transition-all hover:bg-white/[0.03]">
                                <div className="w-12 h-12 rounded-2xl bg-founder-gold/10 flex items-center justify-center text-2xl mb-6">🎖️</div>
                                <h3 className="text-lg font-black uppercase tracking-tight mb-2">Vanguard Status</h3>
                                <p className="text-[10px] text-foreground-muted font-medium mb-4">Expert contributors gain access to the Collector&apos;s Badge and NanoBanana Vanguard weights.</p>
                                <div className="h-1 w-8 bg-founder-gold rounded-full" />
                            </Card>
                        </div>

                        <div className="mt-16 text-center">
                            <Button
                                onClick={signInWithGoogle}
                                size="lg"
                                className="h-16 px-16 bg-white text-black hover:bg-white/90 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-white/10"
                            >
                                Join the Collective
                            </Button>
                        </div>
                    </div>
                </section>
            )}

            {/* Footer */}
            <footer className="py-24 px-6 border-t border-white/5 bg-background">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-12">
                    <div className="space-y-4 text-center md:text-left">
                        <div className="flex items-center gap-2 justify-center md:justify-start">
                            <Icons.sparkles className="text-primary w-5 h-5" />
                            <span className="font-black uppercase tracking-tighter">Stillwater Studio</span>
                        </div>
                        <p className="text-xs text-foreground-muted font-medium max-w-xs">
                            Home of **The Stillwater Collective**. Empowering the next generation of NanoBanana artists.
                        </p>
                    </div>

                    <div className="text-[10px] font-black uppercase tracking-widest text-foreground-muted opacity-40">
                        © 2024 Stillwater Studio • NanoBanana Collective
                    </div>
                </div>
            </footer>

            <style jsx>{`
                .backdrop-glow {
                    position: relative;
                }
                .backdrop-glow::after {
                    content: '';
                    position: absolute;
                    inset: -20px;
                    background: radial-gradient(circle, var(--primary) 0%, transparent 70%);
                    opacity: 0.1;
                    z-index: -1;
                    filter: blur(40px);
                }
            `}</style>
        </main>
    );
}
