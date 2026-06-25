import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Mail, 
  LifeBuoy,
  HelpCircle, 
  Ticket, 
  ShieldAlert, 
  ChevronDown, 
  Clock, 
  ChevronRight, 
  X, 
  MessageSquare, 
  User,
  Zap,
  AlertCircle
} from "lucide-react";
import { SupportForm } from "../components/support/SupportForm";
import { AdminSupportConsole } from "../components/support/AdminSupportConsole";
import { useAuth } from "../contexts/AuthContext";
import { API_URL } from "../lib/api-config";
import { format } from "date-fns";

interface Comment {
  id: string;
  authorId: string;
  authorEmail: string;
  text: string;
  createdAt: string;
}

interface SupportTicket {
  id: string;
  userId: string;
  userEmail: string;
  subject: string;
  description: string;
  app: string;
  function: string;
  priority: "low" | "medium" | "high" | "critical";
  status: "open" | "in-progress" | "resolved" | "closed";
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  comments: Comment[];
  metadata?: any;
}

interface FAQ {
  question: string;
  answer: string;
}

const PRIORITY_COLORS = {
  low: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10",
  medium: "text-blue-400 border-blue-500/20 bg-blue-500/10",
  high: "text-amber-400 border-amber-500/20 bg-amber-500/10",
  critical: "text-rose-400 border-rose-500/20 bg-rose-500/10",
};

