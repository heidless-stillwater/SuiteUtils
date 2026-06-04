#!/usr/bin/env tsx
import { randomUUID } from 'crypto';
/**
 * scripts/session-manager/manage.ts
 *
 * Unified CLI utility to ease pushing and pulling shared agent sessions
 * to and from the Persona Session Manager.
 *
 * Usage:
 *   npx tsx scripts/session-manager/manage.ts push [session_id] [owner_uid] [project_slug] [--session <id>] [--user <uid>] [--project <slug>] [--name <displayName>]
 *   npx tsx scripts/session-manager/manage.ts pull [session_id] [owner_uid] [project_slug] [--session <id>] [--user <uid>] [--project <slug>]
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';
import { spawn } from 'child_process';

const DEFAULT_SUPERUSER_UID = 'stqIDYHVcLRxjclsqaksiKMvSXz2';
const DEFAULT_DISPLAY_NAME = 'Lead Director';
const CORE_SYNC_SCRIPT = '/home/heidless/projects/Persona/scripts/session-sync.ts';

// ── 1. Arg Parsing (Hybrid: Positional + Named Flags) ────────────────────────

interface CLIArgs {
  command: 'push' | 'pull' | 'init' | 'history' | 'rollback' | 'view-version' | 'update-version' | 'delete-version' | 'activate' | 'status';
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
  const validCommands = ['push', 'pull', 'init', 'list', 'history', 'rollback', 'view-version', 'update-version', 'delete-version', 'activate', 'status'];
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

  // Map positionals in sequence
  const posSession = positionals[0];
  const posUser = positionals[1];
  const posProject = positionals[2];

  return {
    command: cmd as any,
    session: flags['session'] || posSession,
    user: flags['user'] || posUser,
    project: flags['project'] || posProject,
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

Commands:
  init            Create a new session (generates UUID, skeleton files, updates .active_plan)
                  Use this at the start of a new Antigravity conversation to bridge
                  conversation identity to a unique session. The agent will auto-run
                  this when it detects a new conversation without a linked session.
  status          Show the current active session and whether this conversation is mapped to it
  activate        Link the current conversation/chat to an existing session (updates mappings and .active_plan)
  push            Push local .planning files to Firestore (creates new version)
  pull            Pull session to local .planning/ (latest by default, or --version N for a specific snapshot) + auto-activates
  history         Show version history for a session
  rollback        Roll back a session to a previous version (creates a new version in Firestore)
  view-version    Inspect file metadata of a specific version
  update-version  Overwrites a specific version in-place
  delete-version  Surgically deletes a version from database

Options:
  --session <id>     UUID/Session ID override (for init/activate/push/pull commands)
  --user    <uid>    Firebase owner user UID override
  --project <slug>   Project slug override (defaults to current folder name)
  --name    <name>   Display name override (for push/rollback/update-version)
  --version <n>      Version number (optional for pull, required for rollback/view-version/update-version/delete-version)
  --conversation <id> Current conversation/chat ID override (for activate command)

Conversation ↔ Session Bridging:
  Each new Antigravity conversation should map to its own session.
  Running 'init' creates a fresh session ID and updates .active_plan so that
  all subsequent push/pull commands in the conversation use the new session.
  The agent is configured to auto-run 'init' at the start of every new chat.

Examples:
  npx tsx scripts/session-manager/manage.ts init
  npx tsx scripts/session-manager/manage.ts init --session <existing-uuid>
  npx tsx scripts/session-manager/manage.ts activate --session <existing-uuid>
  npx tsx scripts/session-manager/manage.ts push
  npx tsx scripts/session-manager/manage.ts pull
  npx tsx scripts/session-manager/manage.ts pull --version 3
  npx tsx scripts/session-manager/manage.ts history
  npx tsx scripts/session-manager/manage.ts view-version --version 5
  npx tsx scripts/session-manager/manage.ts update-version --version 5
  npx tsx scripts/session-manager/manage.ts delete-version --version 2
`);
  process.exit(1);
}

// ── 2. Init Command ─────────────────────────────────────────────────────────

const SKELETON_TASK_PLAN = `# Task Plan: [Brief Description]

## Goal
[One sentence describing the end state]

## Current Phase
Phase 1

## Phases

### Phase 1: Requirements & Discovery
- [ ] Understand user intent
- [ ] Identify constraints
- [ ] Document in findings.md
- **Status:** in_progress

### Phase 2: Planning & Structure
- [ ] Define approach
- [ ] Create project structure
- **Status:** pending

### Phase 3: Implementation
- [ ] Execute the plan
- [ ] Write to files before executing
- **Status:** pending

### Phase 4: Testing & Verification
- [ ] Verify requirements met
- [ ] Document test results
- **Status:** pending

### Phase 5: Delivery
- [ ] Review outputs
- [ ] Deliver to user
- **Status:** pending

## Decisions Made
| Decision | Rationale |
|----------|-----------|

## Errors Encountered
| Error | Resolution |
|-------|------------|
`;

const SKELETON_PROGRESS = `# Session Progress Log

## Session: ${new Date().toISOString().split('T')[0]} | ${path.basename(process.cwd())}

---

### Session Summary

**Date:** ${new Date().toISOString().split('T')[0]}  
**Workspace:** \`${process.cwd()}\`

---

### What Was Done This Session

- [ ] (session just initialized)

---

### Open Questions / Next Steps

- [ ] (none yet)
`;

const SKELETON_FINDINGS = `# Findings & Decisions

## Requirements
-

## Research Findings
-

## Technical Decisions
| Decision | Rationale |
|----------|-----------|

## Issues Encountered
| Issue | Resolution |
|-------|------------|

## Resources
-
`;

function cmdInit(sessionIdOverride?: string): string {
  const cwd = process.cwd();
  const planningRoot = path.join(cwd, '.planning');
  const sessionId = sessionIdOverride || randomUUID();
  const sessionDir = path.join(planningRoot, sessionId);

  // Create directory structure
  fs.mkdirSync(sessionDir, { recursive: true });

  // Write skeleton files
  fs.writeFileSync(path.join(sessionDir, 'task_plan.md'), SKELETON_TASK_PLAN, 'utf8');
  fs.writeFileSync(path.join(sessionDir, 'progress.md'), SKELETON_PROGRESS, 'utf8');
  fs.writeFileSync(path.join(sessionDir, 'findings.md'), SKELETON_FINDINGS, 'utf8');

  // Update .active_plan pointer
  fs.writeFileSync(path.join(planningRoot, '.active_plan'), sessionId, 'utf8');

  console.log(`\n🆕  New session initialized`);
  console.log(`    🆔  Session ID  :  ${sessionId}`);
  console.log(`    📂  Directory   :  ${sessionDir}`);
  console.log(`    📄  Files       :  task_plan.md, progress.md, findings.md`);
  console.log(`    📌  .active_plan updated → ${sessionId}`);

  // Cross-workspace sync (SuiteUtils <-> Persona)
  try {
    const parentDir = path.dirname(cwd);
    const siblingName = path.basename(cwd) === 'SuiteUtils' ? 'Persona' : 'SuiteUtils';
    const siblingRoot = path.join(parentDir, siblingName, '.planning');
    
    if (fs.existsSync(path.dirname(siblingRoot))) {
      const siblingSessionDir = path.join(siblingRoot, sessionId);
      fs.mkdirSync(siblingSessionDir, { recursive: true });
      fs.writeFileSync(path.join(siblingSessionDir, 'task_plan.md'), SKELETON_TASK_PLAN, 'utf8');
      fs.writeFileSync(path.join(siblingSessionDir, 'progress.md'), SKELETON_PROGRESS, 'utf8');
      fs.writeFileSync(path.join(siblingSessionDir, 'findings.md'), SKELETON_FINDINGS, 'utf8');
      fs.writeFileSync(path.join(siblingRoot, '.active_plan'), sessionId, 'utf8');
      console.log(`    🔄  Cross-synced session to sibling workspace: ${siblingName}`);
    }
  } catch (err) {
    // Ignore cross-sync failure if sibling doesn't exist
  }

  return sessionId;
}

async function askConfirmation(query: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.toLowerCase() === 'y' || ans.toLowerCase() === 'yes');
    });
  });
}

function cmdActivate(sessionId: string, conversationIdOverride?: string) {
  const cwd = process.cwd();
  const planningRoot = path.join(cwd, '.planning');
  
  // Resolve conversation ID
  const conversationId = conversationIdOverride || resolveActiveConversationId();
  if (!conversationId) {
    console.error('❌ Error: Could not dynamically resolve the current active Conversation ID.');
    console.error('   Please specify it explicitly using --conversation <id>');
    process.exit(1);
  }

  // Update session_mappings.json
  const mappingsPath = path.join(planningRoot, 'session_mappings.json');
  let mappings: Record<string, string> = {};
  if (fs.existsSync(mappingsPath)) {
    try {
      mappings = JSON.parse(fs.readFileSync(mappingsPath, 'utf8'));
    } catch {}
  }
  mappings[conversationId] = sessionId;
  fs.writeFileSync(mappingsPath, JSON.stringify(mappings, null, 2), 'utf8');

  // Update .active_plan pointer
  fs.writeFileSync(path.join(planningRoot, '.active_plan'), sessionId, 'utf8');

  console.log(`\n🔗  Session activated in current chat`);
  console.log(`    🆔  Session ID      :  ${sessionId}`);
  console.log(`    💬  Conversation ID :  ${conversationId}`);
  console.log(`    📌  .active_plan updated → ${sessionId}`);

  // Cross-workspace sync (SuiteUtils <-> Persona)
  try {
    const parentDir = path.dirname(cwd);
    const siblingName = path.basename(cwd) === 'SuiteUtils' ? 'Persona' : 'SuiteUtils';
    const siblingRoot = path.join(parentDir, siblingName, '.planning');
    
    if (fs.existsSync(siblingRoot)) {
      // Sync mappings
      const siblingMappingsPath = path.join(siblingRoot, 'session_mappings.json');
      let siblingMappings: Record<string, string> = {};
      if (fs.existsSync(siblingMappingsPath)) {
        try {
          siblingMappings = JSON.parse(fs.readFileSync(siblingMappingsPath, 'utf8'));
        } catch {}
      }
      siblingMappings[conversationId] = sessionId;
      fs.writeFileSync(siblingMappingsPath, JSON.stringify(siblingMappings, null, 2), 'utf8');

      // Sync active plan pointer
      fs.writeFileSync(path.join(siblingRoot, '.active_plan'), sessionId, 'utf8');
      console.log(`    🔄  Cross-synced mapping and .active_plan to sibling workspace: ${siblingName}`);
    }
  } catch (err) {
    // Ignore cross-sync failure
  }
}

function cmdStatus(conversationIdOverride?: string) {
  const cwd = process.cwd();
  const planningRoot = path.join(cwd, '.planning');

  const conversationId = conversationIdOverride || resolveActiveConversationId();

  // Read .active_plan
  const activePlanPath = path.join(planningRoot, '.active_plan');
  const activePlan = fs.existsSync(activePlanPath)
    ? fs.readFileSync(activePlanPath, 'utf8').trim()
    : undefined;

  // Read session_mappings.json
  const mappingsPath = path.join(planningRoot, 'session_mappings.json');
  let mappedSession: string | undefined;
  if (conversationId && fs.existsSync(mappingsPath)) {
    try {
      const mappings = JSON.parse(fs.readFileSync(mappingsPath, 'utf8'));
      mappedSession = mappings[conversationId];
    } catch {}
  }

  const isLinked = !!mappedSession;
  const isActive = mappedSession === activePlan;

  console.log(`\n🏰  Stillwater Session Manager — Status`);
  console.log(`────────────────────────────────────────────────────────`);
  console.log(`📂  Workspace      :  ${cwd}`);
  console.log(`💬  Conversation   :  ${conversationId ?? '(unknown)'}`);
  console.log(`📌  Active Plan    :  ${activePlan ?? '(none)'}`);
  console.log(`🔗  Mapped Session :  ${mappedSession ?? '(none — not activated)'}`);

  if (!conversationId) {
    console.log(`\n⚠️   Could not detect current Conversation ID from IDE brain directory.`);
  } else if (!isLinked) {
    console.log(`\n❌  This conversation is NOT linked to any session.`);
    console.log(`   → Run: npx tsx scripts/session-manager/manage.ts pull --session <id>`);
  } else if (!isActive) {
    console.log(`\n⚠️   Mapped session (${mappedSession}) differs from active plan (${activePlan}).`);
    console.log(`   → Run: npx tsx scripts/session-manager/manage.ts activate --session ${mappedSession}`);
  } else {
    console.log(`\n✅  Session is active and linked to this conversation.`);
  }
  console.log(`────────────────────────────────────────────────────────\n`);
}

// ── 3. Dynamic Parameters Resolution ────────────────────────────────────────

function resolveActiveSessionId(convId?: string): string | undefined {
  const cwd = process.cwd();
  
  const latestConvId = convId || resolveActiveConversationId();

  // 3. Compare with the local .planning/.active_plan
  const activePlanPath = path.join(cwd, '.planning', '.active_plan');
  let currentActive: string | undefined;
  if (fs.existsSync(activePlanPath)) {
    currentActive = fs.readFileSync(activePlanPath, 'utf8').trim();
  }

  // Read session mappings if they exist
  let mappedSessionId: string | undefined;
  const mappingsPath = path.join(cwd, '.planning', 'session_mappings.json');
  if (latestConvId && fs.existsSync(mappingsPath)) {
    try {
      const mappings = JSON.parse(fs.readFileSync(mappingsPath, 'utf8'));
      if (mappings[latestConvId]) {
        mappedSessionId = mappings[latestConvId];
      }
    } catch {
      // Ignore JSON error
    }
  }

  const targetSessionId = mappedSessionId || latestConvId;

  if (targetSessionId) {
    // If the target session ID does not match the local active plan:
    if (targetSessionId !== currentActive) {
      console.log(`\n🔍  Detected active session ID: ${targetSessionId}`);
      console.log(`    Local active plan was: ${currentActive ?? '(none)'}`);
      
      if (mappedSessionId) {
        // If it was mapped, we just update the active plan pointer without initializing templates
        console.log(`    Resuming mapped session ${targetSessionId}...`);
        fs.writeFileSync(activePlanPath, targetSessionId, 'utf8');
      } else {
        console.log(`    Auto-initializing session ${targetSessionId}...`);
        // Auto-run init for the new session in the current workspace
        cmdInit(targetSessionId);
      }
      return targetSessionId;
    }
  }

  // 4. Fall back to standard active plan
  if (currentActive && fs.existsSync(path.join(cwd, '.planning', currentActive))) {
    return currentActive;
  }

  // 5. Fall back to the newest directory inside .planning/
  const planningRoot = path.join(cwd, '.planning');
  if (fs.existsSync(planningRoot)) {
    const dirs = fs
      .readdirSync(planningRoot)
      .filter((n) => !n.startsWith('.') && fs.statSync(path.join(planningRoot, n)).isDirectory())
      .sort((a, b) => {
        const ma = fs.statSync(path.join(planningRoot, a)).mtimeMs;
        const mb = fs.statSync(path.join(planningRoot, b)).mtimeMs;
        return mb - ma;
      });
    if (dirs.length > 0) return dirs[0];
  }

  return undefined;
}

function resolveActiveProjectSlug(): string {
  return path.basename(process.cwd()).toLowerCase();
}

function resolveActiveOwnerUid(): { uid: string; source: string } {
  // Layer 0: Environment Variable (Priority for IDE terminals)
  if (process.env.USER_UID) {
    return { uid: process.env.USER_UID, source: 'Environment Variable (USER_UID)' };
  }
  if (process.env.FIREBASE_UID) {
    return { uid: process.env.FIREBASE_UID, source: 'Environment Variable (FIREBASE_UID)' };
  }

  // Layer 1: Check live watcher process CMDLINE via PID file
  const cwd = process.cwd();
  const watcherPidPath = path.join(cwd, '.planning', '.watcher.pid');
  if (fs.existsSync(watcherPidPath)) {
    try {
      const pid = parseInt(fs.readFileSync(watcherPidPath, 'utf8').trim(), 10);
      // Verify process is alive
      process.kill(pid, 0);
      
      const cmdlinePath = `/proc/${pid}/cmdline`;
      if (fs.existsSync(cmdlinePath)) {
        const cmdline = fs.readFileSync(cmdlinePath, 'utf8');
        const parts = cmdline.split('\0');
        const userIndex = parts.indexOf('--user');
        if (userIndex !== -1 && parts[userIndex + 1]) {
          return { uid: parts[userIndex + 1], source: `Live Watcher Process (PID ${pid})` };
        }
      }
    } catch {
      // Process is dead or proc fs not accessible; continue to next layer
    }
  }

  // Layer 2: Check local persona config profile
  const profilePath = path.join(os.homedir(), '.config', 'persona', 'profile.json');
  if (fs.existsSync(profilePath)) {
    try {
      const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
      const uid = profile.userId || profile.uid || profile.id;
      if (uid) {
        return { uid, source: `Persona Configuration File (${profilePath})` };
      }
    } catch {
      // JSON syntax error or permission issue; continue to next layer
    }
  }

  // Layer 3: Failsafe Global Super-User
  return { uid: DEFAULT_SUPERUSER_UID, source: 'Global Super-User Failsafe' };
}

function resolveActiveDisplayName(): string {
  const profilePath = path.join(os.homedir(), '.config', 'persona', 'profile.json');
  if (fs.existsSync(profilePath)) {
    try {
      const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
      if (profile.name) {
        return profile.name;
      }
    } catch {
      // Do nothing
    }
  }
  return DEFAULT_DISPLAY_NAME;
}

// ── 4. Main Execution ────────────────────────────────────────────────────────

async function main() {
  const parsed = parseCommandLine();

  // Resolve parameters early for use in command preview and activation
  let resolvedConversationId = parsed.conversation || resolveActiveConversationId();

  // Resolve session and project details
  const resolvedSessionId = parsed.session || resolveActiveSessionId(resolvedConversationId);
  const resolvedProjectSlug = parsed.project || resolveActiveProjectSlug();

  // ── Handle `init` locally (no Firestore needed) ────────────────────────────
  if (parsed.command === 'init') {
    console.log(`\n🏰  Stillwater Session Manager Command Suite`);
    console.log(`────────────────────────────────────────────────────────`);
    console.log(`👉  Executing Command:  INIT`);
    console.log(`📂  Target Workspace :  ${process.cwd()}`);
    console.log(`────────────────────────────────────────────────────────`);
    cmdInit(parsed.session);
    console.log(`\n🚀  Session Manager Operation Completed Successfully.\n`);
    return;
  }

  // ── Handle `status` locally (no Firestore needed) ────────────────────────
  if (parsed.command === 'status') {
    // If still missing, try one last resolution now that we have session context
    if (!resolvedConversationId && resolvedSessionId) {
      resolvedConversationId = resolveActiveConversationId(resolvedSessionId);
    }
    cmdStatus(resolvedConversationId || resolvedSessionId);
    return;
  }

  // ── Handle `activate` locally (no Firestore needed) ───────────────────────
  if (parsed.command === 'activate') {
    console.log(`\n🏰  Stillwater Session Manager Command Suite`);
    console.log(`────────────────────────────────────────────────────────`);
    console.log(`👉  Executing Command:  ACTIVATE`);
    console.log(`📂  Target Workspace :  ${process.cwd()}`);
    console.log(`────────────────────────────────────────────────────────`);
    
    const targetSessionId = parsed.session || resolveActiveSessionId(resolvedConversationId);
    if (!targetSessionId) {
      console.error('❌ Error: Please specify the Session ID to activate using --session <id>');
      process.exit(1);
    }

    // Attempt resolution before activation
    if (!resolvedConversationId) {
      resolvedConversationId = resolveActiveConversationId(targetSessionId);
    }
    
    cmdActivate(targetSessionId, resolvedConversationId || targetSessionId);
    console.log(`\n🚀  Session Manager Operation Completed Successfully.\n`);
    return;
  }
  
  // ── Final resolution and validation for data-dependent commands ───────────

  // Fallback default: If conversation ID is missing, try to resolve it from the session ID mapping
  // or default to the session ID itself to prevent the script from failing.
  if (!resolvedConversationId && resolvedSessionId) {
    resolvedConversationId = resolveActiveConversationId(resolvedSessionId);
    if (!resolvedConversationId) {
      console.log(`⚠️  Current Conversation ID not found. Using Session ID as default: ${resolvedSessionId}`);
      resolvedConversationId = resolvedSessionId;
    }
  }

  if ((parsed.command === 'pull' || parsed.command === 'activate') && !resolvedConversationId) {
    console.error('❌ Error: Could not dynamically resolve the current active Conversation ID.');
    console.error('   Please specify it explicitly using --conversation <id>');
    process.exit(1);
  }
  
  const resolvedUidData = parsed.user 
    ? { uid: parsed.user, source: 'Explicit CLI Parameter' }
    : resolveActiveOwnerUid();
    
  const resolvedName = parsed.name || resolveActiveDisplayName();

  // Validate critical params
  if (!resolvedSessionId) {
    console.error('❌ Error: Could not dynamically resolve active Session ID.');
    console.error('   Tip: Run `npx tsx scripts/session-manager/manage.ts init` to create a new session,');
    console.error('   or specify --session <id> explicitly.');
    process.exit(1);
  }

  const versionRequiredCmds = ['rollback', 'view-version', 'update-version', 'delete-version'];
  if (versionRequiredCmds.includes(parsed.command) && !parsed.version) {
    console.error(`❌ Error: Command "${parsed.command}" requires a target version parameter.`);
    console.error(`   Usage: npx tsx scripts/session-manager/manage.ts ${parsed.command} --version <number>`);
    process.exit(1);
  }

  console.log(`\n🏰  Stillwater Session Manager Command Suite`);
  console.log(`────────────────────────────────────────────────────────`);
  console.log(`👉  Executing Command:  ${parsed.command.toUpperCase()}`);
  console.log(`📂  Target Workspace :  ${process.cwd()}`);
  console.log(`🆔  Session ID       :  ${resolvedSessionId}`);
  console.log(`🏷️   Project Slug     :  ${resolvedProjectSlug}`);
  console.log(`👤  User UID         :  ${resolvedUidData.uid} (Source: ${resolvedUidData.source})`);
  if (resolvedConversationId) {
    console.log(`💬  Conversation ID  :  ${resolvedConversationId}`);
  }
  if (parsed.version) {
    console.log(`🔢  Version          :  ${parsed.version}`);
  }
  if (parsed.command === 'push' || parsed.command === 'rollback' || parsed.command === 'update-version') {
    console.log(`📛  Display Name     :  ${resolvedName}`);
  }
  console.log(`────────────────────────────────────────────────────────`);

  // Build command args
  const args = [
    CORE_SYNC_SCRIPT,
    parsed.command,
    '--session', resolvedSessionId,
    '--project', resolvedProjectSlug,
    '--user', resolvedUidData.uid
  ];

  if (parsed.command === 'push' || parsed.command === 'rollback' || parsed.command === 'update-version') {
    args.push('--name', resolvedName);
  }

  if (parsed.version) {
    args.push('--version', parsed.version);
  }

  // Add conversation ID to expanded command arguments
  if (resolvedConversationId) {
    args.push('--conversation', resolvedConversationId);
  }

  // ── Display expanded command and ask for permission ────────────────────────
  const expandedCommand = `npx tsx ${args.map(a => (a.includes(' ') ? `"${a}"` : a)).join(' ')}`;
  console.log(`👉  Expanded Command :  ${expandedCommand}`);
  console.log(`────────────────────────────────────────────────────────`);

  const proceed = await askConfirmation('Do you want to proceed with this command? (y/N): ');
  if (!proceed) {
    console.log('\n🛑  Operation cancelled by user.\n');
    process.exit(0);
  }

  // Spawn sync execution child process
  const child = spawn('npx', ['tsx', ...args], {
    stdio: 'inherit'
  });

  child.on('close', (code) => {
    if (code === 0) {
      // Automatically run the activation logic immediately after a successful Firestore pull
      if (parsed.command === 'pull' && resolvedSessionId) {
        cmdActivate(resolvedSessionId, resolvedConversationId);
      }
      console.log(`\n🚀  Session Manager Operation Completed Successfully.\n`);
      process.exit(0);
    } else {
      console.error(`\n❌  Session Sync failed with exit code: ${code}\n`);
      process.exit(code ?? 1);
    }
  });
}

main().catch((err) => {
  console.error('❌ Unexpected Error:', err);
  process.exit(1);
});

/**
 * Resolves the current active Conversation ID.
 * Priority: 1. Environment variable, 2. Latest modified directory in brain folder.
 */
