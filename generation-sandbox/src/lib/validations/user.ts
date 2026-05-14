import { z } from 'zod';

/**
 * Zod schema for user profile updates.
 * Centralizes validation logic for display names, usernames, and bios.
 */
export const profileUpdateSchema = z.object({
    displayName: z
        .string()
        .trim()
        .min(1, "Display name is required")
        .max(50, "Display name must be less than 50 characters")
        .optional(),
    username: z
        .string()
        .trim()
        .toLowerCase()
        .min(3, "Username must be at least 3 characters")
        .max(20, "Username must be less than 20 characters")
        .regex(/^[a-z0-9_]+$/, "Username can only contain letters, numbers, and underscores")
        .optional(),
    bio: z
        .string()
        .max(500, "Bio must be less than 500 characters")
        .optional(),
    socialLinks: z.object({
        twitter: z.string().optional(),
        instagram: z.string().optional(),
        website: z.string().url("Please enter a valid URL").or(z.literal("")).optional(),
    }).optional(),
    bannerUrl: z.string().url("Invalid banner URL").optional(),
    photoURL: z.string().url("Invalid photo URL").optional(),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
