import { useState, useEffect, useRef } from 'react';
import { Server, Activity, Database, CheckCircle2, Play, Square, Loader2, Download, Trash2, ShieldCheck, ToggleLeft, ToggleRight, X, Maximize2, Terminal } from 'lucide-react';
import { inferenceDb } from '../lib/inference-firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { API_URL } from '../lib/api-config';

interface InferenceConfig {
  activeSource: 'localhost' | 'gcp';
  gcpEndpoint: string;
  gcpHardware: string;
  vmStatus: 'RUNNING' | 'STOPPED';
  enabledModels: string[];
}

interface ModelRegistry {
  catalog: {
    name: string;
    tags: string[];
    size: string;
    description: string;
  }[];
}

interface InstalledModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    parameter_size: string;
    quantization_level: string;
  };
}

interface LogStep {
  name: string;
  command: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'WARNING';
  duration: number;
  output?: string;
}

const getModelGpuRequirements = (modelName: string) => {
  const nameLower = modelName.toLowerCase();
  if (nameLower.includes('70b')) {
    return {
      minGpu: 'l4',
      minGpuLabel: 'NVIDIA L4 (24GB VRAM)',
      label: 'NVIDIA L4 Required'
    };
  } else if (
    nameLower.includes('8b') || 
    nameLower.includes('7b') || 
    nameLower.includes('9b') || 
    nameLower.includes('mistral') || 
    nameLower.includes('qwen')
  ) {
    return {
      minGpu: 't4',
      minGpuLabel: 'NVIDIA Tesla T4 (16GB VRAM)',
      label: 'NVIDIA T4 Required'
    };
  } else {
    return {
      minGpu: 'none',
      minGpuLabel: 'CPU Only',
      label: 'CPU Suitable'
    };
  }
};

const checkGpuSuitability = (modelName: string, activeHardware: string) => {
  const nameLower = modelName.toLowerCase();
  if (nameLower.includes('gemini') || nameLower.includes('gpt-') || nameLower.includes('claude') || nameLower.includes('deepseek')) {
    return {
      minGpu: 'none',
      minGpuLabel: 'N/A',
      label: 'Cloud Suitable',
      isSuitable: true,
      statusText: 'Suitable (Cloud)',
      badgeColor: 'bg-green-500/10 text-green-400 border-green-500/20'
    };
  }
  const req = getModelGpuRequirements(modelName);
  const activeLower = activeHardware ? activeHardware.toLowerCase() : 'cpu';
  
  let activeGpu: 'l4' | 't4' | 'none' = 'none';
  if (activeLower.includes('l4')) activeGpu = 'l4';
  else if (activeLower.includes('t4') || activeLower.includes('tesla')) activeGpu = 't4';
  
  let isSuitable = false;
  let statusText = '';
  let badgeColor = '';
  
  if (req.minGpu === 'l4') {
    if (activeGpu === 'l4') {
      isSuitable = true;
      statusText = 'Suitable (L4 Running)';
      badgeColor = 'bg-green-500/10 text-green-400 border-green-500/20';
    } else {
      isSuitable = false;
      statusText = `Unsuitable (L4 Required)`;
      badgeColor = 'bg-red-500/10 text-red-400 border-red-500/20';
    }
  } else if (req.minGpu === 't4') {
    if (activeGpu === 'l4' || activeGpu === 't4') {
      isSuitable = true;
      statusText = `Suitable (${activeGpu === 'l4' ? 'L4' : 'T4'} Running)`;
      badgeColor = 'bg-green-500/10 text-green-400 border-green-500/20';
    } else {
      isSuitable = false;
      statusText = `Unsuitable (T4/L4 Required)`;
      badgeColor = 'bg-red-500/10 text-red-400 border-red-500/20';
    }
  } else {
    if (activeGpu !== 'none') {
      isSuitable = true;
      statusText = `Suitable (GPU Accelerated)`;
      badgeColor = 'bg-green-500/10 text-green-400 border-green-500/20';
    } else {
      isSuitable = true;
      statusText = 'Suitable (CPU)';
      badgeColor = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    }
  }
  
  return { ...req, isSuitable, statusText, badgeColor };
};

