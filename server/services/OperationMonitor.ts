import { EventEmitter } from 'events';

export interface ActiveOperation {
  id: string;
  type: 'backup' | 'release' | 'restore';
  status: 'running' | 'completed' | 'failed' | 'queued';
  progress: number;
  message: string;
  startTime: string;
  appId?: string;
  metadata?: any;
}

export class OperationMonitor extends EventEmitter {
  private activeOperations: Map<string, ActiveOperation> = new Map();
  private controllers: Map<string, AbortController> = new Map();
  private queue: Array<{ id: string; start: () => Promise<void> }> = [];

  updateOperation(id: string, update: Partial<ActiveOperation>, controller?: AbortController) {
    if (controller) this.controllers.set(id, controller);

    const existing = this.activeOperations.get(id);
    
    // If it's already terminal, don't allow further updates (e.g. from a still-running orchestrator)
    if (existing && (existing.status === 'completed' || existing.status === 'failed')) {
      return;
    }

    const base = existing || {
      id,
      type: 'backup',
      status: 'running',
      progress: 0,
      message: 'Initializing...',
      startTime: new Date().toISOString()
    };
    
    const updated = { ...base, ...update } as ActiveOperation;
    
    if (updated.status === 'completed' || updated.status === 'failed') {
      this.controllers.delete(id);
      this.activeOperations.set(id, updated);
      
      // When an operation finishes, check if we can start something from the queue
      this.processQueue();
      
      // Keep completed operations for 30 seconds so the UI can show "Done"
      setTimeout(() => {
        // Only delete if it's still this terminal status (sanity check)
        const current = this.activeOperations.get(id);
        if (current && (current.status === 'completed' || current.status === 'failed')) {
          this.activeOperations.delete(id);
        }
      }, 30000);
    } else {
      this.activeOperations.set(id, updated);
    }

    this.emit('update', updated);
    this.emit(`update:${id}`, updated);
  }

  registerController(id: string, controller: AbortController) {
    this.controllers.set(id, controller);
  }

  enqueue(id: string, start: () => Promise<void>, metadata?: any, controller?: AbortController) {
    if (controller) this.controllers.set(id, controller);
    this.updateOperation(id, { status: 'queued', message: 'Waiting for conflicting operation...', metadata });
    this.queue.push({ id, start });
  }

  private async processQueue() {
    if (this.queue.length === 0) return;

    // Check if any queued operation can now run
    for (let i = 0; i < this.queue.length; i++) {
      const item = this.queue[i];
      const op = this.activeOperations.get(item.id);
      if (!op) continue;

      const conflict = this.findIdenticalOperation(op.type, op.metadata, item.id);
      if (!conflict) {
        // No conflict anymore! Start it.
        this.queue.splice(i, 1);
        this.updateOperation(item.id, { status: 'running', message: 'Starting from queue...' });
        item.start().catch(err => {
          this.updateOperation(item.id, { status: 'failed', message: err.message });
        });
        break; // Process one at a time or loop again
      }
    }
  }

  cancelOperation(id: string) {
    const controller = this.controllers.get(id);
    if (controller) {
      controller.abort();
      this.controllers.delete(id);
      this.updateOperation(id, { status: 'failed', message: 'Cancelled by user' });
    } else {
      // Check if it's in queue
      const qIdx = this.queue.findIndex(item => item.id === id);
      if (qIdx !== -1) {
        this.queue.splice(qIdx, 1);
        this.updateOperation(id, { status: 'failed', message: 'Cancelled while in queue' });
      }
    }
  }

  findIdenticalOperation(type: string, metadata: any, excludeId?: string): ActiveOperation | null {
    if (!metadata) return null;

    const ops = this.getOperations();
    return ops.find(op => 
      op.id !== excludeId &&
      op.type === type && 
      op.status === 'running' &&
      op.metadata?.scope === metadata.scope
    ) || null;
  }

  getOperations(): ActiveOperation[] {
    return Array.from(this.activeOperations.values());
  }
}

export const operationMonitor = new OperationMonitor();