const STATUS_COLORS = {
  open: { text: "text-sky-400 border-sky-500/20 bg-sky-500/10", dot: "bg-sky-500" },
  "in-progress": { text: "text-indigo-400 border-indigo-500/20 bg-indigo-500/10", dot: "bg-indigo-500" },
  resolved: { text: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10", dot: "bg-emerald-500" },
  closed: { text: "text-slate-400 border-slate-500/20 bg-slate-500/10", dot: "bg-slate-500" },
};

export function SupportPage() {
  const { user, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<"submit" | "history" | "faq" | "admin">("history");
  
  // User Ticket History State
  const [userTickets, setUserTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [selectedUserTicket, setSelectedUserTicket] = useState<SupportTicket | null>(null);

  // FAQs State
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loadingFaqs, setLoadingFaqs] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  useEffect(() => {
    if (activeTab === "history") {
      fetchUserTickets();
    } else if (activeTab === "faq") {
      fetchFAQs();
    }
  }, [activeTab]);

  const fetchUserTickets = async () => {
    setLoadingTickets(true);
    setTicketError(null);
    try {
      const token = user ? await user.getIdToken() : "";
      const res = await fetch(`${API_URL}/api/support/tickets`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        throw new Error("Failed to load your tickets.");
      }
      const data = await res.json();
      setUserTickets(data.tickets || []);
    } catch (err: any) {
      console.error("[SupportPage] user tickets fetch error:", err);
      setTicketError(err.message || "Failed to load ticket history.");
    } finally {
      setLoadingTickets(false);
    }
  };

  const fetchFAQs = async () => {
    setLoadingFaqs(true);
    try {
      const token = user ? await user.getIdToken() : "";
      const res = await fetch(`${API_URL}/api/support/faqs`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        throw new Error("Failed to load FAQs");
      }
      const data = await res.json();
      setFaqs(data || []);
    } catch (err: any) {
      console.error("[SupportPage] FAQ fetch error:", err);
    } finally {
      setLoadingFaqs(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <LifeBuoy className="w-7 h-7 text-primary" />
            Support Center
          </h1>
          <p className="text-xs text-white/50 mt-1">
            Submit issues, view ticket status, read FAQs, and manage queries.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex bg-black/40 border border-white/5 p-1 rounded-2xl self-start md:self-auto">
          <button
            onClick={() => setActiveTab("submit")}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all duration-200 flex items-center gap-1.5 ${
              activeTab === "submit"
                ? "bg-primary text-black shadow-lg shadow-primary/20"
                : "text-white/60 hover:text-white/90"
            }`}
          >
            <LifeBuoy className="w-3.5 h-3.5" />
            Submit Request
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all duration-200 flex items-center gap-1.5 ${
              activeTab === "history"
                ? "bg-primary text-black shadow-lg shadow-primary/20"
                : "text-white/60 hover:text-white/90"
            }`}
          >
            <Ticket className="w-3.5 h-3.5" />
            My Tickets
          </button>
          <button
            onClick={() => setActiveTab("faq")}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all duration-200 flex items-center gap-1.5 ${
              activeTab === "faq"
                ? "bg-primary text-black shadow-lg shadow-primary/20"
                : "text-white/60 hover:text-white/90"
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            FAQs & Docs
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab("admin")}
              className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all duration-200 flex items-center gap-1.5 ${
                activeTab === "admin"
                  ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/20"
                  : "text-indigo-400 hover:text-indigo-300"
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Admin Console
            </button>
          )}
        </div>
      </div>

      {/* Tab Panels */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.25 }}
        >
          {activeTab === "submit" && (
            <div className="max-w-2xl mx-auto py-4">
              <SupportForm />
            </div>
          )}

          {activeTab === "history" && (
            <div className="glass-panel p-6 rounded-2xl space-y-4">
              <h3 className="text-lg font-bold text-white">Your Submitted Tickets</h3>
              
              {loadingTickets ? (
                <div className="h-64 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-white/20 border-t-primary rounded-full animate-spin" />
                </div>
              ) : ticketError ? (
                <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-400 text-sm flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{ticketError}</span>
                </div>
              ) : userTickets.length === 0 ? (
                <div className="p-12 text-center text-white/30 text-sm border border-dashed border-white/10 rounded-2xl">
                  You haven't submitted any support tickets yet.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/20">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5 text-white/60 uppercase font-semibold tracking-wider">
                        <th className="p-4">Ticket ID</th>
                        <th className="p-4">Subject</th>
                        <th className="p-4">Priority</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Submitted At</th>
                        <th className="p-4 text-center">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-white/80">
                      {userTickets.map(ticket => {
                        const prioClass = PRIORITY_COLORS[ticket.priority] || PRIORITY_COLORS.medium;
                        const statInfo = STATUS_COLORS[ticket.status] || STATUS_COLORS.open;
                        return (
                          <tr 
                            key={ticket.id} 
                            className="hover:bg-white/5 transition-colors cursor-pointer group"
                            onClick={() => setSelectedUserTicket(ticket)}
                          >
                            <td className="p-4 font-mono text-white/50">{ticket.id}</td>
                            <td className="p-4 font-medium text-white max-w-xs truncate">{ticket.subject}</td>
                            <td className="p-4">
                              <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${prioClass}`}>
                                {ticket.priority}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-medium uppercase ${statInfo.text}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${statInfo.dot}`} />
                                {ticket.status}
                              </span>
                            </td>
                            <td className="p-4 text-white/50">{format(new Date(ticket.createdAt), "MMM d, yyyy HH:mm")}</td>
                            <td className="p-4 text-center">
                              <button 
                                className="btn-ghost !p-1 bg-white/5 rounded-lg border border-white/10 hover:bg-primary/20 hover:border-primary/50 group-hover:opacity-100 opacity-60 transition-all"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedUserTicket(ticket);
                                }}
                              >
                                <ChevronRight className="w-4 h-4 text-white" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === "faq" && (
            <div className="glass-panel p-6 rounded-2xl space-y-4 max-w-4xl mx-auto">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-primary" />
                Frequently Asked Questions
              </h3>
              
              {loadingFaqs ? (
                <div className="h-48 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-white/20 border-t-primary rounded-full animate-spin" />
                </div>
              ) : faqs.length === 0 ? (
                <div className="p-8 text-center text-white/30 text-sm">
                  No FAQs loaded.
                </div>
              ) : (
                <div className="space-y-2">
                  {faqs.map((faq, i) => {
                    const isOpen = openFaqIndex === i;
                    return (
                      <div 
                        key={i} 
                        className="bg-black/20 border border-white/5 rounded-xl overflow-hidden transition-all duration-300"
                      >
                        <button
                          onClick={() => setOpenFaqIndex(isOpen ? null : i)}
                          className="w-full p-4 flex items-center justify-between text-left font-medium text-sm text-white/90 hover:text-white transition-colors"
                        >
                          <span>{faq.question}</span>
                          <ChevronDown className={`w-4 h-4 text-white/50 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
                        </button>
                        <AnimatePresence initial={false}>
                          {isOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <div className="px-4 pb-4 text-xs text-white/60 border-t border-white/5 pt-3 leading-relaxed">
                                {faq.answer}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === "admin" && isAdmin && (
            <AdminSupportConsole />
          )}
        </motion.div>
      </AnimatePresence>

      {/* User Ticket Detail Modal */}
      {selectedUserTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col rounded-3xl border border-white/10 shadow-2xl animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-white/40 font-mono">TICKET ID: {selectedUserTicket.id}</span>
                <h3 className="text-base font-bold text-white mt-1">{selectedUserTicket.subject}</h3>
              </div>
              <button 
                onClick={() => setSelectedUserTicket(null)}
                className="p-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Ticket Stats */}
              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                  <span className="text-white/40 block">Priority</span>
                  <span className={`font-semibold uppercase tracking-wider block mt-1 ${PRIORITY_COLORS[selectedUserTicket.priority] || 'text-white'}`}>
                    {selectedUserTicket.priority}
                  </span>
                </div>
                <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                  <span className="text-white/40 block">Status</span>
                  <span className="font-semibold uppercase tracking-wider block mt-1 text-white">
                    {selectedUserTicket.status}
                  </span>
                </div>
                <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                  <span className="text-white/40 block">App Context</span>
                  <span className="font-semibold block mt-1 text-white truncate">
                    {selectedUserTicket.app || "SuiteUtils"}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div className="bg-black/30 p-4 rounded-xl border border-white/5 text-xs text-white/80 space-y-2">
                <h4 className="font-semibold text-white/40 uppercase tracking-wider">Description</h4>
                <p className="whitespace-pre-wrap leading-relaxed">{selectedUserTicket.description}</p>
              </div>

              {/* Timeline */}
              <div className="space-y-4">
                <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  Ticket Activity
                </h4>

                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {/* Submission Row */}
                  <div className="flex gap-3 text-xs">
                    <div className="flex flex-col items-center">
                      <div className="w-6 h-6 rounded-full bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
                        <User className="w-3.5 h-3.5" />
                      </div>
                      {selectedUserTicket.comments?.length > 0 && <div className="w-0.5 flex-1 bg-white/10 my-1" />}
                    </div>
                    <div className="flex-1 bg-white/5 rounded-xl p-3 border border-white/5">
                      <div className="flex justify-between items-center mb-1 text-[10px] text-white/40">
                        <span className="font-semibold text-white/70">Ticket Submitted</span>
                        <span>{format(new Date(selectedUserTicket.createdAt), "MMM d, yyyy HH:mm")}</span>
                      </div>
                      <p className="text-white/60">Your support query was successfully created.</p>
                    </div>
                  </div>

                  {/* Comment Timeline Row */}
                  {selectedUserTicket.comments?.map((comment, index) => {
                    const isLast = index === selectedUserTicket.comments.length - 1;
                    return (
                      <div key={comment.id} className="flex gap-3 text-xs">
                        <div className="flex flex-col items-center">
                          <div className="w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                            <Zap className="w-3.5 h-3.5" />
                          </div>
                          {!isLast && <div className="w-0.5 flex-1 bg-white/10 my-1" />}
                        </div>
                        <div className="flex-1 bg-indigo-500/5 rounded-xl p-3 border border-indigo-500/10">
                          <div className="flex justify-between items-center mb-1 text-[10px] text-indigo-300/60">
                            <span className="font-semibold text-indigo-300">Support Agent Response</span>
                            <span>{format(new Date(comment.createdAt), "MMM d, yyyy HH:mm")}</span>
                          </div>
                          <p className="text-white/80 whitespace-pre-wrap">{comment.text}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
