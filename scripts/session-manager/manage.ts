#!/usr/bin/env tsx
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';
import { spawn } from 'child_process';

/**
 * scripts/session-manager/manage.ts
 *
 * Unified CLI utility to ease pushing and pulling shared agent sessions
 * to and from the Persona Session Manager.
 */

const DEFAULT_SUPERUSER_UID = 'stqIDYHVcLRxjclsqaksiKMvSXz2';
const DEFAULT_DISPLAY_NAME = 'Lead Director';
const CORE_SYNC_SCRIPT = '/home/heidless/projects/Persona/scripts/session-sync.ts';

const GUIDE_CONTENT = `## 🛰️ Session Manager

The Stillwater Session Manager synchronizes AI agent context (planning, progress, and findings) with the cloud while managing local VS Code chat histories across different Google profiles.

### 1. Cloud Orchestrator (manage.ts)
This utility manages the high-level "consciousness" of the agent, ensuring that tasks started on one Google account can be resumed on another with full planning state.

**Path:** \`npx tsx scripts/session-manager/manage.ts <command> [options]\`

| Command | Execution Syntax | Description |
| :--- | :--- | :--- |
| **\`init\`** | \`npx tsx scripts/session-manager/manage.ts init [session_id]\` | **Bootstrap a new session.** Generates a UUID, creates skeleton planning files (\`task_plan.md\`, \`findings.md\`), and updates the local \`.active_plan\` pointer. |
| **\`status\`** | \`npx tsx scripts/session-manager/manage.ts status\` | **Audit current state.** Displays detected VS Code Conversation ID, Active Plan ID, and verifies if the mapping is correctly linked to the cloud. |
| **\`activate\`** | \`npx tsx scripts/session-manager/manage.ts activate --session <id>\` | **Rebind Identity.** Links the current local IDE chat ID to a specific persistent Session ID. |
| **\`push\`** | \`echo "y" \\| npx tsx scripts/session-manager/manage.ts push\` | **Snapshot to Cloud.** Reads local \`.planning/\` files and pushes them as a new version to Firestore. |
| **\`pull\`** | \`npx tsx scripts/session-manager/manage.ts pull [--version n]\` | **Retrieve from Cloud.** Fetches state from Firestore and automatically runs \`activate\`. |
| **\`history\`** | \`npx tsx scripts/session-manager/manage.ts history\` | **View Timeline.** Lists all available versions stored in Firestore for the active session. |
| **\`rollback\`** | \`npx tsx scripts/session-manager/manage.ts rollback --version n\` | **Revert State.** Sets the session state to a previous version number in the cloud. |
| **\`sync-guide\`** | \`npx tsx scripts/session-manager/manage.ts sync-guide\` | **Force-push documentation.** Injects this grouped reference into the Persona App's internal guide. |

**Key Options:**
*   **\`--session <uuid>\`**: Overrides the automatically detected Session ID.
*   **\`--user <uid>\`**: Overrides the Firebase User UID (defaults to profile.json).
*   **\`--project <slug>\`**: Overrides the project identifier (defaults to current folder).
*   **\`--version <n>\`**: Specifies target version for pull, rollback, or management.

---

### 2. Local Chat Manager (share-chat)
This utility interacts directly with the IDE's internal SQLite databases to manage history, export transcripts, and enable cross-account conversation sharing.

**Path:** \`./share-chat <command> [arguments]\`

| Command | Execution Syntax | Description |
| :--- | :--- | :--- |
| **\`status\`** | \`./share-chat status\` | **Session Preview.** Displays current conversation metadata and a preview of the last 3 turns of the chat. |
| **\`list\`** | \`./share-chat list\` | **Inventory.** Lists all VS Code chat databases found on disk associated with the current workspace. |
| **\`activate\`** | \`./share-chat activate <id-prefix>\` | **Hot-Swap History.** Updates filesystem timestamps. *Requires VS Code window reload.* |
| **\`share\`** | \`./share-chat share [email] [prefix]\` | **Cross-Account Bind.** Modifies the SQLite database in-place to grant access to other profiles without duplicating files. |
| **\`export\`** | \`./share-chat export [id-prefix]\` | **Markdown Generator.** Converts binary SQLite history into a high-fidelity Markdown in \`docs/shared-chats/\`. |
| **\`inspect\`** | \`./share-chat inspect <id-prefix>\` | **Internal Audit.** Dumps SQLite tables and scans metadata for identity markers (Emails/UIDs). |
`;

/**
 * 🏰 Stillwater Ecosystem Registry
 */
