# DB_PLAN_0: SuiteUtils Architecture Extension for DB Admin, Release Management, and Migration

> [!NOTE]
> This document outlines the architectural strategy and technical implementation plan for extending SuiteUtils to serve as the central operations hub for the Stillwater App Suite.

## 1. Executive Summary
SuiteUtils will be upgraded to handle complete lifecycle management for the Stillwater App Suite. This includes automated database and storage archiving (DB Admin), coordinated code and data snapshots (Release Management), and full-scale deployments to new GCP environments (Migration Orchestration). 

## 2. DB Admin (Database & Storage Management)

### 2.1 Backup & Archiving Strategy
- **Mechanism:** SuiteUtils will orchestrate Node.js child processes or direct Firebase Admin SDK calls to iterate through target databases and storage buckets.
- **Filesystem Output:** Built upon the foundation of `scripts/backup-db.ts`, outputs will be structured precisely to align with release versions (e.g., `backups/<app-name>/releases/<version>/<release_id>/db.json`).
- **Release Integration:** The UI will present an option to "Snapshot & Attach to Current Release" or "Queue for Next Release."

### 2.2 Cloud Storage Architecture
- **Primary Provider:** Google Drive (Account: `heidlessemail19@gmail.com`). 
- **Abstraction Layer:** We will implement an `IStorageProvider` interface to guarantee future-proofing. 
  ```typescript
  interface IStorageProvider {
    upload(file: Buffer, destination: string): Promise<string>;
    download(path: string): Promise<Buffer>;
    list(directory: string): Promise<StorageMetadata[]>;
    getQuota(): Promise<{used: number, total: number}>;
  }
  ```
- **Provider Implementations:** `GoogleDriveStorageProvider` will be the initial implementation, utilizing the Google APIs SDK.

### 2.3 Storage Management UI
- **File Explorer:** A React-based component presenting a familiar tree-view of the Cloud Storage. It will support CRUD operations (Create folders, Read/Download files, Update/Move, Delete) directly mutating the Google Drive backend.
- **Insights Dashboard:** Utilizing a charting library (like Recharts or D3), the dashboard will visually represent quota usage, backup size trends over time, and a breakdown of storage consumption per app.

### 2.4 User Feedback & Real-Time Telemetry
- **Protocol:** Server-Sent Events (SSE) will stream logs and progress events from the SuiteUtils backend to the frontend.
- **Metrics:** Progress bars, step-by-step logs, and ETA calculations will keep the Admin informed during lengthy backup operations.

## 3. Release Management

### 3.1 Naming Conventions
A strict taxonomy will be enforced across Git and Cloud Storage to decouple code iterations from data snapshots.

- **Release Identifier:** `{Scope}_v{SemVer}_{YYYYMMDD}[-{Modifier}]`
  - *Example:* `PromptTool_v1.2.0_20260429-prod`
- **Git Branch:** `release/{Scope}/v{SemVer}`
  - *Example:* `release/PromptTool/v1.2.0`
- **Cloud Storage Path:** `backups/{Scope}/releases/v{SemVer}/{Release_Identifier}/`

### 3.2 Workspace Isolation (Git Worktrees)
To guarantee the core Git repositories remain the "untouched source of truth," SuiteUtils will utilize Git Worktrees for all release and migration builds.

1. **Initialization:** `git worktree add ~/.suiteutils_workspaces/PromptTool_v1.2.0 release/PromptTool/v1.2.0`
2. **Execution:** SuiteUtils injects migration-specific `.env` files and `firebase.json` target modifications into the isolated `~/.suiteutils_workspaces/` directory. All `npm run build` and deployment commands happen here.
3. **Cleanup:** `git worktree remove ~/.suiteutils_workspaces/PromptTool_v1.2.0` ensuring the primary workspace (`~/projects/PromptTool`) is never dirtied.

## 4. Migration Orchestration

### 4.1 Migration Scope & Execution Strategy
SuiteUtils will act as an interactive wizard, prompting for the target GCP Project ID and Account, then executing a robust state machine to migrate the following:

1. **Git Code:** Validates clean working trees, checks out the release worktree, and prepares for deployment.
2. **Auth (Firebase):** Wraps `firebase auth:export` (source) and `firebase auth:import` (target) via child processes.
3. **Database & Storage:** Streams data from the Cloud Storage backup archive directly into the new Firestore/Realtime DB and Storage buckets using the Firebase Admin SDK.
4. **Security & Indexes:** Copies `firestore.rules`, `storage.rules`, and `firestore.indexes.json` to the worktree and executes `firebase deploy --only firestore,storage`.
5. **Environment Secrets:** Reads source `.env` files, prompts the user for necessary updates (e.g., new API keys), and writes to the new target workspace/Secret Manager.
6. **IAM & Service Accounts:** Uses the Google Cloud Resource Manager API to provision required Service Accounts.
7. **Hosting:** Executes the final `firebase deploy --only hosting` within the isolated worktree.

### 4.2 State Recovery & Developer Experience
Because migrations are complex and prone to API rate limits or config errors, the orchestrator will be stateful.
- **State Machine:** A local `.migration_state.json` file will track the success/failure of each step.
- **Resumption:** If Step 4 (Security & Indexes) fails, the user can fix the config and click "Resume." The system will skip Steps 1-3 and immediately retry Step 4.

### 4.3 Automated Validation Suite
Upon completion of the migration steps, SuiteUtils will run an automated integration test suite against the target environment:

1. **Authentication Handshake:** Authenticates a test user against the new Firebase Auth endpoint.
2. **Database R/W/D:** Writes to `_migration_tests` in Firestore, reads the payload, and deletes it.
3. **Storage I/O:** Uploads a 1KB string to Cloud Storage, generates a signed URL, downloads it, and deletes the object.
4. **Backend Health Check:** Issues an HTTP GET to the `/health` or `/api/status` endpoint of the deployed Cloud Functions/Cloud Run services.
5. **Cross-App Communication:** Validates Service Account permissions by executing an authorized fetch between SuiteUtils and the target app.

## 5. Finalized Architectural Decisions

Based on the initial design review, the following core architectural decisions have been locked in:

- **Google Drive Authentication (Headless/Service Account):** SuiteUtils will use a pre-configured Google Service Account key to authenticate with Google Drive. This enables automated, background backups without requiring Admin OAuth logins for every session.
- **Drive API Scope (Full Access):** The Service Account will be granted Full Drive Access. This is necessary to easily traverse, manage, and edit the pre-existing `My Drive/AppSuite/backups` directory structure without scope limitations.
- **Validation Testing (Persistent Configurable Account):** The migration validation suite will rely on a persistent test account rather than dynamic injection. The specific test credentials will be configurable by the Admin within the SuiteUtils UI, defaulting to `heidlessemail19@gmail.com` to ensure out-of-the-box readiness.
