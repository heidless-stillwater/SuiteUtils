# Migration Plan: App Suite (Source to Target GCP/Firebase)

## Goal Description
Migrate the entire Stillwater Sovereign App Suite from the source Google Cloud/Firebase account (`heidlessemail21@gmail.com` / `stillwater-sovereign-01`) to the target Google Cloud/Firebase account (`heidlessemail19@gmail.com` / `stillwater-sovereign-02`). This involves migrating 10 React/NextJS apps, completely transferring all Firebase Authentication accounts, Storage buckets, Firestore databases, and Firestore indexes. We will also introduce a placeholder architecture to cleanly toggle between the two environments in the future.

## Design Decisions (From /grill-me session)

**1. Firebase Project Initialization & Configuration**
- **Decision:** The `stillwater-sovereign-02` base project will be created manually in the Firebase Console by the user to avoid IAM/Billing API permission hurdles. The agent will script the migration of all data and indexes.

**2. Firestore Database Migration**
- **Decision:** Native GCP Firestore Export/Import will be used. This ensures a highly reliable, 1-to-1 exact copy of all 10 databases including deep subcollections.

**3. Firestore Indexes**
- **Decision:** A unified `firestore.indexes.json` will be aggregated and deployed via the Firebase CLI (`firebase deploy --only firestore:indexes`), rather than sequentially scripting via gcloud.

**4. Authentication Migration**
- **Decision:** Standard `firebase auth:export` and `auth:import` will be used for users. *However, the user noted that custom claims and Google/GitHub OAuth providers are present and will need reconfiguration in the target Firebase Console.*

**5. Environment Switching Architecture**
- **Decision:** A central CLI script (`switch-env.sh`) will be created to cleanly toggle active `.env` and `.firebaserc` files across all 10 projects.

## Proposed Changes

### SuiteUtils Tooling
We will introduce a new directory `scripts/migration/` inside `SuiteUtils` to host the suite of migration tools.

#### [NEW] `scripts/migration/01-migrate-auth.sh`
- A script wrapping `firebase auth:export` (source) and `firebase auth:import` (target) to seamlessly move all user accounts and password hashes.

#### [NEW] `scripts/migration/02-migrate-storage.sh`
- A script using `gcloud storage rsync` to mirror all assets from the source buckets to the target buckets, ensuring no files are orphaned.

#### [NEW] `scripts/migration/03-migrate-firestore.sh`
- Depending on your answer to Question 2, this will automate the Native Export/Import process or run a robust batch-copy script across all 10 named databases (e.g., `autovideo-db-0`, `prompttool-db-0`, etc.).

#### [NEW] `scripts/migration/04-deploy-monitor-indexes.sh`
- A highly robust script to batch-deploy indexes and actively monitor their creation status using `gcloud` CLI, explicitly reporting any failures or stuck states.

#### [NEW] `scripts/switch-env.sh`
- A utility to rapidly toggle the active Firebase project credentials, active `.firebaserc` alias, and `.env` files across all 10 app repositories, enabling seamless "to and fro" environment switching.

### App Suite Codebases
#### [MODIFY] `*/.firebaserc` (Across all 10 apps)
- Update to support aliases for both `sovereign-01` (source) and `sovereign-02` (target).

#### [MODIFY] `*/.env.*` (Across all 10 apps)
- Standardize environment variables to rely on the active environment profile managed by `switch-env.sh`.

## Verification Plan

### Automated Verification
- The `04-deploy-monitor-indexes.sh` script will inherently verify that all indexes reach the `READY` state.
- Existing validation scripts (e.g., `validate.sh`) will be run against the target environment.

### Manual Verification
- Run `switch-env.sh target` and launch the suite via `./scripts/ignite-hive.sh`.
- Log into the apps with existing credentials to verify Authentication migrated successfully.
- Ensure all historical data (Storage images, Firestore documents) load properly.
- Perform heavy composite queries in `PromptTool` and `PromptResources` to confirm indexes were successfully created and no "Index required" errors are thrown.
