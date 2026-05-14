'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface CustomButton {
    label: string;
    onClick: () => void;
    className?: string;
}

interface ConfirmationModalProps {
    isOpen: boolean;
    title: string;
    message?: string;
    children?: React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm?: () => void | Promise<void>;
    onCancel?: () => void;
    isLoading?: boolean;
    type?: 'danger' | 'info' | 'warning';
    customButtons?: CustomButton[];
}

export default function ConfirmationModal({
    isOpen,
    title,
    message,
    children,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    onConfirm,
    onCancel,
    isLoading = false,
    type = 'info',
    customButtons
}: ConfirmationModalProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    const variantMap = {
        danger: 'danger',
        warning: 'primary',
        info: 'primary'
    } as const;

    const buttonVariant = variantMap[type] || 'primary';

    const modalContent = (
        <AnimatePresence mode="wait">
            {isOpen && (
                <div className="fixed inset-0 top-0 left-0 w-screen h-screen z-[9999] flex items-center justify-center p-4 isolate">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/80 backdrop-blur-xl"
                        onClick={isLoading ? undefined : onCancel}
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 30 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 30 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300, mass: 0.8 }}
                        className="max-w-md w-full relative z-10"
                    >
                        <Card
                            className="relative p-10 shadow-[0_0_100px_rgba(99,102,241,0.2)] bg-[#0a0a0f]/95 rounded-[3rem] border border-white/5 backdrop-blur-3xl overflow-hidden"
                        >
                            <div className="absolute -top-24 -right-24 w-60 h-60 bg-primary/10 rounded-full blur-[80px]" />
                            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-primary/5 rounded-full blur-[60px]" />

                            <div className="mb-8 flex flex-col items-center text-center">
                                <div className={`w-20 h-20 rounded-[2.5rem] flex items-center justify-center mb-6 shadow-2xl ${type === 'danger' ? 'bg-error/10 border border-error/30' : 'bg-primary/10 border border-primary/30'}`}>
                                    <div className={`w-3 h-3 rounded-full animate-pulse ${type === 'danger' ? 'bg-error shadow-[0_0_20px_rgba(239,68,68,0.6)]' : 'bg-primary shadow-[0_0_20px_rgba(99,102,241,0.6)]'}`} />
                                </div>
                                <h3 className="text-3xl font-black uppercase tracking-tighter text-white leading-tight">{title}</h3>
                                <div className="h-1 w-16 bg-gradient-to-r from-transparent via-primary/40 to-transparent mt-4" />
                            </div>

                            <div className="text-foreground/70 mb-10 text-sm leading-relaxed text-center font-medium max-w-[320px] mx-auto">
                                {message && <p className="mb-4">{message}</p>}
                                {children}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {customButtons ? (
                                    customButtons.map((btn, idx) => (
                                        <button
                                            key={idx}
                                            onClick={btn.onClick}
                                            className={btn.className || "py-4 px-6 rounded-2xl bg-primary text-white text-[10px] font-black uppercase tracking-widest hover:bg-primary-hover hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-primary/20"}
                                        >
                                            {btn.label}
                                        </button>
                                    ))
                                ) : (
                                    <>
                                        <Button
                                            variant="secondary"
                                            onClick={onCancel}
                                            disabled={isLoading}
                                            className="h-14 font-black uppercase tracking-widest text-[10px] rounded-2xl bg-white/5 border-white/10 hover:bg-white/10"
                                        >
                                            {cancelLabel}
                                        </Button>
                                        <Button
                                            variant={buttonVariant}
                                            onClick={onConfirm}
                                            disabled={isLoading}
                                            isLoading={isLoading}
                                            className="h-14 font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-xl shadow-primary/20"
                                        >
                                            {confirmLabel}
                                        </Button>
                                    </>
                                )}
                            </div>
                        </Card>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );

    return createPortal(modalContent, document.body);
}
