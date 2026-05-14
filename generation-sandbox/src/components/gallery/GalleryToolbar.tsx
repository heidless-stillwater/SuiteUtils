import { Collection } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Icons } from '@/components/ui/Icons';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

interface GalleryToolbarProps {
    viewMode: 'personal' | 'admin' | 'global';
    setViewMode: (mode: 'personal' | 'admin' | 'global') => void;
    isSu: boolean;
    isGrouped: boolean;
    onToggleGrouped: () => void;
    selectionMode: boolean;
    onToggleSelectionMode: () => void;
    onClearSelection: () => void;
    sortMode: 'newest' | 'oldest' | 'az' | 'za' | 'recent_update' | 'old_update';
    onSortChange: (mode: 'newest' | 'oldest' | 'az' | 'za' | 'recent_update' | 'old_update') => void;
    gridDensity: number;
    onGridDensityChange: (density: number) => void;
}


export default function GalleryToolbar({
    viewMode, setViewMode, isSu,
    isGrouped, onToggleGrouped,
    selectionMode, onToggleSelectionMode, onClearSelection,
    sortMode, onSortChange,
    gridDensity, onGridDensityChange
}: GalleryToolbarProps) {



    return (
        <div className="space-y-6">
            <Card variant="glass" className="p-4 flex flex-wrap gap-3 items-center">
                {/* Filters */}
                <div className="flex flex-wrap gap-3 items-center w-full">
                    <div className="flex bg-background-secondary/50 rounded-xl p-1 border border-border/50">
                        <Button
                            variant={!isGrouped ? 'primary' : 'ghost'}
                            size="sm"
                            onClick={() => !isGrouped ? null : onToggleGrouped()}
                            className={cn(
                                "rounded-lg text-[10px] h-8 px-4 font-black tracking-widest uppercase transition-all",
                                !isGrouped ? "shadow-lg shadow-primary/20" : "text-foreground-muted hover:text-foreground"
                            )}
                        >
                            <Icons.grid size={14} className="mr-2" />
                            Grid
                        </Button>
                        <Button
                            variant={isGrouped ? 'primary' : 'ghost'}
                            size="sm"
                            onClick={() => isGrouped ? null : onToggleGrouped()}
                            className={cn(
                                "rounded-lg text-[10px] h-8 px-4 font-black tracking-widest uppercase transition-all",
                                isGrouped ? "shadow-lg shadow-primary/20" : "text-foreground-muted hover:text-foreground"
                            )}
                        >
                            <Icons.stack size={14} className="mr-2" />
                            Sets
                        </Button>
                    </div>

                    <div className="h-6 w-px bg-border/50 mx-1 hidden md:block" />

                    <Button
                        variant={selectionMode ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => {
                            onToggleSelectionMode();
                            if (selectionMode) onClearSelection();
                        }}
                        className={cn(
                            "h-10 px-4 text-[10px] font-black tracking-widest uppercase gap-2 transition-all",
                            selectionMode ? "bg-accent hover:bg-accent-hover shadow-lg shadow-accent/20 border-accent" : "bg-background-secondary/50"
                        )}
                    >
                        <Icons.check size={14} />
                        {selectionMode ? 'Finish' : 'Select'}
                    </Button>

                    {isSu && (
                        <>
                            <div className="h-6 w-px bg-border/50 mx-1 hidden md:block" />
                            <div className="flex bg-background-secondary/50 rounded-xl p-1 border border-primary/20 ring-1 ring-primary/10">
                                <Button
                                    variant={viewMode === 'personal' ? 'primary' : 'ghost'}
                                    size="sm"
                                    onClick={() => setViewMode('personal')}
                                    className={cn(
                                        "rounded-lg text-[9px] h-8 px-3 font-black tracking-widest uppercase transition-all",
                                        viewMode === 'personal' ? "shadow-lg shadow-primary/20" : "text-foreground-muted hover:text-foreground"
                                    )}
                                >
                                    Personal
                                </Button>
                                <Button
                                    variant={viewMode === 'admin' ? 'primary' : 'ghost'}
                                    size="sm"
                                    onClick={() => setViewMode('admin')}
                                    className={cn(
                                        "rounded-lg text-[9px] h-8 px-3 font-black tracking-widest uppercase transition-all",
                                        viewMode === 'admin' ? "bg-accent hover:bg-accent-hover text-white shadow-lg shadow-accent/20" : "text-foreground-muted hover:text-foreground"
                                    )}
                                >
                                    Admins
                                </Button>
                                <Button
                                    variant={viewMode === 'global' ? 'primary' : 'ghost'}
                                    size="sm"
                                    onClick={() => setViewMode('global')}
                                    className={cn(
                                        "rounded-lg text-[9px] h-8 px-3 font-black tracking-widest uppercase transition-all",
                                        viewMode === 'global' ? "bg-error hover:bg-error-hover text-white shadow-lg shadow-error/20" : "text-foreground-muted hover:text-foreground"
                                    )}
                                >
                                    Global
                                </Button>
                            </div>
                        </>
                    )}

                    <div className="flex bg-background-secondary/50 rounded-xl p-1 border border-border/50 ml-auto">
                        {[2, 3, 4, 5, 6].map(num => (
                            <Button
                                key={num}
                                variant={gridDensity === num ? 'primary' : 'ghost'}
                                size="sm"
                                onClick={() => onGridDensityChange(num)}
                                className={cn(
                                    "w-8 h-8 p-0 rounded-lg text-[9px] font-black uppercase transition-all",
                                    gridDensity === num ? "shadow-lg shadow-primary/20" : "text-foreground-muted hover:text-foreground"
                                )}
                            >
                                {num}C
                            </Button>
                        ))}
                    </div>

                    <div className="flex gap-2 items-center">
                        <Select
                            value={sortMode}
                            onChange={(e) => onSortChange(e.target.value as any)}
                            className="h-10 text-[10px] font-black uppercase tracking-widest bg-zinc-900 text-white border-zinc-800 min-w-[200px]"
                        >
                            <optgroup label="ALPHABETICAL" className="bg-zinc-950 text-zinc-500 text-[10px] uppercase font-black tracking-widest">
                                <option value="az">A to Z</option>
                                <option value="za">Z to A</option>
                            </optgroup>
                            <optgroup label="GENERATION DATE" className="bg-zinc-950 text-zinc-500 text-[10px] uppercase font-black tracking-widest">
                                <option value="newest">Newest First</option>
                                <option value="oldest">Oldest First</option>
                            </optgroup>
                            <optgroup label="LAST MODIFIED" className="bg-zinc-950 text-zinc-500 text-[10px] uppercase font-black tracking-widest">
                                <option value="recent_update">Recently Updated</option>
                                <option value="old_update">Least Recently Updated</option>
                            </optgroup>
                        </Select>
                    </div>
                </div>
            </Card>


        </div>
    );
}