const STILLWATER_SUITE = [
  'ag-video-system',
  'PromptTool',
  'PromptResources',
  'PromptMasterSPA',
  'PromptAccreditation',
  'PlanTune',
  'SuiteUtils',
  'URLShorteners',
  'TokenMarket',
  'Persona'
];

// ── 1. Arg Parsing (Hybrid: Positional + Named Flags) ────────────────────────

interface CLIArgs {
  command: 'push' | 'pull' | 'init' | 'list' | 'history' | 'rollback' | 'view-version' | 'update-version' | 'delete-version' | 'activate' | 'status' | 'sync-guide';
  session?: string;
  user?: string;
  project?: string;
  name?: string;
  version?: string;
  conversation?: string;
}

function parseCommandLine(): CLIArgs {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    printUsageAndExit();
  }

  const cmd = argv[0].toLowerCase();
  const validCommands = ['push', 'pull', 'init', 'list', 'history', 'rollback', 'view-version', 'update-version', 'delete-version', 'activate', 'status', 'sync-guide'];
  if (!validCommands.includes(cmd)) {
    console.error(`❌ Unknown command: "${argv[0]}"`);
    printUsageAndExit();
  }

  const flags: Record<string, string> = {};
  const positionals: string[] = [];

  for (let i = 1; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const flagName = argv[i].slice(2);
      flags[flagName] = argv[i + 1] ?? 'true';
      i++;
    } else {
      positionals.push(argv[i]);
    }
  }

  return {
    command: cmd as any,
    session: flags['session'] || positionals[0],
    user: flags['user'] || positionals[1],
    project: flags['project'] || positionals[2],
    name: flags['name'],
    version: flags['version'],
    conversation: flags['conversation'],
  };
}

function printUsageAndExit(): never {
  console.log(`
🏰 Stillwater Session Manager CLI Suite
────────────────────────────────────────────────────────

Usage:
  npx tsx scripts/session-manager/manage.ts <command> [session_id] [owner_uid] [project_slug] [options]

🛰️  Stillwater Session Manager — Grouped Commands
────────────────────────────────────────────────────────

1. Cloud Orchestrator (manage.ts)
   init [session_id]    Bootstrap new session with skeleton plans.
   status               Audit detected IDE Conv ID vs Active Plan ID.
   push                 Snapshot local .planning/ files to Cloud.
   pull [--version n]   Retrieve cloud state & auto-activate locally.
   activate --session   Link current IDE chat to a specific Session UUID.
   history              View timeline of available cloud versions.
   rollback --version   Revert cloud state to a previous snapshot.
   sync-guide           Push this documentation to the Persona App DB.

2. Local Chat Manager (share-chat)
   status               Preview last 3 turns of active chat.
   list                 Inventory all local workspace databases.
   activate <prefix>    Hot-swap history (Requires IDE Window Reload).
   share [email]        Grant cross-account access to current DB.
   export [prefix]      Generate Markdown transcript in docs/shared-chats/.
   inspect <prefix>     Audit DB identity markers (Emails/UIDs).

Options:
  --session <id>     UUID/Session ID override (for init/activate/push/pull)
  --user    <uid>    Firebase owner user UID override (defaults to profile.json)
  --project <slug>   Project slug override (defaults to current folder name)
  --name    <name>   Display name override (for push/rollback/update-version)
  --version <n>      Version number (optional for pull, required for rollback/view-version/update-version/delete-version)
  --conversation <id> Current conversation/chat ID override (for activate command)

IDE Conversation ↔ Session Bridging:
  Each new VS Code conversation should map to its own session.
  Running 'init' creates a fresh session ID and updates .active_plan so that
  all subsequent push/pull commands in the conversation use the new session.
`);
  process.exit(1);
}