export function InferenceAdminPage() {
  const [config, setConfig] = useState<InferenceConfig | null>(null);
  const [registry, setRegistry] = useState<ModelRegistry | null>(null);
  const [installedModels, setInstalledModels] = useState<InstalledModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPulling, setIsPulling] = useState<string | null>(null);
  const [pullProgress, setPullProgress] = useState<Record<string, { pct: number; status: string; completed?: number; total?: number }>>({});
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [showStartConfirm, setShowStartConfirm] = useState(false);
  const [isEditingEndpoint, setIsEditingEndpoint] = useState(false);
  const [endpointInput, setEndpointInput] = useState('');
  const [activeLog, setActiveLog] = useState<{
    action: 'START' | 'STOP';
    progress: number;
    elapsed: number;
    gpuType?: string;
    steps: LogStep[];
  } | null>(null);
  const [persistedLog, setPersistedLog] = useState<{
    action: 'START' | 'STOP';
    progress: number;
    elapsed: number;
    gpuType?: string;
    steps: LogStep[];
  } | null>(() => {
    const saved = sessionStorage.getItem('gcp_vm_execution_log');
    return saved ? JSON.parse(saved) : null;
  });
  const [isLogCollapsed, setIsLogCollapsed] = useState(false);
  const [copiedLogs, setCopiedLogs] = useState(false);
  const [isVmControlCollapsed, setIsVmControlCollapsed] = useState(true);
  const [isActiveSourceCollapsed, setIsActiveSourceCollapsed] = useState(true);
  const [showLogModal, setShowLogModal] = useState(false);
  const [autoScrollLogs, setAutoScrollLogs] = useState(true);
  const modalLogRef = useRef<HTMLDivElement | null>(null);

  // Scroll modal logs to bottom
  useEffect(() => {
    if (autoScrollLogs && modalLogRef.current) {
      modalLogRef.current.scrollTop = modalLogRef.current.scrollHeight;
    }
  }, [persistedLog, autoScrollLogs, showLogModal]);

  const [billingInfo, setBillingInfo] = useState<{ tier: string; quotas: Record<string, string> } | null>(null);
  const [loadingBilling, setLoadingBilling] = useState(false);

  const fetchBillingInfo = async (refresh = false) => {
    setLoadingBilling(true);
    try {
      const res = await fetch(`${API_URL}/api/inference/billing${refresh ? '?refresh=true' : ''}`);
      if (res.ok) {
        const data = await res.json();
        setBillingInfo(data);
      }
    } catch (e) {
      console.error('Failed to fetch billing info', e);
    } finally {
      setLoadingBilling(false);
    }
  };

  useEffect(() => {
    fetchBillingInfo();
  }, []);

  // Subscribe to Firestore
  useEffect(() => {
    const unsubConfig = onSnapshot(doc(inferenceDb, 'admin', 'inferenceConfig'), (doc) => {
      if (doc.exists()) {
        setConfig(doc.data() as InferenceConfig);
      }
    });

    const unsubRegistry = onSnapshot(doc(inferenceDb, 'admin', 'modelRegistry'), (doc) => {
      if (doc.exists()) {
        setRegistry(doc.data() as ModelRegistry);
      }
      setLoading(false);
    });

    return () => {
      unsubConfig();
      unsubRegistry();
    };
  }, []);

  // Fetch installed models from the active source
  useEffect(() => {
    if (!config) return;

    const fetchModels = async () => {
      try {
        const endpoint = config.activeSource === 'localhost' ? 'http://localhost:11434' : config.gcpEndpoint;
        const res = await fetch(`${endpoint}/api/tags`);
        if (res.ok) {
          const data = await res.json();
          setInstalledModels(data.models || []);
        } else {
          setInstalledModels([]);
        }
      } catch (err) {
        console.error('Failed to fetch installed models:', err);
        setInstalledModels([]);
      }
    };

    fetchModels();
    const interval = setInterval(fetchModels, 5000);
    return () => clearInterval(interval);
  }, [config?.activeSource, config?.gcpEndpoint, config?.vmStatus]);

  const updateConfigInDb = async (updateData: Partial<InferenceConfig>) => {
    try {
      const res = await fetch(`${API_URL}/api/inference/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update config');
      }
    } catch (err: any) {
      console.error('Failed to update config:', err);
      alert(`Error updating configuration: ${err.message}`);
    }
  };

  const toggleSource = async () => {
    if (!config) return;
    const newSource = config.activeSource === 'localhost' ? 'gcp' : 'localhost';
    await updateConfigInDb({ activeSource: newSource });
  };

  const toggleModelEnable = async (modelName: string) => {
    if (!config) return;
    const isEnabled = config.enabledModels.includes(modelName);
    const newEnabled = isEnabled 
      ? config.enabledModels.filter(m => m !== modelName)
      : [...config.enabledModels, modelName];
      
    await updateConfigInDb({ enabledModels: newEnabled });
  };

  const pullModel = async (modelName: string) => {
    if (!config) return;
    setIsPulling(modelName);
    setPullProgress(prev => ({ ...prev, [modelName]: { pct: 0, status: 'Connecting...' } }));
    const endpoint = config.activeSource === 'localhost' ? 'http://localhost:11434' : config.gcpEndpoint;
    try {
      const res = await fetch(`${API_URL}/api/ollama/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelName, endpoint })
      });

      if (!res.ok || !res.body) {
        throw new Error(`Server returned ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop() || '';
        for (const part of parts) {
          const line = part.replace(/^data: /, '').trim();
          if (!line) continue;
          if (line === '[DONE]') break;
          try {
            const ev = JSON.parse(line);
            if (ev.error) {
              setPullProgress(prev => ({ ...prev, [modelName]: { pct: 0, status: `Error: ${ev.error}` } }));
              break;
            }
            if (ev.status === 'success') {
              setPullProgress(prev => ({ ...prev, [modelName]: { pct: 100, status: 'Done!' } }));
            } else if (ev.completed != null && ev.total != null && ev.total > 0) {
              const pct = Math.round((ev.completed / ev.total) * 100);
              setPullProgress(prev => ({
                ...prev,
                [modelName]: {
                  pct,
                  status: ev.status || 'Downloading...',
                  completed: ev.completed,
                  total: ev.total
                }
              }));
            } else if (ev.status) {
              setPullProgress(prev => ({
                ...prev,
                [modelName]: { ...(prev[modelName] || { pct: 0 }), status: ev.status }
              }));
            }
          } catch { /* ignore non-JSON lines */ }
        }
      }
    } catch (err) {
      console.error('Failed to pull model', err);
      setPullProgress(prev => ({ ...prev, [modelName]: { pct: 0, status: 'Failed — check console' } }));
    } finally {
      setIsPulling(null);
      // Clear progress after a short delay so user can see "Done!"
      setTimeout(() => setPullProgress(prev => {
        const next = { ...prev };
        delete next[modelName];
        return next;
      }), 3000);
    }
  };

  const deleteModel = async (modelName: string) => {
    if (!config) return;
    setIsDeleting(modelName);
    try {
      const endpoint = config.activeSource === 'localhost' ? 'http://localhost:11434' : config.gcpEndpoint;
      await fetch(`${endpoint}/api/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName })
      });
      setInstalledModels(prev => prev.filter(m => m.name !== modelName));
    } catch (err) {
      console.error('Failed to delete model', err);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleCopyLogs = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!persistedLog) return;
    
    const logsText = persistedLog.steps.map(s => {
      let line = `[${s.status}] ${s.name}`;
      if (s.command) line += `\n$ ${s.command}`;
      if (s.output) line += `\n${s.output}`;
      return line;
    }).join('\n\n');
    
    navigator.clipboard.writeText(logsText);
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  const saveEndpoint = async () => {
    if (!config) return;
    let sanitized = endpointInput.trim();
    sanitized = sanitized.replace(/^(https?:\/\/)+/i, 'http://');
    sanitized = sanitized.replace(/::+/g, ':');
    if (!/^https?:\/\//i.test(sanitized)) {
      sanitized = `http://${sanitized}`;
    }

    await updateConfigInDb({ gcpEndpoint: sanitized });
    setEndpointInput(sanitized);
    setIsEditingEndpoint(false);
  };

  const pollJobStatus = (action: 'START' | 'STOP') => {
    if ((window as any).inferencePollInterval) {
      clearInterval((window as any).inferencePollInterval);
    }
    
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/api/inference/deploy/status`);
        if (!res.ok) return;
        
        const data = await res.json();
        
        if (data.status === 'idle') {
          clearInterval(interval);
          setActiveLog(null);
          return;
        }
        
        const steps: LogStep[] = data.logs.map((logLine: string, idx: number) => {
          let stepStatus: LogStep['status'] = idx === data.logs.length - 1 && data.status === 'running' ? 'RUNNING' : 'COMPLETED';
          const lower = logLine.toLowerCase();
          if (lower.includes('error') || lower.includes('failed') || lower.includes('exception') || lower.includes('exit code')) {
            stepStatus = 'FAILED';
          } else if (lower.includes('warning') || lower.includes('warn') || lower.includes('deprecated')) {
            stepStatus = 'WARNING';
          }

          return {
            name: logLine,
            command: '',
            status: stepStatus,
            duration: 0,
            output: ''
          };
        });
        
        if (steps.length === 0) {
          steps.push({
            name: `${action === 'START' ? 'Initializing GCP deployment' : 'Stopping GCP VM'}...`,
            command: '',
            status: 'RUNNING',
            duration: 0
          });
        }
        
        let progress = 0;
        if (data.status === 'success' || data.status === 'failed') {
          progress = 100;
        } else {
          const estTotal = action === 'START' ? 60 : 15;
          progress = Math.min(95, Math.round((data.elapsed / estTotal) * 100));
        }
        
        const logData = {
          action: data.action,
          progress,
          elapsed: data.elapsed,
          gpuType: data.gpuType || 'none',
          steps
        };
        setActiveLog(logData);
        setPersistedLog(logData);
        sessionStorage.setItem('gcp_vm_execution_log', JSON.stringify(logData));
        
        if (data.status === 'success' || data.status === 'failed') {
          clearInterval(interval);
          setTimeout(() => {
            setActiveLog(null);
          }, 6000);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 1500);
    
    (window as any).inferencePollInterval = interval;
  };

  const runVmCommandSequence = async (action: 'START' | 'STOP') => {
    if (!config) return;

    try {
      const gpuArg = config.gcpHardware.includes('L4') ? 'l4' : config.gcpHardware.includes('T4') ? 't4' : 'none';
      
      const initLog = {
        action,
        progress: 0,
        elapsed: 0,
        gpuType: gpuArg,
        steps: [{
          name: `Requesting VM ${action} operation...`,
          command: '',
          status: 'RUNNING' as const,
          duration: 0
        }]
      };
      setActiveLog(initLog);
      setPersistedLog(initLog);
      sessionStorage.setItem('gcp_vm_execution_log', JSON.stringify(initLog));
      setIsLogCollapsed(false);

      const res = await fetch(`${API_URL}/api/inference/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, gpu: gpuArg })
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        alert(errorData.error || 'Failed to start VM command sequence');
        setActiveLog(null);
        return;
      }
      
      pollJobStatus(action);
    } catch (err: any) {
      console.error('Error starting VM deployment/control:', err);
      alert('Network error initiating action.');
      setActiveLog(null);
    }
  };

  useEffect(() => {
    const checkActiveJob = async () => {
      try {
        const res = await fetch(`${API_URL}/api/inference/deploy/status`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.logs && data.logs.length > 0) {
            const steps: LogStep[] = data.logs.map((logLine: string, idx: number) => {
              let stepStatus: LogStep['status'] = idx === data.logs.length - 1 && data.status === 'running' ? 'RUNNING' : 'COMPLETED';
              const lower = logLine.toLowerCase();
              if (lower.includes('error') || lower.includes('failed') || lower.includes('exception') || lower.includes('exit code')) {
                stepStatus = 'FAILED';
              } else if (lower.includes('warning') || lower.includes('warn') || lower.includes('deprecated')) {
                stepStatus = 'WARNING';
              }
              return {
                name: logLine,
                command: '',
                status: stepStatus,
                duration: 0,
                output: ''
              };
            });

            const progress = (data.status === 'success' || data.status === 'failed') ? 100 : 0;
            const logData = {
              action: data.action,
              progress,
              elapsed: data.elapsed,
              gpuType: data.gpuType || 'none',
              steps
            };
            
            setPersistedLog(logData);
            sessionStorage.setItem('gcp_vm_execution_log', JSON.stringify(logData));

            if (data.status === 'running') {
              pollJobStatus(data.action);
            }
          }
        }
      } catch (e) {
        console.error('Failed to fetch initial job status', e);
      }
    };
    checkActiveJob();
    
    return () => {
      if ((window as any).inferencePollInterval) {
        clearInterval((window as any).inferencePollInterval);
      }
    };
  }, []);

  const updateHardwareProfile = async (hardwareName: string) => {
    if (!config) return;
    await updateConfigInDb({ gcpHardware: hardwareName });
  };

  const getActiveModels = () => {
    if (!config || !registry) return [];
    
    const activeList = installedModels.map(model => ({
      name: model.name,
      isCloud: false,
      size: `${(model.size / 1024 / 1024 / 1024).toFixed(2)} GB`,
      params: model.details?.parameter_size || 'N/A',
      suitability: checkGpuSuitability(model.name, config.gcpHardware),
      isEnabled: config.enabledModels.includes(model.name)
    }));

    const enabledCloudModels = registry.catalog
      .filter(model => model.tags.includes('cloud') && config.enabledModels.includes(model.name))
      .map(model => ({
        name: model.name,
        isCloud: true,
        size: 'N/A',
        params: 'N/A',
        suitability: {
          badgeColor: 'bg-green-500/10 text-green-400 border-green-500/20',
          statusText: 'Suitable (Cloud)',
          minGpuLabel: 'N/A'
        },
        isEnabled: true
      }));

    return [...activeList, ...enabledCloudModels];
  };

  const activeModels = getActiveModels();

  if (loading || !config || !registry) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-white/90 mb-1">Inference Gateway</h1>
        <p className="text-white/40 text-sm">Manage local and cloud AI models across the Sovereign Suite.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Source Control */}
        <div className="glass-card-static p-5 space-y-4 h-fit">
          <div
            className="flex items-center justify-between border-b border-white/10 pb-3 cursor-pointer select-none"
            onClick={() => setIsActiveSourceCollapsed(!isActiveSourceCollapsed)}
          >
            <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2 hover:text-indigo-300 transition-colors">
              <Server className="w-4 h-4 text-primary" />
              <span>{isActiveSourceCollapsed ? '▶' : '▼'} Active Source</span>
            </h2>
            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
              <span className="text-[10px] font-bold text-white/40 uppercase">Localhost</span>
              <button onClick={toggleSource} className="text-primary hover:text-primary/80 transition-colors">
                {config.activeSource === 'gcp' ? (
                  <ToggleRight className="w-8 h-8" />
                ) : (
                  <ToggleLeft className="w-8 h-8" />
                )}
              </button>
              <span className="text-[10px] font-bold text-white/40 uppercase">GCP VM</span>
            </div>
          </div>

          {!isActiveSourceCollapsed && (
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-black/20 rounded-xl border border-white/5">
                <div className="flex-1 mr-4">
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">GCP Endpoint URL</p>
                  {isEditingEndpoint ? (
                    <div className="flex gap-2 mt-1">
                      <input
                        type="text"
                        value={endpointInput}
                        onChange={(e) => setEndpointInput(e.target.value)}
                        placeholder="http://<GCP_VM_IP>:11434"
                        className="bg-black/40 border border-white/10 rounded-lg px-2.5 py-1 text-xs font-mono text-white/90 flex-1 outline-none focus:border-indigo-500"
                      />
                      <button
                        onClick={saveEndpoint}
                        className="px-3 py-1 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 rounded-lg text-indigo-400 text-[10px] font-bold uppercase tracking-widest transition-all"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setIsEditingEndpoint(false)}
                        className="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/60 text-[10px] font-bold uppercase tracking-widest transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-mono text-white/90">
                        {config.activeSource === 'localhost' ? 'http://localhost:11434' : config.gcpEndpoint}
                      </span>
                      {config.activeSource === 'gcp' && (
                        <button
                          onClick={() => {
                            setEndpointInput(config.gcpEndpoint);
                            setIsEditingEndpoint(true);
                          }}
                          className="text-[10px] text-indigo-400 hover:underline font-bold"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className={cn(
                      "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                      config.activeSource === 'gcp' && config.vmStatus === 'STOPPED' ? "bg-red-400" : "bg-green-400"
                    )}></span>
                    <span className={cn(
                      "relative inline-flex rounded-full h-3 w-3",
                      config.activeSource === 'gcp' && config.vmStatus === 'STOPPED' ? "bg-red-500" : "bg-green-500"
                    )}></span>
                  </span>
                  <span className="text-xs text-white/60">
                    {config.activeSource === 'gcp' && config.vmStatus === 'STOPPED' ? 'Offline' : 'Online'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* GCP VM Lifecycle */}
        <div className="glass-card-static p-6 space-y-6 opacity-100 transition-opacity h-fit">
          <div 
            className="flex items-center justify-between border-b border-white/10 pb-4 cursor-pointer select-none"
            onClick={() => setIsVmControlCollapsed(!isVmControlCollapsed)}
          >
            <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2 hover:text-indigo-300 transition-colors">
              <Activity className="w-4 h-4 text-indigo-400" />
              <span>{isVmControlCollapsed ? '▶' : '▼'} GCP VM Control</span>
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono text-white/40 hidden sm:inline">{config.gcpHardware}</span>
              <span className={cn(
                "text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full border",
                config.vmStatus === 'RUNNING' ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-white/5 text-white/40 border-white/10"
              )}>
                {config.vmStatus}
              </span>
            </div>
          </div>

          {!isVmControlCollapsed && (
            <>
              <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <span className="text-xs text-white/60">Active Profile: <strong className="text-white/90">{config.gcpHardware}</strong></span>
            </div>

            {/* Hardware Profile Selector */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest block">
                  Select GPU / Hardware Profile
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-indigo-400">
                    GCP Tier: {billingInfo ? billingInfo.tier : 'Detecting...'}
                  </span>
                  <button
                    onClick={() => fetchBillingInfo(true)}
                    disabled={loadingBilling}
                    className="text-[9px] font-bold text-white/40 hover:text-white uppercase transition-colors"
                  >
                    {loadingBilling ? '...' : 'Refresh'}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {[
                  {
                    id: 'l4',
                    name: 'NVIDIA L4 (24GB VRAM)',
                    machine: 'g2-standard-4',
                    desc: 'Optimal for performance & medium/large models',
                    cost: 'High Cost / Spot available'
                  },
                  {
                    id: 't4',
                    name: 'NVIDIA Tesla T4 (16GB VRAM)',
                    machine: 'n1-standard-4',
                    desc: 'Cost-effective GPU for smaller models',
                    cost: 'Medium Cost'
                  },
                  {
                    id: 'none',
                    name: 'CPU Only (e2-standard-8)',
                    machine: 'e2-standard-8',
                    desc: 'No GPU acceleration, CPU inference only',
                    cost: 'Minimal Cost'
                  }
                ].map((profile) => {
                  const isSelected = config.gcpHardware === profile.name;
                  const quotaStatus = profile.id === 'none'
                    ? 'AVAILABLE'
                    : (billingInfo?.quotas[profile.id] || 'RESTRICTED');
                  const isAvailable = quotaStatus === 'AVAILABLE';
                  return (
                    <button
                      key={profile.id}
                      onClick={() => {
                        if (isAvailable) {
                          updateHardwareProfile(profile.name);
                        } else {
                          alert(`⚠️ ${profile.name} is restricted under your current GCP ${billingInfo?.tier || 'Free Tier'}. Please upgrade your billing account to unlock GPU resources.`);
                        }
                      }}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-xl border text-left transition-all",
                        isSelected 
                          ? "bg-indigo-500/10 border-indigo-500/40 text-white" 
                          : "bg-black/10 border-white/5 hover:bg-white/5 text-white/60 hover:text-white/90",
                        !isAvailable && "opacity-60 cursor-not-allowed hover:bg-transparent"
                      )}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold">{profile.name}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/40 font-mono">
                            {profile.machine}
                          </span>
                          <span className={cn(
                            "text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border",
                            isAvailable 
                              ? "bg-green-500/10 text-green-400 border-green-500/20" 
                              : "bg-red-500/10 text-red-400 border-red-500/20"
                          )}>
                            {quotaStatus}
                          </span>
                        </div>
                        <p className="text-[10px] text-white/40 mt-0.5">{profile.desc}</p>
                      </div>
                      <div className="text-[9px] font-mono text-indigo-400/80 bg-indigo-500/5 px-2 py-1 rounded border border-indigo-500/10">
                        {profile.cost}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Display Deploy Command */}
            <div className="p-3 bg-black/30 border border-white/5 rounded-xl space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">
                  Deployment Directive
                </span>
                <button
                  onClick={() => {
                    const gpuArg = config.gcpHardware.includes('L4') ? 'l4' : config.gcpHardware.includes('T4') ? 't4' : 'none';
                    navigator.clipboard.writeText(`./scripts/gcp-deploy-ollama.sh --gpu ${gpuArg}`);
                    alert('Command copied to clipboard!');
                  }}
                  className="text-[9px] font-bold text-primary hover:underline"
                >
                  Copy Command
                </button>
              </div>
              <code className="block text-[11px] font-mono text-indigo-300 break-all select-all">
                ./scripts/gcp-deploy-ollama.sh --gpu {config.gcpHardware.includes('L4') ? 'l4' : config.gcpHardware.includes('T4') ? 't4' : 'none'}
              </code>
            </div>
            
            <div className="flex gap-4">
              <button 
                onClick={() => setShowStartConfirm(true)}
                disabled={config.vmStatus === 'RUNNING' || activeLog !== null}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-500/10 hover:bg-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed border border-green-500/20 rounded-xl text-green-400 text-xs font-bold uppercase tracking-widest transition-all"
              >
                <Play className="w-4 h-4" /> Start VM
              </button>
              <button 
                onClick={() => runVmCommandSequence('STOP')}
                disabled={config.vmStatus === 'STOPPED' || activeLog !== null}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed border border-red-500/20 rounded-xl text-red-400 text-xs font-bold uppercase tracking-widest transition-all"
              >
                <Square className="w-4 h-4" /> Stop VM
              </button>
            </div>
          </div>

          {/* GCP CLI Command Console Output (Collapsible & Persisted) */}
          {persistedLog && (
            <div className="p-4 bg-black/40 border border-white/10 rounded-xl space-y-4 font-mono text-xs transition-all duration-300">
              <div 
                className="flex justify-between items-center border-b border-white/5 pb-2 cursor-pointer select-none"
                onClick={() => setIsLogCollapsed(!isLogCollapsed)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-indigo-400 flex items-center gap-1.5 hover:text-indigo-300 transition-colors">
                    {isLogCollapsed ? '▶' : '▼'} GCP Console Log — {persistedLog.action === 'START' ? 'VM Activation' : 'VM Deactivation'}
                  </span>
                  {activeLog && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 animate-pulse uppercase font-bold font-sans">
                      Live
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowLogModal(true);
                    }}
                    className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[9px] text-indigo-400 font-bold uppercase border border-white/10 hover:border-white/20 transition-all shrink-0 font-sans flex items-center gap-1"
                    title="Maximize Log Console"
                  >
                    <Maximize2 className="w-2.5 h-2.5" />
                    <span>Maximize</span>
                  </button>
                  <button
                    onClick={handleCopyLogs}
                    className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[9px] text-indigo-400 font-bold uppercase border border-white/10 hover:border-white/20 transition-all shrink-0 font-sans"
                    title="Copy full console logs to clipboard"
                  >
                    {copiedLogs ? 'Copied!' : 'Copy Logs'}
                  </button>
                  <span className="text-white/40">{persistedLog.progress}% Complete</span>
                </div>
              </div>
              
              {!isLogCollapsed && (
                <>
                  <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                    <div 
                      className="bg-indigo-500 h-full transition-all duration-300"
                      style={{ width: `${persistedLog.progress}%` }}
                    ></div>
                  </div>

                  <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar text-white/70">
                    {persistedLog.steps.map((step, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className={cn(
                            "font-bold",
                            step.status === 'RUNNING' && "text-yellow-400",
                            step.status === 'COMPLETED' && "text-green-400",
                            step.status === 'FAILED' && "text-red-400",
                            step.status === 'WARNING' && "text-amber-400",
                            step.status === 'PENDING' && "text-white/30"
                          )}>
                            [{step.status}] {step.name}
                          </span>
                        </div>
                        {step.command && (
                          <code className="block text-[10px] text-indigo-300 bg-black/25 p-1.5 rounded border border-white/5 whitespace-pre-wrap">
                            $ {step.command}
                          </code>
                        )}
                        {step.output && (
                          <div className="text-[10px] text-white/50 pl-3 border-l border-white/10 whitespace-pre-wrap">
                            {step.output}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between text-[9px] text-white/30 border-t border-white/5 pt-2">
                    <span>Elapsed: {persistedLog.elapsed}s</span>
                    <span>Est. Total: {persistedLog.steps.reduce((acc, s) => acc + s.duration, 0)}s</span>
                  </div>
                </>
              )}
            </div>
          )}
          </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Models For Use */}
        <div className="glass-card-static p-6 space-y-6">
          <div className="flex items-center gap-2 border-b border-white/10 pb-4">
            <Database className="w-4 h-4 text-white/60" />
            <h2 className="text-sm font-black text-white uppercase tracking-widest">Models For Use (Active & Installed)</h2>
          </div>

          <div className="space-y-3">
            {activeModels.length === 0 ? (
              <p className="text-xs text-white/40 text-center py-8 bg-black/20 rounded-xl border border-white/5">No active or installed models available.</p>
            ) : (
              activeModels.map(model => {
                return (
                  <div key={model.name} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-black/20 hover:bg-white/5 border border-white/5 rounded-xl transition-colors gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-white/90 flex items-center gap-2">
                          {model.name}
                          {model.isEnabled && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                        </h3>
                        <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider", model.suitability.badgeColor)}>
                          {model.suitability.statusText}
                        </span>
                      </div>
                      <p className="text-[10px] text-white/40 font-mono mt-1.5 flex gap-2 flex-wrap">
                        {model.isCloud ? (
                          <span className="text-indigo-300">Cloud Hosted API Resource</span>
                        ) : (
                          <>
                            <span>Size: {model.size}</span>
                            <span>|</span>
                            <span>Params: {model.params}</span>
                            <span>|</span>
                            <span className="text-indigo-300">Min GPU: {model.suitability.minGpuLabel}</span>
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => toggleModelEnable(model.name)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all",
                          model.isEnabled ? "bg-primary/10 text-primary border-primary/30" : "bg-white/5 text-white/40 border-white/10 hover:text-white"
                        )}
                      >
                        {model.isEnabled ? 'Enabled' : 'Disabled'}
                      </button>
                      {!model.isCloud && (
                        <button 
                          onClick={() => deleteModel(model.name)}
                          disabled={isDeleting === model.name}
                          className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/20 transition-all"
                        >
                          {isDeleting === model.name ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Models For Install */}
        <div className="glass-card-static p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4 gap-2">
            <div className="flex items-center gap-2">
              {isPulling ? (
                <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
              ) : (
                <Download className="w-4 h-4 text-white/60" />
              )}
              <h2 className="text-sm font-black text-white uppercase tracking-widest">Model Catalog (Registry)</h2>
            </div>
            {isPulling && (
              <div className="flex items-center gap-2 px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 rounded-full text-[10px] font-bold font-mono">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                </span>
                <span>Pulling {isPulling}: {pullProgress[isPulling]?.pct ?? 0}%</span>
              </div>
            )}
          </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
            {registry.catalog.map(model => {
              const isCloud = model.tags.includes('cloud');
              const isInstalled = installedModels.some(m => m.name === model.name);
              const isEnabled = config.enabledModels.includes(model.name);
              const suitability = checkGpuSuitability(model.name, config.gcpHardware);
              return (
                <div key={model.name} className="flex flex-col p-4 bg-black/20 hover:bg-white/5 border border-white/5 rounded-xl transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-white/90">{model.name}</h3>
                      <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider", suitability.badgeColor)}>
                        {suitability.statusText}
                      </span>
                    </div>
                    {isCloud ? (
                      <button 
                        onClick={() => toggleModelEnable(model.name)}
                        className={cn(
                          "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all",
                          isEnabled ? "bg-primary/10 text-primary border-primary/30" : "bg-white/5 text-white/40 border-white/10 hover:text-white"
                        )}
                      >
                        {isEnabled ? 'Enabled' : 'Disabled'}
                      </button>
                    ) : isInstalled ? (
                      <span className="text-[10px] font-black uppercase tracking-widest text-green-400 flex items-center gap-1 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">
                        <CheckCircle2 className="w-3 h-3" /> Installed
                      </span>
                    ) : isPulling === model.name ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
                        <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">
                          {pullProgress[model.name]?.pct ?? 0}%
                        </span>
                      </div>
                    ) : (
                      <button 
                        onClick={() => pullModel(model.name)}
                        disabled={config.activeSource === 'gcp' && config.vmStatus === 'STOPPED'}
                        title={config.activeSource === 'gcp' && config.vmStatus === 'STOPPED' ? "GCP VM is offline. Start the VM or switch active source to Localhost to pull models." : undefined}
                        className="flex items-center gap-1 px-3 py-1 bg-white/5 hover:bg-white/10 text-white/80 text-[10px] font-black uppercase tracking-widest rounded-lg border border-white/10 transition-all disabled:opacity-50"
                      >
                        <Download className="w-3 h-3" />
                        Pull
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-white/60 mb-3">{model.description}</p>
                  {isPulling === model.name && pullProgress[model.name] && (
                    <div className="mb-3 space-y-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-mono text-indigo-300/80 uppercase tracking-wider">
                          {pullProgress[model.name].status}
                        </span>
                        <span className="text-[9px] font-mono text-white/40">
                          {pullProgress[model.name].pct}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
                          style={{ width: `${pullProgress[model.name].pct}%` }}
                        />
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {!isCloud && (
                      <>
                        <span className="text-[9px] font-mono text-white/40 bg-white/5 px-2 py-0.5 rounded">Size: {model.size}</span>
                        <span className="text-[9px] font-mono text-indigo-300 bg-indigo-500/5 border border-indigo-500/10 px-2 py-0.5 rounded">Min GPU: {suitability.minGpuLabel}</span>
                      </>
                    )}
                    {model.tags.map(tag => (
                      <span key={tag} className="text-[9px] font-mono text-indigo-400/60 bg-indigo-500/5 border border-indigo-500/10 px-2 py-0.5 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {/* Centered Start Confirmation Modal */}
      {showStartConfirm && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 p-4">
          <div className="glass-card-static max-w-md w-full p-6 space-y-6 border border-white/10 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="space-y-2 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/20 mb-2">
                <Play className="w-6 h-6 text-green-400 animate-pulse" />
              </div>
              <h3 className="text-lg font-bold text-white">Start GCP Inference VM?</h3>
              <p className="text-xs text-white/60">
                This will provision the virtual machine running <strong className="text-white/90">{config.gcpHardware}</strong>. Compute and accelerator billing will begin immediately.
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowStartConfirm(false)}
                className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white/80 hover:text-white text-xs font-bold uppercase tracking-widest transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowStartConfirm(false);
                  runVmCommandSequence('START');
                }}
                className="flex-1 py-2.5 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 rounded-xl text-green-400 text-xs font-bold uppercase tracking-widest transition-all"
              >
                Confirm Start
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sliding Logs Modal */}
      {showLogModal && persistedLog && (
        <div className="fixed inset-0 z-[100] pointer-events-none flex items-end justify-end p-6">
          <div className="bg-[#050505]/95 w-full max-w-lg md:max-w-xl h-[520px] flex flex-col shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] border border-white/10 rounded-3xl relative overflow-hidden animate-in slide-in-from-bottom slide-in-from-right duration-300 pointer-events-auto">
            {/* Top accent line */}
            <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${activeLog ? 'from-indigo-500/50 via-indigo-500 to-indigo-500/50' : persistedLog.steps.some(s => s.status === 'FAILED') ? 'from-red-500/50 via-red-500 to-red-500/50' : 'from-green-500/50 via-green-500 to-green-500/50'} z-20`} />
            
            {/* Modal Header */}
            <div className="p-5 pb-3 flex items-center justify-between border-b border-white/5">
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-xl ${
                  activeLog ? 'bg-indigo-400/10 text-indigo-400' :
                  persistedLog.steps.some(s => s.status === 'FAILED') ? 'bg-red-400/10 text-red-400' :
                  'bg-green-400/10 text-green-400'
                }`}>
                  {activeLog ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : persistedLog.steps.some(s => s.status === 'FAILED') ? (
                    <X className="w-4 h-4 text-red-400" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                  )}
                </div>
                <div>
                  <h2 className="text-sm font-black text-white tracking-tight flex items-center gap-2">
                    GCP Console Log
                    <span className="text-xs text-white/30 font-mono font-normal">
                      ({persistedLog.action === 'START' ? 'VM Activation' : 'VM Deactivation'})
                    </span>
                  </h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/5 border ${
                      activeLog ? 'text-indigo-400 border-indigo-500/20 animate-pulse' :
                      persistedLog.steps.some(s => s.status === 'FAILED') ? 'text-red-400 border-red-500/20' :
                      'text-green-400 border-green-500/20'
                    }`}>{activeLog ? 'RUNNING' : persistedLog.steps.some(s => s.status === 'FAILED') ? 'FAILED' : 'COMPLETED'}</span>
                    <span className="text-[8px] font-black text-white/30 uppercase tracking-widest">
                      {(persistedLog.gpuType || 'none') === 'none' ? 'CPU Only' : persistedLog.gpuType?.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowLogModal(false)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all border border-white/5"
                title="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Toolbar */}
            <div className="px-5 py-2.5 bg-white/5 border-b border-white/5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-wider text-white/40 cursor-pointer hover:text-white/60 select-none">
                  <input
                    type="checkbox"
                    checked={autoScrollLogs}
                    onChange={(e) => setAutoScrollLogs(e.target.checked)}
                    className="rounded border-white/10 bg-white/5 text-indigo-500 focus:ring-0 focus:ring-offset-0 w-3 h-3"
                  />
                  Auto-Scroll
                </label>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleCopyLogs}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 border border-white/10"
                >
                  {copiedLogs ? 'Copied!' : 'Copy Logs'}
                </button>
              </div>
            </div>

            {/* Logs Area */}
            <div 
              ref={modalLogRef}
              className="flex-1 p-5 overflow-y-auto font-mono text-[10px] space-y-4 bg-black/60 custom-scrollbar text-white/80"
            >
              {persistedLog.steps.map((step, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className={cn(
                      "font-bold",
                      step.status === 'RUNNING' && "text-yellow-400",
                      step.status === 'COMPLETED' && "text-green-400",
                      step.status === 'FAILED' && "text-red-400",
                      step.status === 'WARNING' && "text-amber-400",
                      step.status === 'PENDING' && "text-white/30"
                    )}>
                      [{step.status}] {step.name}
                    </span>
                  </div>
                  {step.command && (
                    <code className="block text-[9px] text-indigo-300 bg-black/40 p-1.5 rounded border border-white/5 whitespace-pre-wrap">
                      $ {step.command}
                    </code>
                  )}
                  {step.output && (
                    <div className="text-[9px] text-white/50 pl-3 border-l border-white/10 whitespace-pre-wrap">
                      {step.output}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Footer / Progress */}
            <div className="p-4 bg-black/40 border-t border-white/5 space-y-3">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-white/40">Progress</span>
                <span className="font-bold text-indigo-400">{persistedLog.progress}%</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="bg-indigo-500 h-full transition-all duration-300"
                  style={{ width: `${persistedLog.progress}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-[9px] text-white/30 pt-1">
                <span>Elapsed: {persistedLog.elapsed}s</span>
                <span>Active Source: GCP VM</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
