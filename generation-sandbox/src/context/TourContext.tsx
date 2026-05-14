'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export interface TourStep {
    id: string;
    targetId: string;
    title: string;
    content: string;
    path?: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
}

interface TourContextType {
    isActive: boolean;
    currentStep: number;
    steps: TourStep[];
    startTour: () => void;
    nextStep: () => void;
    prevStep: () => void;
    skipTour: () => void;
}

const DASHBOARD_STEPS: TourStep[] = [
    {
        id: 'welcome',
        targetId: 'dashboard-title',
        title: 'Welcome to the Studio!',
        content: "Let's take a quick 1-minute tour to help you master AI image generation.",
        position: 'bottom'
    },
    {
        id: 'credits',
        targetId: 'wallet-wisdom',
        title: 'Creative Energy',
        content: 'Your available credits are shown here. Different qualities consume different amounts of energy.',
        position: 'top'
    },
    {
        id: 'styles',
        targetId: 'starter-styles',
        title: 'Starter Styles',
        content: 'Not sure where to start? Pick one of these curated styles to jump-start your imagination.',
        position: 'top'
    },
    {
        id: 'go-to-studio',
        targetId: 'studio-link',
        title: 'Enter the Studio',
        content: "Ready to see the workshop? Let's head over to the Generator.",
        position: 'bottom',
        path: '/generate'
    }
];

const GENERATOR_STEPS: TourStep[] = [
    {
        id: 'prompting',
        targetId: 'prompt-input',
        title: 'The Vision Box',
        content: 'Type your wildest ideas here. Be descriptive for the best results!',
        position: 'bottom'
    },
    {
        id: 'magic',
        targetId: 'magic-enhance',
        title: 'AI Polish',
        content: 'Stuck? Use Enhance to let our AI polish your prompt into a masterpiece.',
        position: 'bottom'
    },
    {
        id: 'settings',
        targetId: 'settings-panel',
        title: 'Output Control',
        content: 'Adjust quality, aspect ratio, and batch size here before manifesting your creation.',
        position: 'left'
    },
    {
        id: 'finish',
        targetId: 'manifest-button',
        title: 'Manifest Reality',
        content: "You're all set! Click here to bring your vision to life. Happy creating!",
        position: 'top'
    }
];

const TourContext = createContext<TourContextType | undefined>(undefined);

export function TourProvider({ children }: { children: React.ReactNode }) {
    const [isActive, setIsActive] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const router = useRouter();
    const pathname = usePathname();

    const steps = pathname === '/generate' ? GENERATOR_STEPS : DASHBOARD_STEPS;

    const startTour = useCallback(() => {
        setCurrentStep(0);
        setIsActive(true);
    }, []);

    const skipTour = useCallback(() => {
        setIsActive(false);
        setCurrentStep(0);
    }, []);

    const nextStep = useCallback(() => {
        const currentStepData = steps[currentStep];

        if (currentStepData.path && pathname !== currentStepData.path) {
            router.push(currentStepData.path);
            // We don't increment yet, wait for path change if needed
            // But for this simple implementation, we'll assume the next step is on the new page
            setCurrentStep(0); // Reset for the new page's steps
            return;
        }

        if (currentStep < steps.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            setIsActive(false);
        }
    }, [currentStep, steps, pathname, router]);

    const prevStep = useCallback(() => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    }, [currentStep]);

    // Handle cross-page transitions
    useEffect(() => {
        if (isActive && pathname === '/generate' && currentStep === 0 && steps === GENERATOR_STEPS) {
            // If we just arrived at generate while tour is active, we stay on step 0 of the new steps
        }
    }, [pathname, isActive, steps]);

    return (
        <TourContext.Provider value={{ isActive, currentStep, steps, startTour, nextStep, prevStep, skipTour }}>
            {children}
        </TourContext.Provider>
    );
}

export function useTour() {
    const context = useContext(TourContext);
    if (!context) throw new Error('useTour must be used within a TourProvider');
    return context;
}
