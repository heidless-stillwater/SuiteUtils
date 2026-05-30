# Task Plan: URLShortener Cross-Account Migration & Consolidation

## Goal
Successfully migrate and consolidate all 15 Firestore link documents and user profiles from the source user (heidlessemail18@gmail.com / AHYxlW1bIibW4LZl3LoHPbGUUaz2) to the target user (heidlessemail21@gmail.com / bc4g8h0VlgepUhg9nvjSMIsj2bx2) in local database urlshortener-db-0.

## Current Phase
Phase 5: Delivery

## Phases

### Phase 1: Requirements & Discovery
- [x] Understand user intent (focus on URL Shortener, revert VideoSystem)
- [x] Identify constraints (links schema, collection name links)
- [x] Document in findings.md
- **Status:** completed

### Phase 2: Planning & Structure
- [x] Define migration approach (in-place link document updates, target user profile seeding)
- [x] Create project structure
- **Status:** completed

### Phase 3: Implementation
- [x] Revert VideoSystem migration (delete enqueued Firestore documents)
- [x] Create scratch/migrate_urlshortener.ts
- [x] Run dry-run migration
- [x] Run commit migration
- **Status:** completed

### Phase 4: Testing & Verification
- [x] Verify link document updates in urlshortener-db-0
- [x] Verify user profile creation for bc4g8h0VlgepUhg9nvjSMIsj2bx2
- **Status:** completed

### Phase 5: Delivery
- [ ] Review outputs
- [ ] Deliver to user
- **Status:** in_progress

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| In-place Updates | Remapping creator field in-place keeps short link codes functional without breaking redirects |
