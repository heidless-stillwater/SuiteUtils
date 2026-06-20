import { GeneratedImage, Collection } from '@/lib/types';
import { formatDate } from '@/lib/date-utils';
import CollectionSelector from './CollectionSelector';
import TagManager from './TagManager';
import PromptSetIDManager from './PromptSetIDManager';
import ActionsBar from './ActionsBar';
import { Button } from '@/components/ui/Button';
import { Icons } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';

interface ImageMetadataSidebarProps {
    image: GeneratedImage;
    onClose: () => void;
    collections: Collection[];
    onToggleCollection: (collectionId: string) => void;
    onCreateCollection: (name: string) => void;
    // Prompt Set ID
    isEditingPromptSetID: boolean;
    editingPromptSetID: string;
    isSavingPromptSetID: boolean;
    onStartEditingPromptSetID: () => void;
    onCancelEditingPromptSetID: () => void;
    onChangeEditingPromptSetID: (val: string) => void;
    onSavePromptSetID: () => void;
    existingPromptSetIDs: { id: string, thumbUrl: string }[];
    isLoadingSuggestions: boolean;
    // Tags
    newImageTag: string;
    isUpdatingTags: boolean;
    onAddTag: () => void;
    onRemoveTag: (tag: string) => void;
    onChangeNewTag: (val: string) => void;
    // Actions
    publishingId: string | null;
    deletingId: string | null;
    onCopyPrompt: () => void;
    onCopySeed: () => void;
    onGenerateVariation: () => void;
    onCommunityToggle: () => void;
    onDownload: () => void;
    onDelete: () => void;
    isAdmin?: boolean;
    onToggleExemplar?: () => void;
    onEditPrompt: () => void;
    // Title
    isEditingTitle: boolean;
    editingTitle: string;
    isSavingTitle: boolean;
    onStartEditingTitle: () => void;
    onCancelEditingTitle: () => void;
    onChangeTitle: (val: string) => void;
    onSaveTitle: () => void;
}

