'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useTour } from '@/context/TourContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Icons } from './ui/Icons';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { cn } from '@/lib/utils';

export default function GuidedTour() {
    const { isActive, currentStep, steps, nextStep, skipTour, prevStep } = useTour();
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const step = steps[currentStep];

    useEffect(() => {
        if (!isActive || !step) return;

        const updateRect = () => {
            const el = document.getElementById(step.targetId);
            if (el) {
                setTargetRect(el.getBoundingClientRect());
            } else {
                setTargetRect(null);
            }
        };

        updateRect();
        window.addEventListener('resize', updateRect);
        window.addEventListener('scroll', updateRect);

        // Retry a few times in case elements are mounting
        const interval = setInterval(updateRect, 500);

        return () => {
            window.removeEventListener('resize', updateRect);
            window.removeEventListener('scroll', updateRect);
            clearInterval(interval);
        };
    }, [isActive, step]);

    if (!isActive || !step) return null;

    return (
        <div className="fixed inset-0 z-[200] pointer-events-none">
            {/* Dark Overlay with Hole */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-[1px] pointer-events-auto"
                style={{
                    clipPath: targetRect ? `polygon(
                        0% 0%, 
                        0% 100%, 
                        ${targetRect.left - 8}px 100%, 
                        ${targetRect.left - 8}px ${targetRect.top - 8}px, 
                        ${targetRect.right + 8}px ${targetRect.top - 8}px, 
                        ${targetRect.right + 8}px ${targetRect.bottom + 8}px, 
                        ${targetRect.left - 8}px ${targetRect.bottom + 8}px, 
                        ${targetRect.left - 8}px 100%, 
                        100% 100%, 
                        100% 0%
                    )` : 'none'
                }}
                onClick={skipTour}
            />

            {/* Spotlight Border Glow */}
            <AnimatePresence>
                {targetRect && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="absolute border-2 border-primary rounded-2xl shadow-[0_0_20px_rgba(99,102,241,0.5)] bg-primary/5"
                        style={{
                            top: targetRect.top - 12,
                            left: targetRect.left - 12,
                            width: targetRect.width + 24,
                            height: targetRect.height + 24,
                        }}
                    >
                        <motion.div
                            className="absolute inset-0 border-primary/30 rounded-2xl"
                            animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.6, 0.3] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Tooltip */}
            <AnimatePresence mode="wait">
                {targetRect && (
                    <motion.div
                        key={step.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="absolute pointer-events-auto z-[210] max-w-sm"
                        style={{
                            top: step.position === 'top' ? targetRect.top - 200 :
                                step.position === 'bottom' ? targetRect.bottom + 20 :
                                    targetRect.top + (targetRect.height / 2) - 100,
                            left: step.position === 'left' ? targetRect.left - 380 :
                                step.position === 'right' ? targetRect.right + 20 :
                                    targetRect.left + (targetRect.width / 2) - 180,
                        }}
                    >
                        <Card variant="glass" className="p-6 shadow-2xl border-primary/20 bg-background/90 backdrop-blur-xl">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="p-1.5 bg-primary/20 rounded-lg text-primary">
                                    <Icons.sparkles size={16} />
                                </div>
                                <h4 className="text-lg font-black tracking-tight">{step.title}</h4>
                            </div>
                            <p className="text-sm text-foreground-muted mb-6 leading-relaxed">
                                {step.content}
                            </p>
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex gap-1">
                                    {steps.map((_, i) => (
                                        <div
                                            key={i}
                                            className={cn(
                                                "w-1.5 h-1.5 rounded-full transition-all duration-300",
                                                i === currentStep ? "bg-primary w-4" : "bg-border"
                                            )}
                                        />
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="ghost" size="sm" onClick={skipTour} className="text-xs">Skip</Button>
                                    <Button variant="primary" size="sm" onClick={nextStep} className="px-6">
                                        {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
