'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, 
  Send, 
  Bot, 
  User, 
  Zap, 
  Shield, 
  Cpu, 
  Terminal,
  Loader2,
  X,
  Maximize2,
  Minimize2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Activity,
  History,
  ArrowRight
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { bridge } from '../../../lib/bridge';
import { cn } from '../../../lib/utils';

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

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  status?: 'pending' | 'success' | 'error';
  command?: string;
}

export default function SovereignNeuralChat() {
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('sovereign_chat_history');
    if (saved) return JSON.parse(saved);
    return [
      {
        id: 'welcome',
        role: 'assistant',
        content: '### **[NEURAL_LINK_ESTABLISHED]**\n\n### **[2026-05-16 | 15:55:00]**\n**PROMPT_INTERPRETATION**: System initialization and session resumption.\n**ACTION_TITLE**: Sovereign Core Activation\n**TEMPORAL_METRICS**: Start Time: [Current] | Anticipated Duration: [Instant]\n**ACTION_CONTENT**: Sovereign Neural Interface is fully active. I have full CRUD access to the Stillwater Hive and the "Custom Interface" protocol is engaged.\n**USER_INSTRUCTIONS**: You may now issue high-level architectural directives or natural language queries. All responses will adhere to the 7-point structural protocol.\n**VALIDATION_STRATEGY**: [VAL-SYS-000] - Boot sequence verification.',
        timestamp: new Date().toISOString()
      }
    ];
  });
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [neuralSync, setNeuralSync] = useState<'stable' | 'syncing' | 'error'>('stable');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('sovereign_chat_history', JSON.stringify(messages));
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('sovereign_chat_history', JSON.stringify(messages));
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isSending) return;

    const userText = input.trim();
    setInput('');
    setIsSending(true);
    setNeuralSync('syncing');

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userText,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);

    try {
      // Direct forward to bridge (now handles both commands and general chat)
      const response = await bridge.sendCommand(userText);
      
      // Handle both string results and object results with a message property
      let content = 'Command executed successfully. 🛰️🚀🦾';
      if (response.result) {
        if (typeof response.result === 'string') {
          content = response.result;
        } else if (response.result.message) {
          content = response.result.message;
        }
      } else if (response.error) {
        content = response.error;
      }

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content,
        timestamp: new Date().toISOString(),
        status: response.success ? 'success' : 'error',
        command: response.command
      };

      setMessages(prev => [...prev, assistantMsg]);
      setNeuralSync('stable');
    } catch (err) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '### **[BRIDGE_ERROR]**\n\nFailed to establish link with the Persona Bridge. Ensure the daemon is running on port 3008.',
        timestamp: new Date().toISOString(),
        status: 'error'
      }]);
      setNeuralSync('error');
    } finally {
      setIsSending(false);
    }
  };

  const executeCommand = async (cmdText: string) => {
    if (isSending) return;
    setIsSending(true);
    setNeuralSync('syncing');

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: cmdText,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);

    try {
      const response = await bridge.sendCommand(cmdText);
      let content = 'Command executed successfully. 🛰️🚀🦾';
      if (response.result) {
        if (typeof response.result === 'string') {
          content = response.result;
        } else if (response.result.message) {
          content = response.result.message;
        }
      } else if (response.error) {
        content = response.error;
      }

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content,
        timestamp: new Date().toISOString(),
        status: response.success ? 'success' : 'error',
        command: response.command
      };

      setMessages(prev => [...prev, assistantMsg]);
      setNeuralSync('stable');
    } catch (err) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '### **[BRIDGE_ERROR]**\n\nFailed to establish link with the Persona Bridge. Ensure the daemon is running on port 3008.',
        timestamp: new Date().toISOString(),
        status: 'error'
      }]);
      setNeuralSync('error');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "fixed bottom-6 right-6 z-[200] glass-card flex flex-col shadow-2xl border-primary/20 overflow-hidden transition-all duration-500",
        isMinimized ? "w-72 h-16" : "w-[400px] h-[600px]"
      )}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4 border-b border-white/10 bg-primary/5 cursor-pointer"
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className={cn(
              "p-1.5 rounded-lg border",
              neuralSync === 'stable' ? "bg-primary/20 border-primary/40 text-primary" : 
              neuralSync === 'syncing' ? "bg-orange-500/20 border-orange-500/40 text-orange-400" :
              "bg-red-500/20 border-red-500/40 text-red-400"
            )}>
              <Cpu size={16} className={neuralSync === 'syncing' ? "animate-spin" : ""} />
            </div>
            {neuralSync === 'stable' && (
              <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-green-500 border border-black animate-pulse" />
            )}
          </div>
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-white">Sovereign Neural Chat</h3>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[8px] font-mono text-white/40 uppercase">Bridge: 3008 :: Stable</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isMinimized && (
            <button 
              onClick={(e) => { e.stopPropagation(); setShowHistory(!showHistory); }}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-md transition-all text-[9px] font-black uppercase tracking-widest",
                showHistory ? "bg-primary text-black" : "bg-white/5 text-white/40 hover:text-white"
              )}
            >
              <History size={12} />
              History
            </button>
          )}
          {isMinimized ? <Maximize2 size={14} className="text-white/40" /> : <Minimize2 size={14} className="text-white/40" />}
          <button className="p-1 hover:bg-white/5 rounded-md transition-colors">
            <X size={14} className="text-white/20" />
          </button>
        </div>
      </div>

      {showHistory && !isMinimized && (
        <div className="absolute inset-0 top-[65px] z-[210] bg-[#0A0A0B]/95 backdrop-blur-xl flex flex-col border-t border-white/10">
          <div className="flex items-center justify-between p-4 border-b border-white/5">
            <span className="text-[10px] font-black text-primary uppercase tracking-widest">Neural Prompt Archive</span>
            <button 
              onClick={() => setShowConfirmModal(true)}
              className="text-[8px] font-black text-red-400/60 hover:text-red-400 uppercase tracking-widest transition-colors"
            >
              Clear All
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {messages.filter(m => m.role === 'user').length === 0 ? (
              <div className="py-12 text-center text-white/20 text-[10px] uppercase tracking-widest">No archived prompts.</div>
            ) : (
              messages.filter(m => m.role === 'user').map((msg) => (
                <div 
                  key={msg.id} 
                  onClick={() => { setInput(msg.content); setShowHistory(false); }}
                  className="p-3 rounded-xl bg-white/5 border border-white/10 hover:border-primary/40 cursor-pointer transition-all group"
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[8px] font-mono text-white/20 uppercase">{new Date(msg.timestamp).toLocaleString()}</span>
                    <ArrowRight size={10} className="text-white/0 group-hover:text-primary transition-all" />
                  </div>
                  <p className="text-xs text-white/80 line-clamp-2">{msg.content}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {!isMinimized && (
        <>
          {/* Messages Area */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 bg-black/20 custom-scrollbar"
          >
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={cn(
                  "flex flex-col gap-1",
                  msg.role === 'user' ? "items-end" : "items-start"
                )}
              >
                <div className="flex items-center gap-2 mb-1 px-1">
                  {msg.role === 'assistant' && <Bot size={10} className="text-primary" />}
                  {msg.role === 'user' && <User size={10} className="text-white/40" />}
                  <span className="text-[8px] font-mono text-white/20 uppercase">
                    {msg.role} &bull; {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div 
                  className={cn(
                    "max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed",
                    msg.role === 'user' ? "bg-primary/20 border border-primary/30 text-white" : "bg-white/5 border border-white/10 text-white/80"
                  )}
                >
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h3: ({node, ...props}) => <h3 className="font-black text-primary text-sm tracking-tighter uppercase mt-[10px] first:mt-0" {...props} />,
                        strong: ({node, ...props}) => <strong className="font-bold text-white" {...props} />,
                        a: ({node, href, children, ...props}) => {
                          const isValidationLink = href?.startsWith('validation://') || 
                                                   href?.startsWith('val://') || 
                                                   (href && href.includes('validation=') && (href.startsWith('http') || href.startsWith('/') || href.startsWith('.')));
                          
                          const isCommandLink = href?.startsWith('command://');
                          
                          if (isValidationLink) {
                            let valId = href.replace(/^(validation|val):\/\//, '');
                            if (href.includes('validation=')) {
                              const match = href.match(/[?&]validation=([^&]+)/);
                              if (match) {
                                valId = match[1];
                              }
                            }
                            return (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  const event = new CustomEvent('select-validation', { detail: { id: valId } });
                                  window.dispatchEvent(event);
                                }}
                                className="font-mono font-black text-primary hover:underline cursor-pointer bg-primary/5 px-1 py-0.5 rounded border border-primary/10 inline-flex items-center gap-0.5 transition-all text-[10px]"
                                title={`Click to view validation: ${valId}`}
                              >
                                {children}
                              </button>
                            );
                          }

                          if (isCommandLink) {
                            const cmdText = decodeURIComponent(href.replace(/^command:\/\//, ''));
                            return (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  executeCommand(cmdText);
                                }}
                                className="font-mono font-black text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/20 cursor-pointer bg-indigo-500/10 px-2 py-1 rounded border border-indigo-500/30 inline-flex items-center gap-1.5 transition-all text-[10px] my-0.5 shadow-sm select-none"
                                title={`Click to execute command: ${cmdText}`}
                              >
                                <Zap size={10} className="text-indigo-400 animate-pulse" />
                                {children}
                              </button>
                            );
                          }

                          return (
                            <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 font-bold hover:underline" {...props}>
                              {children}
                            </a>
                          );
                        },
                        code: ({node, className, children, ...props}) => {
                          return <code className="bg-white/10 text-white/80 px-1 py-0.5 rounded font-mono text-xs" {...props}>{children}</code>
                        }
                      }}
                    >{autolinkValidations(msg.content.replace(/`(\[.*?\]\(.*?\))`+/g, '$1'))}</ReactMarkdown>
                  </div>
                  
                  {msg.command && (
                    <div className="mt-2 flex items-center gap-2 p-1.5 rounded-lg bg-black/40 border border-white/5 font-mono text-[9px] text-primary/60">
                      <Terminal size={10} />
                      EXEC: @{msg.command}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isSending && (
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10 w-24">
                <Loader2 size={14} className="animate-spin text-primary" />
                <span className="text-[10px] font-black text-primary animate-pulse">...</span>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-white/10 bg-white/5">
            <div className="relative group">
              <input 
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Neural command..."
                className="w-full bg-black/40 border border-white/10 rounded-xl pl-4 pr-12 py-3 text-xs text-white outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all"
              />
              <button 
                onClick={handleSend}
                disabled={!input.trim() || isSending}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 disabled:opacity-20 transition-all"
              >
                <Send size={14} />
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Sparkles size={10} className="text-primary" />
                <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Autonomous Core Active</span>
              </div>
              <span className="text-[8px] font-mono text-white/10 uppercase">v1.4.2 &bull; ZERO-TOUCH</span>
            </div>
          </div>
        </>
      )}

      {/* Cinematic Confirmation Modal */}
      <AnimatePresence>
        {showConfirmModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[300] bg-[#0A0A0B]/80 backdrop-blur-md flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-sm glass-card border-red-500/30 p-6 rounded-2xl flex flex-col items-center text-center shadow-2xl space-y-4"
            >
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full animate-pulse">
                <AlertCircle size={28} />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-black text-white uppercase tracking-widest">Sovereign Purge Inbound</h4>
                <p className="text-[10px] text-white/50 leading-relaxed font-mono">
                  This action will permanently erase your cognitive chat lineage and reset local memory layers.
                </p>
              </div>
              <div className="flex w-full gap-3 mt-2">
                <button 
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/10 text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  Abort
                </button>
                <button 
                  onClick={() => {
                    setMessages([messages[0]]);
                    setShowHistory(false);
                    setShowConfirmModal(false);
                  }}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-red-500/5"
                >
                  Execute Purge
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
