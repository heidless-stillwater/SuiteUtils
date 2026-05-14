/**
 * Tests for src/lib/date-utils.ts (pure utility functions, no mocks needed)
 */
import { describe, it, expect } from 'vitest';
import { formatDate } from '@/lib/date-utils';

describe('formatDate', () => {
    it('formats a JS Date object', () => {
        const d = new Date('2024-06-15T12:00:00Z');
        const result = formatDate(d);
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
    });

    it('formats a Firestore-like timestamp object with toDate()', () => {
        const firestoreTimestamp = {
            toDate: () => new Date('2024-01-01T00:00:00Z'),
        };
        const result = formatDate(firestoreTimestamp);
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
    });

    it('handles null gracefully', () => {
        const result = formatDate(null);
        expect(result).toBe('');
    });

    it('handles undefined gracefully', () => {
        const result = formatDate(undefined);
        expect(result).toBe('');
    });
});
