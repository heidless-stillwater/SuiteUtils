import React from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { Icons } from './Icons';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  variant?: 'danger' | 'primary';
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  variant = 'primary',
  isLoading = false
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <Card 
        variant="glass" 
        className="w-full max-w-md p-6 border-white/10 shadow-2xl scale-in-center animate-in zoom-in-95 duration-200"
      >
        <div className="flex items-center gap-4 mb-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${
            variant === 'danger' 
              ? 'bg-red-500/10 border-red-500/20 text-red-500' 
              : 'bg-primary/10 border-primary/20 text-primary'
          }`}>
            {variant === 'danger' ? <Icons.delete className="w-6 h-6" /> : <Icons.shield className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="text-lg font-black uppercase tracking-tight">{title}</h3>
            <p className="text-sm text-white/50">{description}</p>
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-8">
          <Button 
            variant="ghost" 
            onClick={onClose}
            disabled={isLoading}
            className="text-white/50 hover:text-white"
          >
            Cancel
          </Button>
          <Button 
            variant={variant === 'danger' ? 'destructive' : 'default'}
            onClick={onConfirm}
            isLoading={isLoading}
            className="px-8 font-black uppercase tracking-widest text-[10px]"
          >
            {confirmText}
          </Button>
        </div>
      </Card>
    </div>
  );
}
