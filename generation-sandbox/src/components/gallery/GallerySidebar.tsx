import { useState } from 'react';
import { Collection } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icons } from '@/components/ui/Icons';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/utils';

interface GallerySidebarProps {
    collections: Collection[];
    selectedCollectionId: string | null;
    onSelectCollection: (id: string | null) => void;
    onCreateCollection: () => void;

    // Filter Props
    filterQuality: 'all' | 'standard' | 'high' | 'ultra';
    onFilterQualityChange: (val: 'all' | 'standard' | 'high' | 'ultra') => void;
    filterAspectRatio: string;
    onFilterAspectRatioChange: (val: string) => void;
    filterTag: string;
    onFilterTagChange: (val: string) => void;
    filterExemplar: boolean;
    onFilterExemplarChange: (val: boolean) => void;
    filterCommunity: boolean;
    onFilterCommunityChange: (val: boolean) => void;

    // Collapse Props
    isCollapsed: boolean;
    onToggleCollapse: () => void;
}

export default function GallerySidebar({
    collections,
    selectedCollectionId,
    onSelectCollection,
    onCreateCollection,
    filterQuality,
    onFilterQualityChange,
    filterAspectRatio,
    onFilterAspectRatioChange,
    filterTag,
    onFilterTagChange,
    filterExemplar,
    onFilterExemplarChange,
    filterCommunity,
    onFilterCommunityChange,
    isCollapsed,
    onToggleCollapse
}: GallerySidebarProps) {
    const [isFiltersExpanded, setIsFiltersExpanded] = useState(true);
    const [isCollectionsExpanded, setIsCollectionsExpanded] = useState(true);

    if (isCollapsed) {
        return (
            <aside className="w-16 flex flex-col items-center py-4 gap-4 sticky top-4 self-start h-fit transition-all duration-300">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onToggleCollapse}
                    className="w-10 h-10 p-0 rounded-xl hover:bg-white/5 text-primary"
                >
                    <Icons.chevronRight size={20} />
                </Button>

                <div className="w-8 h-px bg-white/10" />

                <button
                    onClick={onToggleCollapse}
                    className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-white/5 transition-colors group"
                    title="Filters"
                >
                    <Icons.settings size={18} className="text-foreground-muted group-hover:text-primary transition-colors" />
                </button>

                <button
                    onClick={onToggleCollapse}
                    className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-white/5 transition-colors group"
                    title="Collections"
                >
                    <Icons.stack size={18} className="text-foreground-muted group-hover:text-primary transition-colors" />
                </button>
            </aside>
        );
    }

    return (
        <aside className="w-full lg:w-72 space-y-4 transition-all duration-300">
            {/* Header / Toggle */}
            <div className="flex items-center justify-between px-2 mb-2">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">Studio Controls</span>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onToggleCollapse}
                    className="h-8 px-2 text-[10px] font-black uppercase tracking-widest text-foreground-muted hover:text-primary gap-1.5"
                >
                    <Icons.chevronLeft size={14} />
                    Collapse
                </Button>
            </div>

            {/* Filters Section */}
            <Card className="p-0 overflow-hidden" variant="glass">
                <button
                    onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
                    className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors group"
                >
                    <div className="flex items-center gap-2">
                        <Icons.settings size={14} className="text-primary" />
                        <h2 className="font-black text-[10px] uppercase tracking-widest text-foreground-muted group-hover:text-foreground">Filters</h2>
                    </div>
                    <Icons.chevronDown
                        size={14}
                        className={cn("text-foreground-muted transition-transform duration-300", isFiltersExpanded ? "" : "-rotate-90")}
                    />
                </button>

                <div className={cn(
                    "overflow-hidden transition-all duration-300",
                    isFiltersExpanded ? "max-h-[1000px] opacity-100 p-4 pt-0" : "max-h-0 opacity-0"
                )}>
                    <div className="space-y-4">
                        {/* Master Filter Dropdown */}
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase tracking-widest text-white/40 ml-1">Quick Filter</label>
                            <Select
                                value={filterExemplar ? 'exemplar' : filterCommunity ? 'community' : filterTag !== 'all' ? filterTag : 'all'}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === 'exemplar') {
                                        onFilterExemplarChange(true);
                                        onFilterCommunityChange(false);
                                        onFilterTagChange('all');
                                    } else if (val === 'community') {
                                        onFilterExemplarChange(false);
                                        onFilterCommunityChange(true);
                                        onFilterTagChange('all');
                                    } else if (val === 'all') {
                                        onFilterExemplarChange(false);
                                        onFilterCommunityChange(false);
                                        onFilterTagChange('all');
                                    } else {
                                        onFilterExemplarChange(false);
                                        onFilterCommunityChange(false);
                                        onFilterTagChange(val);
                                    }
                                }}
                                className="h-9 text-[10px] font-black uppercase tracking-widest bg-zinc-900/50 border-white/5"
                            >
                                <option value="all">All Assets</option>
                                <optgroup label="STATUS" className="bg-zinc-950 text-zinc-500">
                                    <option value="exemplar">Exemplars</option>
                                    <option value="community">Community Hub</option>
                                </optgroup>
                                <optgroup label="POPULAR TAGS" className="bg-zinc-950 text-zinc-500">
                                    <option value="ai">#AI</option>
                                    <option value="portrait">#Portrait</option>
                                    <option value="landscape">#Landscape</option>
                                </optgroup>
                            </Select>
                        </div>

                        {/* Detailed Filters */}
                        <div className="grid grid-cols-1 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black uppercase tracking-widest text-white/40 ml-1">Quality</label>
                                <Select
                                    value={filterQuality}
                                    onChange={(e) => onFilterQualityChange(e.target.value as any)}
                                    className="h-9 text-[10px] font-black uppercase tracking-widest bg-zinc-900/50 border-white/5"
                                >
                                    <option value="all">Any Quality</option>
                                    <option value="standard">Standard</option>
                                    <option value="high">High Def</option>
                                    <option value="ultra">Ultra 4K</option>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black uppercase tracking-widest text-white/40 ml-1">Aspect Ratio</label>
                                <Select
                                    value={filterAspectRatio}
                                    onChange={(e) => onFilterAspectRatioChange(e.target.value)}
                                    className="h-9 text-[10px] font-black uppercase tracking-widest bg-zinc-900/50 border-white/5"
                                >
                                    <option value="all">Any Ratio</option>
                                    <option value="1:1">1:1 Square</option>
                                    <option value="16:9">16:9 Cinema</option>
                                    <option value="9:16">9:16 Portrait</option>
                                    <option value="4:5">4:5 Social</option>
                                    <option value="3:2">3:2 Classic</option>
                                </Select>
                            </div>
                        </div>

                        <Button
                            variant="secondary"
                            size="sm"
                            className="w-full h-9 text-[9px] font-black uppercase tracking-widest gap-2 bg-white/5 border-white/5 hover:bg-white/10"
                        >
                            <Icons.plus size={12} />
                            Add New Filter
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Collections Section */}
            <Card className="p-0 overflow-hidden" variant="glass">
                <button
                    onClick={() => setIsCollectionsExpanded(!isCollectionsExpanded)}
                    className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors group"
                >
                    <div className="flex items-center gap-2">
                        <Icons.stack size={14} className="text-primary" />
                        <h2 className="font-black text-[10px] uppercase tracking-widest text-foreground-muted group-hover:text-foreground">Collections</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <Icons.chevronDown
                            size={14}
                            className={cn("text-foreground-muted transition-transform duration-300", isCollectionsExpanded ? "" : "-rotate-90")}
                        />
                    </div>
                </button>

                <div className={cn(
                    "overflow-hidden transition-all duration-300",
                    isCollectionsExpanded ? "max-h-[1000px] opacity-100 p-4 pt-0" : "max-h-0 opacity-0"
                )}>
                    <div className="flex items-center justify-between mb-4 px-1">
                        <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Your Vaults</span>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={onCreateCollection}
                            className="h-7 px-2 text-[9px] font-black uppercase tracking-wider gap-1.5 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                        >
                            <Icons.plus size={10} />
                            New
                        </Button>
                    </div>

                    <div className="space-y-1">
                        <Button
                            variant={!selectedCollectionId ? 'primary' : 'ghost'}
                            onClick={() => onSelectCollection(null)}
                            className={cn(
                                "w-full justify-start h-10 px-3 text-sm font-bold transition-all group",
                                !selectedCollectionId ? "shadow-lg shadow-primary/20" : "text-foreground-muted hover:text-foreground hover:bg-background-secondary/80"
                            )}
                        >
                            <Icons.grid size={16} className={cn("mr-2.5 transition-colors", !selectedCollectionId ? "text-white" : "text-foreground-muted group-hover:text-primary")} />
                            All Assets
                        </Button>

                        {collections.map(col => (
                            <Button
                                key={col.id}
                                variant={selectedCollectionId === col.id ? 'primary' : 'ghost'}
                                onClick={() => onSelectCollection(col.id)}
                                className={cn(
                                    "w-full justify-between h-10 px-3 text-sm font-bold transition-all group",
                                    selectedCollectionId === col.id ? "shadow-lg shadow-primary/20" : "text-foreground-muted hover:text-foreground hover:bg-background-secondary/80"
                                )}
                            >
                                <span className="truncate flex items-center">
                                    <Icons.history size={16} className={cn("mr-2.5 transition-colors opacity-50", selectedCollectionId === col.id ? "text-white opacity-100" : "text-foreground-muted group-hover:text-primary group-hover:opacity-100")} />
                                    {col.name}
                                </span>
                                {col.imageCount > 0 && (
                                    <Badge
                                        variant={selectedCollectionId === col.id ? 'glass' : 'secondary'}
                                        size="sm"
                                        className={cn(
                                            "ml-2 transition-all",
                                            selectedCollectionId === col.id ? "bg-white/20 border-white/10" : "bg-background-secondary border-transparent text-foreground-muted font-bold"
                                        )}
                                    >
                                        {col.imageCount}
                                    </Badge>
                                )}
                            </Button>
                        ))}
                    </div>
                </div>
            </Card>
        </aside>
    );
}

