import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { getTargetPaths } from './lib/suite-resolver.js';

async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error("Usage: npm run baseline <label>");
        process.exit(1);
    }

    const label = args[0];
    const timestamp = Math.floor(Date.now() / 1000);
    const alamoTag = `alamo-${label}-${timestamp}`;

    console.log(`🏰 STILLWATER SUITE: CREATING BASELINE SNAPSHOT [${alamoTag}]`);

    const targetPaths = await getTargetPaths();
    const backupBaseDir = path.join(os.homedir(), '.baseline_backups', alamoTag);

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

main().catch(err => {
    console.error("Baseline script failed:", err);
    process.exit(1);
});