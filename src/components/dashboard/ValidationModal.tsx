import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Play,
  Check,
  Ban,
  Pause,
  FileText,
  Terminal
} from 'lucide-react';
import { API_URL } from '../../lib/api-config';
import { cn } from '../../lib/utils';

interface Validation {
  id: string;
  feature: string;
  title: string;
  tag: string;
  status: 'PENDING' | 'PASS' | 'FAIL' | 'PARKED';
  instructions: string;
  expectedResult: string;
  lastUpdated: string;
  group: string;
}

interface ValidationDrawerProps {
  validation: Validation | null;
  onClose: () => void;
  onUpdateStatus?: (id: string, status: 'PASS' | 'FAIL' | 'PARKED') => void;
}

export const autolinkValidations = (text: string): string => {
  if (!text) return '';
  return text.replace(/\b(VAL-[A-Z0-9-]+)\b/g, (match, valId, offset) => {
    const before = text.substring(Math.max(0, offset - 15), offset);
    if (before.includes('validation://') || before.includes('val://') || before.includes('validation=')) {
      return match;
    }
    const after = text.substring(offset + match.length, offset + match.length + 15);
    if (after.startsWith(')') || (after.startsWith(']') && after.includes('('))) {
      return match;
    }
    return `[${valId}](validation://${valId})`;
  });
};

