// Generic Timestamp type to work with both Firebase client and admin SDKs
export type FirestoreTimestamp = any;

// ============================================
// User & Authentication Types
// ============================================

export interface Notification {
    id: string;
    userId: string; // The person receiving the notification
    type: 'vote' | 'comment' | 'follow' | 'mention' | 'reaction' | 'system';
    actorId: string; // The person who triggered the notification
    actorName: string;
    actorPhotoURL?: string;
    entryId?: string; // Optional: reference to the community entry
    entryImageUrl?: string;
    text?: string; // Content of the comment or system message
    emoji?: string; // For reaction notifications
    read: boolean;
    createdAt: FirestoreTimestamp;
}

export type UserRole = 'member' | 'admin' | 'su';
export type SubscriptionTier = 'free' | 'standard' | 'pro';
export type AudienceMode = 'casual' | 'professional';

export interface UserProfile {
    uid: string;
    email: string;
    displayName: string | null;
    username?: string; // Unique handle for @mentions
    photoURL: string | null;
    role: UserRole;
    actingAs?: UserRole; // For role-switching (admin viewing as member)
    subscription: SubscriptionTier;
    audienceMode: AudienceMode;
    totalInfluence?: number; // Sum of all upvotes across community entries
    publishedCount?: number; // Total number of images published to the community hub
    followerCount?: number;
    followingCount?: number;
    badges?: string[]; // Achievement tags like 'elite', 'verified'
    bio?: string;
    bannerUrl?: string;
    socialLinks?: {
        twitter?: string;
        instagram?: string;
        website?: string;
    };
    
    // Suite Entitlements (Shared across ecosystem)
    subscriptionMetadata?: {
        bundleId: string;
        activeSuites: string[]; // e.g. ['resources', 'studio', 'registry', 'prompttool']
        status: 'active' | 'past_due' | 'canceled' | 'incomplete';
        expiresAt?: any;
    };

    // New unified subscription object (written by Stripe webhook via PromptResources)
    suiteSubscription?: {
        bundleId: string;
        activeSuites: string[];
        status: 'active' | 'past_due' | 'canceled' | 'incomplete';
        expiresAt?: any;
    };

    createdAt: FirestoreTimestamp;
    updatedAt: FirestoreTimestamp;
}

// Creator Badges Configuration
export const BADGES: Record<string, { label: string, icon: string, color: string }> = {
    'elite': { label: 'Elite Creator', icon: '🎖️', color: 'text-yellow-500' },
    'verified': { label: 'Verified', icon: '✅', color: 'text-blue-500' },
    'og': { label: 'OG Member', icon: '💎', color: 'text-purple-500' },
    'staff': { label: 'Staff', icon: '🛡️', color: 'text-error' },
};

// Admin email for initial setup
export const ADMIN_EMAILS = ['heidlessemail18@gmail.com', 'heidlessemail17@gmail.com'];

// ============================================
// System Configuration & Incentives
// ============================================

export interface SignupIncentives {
    welcomeCredits: {
        enabled: boolean;
        amount: number;
    };
    founderBadge: {
        enabled: boolean;
        badgeId: string;
    };
    masterPass: {
        enabled: boolean;
        durationHours: number;
    };
    communityBoost: {
        enabled: boolean;
        multiplier: number;
    };
    knowledgeBounty: {
        enabled: boolean;
        rewardAmount: number;
    };
    vanguardRole: {
        enabled: boolean;
        roleId: string;
    };
}

export interface SystemConfig {
    announcement: string;
    showBanner: boolean;
    defaultModel: 'flash' | 'pro';
    safetyThreshold: 'strict' | 'medium' | 'permissive';
    incentives: SignupIncentives;
    updatedAt: FirestoreTimestamp;
    updatedBy: string;
}

// ============================================
// Credit System Types
// ============================================

export type TransactionType = 'purchase' | 'usage' | 'daily_allowance' | 'refund' | 'subscription';

export interface CreditTransaction {
    id: string;
    type: TransactionType;
    amount: number; // positive for additions, negative for deductions
    description: string;
    metadata?: Record<string, any>;
    createdAt: FirestoreTimestamp;
}

export interface UserCredits {
    balance: number;
    dailyAllowance: number;
    dailyAllowanceUsed: number;
    lastDailyReset: FirestoreTimestamp;
    expiresAt: FirestoreTimestamp | null; // null = never expires
    totalPurchased: number;
    totalUsed: number;
}

// Credit costs by quality tier
export const CREDIT_COSTS = {
    standard: 1,  // 1024px
    high: 3,      // 2K
    ultra: 5,     // 4K (Pro only)
    video: 10,    // 5-second video (Pro only)
} as const;

export type ImageQuality = 'standard' | 'high' | 'ultra';
export type MediaModality = 'image' | 'video';

// Daily allowance by subscription
export const DAILY_ALLOWANCE = {
    free: 5,
    standard: 15,
    pro: 50,
} as const;

// ============================================
// Image Generation Types
// ============================================

export type AspectRatio = '1:1' | '4:3' | '16:9' | '9:16' | '3:4';

export interface GenerationSettings {
    modality: MediaModality;
    quality: ImageQuality | 'video';
    aspectRatio: AspectRatio;
    prompt: string;
    promptType: 'freeform' | 'madlibs' | 'customize';
    madlibsData?: MadLibsSelection;
    promptSetID?: string;
    negativePrompt?: string;
    seed?: number;
    guidanceScale?: number;
    editedFrom?: string;
}

