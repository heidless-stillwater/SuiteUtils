import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Firebase modules so tests don't hit real Firestore
vi.mock('@/lib/firebase', () => ({
    db: {},
    auth: {},
    storage: {},
}));

vi.mock('@/lib/firebase-admin', () => ({
    adminDb: {},
    adminAuth: {},
}));

// Suppress console.warn/error in tests unless explicitly needed
global.console.warn = vi.fn();
