import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { getTargetPaths } from './lib/suite-resolver.js';

async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error("Usage: npm run alamo <tag-name>");
        console.error("Example: npm run alamo alamo-experiment-1-1716801234");
        process.exit(1);
    }

    const tag = args[0];
    console.log(`🏰 STILLWATER SUITE: INITIATING ALAMO RESTORE [${tag}]`);
    console.log(`WARNING: This will DESTROY all uncommitted work and newly created files.`);

    const targetPaths = await getTargetPaths();
    const backupBaseDir = path.join(os.homedir(), '.baseline_backups', tag);

    if (!fs.existsSync(backupBaseDir)) {
        console.warn(`[WARNING] Backup directory for tag ${tag} not found at ${backupBaseDir}. ENV files cannot be restored.`);
    }

    let successCount = 0;

    for (const repoPath of targetPaths) {
        if (!fs.existsSync(repoPath) || !fs.existsSync(path.join(repoPath, '.git'))) {
            continue;
        }

        const repoName = path.basename(repoPath);
        console.log(`--- Restoring ${repoName} ---`);

        try {
            // 1. Verify tag exists in this repo
            try {
                execSync(`git rev-parse "${tag}"`, { cwd: repoPath, stdio: 'ignore' });
            } catch (e) {
                console.log(`[SKIP] Tag ${tag} does not exist in ${repoName}.`);
                continue;
            }

            // 2. Hard Reset
            console.log(`[GIT] Executing hard reset to ${tag}...`);
            execSync(`git reset --hard "${tag}"`, { cwd: repoPath, stdio: 'pipe' });

            // 3. Clean untracked files
            console.log(`[GIT] Wiping untracked files...`);
            execSync(`git clean -fd`, { cwd: repoPath, stdio: 'pipe' });

            // 4. Restore env files
            const backupDir = path.join(backupBaseDir, repoName);
            if (fs.existsSync(backupDir)) {
                const files = await fs.readdir(backupDir);
                for (const file of files) {
                    const srcPath = path.join(backupDir, file);
                    const destPath = path.join(repoPath, file);
                    await fs.copy(srcPath, destPath);
                    console.log(`[ENV] Restored ${file}`);
                }
            } else {
                console.log(`[ENV] No backed-up environment files for ${repoName}.`);
            }

            successCount++;
        } catch (error: any) {
            console.error(`[ERROR] Failed to restore ${repoName}: ${error.message}`);
        }
    }

    console.log(`\n======================================================================`);
    console.log(`🏰 RESTORE PROTOCOL COMPLETE: Restored to tag [${tag}] in ${successCount} repos.`);
    console.log(`======================================================================`);
}

main().catch(err => {
    console.error("Alamo restore script failed:", err);
    process.exit(1);
});