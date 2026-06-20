
import { spawn } from 'child_process';

async function createPlanTuneSite() {
  console.log('--- Creating PlanTune Hosting Site ---');
  const proc = spawn('firebase', ['hosting:sites:create', 'plantune-v0', '--project', 'heidless-apps-0'], { shell: true });
  
  proc.stdout.on('data', d => process.stdout.write(d));
  proc.stderr.on('data', d => process.stderr.write(d));
  
  proc.on('close', code => {
    if (code === 0) {
      console.log('\n✅ Successfully created plantune-v0 hosting site.');
    } else {
      console.error(`\n❌ Failed to create site (Exit Code: ${code})`);
    }
  });
}

createPlanTuneSite();
