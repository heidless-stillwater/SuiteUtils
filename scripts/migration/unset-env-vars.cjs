const fs = require('fs');
const path = require('path');

const dir = '/home/heidless/projects/SuiteUtils';
const files = [
  'accreditation-ctl.sh',
  'master-ctl.sh',
  'persona-ctl.sh',
  'plantune-ctl.sh',
  'prompttool-ctl.sh',
  'resources-ctl.sh',
  'tokenmarket-ctl.sh',
  'urlshortener-ctl.sh',
  'utils-ctl.sh',
  'video-ctl.sh',
  'suite-ctl.sh',
  'suite-watchdog.sh'
];

console.log("🛠️  Unsetting leaked environment project variables in control scripts...");

for (const file of files) {
  const filePath = path.join(dir, file);
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('unset GOOGLE_CLOUD_PROJECT')) {
    console.log(`   ℹ️  ${file} already updated.`);
    continue;
  }

  content = content.replace(
    '#!/bin/bash',
    `#!/bin/bash\n# Unset leaked environment project variables to force loading from active config (.env)\nunset GOOGLE_CLOUD_PROJECT\nunset CLOUDSDK_CORE_PROJECT`
  );

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`   ✅ Patched ${file}`);
}

console.log("✨ Done unsetting environment variables!");