export const renderInstructions = (
  text: string, 
  mode: 'MARKDOWN' | 'RAW',
  onCopyPath?: (path: string, type: 'path' | 'command' | 'validation') => void
) => {
  if (mode === 'RAW') {
    return <pre className="whitespace-pre-wrap font-mono text-xs text-white/50">{text}</pre>;
  }

  // Strip backticks from around markdown links to allow them to be parsed and rendered as active links
  const cleanedText = text.replace(/`(\[.*?\]\(.*?\))`+/g, '$1');
  const autolinkedText = autolinkValidations(cleanedText);
  const lines = autolinkedText.split('\n');
  return (
    <div className="space-y-2 font-mono text-xs leading-relaxed text-white/70">
      {lines.map((line, idx) => {
        const segments: React.ReactNode[] = [];
        let currentText = line;
        
        // Match bold **text**, inline code `code`, and links [text](url)
        const regex = /(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\))/g;
        const matches = [...currentText.matchAll(regex)];
        
        if (matches.length === 0) {
          return <p key={idx} className="min-h-[1em]">{currentText}</p>;
        }
        
        let lastIndex = 0;
        matches.forEach((match, mIdx) => {
          const matchStr = match[0];
          const matchIndex = match.index!;
          
          if (matchIndex > lastIndex) {
            segments.push(currentText.substring(lastIndex, matchIndex));
          }
          
          if (matchStr.startsWith('**') && matchStr.endsWith('**')) {
            const boldVal = matchStr.slice(2, -2);
            segments.push(<strong key={`b-${mIdx}`} className="font-black text-white">{boldVal}</strong>);
          } else if (matchStr.startsWith('`') && matchStr.endsWith('`')) {
            const codeVal = matchStr.slice(1, -1);
            segments.push(
              <code key={`c-${mIdx}`} className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-mono text-indigo-300 font-bold">
                {codeVal}
              </code>
            );
          } else if (matchStr.startsWith('[') && matchStr.includes('](')) {
            const closeBracketIdx = matchStr.indexOf('](');
            const linkText = matchStr.substring(1, closeBracketIdx);
            const linkUrl = matchStr.substring(closeBracketIdx + 2, matchStr.length - 1);
            const isFileLink = linkUrl.startsWith('file://');
            const isCommandLink = linkUrl.startsWith('command://') || linkUrl.startsWith('copy://');
            const isValidationLink = linkUrl.startsWith('validation://') || 
                                     linkUrl.startsWith('val://') || 
                                     (linkUrl.includes('validation=') && (linkUrl.startsWith('http') || linkUrl.startsWith('/') || linkUrl.startsWith('.')));
            
            segments.push(
              <a 
                key={`l-${mIdx}`} 
                href={linkUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                onClick={(e) => {
                  if (isFileLink) {
                    e.preventDefault();
                    const cleanPath = linkUrl.replace('file://', '');
                    navigator.clipboard.writeText(cleanPath);
                    if (onCopyPath) onCopyPath(cleanPath, 'path');
                  } else if (isCommandLink) {
                    e.preventDefault();
                    const cleanCmd = decodeURIComponent(linkUrl.replace(/^(command|copy):\/\//, ''));
                    navigator.clipboard.writeText(cleanCmd);
                    if (onCopyPath) onCopyPath(cleanCmd, 'command');
                  } else if (isValidationLink) {
                    e.preventDefault();
                    let valId = linkUrl.replace(/^(validation|val):\/\//, '');
                    if (linkUrl.includes('validation=')) {
                      const match = linkUrl.match(/[?&]validation=([^&]+)/);
                      if (match) {
                        valId = match[1];
                      }
                    }
                    if (onCopyPath) onCopyPath(valId, 'validation');
                  }
                }}
                className={cn(
                  "font-black transition-all hover:underline inline-flex items-center gap-0.5",
                  (isFileLink || isCommandLink || isValidationLink)
                    ? "text-primary hover:text-primary/80 cursor-pointer" 
                    : "text-indigo-400 hover:text-indigo-300"
                )}
                title={
                  isFileLink 
                    ? `Click to copy path: ${linkUrl.replace('file://', '')}` 
                    : isCommandLink 
                      ? `Click to copy command: ${decodeURIComponent(linkUrl.replace(/^(command|copy):\/\//, ''))}` 
                      : isValidationLink
                        ? `Click to view validation: ${linkUrl.replace(/^(validation|val):\/\//, '').split('?')[0]}`
                        : linkUrl
                }
              >
                {isFileLink && <FileText className="w-3 h-3 text-primary/60 shrink-0" />}
                {isCommandLink && <Terminal className="w-3 h-3 text-primary/60 shrink-0" />}
                {isValidationLink && <ShieldCheck className="w-3 h-3 text-primary/60 shrink-0" />}
                {linkText}
              </a>
            );
          }
          
          lastIndex = matchIndex + matchStr.length;
        });
        
        if (lastIndex < currentText.length) {
          segments.push(currentText.substring(lastIndex));
        }
        
        return <p key={idx} className="min-h-[1em]">{segments}</p>;
      })}
    </div>
  );
};

export default function ValidationDrawer({ validation, onClose, onUpdateStatus }: ValidationDrawerProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [viewMode, setViewMode] = useState<'MARKDOWN' | 'RAW'>('MARKDOWN');
  const [copiedInfo, setCopiedInfo] = useState<{ text: string; type: 'path' | 'command' | 'validation' } | null>(null);

  const handleCopyNotification = (text: string, type: 'path' | 'command' | 'validation') => {
    if (type === 'validation') {
      const event = new CustomEvent('select-validation', { detail: { id: text } });
      window.dispatchEvent(event);
    } else {
      setCopiedInfo({ text, type });
      setTimeout(() => setCopiedInfo(null), 2000);
    }
  };

  const handleUpdate = async (status: 'PASS' | 'FAIL' | 'PARKED') => {
    if (!validation) return;
    setIsUpdating(true);
    try {
      const res = await fetch(`${API_URL}/api/validations/${validation.id}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-workspace-id': 'stillwater-suite'
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        if (onUpdateStatus) onUpdateStatus(validation.id, status);
      }
    } catch (err) {
      console.error('Failed to update validation:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const content = (
    <AnimatePresence>
      {validation && (
        <>
          {/* Backdrop (Invisible but clickable for closing if desired, or skip for side-by-side) */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-[2px]"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md z-[70] bg-[#0A0A0B] border-l border-white/10 shadow-[-20px_0_50px_rgba(0,0,0,0.5)] flex flex-col"
          >
            {/* Header */}
            <div className="p-6 border-b border-white/10 bg-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary border border-primary/20 shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)]">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-white uppercase tracking-widest leading-none mb-1">Protocol Entry</h2>
                  <p className="text-[10px] text-white/40 font-mono tracking-tighter uppercase">{validation.id}</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
              {/* Module Tag & Title */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black font-mono text-primary bg-primary/10 px-3 py-1 rounded border border-primary/20 tracking-widest uppercase">
                    {validation.tag}
                  </span>
                  <span className="text-[10px] font-black font-mono text-white/30 tracking-[0.2em] uppercase">
                    {validation.group}
                  </span>
                </div>
                <h1 className="text-2xl font-bold text-white leading-tight">
                  {validation.title}
                </h1>
              </div>

              {/* Status Indicator */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full animate-pulse ${
                    validation.status === 'PASS' ? 'bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)]' :
                    validation.status === 'FAIL' ? 'bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.5)]' :
                    'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]'
                  }`} />
                  <span className="text-xs font-black text-white/90 uppercase tracking-widest">
                    Current Status: {validation.status}
                  </span>
                </div>
                <Clock className="w-4 h-4 text-white/20" />
              </div>

              {/* Instructions */}
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 text-primary">
                  <div className="flex items-center gap-2">
                    <Play className="w-4 h-4" />
                    <h3 className="text-xs font-black uppercase tracking-widest">Verification Steps</h3>
                  </div>
                  {/* Markdown vs Raw Toggle */}
                  <div className="flex items-center gap-1 p-0.5 rounded-xl bg-white/5 border border-white/10 shrink-0">
                    <button
                      onClick={() => setViewMode('MARKDOWN')}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                        viewMode === 'MARKDOWN'
                          ? "bg-primary text-black shadow-[0_0_12px_rgba(var(--primary-rgb),0.3)]"
                          : "text-white/40 hover:text-white"
                      )}
                    >
                      Rendered
                    </button>
                    <button
                      onClick={() => setViewMode('RAW')}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                        viewMode === 'RAW'
                          ? "bg-white/10 text-white"
                          : "text-white/40 hover:text-white"
                      )}
                    >
                      Raw
                    </button>
                  </div>
                </div>
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 border-l-4 border-l-primary leading-relaxed text-sm text-white/80 font-medium relative group">
                  {renderInstructions(validation.instructions, viewMode, handleCopyNotification)}
                  
                  {/* Floating Notification for copied path */}
                  <AnimatePresence>
                    {copiedInfo && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute bottom-3 right-3 px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 border border-green-500/30 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 backdrop-blur-md shadow-lg"
                      >
                        <Check className="w-3 h-3 text-green-400" />
                        {copiedInfo.type === 'path' ? 'Copied Path!' : 'Copied Command!'}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Expected Result */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-indigo-400">
                  <Check className="w-4 h-4" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-indigo-400">Expected Outcome</h3>
                </div>
                <div className="p-5 rounded-2xl bg-indigo-400/5 border border-indigo-400/10 border-l-4 border-l-indigo-400 leading-relaxed text-sm text-white/80 font-medium italic">
                  "{validation.expectedResult}"
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-6 bg-white/5 border-t border-white/10">
              <div className="grid grid-cols-2 gap-4">
                <button 
                  disabled={isUpdating}
                  onClick={() => handleUpdate('PASS')}
                  className="group relative flex items-center justify-center gap-2 py-4 rounded-xl bg-green-500/10 hover:bg-green-500 text-green-500 hover:text-white border border-green-500/20 transition-all font-black uppercase tracking-widest text-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Verify Pass
                </button>
                <button 
                  disabled={isUpdating}
                  onClick={() => handleUpdate('FAIL')}
                  className="flex items-center justify-center gap-2 py-4 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 transition-all font-black uppercase tracking-widest text-xs"
                >
                  <Ban className="w-4 h-4" />
                  Mark Fail
                </button>
              </div>
              <button 
                disabled={isUpdating}
                onClick={() => handleUpdate('PARKED')}
                className="w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white border border-white/10 transition-all font-black uppercase tracking-widest text-[10px]"
              >
                <Pause className="w-3 h-3" />
                Park for Later Review
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}
