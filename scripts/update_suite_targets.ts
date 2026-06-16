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
  const apps = JSON.parse(JSON.stringify(data?.apps || {}));

  // Update promptresources
  if (apps.promptresources) {
    apps.promptresources.environments.production.hostingTarget = 'stillwater-prompt-resources';
    apps.promptresources.environments.production.deployUrl = 'https://stillwater-prompt-resources-02.web.app';
    console.log("Updated promptresources in memory.");
  }

  // Update prompttool
  if (apps.prompttool) {
    apps.prompttool.environments.production.hostingTarget = 'stillwater-prompt-tool';
    apps.prompttool.environments.production.deployUrl = 'https://stillwater-prompt-tool-02.web.app';
    console.log("Updated prompttool in memory.");
  }

  // Update ag-video-system
  if (apps['ag-video-system']) {
    apps['ag-video-system'].environments.production.hostingTarget = 'stillwater-video-system';
    apps['ag-video-system'].environments.production.deployUrl = 'https://stillwater-video-system-02.web.app';
    apps['ag-video-system'].environments.production.deployMethod = 'cloud-build';
    console.log("Updated ag-video-system in memory.");
  }

  // Update promptmasterspa
  if (apps.promptmasterspa) {
    apps.promptmasterspa.environments.production.hostingTarget = 'stillwater-prompt-master';
    apps.promptmasterspa.environments.production.deployUrl = 'https://stillwater-prompt-master-02.web.app';
    console.log("Updated promptmasterspa in memory.");
  }

  // Update promptaccreditation
  if (apps.promptaccreditation) {
    apps.promptaccreditation.environments.production.hostingTarget = 'stillwater-prompt-accreditation';
    apps.promptaccreditation.environments.production.deployUrl = 'https://stillwater-prompt-accreditation-02.web.app';
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
    apps.persona.environments.production.deployUrl = 'https://stillwater-persona-02.web.app';
    console.log("Updated persona in memory.");
  }

  // Update plantune
  if (apps.plantune) {
    apps.plantune.environments.production.hostingTarget = 'stillwater-plan-tune';
    apps.plantune.environments.production.deployUrl = 'https://stillwater-plan-tune-02.web.app';
    console.log("Updated plantune in memory.");
  }

  // Update urlshortener
  if (!apps.urlshortener) {
    apps.urlshortener = {
      path: "~/projects/URLShortener",
      database: "urlshortener-db-0",
      displayName: "URLShortener v1.0",
      project: "stillwater-sovereign-01",
      environments: {
        dev: {
          lastDeployAt: null,
          deployMethod: "cloud-build",
          hostingTarget: null,
          status: "not-configured"
        },
        staging: {
          lastDeployAt: null,
          deployMethod: "cloud-build",
          hostingTarget: null,
          status: "not-configured"
        },
        production: {
          lastDeployAt: null,
          status: "live",
          deployMethod: "cloud-build",
          hostingTarget: "stillwater-url-shortener",
          deployUrl: "https://stillwater-url-shortener-02.web.app"
        }
      }
    };
  } else {
    if (!apps.urlshortener.environments) apps.urlshortener.environments = {};
    if (!apps.urlshortener.environments.production) apps.urlshortener.environments.production = {};
    apps.urlshortener.environments.production.hostingTarget = 'stillwater-url-shortener';
    apps.urlshortener.environments.production.deployUrl = 'https://stillwater-url-shortener-02.web.app';
    apps.urlshortener.environments.production.status = 'live';
  }
  console.log("Updated urlshortener in memory.");

  // Update tokenmarket
  if (apps.tokenmarket) {
    if (!apps.tokenmarket.environments) apps.tokenmarket.environments = {};
    if (!apps.tokenmarket.environments.production) apps.tokenmarket.environments.production = {};
    apps.tokenmarket.environments.production.hostingTarget = 'stillwater-token-market';
    apps.tokenmarket.environments.production.deployUrl = 'https://stillwater-token-market-02.web.app';
    console.log("Updated tokenmarket in memory.");
  }

  // Update Firestore
  await suiteRef.update({ apps });
  console.log("🟢 Firestore 'stillwater-suite' apps configuration updated successfully!");
}

main().catch(console.error);
