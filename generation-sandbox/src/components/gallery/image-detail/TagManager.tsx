
interface TagManagerProps {
    tags: string[];
    newTag: string;
    isUpdating: boolean;
    onAdd: () => void;
    onRemove: (tag: string) => void;
    onChangeNewTag: (value: string) => void;
}

export default function TagManager({ tags, newTag, isUpdating, onAdd, onRemove, onChangeNewTag }: TagManagerProps) {
    return (
        <div className="">
            <label className="text-[10px] font-black uppercase tracking-widest text-foreground-muted flex items-center justify-between mb-2">
                Tags
                {isUpdating && <div className="spinner-xs" />}
            </label>

            <div className="flex flex-wrap gap-1.5 mb-3">
                {tags.map(tag => (
                    <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-[11px] font-medium rounded-full border border-primary/20 group/tag"
                    >
                        #{tag}
                        <button
                            onClick={() => onRemove(tag)}
                            className="hover:text-red-500 transition-colors"
                            title="Remove tag"
                        >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </span>
                ))}
                {tags.length === 0 && (
                    <span className="text-xs text-foreground-muted italic">No tags added</span>
                )}
            </div>

            <div className="relative">
                <input
                    type="text"
                    value={newTag}
                    onChange={(e) => onChangeNewTag(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && onAdd()}
                    placeholder="Add a tag..."
                    className="w-full px-4 py-2.5 pr-10 rounded-xl bg-background-secondary border border-border text-foreground text-sm transition-all duration-200 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 placeholder:text-foreground-muted"
                />
                <button
                    onClick={onAdd}
                    disabled={!newTag.trim() || isUpdating}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-primary hover:text-primary-hover disabled:opacity-40 transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                </button>
            </div>
        </div>
    );
}
