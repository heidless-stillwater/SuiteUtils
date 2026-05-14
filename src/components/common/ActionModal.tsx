import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Rocket, RotateCcw } from 'lucide-react';

interface ActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel: string;
  confirmVariant?: 'primary' | 'danger';
  type?: 'deploy' | 'rollback';
  isLoading?: boolean;
}

export function ActionModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  confirmVariant = 'primary',
  type = 'deploy',
  isLoading = false
}: ActionModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!mounted) return null;

  const Icon = type === 'deploy' ? Rocket : RotateCcw;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed top-0 left-0 w-screen h-screen z-[9999] flex items-center justify-center pointer-events-none"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative z-[10000] w-full max-w-md pointer-events-auto mx-4"
          >
            {/* Modal Content */}
            <div className="relative flex flex-col w-full bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl outline-none focus:outline-none overflow-hidden">
              {/* Header Accent */}
              <div className={`h-1.5 w-full ${confirmVariant === 'danger' ? 'bg-red-500' : 'bg-primary'}`} />
              
              <div className="p-6">
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-1 rounded-full text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${confirmVariant === 'danger' ? 'bg-red-500/10 text-red-400' : 'bg-primary/10 text-primary'}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-white mb-1">
                      {title}
                    </h3>
                    <p className="text-sm text-white/40 leading-relaxed">
                      {message}
                    </p>
                  </div>
                </div>

                <div className="mt-8 flex items-center justify-end gap-3">
                  <button
                    onClick={onClose}
                    disabled={isLoading}
                    className="px-4 py-2 text-sm font-black uppercase tracking-widest text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={onConfirm}
                    disabled={isLoading}
                    autoFocus
                    className={`relative px-6 py-2.5 text-xs font-black uppercase tracking-[0.2em] text-white rounded-xl transition-all shadow-lg active:scale-95 flex items-center gap-2 ${
                      confirmVariant === 'danger' 
                        ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' 
                        : 'bg-primary hover:bg-primary/90 shadow-primary/20'
                    } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isLoading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                    {confirmLabel}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
