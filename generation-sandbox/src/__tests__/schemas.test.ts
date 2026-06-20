/**
 * Tests for Zod schemas in src/lib/schemas.ts
 * Validates that CommunityEntrySchema correctly normalises Firestore data,
 * handles null/undefined for optional fields, and requires id + imageUrl.
 */
import { describe, it, expect } from 'vitest';
import { CommunityEntrySchema, zParseArray, zParseSingle } from '@/lib/schemas';

const validEntry = {
    id: 'entry-abc',
    imageUrl: 'https://storage.googleapis.com/bucket/test.jpg',
    originalUserId: 'user-123',
    prompt: 'A beautiful sunset over the mountains',
    authorName: 'Test User',
    voteCount: 10,
};

describe('CommunityEntrySchema', () => {
    it('accepts a minimal valid entry', () => {
        const result = CommunityEntrySchema.safeParse(validEntry);
        expect(result.success).toBe(true);
    });

    it('requires id', () => {
        const { id: _, ...noId } = validEntry;
        const result = CommunityEntrySchema.safeParse(noId);
        expect(result.success).toBe(false);
    });

    it('requires imageUrl', () => {
        const { imageUrl: _, ...noUrl } = validEntry;
        const result = CommunityEntrySchema.safeParse(noUrl);
        expect(result.success).toBe(false);
    });

    it('rejects an empty imageUrl string', () => {
        const result = CommunityEntrySchema.safeParse({ ...validEntry, imageUrl: '' });
        expect(result.success).toBe(false);
    });

    it('accepts null for videoUrl (Firestore stores null for unset optional strings)', () => {
        const result = CommunityEntrySchema.safeParse({ ...validEntry, videoUrl: null });
        expect(result.success).toBe(true);
    });

    it('accepts null for duration', () => {
        const result = CommunityEntrySchema.safeParse({ ...validEntry, duration: null });
        expect(result.success).toBe(true);
    });

    it('accepts null for isExemplar', () => {
        const result = CommunityEntrySchema.safeParse({ ...validEntry, isExemplar: null });
        expect(result.success).toBe(true);
    });

    it('accepts null for originalImageId', () => {
        const result = CommunityEntrySchema.safeParse({ ...validEntry, originalImageId: null });
        expect(result.success).toBe(true);
    });

    it('accepts null for reactions', () => {
        const result = CommunityEntrySchema.safeParse({ ...validEntry, reactions: null });
        expect(result.success).toBe(true);
    });

    it('defaults voteCount to 0 if missing', () => {
        const { voteCount: _, ...noVote } = validEntry;
        const result = CommunityEntrySchema.safeParse({ ...noVote });
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.voteCount).toBe(0);
    });

    it('defaults authorName to empty string if missing', () => {
        const { authorName: _, ...noAuthor } = validEntry;
        const result = CommunityEntrySchema.safeParse(noAuthor);
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.authorName).toBe('');
    });

    it('defaults authorBadges to empty array if missing', () => {
        const result = CommunityEntrySchema.safeParse(validEntry);
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.authorBadges).toEqual([]);
    });

    it('defaults tags to empty array if missing', () => {
        const result = CommunityEntrySchema.safeParse(validEntry);
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.tags).toEqual([]);
    });

    it('accepts a full exemplar entry', () => {
        const fullEntry = {
            ...validEntry,
            videoUrl: null,
            duration: null,
            isExemplar: true,
            isStack: false,
            stackSize: null,
            promptSetID: null,
            authorPhotoURL: null,
            reactions: null,
            votes: { 'user-abc': true },
            collectionIds: ['col-1'],
            collectionNames: ['Favorites'],
            publishedAt: { seconds: 1700000000, nanoseconds: 0 },
        };
        const result = CommunityEntrySchema.safeParse(fullEntry);
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.isExemplar).toBe(true);
    });
});

describe('zParseArray', () => {
    it('filters out invalid entries and returns valid ones', () => {
        const records = [
            validEntry,
            { id: 'bad', imageUrl: '' }, // invalid — empty imageUrl
            { id: 'ok2', imageUrl: 'https://ok.com/img.jpg', prompt: 'Another' },
        ];
        const result = zParseArray(CommunityEntrySchema, records, 'test');
        expect(result.length).toBe(2); // only the 2 valid ones
        expect(result[0].id).toBe('entry-abc');
        expect(result[1].id).toBe('ok2');
    });

    it('returns empty array for completely invalid data', () => {
        const result = zParseArray(CommunityEntrySchema, [{ nothing: true }], 'test');
        expect(result).toEqual([]);
    });
});

describe('zParseSingle', () => {
    it('returns parsed data for a valid record', () => {
        const result = zParseSingle(CommunityEntrySchema, validEntry, 'test');
        expect(result).not.toBeNull();
        expect(result!.id).toBe('entry-abc');
    });

    it('returns null for an invalid record', () => {
        const result = zParseSingle(CommunityEntrySchema, { id: 'x' }, 'test');
        expect(result).toBeNull();
    });
});
