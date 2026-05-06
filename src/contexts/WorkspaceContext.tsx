import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_URL } from '../lib/api-config';

interface Workspace {
  id: string;
  name: string;
  gcpProjectId?: string;
  ownerEmail?: string;
  apps?: any[]; // Array of AppConfig from backend
}

interface WorkspaceContextType {
  activeWorkspaceId: string;
  setActiveWorkspaceId: (id: string) => void;
  availableWorkspaces: Workspace[];
  refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string>(() => {
    return localStorage.getItem('activeWorkspaceId') || 'stillwater-suite';
  });
  const [availableWorkspaces, setAvailableWorkspaces] = useState<Workspace[]>([]);

  const fetchWorkspaces = async () => {
    try {
      const res = await fetch(`${API_URL}/api/workspaces`);
      if (res.ok) {
        const data = await res.json();
        setAvailableWorkspaces(data);
      }
    } catch (err) {
      console.error('[WorkspaceProvider] Failed to fetch workspaces:', err);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const setActiveWorkspaceId = (id: string) => {
    setActiveWorkspaceIdState(id);
    localStorage.setItem('activeWorkspaceId', id);
    // Reload to ensure all components fetch with new header
    window.location.reload();
  };

  return (
    <WorkspaceContext.Provider value={{ 
      activeWorkspaceId, 
      setActiveWorkspaceId, 
      availableWorkspaces,
      refreshWorkspaces: fetchWorkspaces
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};
