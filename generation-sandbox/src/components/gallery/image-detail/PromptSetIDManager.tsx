import { Icons } from '@/components/ui/Icons';

interface PromptSetIDManagerProps {
    promptSetID?: string;
    isEditing: boolean;
    editingValue: string;
    isSaving: boolean;
    existingPromptSetIDs: { id: string, thumbUrl: string }[];
    isLoadingSuggestions: boolean;
    onStartEditing: () => void;
    onCancelEditing: () => void;
    onChangeValue: (value: string) => void;
    onSave: () => void;
}

export default function PromptSetIDManager({
    promptSetID,
    isEditing,
    editingValue,
    isSaving,
    existingPromptSetIDs,
    isLoadingSuggestions,
    onStartEditing,
    onCancelEditing,
    onChangeValue,
    onSave
}: PromptSetIDManagerProps) {
    const filteredSuggestions = existingPromptSetIDs
        .filter(item => {
            // Always show all IDs if the input is empty or stays as the initial ID
            if (!editingValue || editingValue === promptSetID) return true;
            // Otherwise filter by substring
            return item.id.toLowerCase().includes(editingValue.toLowerCase());
        })
        .slice(0, 50);

    return (
        <div className="">
            <div className="flex justify-between items-center mb-1">
                <label className="text-xs text-foreground-muted uppercase tracking-wide">Prompt Set ID</label>
                {!isEditing && (
                    <button
                        onClick={onStartEditing}
                        className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary/80 transition-colors"
                    >
                        Edit
                    </button>
                )}
            </div>
            {isEditing ? (
                <div className="mt-2 space-y-2 relative">
                    <input
                        type="text"
                        value={editingValue}
                        onChange={(e) => onChangeValue(e.target.value)}
                        placeholder="No Set ID"
                        className="w-full px-4 py-2.5 rounded-xl bg-background-secondary border border-border text-foreground text-sm transition-all duration-200 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 placeholder:text-foreground-muted"
                        autoFocus
                    />

                    {isEditing && (filteredSuggestions.length > 0 || isLoadingSuggestions) && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-background border border-border rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-border/50 max-h-60 overflow-y-auto custom-scrollbar">
                            <div className="bg-background-secondary p-2 px-4 border-b border-border/50 flex justify-between items-center sticky top-0 z-20">
                                <span className="text-[9px] font-black uppercase tracking-widest text-foreground-muted">
                                    {isLoadingSuggestions ? 'Scanning History...' : `${existingPromptSetIDs.length} Prompt Sets Found`}
                                </span>
                            </div>
                            {isLoadingSuggestions ? (
                                <div className="p-3 text-[10px] text-foreground-muted flex items-center justify-center gap-2">
                                    <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                                    Loading Set IDs...
                                </div>
                            ) : (
                                filteredSuggestions.map(item => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => onChangeValue(item.id)}
                                        className={`w-full text-left px-3 py-2.5 hover:bg-primary/5 transition-colors flex items-center gap-4 group ${item.id === promptSetID ? 'bg-primary/5 text-primary' : ''}`}
                                    >
                                        <div className="w-12 h-12 rounded-lg bg-background-tertiary overflow-hidden flex-shrink-0 border border-border/50 shadow-sm">
                                            {item.thumbUrl ? (
                                                <img src={item.thumbUrl} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-foreground-muted">
                                                    <Icons.image size={16} />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col min-w-0 flex-1">
                                            <span className={`text-[11px] font-mono font-bold truncate ${item.id === promptSetID ? 'text-primary' : 'text-foreground/90'}`}>
                                                {item.id}
                                            </span>
                                            <span className="text-[9px] text-foreground-muted uppercase tracking-wider font-black opacity-60 mt-0.5">
                                                Latest Image
                                            </span>
                                        </div>
                                        {item.id === promptSetID ? (
                                            <div className="px-2 py-0.5 rounded bg-primary/10 text-[8px] uppercase tracking-widest text-primary font-black">
                                                Current
                                            </div>
                                        ) : (
                                            <span className="text-[8px] opacity-0 group-hover:opacity-100 uppercase tracking-widest text-foreground-muted font-black group-hover:text-primary transition-all">
                                                Select
                                            </span>
                                        )}
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                    <div className="flex gap-2">
                        <button
                            onClick={onSave}
                            disabled={isSaving}
                            className="flex-1 bg-primary text-white text-[10px] font-black uppercase tracking-widest py-2 rounded-xl hover:bg-primary-hover transition-colors disabled:opacity-50"
                        >
                            {isSaving ? 'Saving...' : 'Save'}
                        </button>
                        <button
                            onClick={onCancelEditing}
                            disabled={isSaving}
                            className="px-3 bg-background-secondary text-foreground text-[10px] font-black uppercase tracking-widest py-2 rounded-xl hover:bg-background-tertiary transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <div
                    onClick={onStartEditing}
                    className="mt-1 flex items-center justify-between p-3 bg-background-secondary border border-border/50 rounded-xl cursor-pointer hover:border-primary/50 transition-all group/sid"
                >
                    <p className="text-xs font-mono text-foreground-muted truncate" title={promptSetID}>
                        {promptSetID || 'No Set ID'}
                    </p>
                    <Icons.settings size={12} className="text-foreground-muted group-hover/sid:text-primary transition-colors opacity-0 group-hover/sid:opacity-100" />
                </div>
            )}
        </div>
    );
}

