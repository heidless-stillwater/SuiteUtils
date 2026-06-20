'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';

export type ModalStatus = 'idle' | 'saving' | 'success' | 'error';

interface StatusModalProps {
    status: ModalStatus;
    message?: string;
    onClose: () => void;
}

export default function StatusModal({ status, message, onClose }: StatusModalProps) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (status !== 'idle') {
            setIsVisible(true);
        } else {
            setIsVisible(false);
        }
    }, [status]);

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-background/60 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={status === 'success' || status === 'error' ? onClose : undefined}
            />

            {/* Modal Content */}
            <div className="relative bg-background-secondary border border-border p-8 max-w-sm w-full shadow-2xl shadow-primary/20 rounded-3xl animate-in zoom-in-95 duration-300 text-center">
                <div className="mb-6 flex justify-center">
                    {status === 'saving' && (
                        <div className="relative w-16 h-16">
                            <div className="absolute inset-0 border-4 border-primary/20 rounded-full" />
                            <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                            <span className="absolute inset-0 flex items-center justify-center text-xl">⏳</span>
                        </div>
                    )}
                    {status === 'success' && (
                        <div className="w-16 h-16 bg-success/20 rounded-full flex items-center justify-center text-3xl animate-in bounce-in duration-500">
                            ✅
                        </div>
                    )}
                    {status === 'error' && (
                        <div className="w-16 h-16 bg-error/20 rounded-full flex items-center justify-center text-3xl animate-in bounce-in duration-500">
                            ❌
                        </div>
                    )}
                </div>

                <h3 className="text-xl font-bold mb-2 uppercase tracking-tight">
                    {status === 'saving' && 'Saving Changes...'}
                    {status === 'success' && 'Configuration Saved'}
                    {status === 'error' && 'Something Went Wrong'}
                </h3>

                <p className="text-foreground-muted mb-8 text-sm font-medium">
                    {message || (
                        status === 'saving' ? 'Updating global system settings, please wait.' :
                            status === 'success' ? 'The updates have been applied successfully across the platform.' :
                                'We encountered an issue while saving. Please try again later.'
                    )}
                </p>

                {(status === 'success' || status === 'error') && (
                    <Button
                        onClick={onClose}
                        className="w-full h-12 rounded-xl text-[10px] font-black uppercase tracking-widest"
                    >
                        {status === 'success' ? 'Got it' : 'Try Again'}
                    </Button>
                )}
            </div>
        </div>
    );
}
