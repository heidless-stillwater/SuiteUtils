# VideoSystem Cross-Account Migration & Consolidation Plan

This plan details the synchronization and consolidation of all **`VideoSystem`** prompts, documents, and physical storage assets from their remote source projects into the local target Firebase project **`stillwater-sovereign-01`**, specifically mapping them to the target account **`heidlessemail21@gmail.com`** (`bc4g8h0VlgepUhg9nvjSMIsj2bx2`).

## User Review Required

Documenting key structural constraints and decisions for the migration:

> [!IMPORTANT]
> **Billing Blocks on heidless-apps-0 Firestore**: 
> The database in `heidless-apps-0` has billing disabled, meaning its Firestore API throws `PERMISSION_DENIED` billing errors. However, its GCS Storage bucket (`heidless-apps-0.firebasestorage.app`) is active, healthy, and accessible.
> **Source Mapping Matrix**:
> - **Firestore Documents (VideoSystem)**: We will read the 29 `VideoSystem` documents that are already staged under local user `AHYxlW1bIibW4LZl3LoHPbGUUaz2` (or read them directly from remote `heidless-apps-2`).
> - **GCS Project Assets**: We will pull the 639 project-level files (including the 40 files under `projects/K3dLgayM7gnTnZpDXs7A` and `Nature Wonders` assets) from `heidless-apps-0.firebasestorage.app`.
> - **GCS User Assets**: We will pull MP4 outputs and user-generated media from `heidless-apps-2.firebasestorage.app` or `heidless-apps-0.firebasestorage.app` as appropriate.

> [!WARNING]
> **Consolidation Target Paths**:
> - **Project Assets** (e.g. `projects/K3dLgayM7gnTnZpDXs7A/...`): To ensure references align correctly in the app's database, these will be copied to `projects/K3dLgayM7gnTnZpDXs7A/...` on the local bucket `stillwater-sovereign-01.firebasestorage.app` and marked public.
> - **User-Specific Assets** (e.g. `users/nNdenyyfKaN9yNB9Ly3vhhaHLXx1/images/...`): These will be copied to the local target user folder `users/bc4g8h0VlgepUhg9nvjSMIsj2bx2/images/...` and marked public.

---

## Open Questions

There are no major open questions, as we successfully audited both source projects and verified the billing state, GCS availability, and local Firestore database staging.

---

## Proposed Changes

### VideoSystem Migration Utility

We will create a specialized, self-healing migration script `scratch/migrate_videosystem.ts` to orchestrate this multi-bucket synchronization.

#### [NEW] [migrate_videosystem.ts](file:///home/heidless/projects/SuiteUtils/scratch/migrate_videosystem.ts)

A TypeScript script that:
1. **Initializes Multiple Source Connections**:
   - Source 1 (GCS Storage for Projects): `heidless-apps-0.firebasestorage.app` (using `./scratch/service-account-source.json`).
   - Source 2 (Firestore & GCS for Users): `heidless-apps-2.firebasestorage.app` (using `./secrets/heidless-apps-2-firebase-adminsdk-fbsvc-fea3de0c63.json`).
   - Target (Local GCS & Firestore): `stillwater-sovereign-01.firebasestorage.app` (using `./suite-admin-sovereign.json`).
2. **Collects VideoSystem Documents**:
   - Reads the 29 `VideoSystem` documents inside local database `users/AHYxlW1bIibW4LZl3LoHPbGUUaz2/images` in `prompttool-db-0`.
3. **Synchronizes Media Assets**:
   - For each document, extracts its media filenames (`imageUrl`, `storagePath`, `videoUrl`).
   - If it is a **Project Asset** (starts with `projects/`):
     - Checks GCS target bucket `stillwater-sovereign-01` for the file.
     - If missing, pulls it from GCS source bucket `heidless-apps-0` (or `heidless-apps-2` as fallback).
     - Saves it to the same project path in target bucket and makes it public.
   - If it is a **User Asset** (starts with `users/`):
     - Checks GCS target bucket `stillwater-sovereign-01` under path `users/bc4g8h0VlgepUhg9nvjSMIsj2bx2/images/[filename]`.
     - If missing, pulls it from remote bucket `heidless-apps-2` or `heidless-apps-0`.
     - Saves it under target user path in target bucket and makes it public.
4. **Performs String Translation**:
   - Replaces all remote UIDs and local UID18 references with target UID `bc4g8h0VlgepUhg9nvjSMIsj2bx2`.
   - Translates all remote bucket references in URLs to `stillwater-sovereign-01.firebasestorage.app`.
5. **Commits Firestore Documents**:
   - Saves the remapped records to target database `users/bc4g8h0VlgepUhg9nvjSMIsj2bx2/images` under their original document IDs.

---

## Verification Plan

### Automated Verification
* **Dry-Run Audit**:
  ```bash
  npx tsx scratch/migrate_videosystem.ts
  ```
  Verify that the script successfully identifies all 29 documents, locates the 40 files in `heidless-apps-0` GCS, and lists the remapped URLs without writing.
* **Live Migration Execute**:
  ```bash
  npx tsx scratch/migrate_videosystem.ts --commit
  ```
  Verify that all 40 files (and any user assets) are successfully replicated to GCS, marked public, and Firestore records are created.
* **Final Database Audit**:
  Run a target check to confirm that `users/bc4g8h0VlgepUhg9nvjSMIsj2bx2/images` contains the remapped VideoSystem documents and that all media links resolve successfully under `stillwater-sovereign-01`.

### Manual Verification
* Log in as `heidlessemail21@gmail.com` on the local PromptTool interface and confirm that the VideoSystem prompts (such as "Jungian Exploration") load with their respective video/audio/image thumbnails perfectly!
