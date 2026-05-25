import dotenv from 'dotenv';
dotenv.config();

import { suiteDb } from '../server/services/FirebaseAdmin';

async function main() {
  const suiteRef = suiteDb.collection('suites').doc('stillwater-suite');
  const doc = await suiteRef.get();
  
  if (!doc.exists) {
    console.error("stillwater-suite doc does not exist!");
    return;
  }

  const data = doc.data();
  const apps = { ...data?.apps };

  // Update promptresources
  if (apps.promptresources) {
    apps.promptresources.environments.production.hostingTarget = 'stillwater-prompt-resources';
    apps.promptresources.environments.production.deployUrl = 'https://stillwater-prompt-resources.web.app';
    console.log("Updated promptresources in memory.");
  }

  // Update prompttool
  if (apps.prompttool) {
    apps.prompttool.environments.production.hostingTarget = 'stillwater-prompt-tool';
    apps.prompttool.environments.production.deployUrl = 'https://stillwater-prompt-tool.web.app';
    console.log("Updated prompttool in memory.");
  }

  // Update promptmasterspa
  if (apps.promptmasterspa) {
    apps.promptmasterspa.environments.production.hostingTarget = 'stillwater-prompt-master';
    apps.promptmasterspa.environments.production.deployUrl = 'https://stillwater-prompt-master.web.app';
    console.log("Updated promptmasterspa in memory.");
  }

  // Update promptaccreditation
  if (apps.promptaccreditation) {
    apps.promptaccreditation.environments.production.hostingTarget = 'stillwater-prompt-accreditation';
    apps.promptaccreditation.environments.production.deployUrl = 'https://stillwater-prompt-accreditation.web.app';
    console.log("Updated promptaccreditation in memory.");
  }

  // Update suiteutils
  if (apps.suiteutils) {
    apps.suiteutils.environments.production.hostingTarget = 'stillwater-suite-utils';
    apps.suiteutils.environments.production.deployUrl = 'https://stillwater-suite-utils.web.app';
    console.log("Updated suiteutils in memory.");
  }

  // Update persona
  if (apps.persona) {
    apps.persona.environments.production.hostingTarget = 'stillwater-persona';
    apps.persona.environments.production.deployUrl = 'https://stillwater-persona.web.app';
    console.log("Updated persona in memory.");
  }

  // Update plantune
  if (apps.plantune) {
    apps.plantune.environments.production.hostingTarget = null;
    apps.plantune.environments.production.deployUrl = 'https://plantune-850624280491.us-central1.run.app';
    console.log("Updated plantune in memory.");
  }

  // Update Firestore
  await suiteRef.update({ apps });
  console.log("🟢 Firestore 'stillwater-suite' apps configuration updated successfully!");
}

main().catch(console.error);
