'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense, useCallback, useRef } from 'react';
import { ImageQuality, AspectRatio, CREDIT_COSTS, SUBSCRIPTION_PLANS, GeneratedImage, MediaModality } from '@/lib/types';
import { normalizeImageData } from '@/lib/image-utils';
import Link from 'next/link';
import TextOverlayEditor from '@/components/TextOverlayEditor';
import ReactionPicker from '@/components/ReactionPicker';
import ShareButtons from '@/components/ShareButtons';
import Tooltip from '@/components/Tooltip';
import { Icons } from '@/components/ui/Icons';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/utils';

// Sub-components
import GenerateHeader from '@/components/generate/GenerateHeader';
import HistorySidebar from '@/components/generate/HistorySidebar';
import PromptSection from '@/components/generate/PromptSection';
import SettingsSection from '@/components/generate/SettingsSection';
import AdvancedControls from '@/components/generate/AdvancedControls';
import PreviewSection from '@/components/generate/PreviewSection';
import ConfirmationModal from '@/components/ConfirmationModal';
import GalleryPickerModal from '@/components/generate/GalleryPickerModal';

type PromptMode = 'freeform' | 'customize';

// Helper to generate a unique 15-character alphanumeric ID
const generatePromptSetID = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 15; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

export default function GeneratePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <Icons.spinner className="w-8 h-8 animate-spin text-primary" />
            </div>
        }>
            <GeneratePageContent />
        </Suspense>
    );
}

