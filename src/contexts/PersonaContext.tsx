import React, { createContext, useContext, useEffect, useState } from 'react';
import { personaLink } from '../lib/persona';
import type { PersonaProfile } from '../lib/persona';

interface PersonaContextType {
  profile: PersonaProfile | null;
  lastUpdate: string | null;
  isAligned: boolean;
}

const PersonaContext = createContext<PersonaContextType | undefined>(undefined);

export function PersonaProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<PersonaProfile | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [isAligned, setIsAligned] = useState(false);

  const refreshProfile = async () => {
    const p = await personaLink.getProfile();
    if (p) {
      setProfile(p);
      setIsAligned(true);
    }
  };

  // Poll for broadcasts from the Persona Hub
  useEffect(() => {
    refreshProfile(); // Initial load

    const interval = setInterval(async () => {
      try {
        const res = await fetch('http://localhost:3006/broadcast');
        if (res.ok) {
          const sentinel = await res.json();
          if (sentinel.updatedAt !== lastUpdate) {
            setLastUpdate(sentinel.updatedAt);
            refreshProfile();
          }
        }
      } catch (err) {
        setIsAligned(false);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [lastUpdate]);

  return (
    <PersonaContext.Provider value={{ profile, lastUpdate, isAligned }}>
      {children}
    </PersonaContext.Provider>
  );
}

export const usePersona = () => {
  const context = useContext(PersonaContext);
  if (context === undefined) {
    throw new Error('usePersona must be used within a PersonaProvider');
  }
  return context;
};
