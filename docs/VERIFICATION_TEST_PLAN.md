# Verification Test Plan: SuiteUtils Operations Hub (Phase 2)

This plan outlines the verification steps for the architectural extensions implemented in Phase 2, including the SaaS foundation, naming conventions, and enhanced migration orchestration.

## 1. Storage & Quota Verification

### 1.1 Multi-Provider Reliability
- [ ] **Automated**: Run `npx tsx server/verify-all-providers.ts` and ensure both GCS and Google Drive backends pass.
- [ ] **Quota Display**: Navigate to the Storage Explorer and verify the percentage bar accurately reflects the data returned by the `getQuota()` API.
- [ ] **Backend Toggle**: Change the storage backend in Settings, then verify that newly created backups are stored in the selected provider.

## 2. SaaS & Governance Verification

### 2.1 Invitation Workflow
- [ ] **Revocation**: Invite a test email, then click "Revoke" and verify it is removed from the pending list.
- [ ] **Role Assignment**: Invite a user as `operator` and verify the role is correctly persisted in `invitations.json`.

### 2.2 Role-Based Access Control (RBAC)
- [ ] **Viewer Restrictions**: Log in as a `viewer`.
    - [ ] Ensure "Run Global Snapshot" is disabled in Backup Admin.
    - [ ] Ensure "Add App" is hidden in Workspace config.
    - [ ] Ensure delete/upload buttons are disabled in the Storage Explorer.
- [ ] **Operator Access**: Log in as an `operator`.
    - [ ] Verify that backup/deploy triggers are enabled, but "Invite User" or "Delete Workspace" are restricted.

## 3. Orchestration & Migration Verification

### 3.1 Strict Naming Taxonomy
- [ ] **Taxonomy Validation**: Trigger a release with a non-compliant ref (e.g., `test-branch`).
    - [ ] Verify a warning is logged in the console: `Ref does not follow strict taxonomy`.
- [ ] **Isolated Worktrees**: During a build, verify that the directory `~/.suiteutils_workspaces/<appId>_<env>_<timestamp>` is created and populated.

### 3.2 Migration State Machine
- [ ] **Step Execution**: Run a migration and verify the sequence:
    1. 📦 Restore Data
    2. 🔑 Migrate Auth
    3. 🔒 Deploy Security Rules
- [ ] **Audit Logging**: Check the Activity Log and verify a "system" level entry exists for the Security Rules deployment.

## 4. Maintenance & Cleanup

### 4.1 Worktree Cleanup
- [ ] Verify that even after a failed build, the `~/.suiteutils_workspaces/` directory for that build is removed.
- [ ] Verify that `git worktree remove` is executed successfully.
