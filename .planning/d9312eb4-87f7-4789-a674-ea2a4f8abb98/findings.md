# Findings & Decisions

## Requirements
- Move 29 VideoSystem documents from local `prompttool-db-0` collection `users/AHYxlW1bIibW4LZl3LoHPbGUUaz2/images` to `users/bc4g8h0VlgepUhg9nvjSMIsj2bx2/images`.
- Remap asset URLs and metadata (e.g. replacing remote user UIDs with `bc4g8h0VlgepUhg9nvjSMIsj2bx2`, replacing remote buckets with `stillwater-sovereign-01.firebasestorage.app`).
- Replicate all referenced media files (including project cues and user video files) into target GCS bucket.

## Research Findings
- Local source UID18 `AHYxlW1bIibW4LZl3LoHPbGUUaz2` maps to `heidlessemail18@gmail.com`.
- Target UID21 `bc4g8h0VlgepUhg9nvjSMIsj2bx2` maps to `heidlessemail21@gmail.com`.
- GCS assets are located in `heidless-apps-0.firebasestorage.app` (projects) and `heidless-apps-2.firebasestorage.app` (user assets).
- There is a syntax error (stray `z`) at line 1 of the credential file `secrets/heidless-apps-2-firebase-adminsdk-fbsvc-fea3de0c63.json`.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Write migration script `scratch/migrate_videosystem.ts` | Allows self-healing execution, batch commits, and clear console logging |
| Rewrite credentials file in-place | Restores valid JSON format to allow SDK initialization |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Credentials syntax error | Removed stray 'z' at start of file |

## Resources
- `./suite-admin-sovereign.json` (Target credentials)
- `./scratch/service-account-source.json` (Source 1 credentials)
- `./secrets/heidless-apps-2-firebase-adminsdk-fbsvc-fea3de0c63.json` (Source 2 credentials)