export interface MadLibsSelection {
    subject: string;
    action: string;
    style: string;
    mood?: string;
    setting?: string;
}

export interface GeneratedImage {
    id: string;
    userId: string;
    title?: string;
    prompt: string;
    settings: GenerationSettings;
    imageUrl: string; // Used for thumbnails/images
    videoUrl?: string; // Used if modality is video
    storagePath: string;
    videoStoragePath?: string;
    creditsCost: number;
    createdAt: FirestoreTimestamp;
    updatedAt?: FirestoreTimestamp;
    downloadCount: number;
    collectionId?: string;      // @deprecated use collectionIds instead
    collectionIds?: string[];   // For multi-collection support
    sourceImageId?: string;     // For Img2Img variations - tracks parent image
    promptSetID?: string;       // Unique ID for the batch/generation set
    publishedToCommunity?: boolean;  // Whether image is published to community hub
    communityEntryId?: string;       // Reference to community hub doc when published
    publishedToLeague?: boolean;     // @deprecated Map to publishedToCommunity
    leagueEntryId?: string;          // @deprecated Map to communityEntryId
    tags?: string[];             // Per-image tagging for discovery
    duration?: number;           // Video duration in seconds
    variationCount?: number;     // Count of variations generated from this image
    isExemplar?: boolean;        // Whether this is an exemplar of high quality (admin set)
}

// ============================================
// Community Hub Types
// ============================================

export interface CommunityEntry {
    id: string;
    // Source reference
    originalImageId: string;
    originalUserId: string;
    // Denormalized image data
    imageUrl: string;
    videoUrl?: string;
    duration?: number;
    prompt: string;
    settings: GenerationSettings;
    // Author info (denormalized)
    authorName: string;
    authorPhotoURL: string | null;
    authorBadges?: string[];
    // Community metadata
    publishedAt: FirestoreTimestamp;
    // Engagement
    voteCount: number;
    commentCount: number;
    shareCount: number;
    authorFollowerCount?: number;
    reportCount?: number;
    isModerated?: boolean;
    votes: Record<string, boolean>; // userId → true
    reactions?: Record<string, string[]>; // emoji → [userIds]
    collectionIds?: string[];
    collectionNames?: string[];
    variationCount?: number;     // Count of variations generated from this entry
    tags?: string[];
    promptSetID?: string;       // Unique ID for the batch/generation set
    title?: string;
    isStack?: boolean;          // UI-only: whether this card represents a stack of variations
    stackSize?: number;         // UI-only: number of variations in the stack
    isExemplar?: boolean;        // Whether this is an exemplar of high quality (admin set)
}

export interface CommunityComment {
    id: string;
    entryId: string;
    userId: string;
    userName: string;
    userPhotoURL: string | null;
    userBadges?: string[];
    text: string;
    createdAt: FirestoreTimestamp;
    reportCount?: number;
}

// ============================================
// Collections System Types
// ============================================

export interface Collection {
    id: string;
    userId: string;
    name: string;
    description?: string;
    coverImageUrl?: string;
    imageCount: number;
    privacy: 'public' | 'private';
    tags?: string[];
    createdAt: FirestoreTimestamp;
    updatedAt: FirestoreTimestamp;
}

// ============================================
// Subscription & Stripe Types
// ============================================

export interface SubscriptionPlan {
    id: SubscriptionTier;
    name: string;
    price: number; // monthly price in cents
    features: string[];
    creditsPerMonth: number;
    dailyAllowance: number;
    allowedModes: AudienceMode[];
    allowedQualities: ImageQuality[];
    batchGeneration: boolean;
    stripePriceId?: string;
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionTier, SubscriptionPlan> = {
    free: {
        id: 'free',
        name: 'Free',
        price: 0,
        features: [
            '5 free credits daily',
            'Standard quality images',
            'Casual mode only',
        ],
        creditsPerMonth: 0,
        dailyAllowance: 5,
        allowedModes: ['casual'],
        allowedQualities: ['standard'],
        batchGeneration: false,
    },
    standard: {
        id: 'standard',
        name: 'Standard',
        price: 999, // $9.99
        features: [
            '15 credits daily',
            '100 bonus credits monthly',
            'Standard & High quality',
            'Casual mode',
        ],
        creditsPerMonth: 100,
        dailyAllowance: 15,
        allowedModes: ['casual'],
        allowedQualities: ['standard', 'high'],
        batchGeneration: false,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_STANDARD,
    },
    pro: {
        id: 'pro',
        name: 'Professional',
        price: 2999, // $29.99
        features: [
            '50 credits daily',
            '500 bonus credits monthly',
            'All quality levels incl. 4K',
            'Video generation (5-sec)',
            'Professional + Casual modes',
            'Batch generation',
            'Priority support',
        ],
        creditsPerMonth: 500,
        dailyAllowance: 50,
        allowedModes: ['casual', 'professional'],
        allowedQualities: ['standard', 'high', 'ultra'],
        batchGeneration: true,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO,
    },
};

// ============================================
// Font System Types
// ============================================

export interface FontOption {
    family: string;
    category: 'serif' | 'sans-serif' | 'display' | 'handwriting' | 'monospace';
    weights: number[];
    googleFontsUrl: string;
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

export interface GenerateImageResponse {
    imageUrl: string;
    imageId: string;
    creditsUsed: number;
    remainingBalance: number;
}
// Backward compatibility aliases
export type LeagueEntry = CommunityEntry;
export type LeagueComment = CommunityComment;
export type CommunityHubNotification = Notification;
