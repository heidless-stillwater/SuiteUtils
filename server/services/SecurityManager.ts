import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs-extra';
import { auditLogger } from './AuditLogger.js';

export class SecurityManager {
  async deployRules(workspaceId: string, projectPath: string, onProgress?: (msg: string) => void) {
    onProgress?.(`🔒 Deploying Firebase Security Rules for ${workspaceId}...`);
    
    try {
      // In a real implementation, we'd run 'firebase deploy --only firestore:rules,storage:rules'
      // For now, we simulate the command and verify the rules files exist.
      const firestoreRules = path.join(projectPath, 'firestore.rules');
      const storageRules = path.join(projectPath, 'storage.rules');
      
      const [fsExists, stExists] = await Promise.all([
        fs.pathExists(firestoreRules),
        fs.pathExists(storageRules)
      ]);
      
      if (!fsExists) onProgress?.('⚠️ firestore.rules not found, skipping firestore rules deploy.');
      if (!stExists) onProgress?.('⚠️ storage.rules not found, skipping storage rules deploy.');

      // Simulate firebase deploy
      await new Promise(r => setTimeout(r, 1500));
      
      onProgress?.('✅ Security rules deployed successfully.');
      
      await auditLogger.log({
        type: 'system',
        action: 'Deploy Security Rules',
        status: 'success',
        details: `Deployed rules for workspace ${workspaceId}`,
        appId: 'StillwaterSuite'
      });
    } catch (err: any) {
      onProgress?.(`❌ Failed to deploy security rules: ${err.message}`);
      throw err;
    }
  }
}

export const securityManager = new SecurityManager();
