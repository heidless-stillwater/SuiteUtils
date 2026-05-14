import { Variants } from "framer-motion";

export const fadeIn: Variants = {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.3 } },
    exit: { opacity: 0, transition: { duration: 0.15 } },
};

export const fadeInUp: Variants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.23, 1, 0.32, 1] } },
    exit: { opacity: 0, y: 20, transition: { duration: 0.2 } },
};

/** Lightweight fade-in for individual grid cards */
export const cardFadeIn: Variants = {
    initial: { opacity: 0, y: 12, scale: 0.97 },
    animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, ease: [0.23, 1, 0.32, 1] } },
};

/** Stagger container — orchestrates children with a 40ms delay between each */
export const staggerContainer: Variants = {
    initial: {},
    animate: {
        transition: {
            staggerChildren: 0.04,
            delayChildren: 0.05,
        },
    },
};

/** Slower stagger for feed/larger items */
export const staggerContainerSlow: Variants = {
    initial: {},
    animate: {
        transition: {
            staggerChildren: 0.08,
            delayChildren: 0.05,
        },
    },
};

export const scaleIn: Variants = {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1, transition: { duration: 0.25, ease: [0.23, 1, 0.32, 1] } },
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15 } },
};

export const slideInRight: Variants = {
    initial: { x: 20, opacity: 0 },
    animate: { x: 0, opacity: 1, transition: { duration: 0.3, ease: [0.23, 1, 0.32, 1] } },
    exit: { x: 20, opacity: 0, transition: { duration: 0.2 } },
};

/** Modal: slides up from bottom, scales slightly */
export const modalSlideUp: Variants = {
    initial: { opacity: 0, y: 40, scale: 0.97 },
    animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: [0.23, 1, 0.32, 1] } },
    exit: { opacity: 0, y: 30, scale: 0.98, transition: { duration: 0.2 } },
};

/** Modal backdrop */
export const backdropFade: Variants = {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.2 } },
    exit: { opacity: 0, transition: { duration: 0.2 } },
};

