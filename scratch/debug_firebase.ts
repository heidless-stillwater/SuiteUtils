
import { spawn } from 'child_process';
import path from 'path';

const projectPath = '/home/heidless/projects/PlanTune';

function runCommand(cmd, args) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { cwd: projectPath, shell: true });
    let output = '';
    proc.stdout.on('data', d => output += d.toString());
    proc.stderr.on('data', d => output += d.toString());
    proc.on('close', code => resolve({ code, output }));
  });
}

async function debugDeploy() {
  console.log('--- Checking Current Project ---');
  const projectCheck = await runCommand('firebase', ['use']);
  console.log(projectCheck.output);

  console.log('\n--- Listing All Hosting Sites ---');
  const sitesCheck = await runCommand('firebase', ['hosting:sites:list']);
  console.log(sitesCheck.output);
}

debugDeploy();
