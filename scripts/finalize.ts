import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { getTargetPaths } from './lib/suite-resolver.js';

const QUICK_REFERENCE = `======================================================================
🏰 STILLWATER SUITE: SOVEREIGN CHECKPOINT SYSTEM QUICK REFERENCE
======================================================================
• !baseline [label]  - Snapshot code state & configs across all suite repos
                      Example: !baseline experiment-1
• !alamo [tag]       - Hard reset code & restore envs from tag
                      Example: !alamo alamo-experiment-1-1779879020
• !finalize          - Soft reset and squash all baseline commits to staging
                      Example: !finalize
======================================================================`;

async function main() {
    console.log(QUICK_REFERENCE);
    console.log(`\n🏰 STILLWATER SUITE: INITIATING HISTORY FINALIZATION`);
    console.log(`This will fold all checkpoint commits back into your staging area.\n`);

    const targetPaths = await getTargetPaths();
    let processedCount = 0;

    for (const repoPath of targetPaths) {
        if (!fs.existsSync(repoPath) || !fs.existsSync(path.join(repoPath, '.git'))) {
            continue;
        }

        const repoName = path.basename(repoPath);

        try {
            // Get last 50 commits to find the baseline sequence
            // Formatted as "hash|subject"
            const logOutput = execSync(`git log -n 50 --format="%H|%s"`, { cwd: repoPath, stdio: 'pipe' }).toString().trim();
            if (!logOutput) continue;

            const commits = logOutput.split('\n');

            // If HEAD is not a baseline commit, nothing to squash here
            const headSubject = commits[0].split('|')[1];
            if (!headSubject.startsWith('baseline:')) {
                console.log(`[SKIP] ${repoName}: HEAD is not a baseline commit.`);
                continue;
            }

            let targetHash = null;
            const baselineCommits: string[] = [];

            for (const line of commits) {
                const [hash, subject] = line.split('|');
                if (subject.startsWith('baseline:')) {
                    baselineCommits.push(hash);
                } else {
                    targetHash = hash;
                    break;
                }
            }

            if (!targetHash) {
                console.log(`[SKIP] ${repoName}: Could not find a non-baseline ancestor in the last 50 commits.`);
                continue;
            }

            console.log(`--- Finalizing ${repoName} ---`);
            console.log(`Found ${baselineCommits.length} baseline commits to squash. Target ancestor: ${targetHash}`);

            // Get tags pointing to the baseline commits to clean them up
            for (const hash of baselineCommits) {
                try {
                    const tagOutput = execSync(`git tag --points-at ${hash}`, { cwd: repoPath, stdio: 'pipe' }).toString().trim();
                    if (tagOutput) {
                        const tags = tagOutput.split('\n');
                        for (const tag of tags) {
                            if (tag.startsWith('alamo-')) {
                                console.log(`[GIT] Deleting baseline tag ${tag}...`);
                                execSync(`git tag -d "${tag}"`, { cwd: repoPath, stdio: 'pipe' });
                            }
                        }
                    }
                } catch (tagErr) {
                    // Ignore errors if tags can't be fetched/deleted
                }
            }

            // Perform soft reset to targetHash
            console.log(`[GIT] Soft resetting to ${targetHash}...`);
            execSync(`git reset --soft ${targetHash}`, { cwd: repoPath, stdio: 'pipe' });

            console.log(`[SUCCESS] ${repoName} finalized.`);
            processedCount++;
        } catch (error: any) {
            console.error(`[ERROR] Failed to finalize ${repoName}: ${error.message}`);
        }
    }

    console.log(`\n======================================================================`);
    console.log(`🏰 FINALIZATION COMPLETE: Processed and squashed ${processedCount} repositories.`);
    console.log(`======================================================================`);
}

main().catch(err => {
    console.error("Finalize script failed:", err);
    process.exit(1);
});