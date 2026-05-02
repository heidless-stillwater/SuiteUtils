
import fs from 'fs';
import path from 'path';

const appsRoot = '/home/heidless/projects';

function walk(dir, callback) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach( f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
  });
}

async function fixAPIs(appName) {
  const apiPath = path.join(appsRoot, appName, 'src/app/api');
  console.log(`--- Hardening API routes for ${appName} ---`);
  if (!fs.existsSync(apiPath)) {
    console.log('No api directory found.');
    return;
  }

  walk(apiPath, (filePath) => {
    if (filePath.endsWith('route.ts') || filePath.endsWith('route.js')) {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Remove conflicting exports
      content = content.replace(/export const runtime = ['"]edge['"];?/g, '');
      content = content.replace(/export const dynamic = ['"]force-dynamic['"];?/g, '');
      
      if (!content.includes('export const dynamic')) {
        content = `export const dynamic = "force-static";\n${content}`;
      }
      
      fs.writeFileSync(filePath, content);
      console.log(`Aligned: ${filePath}`);
    }
  });
}

// Run for both
await fixAPIs('PlanTune');
await fixAPIs('PromptAccreditation');
