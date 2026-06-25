import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rocket, Target, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import CasualModeView from './member/CasualModeView';
import ProModeView from './member/ProModeView';

interface MemberDashboardProps {
  profile: any;
  apps: any[];
  infrastructure?: any[];
  healthResults: any[];
  onOpenLogs: (appId: string) => void;
  selectedIds: string[];
  toggleSelect: (appId: string) => void;
  handleAction: (appId: string, action: 'start' | 'stop' | 'restart') => void;
  handleBulkToggle: (enabled: boolean) => void;
  loadingAppId: string | null;
  completedIds: string[];
  bulkActionType: 'enable' | 'disable' | null;
  viewMode: 'casual' | 'pro';
}

export default function MemberDashboard({ 
  profile, 
  apps, 
  infrastructure = [],
  healthResults, 
  onOpenLogs,
  selectedIds,
  toggleSelect,
  handleAction,
  handleBulkToggle,
  loadingAppId,
  completedIds,
  bulkActionType,
  viewMode
}: MemberDashboardProps) {
  return (
    <div className="space-y-8 page-enter">
      {/* Primary View Container */}
      <AnimatePresence mode="wait">
        <motion.div
          key={viewMode}
          initial={{ opacity: 0, x: viewMode === 'casual' ? -20 : 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: viewMode === 'casual' ? 20 : -20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          {viewMode === 'casual' ? (
            <CasualModeView 
              profile={profile} 
              healthResults={healthResults}
              loadingAppId={loadingAppId}
              completedIds={completedIds}
            />
          ) : (
            <ProModeView 
              apps={apps} 
              infrastructure={infrastructure}
              healthResults={healthResults} 
              onOpenLogs={onOpenLogs}
              selectedIds={selectedIds}
              toggleSelect={toggleSelect}
              handleAction={handleAction}
              handleBulkToggle={handleBulkToggle}
              loadingAppId={loadingAppId}
              completedIds={completedIds}
              bulkActionType={bulkActionType}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Dashboard Footer/Slogan */}
      <div className="pt-12 pb-8 flex flex-col items-center gap-4 opacity-20 hover:opacity-40 transition-opacity">
        <div className="h-px w-32 bg-gradient-to-r from-transparent via-white to-transparent" />
        <div className="flex items-center gap-3">
          <div className="h-1 w-1 rounded-full bg-primary/20" />
          <p className="text-[9px] font-black uppercase tracking-[0.6em] text-primary/30">
            Stillwater Sovereign Hive :: Architect v1.1 :: [STREAM_CONNECTED]
          </p>
          <div className="h-1 w-1 rounded-full bg-primary/20" />
        </div>
      </div>
    </div>
  );
}
