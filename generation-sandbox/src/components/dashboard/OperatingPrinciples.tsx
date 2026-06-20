'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Icons } from '@/components/ui/Icons';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface OperatingPrinciplesProps {
    principles: string[];
    onUpdate: (nextPrinciples: string[]) => void;
}

export default function OperatingPrinciples({ principles, onUpdate }: OperatingPrinciplesProps) {
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editValue, setEditValue] = useState('');

    const handleStartEdit = (index: number) => {
        setEditingIndex(index);
        setEditValue(principles[index]);
    };

    const handleSave = () => {
        if (editingIndex !== null) {
            const next = [...principles];
            next[editingIndex] = editValue;
            onUpdate(next);
            setEditingIndex(null);
        }
    };

    return (
        <Card variant="glass" className="p-6 mb-8 border-primary/20">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Icons.terminal className="text-primary" size={18} />
                    <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Operating Principles</h2>
                </div>
                <Badge variant="glass" className="bg-primary/10 text-primary border-primary/20">EDITABLE_MODE</Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {principles.map((principle, idx) => (
                    <div 
                        key={idx}
                        onClick={() => handleStartEdit(idx)}
                        className="group relative p-4 bg-white/5 border border-white/5 rounded-xl hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer overflow-hidden"
                    >
                        <div className="flex items-start gap-3">
                            <span className="text-[10px] font-black text-primary/40 mt-0.5">{String(idx + 1).padStart(2, '0')}</span>
                            <p className="text-sm font-medium text-white/80 group-hover:text-white transition-colors leading-relaxed">
                                {principle}
                            </p>
                        </div>
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Icons.edit size={12} className="text-primary" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Cinematic Edit Modal */}
            {editingIndex !== null && (
                <div className="fixed inset-0 z-[500] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <Card variant="glass" className="max-w-lg w-full p-8 border-primary/30 shadow-2xl shadow-primary/10">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary mb-6">Refine Principle</h3>
                        <textarea
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-full h-32 bg-black/40 border border-white/10 rounded-xl p-4 text-white text-sm focus:border-primary/50 outline-none transition-all resize-none font-medium"
                            autoFocus
                        />
                        <div className="flex justify-end gap-3 mt-8">
                            <Button variant="ghost" onClick={() => setEditingIndex(null)}>Cancel</Button>
                            <Button onClick={handleSave} className="px-8 shadow-lg shadow-primary/20">Sync Change</Button>
                        </div>
                    </Card>
                </div>
            )}
        </Card>
    );
}
