import fs from 'fs';
import path from 'path';

interface Validation {
  id: string;
  feature: string;
  title: string;
  tag: string;
  status: 'PENDING' | 'PASS' | 'FAIL' | 'PARKED';
  instructions: string;
  expectedResult: string;
  lastUpdated: string;
  workspaceId: string;
  group: string;
  sequence: number;
}

export class ValidationScanner {
  private baseDirs: string[];

  constructor() {
    this.baseDirs = [
      path.join(process.cwd(), 'docs/validation-plans'),
      '/home/heidless/projects/Persona/docs/validation-plans'
    ];
  }

  /**
   * Primary scan method for the Sovereign Validation Backlog.
   * Uses the full-conversation-audit.md as the source of truth.
   */
  public async scanAll(workspaceId: string = 'stillwater-suite'): Promise<Validation[]> {
    const validations: Validation[] = [];
    const validationDir = path.join(process.cwd(), 'docs/validation-plans');
    
    if (!fs.existsSync(validationDir)) return [];

    const files = fs.readdirSync(validationDir).filter(f => f.endsWith('.md'));
    let globalSequence = 0;

    for (const file of files) {
      const auditPlanPath = path.join(validationDir, file);
      const content = fs.readFileSync(auditPlanPath, 'utf-8');
      const stats = fs.statSync(auditPlanPath);
      
      // Split by horizontal rules (---) which define our temporal boundaries
      const sections = content.split(/\n---\n/).filter(s => s.trim().length > 0);
      
      sections.forEach((sectionRaw, sIndex) => {
        const section = sectionRaw.trim();
        const lines = section.split('\n');
      
      // Find the module header
      const headerLine = lines.find(l => l.trim().startsWith('## '));
      if (!headerLine) return;

      const featureModule = headerLine.trim().replace(/^## /, '').replace(/[^\w\s&]/g, '').trim();
      
      // Look for the temporal marker
      const timeMatch = section.match(/<!-- Updated: (.*?) -->/);
      const lastUpdated = timeMatch ? timeMatch[1] : stats.mtime.toISOString();

      // Split by test titles (###) - correctly ignore the text before the first ###
      const testChunks = section.split(/\n### /);
      testChunks.shift(); // Remove the part before the first ### (contains the ## header)
      
      testChunks.forEach((test) => {
        const testLines = test.split('\n');
        const testTitle = testLines[0].trim();
        if (!testTitle) return;
        
        const tasks = testLines.filter(l => 
          l.trim().startsWith('- [ ]') || 
          l.trim().startsWith('- [x]')
        );

        tasks.forEach((task) => {
          const taskClean = task.replace(/^- \[[ x]\] /, '').replace(/^\d+\. /, '').replace(/\*\*Verification\*\*:\s*/i, '').trim();
          if (!taskClean) return;

          const id = this.generateId(testTitle, taskClean);
          const tagMatch = testTitle.match(/^\[(.*?)\]/);
          const tag = tagMatch ? tagMatch[1] : featureModule;

          validations.push({
            id,
            feature: featureModule,
            title: testTitle.replace(/^\[.*?\]\s*/, '').trim(),
            tag: tag,
            status: task.includes('[x]') ? 'PASS' : 'PENDING',
            instructions: taskClean,
            expectedResult: 'System state matches architectural protocol.',
            lastUpdated,
            workspaceId,
            group: featureModule,
            sequence: globalSequence++
          });
        });
      });
      });
    }

    return validations;
  }

  public async hardDelete(id: string, workspaceId: string = 'stillwater-suite'): Promise<boolean> {
    const validationDir = path.join(process.cwd(), 'docs/validation-plans');
    if (!fs.existsSync(validationDir)) return false;

    const files = fs.readdirSync(validationDir).filter(f => f.endsWith('.md'));

    for (const file of files) {
      const auditPlanPath = path.join(validationDir, file);
      const content = fs.readFileSync(auditPlanPath, 'utf-8');
      
      // Split by horizontal rules
      const sections = content.split(/\n---\n/);
      
      for (let sIndex = 0; sIndex < sections.length; sIndex++) {
        const section = sections[sIndex].trim();
        const lines = section.split('\n');
        
        // Find module header
        const headerLine = lines.find(l => l.trim().startsWith('## '));
        if (!headerLine) continue;
        
        const testChunks = section.split(/\n### /);
        const headerPart = testChunks[0]; // Part before the first ###
        const tests = testChunks.slice(1);
        
        let targetTestIndex = -1;
        let targetTaskLine = '';
        
        for (let tIndex = 0; tIndex < tests.length; tIndex++) {
          const test = tests[tIndex];
          const testLines = test.split('\n');
          const testTitle = testLines[0].trim();
          
          const tasks = testLines.filter(l => 
            l.trim().startsWith('- [ ]') || 
            l.trim().startsWith('- [x]')
          );
          
          for (const task of tasks) {
            const taskClean = task.replace(/^- \[[ x]\] /, '').replace(/^\d+\. /, '').replace(/\*\*Verification\*\*:\s*/i, '').trim();
            const computedId = this.generateId(testTitle, taskClean);
            
            if (computedId === id) {
              targetTestIndex = tIndex;
              targetTaskLine = task;
              break;
            }
          }
          if (targetTestIndex !== -1) break;
        }
        
        if (targetTestIndex !== -1) {
          const targetTestRaw = tests[targetTestIndex];
          const testLines = targetTestRaw.split('\n');
          const remainingTasks = testLines.filter(l => 
            (l.trim().startsWith('- [ ]') || l.trim().startsWith('- [x]')) && l.trim() !== targetTaskLine.trim()
          );
          
          let updatedSection = '';
          if (remainingTasks.length > 0) {
            // Keep the ### block, just remove the task line
            const updatedTestLines = testLines.filter(l => l.trim() !== targetTaskLine.trim());
            tests[targetTestIndex] = updatedTestLines.join('\n');
            updatedSection = [headerPart, ...tests].join('\n### ');
          } else {
            // Remove the entire ### block
            tests.splice(targetTestIndex, 1);
            if (tests.length > 0) {
              updatedSection = [headerPart, ...tests].join('\n### ');
            } else {
              // No tests left in this entire section!
              sections.splice(sIndex, 1);
              const updatedContent = sections.join('\n---\n');
              fs.writeFileSync(auditPlanPath, updatedContent, 'utf-8');
              return true;
            }
          }
          
          sections[sIndex] = updatedSection;
          const updatedContent = sections.join('\n---\n');
          fs.writeFileSync(auditPlanPath, updatedContent, 'utf-8');
          return true;
        }
      }
    }
    return false;
  }

  private generateId(title: string, instructions: string): string {
    const content = `${title}-${instructions}`;
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `VAL_${Math.abs(hash).toString(36).toUpperCase()}`;
  }
}

export const validationScanner = new ValidationScanner();
