import fs from 'fs-extra';
import path from 'path';
import os from 'os';

export async function getTargetPaths(): Promise<string[]> {
    let paths: string[] = [];
    try {
        const { suiteDb } = await import('../../server/services/FirebaseAdmin.js');
        const doc = await suiteDb.collection('suites').doc('stillwater-suite').get();
        const data = doc.data();
        
        if (data && data.apps) {
            for (const [key, app] of Object.entries(data.apps as Record<string, any>)) {
                let appPath = app.path;
                if (!appPath) {
                    const knownMap: Record<string, string> = {
                        'promptresources': 'PromptResources',
                        'prompttool': 'PromptTool',
                        'promptmasterspa': 'PromptMasterSPA',
                        'promptaccreditation': 'PromptAccreditation',
                        'suiteutils': 'SuiteUtils',
                        'persona': 'Persona',
                        'plantune': 'PlanTune',
                        'urlshortener': 'URLShortener'
                    };
                    const dirName = knownMap[key] || key;
                    appPath = `~/projects/${dirName}`;
                }
                paths.push(appPath.replace(/^~/, os.homedir()));
            }
            return paths;
        }
    } catch (err: any) {
        // Silently fallback if Firebase fails
    }

    const baseDir = path.join(os.homedir(), 'projects');
    const knownDirs = ['PromptResources', 'PromptTool', 'PromptMasterSPA', 'PromptAccreditation', 'SuiteUtils', 'Persona', 'PlanTune', 'URLShortener'];
    paths = knownDirs.map(d => path.join(baseDir, d));
    return paths;
}
