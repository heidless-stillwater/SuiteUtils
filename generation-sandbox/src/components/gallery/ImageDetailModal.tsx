import { GeneratedImage, Collection } from '@/lib/types';
import { useToast } from '@/components/Toast';
import { useImageDetails } from '@/hooks/useImageDetails';
import ImageDisplay from './image-detail/ImageDisplay';
import ImageMetadataSidebar from './image-detail/ImageMetadataSidebar';
import ConfirmationModal from '@/components/ConfirmationModal';

interface ImageDetailModalProps {
    selectedImage: GeneratedImage;
    onClose: () => void;
    onNext: () => void;
    onPrev: () => void;
    collections: Collection[];
    onUpdate: (updatedImage: GeneratedImage) => void;
    onDelete: (imageId: string) => void;
    deletingId: string | null;
}

export default function ImageDetailModal({
    selectedImage,
    onClose,
    onNext,
    onPrev,
    collections,
    onUpdate,
    onDelete,
    deletingId
}: ImageDetailModalProps) {
    const { showToast } = useToast();

    const {
        isEditingPromptSetID,
        setIsEditingPromptSetID,
        editingPromptSetID,
        setEditingPromptSetID,
        isSavingPromptSetID,
        existingPromptSetIDs,
        isLoadingSuggestions,
        newImageTag,
        setNewImageTag,
        isUpdatingTags,
        publishingId,
        updatePromptSetID,
        addTag,
        removeTag,
        toggleCommunity,
        toggleCollection,
        createCollection,
        downloadImage,
        isAdmin,
        toggleExemplar,
        showUnpublishConfirm,
        setShowUnpublishConfirm,
        confirmUnpublish,
        isEditingTitle,
        setIsEditingTitle,
        editingTitle,
        setEditingTitle,
        isSavingTitle,
        updateTitle
    } = useImageDetails(selectedImage, onUpdate);

    const handleCopyPrompt = () => {
        navigator.clipboard.writeText(selectedImage.prompt);
        showToast('Prompt copied to clipboard', 'success');
    };

    const handleCopySeed = () => {
        if (selectedImage.settings?.seed) {
            navigator.clipboard.writeText(String(selectedImage.settings.seed));
            showToast('Seed copied to clipboard', 'success');
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-background rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden relative"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex flex-col md:flex-row min-h-0 flex-1">
                    <ImageDisplay
                        image={selectedImage}
                        onPrev={onPrev}
                        onNext={onNext}
                    />

                    <ImageMetadataSidebar
                        image={selectedImage}
                        onClose={onClose}
                        collections={collections}
                        onToggleCollection={toggleCollection}
                        onCreateCollection={createCollection}
                        // Prompt Set ID
                        isEditingPromptSetID={isEditingPromptSetID}
                        editingPromptSetID={editingPromptSetID}
                        isSavingPromptSetID={isSavingPromptSetID}
                        existingPromptSetIDs={existingPromptSetIDs}
                        isLoadingSuggestions={isLoadingSuggestions}
                        onStartEditingPromptSetID={() => setIsEditingPromptSetID(true)}
                        onCancelEditingPromptSetID={() => {
                            setIsEditingPromptSetID(false);
                            setEditingPromptSetID(selectedImage.promptSetID || '');
                        }}
                        onChangeEditingPromptSetID={setEditingPromptSetID}
                        onSavePromptSetID={updatePromptSetID}
                        // Tags
                        newImageTag={newImageTag}
                        isUpdatingTags={isUpdatingTags}
                        onAddTag={addTag}
                        onRemoveTag={removeTag}
                        onChangeNewTag={setNewImageTag}
                        // Actions
                        publishingId={publishingId}
                        deletingId={deletingId}
                        onCopyPrompt={handleCopyPrompt}
                        onCopySeed={handleCopySeed}
                        onGenerateVariation={() => window.location.href = `/generate?ref=${selectedImage.id}`}
                        onCommunityToggle={toggleCommunity}
                        onDownload={() => downloadImage()}
                        onDelete={() => onDelete(selectedImage.id)}
                        isAdmin={isAdmin}
                        onToggleExemplar={toggleExemplar}
                        // Title
                        isEditingTitle={isEditingTitle}
                        editingTitle={editingTitle}
                        isSavingTitle={isSavingTitle}
                        onStartEditingTitle={() => setIsEditingTitle(true)}
                        onCancelEditingTitle={() => {
                            setIsEditingTitle(false);
                            setEditingTitle(selectedImage.title || '');
                        }}
                        onChangeTitle={setEditingTitle}
                        onSaveTitle={updateTitle}
                        onEditPrompt={() => window.location.href = `/generate?ref=${selectedImage.id}&edit=1`}
                    />
                </div>
            </div>

            {/* Unpublish Confirmation Modal */}
            <ConfirmationModal
                isOpen={showUnpublishConfirm}
                title="Remove from Community Hub"
                message="Are you sure you want to remove this image from the Community Hub? This will delete all associated votes and comments."
                confirmLabel="Remove from Hub"
                cancelLabel="Keep it"
                onConfirm={confirmUnpublish}
                onCancel={() => setShowUnpublishConfirm(false)}
                type="danger"
                isLoading={publishingId !== null}
            />
        </div>
    );
}