function GeneratePageContent() {
    const { user, profile, credits, loading, refreshCredits } = useAuth();

    // State
    const [promptMode, setPromptMode] = useState<PromptMode>('customize');
    const [prompt, setPromptInternal] = useState('');
    const [rawTemplateInternal, setRawTemplateState] = useState('');
    const [isVisionEditEnabled, setIsVisionEditEnabled] = useState(false);

    const setPrompt = (val: string | any) => {
        const v = typeof val === 'function' ? val(prompt) : val;
        setPromptInternal(v);
        setRawTemplateState(v);
    };

    const setRawTemplate = (val: string | any) => {
        const v = typeof val === 'function' ? val(rawTemplateInternal) : val;
        setRawTemplateState(v);
        setPromptInternal(v);
    };

    const rawTemplate = rawTemplateInternal;
    // State for Customize mode
    const [selectedBlueprint, setSelectedBlueprint] = useState<any>(null);
    const [variables, setVariables] = useState<Record<string, { value: string, default: string }>>({});
    const [resultantPrompt, setResultantPrompt] = useState('');
    const [isSavingBlueprint, setIsSavingBlueprint] = useState(false);

    const [quality, setQuality] = useState<ImageQuality | 'video'>('standard');
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('4:3');
    const [modality, setModality] = useState<MediaModality>('image');
    const [batchSize, setBatchSize] = useState<number>(1);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState('');
    const [warning, setWarning] = useState('');
    const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);
    const [showTextEditor, setShowTextEditor] = useState(false);
    const [editedImage, setEditedImage] = useState<string | null>(null);
    const [negativePrompt, setNegativePrompt] = useState('');
    const [seed, setSeed] = useState<number | undefined>(undefined);
    const [guidanceScale, setGuidanceScale] = useState(7.0);
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
    const [enhancing, setEnhancing] = useState(false);
    const [generationProgress, setGenerationProgress] = useState<{ current: number; total: number; message: string } | null>(null);
    const [promptSetID, setPromptSetID] = useState<string>('');
    const abortControllerRef = useRef<AbortController | null>(null);
    const [isNewImageSet, setIsNewImageSet] = useState<boolean>(false);
    const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);
    const [title, setTitle] = useState('');
    const [lastBakedState, setLastBakedState] = useState<string>('');

    // History & Remix state
    const [historyImages, setHistoryImages] = useState<GeneratedImage[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [isGalleryPickerOpen, setIsGalleryPickerOpen] = useState(false);
    const [galleryPickerMode, setGalleryPickerMode] = useState<'reference' | 'prompt'>('reference');
    const [showUnsavedModal, setShowUnsavedModal] = useState(false);
    const [pendingRoute, setPendingRoute] = useState<string | null>(null);
    const [failoverMetadata, setFailoverMetadata] = useState<{ requestId: string, metadata: { projectId: string, location: string, model: string } } | null>(null);

    const router = useRouter();
    const searchParams = useSearchParams();
    
    // --- Subscription & Entitlements Gate ---
    const isJustSubscribed = searchParams.get('subscribed') === 'true';
    const isAdmin = profile?.role === 'admin' || profile?.role === 'su';
    const activeSuites: string[] = (
        profile?.suiteSubscription?.activeSuites ||
        profile?.subscriptionMetadata?.activeSuites ||
        []
    );
    const hasStudioAccess = isJustSubscribed ||
                           activeSuites.includes('studio') ||
                           activeSuites.includes('prompttool') ||
                           activeSuites.includes('promptmaster') ||
                           profile?.subscription === 'pro' || 
                           profile?.subscription === 'standard' || 
                           isAdmin;
    const lastSavedStateRef = useRef<string | null>(null);

    const [isExiting, setIsExiting] = useState(false);

    // Unsaved changes guardian
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isExiting) return;
            
            const currentState = JSON.stringify({ rawTemplate, variables, title });
            const savedState = localStorage.getItem('generation_session_v1');
            
            if (savedState) {
                const parsed = JSON.parse(savedState);
                const relevantSaved = JSON.stringify({ 
                    rawTemplate: parsed.rawTemplate, 
                    variables: parsed.variables, 
                    title: parsed.title 
                });
                
                if (currentState !== relevantSaved) {
                    e.preventDefault();
                    e.returnValue = '';
                    return '';
                }
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [rawTemplate, variables, title, isExiting]);

    // Initial session hydration
    useEffect(() => {
        const initSession = async () => {
            // If ?newset=1 is present, start a fresh set and clean the URL
            const isNewSet = searchParams.get('newset') === '1';
            if (isNewSet) {
                const freshId = generatePromptSetID();
                setPromptSetID(freshId);
                setSelectedCollectionIds([]);
                setPromptMode('customize');
                // Wipe any cached promptSetID from local draft so it doesn't re-load
                try {
                    const savedState = localStorage.getItem('generation_session_v1');
                    if (savedState) {
                        const parsed = JSON.parse(savedState);
                        parsed.promptSetID = freshId;
                        parsed.selectedCollectionIds = [];
                        parsed.promptMode = 'customize';
                        localStorage.setItem('generation_session_v1', JSON.stringify(parsed));
                    }
                } catch (_) { }
                router.replace('/generate', { scroll: false });
                return;
            }

            let localTimestamp = 0;
            let localState: any = null;
            try {
                const savedState = localStorage.getItem('generation_session_v1');
                if (savedState) {
                    localState = JSON.parse(savedState);
                    localTimestamp = localState.updatedAt || 0;

                    // Hydrate from local immediately
                    const initialPrompt = localState.prompt || '';
                    const initialTemplate = localState.rawTemplate || initialPrompt; // Fallback to prompt if template is empty
                    
                    setPrompt(initialPrompt);
                    setRawTemplate(initialTemplate);
                    
                    // Force default to standard (1 credit) as requested, ignoring saved high-tier quality
                    setQuality('standard');
                    // if (localState.quality) setQuality(localState.quality as ImageQuality);
                    if (localState.aspectRatio) setAspectRatio(localState.aspectRatio as AspectRatio);
                    if (localState.batchSize) setBatchSize(localState.batchSize);
                    if (localState.negativePrompt) setNegativePrompt(localState.negativePrompt);
                    if (localState.seed !== undefined) setSeed(localState.seed);
                    if (localState.guidanceScale) setGuidanceScale(localState.guidanceScale);
                    setPromptMode('customize'); // FORCE DEFAULT: Always start in customize mode
                    if (localState.title) setTitle(localState.title);
                    // FORCE DEFAULT to 'image' to prevent accidental quota burn on video models
                    setModality('image');
                    // if (localState.modality) setModality(localState.modality as MediaModality);
                    if (localState.promptSetID) setPromptSetID(localState.promptSetID);
                    else setPromptSetID(generatePromptSetID());
                    if (localState.selectedCollectionIds) setSelectedCollectionIds(localState.selectedCollectionIds);
                    
                    const localInitialState = JSON.stringify({ 
                        rawTemplate: initialTemplate, 
                        variables: localState.variables || {}, 
                        title: localState.title || ''
                    });
                    setLastBakedState(localInitialState);
                } else {
                    setPromptSetID(generatePromptSetID());
                    setPromptMode('customize'); // FORCE DEFAULT
                }
            } catch (e) {
                console.warn('Failed to hydrate local session state', e);
            }

            // 2. Check Cloud State (Async)
            if (user) {
                try {
                    const { doc, getDoc } = await import('firebase/firestore');
                    const { db } = await import('@/lib/firebase');
                    const draftRef = doc(db, 'users', user.uid, 'settings', 'draft');
                    const draftSnap = await getDoc(draftRef);

                    if (draftSnap.exists()) {
                        const cloudData = draftSnap.data();
                        const cloudTimestamp = cloudData.updatedAt?.toMillis?.() || 0;

                        // Conflict Resolution: If Cloud is newer than Local
                        if (cloudTimestamp > localTimestamp) {
                            console.log('Cloud draft is newer, syncing...');
                            if (cloudData.prompt) setPrompt(cloudData.prompt);
                            // Force default to standard (1 credit) as requested
                            setQuality('standard');
                            // if (cloudData.quality) setQuality(cloudData.quality as ImageQuality);
                            if (cloudData.aspectRatio) setAspectRatio(cloudData.aspectRatio as AspectRatio);
                            if (cloudData.batchSize) setBatchSize(cloudData.batchSize);
                            if (cloudData.negativePrompt) setNegativePrompt(cloudData.negativePrompt);
                            if (cloudData.seed !== undefined) setSeed(cloudData.seed);
                            if (cloudData.guidanceScale) setGuidanceScale(cloudData.guidanceScale);
                            setPromptMode('customize'); // FORCE DEFAULT: Even if cloud says freeform
                            if (cloudData.variables) setVariables(cloudData.variables);
                            if (cloudData.rawTemplate) setRawTemplate(cloudData.rawTemplate);
                            if (cloudData.selectedBlueprint) setSelectedBlueprint(cloudData.selectedBlueprint);
                            if (cloudData.modality) setModality(cloudData.modality as MediaModality);
                            if (cloudData.promptSetID) setPromptSetID(cloudData.promptSetID);
                            if (cloudData.selectedCollectionIds) setSelectedCollectionIds(cloudData.selectedCollectionIds);

                            const cloudState = JSON.stringify({ 
                                rawTemplate: cloudData.rawTemplate, 
                                variables: cloudData.variables, 
                                title: cloudData.title || ''
                            });
                            setLastBakedState(cloudState);

                            // Update local storage to match cloud
                            localStorage.setItem('generation_session_v1', JSON.stringify({
                                ...cloudData,
                                promptMode: 'customize',
                                updatedAt: cloudTimestamp
                            }));
                        }
                    }
                } catch (e) {
                    console.warn('Failed to sync with cloud draft', e);
                }
            }
        };

        initSession();
    }, [user, searchParams, router]);

    // Persist state changes (Local + Cloud)
    useEffect(() => {
        if (!user && !promptSetID) return;
        
        const timestamp = Date.now();
        const stateToSave = {
            prompt,
            quality,
            aspectRatio,
            batchSize,
            negativePrompt,
            seed,
            guidanceScale,
            promptMode,
            variables,
            rawTemplate,
            selectedBlueprint,
            modality,
            promptSetID,
            selectedCollectionIds,
            title,
            updatedAt: timestamp,
        };

        // 1. Save Local (Immediate)
        localStorage.setItem('generation_session_v1', JSON.stringify(stateToSave));

        // 2. Save Cloud (Debounced 2s)
        if (user) {
            const saveToCloud = setTimeout(async () => {
                try {
                    const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
                    const { db } = await import('@/lib/firebase');
                    const draftRef = doc(db, 'users', user.uid, 'settings', 'draft');

                    const cleanedState = Object.fromEntries(
                        Object.entries(stateToSave).map(([k, v]) => [k, v === undefined ? null : v])
                    );

                    await setDoc(draftRef, {
                        ...cleanedState,
                        updatedAt: serverTimestamp(),
                    }, { merge: true });
                } catch (e) {
                    console.warn('Failed to save draft to cloud', e);
                }
            }, 2000);

            return () => clearTimeout(saveToCloud);
        }
    }, [
        prompt, quality, aspectRatio, batchSize, negativePrompt, seed,
        guidanceScale, promptMode, variables, rawTemplate, selectedBlueprint,
        modality, promptSetID, selectedCollectionIds, title, user,
    ]);

    // Reference image for Img2Img variations
    const refImageId = searchParams.get('ref');
    const isEditing = searchParams.get('edit') === '1';

    const extractVariables = useCallback((template: string) => {
        // Match anything inside {{ ... }}
        const regex = /{{\s*(.*?)\s*}}/g;
        const matches = Array.from(template.matchAll(regex));
        
        const foundTags = matches.map(m => {
            const inner = m[1];
            // Split by FIRST colon only to support defaults with colons if needed
            const firstColon = inner.indexOf(':');
            const key = (firstColon !== -1 ? inner.substring(0, firstColon) : inner).trim();
            const def = firstColon !== -1 ? inner.substring(firstColon + 1).trim() : '<undefined>';
            return { key, default: def };
        });

        if (foundTags.length === 0) {
            setVariables({});
            return;
        }

        setVariables(prev => {
            const newVars: Record<string, { value: string, default: string }> = {};
            let hasChanges = false;
            
            foundTags.forEach(tag => {
                const existing = prev[tag.key];
                
                // If it's a new tag, or the default in the template has changed
                if (!existing) {
                    newVars[tag.key] = { 
                        value: tag.default !== '<undefined>' ? tag.default : '', 
                        default: tag.default 
                    };
                    hasChanges = true;
                } else if (existing.default !== tag.default) {
                    // Update both the default reference AND the current input value to the new default
                    newVars[tag.key] = { 
                        value: tag.default !== '<undefined>' ? tag.default : existing.value, 
                        default: tag.default 
                    };
                    hasChanges = true;
                } else {
                    newVars[tag.key] = existing;
                }
            });

            // Only trigger a state update if the actual variable structure or defaults changed
            if (!hasChanges && Object.keys(newVars).length === Object.keys(prev).length) {
                return prev;
            }
            return newVars;
        });
    }, []);

    useEffect(() => {
        // Debounce: only re-extract variables after user pauses typing
        // Without this, setVariables fires on every keystroke → parent re-render → cursor reset
        const timer = setTimeout(() => {
            extractVariables(rawTemplate || '');
        }, 400);
        return () => clearTimeout(timer);
    }, [rawTemplate, extractVariables]);

    useEffect(() => {
        // compilation result
        let result = rawTemplate || '';
        const entries = Object.entries(variables);
        
        if (entries.length > 0) {
            const sortedKeys = entries.sort((a, b) => b[0].length - a[0].length);
            
            sortedKeys.forEach(([key, data]) => {
                const isActuallyDefault = !data.value || data.value === data.default || data.default === '<undefined>';
                const displayValue = data.value || (data.default !== '<undefined>' ? data.default : `[${key}]`);
                
                const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const wrapped = isActuallyDefault ? `__DEF__${displayValue}__DEF__` : `__VAL__${displayValue}__VAL__`;
                
                const tagRegex = new RegExp(`{{\\s*${escapedKey}\\s*(?::[^{}]*)?}}`, 'g');
                result = result.replace(tagRegex, wrapped);
            });
        }
        
        setResultantPrompt(result);
        
        // Sync the main 'prompt' state used for generation (cleaned version)
        if (result) {
            const cleanFinal = result.replace(/__DEF__(.*?)__DEF__/g, '$1').replace(/__VAL__(.*?)__VAL__/g, '$1');
            setPromptInternal(cleanFinal);
        }
    }, [variables, rawTemplate]);

    // --- Data Management & State Sync ---
    const sidParam = searchParams.get('sid');
    const [referenceImage, setReferenceImage] = useState<{
        id: string;
        url: string;           // Display URL (thumbnail/still frame or image)
        base64?: string;
        mimeType?: string;
        prompt?: string;
        promptSetID?: string;
        collectionIds?: string[];
        isVideo?: boolean;     // True when the source is a video entry
        videoUrl?: string;     // Original video URL for display preview
    } | null>(null);
    const [loadingReference, setLoadingReference] = useState(false);

    // Helper to extract first frame from video and upload as thumbnail
    const createVideoThumbnail = async (imageId: string, videoUrl: string) => {
        try {
            // Proxy GCS videos through our API to bypass browser CORS canvas taint restrictions
            const isGcsUrl = videoUrl.includes('storage.googleapis.com') || videoUrl.includes('storage.cloud.google.com');
            const proxiedUrl = isGcsUrl
                ? `/api/proxy/video?url=${encodeURIComponent(videoUrl)}`
                : videoUrl;

            const video = document.createElement('video');
            video.src = proxiedUrl;
            // No crossOrigin needed — proxy serves from same origin
            video.muted = true;
            video.playsInline = true;

            // Wait for video metadata with timeout
            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Video load timed out')), 15000);
                video.onloadeddata = () => { clearTimeout(timeout); resolve(); };
                video.onerror = () => { clearTimeout(timeout); reject(new Error('Video load error')); };
                video.load();
            });

            // Seek to 0.1s to ensure we have a frame (0.0 can sometimes be black)
            video.currentTime = 0.1;
            await new Promise<void>((resolve) => {
                const timeout = setTimeout(() => resolve(), 3000); // fallback if onseeked never fires
                video.onseeked = () => { clearTimeout(timeout); resolve(); };
            });

            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 360;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            let thumbnailBase64: string;
            try {
                thumbnailBase64 = canvas.toDataURL('image/jpeg', 0.8);
            } catch (corsErr) {
                // Canvas may be tainted if the video URL has CORS restrictions
                console.warn('Canvas tainted by CORS, cannot extract thumbnail frame:', corsErr);
                return;
            }

            const duration = video.duration;

            // Get auth token for API call
            const token = await user?.getIdToken();
            if (!token) {
                console.warn('No auth token available for thumbnail upload');
                return;
            }

            // Upload to API
            const response = await fetch('/api/generate/thumbnail', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ imageId, thumbnailBase64, duration })
            });

            if (!response.ok) {
                console.warn('Failed to upload thumbnail:', await response.text());
            } else {
                const data = await response.json();
                console.log('Thumbnail uploaded successfully for', imageId);

                // Update local state so UI reflects new thumbnail
                if (data.thumbnailUrl) {
                    setGeneratedImages(prev => prev.map(img =>
                        img.id === imageId ? { ...img, imageUrl: data.thumbnailUrl, duration } : img
                    ));
                    setHistoryImages(prev => prev.map(img =>
                        img.id === imageId ? { ...img, imageUrl: data.thumbnailUrl, duration } : img
                    ));
                }
            }
        } catch (err) {
            console.error('Error creating video thumbnail:', err);
        }
    };

    // URL Parameter handling (Prompt/Style pre-fill)
    useEffect(() => {
        const promptParam = searchParams.get('prompt');
        const styleParam = searchParams.get('style');

        if (promptParam) {
            setPrompt(decodeURIComponent(promptParam));
            setPromptMode('freeform');
            // Clear parameter after consumption to avoid re-triggering on remix/history etc
            const newParams = new URLSearchParams(searchParams.toString());
            newParams.delete('prompt');
            router.replace(`/generate?${newParams.toString()}`, { scroll: false });
        } else if (styleParam) {
            // Future logic for style lookup — default to customize
            setPromptMode('customize');
        }
    }, [searchParams, router]);

    // Load reference image if provided in URL
    useEffect(() => {
        const loadReference = async () => {
            if (!refImageId || !user) return;

            setLoadingReference(true);
            try {
                const { doc, getDoc } = await import('firebase/firestore');
                const { db } = await import('@/lib/firebase');

                // Try to find the image in the user's collection first
                // If not found, it might be from the Community Hub (published by another user)
                let imgRef = doc(db, 'users', user.uid, 'images', refImageId);
                let imgSnap = await getDoc(imgRef);

                // Fallback: Check Community Hub entries if not in personal collection
                let data: GeneratedImage | null = null;
                if (imgSnap.exists()) {
                    data = imgSnap.data() as GeneratedImage;
                } else {
                    const communityRef = doc(db, 'leagueEntries', refImageId);
                    const communitySnap = await getDoc(communityRef);
                    if (communitySnap.exists()) {
                        data = communitySnap.data() as any;
                    }
                }

                if (data) {
                    // Pre-fill all settings from the reference image
                    if (data.prompt) setPrompt(data.prompt);
                    if (data.title) setTitle(data.title);
                    setPromptMode('freeform'); // Variations should default to freeform for precision

                    if (data.settings) {
                        const incomingQuality = data.settings.quality;
                        const incomingModality = data.settings.modality;

                        if (incomingModality === 'video') {
                            setModality('video');
                            setQuality('video');
                        } else {
                            setModality('image');
                            // Force default to standard (1 credit) for all variations
                            setQuality('standard');
                        }

                        if (data.settings.aspectRatio) setAspectRatio(data.settings.aspectRatio);
                        if (data.settings.negativePrompt) setNegativePrompt(data.settings.negativePrompt);
                        if (data.settings.seed !== undefined) setSeed(data.settings.seed);
                        if (data.settings.guidanceScale !== undefined) setGuidanceScale(data.settings.guidanceScale);
                    }

                    // Use provided 'sid' if available (e.g. from "Your Gallery" variations)
                    // otherwise MAINTAIN current promptSetID or use the one from reference data
                    // only generate a fresh one if absolutely none exist
                    if (sidParam) {
                        setPromptSetID(sidParam);
                    } else if (data.promptSetID) {
                        setPromptSetID(data.promptSetID);
                    } else if (!promptSetID) {
                        setPromptSetID(generatePromptSetID());
                    }
                    setSelectedCollectionIds([]);

                    if (isEditing) {
                        setLoadingReference(false);
                        return;
                    }

                    // Convert to base64 for the API
                    // For videos: if imageUrl is a video file, extract a still frame via canvas proxy
                    try {
                        const isVideoEntry = !!(data.videoUrl || data.settings?.modality === 'video');
                        const imageUrlIsVideo = /\.(mp4|webm|mov)(\?|$)/i.test(data.imageUrl || '');

                        if (isVideoEntry && imageUrlIsVideo) {
                            // imageUrl is a raw video URL — extract a still frame via canvas
                            const sourceVideoUrl = data.videoUrl || data.imageUrl;
                            const proxiedUrl = `/api/proxy/video?url=${encodeURIComponent(sourceVideoUrl)}`;

                            const video = document.createElement('video');
                            video.src = proxiedUrl;
                            video.muted = true;
                            video.playsInline = true;

                            await new Promise<void>((resolve, reject) => {
                                const timeout = setTimeout(() => reject(new Error('Video load timeout')), 15000);
                                video.onloadeddata = () => { clearTimeout(timeout); resolve(); };
                                video.onerror = () => { clearTimeout(timeout); reject(new Error('Video load error')); };
                                video.load();
                            });

                            video.currentTime = 0.1;
                            await new Promise<void>((resolve) => {
                                const timeout = setTimeout(() => resolve(), 3000);
                                video.onseeked = () => { clearTimeout(timeout); resolve(); };
                            });

                            const canvas = document.createElement('canvas');
                            canvas.width = video.videoWidth || 640;
                            canvas.height = video.videoHeight || 360;
                            const ctx = canvas.getContext('2d');
                            if (ctx) {
                                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                                const frameDataUrl = canvas.toDataURL('image/jpeg', 0.85);
                                const base64 = frameDataUrl.split(',')[1];

                                setReferenceImage({
                                    id: refImageId,
                                    url: frameDataUrl,       // Use the extracted frame as preview
                                    base64,
                                    mimeType: 'image/jpeg',
                                    prompt: data!.prompt,
                                    promptSetID: data!.promptSetID,
                                    collectionIds: data!.collectionIds || (data!.collectionId ? [data!.collectionId] : []),
                                    isVideo: true,
                                    videoUrl: data!.videoUrl || data!.imageUrl,
                                });
                            }
                            setLoadingReference(false);
                        } else {
                            // Standard image or video with thumbnail — download as usual
                            const downloadUrl = isVideoEntry && !imageUrlIsVideo
                                ? data.imageUrl  // imageUrl is already a thumbnail
                                : data.imageUrl;

                            const response = await fetch(`/api/download?url=${encodeURIComponent(downloadUrl)}`);
                            if (response.ok) {
                                const blob = await response.blob();
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                    const base64data = reader.result as string;
                                    const base64 = base64data.split(',')[1];
                                    const mimeType = blob.type;
                                    setReferenceImage({
                                        id: refImageId,
                                        url: data!.imageUrl,
                                        base64,
                                        mimeType,
                                        prompt: data!.prompt,
                                        promptSetID: data!.promptSetID,
                                        collectionIds: data!.collectionIds || (data!.collectionId ? [data!.collectionId] : []),
                                        isVideo: isVideoEntry,
                                        videoUrl: data!.videoUrl,
                                    });
                                    setLoadingReference(false);
                                };
                                reader.readAsDataURL(blob);
                            } else {
                                throw new Error('Failed to fetch image for reference');
                            }
                        }
                    } catch (fetchErr) {
                        console.error('Error fetching reference image blob:', fetchErr);
                        setLoadingReference(false);
                    }
                } else {
                    console.error('Reference image not found');
                    setLoadingReference(false);
                }
            } catch (err) {
                console.error('Error loading reference image:', err);
                setLoadingReference(false);
            }
        };

        loadReference();
    }, [refImageId, user]);

    // Sync prompt mode when profile loads
    useEffect(() => {
        if (profile && !refImageId) {
            setPromptMode(profile.audienceMode === 'professional' ? 'freeform' : 'customize');
        }
    }, [profile?.audienceMode, refImageId]);

    // Fetch personal history
    const fetchHistory = useCallback(async () => {
        if (!user) return;
        setLoadingHistory(true);
        try {
            const { collection, query, orderBy, limit, getDocs } = await import('firebase/firestore');
            const { db } = await import('@/lib/firebase');

            const imagesRef = collection(db, 'users', user.uid, 'images');
            const q = query(imagesRef, orderBy('createdAt', 'desc'), limit(20));
            const snapshot = await getDocs(q);

            const images = snapshot.docs.map(doc => normalizeImageData(doc.data(), doc.id));

            setHistoryImages(images);
        } catch (err) {
            console.error('Failed to fetch history:', err);
        } finally {
            setLoadingHistory(false);
        }
    }, [user]);

    useEffect(() => {
        if (user) {
            fetchHistory();
        }
    }, [user, fetchHistory]);

    // Remix handler
    const handleRemix = (image: GeneratedImage) => {
        if (!image.settings) return;

        setPrompt(image.prompt);

        const incomingQuality = image.settings.quality;
        const incomingModality = image.settings.modality;

        if (incomingModality === 'video') {
            setModality('video');
            setQuality('video');
        } else {
            setModality('image');
            // Force default to standard (1 credit) for all remixes
            setQuality('standard');
        }

        setAspectRatio(image.settings.aspectRatio || '1:1');

        if (image.settings.negativePrompt) {
            setNegativePrompt(image.settings.negativePrompt);
        }
        if (image.settings.seed !== undefined) {
            setSeed(image.settings.seed ?? undefined);
        }
        if (image.settings.guidanceScale !== undefined) {
            setGuidanceScale(image.settings.guidanceScale);
        }

        // Open advanced if needed
        if (image.settings.negativePrompt || image.settings.seed !== undefined || (image.settings.guidanceScale !== undefined && image.settings.guidanceScale !== 7.0)) {
            setIsAdvancedOpen(true);
        }

        // Maintain the same Prompt Set Identifier to ensure it is saved as a new variation within the current promptset
        if (image.promptSetID) {
            setPromptSetID(image.promptSetID);
        } else {
            setPromptSetID(generatePromptSetID());
        }

        const colIds = image.collectionIds || (image.collectionId ? [image.collectionId] : []);
        setSelectedCollectionIds(colIds);

        setIsHistoryOpen(false);
        setError('');
        setWarning('Remixed settings from previous generation.');
    };

    // Reference Image Upload Handler
    const handleUploadReference = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setError('Please upload an image file');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64data = reader.result as string;
            const base64 = base64data.split(',')[1];
            setReferenceImage({
                id: `upload-${Date.now()}`,
                url: base64data,
                base64,
                mimeType: file.type
            });
        };
        reader.readAsDataURL(file);
    };

    // Reference Image Gallery Selection Handler
    const handleSelectGalleryImage = async (image: GeneratedImage) => {
        setIsGalleryPickerOpen(false);

        if (galleryPickerMode === 'reference') {
            setLoadingReference(true);
            try {
                const isVideoEntry = !!(image.videoUrl || image.settings?.modality === 'video');
                const imageUrlIsVideo = /\.(mp4|webm|mov)(\?|$)/i.test(image.imageUrl || '');

                if (isVideoEntry && imageUrlIsVideo) {
                    // Extract a still frame from the video via proxy
                    const sourceVideoUrl = image.videoUrl || image.imageUrl;
                    const proxiedUrl = `/api/proxy/video?url=${encodeURIComponent(sourceVideoUrl)}`;

                    const video = document.createElement('video');
                    video.src = proxiedUrl;
                    video.muted = true;
                    video.playsInline = true;

                    await new Promise<void>((resolve, reject) => {
                        const timeout = setTimeout(() => reject(new Error('Video load timeout')), 15000);
                        video.onloadeddata = () => { clearTimeout(timeout); resolve(); };
                        video.onerror = () => { clearTimeout(timeout); reject(new Error('Video load error')); };
                        video.load();
                    });

                    video.currentTime = 0.1;
                    await new Promise<void>((resolve) => {
                        const timeout = setTimeout(() => resolve(), 3000);
                        video.onseeked = () => { clearTimeout(timeout); resolve(); };
                    });

                    const canvas = document.createElement('canvas');
                    canvas.width = video.videoWidth || 640;
                    canvas.height = video.videoHeight || 360;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        const frameDataUrl = canvas.toDataURL('image/jpeg', 0.85);
                        const base64 = frameDataUrl.split(',')[1];

                        setReferenceImage({
                            id: image.id,
                            url: frameDataUrl,
                            base64,
                            mimeType: 'image/jpeg',
                            prompt: image.prompt,
                            promptSetID: image.promptSetID,
                            collectionIds: image.collectionIds || (image.collectionId ? [image.collectionId] : []),
                            isVideo: true,
                            videoUrl: image.videoUrl || image.imageUrl,
                        });

                        if (image.prompt) setPrompt(image.prompt);
                        if (image.settings) {
                            const incomingQuality = image.settings.quality;
                            const incomingModality = image.settings.modality;

                            if (incomingModality === 'video') {
                                setModality('video');
                                setQuality('video');
                            } else {
                                setModality('image');
                                // Force default to standard (1 credit) for all variations
                                setQuality('standard');
                            }

                            if (image.settings.aspectRatio) setAspectRatio(image.settings.aspectRatio);
                            if (image.settings.negativePrompt) setNegativePrompt(image.settings.negativePrompt);
                            if (image.settings.seed !== undefined) setSeed(image.settings.seed ?? undefined);
                            if (image.settings.guidanceScale !== undefined) setGuidanceScale(image.settings.guidanceScale);

                            // Open advanced settings if we have complex settings
                            if (image.settings.negativePrompt || image.settings.seed !== undefined) {
                                setIsAdvancedOpen(true);
                            }
                        }
                    }
                    setLoadingReference(false);
                } else {
                    const response = await fetch(`/api/download?url=${encodeURIComponent(image.imageUrl)}`);
                    if (response.ok) {
                        const blob = await response.blob();
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            const base64data = reader.result as string;
                            const base64 = base64data.split(',')[1];
                            const mimeType = blob.type;
                            setReferenceImage({
                                id: image.id,
                                url: image.imageUrl,
                                base64,
                                mimeType,
                                prompt: image.prompt,
                                promptSetID: image.promptSetID,
                                collectionIds: image.collectionIds || (image.collectionId ? [image.collectionId] : []),
                                isVideo: isVideoEntry,
                                videoUrl: image.videoUrl,
                            });

                            if (image.prompt) setPrompt(image.prompt);
                            if (image.settings) {
                                const incomingQuality = image.settings.quality;
                                const incomingModality = image.settings.modality;

                                if (incomingModality === 'video') {
                                    setModality('video');
                                    setQuality('video');
                                } else {
                                    setModality('image');
                                    // Force default to standard (1 credit) for all variations
                                    setQuality('standard');
                                }

                                if (image.settings.aspectRatio) setAspectRatio(image.settings.aspectRatio);
                                if (image.settings.negativePrompt) setNegativePrompt(image.settings.negativePrompt);
                                if (image.settings.seed !== undefined) setSeed(image.settings.seed ?? undefined);
                                if (image.settings.guidanceScale !== undefined) setGuidanceScale(image.settings.guidanceScale);

                                // Open advanced settings if we have complex settings
                                if (image.settings.negativePrompt || image.settings.seed !== undefined) {
                                    setIsAdvancedOpen(true);
                                }
                            }
                            setLoadingReference(false);
                        };
                        reader.readAsDataURL(blob);
                    } else {
                        throw new Error('Failed to fetch image for reference');
                    }
                }
            } catch (err) {
                console.error('Error loading gallery image as reference:', err);
                setError('Failed to load gallery image');
                setLoadingReference(false);
            }
        } else {
            // Just import prompt and settings
            if (image.prompt) setPrompt(image.prompt);
            if (image.settings) {
                // Force default to standard (1 credit) for all imports
                setQuality('standard');
                if (image.settings.aspectRatio) setAspectRatio(image.settings.aspectRatio);
                if (image.settings.modality) setModality(image.settings.modality);
                if (image.settings.negativePrompt) setNegativePrompt(image.settings.negativePrompt);
                if (image.settings.seed !== undefined) setSeed(image.settings.seed ?? undefined);
                if (image.settings.guidanceScale !== undefined) setGuidanceScale(image.settings.guidanceScale);
            }
            setWarning('Imported prompt and settings from gallery.');
        }
    };

    // Calculate available credits
    const availableCredits = credits
        ? credits.balance + Math.max(0, credits.dailyAllowance - credits.dailyAllowanceUsed)
        : 0;

    const currentCost = modality === 'video' ? CREDIT_COSTS.video : (CREDIT_COSTS[quality] * batchSize);

    // Legacy check for quality tiers, but global access is now suite-based
    const isPro = profile?.subscription === 'pro' || isAdmin;

    // Check if quality is allowed for subscription
    const allowedQualities = profile
        ? (isAdmin ? ['standard', 'high', 'ultra'] : SUBSCRIPTION_PLANS[profile.subscription as keyof typeof SUBSCRIPTION_PLANS].allowedQualities)
        : ['standard'];

    // Bake current variable values into the raw template as new defaults
    const getBakedTemplate = useCallback((template: string, vars: Record<string, { value: string, default: string }>): string => {
        let baked = template;
        Object.entries(vars).forEach(([key, data]) => {
            if (!data.value) return;
            
            // Match the tag specifically with its key, regardless of current default
            const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`{{(\\s*${escapedKey}\\s*)(?::[^{}]*)?}}`, 'g');
            
            // Rewrite it as {{key:currentValue}}
            baked = baked.replace(regex, `{{$1:${data.value}}}`);
        });
        return baked;
    }, []);

    // Save blueprint changes from Customize mode back to Firestore
    const handleSaveBlueprint = async () => {
        if (!user || !selectedBlueprint) return;
        setIsSavingBlueprint(true);
        try {
            const bakedTemplate = getBakedTemplate(rawTemplate, variables);
            
            const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
            const { db } = await import('@/lib/firebase');
            const blueprintRef = doc(db, 'blueprints', selectedBlueprint.id);
            await setDoc(blueprintRef, {
                title: selectedBlueprint.title,
                prompts: [bakedTemplate],
                template: bakedTemplate, // sync both legacy and new fields
                updatedAt: serverTimestamp(),
            }, { merge: true });
            
            setRawTemplate(bakedTemplate); // Locally update the editor too
            setLastBakedState(JSON.stringify({ rawTemplate: bakedTemplate, variables, title }));
            setWarning('Architectural template baked with latest settings.');
        } catch (err: any) {
            console.error('Failed to save blueprint:', err);
            setError('Failed to save architectural changes');
        } finally {
            setIsSavingBlueprint(false);
        }
    };

    // Get final prompt based on mode
    const getFinalPrompt = useCallback((): string => {
        if (promptMode === 'customize') {
            return resultantPrompt
                .replace(/__DEF__(.*?)__DEF__/g, '$1')
                .replace(/__VAL__(.*?)__VAL__/g, '$1')
                .trim();
        }
        // freeform
        return prompt;
    }, [prompt, promptMode, resultantPrompt]);

    // Handle prompt enhancement
    const handleEnhancePrompt = async () => {
        if (!prompt.trim() || enhancing) return;

        setEnhancing(true);
        setError('');

        try {
            const token = await user?.getIdToken();
            const response = await fetch('/api/generate/enhance', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    prompt,
                }),
            });

            const data = await response.json();

            if (data.success && data.enhanced) {
                setPrompt(data.enhanced);
            } else {
                setError(data.error || 'Enhancement failed');
            }
        } catch (err: any) {
            setError('Failed to enhance prompt');
        } finally {
            setEnhancing(false);
        }
    };

    // Bakes current variable 'values' back into the rawTemplate as new 'defaults'.
    // This allows the user to "keep" their current inputs as the baseline for future generations.
    const bakeVariablesIntoTemplate = useCallback(() => {
        setRawTemplate((prev: string) => getBakedTemplate(prev, variables));
    }, [variables]);

    const handleSaveDraftPrompt = async (forcedSetID?: string, forcedPrompt?: string) => {
        const finalPrompt = getFinalPrompt();
        if (!finalPrompt.trim()) {
            setError('Please enter a prompt to save');
            return;
        }

        const activeID = forcedSetID || promptSetID;

        try {
            setGenerating(true);
            const { collection, addDoc, doc, setDoc, serverTimestamp } = await import('firebase/firestore');
            const { db } = await import('@/lib/firebase');

            // Set default seed if missing
            const currentSeed = seed !== undefined ? seed : Math.floor(Math.random() * 2147483647);
            const placeholderUrl = `https://api.dicebear.com/7.x/shapes/svg?seed=${Date.now()}`;

            const dataToSave: any = {
                prompt: (forcedPrompt || rawTemplate).trim() || finalPrompt,
                title: title.trim() || undefined,
                variables: variables,
                settings: {
                    quality,
                    aspectRatio,
                    seed: currentSeed,
                    guidanceScale: guidanceScale || 7.0,
                    modality,
                    rawTemplate: (forcedPrompt || rawTemplate)
                },
                collectionIds: selectedCollectionIds.length > 0 ? selectedCollectionIds : [],
                isDraft: true,
                updatedAt: serverTimestamp()
            };

            if (negativePrompt.trim()) {
                dataToSave.settings.negativePrompt = negativePrompt.trim();
            }
            if (activeID.trim()) {
                dataToSave.promptSetID = activeID.trim();
            }

            let finalImageId = refImageId;

            if (refImageId) {
                // UPDATE existing
                const docRef = doc(db, 'users', user!.uid, 'images', refImageId);
                await setDoc(docRef, dataToSave, { merge: true });
            } else {
                // CREATE new
                const newData = {
                    ...dataToSave,
                    userId: user!.uid,
                    imageUrl: placeholderUrl,
                    createdAt: serverTimestamp(),
                    creditsCost: 0
                };
                const docRef = await addDoc(collection(db, 'users', user!.uid, 'images'), newData);
                finalImageId = docRef.id;
                setWarning('Saved as New Architectural Draft.');
                
                if (!promptSetID) {
                    setPromptSetID(dataToSave.promptSetID);
                }

                // Transition natively into edit mode so immediate generation targets this exact placeholder!
                const newParams = new URLSearchParams(searchParams.toString());
                newParams.set('ref', finalImageId);
                newParams.set('edit', '1');
                router.replace(`/generate?${newParams.toString()}`, { scroll: false });
            }

            const savedImage: GeneratedImage = {
                id: finalImageId,
                ...dataToSave,
                createdAt: Date.now()
            } as any;

            setGeneratedImages(prev => [savedImage, ...prev]);
            setSelectedImageIndex(0);
            setWarning('Prompt Architecture saved to registry successfully.');
            bakeVariablesIntoTemplate();
            await fetchHistory();
        } catch (err: any) {
            setError('Failed to save prompt: ' + err.message);
        } finally {
            setGenerating(false);
        }
    };

    // Actual generation logic
    const executeGeneration = useCallback(async () => {
        setShowConfirmModal(false);
        let activePromptSetID = promptSetID;
        if (isNewImageSet) {
            activePromptSetID = generatePromptSetID();
            setPromptSetID(activePromptSetID);
            setIsNewImageSet(false);
        }

        const finalPrompt = getFinalPrompt();
        
        // Bake current variable values into the template as new defaults,
        // then silently persist to Firestore before generation starts.
        let bakedTemplate = rawTemplate;
        if (promptMode === 'customize' && user) {
            bakedTemplate = getBakedTemplate(rawTemplate, variables);
            setRawTemplate(bakedTemplate); // Update local editor state
            
            // Silent Firestore update — does NOT navigate, does NOT setGenerating
            try {
                const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
                const { db } = await import('@/lib/firebase');
                const dataToUpdate: any = {
                    prompt: bakedTemplate.trim() || finalPrompt,
                    variables,
                    settings: {
                        quality,
                        aspectRatio,
                        guidanceScale: guidanceScale || 7.0,
                        modality,
                        rawTemplate: bakedTemplate,
                    },
                    promptSetID: activePromptSetID,
                    isDraft: true,
                    updatedAt: serverTimestamp(),
                };
                if (negativePrompt.trim()) dataToUpdate.settings.negativePrompt = negativePrompt.trim();
                if (title.trim()) dataToUpdate.title = title.trim();

                if (refImageId) {
                    // Update existing placeholder/draft
                    const docRef = doc(db, 'users', user.uid, 'images', refImageId);
                    await setDoc(docRef, dataToUpdate, { merge: true });
                } else {
                    // Upsert using the promptSetID as a stable key to avoid spurious new doc creation
                    const docRef = doc(db, 'users', user.uid, 'drafts', activePromptSetID);
                    await setDoc(docRef, { ...dataToUpdate, userId: user.uid }, { merge: true });
                }
            } catch (e) {
                // Non-fatal — generation can still proceed
                console.warn('[pre-gen save] Failed to persist baked template:', e);
            }
        }

        setError('');
        setWarning('');
        setGenerating(true);
        setGeneratedImages([]);
        setEditedImage(null);
        setSelectedImageIndex(0);

        try {
            if (!user) {
                setError('Please sign in to generate images');
                setGenerating(false);
                return;
            }

            if (abortControllerRef.current) abortControllerRef.current.abort();
            abortControllerRef.current = new AbortController();

            const token = await user.getIdToken();

            const response = await fetch('/api/generate', {
                method: 'POST',
                signal: abortControllerRef.current.signal,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    prompt: finalPrompt,
                    rawPrompt: promptMode === 'customize' ? getBakedTemplate(rawTemplate, variables) : undefined,
                    quality: (modality === 'image' && quality === 'video') ? 'standard' : quality,
                    aspectRatio,
                    promptType: 'freeform',
                    count: batchSize,
                    ...(isPro && {
                        seed: seed ?? undefined,
                        negativePrompt: negativePrompt.trim() || undefined,
                        guidanceScale: guidanceScale ?? undefined,
                    }),
                    referenceImage: referenceImage?.base64,
                    referenceMimeType: referenceImage?.mimeType,
                    sourceImageId: referenceImage?.id,
                    promptSetID: promptSetID.trim() || undefined,
                    collectionIds: selectedCollectionIds.length > 0 ? selectedCollectionIds : undefined,
                    modality,
                    referenceImageUrl: referenceImage?.url,
                    // Only overwrite the original when explicitly in "Edit Prompt" mode (?edit=1)
                    // "New Version" (?ref= without edit=1) creates a new sibling in the same promptSetID
                    targetVariationId: (isEditing && refImageId) ? refImageId : undefined,
                    title: title.trim() || undefined,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Generation failed');
            }

            // Read the stream
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) {
                throw new Error('Failed to start stream reader');
            }

            let done = false;
            let hasReceivedData = false;
            let hasError = false;
            let buffer = '';
            while (!done) {
                const { value, done: readerDone } = await reader.read();
                done = readerDone;
                if (value) {
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n\n');
                    buffer = lines.pop() || ''; // Keep the last partial line in the buffer

                    for (const line of lines) {
                        const message = line.trim();
                        if (!message.startsWith('data: ')) continue;
                        
                        try {
                            const jsonStr = message.replace('data: ', '').trim();
                            if (!jsonStr) continue;
                            const data = JSON.parse(jsonStr);

                            if (data.type === 'progress') {
                                setGenerationProgress({
                                    current: data.current,
                                    total: data.total,
                                    message: data.message
                                });
                            } else if (data.type === 'consent_required') {
                                console.log('[PromptTool UI] Consent Required:', data.metadata.location);
                                setFailoverMetadata({ requestId: data.requestId, metadata: data.metadata });
                            } else if (data.type === 'image_ready') {
                                hasReceivedData = true;
                                const newImg = { ...data.image, title: data.image.title || undefined };
                                setGeneratedImages(prev => [...prev, newImg]);
                                
                                if (newImg.promptSetID && !promptSetID) {
                                    setPromptSetID(newImg.promptSetID);
                                }

                                if (newImg.settings?.modality === 'video' || newImg.videoUrl) {
                                    createVideoThumbnail(newImg.id, newImg.videoUrl || newImg.imageUrl);
                                }
                            } else if (data.type === 'complete') {
                                hasReceivedData = true;
                                if (data.images && data.images.length > 0) {
                                    const masterImage = data.images[0];
                                    const processedImages = data.images.map((img: any) => ({ ...img, title: img.title || undefined }));
                                    setGeneratedImages(processedImages);
                                    setSelectedImageIndex(0);

                                    if (refImageId && user) {
                                        try {
                                            const { doc, updateDoc } = await import('firebase/firestore');
                                            const { db } = await import('@/lib/firebase');
                                            const docRef = doc(db, 'users', user.uid, 'images', refImageId);
                                            await updateDoc(docRef, { 
                                                imageUrl: masterImage.imageUrl, 
                                                isDraft: false,
                                                prompt: finalPrompt,
                                                updatedAt: new Date()
                                            }).catch(() => { });
                                        } catch (e) { }
                                    }

                                    if (searchParams?.get('ref')) {
                                        const newParams = new URLSearchParams(searchParams.toString());
                                        newParams.delete('ref');
                                        newParams.delete('edit');
                                        router.replace(`/generate?${newParams.toString()}`, { scroll: false });
                                    }
                                }

                                if (data.warning) setWarning(data.warning);

                                const finalState = {
                                    prompt: getFinalPrompt(),
                                    quality, aspectRatio, batchSize, negativePrompt, seed, guidanceScale,
                                    promptMode, variables, rawTemplate, selectedBlueprint, modality,
                                    promptSetID, selectedCollectionIds, title, updatedAt: Date.now(),
                                };
                                localStorage.setItem('generation_session_v1', JSON.stringify(finalState));
                                setLastBakedState(JSON.stringify({ rawTemplate, variables, title }));

                                await refreshCredits();
                                await fetchHistory();
                            } else if (data.type === 'error') {
                                hasError = true;
                                setError(data.error);
                            }
                        } catch (e) {
                            console.warn('Failed to parse SSE line:', message, e);
                        }
                    }
                }
            }
            
            // Final check for silent network failure
            if (!hasReceivedData && !hasError) {
                setError('Generation stream closed prematurely. No image data was received from the server.');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setGenerating(false);
            setGenerationProgress(null);
            abortControllerRef.current = null;
        }
    }, [
        user,
        profile,
        prompt,
        quality,
        aspectRatio,
        batchSize,
        seed,
        negativePrompt,
        guidanceScale,
        promptMode,
        promptSetID,
        referenceImage,
        selectedCollectionIds,
        title,
        isPro,
        isEditing,
        refImageId,
        rawTemplate,
        variables,
        modality,
        getBakedTemplate,
        refreshCredits,
        fetchHistory,
        createVideoThumbnail,
        router,
        searchParams
    ]);

    const handleFailoverConsent = async (approved: boolean) => {
        if (!failoverMetadata || !user) return;
        
        try {
            const token = await user.getIdToken();
            const response = await fetch('/api/generate', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    requestId: failoverMetadata.requestId,
                    approved
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to send consent');
            }

            setFailoverMetadata(null);
            if (!approved) {
                setGenerating(false);
                setGenerationProgress(null);
            }
        } catch (err: any) {
            setError(`Consent failed: ${err.message}`);
            setFailoverMetadata(null);
            setGenerating(false);
            setGenerationProgress(null);
        }
    };
    const handleCancelGeneration = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setGenerating(false);
        setGenerationProgress(null);
    }, []);

    // Handle Generation Trigger (Shows modal first)
    const handleGenerate = useCallback(() => {
        // Lineage Anchor Protocol: Ensure current variable values are committed as new defaults in "Your Vision"
        // This ensures the generated image and the saved prompt architecture are perfectly in sync
        if (promptMode === 'customize') {
            const baked = getBakedTemplate(rawTemplate, variables);
            
            // Forced Architectural Anchor: We always set the baked template and new variable defaults,
            // even if the rawTemplate string itself hasn't changed structurally.
            // This ensures that current inputs (Blue) instantly become the new defaults (Gray).
            setRawTemplate(baked);
            
            const newVariables: Record<string, { value: string, default: string }> = {};
            Object.entries(variables).forEach(([key, data]) => {
                // committed current value becomes BOTH the value and the new default reference
                newVariables[key] = { value: data.value, default: data.value };
            });
            setVariables(newVariables);
        }

        const finalPrompt = getFinalPrompt();

        if (!finalPrompt.trim()) {
            setError('Please enter a prompt');
            return;
        }

        const cost = modality === 'video'
            ? CREDIT_COSTS.video
            : ((CREDIT_COSTS[quality as ImageQuality] || CREDIT_COSTS.standard) * batchSize);
        if (availableCredits < cost) {
            setError(`Insufficient credits. Need ${cost}, have ${availableCredits}`);
            return;
        }

        setShowConfirmModal(true);
    }, [getFinalPrompt, quality, batchSize, modality, availableCredits, rawTemplate, variables, promptMode, getBakedTemplate, setRawTemplate, setVariables]);
    useEffect(() => {
        if (!loading && !user) {
            router.push('/');
        }
    }, [user, loading, router]);

    // Keyboard shortcuts - Use Ref for handleGenerate to avoid listener churn on every keystroke
    const handleNavigateHistory = useCallback((direction: 'up' | 'down') => {
        if (historyImages.length === 0) return;

        let newIndex = historyIndex;
        if (direction === 'up') {
            newIndex = Math.min(historyIndex + 1, historyImages.length - 1);
        } else {
            newIndex = Math.max(historyIndex - 1, -1);
        }

        if (newIndex !== historyIndex) {
            setHistoryIndex(newIndex);
            if (newIndex === -1) {
                setPrompt('');
            } else {
                handleRemix(historyImages[newIndex]);
            }
        }
    }, [historyIndex, historyImages, handleRemix]);

    // Maintain refs for stable listeners
    const latestGenerateRef = useRef(handleGenerate);
    const latestNavigateRef = useRef(handleNavigateHistory);

    useEffect(() => {
        latestGenerateRef.current = handleGenerate;
        latestNavigateRef.current = handleNavigateHistory;
    }, [handleGenerate, handleNavigateHistory]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // CTRL/CMD + ENTER = Generate
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                if (!generating && !enhancing) {
                    e.preventDefault();
                    e.stopPropagation();
                    latestGenerateRef.current();
                }
                return;
            }

            // ALT + UP/DOWN = Navigate History
            if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                e.preventDefault();
                e.stopPropagation();
                latestNavigateRef.current(e.key === 'ArrowUp' ? 'up' : 'down');
            }
        };

        // Use capture mode to ensure we catch events even if children try to stop propagation
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [generating, enhancing]);
    // Still depend on generating/enhancing to ensure logs are accurate, or move them inside

    // Download media
    const handleDownload = async (format: 'png' | 'jpeg' | 'mp4' = 'png') => {
        const selectedImage = generatedImages[selectedImageIndex]?.imageUrl;
        const imageToDownload = editedImage || selectedImage;
        const filename = `studio-image-${Date.now()}.${format}`;

        if (!imageToDownload) {
            return;
        }

        try {
            if (imageToDownload.startsWith('data:')) {
                const response = await fetch(imageToDownload);
                const blob = await response.blob();
                const downloadUrl = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = downloadUrl;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 100);
            } else {
                const proxyUrl = `/api/download?url=${encodeURIComponent(imageToDownload)}&filename=${encodeURIComponent(filename)}`;
                const link = document.createElement('a');
                link.href = proxyUrl;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        } catch (err: any) {
            console.error('[Download] Failed:', err);
            setError('Download failed. Try right-clicking and "Save Image As".');
        }
    };

    const handleSaveOverlay = (dataUrl: string) => {
        setEditedImage(dataUrl);
        setWarning('Overlay applied. Download or Save as a new variation to preserve.');
        setShowTextEditor(false);
    };

    const handleSaveVariation = async () => {
        if (!editedImage || !user || generatedImages.length === 0) return;
        
        try {
            setGenerating(true);
            setGenerationProgress({ current: 1, total: 1, message: 'Preserving Architecture...' });
            
            const currentImg = generatedImages[selectedImageIndex];
            const token = await user.getIdToken();
            
            const base64Data = editedImage.split(',')[1];
            const mimeType = editedImage.split(';')[0].split(':')[1] || 'image/png';

            const response = await fetch('/api/edit/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    imageData: base64Data,
                    mimeType,
                    originalImageId: currentImg.id,
                    saveAsNew: true,
                    prompt: currentImg.prompt,
                    promptSetID: currentImg.promptSetID,
                    settings: currentImg.settings,
                    collectionIds: currentImg.collectionIds || (currentImg.collectionId ? [currentImg.collectionId] : []),
                    title: currentImg.title
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to preserve variation');
            }

            const data = await response.json();
            
            const newImageObj = {
                id: data.imageId,
                imageUrl: data.imageUrl,
                title: currentImg.title || undefined,
                prompt: `[Edited] ${currentImg.prompt}`,
                settings: { ...currentImg.settings, editedFrom: currentImg.id },
                promptSetID: currentImg.promptSetID,
                collectionIds: currentImg.collectionIds,
                createdAt: Date.now()
            } as unknown as GeneratedImage;
            
            setGeneratedImages(prev => [...prev, newImageObj]);
            setSelectedImageIndex(generatedImages.length);
            setEditedImage(null);
            setWarning('Variation successfully conserved to Registry.');
            await fetchHistory();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setGenerating(false);
            setGenerationProgress(null);
        }
    };


    const handleSaveNewSet = async () => {
        const newID = generatePromptSetID();
        setPromptSetID(newID);
        setIsNewImageSet(false);
        await handleSaveDraftPrompt(newID);
    };

    const handleDeleteImage = async (id: string) => {
        try {
            // local state remove first for speed
            const index = generatedImages.findIndex(img => img.id === id);
            if (index === -1) return;

            const newImages = [...generatedImages];
            newImages.splice(index, 1);
            setGeneratedImages(newImages);
            
            // Adjust selection index if needed
            if (selectedImageIndex >= newImages.length) {
                setSelectedImageIndex(Math.max(0, newImages.length - 1));
            }

            // check if it's a real db image (not just a local batch one)
            const { deleteDoc, doc } = await import('firebase/firestore');
            const { db } = await import('@/lib/firebase');
            try {
                const imgDocRef = doc(db, 'users', user!.uid, 'images', id);
                await deleteDoc(imgDocRef);
                setWarning('Variation purged from registry.');
            } catch (firestoreErr) {
                // If it wasn't in DB yet (unsaved batch), just ignore
                console.log('Local variation removed.');
            }
        } catch (err: any) {
            console.error('Failed to delete image:', err);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Icons.spinner className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!user || !profile) {
        return null;
    }

    const isCasual = profile.audienceMode === 'casual';
    const isProInUI = hasStudioAccess || profile.subscription === 'pro' || profile.role === 'admin' || profile.role === 'su';

    // Calculate unsaved changes for navigation prompts
    const currentStateStr = JSON.stringify({ rawTemplate, variables, title });
    const hasUnsavedChanges = (lastBakedState !== '' && currentStateStr !== lastBakedState) || 
                              (lastBakedState === '' && rawTemplate.trim().length > 0);

    const handleSafeNavigation = (route: string) => {
        if (hasUnsavedChanges) {
            setPendingRoute(route);
            setShowUnsavedModal(true);
        } else {
            window.location.href = route;
        }
    };

    if (!hasStudioAccess && !loading) {
        return (
            <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-6 pt-20">
                <Card variant="glass" className="max-w-xl w-full p-12 rounded-[3.5rem] border-primary/30 bg-primary/5 text-center space-y-8 backdrop-blur-3xl shadow-2xl relative overflow-hidden">
                    <div className="absolute -top-12 -left-12 w-48 h-48 bg-primary/10 rounded-full blur-3xl" />
                    <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-stillwater-teal/10 rounded-full blur-3xl" />
                    
                    <div className="relative z-10 space-y-6">
                        <div className="w-20 h-20 rounded-3xl bg-primary/20 flex items-center justify-center text-primary mx-auto shadow-lg shadow-primary/20">
                            <Icons.sparkles className="w-10 h-10" />
                        </div>
                        
                        <div className="space-y-3">
                            <h2 className="text-4xl font-black uppercase tracking-tighter">Studio Access <br /><span className="text-primary">Restricted</span></h2>
                            <p className="text-foreground-muted font-medium text-sm leading-relaxed">
                                The Stillwater Studio is an exclusive multimodal pipeline reserved for Pro Suite members. 
                                Unlock unlimited generation, 4K rendering, and asynchronous video engines.
                            </p>
                        </div>

                        <div className="pt-4 flex flex-col gap-4">
                            <Button
                                onClick={() => window.open(`http://localhost:3002/pricing?returnUrl=${encodeURIComponent('http://localhost:3001/generate')}`, '_blank')}
                                className="h-16 w-full rounded-2xl bg-white text-black font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all shadow-xl shadow-white/5"
                            >
                                Upgrade to Master Suite
                            </Button>
                            <Link href="/dashboard" className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground-muted hover:text-white transition-colors">
                                Return to Dashboard
                            </Link>
                        </div>
                    </div>
                </Card>
            </div>
        );
    }
    return (
        <div className="min-h-screen bg-background">
            <GenerateHeader
                availableCredits={availableCredits}
                onHistoryOpen={() => setIsHistoryOpen(true)}
                onGalleryClick={() => handleSafeNavigation('/gallery')}
                onDashboardClick={() => handleSafeNavigation('/dashboard')}
                onPricingClick={() => handleSafeNavigation('/pricing')}
                onAdminClick={() => handleSafeNavigation('/admin')}
                isAdmin={profile.role === 'admin' || profile.role === 'su'}
            />

            <main className="max-w-7xl mx-auto px-4 py-8">
                <div className={cn(
                    "grid grid-cols-1 lg:grid-cols-2 gap-10",
                    isCasual && "max-w-5xl mx-auto"
                )}>
                    {/* Left: Controls */}
                    <div className="space-y-8 animate-in slide-in-from-left-4 duration-700">
                        <section>
                            {isEditing && refImageId && (
                                <div className="mb-4 flex items-center justify-between gap-4 px-4 py-3 bg-primary/5 border border-primary/20 rounded-2xl">
                                    <div className="flex items-center gap-3">
                                        <Icons.text size={14} className="text-primary shrink-0" />
                                        <div>
                                            <p className="text-[10px] font-black text-primary uppercase tracking-widest">Editing Prompt</p>
                                            <p className="text-[10px] text-foreground-muted">Modify the settings and manifest to create a new version.</p>
                                        </div>
                                    </div>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        className="shrink-0 h-8 px-4 text-[10px] font-black uppercase tracking-widest border-border/50 hover:border-error/50 hover:text-error transition-all"
                                        onClick={() => router.back()}
                                    >
                                        <Icons.close size={12} className="mr-1.5" />
                                        Cancel Edit
                                    </Button>
                                </div>
                            )}
                            <h1 className={cn(
                                "font-black tracking-tighter mb-2 text-foreground",
                                isCasual ? "text-5xl" : "text-4xl"
                            )}>
                                {isCasual ? 'CREATE MAGIC' : 'GENERATE VARIATIONS'}
                            </h1>
                            <p className="text-foreground-muted text-sm font-medium uppercase tracking-widest opacity-60">
                                {isCasual ? 'Turn your wildest ideas into reality in seconds.' : 'Professional precision for high-end AI production.'}
                            </p>
                        </section>

                        <PromptSection
                            promptMode={promptMode}
                            setPromptMode={setPromptMode}
                            prompt={prompt}
                            setPrompt={setPrompt}
                            title={title}
                            setTitle={setTitle}
                            selectedBlueprint={selectedBlueprint}
                            setSelectedBlueprint={setSelectedBlueprint}
                            variables={variables}
                            setVariables={setVariables}
                            rawTemplate={rawTemplate}
                            setRawTemplate={setRawTemplate}
                            onSaveBlueprint={handleSaveBlueprint}
                            isSavingBlueprint={isSavingBlueprint}
                            handleEnhancePrompt={handleEnhancePrompt}
                            enhancing={enhancing}
                            isCasual={isCasual}
                            referenceImage={referenceImage}
                            loadingReference={loadingReference}
                            onRemoveReference={() => {
                                setReferenceImage(null);
                                if (searchParams.get('ref')) {
                                    const newParams = new URLSearchParams(searchParams.toString());
                                    newParams.delete('ref');
                                    router.replace(`/generate?${newParams.toString()}`, { scroll: false });
                                }
                            }}
                            onUploadReference={handleUploadReference}
                            onOpenGalleryPicker={() => {
                                setGalleryPickerMode('reference');
                                setIsGalleryPickerOpen(true);
                            }}
                            onOpenPromptPicker={() => {
                                setGalleryPickerMode('prompt');
                                setIsGalleryPickerOpen(true);
                            }}
                            onGalleryRequest={() => handleSafeNavigation('/gallery')}
                            hasUnsavedChanges={hasUnsavedChanges}
                            isVisionEditEnabled={isVisionEditEnabled}
                            setIsVisionEditEnabled={setIsVisionEditEnabled}
                            hasStudioAccess={hasStudioAccess}
                        />

                        <SettingsSection
                            modality={modality}
                            setModality={setModality}
                            quality={quality}
                            setQuality={setQuality}
                            aspectRatio={aspectRatio}
                            setAspectRatio={setAspectRatio}
                            batchSize={batchSize}
                            setBatchSize={setBatchSize}
                            promptSetID={promptSetID}
                            setPromptSetID={setPromptSetID}
                            onGenerateSetID={() => setPromptSetID(generatePromptSetID())}
                            allowedQualities={allowedQualities}
                            isPro={isProInUI}
                            isCasual={isCasual}
                        />

                        {/* Messages */}
                        {(error || warning) && (
                            <div className="space-y-3 animate-in fade-in zoom-in-95 duration-300">
                                {error && (
                                    <div className="p-4 bg-error/10 border border-error/20 rounded-2xl flex items-start gap-3">
                                        <Icons.arrowRight className="text-error mt-0.5 rotate-180" size={16} />
                                        <p className="text-xs font-bold text-error leading-relaxed uppercase tracking-tight">{error}</p>
                                    </div>
                                )}
                                {warning && (
                                    <div className="p-4 bg-primary/10 border border-primary/20 rounded-2xl flex items-start gap-3">
                                        <Icons.zap className="text-primary mt-0.5" size={16} />
                                        <p className="text-xs font-bold text-primary leading-relaxed uppercase tracking-tight">{warning}</p>
                                    </div>
                                )}
                            </div>
                        )}


                    </div>

                    {/* Right: Preview */}
                    <div className="animate-in slide-in-from-right-4 duration-700 delay-200">
                        <PreviewSection
                            generating={generating}
                            generatedImages={generatedImages}
                            selectedImageIndex={selectedImageIndex}
                            setSelectedImageIndex={setSelectedImageIndex}
                            editedImage={editedImage}
                            setEditedImage={setEditedImage}
                            modality={modality}
                            aspectRatio={aspectRatio}
                            generationProgress={generationProgress}
                            onShowTextEditor={() => setShowTextEditor(true)}
                            onDownload={handleDownload}
                            promptSetID={promptSetID}
                            onSaveVariation={handleSaveVariation}
                            onDeleteImage={handleDeleteImage}
                            onGenerate={handleGenerate}
                            compiledPrompt={resultantPrompt}
                            isNewImageSet={isNewImageSet}
                            setIsNewImageSet={setIsNewImageSet}
                            onSaveDraftPrompt={handleSaveNewSet}
                            onSaveArchitecturalDraft={handleSaveDraftPrompt}
                            onCancel={handleCancelGeneration}
                            availableCredits={credits?.balance}
                            currentCost={currentCost}
                        />

                        {/* Spawned Variation Grid - Relocated for Better Focus */}
                        {generatedImages.length > 0 && !generating && (
                            <div className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-700">
                                <div className="flex items-center justify-between mb-3 px-1">
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground-muted">Variation Manifest</h4>
                                    <span className="text-[10px] font-mono text-primary/60">{generatedImages.length} Spawned</span>
                                </div>
                                <div className="flex gap-3 overflow-x-auto pt-2 px-2 pb-4 -mx-2 scrollbar-hide snap-x relative group/thumbnails">
                                    {generatedImages.map((img, idx) => (
                                        <div key={img.id} className="relative flex-shrink-0 snap-start">
                                            <button
                                                onClick={() => {
                                                    setSelectedImageIndex(idx);
                                                    setEditedImage(null);
                                                }}
                                                className={cn(
                                                    "w-16 h-16 rounded-xl overflow-hidden transition-all shadow-sm",
                                                    selectedImageIndex === idx
                                                        ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-105 opacity-100 shadow-md"
                                                        : "opacity-60 hover:opacity-100 grayscale hover:grayscale-0 scale-95 hover:scale-100"
                                                )}
                                            >
                                                <img src={img.imageUrl} alt={img.title || `Variation ${idx + 1}`} className="w-full h-full object-cover" />
                                                <div className="absolute inset-x-0 bottom-0 p-1 bg-black/60 backdrop-blur-sm z-20">
                                                    <p className="text-[7px] font-black uppercase text-white truncate text-center">
                                                        {img.title || '<no title>'}
                                                    </p>
                                                </div>
                                            </button>

                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteImage(img.id);
                                                }}
                                                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-error text-white rounded-full flex items-center justify-center border-2 border-background opacity-0 group-hover/thumbnails:opacity-100 hover:scale-110 transition-all shadow-sm z-10"
                                                title="Delete Variation"
                                            >
                                                <Icons.close size={10} strokeWidth={3} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {showTextEditor && generatedImages.length > 0 && (
                    <TextOverlayEditor
                        imageUrl={generatedImages[selectedImageIndex].imageUrl}
                        onClose={() => setShowTextEditor(false)}
                        onSave={handleSaveOverlay}
                    />
                )}
            </main>

            <HistorySidebar
                isOpen={isHistoryOpen}
                onClose={() => setIsHistoryOpen(false)}
                images={historyImages}
                loading={loadingHistory}
                onRemix={handleRemix}
            />

            <ConfirmationModal
                isOpen={showConfirmModal}
                title="Confirm Resource Spend"
                onCancel={() => setShowConfirmModal(false)}
                customButtons={[
                    {
                        label: "Let's Manifest",
                        onClick: () => {
                            setShowConfirmModal(false);
                            executeGeneration();
                        },
                        className: "col-span-2 py-4 px-6 rounded-2xl bg-primary text-white text-[11px] font-black uppercase tracking-[0.2em] hover:bg-primary-hover hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-2"
                    },
                    {
                        label: "Abort Initialization",
                        onClick: () => setShowConfirmModal(false),
                        className: "col-span-2 py-3 px-6 rounded-xl border border-white/5 text-[9px] font-black uppercase tracking-[0.2em] text-white/20 hover:text-white/40 hover:bg-white/5 transition-all flex items-center justify-center gap-2"
                    }
                ]}
            >
                <div className="space-y-6">
                    <p className="text-sm font-medium text-foreground/60 leading-relaxed uppercase tracking-wider">
                        You are about to spend <span className="text-primary font-black">{currentCost} credits</span> to manifest this creation across the neural compute cluster.
                    </p>
                    
                    <div className="p-5 bg-white/[0.03] rounded-2xl border border-white/5 flex items-center justify-between shadow-inner group transition-colors hover:border-primary/20">
                        <div className="flex flex-col gap-1 text-left">
                            <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] group-hover:text-primary/40 transition-colors">Projected Balance</span>
                            <span className="text-[10px] font-bold text-foreground-muted">Post-Generation</span>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-xl border border-primary/20">
                            <span className="font-black text-primary tabular-nums text-lg">{availableCredits - currentCost}</span>
                            <Icons.zap size={14} className="text-primary animate-pulse" />
                        </div>
                    </div>
                </div>
            </ConfirmationModal>

            <GalleryPickerModal
                isOpen={isGalleryPickerOpen}
                onClose={() => setIsGalleryPickerOpen(false)}
                onSelect={handleSelectGalleryImage}
                mode={galleryPickerMode}
            />

            <ConfirmationModal
                isOpen={showUnsavedModal}
                title="Bake Architecture & Leave?"
                onCancel={() => setShowUnsavedModal(false)}
            >
                <div className="space-y-6">
                    <div className="space-y-3">
                        <p className="text-sm leading-relaxed text-foreground-muted">You have unsaved changes in your vision template.</p>
                    </div>

                    <div className="flex flex-col gap-2.5 py-2 border-t border-border/40 pt-4">
                        <Tooltip 
                            content={
                                <div className="space-y-1">
                                    <p className="font-black text-primary uppercase text-[9px] mb-1">Library Synchronization</p>
                                    <p>Commits your architecture & variables back to the master Blueprint library. Use this when you've reached a stable, winning configuration.</p>
                                    <p className="text-green-400/80 pt-1">Consequence: Permanently updates the baseline for this blueprint across all apps.</p>
                                </div>
                            }
                            className="w-full"
                        >
                            <Button 
                                variant="primary" 
                                className="w-full h-12 font-black uppercase tracking-widest text-[10px] bg-primary text-white shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                                onClick={async () => {
                                    setIsExiting(true);
                                    await handleSaveBlueprint();
                                    if (pendingRoute) window.location.href = pendingRoute;
                                }}
                            >
                                <Icons.zap size={14} className="group-hover:rotate-12 transition-transform" />
                                Bake & Leave (Recommended)
                            </Button>
                        </Tooltip>

                        <Tooltip 
                            content={
                                <div className="space-y-1">
                                    <p className="font-black text-blue-400 uppercase text-[9px] mb-1">Personal Draft Storage</p>
                                    <p>Saves your current session state only to your personal tray. Useful for incremental work that isn't ready for the master registry yet.</p>
                                    <p className="text-blue-300/80 pt-1">Consequence: Your work is hidden from other suite tools until you perform a final Bake.</p>
                                </div>
                            }
                            className="w-full"
                        >
                            <Button 
                                variant="secondary" 
                                className="w-full h-11 font-black uppercase tracking-widest text-[10px] bg-background-secondary border-border/50 hover:border-primary/30 transition-all flex items-center justify-center gap-2"
                                onClick={async () => {
                                    setIsExiting(true);
                                    await handleSaveDraftPrompt();
                                    if (pendingRoute) window.location.href = pendingRoute;
                                }}
                            >
                                <Icons.database size={14} className="opacity-70" />
                                Save Draft & Leave
                            </Button>
                        </Tooltip>
                        
                        <Tooltip 
                            content={
                                <div className="space-y-1">
                                    <p className="font-black text-red-400 uppercase text-[9px] mb-1">Session Purge</p>
                                    <p>Exits the studio without saving any of your latest architectural changes.</p>
                                    <p className="text-red-500 font-black pt-1">Danger: All unbaked modifications will be permanently lost and cannot be recovered.</p>
                                </div>
                            }
                            className="w-full"
                        >
                            <Button 
                                variant="secondary" 
                                className="w-full h-11 text-[10px] uppercase font-black tracking-widest text-error/70 border-error/20 hover:bg-error/5 group flex items-center justify-center gap-2"
                                onClick={() => {
                                    setIsExiting(true);
                                    if (pendingRoute) window.location.href = pendingRoute;
                                }}
                            >
                                <Icons.close size={14} className="opacity-50 group-hover:opacity-100" />
                                Discard Changes & Leave
                            </Button>
                        </Tooltip>

                        <div className="flex justify-center mt-2">
                            <Tooltip 
                                content="Aborts navigation and returns you to the active workspace with all changes intact."
                                position="top"
                                width="w-48"
                            >
                                <button 
                                    onClick={() => setShowUnsavedModal(false)}
                                    className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground-muted hover:text-white transition-colors"
                                >
                                    Wait, I want to stay
                                </button>
                            </Tooltip>
                        </div>
                    </div>
                </div>
            </ConfirmationModal>
            {/* Failover Consent Modal */}
            <ConfirmationModal
                isOpen={!!failoverMetadata}
                title="Failover Required"
                onConfirm={() => handleFailoverConsent(true)}
                onCancel={() => handleFailoverConsent(false)}
                confirmLabel="Proceed"
                cancelLabel="Abort"
                type="warning"
            >
                <div className="space-y-4 text-left">
                    <p className="text-sm opacity-80">The previous region failed. Proceed with the next regional configuration?</p>
                    <div className="bg-black/40 p-4 rounded-xl border border-white/5 font-mono text-[11px] space-y-2 relative group/meta">
                        <button 
                            onClick={() => {
                                if (failoverMetadata) {
                                    const text = JSON.stringify({
                                        requestId: failoverMetadata.requestId,
                                        ...failoverMetadata.metadata
                                    }, null, 2);
                                    navigator.clipboard.writeText(text);
                                    setWarning('Metadata copied to clipboard');
                                }
                            }}
                            className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 opacity-0 group-hover/meta:opacity-100 transition-all text-primary"
                            title="Copy Metadata JSON"
                        >
                            <Icons.copy size={12} />
                        </button>
                        <div className="flex justify-between gap-4">
                            <span className="opacity-40 shrink-0 uppercase tracking-tighter">Project</span>
                            <span className="text-primary truncate">{failoverMetadata?.metadata.projectId}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span className="opacity-40 shrink-0 uppercase tracking-tighter">Location</span>
                            <span className="text-green-400 truncate">{failoverMetadata?.metadata.location}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span className="opacity-40 shrink-0 uppercase tracking-tighter">Model</span>
                            <span className="text-blue-400 truncate">{failoverMetadata?.metadata.model}</span>
                        </div>
                    </div>
                    <p className="text-[10px] opacity-60 italic text-center">Proceeding will consume quota from the listed region.</p>
                </div>
            </ConfirmationModal>
        </div>
    );
}