export default function ImageMetadataSidebar({
    image,
    onClose,
    collections,
    onToggleCollection,
    onCreateCollection,
    isEditingPromptSetID,
    editingPromptSetID,
    isSavingPromptSetID,
    onStartEditingPromptSetID,
    onCancelEditingPromptSetID,
    onChangeEditingPromptSetID,
    onSavePromptSetID,
    existingPromptSetIDs,
    isLoadingSuggestions,
    newImageTag,
    isUpdatingTags,
    onAddTag,
    onRemoveTag,
    onChangeNewTag,
    publishingId,
    deletingId,
    onCopyPrompt,
    onCopySeed,
    onGenerateVariation,
    onCommunityToggle,
    onDownload,
    onDelete,
    isAdmin,
    onToggleExemplar,
    onEditPrompt,
    isEditingTitle,
    editingTitle,
    isSavingTitle,
    onStartEditingTitle,
    onCancelEditingTitle,
    onChangeTitle,
    onSaveTitle
}: ImageMetadataSidebarProps) {
    return (
        <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-border flex flex-col min-h-0">
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                <div className="flex justify-between items-start mb-4 sticky top-0 bg-background z-10 -mx-6 px-6 pb-2">
                    <h3 className="font-semibold">Image Details</h3>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-background-secondary rounded-lg"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="space-y-4">
                    <div className="mb-4">
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-xs text-foreground-muted uppercase tracking-wide">Title</label>
                            {!isEditingTitle && (
                                <button
                                    onClick={onStartEditingTitle}
                                    className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary/80"
                                >
                                    Edit Title
                                </button>
                            )}
                        </div>
                        {isEditingTitle ? (
                            <div className="space-y-2">
                                <input
                                    autoFocus
                                    type="text"
                                    value={editingTitle}
                                    onChange={(e) => onChangeTitle(e.target.value)}
                                    placeholder="Enter image title..."
                                    className="w-full bg-background-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') onSaveTitle();
                                        if (e.key === 'Escape') onCancelEditingTitle();
                                    }}
                                />
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        className="h-8 text-[10px] uppercase font-black"
                                        onClick={onSaveTitle}
                                        disabled={isSavingTitle}
                                    >
                                        {isSavingTitle ? <Icons.spinner size={12} className="animate-spin" /> : 'Save'}
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        className="h-8 text-[10px] uppercase font-black"
                                        onClick={onCancelEditingTitle}
                                        disabled={isSavingTitle}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <p className={cn("text-sm font-black uppercase tracking-widest", !image.title && "text-foreground-muted italic text-xs")}>
                                    {image.title || '<no title>'}
                                </p>
                                {image.publishedToCommunity && (
                                    <button 
                                        onClick={() => window.location.href = `/community?entryId=${image.communityEntryId || ''}`}
                                        className="text-[9px] font-black uppercase tracking-wider text-primary hover:text-primary/80 transition-all underline underline-offset-2 shrink-0 text-left"
                                    >
                                        [ View in Community Hub ]
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="group/prompt relative">
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-xs text-foreground-muted uppercase tracking-wide">Prompt</label>
                            <button
                                onClick={onCopyPrompt}
                                className="text-[10px] font-black uppercase tracking-widest text-primary opacity-0 group-hover/prompt:opacity-100 transition-opacity hover:text-primary/80"
                            >
                                Copy Prompt
                            </button>
                        </div>
                        <p className="text-sm leading-relaxed">{image.prompt}</p>

                        <div className="grid grid-cols-2 gap-2 mt-3">
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={onGenerateVariation}
                                className="w-full text-[10px] uppercase font-black tracking-widest h-9"
                            >
                                <Icons.wand size={14} className="mr-2" />
                                New Version
                            </Button>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={onEditPrompt}
                                className="w-full text-[10px] uppercase font-black tracking-widest h-9"
                            >
                                <Icons.text size={14} className="mr-2" />
                                Edit Prompt
                            </Button>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-border/50">
                        <PromptSetIDManager
                            promptSetID={image.promptSetID}
                            isEditing={isEditingPromptSetID}
                            editingValue={editingPromptSetID}
                            isSaving={isSavingPromptSetID}
                            existingPromptSetIDs={existingPromptSetIDs}
                            isLoadingSuggestions={isLoadingSuggestions}
                            onStartEditing={onStartEditingPromptSetID}
                            onCancelEditing={onCancelEditingPromptSetID}
                            onChangeValue={onChangeEditingPromptSetID}
                            onSave={onSavePromptSetID}
                        />
                    </div>

                    <div className="pt-4 border-t border-border/50">
                        <CollectionSelector
                            collections={collections}
                            selectedIds={image.collectionIds || (image.collectionId ? [image.collectionId] : [])}
                            onToggle={onToggleCollection}
                            onCreate={onCreateCollection}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/50">
                        <div>
                            <label className="text-xs text-foreground-muted uppercase tracking-wide">Quality</label>
                            <p className="text-sm mt-1 capitalize">{image.settings?.quality || 'Standard'}</p>
                        </div>
                        <div>
                            <label className="text-xs text-foreground-muted uppercase tracking-wide">Aspect</label>
                            <p className="text-sm mt-1">{image.settings?.aspectRatio || '1:1'}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2">
                        <div>
                            <label className="text-xs text-foreground-muted uppercase tracking-wide">Credits</label>
                            <p className="text-sm mt-1">{image.creditsCost}</p>
                        </div>
                        <div>
                            <label className="text-xs text-foreground-muted uppercase tracking-wide">Downloads</label>
                            <p className="text-sm mt-1">{image.downloadCount || 0}</p>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-border/50">
                        <TagManager
                            tags={image.tags || []}
                            newTag={newImageTag}
                            isUpdating={isUpdatingTags}
                            onAdd={onAddTag}
                            onRemove={onRemoveTag}
                            onChangeNewTag={onChangeNewTag}
                        />
                    </div>

                    <div className="pt-4 border-t border-border/50">
                        <label className="text-xs text-foreground-muted uppercase tracking-wide">Created</label>
                        <p className="text-sm mt-1">{formatDate(image.createdAt)}</p>
                    </div>

                    {isAdmin && (
                        <div className="pt-4 border-t border-border/50">
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={onToggleExemplar}
                                className={`w-full justify-between h-9 text-[10px] uppercase font-black tracking-widest transition-all ${image.isExemplar ? "text-indigo-400 border-indigo-500/30 bg-indigo-500/5 hover:bg-indigo-500/10" : "text-foreground-muted hover:bg-background-secondary"
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <Icons.exemplar size={14} className={image.isExemplar ? "fill-current" : ""} />
                                    <span>Exemplar Status</span>
                                </div>
                                {image.isExemplar ? "Active" : "Off"}
                            </Button>
                        </div>
                    )}

                    <ActionsBar
                        image={image}
                        publishingId={publishingId}
                        deletingId={deletingId}
                        onCopyPrompt={onCopyPrompt}
                        onCopySeed={onCopySeed}
                        onGenerateVariation={onGenerateVariation}
                        onCommunityToggle={onCommunityToggle}
                        onDownload={onDownload}
                        onDelete={onDelete}
                    />
                </div>
            </div>
        </div>
    );
}

