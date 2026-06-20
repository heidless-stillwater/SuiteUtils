/**
 * Tests for src/lib/validations/generation.ts
 * Validates that the generation and enhance schemas correctly handle
 * null seed/guidanceScale values (Firestore null coercion bug we fixed).
 */
import { describe, it, expect } from 'vitest';
import { generationSchema, enhancePromptSchema } from '@/lib/validations/generation';

const baseGeneration = {
    prompt: 'A sunset over the mountains',
    quality: 'standard' as const,
    aspectRatio: '4:3' as const,
    promptType: 'freeform' as const,
    modality: 'image' as const,
};

describe('generationSchema', () => {
    it('accepts a minimal valid generation request', () => {
        const result = generationSchema.safeParse(baseGeneration);
        expect(result.success).toBe(true);
    });

    it('requires a non-empty prompt', () => {
        const result = generationSchema.safeParse({ ...baseGeneration, prompt: '' });
        expect(result.success).toBe(false);
    });

    it('rejects an invalid quality value', () => {
        const result = generationSchema.safeParse({ ...baseGeneration, quality: 'potato' });
        expect(result.success).toBe(false);
    });

    it('rejects an invalid aspect ratio', () => {
        const result = generationSchema.safeParse({ ...baseGeneration, aspectRatio: '2:3' });
        expect(result.success).toBe(false);
    });

    it('accepts null seed (Firestore null → undefined coercion)', () => {
        const result = generationSchema.safeParse({ ...baseGeneration, seed: null });
        expect(result.success).toBe(true);
    });

    it('accepts null guidanceScale and defaults it to 7', () => {
        const result = generationSchema.safeParse({ ...baseGeneration, guidanceScale: null });
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.guidanceScale).toBe(7);
    });

    it('accepts a valid guidanceScale in range', () => {
        const result = generationSchema.safeParse({ ...baseGeneration, guidanceScale: 12 });
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.guidanceScale).toBe(12);
    });

    it('rejects count > 4', () => {
        const result = generationSchema.safeParse({ ...baseGeneration, count: 5 });
        expect(result.success).toBe(false);
    });

    it('rejects count < 1', () => {
        const result = generationSchema.safeParse({ ...baseGeneration, count: 0 });
        expect(result.success).toBe(false);
    });

    it('defaults count to 1 if not provided', () => {
        const result = generationSchema.safeParse(baseGeneration);
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.count).toBe(1);
    });

    it('accepts a video modality', () => {
        const result = generationSchema.safeParse({ ...baseGeneration, modality: 'video' });
        expect(result.success).toBe(true);
    });
});

describe('enhancePromptSchema', () => {
    it('accepts a valid prompt', () => {
        const result = enhancePromptSchema.safeParse({ prompt: 'A cat' });
        expect(result.success).toBe(true);
    });

    it('rejects an empty prompt', () => {
        const result = enhancePromptSchema.safeParse({ prompt: '' });
        expect(result.success).toBe(false);
    });

    it('accepts optional style and mood', () => {
        const result = enhancePromptSchema.safeParse({
            prompt: 'A cat',
            style: 'photorealistic',
            mood: 'dramatic',
        });
        expect(result.success).toBe(true);
    });

    it('style and mood are optional (can be omitted)', () => {
        const result = enhancePromptSchema.safeParse({ prompt: 'A cat' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.style).toBeUndefined();
            expect(result.data.mood).toBeUndefined();
        }
    });
});
