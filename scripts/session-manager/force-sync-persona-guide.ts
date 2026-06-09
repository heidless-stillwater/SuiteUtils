#!/usr/bin/env tsx
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as path from 'path';
import * as fs from 'fs';

/**
 * scripts/session-manager/force-sync-persona-guide.ts
 *
 * Surgical script to inject the Session Manager documentation into
 * the Persona App's live Firestore database.
 */

// Use the established Sovereign Admin credentials
const serviceAccountPath = path.join(process.cwd(), 'suite-admin-sovereign.json');
if (!fs.existsSync(serviceAccountPath)) {
  console.error(`❌ Error: Service account key not found at ${serviceAccountPath}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount),
  projectId: 'stillwater-sovereign-01'
});

const db = getFirestore('persona-db-0');

const GUIDE_CONTENT = `## 🛰️ Session Manager

The Stillwater Session Manager synchronizes AI agent context (planning, progress, and findings) with the cloud while managing local VS Code chat histories across different Google profiles.

### 1. Cloud Orchestrator (manage.ts)
This utility manages the high-level "consciousness" of the agent, ensuring that tasks started on one Google account can be resumed on another with full planning state.

**Path:** \`npx tsx scripts/session-manager/manage.ts <command> [options]\`

| Command | Parameter(s) | Description |
| :--- | :--- | :--- |
| **\`init\`** | \`[session_id]\` | **Bootstrap a new session.** Generates a UUID, creates skeleton planning files (\`task_plan.md\`, \`findings.md\`), and updates the local \`.active_plan\` pointer. |
| **\`status\`** | N/A | **Audit current state.** Displays detected VS Code Conversation ID, Active Plan ID, and verifies if the mapping is correctly linked to the cloud. |
| **\`activate\`** | \`--session <id>\` | **Rebind Identity.** Links the current local IDE chat ID to a specific persistent Session ID. |
| **\`push\`** | N/A | **Snapshot to Cloud.** Reads local \`.planning/\` files and pushes them as a new version to Firestore. |
| **\`pull\`** | \`[--version n]\` | **Retrieve from Cloud.** Fetches state from Firestore and automatically runs \`activate\`. |
| **\`history\`** | N/A | **View Timeline.** Lists all available versions stored in Firestore for the active session. |
| **\`rollback\`** | \`--version n\` | **Revert State.** Sets the session state to a previous version number in the cloud. |
| **\`sync-guide\`** | N/A | **Force-push documentation.** Injects this grouped reference into the Persona App's internal guide. |

**Key Options:**
*   **\`--session <uuid>\`**: Overrides the automatically detected Session ID.
*   **\`--user <uid>\`**: Overrides the Firebase User UID (defaults to profile.json).
*   **\`--project <slug>\`**: Overrides the project identifier (defaults to current folder).
*   **\`--version <n>\`**: Specifies target version for pull, rollback, or management.

---

### 2. Local Chat Manager (share-chat)
This utility interacts directly with the IDE's internal SQLite databases to manage history, export transcripts, and enable cross-account conversation sharing.

**Path:** \`./share-chat <command> [arguments]\`

| Command | Parameter(s) | Description |
| :--- | :--- | :--- |
| **\`status\`** | N/A | **Session Preview.** Displays current conversation metadata and a preview of the last 3 turns of the chat. |
| **\`list\`** | N/A | **Inventory.** Lists all VS Code chat databases found on disk associated with the current workspace. |
| **\`activate\`** | \`<id-prefix>\` | **Hot-Swap History.** Updates filesystem timestamps. *Requires VS Code window reload.* |
| **\`share\`** | \`[email] [prefix]\` | **Cross-Account Bind.** Modifies the SQLite database in-place to grant access to other profiles without duplicating files. |
| **\`export\`** | \`[id-prefix]\` | **Markdown Generator.** Converts binary SQLite history into high-fidelity Markdown in \`docs/shared-chats/\`. |
| **\`inspect\`** | \`<id-prefix>\` | **Internal Audit.** Dumps SQLite tables and scans metadata for identity markers (Emails/UIDs). |
`;

async function sync() {
  // Pulse to all potential targets to ensure the UI catches the update
  const targets = ['neural_manifest', 'manual', 'guide', 'system_guide'];
  console.log(`🛰️  Pulsing documentation to config collection targets: ${targets.join(', ')}...`);
  
  for (const targetId of targets) {
    const docRef = db.collection('config').doc(targetId);
    const doc = await docRef.get();
    let data = doc.data() || {};
    
    const targetTitle = 'Sovereign Control Guide';
    const legacyTitle = 'Persona Stack Control';
    const redundantTitle = 'Sovereign Session Manager';

    if (Array.isArray(data.sections)) {
      // Clean up previous attempts and target the correct guide incrementally
      data.sections = data.sections.filter((s: any) => s.title !== redundantTitle);
      let section = data.sections.find((s: any) => s.title === targetTitle);
      if (!section) {
        section = data.sections.find((s: any) => s.title === legacyTitle);
        if (section) section.title = targetTitle;
      }

      if (section) {
        if (section.content.includes('## 🛰️ Session Manager')) {
          const parts = section.content.split('## 🛰️ Session Manager');
          section.content = parts[0].trim() + '\n\n' + GUIDE_CONTENT;
        } else {
          section.content = section.content.trim() + '\n\n' + GUIDE_CONTENT;
        }
      } else {
        data.sections.push({ title: targetTitle, content: GUIDE_CONTENT });
      }
    } else {
      data.title = targetTitle;
      data.content = GUIDE_CONTENT;
    }
    
    data.updatedAt = new Date().toISOString();
    await docRef.set(data);
    console.log(`   ✅ Target synchronized: ${targetId}`);
  }

  console.log('✅ Success: Neural Manifest synchronized to stillwater-sovereign-01/persona-db-0');
  process.exit(0);
}

sync().catch(err => {
  console.error('❌ Sync failed:', err);
  process.exit(1);
});