const SKELETON_TASK_PLAN = `# Task Plan: [Brief Description]\n\n## Goal\n[One sentence describing the end state]\n\n## Current Phase\nPhase 1\n\n## Phases\n\n### Phase 1: Requirements & Discovery\n- [ ] Understand user intent\n- [ ] Identify constraints\n- [ ] Document in findings.md\n- **Status:** in_progress\n\n### Phase 2: Planning & Structure\n- [ ] Define approach\n- [ ] Create project structure\n- **Status:** pending\n\n### Phase 3: Implementation\n- [ ] Execute the plan\n- [ ] Write to files before executing\n- **Status:** pending\n\n### Phase 4: Testing & Verification\n- [ ] Verify requirements met\n- [ ] Document test results\n- **Status:** pending\n\n### Phase 5: Delivery\n- [ ] Review outputs\n- [ ] Deliver to user\n- **Status:** pending\n\n## Decisions Made\n| Decision | Rationale |\n|----------|-----------|\n\n## Errors Encountered\n| Error | Resolution |\n|-------|------------|\n`;
const SKELETON_PROGRESS = `# Session Progress Log\n\n## Session: ${new Date().toISOString().split('T')[0]} | ${path.basename(process.cwd())}\n\n---\n\n### Session Summary\n\n**Date:** ${new Date().toISOString().split('T')[0]}  \n**Workspace:** \`${process.cwd()}\`\n\n---\n\n### What Was Done This Session\n\n- [ ] (session just initialized)\n\n---\n\n### Open Questions / Next Steps\n\n- [ ] (none yet)\n`;
const SKELETON_FINDINGS = `# Findings & Decisions\n\n## Requirements\n-\n\n## Research Findings\n-\n\n## Technical Decisions\n| Decision | Rationale |\n|----------|-----------|\n\n## Issues Encountered\n| Issue | Resolution |\n|-------|------------|\n\n## Resources\n-\n`;

function cmdInit(sessionIdOverride?: string): string {
  const cwd = process.cwd();
  const planningRoot = path.join(cwd, '.planning');
  const sessionId = sessionIdOverride || randomUUID();
  const sessionDir = path.join(planningRoot, sessionId);

  fs.mkdirSync(sessionDir, { recursive: true });
  fs.writeFileSync(path.join(sessionDir, 'task_plan.md'), SKELETON_TASK_PLAN, 'utf8');
  fs.writeFileSync(path.join(sessionDir, 'progress.md'), SKELETON_PROGRESS, 'utf8');
  fs.writeFileSync(path.join(sessionDir, 'findings.md'), SKELETON_FINDINGS, 'utf8');
  fs.writeFileSync(path.join(planningRoot, '.active_plan'), sessionId, 'utf8');

  console.log(`\n🆕  New session initialized\n    🆔  Session ID  :  ${sessionId}\n    📌  .active_plan updated → ${sessionId}`);

  try {
    const parentDir = path.dirname(cwd);
    for (const app of STILLWATER_SUITE) {
      if (app === path.basename(cwd)) continue;
      const appRoot = path.join(parentDir, app);
      const planningDir = path.join(appRoot, '.planning');
      if (fs.existsSync(appRoot)) {
        const siblingSessionDir = path.join(planningDir, sessionId);
        fs.mkdirSync(siblingSessionDir, { recursive: true });
        fs.writeFileSync(path.join(siblingSessionDir, 'task_plan.md'), SKELETON_TASK_PLAN, 'utf8');
        fs.writeFileSync(path.join(siblingSessionDir, 'progress.md'), SKELETON_PROGRESS, 'utf8');
        fs.writeFileSync(path.join(siblingSessionDir, 'findings.md'), SKELETON_FINDINGS, 'utf8');
        fs.writeFileSync(path.join(planningDir, '.active_plan'), sessionId, 'utf8');
      }
    }
    console.log(`    🔄  Cross-synced session to all active suite apps.`);
  } catch (err) {}

  return sessionId;
}

async function askConfirmation(query: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(query, (ans) => { rl.close(); resolve(ans.toLowerCase() === 'y' || ans.toLowerCase() === 'yes'); });
  });
}

function cmdActivate(sessionId: string, conversationIdOverride?: string) {
  const cwd = process.cwd();
  const planningRoot = path.join(cwd, '.planning');
  const conversationId = conversationIdOverride || resolveActiveConversationId();
  if (!conversationId) {
    console.error('❌ Error: Could not resolve Conversation ID. Use --conversation <id>');
    process.exit(1);
  }

  const mappingsPath = path.join(planningRoot, 'session_mappings.json');
  let mappings: Record<string, string> = {};
  if (fs.existsSync(mappingsPath)) {
    try { mappings = JSON.parse(fs.readFileSync(mappingsPath, 'utf8')); } catch {}
  }
  mappings[conversationId] = sessionId;
  fs.writeFileSync(mappingsPath, JSON.stringify(mappings, null, 2), 'utf8');
  fs.writeFileSync(path.join(planningRoot, '.active_plan'), sessionId, 'utf8');

  console.log(`\n🔗  Session activated\n    🆔  Session ID      :  ${sessionId}\n    💬  Conversation ID :  ${conversationId}`);

  try {
    const parentDir = path.dirname(cwd);
    for (const app of STILLWATER_SUITE) {
      if (app === path.basename(cwd)) continue;
      const appRoot = path.join(parentDir, app);
      const planningDir = path.join(appRoot, '.planning');
      if (fs.existsSync(planningDir)) {
        const mappingPath = path.join(planningDir, 'session_mappings.json');
        let appMappings: Record<string, string> = {};
        if (fs.existsSync(mappingPath)) {
          try { appMappings = JSON.parse(fs.readFileSync(mappingPath, 'utf8')); } catch {}
        }
        appMappings[conversationId] = sessionId;
        fs.writeFileSync(mappingPath, JSON.stringify(appMappings, null, 2), 'utf8');
        fs.writeFileSync(path.join(planningDir, '.active_plan'), sessionId, 'utf8');
      }
    }
    console.log(`    🔄  Cross-synced mapping to all suite apps.`);
  } catch (err) {}
}

