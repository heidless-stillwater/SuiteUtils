import { useState, useEffect, useRef } from 'react';
import { 
  Folder, 
  File, 
  ChevronRight, 
  Search, 
  Upload, 
  Download, 
  Trash2, 
  MoreVertical,
  Plus,
  RefreshCw,
  FolderPlus,
  FileIcon,
  ArrowUp,
  X
} from 'lucide-react';
import { format } from 'date-fns';

const API_URL = 'http://localhost:5181';

const JsonNode = ({ label, value, depth = 0, zipPath, forceExpand = false }: { label: string; value: any, depth?: number, zipPath?: string | null, forceExpand?: boolean }) => {
  const [isExpanded, setIsExpanded] = useState(depth < 1 || forceExpand);
  const [drillData, setDrillData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [expandAll, setExpandAll] = useState(forceExpand);

  const isObject = (value !== null && typeof value === 'object') || drillData !== null;
  const isJsonFile = typeof value === 'string' && value.toLowerCase().endsWith('.json') && zipPath;
  const isDrillableFile = value?.path?.toLowerCase().endsWith('.json') && zipPath;
  
  const indent = depth * 16;

  useEffect(() => {
    if (forceExpand && !isExpanded) {
      handleToggle(true);
    }
  }, [forceExpand]);

  const handleToggle = async (recursive = false) => {
    const nextState = recursive ? true : !isExpanded;
    setIsExpanded(nextState);
    if (recursive) setExpandAll(true);
    else setExpandAll(false);

    if (nextState && (isJsonFile || isDrillableFile) && !drillData) {
      setLoading(true);
      try {
        const filePath = isJsonFile ? value : value.path;
        const response = await fetch(`${API_URL}/api/storage/zip-file-content?zipPath=${encodeURIComponent(zipPath!)}&filePath=${encodeURIComponent(filePath)}`);
        const data = await response.json();
        setDrillData(data.content);
      } catch (err) {
        console.error('Failed to drill into file:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  if (!isObject && !isJsonFile && !isDrillableFile) {
    return (
      <div style={{ paddingLeft: `${indent}px` }} className="flex items-center gap-2 py-0.5 group">
        <span className="text-white/40 group-hover:text-white/60 transition-colors">"{label}":</span>
        <span className={typeof value === 'string' ? 'text-primary' : 'text-blue-400'}>
          {typeof value === 'string' ? `"${value}"` : String(value)}
        </span>
      </div>
    );
  }

  const isArray = Array.isArray(drillData || value);
  const displayValue = drillData || value;

  return (
    <div style={{ paddingLeft: `${indent}px` }} className="py-0.5">
      <div className="flex items-center gap-2 group/node">
        <div 
          className="flex items-center gap-2 cursor-pointer group"
          onClick={() => handleToggle(false)}
        >
          <ChevronRight className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''} ${isJsonFile || isDrillableFile ? 'text-blue-400' : 'text-orange-400'}`} />
          <span className="text-white/40 group-hover:text-white/60 transition-colors">"{label}":</span>
          {loading ? (
            <RefreshCw className="w-3 h-3 animate-spin text-primary" />
          ) : (
            <span className={isJsonFile || isDrillableFile ? 'text-blue-400/80 font-bold' : 'text-orange-400/80'}>
              {drillData ? (Array.isArray(drillData) ? `Array(${drillData.length})` : '{...}') : (isJsonFile || isDrillableFile ? 'Click to load JSON' : (isArray ? `Array(${value.length})` : '{...}'))}
            </span>
          )}
        </div>
        
        {isObject && (
          <div className="flex items-center gap-1 opacity-0 group-hover/node:opacity-100 transition-opacity">
            <button 
              onClick={(e) => { e.stopPropagation(); handleToggle(true); }}
              className="p-1 rounded bg-white/5 hover:bg-primary/20 text-[8px] font-bold text-white/20 hover:text-primary uppercase tracking-tighter transition-all"
              title="Expand All Below"
            >
              Expand All
            </button>
            {isExpanded && (
              <button 
                onClick={(e) => { e.stopPropagation(); setIsExpanded(false); setExpandAll(false); }}
                className="p-1 rounded bg-white/5 hover:bg-red-500/20 text-[8px] font-bold text-white/20 hover:text-red-400 uppercase tracking-tighter transition-all"
                title="Collapse All Below"
              >
                Collapse
              </button>
            )}
          </div>
        )}
      </div>

      {isExpanded && (drillData || (isObject && !isJsonFile && !isDrillableFile)) && (
        <div className="border-l border-white/5 ml-1.5 mt-1">
          {isArray ? (
            displayValue.map((v: any, i: number) => <JsonNode key={i} label={String(i)} value={v} depth={depth + 1} zipPath={zipPath} forceExpand={expandAll} />)
          ) : (
            Object.entries(displayValue).map(([k, v]) => <JsonNode key={k} label={k} value={v} depth={depth + 1} zipPath={zipPath} forceExpand={expandAll} />)
          )}
        </div>
      )}
    </div>
  );
};

interface StorageItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  isDir: boolean;
  fullPath: string;
}

export default function StorageExplorer({ initialSearch = '', initialPath = 'AppSuite/backups/', initialSelected = '' }: { initialSearch?: string, initialPath?: string, initialSelected?: string }) {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [items, setItems] = useState<StorageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [uploading, setUploading] = useState(false);
  const [showMkdir, setShowMkdir] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; paths: string[] }>({ open: false, paths: [] });
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set(initialSelected ? [initialSelected] : []));
  const [expandedZip, setExpandedZip] = useState<string | null>(null);
  const [zipContents, setZipContents] = useState<any[] | null>(null);
  const [zipLoading, setZipLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSelectedItems(new Set());
    fetchItems();
  }, [currentPath]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/storage/list?path=${encodeURIComponent(currentPath)}`);
      const data = await response.json();
      setItems(data.items || []);
    } catch (err) {
      console.error('Failed to fetch storage items:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('destination', currentPath);

    try {
      await fetch(`${API_URL}/api/storage/upload`, {
        method: 'POST',
        body: formData,
      });
      fetchItems();
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = (item: StorageItem) => {
    setDeleteModal({ open: true, paths: [item.fullPath] });
  };

  const handleBulkDelete = () => {
    if (selectedItems.size === 0) return;
    setDeleteModal({ open: true, paths: Array.from(selectedItems) });
  };

  const executeDelete = async () => {
    if (deleteModal.paths.length === 0) return;
    
    setLoading(true);
    try {
      if (deleteModal.paths.length === 1) {
        await fetch(`${API_URL}/api/storage/delete?path=${encodeURIComponent(deleteModal.paths[0])}`, {
          method: 'DELETE',
        });
      } else {
        await fetch(`${API_URL}/api/storage/delete-bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paths: deleteModal.paths })
        });
      }
      setSelectedItems(new Set());
      setDeleteModal({ open: false, paths: [] });
      fetchItems();
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMkdir = async () => {
    if (!newFolderName.trim()) return;

    try {
      await fetch(`${API_URL}/api/storage/mkdir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName, parentPath: currentPath }),
      });
      setNewFolderName('');
      setShowMkdir(false);
      fetchItems();
    } catch (err) {
      console.error('Failed to create folder:', err);
    }
  };

  const handleDownload = async (item: StorageItem) => {
    try {
      const response = await fetch(`${API_URL}/api/storage/download?path=${encodeURIComponent(item.fullPath)}`);
      const data = await response.json();
      window.open(data.url, '_blank');
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const navigateTo = (path: string) => {
    setCurrentPath(path);
  };

  const breadcrumbs = (currentPath || '').split('/').filter(Boolean);

  const navigateUp = () => {
    if (breadcrumbs.length <= 1) {
      navigateTo('');
    } else {
      navigateTo(breadcrumbs.slice(0, -1).join('/') + '/');
    }
  };
  
  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const fetchZipContents = async (item: StorageItem) => {
    if (expandedZip === item.fullPath) {
      setExpandedZip(null);
      return;
    }

    setExpandedZip(item.fullPath);
    setZipLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/storage/zip-contents?path=${encodeURIComponent(item.fullPath)}`);
      const data = await response.json();
      setZipContents(data.files || []);
    } catch (err) {
      console.error('Failed to fetch zip contents:', err);
    } finally {
      setZipLoading(false);
    }
  };

  const formatSize = (bytes?: string) => {
    if (!bytes) return '--';
    const b = parseInt(bytes);
    if (b === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-black/20 rounded-2xl border border-white/5">
      {/* Explorer Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
        <div className="flex items-center gap-4 flex-1">
          <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
            {breadcrumbs.length > 0 && (
              <>
                <button 
                  onClick={navigateUp}
                  className="px-2 py-1 hover:bg-white/5 rounded text-white/40 hover:text-white transition-colors"
                  title="Up one level"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <div className="w-px h-3 bg-white/10 mx-1" />
              </>
            )}
            <button 
              onClick={() => navigateTo('')}
              className="px-2 py-1 hover:bg-white/5 rounded text-white/40 hover:text-white transition-colors"
              title="Root directory"
            >
              <Folder className="w-3.5 h-3.5" />
            </button>
            {breadcrumbs.map((crumb, i) => (
              <div key={i} className="flex items-center">
                <ChevronRight className="w-3 h-3 text-white/10 mx-1" />
                <button 
                  onClick={() => navigateTo(breadcrumbs.slice(0, i + 1).join('/') + '/')}
                  className="px-2 py-1 hover:bg-white/5 rounded text-[10px] font-bold uppercase tracking-wider text-white/60 hover:text-white transition-colors"
                >
                  {crumb}
                </button>
              </div>
            ))}
          </div>
          
          <div className="relative max-w-xs w-full group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20 group-focus-within:text-primary transition-colors" />
            <input 
              type="text"
              placeholder="Search in folder..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/40 border-white/5 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-white/20 focus:ring-primary/20 transition-all outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedItems.size > 0 && (
            <button 
              onClick={handleBulkDelete}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 text-red-400 text-[10px] font-bold uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all border border-red-500/20 mr-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete ({selectedItems.size})
            </button>
          )}
          <button 
            onClick={() => setShowMkdir(true)}
            className="p-2 rounded-xl bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-all border border-transparent hover:border-white/10"
            title="New Folder"
          >
            <FolderPlus className="w-4 h-4" />
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-[10px] font-bold uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            {uploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Upload
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleUpload} 
            className="hidden" 
          />
        </div>
      </div>

      {/* Explorer Content */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 opacity-20">
            <RefreshCw className="w-10 h-10 animate-spin" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Syncing with GCS...</span>
          </div>
        ) : filteredItems.length > 0 ? (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.01]">
                <th className="px-4 py-3 w-10">
                  <input 
                    type="checkbox"
                    checked={filteredItems.length > 0 && selectedItems.size === filteredItems.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedItems(new Set(filteredItems.map(i => i.fullPath)));
                      } else {
                        setSelectedItems(new Set());
                      }
                    }}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-primary focus:ring-primary/50 cursor-pointer"
                  />
                </th>
                <th className="px-6 py-3 text-[10px] font-bold text-white/30 uppercase tracking-widest">Name</th>
                <th className="px-6 py-3 text-[10px] font-bold text-white/30 uppercase tracking-widest text-right">Size</th>
                <th className="px-6 py-3 text-[10px] font-bold text-white/30 uppercase tracking-widest text-right">Modified</th>
                <th className="px-6 py-3 text-[10px] font-bold text-white/30 uppercase tracking-widest text-center w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.sort((a, b) => Number(b.isDir) - Number(a.isDir)).map((item) => (
                <>
                  <tr 
                    key={item.id} 
                    className={`group hover:bg-white/[0.03] border-b border-white/[0.02] transition-colors cursor-pointer ${selectedItems.has(item.fullPath) || expandedZip === item.fullPath ? 'bg-primary/5' : ''}`}
                    onClick={() => {
                      if (item.isDir) navigateTo(item.fullPath);
                      else if (item.name.toLowerCase().endsWith('.zip')) fetchZipContents(item);
                    }}
                  >
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox"
                        checked={selectedItems.has(item.fullPath)}
                        onChange={(e) => {
                          const next = new Set(selectedItems);
                          if (e.target.checked) next.add(item.fullPath);
                          else next.delete(item.fullPath);
                          setSelectedItems(next);
                        }}
                        className="w-4 h-4 rounded border-white/20 bg-white/5 text-primary focus:ring-primary/50 cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${item.isDir ? 'bg-primary/10 text-primary group-hover:bg-primary/20' : 'bg-white/5 text-white/40 group-hover:bg-white/10'}`}>
                          {item.isDir ? <Folder className="w-4 h-4 fill-current" /> : item.name.toLowerCase().endsWith('.zip') ? <RefreshCw className={`w-4 h-4 ${expandedZip === item.fullPath ? 'animate-spin text-primary' : ''}`} /> : <File className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">{item.name}</p>
                            {item.name.toLowerCase().endsWith('.zip') && (
                              <span className="text-[8px] font-bold bg-primary/20 text-primary px-1 rounded-sm uppercase tracking-tighter">Inspectable</span>
                            )}
                          </div>
                          <p className="text-[10px] text-white/20 truncate max-w-xs">{item.mimeType}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-xs text-white/40 tabular-nums">
                      {item.isDir ? '--' : formatSize(item.size)}
                    </td>
                    <td className="px-6 py-4 text-right text-xs text-white/40 tabular-nums">
                      {item.modifiedTime ? format(new Date(item.modifiedTime), 'MMM dd, yyyy HH:mm') : '--'}
                    </td>
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!item.isDir && (
                          <button 
                            onClick={() => handleDownload(item)}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-white/20 hover:text-white transition-all"
                            title="Download"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button 
                          onClick={() => handleDelete(item)}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-white/20 hover:text-red-400 transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedZip === item.fullPath && (
                    <tr className="bg-black/40 border-b border-white/[0.05]">
                      <td colSpan={5} className="p-0">
                        <div className="p-4 pl-14 pr-6 animate-in slide-in-from-top-2 duration-300">
                          <div className="bg-[#0a0a0a] border border-white/5 rounded-xl overflow-hidden shadow-2xl">
                            <div className="flex items-center justify-between px-4 py-2 bg-white/[0.03] border-b border-white/5">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-red-500/40" />
                                <div className="w-2 h-2 rounded-full bg-orange-500/40" />
                                <div className="w-2 h-2 rounded-full bg-green-500/40" />
                                <span className="ml-2 text-[10px] text-white/20 uppercase tracking-tighter font-mono">archive_explorer --json {item.name}</span>
                              </div>
                              <button 
                                onClick={() => setExpandedZip(null)}
                                className="text-[10px] font-bold text-primary hover:text-white transition-colors uppercase tracking-widest"
                              >
                                Close
                              </button>
                            </div>
                            <div className="p-4 max-h-80 overflow-auto custom-scrollbar-mini font-mono text-[11px] leading-relaxed">
                              {zipLoading ? (
                                <div className="flex items-center gap-3 text-primary animate-pulse">
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                  <span>Reading central directory...</span>
                                </div>
                              ) : zipContents ? (
                                <div className="space-y-1">
                                  <JsonNode 
                                    label="root" 
                                    zipPath={item.fullPath}
                                    value={{
                                      archive_name: item.name,
                                      full_path: item.fullPath,
                                      stats: {
                                        total_entries: zipContents.length,
                                        total_files: zipContents.filter(f => !f.isDir).length,
                                        total_folders: zipContents.filter(f => f.isDir).length,
                                      },
                                      manifest: zipContents.map(f => ({
                                        name: f.path.split('/').pop(),
                                        path: f.path,
                                        size: f.size,
                                        type: f.isDir ? 'directory' : 'file'
                                      }))
                                    }} 
                                  />
                                </div>
                              ) : (
                                <span className="text-red-400">Error: Could not read archive metadata.</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-20 opacity-40">
            <Folder className="w-12 h-12 text-white/10 mb-4" />
            <p className="text-sm font-bold uppercase tracking-widest text-white/40">This folder is empty</p>
            <p className="text-[10px] text-white/20 mt-2">Upload files or create sub-directories to get started</p>
          </div>
        )}
      </div>

      {/* New Folder Modal */}
      {showMkdir && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md">
          <div className="glass-card-static w-full max-w-md p-8 animate-in zoom-in duration-200 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                  <FolderPlus className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold text-white">New Folder</h2>
              </div>
              <button onClick={() => setShowMkdir(false)} className="p-2 rounded-xl hover:bg-white/5 text-white/40 transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-white/30 mb-2">Folder Name</label>
                <input 
                  type="text"
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleMkdir()}
                  placeholder="Enter folder name..."
                  className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:border-primary/50 text-sm"
                />
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setShowMkdir(false)}
                  className="flex-1 py-4 rounded-2xl bg-white/5 text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleMkdir}
                  className="flex-1 py-4 rounded-2xl bg-primary text-white text-[10px] font-black uppercase tracking-[0.2em] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-primary/20"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md">
          <div className="glass-card-static w-full max-w-md p-8 animate-in zoom-in duration-200 shadow-2xl border-red-500/20">
            <div className="flex items-center gap-3 mb-4 text-red-400">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold">Confirm Deletion</h2>
            </div>
            
            <p className="text-sm text-white/60 leading-relaxed mb-8">
              Are you sure you want to permanently delete <span className="text-white font-bold">{deleteModal.paths.length}</span> item{deleteModal.paths.length > 1 ? 's' : ''}? 
              This action <span className="text-red-400 font-bold uppercase underline decoration-2 underline-offset-4">cannot be undone</span>.
            </p>

            <div className="flex gap-3">
              <button 
                onClick={() => setDeleteModal({ open: false, paths: [] })}
                className="flex-1 py-4 rounded-2xl bg-white/5 text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white/10 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={executeDelete}
                className="flex-1 py-4 rounded-2xl bg-red-500 text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-red-600 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-red-500/20"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
