# Task Plan: VideoSystem Cross-Account Migration & Consolidation

## Goal
Successfully migrate all 29 VideoSystem prompts/documents and GCS storage assets from remote projects into stillwater-sovereign-01, remapped to target account heidlessemail21@gmail.com.

## Current Phase
Phase 1: Requirements & Discovery

## Phases

### Phase 1: Requirements & Discovery
- [x] Understand user intent
- [x] Identify constraints (billing block on apps-0, stray 'z' in credentials)
- [x] Document in findings.md
- **Status:** completed

### Phase 2: Planning & Structure
- [x] Define migration approach and target paths
- [x] Create project structure (identify secrets/configs and target script paths)
- **Status:** completed

### Phase 3: Implementation
- [ ] Fix credentials typo
- [ ] Create scratch/migrate_videosystem.ts
- [ ] Run dry-run migration
- [ ] Run commit migration
- **Status:** pending

### Phase 4: Testing & Verification
- [ ] Verify documents saved to target user's collection
- [ ] Verify GCS assets downloaded, re-uploaded, and marked public
- [ ] Perform manual verification in the UI
- **Status:** pending

### Phase 5: Delivery
- [ ] Review outputs
- [ ] Deliver to user
- **Status:** pending

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| GCS Direct Read | Pulling directly from source storage buckets bypasses Firestore billing blocks |
| Path Translation | Mapping user paths to the new UID ensuring prompt references remain fully resolved |

## Errors Encountered
| Error | Resolution |
|-------|------------|
| Credentials syntax error | We will fix the stray 'z' on line 1 of the heidless-apps-2 JSON file |