function cmdStatus(conversationIdOverride?: string) {
  const cwd = process.cwd();
  const planningRoot = path.join(cwd, '.planning');
  const conversationId = conversationIdOverride || resolveActiveConversationId();
  const activePlanPath = path.join(planningRoot, '.active_plan');
  const activePlan = fs.existsSync(activePlanPath) ? fs.readFileSync(activePlanPath, 'utf8').trim() : undefined;

  const mappingsPath = path.join(planningRoot, 'session_mappings.json');
  let mappedSession: string | undefined;
  if (conversationId && fs.existsSync(mappingsPath)) {
    try { mappedSession = JSON.parse(fs.readFileSync(mappingsPath, 'utf8'))[conversationId]; } catch {}
  }

  console.log(`\n🏰  Stillwater Session Manager — Status\n────────────────────────────────────────────────────────\n📂  Workspace      :  ${cwd}\n💬  Conversation   :  ${conversationId ?? '(unknown)'}\n📌  Active Plan    :  ${activePlan ?? '(none)'}\n🔗  Mapped Session :  ${mappedSession ?? '(none)'}`);
  console.log(`────────────────────────────────────────────────────────\n`);
}

function resolveActiveSessionId(convId?: string): string | undefined {
  const cwd = process.cwd();
  const latestConvId = convId || resolveActiveConversationId();
  const activePlanPath = path.join(cwd, '.planning', '.active_plan');
  let currentActive = fs.existsSync(activePlanPath) ? fs.readFileSync(activePlanPath, 'utf8').trim() : undefined;

  let mappedSessionId: string | undefined;
  const mappingsPath = path.join(cwd, '.planning', 'session_mappings.json');
  if (latestConvId && fs.existsSync(mappingsPath)) {
    try { mappedSessionId = JSON.parse(fs.readFileSync(mappingsPath, 'utf8'))[latestConvId]; } catch {}
  }

  const targetSessionId = mappedSessionId || latestConvId;
  if (targetSessionId && targetSessionId !== currentActive) {
    if (mappedSessionId) {
      fs.writeFileSync(activePlanPath, targetSessionId, 'utf8');
    } else {
      cmdInit(targetSessionId);
    }
    return targetSessionId;
  }
  return currentActive;
}

function resolveActiveOwnerUid(): { uid: string; source: string } {
  if (process.env.USER_UID) return { uid: process.env.USER_UID, source: 'Env USER_UID' };
  const profilePath = path.join(os.homedir(), '.config', 'persona', 'profile.json');
  if (fs.existsSync(profilePath)) {
    try {
      const p = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
      const uid = p.userId || p.uid || p.id;
      if (uid) return { uid, source: 'Profile JSON' };
    } catch {}
  }
  return { uid: DEFAULT_SUPERUSER_UID, source: 'Global Failsafe' };
}

