import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { getTargetPaths } from './lib/suite-resolver.js';

const QUICK_REFERENCE = `======================================================================
🏰 STILLWATER SUITE: SOVEREIGN CHECKPOINT SYSTEM QUICK REFERENCE
======================================================================
• !baseline [label]  - Snapshot code state & configs across all suite repos
                      Example: !baseline experiment-1
• !baseline list     - List all available baseline snapshots and their meta info
                      Example: !baseline list
• !alamo [tag]       - Hard reset code & restore envs from tag
                      Example: !alamo alamo-experiment-1-1779879020
• !finalize          - Soft reset and squash all baseline commits to staging
                      Example: !finalize
======================================================================`;

async function main() {
    console.log(QUICK_REFERENCE);
    
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error("Usage: npm run baseline <label> | list");
        process.exit(1);
    }

    if (args[0] === 'list') {
        await listBaselines();
        return;
    }

    const label = args[0];
    const timestamp = Math.floor(Date.now() / 1000);
    const alamoTag = `alamo-${label}-${timestamp}`;

    console.log(`\n🏰 STILLWATER SUITE: CREATING BASELINE SNAPSHOT [${alamoTag}]`);

    const targetPaths = await getTargetPaths();
    const backupBaseDir = path.join(os.homedir(), '.baseline_backups', alamoTag);

    // Ensure baseline backups directory exists
    await fs.ensureDir(backupBaseDir);

    let successCount = 0;

    for (const repoPath of targetPaths) {
        if (!fs.existsSync(repoPath) || !fs.existsSync(path.join(repoPath, '.git'))) {
            continue;
        }

        const repoName = path.basename(repoPath);
        console.log(`--- Snapshotting ${repoName} ---`);

        try {
            // 1. Stage all changes (including untracked files)
            console.log(`[GIT] Staging changes...`);
            execSync('git add -A', { cwd: repoPath, stdio: 'pipe' });

            // 2. Commit with baseline prefix (using --allow-empty to avoid crashes if clean)
            console.log(`[GIT] Committing changes...`);
            execSync(`git commit --allow-empty -m "baseline: ${label}"`, { cwd: repoPath, stdio: 'pipe' });

            // 3. Tag the commit
            console.log(`[GIT] Tagging with ${alamoTag}...`);
            execSync(`git tag "${alamoTag}"`, { cwd: repoPath, stdio: 'pipe' });

            // 4. Backup env files
            const backupDir = path.join(backupBaseDir, repoName);
            const envFiles = ['.env', '.env.local', '.env.production', '.env.development'];
            let envBackedUp = false;

            for (const envFile of envFiles) {
                const srcPath = path.join(repoPath, envFile);
                if (fs.existsSync(srcPath)) {
                    const destPath = path.join(backupDir, envFile);
                    await fs.ensureDir(backupDir);
                    await fs.copy(srcPath, destPath);
                    console.log(`[ENV] Backed up ${envFile}`);
                    envBackedUp = true;
                }
            }
            if (!envBackedUp) {
                console.log(`[ENV] No environment files found to back up.`);
            }

            successCount++;
        } catch (error: any) {
            console.error(`[ERROR] Failed to snapshot ${repoName}: ${error.message}`);
        }
    }

    console.log(`\n======================================================================`);
    console.log(`🏰 SNAPSHOT PROTOCOL COMPLETE: Created tag [${alamoTag}] in ${successCount} repos.`);
    console.log(`Backup files stored at: ${backupBaseDir}`);
    console.log(`======================================================================`);
}

async function listBaselines() {
    const targetPaths = await getTargetPaths();
    const backupsDir = path.join(os.homedir(), '.baseline_backups');
    
    console.log(`\n### **🏰 STILLWATER SUITE: AVAILABLE BASELINE SNAPSHOTS**\n`);

    if (!fs.existsSync(backupsDir)) {
        console.log(`No baselines found (backups directory does not exist).`);
        return;
    }

    const files = fs.readdirSync(backupsDir);
    const baselines: Array<{
        tag: string;
        label: string;
        timestamp: number;
        dateStr: string;
        envBackups: string[];
        activeRepos: string[];
        missingRepos: string[];
    }> = [];

    for (const file of files) {
        const fullPath = path.join(backupsDir, file);
        if (!fs.statSync(fullPath).isDirectory()) {
            continue;
        }

        const match = file.match(/^alamo-(.+)-(\d+)$/);
        if (!match) {
            continue;
        }

        const label = match[1];
        const timestamp = parseInt(match[2], 10);
        const date = new Date(timestamp * 1000);
        const dateStr = date.toLocaleString();

        // Check backed up env files
        const envBackups: string[] = [];
        const repoDirs = fs.readdirSync(fullPath);
        for (const repoDir of repoDirs) {
            const repoPath = path.join(fullPath, repoDir);
            if (fs.statSync(repoPath).isDirectory()) {
                const envs = fs.readdirSync(repoPath).filter(f => f.startsWith('.env'));
                if (envs.length > 0) {
                    envBackups.push(`${repoDir} (${envs.join(', ')})`);
                }
            }
        }

        // Check which repos still have the git tag active
        const activeRepos: string[] = [];
        const missingRepos: string[] = [];

        for (const repoPath of targetPaths) {
            if (!fs.existsSync(repoPath) || !fs.existsSync(path.join(repoPath, '.git'))) {
                continue;
            }
            const repoName = path.basename(repoPath);
            try {
                execSync(`git show-ref --tags --quiet "${file}"`, { cwd: repoPath, stdio: 'ignore' });
                activeRepos.push(repoName);
            } catch {
                missingRepos.push(repoName);
            }
        }

        baselines.push({
            tag: file,
            label,
            timestamp,
            dateStr,
            envBackups,
            activeRepos,
            missingRepos
        });
    }

    if (baselines.length === 0) {
        console.log(`No baseline snapshots found in the backups store.`);
        return;
    }

    // Sort newest first
    baselines.sort((a, b) => b.timestamp - a.timestamp);

    for (const b of baselines) {
        const totalReposCount = b.activeRepos.length + b.missingRepos.length;
        let statusIndicator = '⚪ Archived (Finalized)';
        let isArchived = true;

        if (b.activeRepos.length === totalReposCount && totalReposCount > 0) {
            statusIndicator = `🟢 Active (${b.activeRepos.length}/${totalReposCount} repos)`;
            isArchived = false;
        } else if (b.activeRepos.length > 0) {
            statusIndicator = `🟡 Partial (${b.activeRepos.length}/${totalReposCount} repos)`;
            isArchived = false;
        }

        console.log(`---`);
        console.log(`**Label**: ${b.label} | **Created**: *${b.dateStr}* | **Status**: ${statusIndicator}`);
        if (!isArchived) {
            console.log(`⚡ **Restore Checkpoint**: [!alamo ${b.tag}](command://!alamo%20${b.tag})`);
        } else {
            console.log(`📦 **Archived Checkpoint**: ${b.tag}`);
        }
    }
    console.log(`\n---\n`);
}

main().catch(err => {
    console.error("Baseline script failed:", err);
    process.exit(1);
});