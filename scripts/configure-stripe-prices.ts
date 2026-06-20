import * as fs from 'fs';
import * as path from 'path';

const PROJECTS_DIR = '/home/heidless/projects';

// The 10 applications and their active env filenames from switch-env.sh
const APPS = [
    { name: 'ag-video-system', envFile: '.env.local' },
    { name: 'PromptTool', envFile: '.env.local' },
    { name: 'PromptResources', envFile: '.env.local' },
    { name: 'PromptMasterSPA', envFile: '.env.local' },
    { name: 'PromptAccreditation', envFile: '.env.local' },
    { name: 'PlanTune', envFile: '.env.local' },
    { name: 'SuiteUtils', envFile: '.env' },
    { name: 'Persona', envFile: '.env.local' },
    { name: 'URLShortener', envFile: '.env.local' },
    { name: 'TokenMarket', envFile: '.env' }
];

const STRIPE_VARIABLES: Record<string, string> = {
    VITE_STRIPE_PRICE_TM_STANDARD: 'price_1TokenMarketStandardDummy',
    VITE_STRIPE_PRICE_TM_PRO: 'price_1TokenMarketProDummy',
    VITE_STRIPE_PRICE_TM_BUNDLE_10K: 'price_1TokenMarketBundle10kDummy',
    VITE_STRIPE_PRICE_TM_BUNDLE_50K: 'price_1TokenMarketBundle50kDummy',
    VITE_STRIPE_PRICE_TM_BUNDLE_250K: 'price_1TokenMarketBundle250kDummy',
    VITE_STRIPE_PRICE_STANDARD: 'price_1SuiteStandardDummy',
    VITE_STRIPE_PRICE_PRO: 'price_1SuiteProDummy',
    VITE_STRIPE_PRICE_ENTERPRISE: 'price_1SuiteEnterpriseDummy'
};

function updateEnvFile(filePath: string) {
    if (!fs.existsSync(filePath)) {
        return;
    }

    console.log(`Updating ${filePath}...`);
    let content = fs.readFileSync(filePath, 'utf-8');
    let modified = false;

    // Check each variable
    for (const [key, defaultValue] of Object.entries(STRIPE_VARIABLES)) {
        const regex = new RegExp(`^${key}=.*`, 'm');
        if (regex.test(content)) {
            // Variable already exists, do not overwrite
            continue;
        }
        
        // Append variable to the end of the file
        if (!content.endsWith('\n') && content.length > 0) {
            content += '\n';
        }
        content += `${key}=${defaultValue}\n`;
        modified = true;
    }

    if (modified) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`Saved updates to ${filePath}`);
    } else {
        console.log(`No changes needed for ${filePath}`);
    }
}

function main() {
    for (const app of APPS) {
        const appDir = path.join(PROJECTS_DIR, app.name);
        if (!fs.existsSync(appDir)) {
            console.log(`Skipping non-existent project directory: ${appDir}`);
            continue;
        }

        const envFiles = [
            app.envFile,
            `${app.envFile}.sovereign-01`,
            `${app.envFile}.sovereign-02`
        ];

        for (const file of envFiles) {
            const filePath = path.join(appDir, file);
            updateEnvFile(filePath);
        }
    }
    console.log('Stripe pricing configuration complete!');
}

main();