async function main() {
  const parsed = parseCommandLine();
  let resolvedConversationId = parsed.conversation || resolveActiveConversationId();
  const resolvedSessionId = parsed.session || resolveActiveSessionId(resolvedConversationId);
  const resolvedProjectSlug = parsed.project || path.basename(process.cwd()).toLowerCase();

  if (parsed.command === 'init') { cmdInit(parsed.session); return; }
  if (parsed.command === 'sync-guide') {
    console.log(`🛰️   Pulsing documentation to Persona App...`);
    
    // 1. Pulse to Firestore (Cloud Authority)
    const child = spawn('npx', ['tsx', 'scripts/session-manager/force-sync-persona-guide.ts'], { stdio: 'inherit' });
    
    child.on('close', (code) => {
      // 2. Surgical Overwrite of Local Manifest (Runtime Authority)
      const potentialPaths = [
        '/home/heidless/projects/Persona/src/data/guide.json',
        '/home/heidless/projects/Persona/src/data/guideData.json',
        '/home/heidless/projects/Persona/public/guide.json'
      ];
      
      const manifestPath = potentialPaths.find(p => fs.existsSync(p));

      if (manifestPath) {
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          const targetTitle = 'Sovereign Control Guide';
          const legacyTitle = 'Persona Stack Control';
          const redundantTitle = 'Sovereign Session Manager';

          if (Array.isArray(manifest)) {
            const updated = manifest.filter((item: any) => item.title !== redundantTitle);
            let section = updated.find((item: any) => item.title === targetTitle);
            if (!section) {
              section = updated.find((item: any) => item.title === legacyTitle);
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
              updated.push({ title: targetTitle, content: GUIDE_CONTENT });
            }
            fs.writeFileSync(manifestPath, JSON.stringify(updated, null, 2), 'utf8');
            console.log(`   ✅ Local manifest updated: ${manifestPath}`);
          }
        } catch (err) {
          console.error(`   ❌ Failed to update local manifest: ${err}`);
        }
      }
      console.log(`\n🚀  Sync Completed with code: ${code}\n`);
    });
    return;
  }
  if (parsed.command === 'status') { cmdStatus(resolvedConversationId || resolvedSessionId); return; }
  if (parsed.command === 'activate') {
    const target = parsed.session || resolveActiveSessionId(resolvedConversationId);
    if (target) cmdActivate(target, resolvedConversationId || target);
    return;
  }

  const uidData = resolveActiveOwnerUid();
  const args = [CORE_SYNC_SCRIPT, parsed.command, '--session', resolvedSessionId!, '--project', resolvedProjectSlug, '--user', uidData.uid];
  if (parsed.version) args.push('--version', parsed.version);
  if (resolvedConversationId) args.push('--conversation', resolvedConversationId);

  console.log(`\n🏰  Executing Command: ${parsed.command.toUpperCase()}\n🆔  Session ID: ${resolvedSessionId}\n👤  User UID: ${uidData.uid}\n────────────────────────────────────────────────────────`);

  if (await askConfirmation('Proceed? (y/N): ')) {
    const expandedCommand = 'npx tsx ' + args.map(a => (a.includes(' ') ? `"${a}"` : a)).join(' ');
    console.log(`👉  Expanded Command :  ${expandedCommand}`);

    spawn('npx', ['tsx', ...args], { 
      stdio: 'inherit',
      env: { ...process.env, FIRESTORE_DATABASE_ID: 'persona-db-0' }
    }).on('close', (code) => {
      if (code === 0 && parsed.command === 'pull') cmdActivate(resolvedSessionId!, resolvedConversationId);
      process.exit(code ?? 0);
    });
  }
}

function resolveActiveConversationId(sessionIdHint?: string): string | undefined {
  if (process.env.CONVERSATION_ID) return process.env.CONVERSATION_ID;
  try {
    const cwd = process.cwd();
    if (sessionIdHint) {
      const mappingsPath = path.join(cwd, '.planning', 'session_mappings.json');
      if (fs.existsSync(mappingsPath)) {
        const mappings = JSON.parse(fs.readFileSync(mappingsPath, 'utf8'));
        const found = Object.keys(mappings).find(id => mappings[id] === sessionIdHint);
        if (found) return found;
      }
    }

    const homedir = os.homedir();
    const scanPaths = [
      path.join(homedir, '.vscode-server', 'data', 'User', 'globalStorage', 'google.gemini-code-assist', 'conversations'),
      path.join(homedir, '.config', 'Code', 'User', 'globalStorage', 'google.gemini-code-assist', 'conversations'),
      path.join(homedir, '.gemini', 'antigravity-ide', 'conversations'),
    ];
    
    let latestMtime = 0;
    let latestConvId: string | undefined;
    for (const p of scanPaths) {
      if (!fs.existsSync(p)) continue;
      const items = fs.readdirSync(p);
      for (const item of items) {
        const id = item.endsWith('.db') ? item.slice(0, -3) : item;
        if (!/^[0-9a-f\-]{36}$/i.test(id)) continue;
        const mtime = fs.statSync(path.join(p, item)).mtimeMs;
        if (mtime > latestMtime) { latestMtime = mtime; latestConvId = id; }
      }
    }
    return latestConvId;
  } catch (err) {
    console.warn(`⚠️ Warning: Failed to resolve active conversation ID: ${err instanceof Error ? err.message : String(err)}`);
    return undefined;
  }
}

main().catch(console.error);