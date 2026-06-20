# Manual Verification Plan: Backup Refactor v1.0

This document outlines the steps to verify the successful decoupling of backup IDs from metadata and the implementation of the hybrid registry model.

## 1. Legacy Registry Sync
- [ ] Open the **Backup & Recovery** dashboard.
- [ ] Navigate to the **Cloud Registry** tab.
- [ ] Click the **"Sync Registry"** button (Orange Zap icon) in the header.
- [ ] **Expectation**: 
    - A toast or notification should indicate migration progress.
    - Existing backups with long, overloaded names should now show "Legacy" badges.
    - The "Backup Identity" in the dropdown should match the old folder name.

## 2. Storage-Only Snapshot
- [ ] In the **Backup & Recovery** header, click **"Storage Only"** (Blue Database icon).
- [ ] **Expectation**:
    - A new background task should appear in the **Cloud Explorer**.
    - The status should transition through "Archiving Cloud Storage" and "Syncing to Cloud".
    - Once finished, a new entry with an ID like `backup_XXXX-DDMMMYYYY-HHmm` should appear.
    - It should have a blue **"Cloud Storage"** badge but *no* "Firestore DB" badge.

## 3. Full Suite Snapshot
- [ ] Click **"Run Global Snapshot"** (Green Play icon).
- [ ] **Expectation**:
    - The task should show progress for both "Backing up Firestore" and "Archiving Storage".
    - Upon completion, the record should show badges for all suite apps (e.g., PromptTool, PlanTune).
    - Expanding the details should show a valid SHA-256 checksum and a realistic total size.

## 4. Metadata Integrity (GCS)
- [ ] Use the **Storage Explorer** tab or Google Cloud Console to navigate to `AppSuite/backups/<NEW_ID>/`.
- [ ] **Expectation**:
    - The folder should contain:
        - `<NEW_ID>.zip`
        - `<NEW_ID>.zip.sha256`
        - `metadata.json`
    - Open `metadata.json` and verify the `type`, `apps`, and `timestamp` fields match the job.

## 5. UI Rich Details
- [ ] Expand a new backup record in the **Cloud Registry**.
- [ ] **Expectation**:
    - The "Included Assets" section should dynamically show badges based on the `metadata.json` (not just parsing the filename).
    - The "Source Scope" should correctly reflect if it was a manual run.

## 6. Firestore Persistence
- [ ] Open the Firebase Console for the `suiteutils-db-0` database.
- [ ] Check the `backups` collection.
- [ ] **Expectation**:
    - Each backup should have a corresponding document with the full metadata schema.