function resolveActiveConversationId(sessionIdHint?: string): string | undefined {
  if (process.env.CONVERSATION_ID) {
    return process.env.CONVERSATION_ID;
  }

  try {
    const cwd = process.cwd();

    // Try reverse lookup in session_mappings.json if we have a session ID hint
    if (sessionIdHint) {
      const mappingsPath = path.join(cwd, '.planning', 'session_mappings.json');
      if (fs.existsSync(mappingsPath)) {
        try {
          const mappings = JSON.parse(fs.readFileSync(mappingsPath, 'utf8'));
          const foundConvId = Object.keys(mappings).find(
            (convId) => mappings[convId] === sessionIdHint
          );
          if (foundConvId) {
            console.log(`✅ Automatically resolved Conversation ID from local session mapping: ${foundConvId}`);
            return foundConvId;
          }
        } catch {}
      }
    }

    const homedir = os.homedir();
    const scanPaths = [
      // Legacy Antigravity IDE paths (may be stale after migration)
      path.join(homedir, '.gemini', 'antigravity-ide', 'conversations'),
      path.join(homedir, '.gemini', 'antigravity-ide', 'brain'),
      path.join(homedir, '.gemini', 'antigravity', 'brain'), // Older Antigravity brain path
      // Potential VS Code Remote Development paths for Gemini extension data
      path.join(homedir, '.vscode-server', 'data', 'User', 'globalStorage', 'google.gemini-code-assist', 'conversations'),
      // Standard VS Code on Linux Desktop
      path.join(homedir, '.config', 'Code', 'User', 'globalStorage', 'google.gemini-code-assist', 'conversations'),
      path.join(homedir, '.config', 'Code - Insiders', 'User', 'globalStorage', 'google.gemini-code-assist', 'conversations'),
    ];
    
    let latestMtime = 0;
    let latestConvId: string | undefined;
    for (const p of scanPaths) {
      if (!fs.existsSync(p)) {
        // Silent skip for non-existent paths to keep output clean, 
        // or uncomment below for deep debugging
        // console.log(`🚫 Path does not exist: ${p}`);
        continue;
      }

      console.log(`🔍 Scanning path: ${p}`);
      const items = fs.readdirSync(p);
      if (items.length === 0) console.log(`   (Directory is empty)`);
      
      for (const item of items) {
        // Strip .db extension for conversation files to get the ID
        const id = item.endsWith('.db') ? item.slice(0, -3) : item;
        if (id.startsWith('.') || !/^[0-9a-f\-]{36}$/i.test(id)) continue;

        try {
          const fullPath = path.join(p, item);
          const stat = fs.statSync(fullPath);
          console.log(`   ✨ Found valid session: ${id} (last modified: ${new Date(stat.mtimeMs).toLocaleString()})`);
          if (stat.mtimeMs > latestMtime) {
            latestMtime = stat.mtimeMs;
            latestConvId = id;
          }
        } catch (e) {
          console.log(`   ⚠️  Could not stat ${item}: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
      }
    }
    if (latestConvId) console.log(`✅ Resolved latest ID: ${latestConvId}`);
    return latestConvId;
  } catch (err) {
    console.error('❌ Error in dynamic resolution:', err);
    return undefined;
  }
}
