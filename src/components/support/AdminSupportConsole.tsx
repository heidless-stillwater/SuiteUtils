// src/components/support/AdminSupportConsole.tsx

import React, { useState, useEffect } from "react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  PieChart, 
  Pie, 
  Cell 
} from "recharts";
import { 
  Ticket, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Search, 
  Filter, 
  MessageSquare, 
  User, 
  Send, 
  X, 
  ChevronRight, 
  Zap, 
  AlertCircle 
} from "lucide-react";
import { API_URL } from "../../lib/api-config";
import { useAuth } from "../../contexts/AuthContext";
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

const PRIORITY_COLORS = {
  low: { text: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10", bar: "#10b981" },
  medium: { text: "text-blue-400 border-blue-500/20 bg-blue-500/10", bar: "#3b82f6" },
  high: { text: "text-amber-400 border-amber-500/20 bg-amber-500/10", bar: "#f59e0b" },
  critical: { text: "text-rose-400 border-rose-500/20 bg-rose-500/10", bar: "#ef4444" },
};

const STATUS_COLORS = {
  open: { text: "text-sky-400 border-sky-500/20 bg-sky-500/10", dot: "bg-sky-500" },
  "in-progress": { text: "text-indigo-400 border-indigo-500/20 bg-indigo-500/10", dot: "bg-indigo-500" },
  resolved: { text: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10", dot: "bg-emerald-500" },
  closed: { text: "text-slate-400 border-slate-500/20 bg-slate-500/10", dot: "bg-slate-500" },
};

const APP_PIE_COLORS = ["#6366f1", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#a855f7", "#ec4899"];

export function AdminSupportConsole() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [appFilter, setAppFilter] = useState<string>("all");

  // Selected Ticket Modal
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [adminComment, setAdminComment] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = user ? await user.getIdToken() : "";
      const res = await fetch(`${API_URL}/api/support/admin/tickets`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        throw new Error("Failed to fetch tickets");
      }
      const data = await res.json();
      setTickets(data.tickets || []);
    } catch (err: any) {
      console.error("[AdminSupportConsole] fetch error:", err);
      setError(err.message || "Failed to load tickets.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTicket = async (ticketId: string, status?: string, priority?: string, commentText?: string) => {
    setUpdating(true);
    try {
      const token = user ? await user.getIdToken() : "";
      const res = await fetch(`${API_URL}/api/support/admin/tickets/${ticketId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status, priority, comment: commentText }),
      });
      if (!res.ok) {
        throw new Error("Failed to update ticket");
      }
      const data = await res.json();
      const updated = data.ticket;

      // Update in local state
      setTickets(prev => prev.map(t => t.id === ticketId ? updated : t));
      if (selectedTicket && selectedTicket.id === ticketId) {
        setSelectedTicket(updated);
      }
      setAdminComment("");
    } catch (err: any) {
      alert("Error updating ticket: " + err.message);
    } finally {
      setUpdating(false);
    }
  };

  // Metrics Calculations
  const totalCount = tickets.length;
  const openCount = tickets.filter(t => t.status === "open").length;
  const inProgressCount = tickets.filter(t => t.status === "in-progress").length;
  const activeCount = openCount + inProgressCount;
  const resolvedCount = tickets.filter(t => t.status === "resolved").length;

  // SLA (Avg hours from open to resolved)
  const resolvedWithSLA = tickets.filter(t => t.status === "resolved" && t.resolvedAt);
  let avgSLADisplay = "N/A";
  if (resolvedWithSLA.length > 0) {
    const totalMs = resolvedWithSLA.reduce((acc, t) => {
      const start = new Date(t.createdAt).getTime();
      const end = new Date(t.resolvedAt!).getTime();
      return acc + (end - start);
    }, 0);
    const avgHrs = (totalMs / resolvedWithSLA.length) / (1000 * 60 * 60);
    avgSLADisplay = avgHrs < 24 ? `${avgHrs.toFixed(1)}h` : `${(avgHrs / 24).toFixed(1)}d`;
  }

  // 1. Volume Trend (last 7 days)
  const trendData = (() => {
    const dataList = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateString = d.toISOString().split("T")[0];
      const count = tickets.filter(t => t.createdAt.startsWith(dateString)).length;
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      dataList.push({ name: label, Tickets: count });
    }
    return dataList;
  })();

  // 2. App Distribution Data
  const appData = (() => {
    const counts: Record<string, number> = {};
    tickets.forEach(t => {
      const app = t.app || "SuiteUtils";
      counts[app] = (counts[app] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  })();

  // 3. Status Distribution
  const statusData = [
    { name: "Open", value: openCount, color: "#38bdf8" },
    { name: "In Progress", value: inProgressCount, color: "#818cf8" },
    { name: "Resolved", value: resolvedCount, color: "#34d399" },
    { name: "Closed", value: tickets.filter(t => t.status === "closed").length, color: "#94a3b8" }
  ].filter(s => s.value > 0);

  // Filtered Tickets
  const filteredTickets = tickets.filter(t => {
    const matchesSearch = 
      t.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.userEmail || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.description.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || t.priority === priorityFilter;
    const matchesApp = appFilter === "all" || t.app === appFilter;

    return matchesSearch && matchesStatus && matchesPriority && matchesApp;
  });

  // Extract unique app contexts for filter dropdown
  const uniqueApps = Array.from(new Set(tickets.map(t => t.app || "SuiteUtils")));

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card-static p-6 flex items-center justify-between">
          <div>
            <p className="text-white/40 text-xs font-semibold uppercase tracking-wider">Total Tickets</p>
            <h3 className="text-3xl font-bold text-white mt-1">{totalCount}</h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 text-white/60">
            <Ticket className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-card-static p-6 flex items-center justify-between">
          <div>
            <p className="text-white/40 text-xs font-semibold uppercase tracking-wider">Active Issues</p>
            <h3 className="text-3xl font-bold text-sky-400 mt-1">{activeCount}</h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-sky-500/10 flex items-center justify-center border border-sky-500/20 text-sky-400">
            <Clock className="w-6 h-6 animate-pulse" />
          </div>
        </div>

        <div className="glass-card-static p-6 flex items-center justify-between">
          <div>
            <p className="text-white/40 text-xs font-semibold uppercase tracking-wider">Resolved SLA</p>
            <h3 className="text-3xl font-bold text-emerald-400 mt-1">{resolvedCount}</h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-card-static p-6 flex items-center justify-between">
          <div>
            <p className="text-white/40 text-xs font-semibold uppercase tracking-wider">Avg Resolution SLA</p>
            <h3 className="text-3xl font-bold text-indigo-400 mt-1">{avgSLADisplay}</h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400">
            <Zap className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Analytics Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Volume Trend */}
        <div className="glass-panel p-5 rounded-2xl lg:col-span-2">
          <h4 className="text-sm font-semibold text-white/80 mb-4">Ticket Volume Trend (Last 7 Days)</h4>
          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorTickets" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "rgba(15, 23, 42, 0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "#fff" }} 
                />
                <Area type="monotone" dataKey="Tickets" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorTickets)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: App distribution */}
        <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-semibold text-white/80 mb-4">Tickets by App Context</h4>
            {appData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-white/20 text-xs">No data available</div>
            ) : (
              <div className="w-full h-48 flex justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={appData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {appData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={APP_PIE_COLORS[index % APP_PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: "rgba(15, 23, 42, 0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "#fff" }} 
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4 text-[11px]">
            {appData.map((entry, i) => (
              <div key={entry.name} className="flex items-center gap-1.5 truncate text-white/60">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: APP_PIE_COLORS[i % APP_PIE_COLORS.length] }} />
                <span className="truncate">{entry.name} ({entry.value})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Ticket List and Filter controls */}
      <div className="glass-panel p-6 rounded-2xl space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Ticket className="w-5 h-5 text-primary" />
            Support Queries ({filteredTickets.length})
          </h3>
          
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            {/* Search */}
            <div className="relative flex-1 md:w-64 md:flex-none">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                placeholder="Search subject, email..."
                className="input-cinematic !pl-10 !h-10 text-xs"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Status Filter */}
            <select
              className="input-cinematic !h-10 !w-auto text-xs py-0"
              style={{ colorScheme: 'dark' }}
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="in-progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>

            {/* Priority Filter */}
            <select
              className="input-cinematic !h-10 !w-auto text-xs py-0"
              style={{ colorScheme: 'dark' }}
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
            >
              <option value="all">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>

            {/* App Filter */}
            <select
              className="input-cinematic !h-10 !w-auto text-xs py-0"
              style={{ colorScheme: 'dark' }}
              value={appFilter}
              onChange={e => setAppFilter(e.target.value)}
            >
              <option value="all">All Apps</option>
              {uniqueApps.map(app => (
                <option key={app} value={app}>{app}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Tickets Grid/Table */}
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="p-8 text-center text-white/30 text-sm border border-dashed border-white/10 rounded-xl">
            No support tickets match the current filters.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/20">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-white/60 uppercase font-semibold tracking-wider">
                  <th className="p-4">Ticket</th>
                  <th className="p-4">User</th>
                  <th className="p-4">Context</th>
                  <th className="p-4">Priority</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Submitted</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-white/80">
                {filteredTickets.map(ticket => {
                  const prioInfo = PRIORITY_COLORS[ticket.priority] || PRIORITY_COLORS.medium;
                  const statInfo = STATUS_COLORS[ticket.status] || STATUS_COLORS.open;
                  const dateString = format(new Date(ticket.createdAt), "MMM d, yyyy HH:mm");
                  
                  return (
                    <tr 
                      key={ticket.id}
                      className="hover:bg-white/5 transition-colors cursor-pointer group"
                      onClick={() => setSelectedTicket(ticket)}
                    >
                      <td className="p-4">
                        <div className="font-semibold text-white max-w-[200px] truncate">{ticket.subject}</div>
                        <div className="text-[10px] text-white/40 mt-0.5"><code>{ticket.id}</code></div>
                      </td>
                      <td className="p-4">
                        <div className="max-w-[150px] truncate font-medium">{ticket.userEmail || "N/A"}</div>
                        <div className="text-[10px] text-white/40 mt-0.5 max-w-[150px] truncate"><code>{ticket.userId}</code></div>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 font-mono text-[10px]">
                          {ticket.app || "SuiteUtils"}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${prioInfo.text}`}>
                          {ticket.priority}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-medium uppercase ${statInfo.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statInfo.dot}`} />
                          {ticket.status}
                        </span>
                      </td>
                      <td className="p-4 text-white/50">{dateString}</td>
                      <td className="p-4 text-center">
                        <button 
                          className="btn-ghost !p-1 bg-white/5 rounded-lg border border-white/10 hover:bg-primary/20 hover:border-primary/50 group-hover:opacity-100 opacity-60 transition-all"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTicket(ticket);
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

      {/* Ticket Management Detail Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col rounded-3xl border border-white/10 shadow-2xl animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-white/40 font-mono">SUPPORT TICKET ID: {selectedTicket.id}</span>
                <h3 className="text-lg font-bold text-white mt-1">{selectedTicket.subject}</h3>
              </div>
              <button 
                onClick={() => setSelectedTicket(null)}
                className="p-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left Column: Details & Comments */}
              <div className="md:col-span-2 space-y-6">
                <div className="bg-black/20 p-5 rounded-2xl border border-white/5">
                  <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Description</h4>
                  <p className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed">{selectedTicket.description}</p>
                </div>

                {/* Comments Timeline */}
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4" />
                    Timeline & Responses ({selectedTicket.comments?.length || 0})
                  </h4>

                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                    {/* Submission Event */}
                    <div className="flex gap-3 text-xs">
                      <div className="flex flex-col items-center">
                        <div className="w-6 h-6 rounded-full bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
                          <User className="w-3.5 h-3.5" />
                        </div>
                        <div className="w-0.5 flex-1 bg-white/10 my-1" />
                      </div>
                      <div className="flex-1 bg-white/5 rounded-xl p-3 border border-white/5">
                        <div className="flex justify-between items-center mb-1 text-[10px] text-white/40">
                          <span className="font-semibold text-white/70">Ticket Submitted</span>
                          <span>{format(new Date(selectedTicket.createdAt), "MMM d, yyyy HH:mm")}</span>
                        </div>
                        <p className="text-white/60">Issue created by {selectedTicket.userEmail}</p>
                      </div>
                    </div>

                    {/* Timeline Comments */}
                    {selectedTicket.comments?.map((comment, index) => {
                      const isLast = index === selectedTicket.comments.length - 1;
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
                              <span className="font-semibold text-indigo-300">Response from {comment.authorEmail}</span>
                              <span>{format(new Date(comment.createdAt), "MMM d, yyyy HH:mm")}</span>
                            </div>
                            <p className="text-white/80 whitespace-pre-wrap">{comment.text}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Reply Form */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Add Response & Update User</h4>
                  <div className="relative">
                    <textarea
                      placeholder="Type a response to update the ticket history and send an email update..."
                      className="input-cinematic !h-24 resize-none !pr-12 text-xs py-3"
                      value={adminComment}
                      onChange={e => setAdminComment(e.target.value)}
                      disabled={updating}
                    />
                    <button
                      className="absolute right-3 bottom-3 p-2 rounded-xl bg-primary text-black hover:bg-accent transition-colors disabled:opacity-50"
                      disabled={!adminComment.trim() || updating}
                      onClick={() => handleUpdateTicket(selectedTicket.id, undefined, undefined, adminComment)}
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                  <span className="text-[10px] text-white/30 block">Note: Adding a comment automatically dispatches a notification email if the ticket is In Progress or Resolved.</span>
                </div>
              </div>

              {/* Right Column: Metadata & Controls */}
              <div className="space-y-4 border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-6">
                {/* Management Operations */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Lifecycle Management</h4>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] text-white/50 block">Status Transition</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        className={`px-3 py-2 rounded-xl border text-xs font-bold text-center transition-all ${
                          selectedTicket.status === 'open' 
                            ? 'bg-sky-500/20 border-sky-400 text-sky-400' 
                            : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                        }`}
                        onClick={() => handleUpdateTicket(selectedTicket.id, "open")}
                        disabled={updating}
                      >
                        Open
                      </button>
                      <button
                        className={`px-3 py-2 rounded-xl border text-xs font-bold text-center transition-all ${
                          selectedTicket.status === 'in-progress' 
                            ? 'bg-indigo-500/20 border-indigo-400 text-indigo-400' 
                            : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                        }`}
                        onClick={() => handleUpdateTicket(selectedTicket.id, "in-progress")}
                        disabled={updating}
                      >
                        In Progress
                      </button>
                      <button
                        className={`px-3 py-2 rounded-xl border text-xs font-bold text-center transition-all ${
                          selectedTicket.status === 'resolved' 
                            ? 'bg-emerald-500/20 border-emerald-400 text-emerald-400' 
                            : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                        }`}
                        onClick={() => handleUpdateTicket(selectedTicket.id, "resolved")}
                        disabled={updating}
                      >
                        Resolve
                      </button>
                      <button
                        className={`px-3 py-2 rounded-xl border text-xs font-bold text-center transition-all ${
                          selectedTicket.status === 'closed' 
                            ? 'bg-slate-500/20 border-slate-400 text-slate-400' 
                            : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                        }`}
                        onClick={() => handleUpdateTicket(selectedTicket.id, "closed")}
                        disabled={updating}
                      >
                        Close
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] text-white/50 block">Override Priority</label>
                    <select
                      className="input-cinematic !h-10 text-xs"
                      style={{ colorScheme: 'dark' }}
                      value={selectedTicket.priority}
                      onChange={e => handleUpdateTicket(selectedTicket.id, undefined, e.target.value)}
                      disabled={updating}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                </div>

                {/* Ticket Details */}
                <div className="bg-white/5 border border-white/5 rounded-2xl p-4 space-y-3 text-xs text-white/70">
                  <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Ticket Info</h4>
                  <div className="flex justify-between">
                    <span className="text-white/40">User Email:</span>
                    <span className="font-semibold text-white">{selectedTicket.userEmail || "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">User ID:</span>
                    <span className="font-mono text-[10px] truncate max-w-[140px]" title={selectedTicket.userId}>{selectedTicket.userId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">App Context:</span>
                    <span className="font-mono">{selectedTicket.app}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Function:</span>
                    <span className="font-mono">{selectedTicket.function || "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Created:</span>
                    <span>{format(new Date(selectedTicket.createdAt), "MMM d, yyyy HH:mm")}</span>
                  </div>
                  {selectedTicket.resolvedAt && (
                    <div className="flex justify-between text-emerald-400">
                      <span>Resolved:</span>
                      <span>{format(new Date(selectedTicket.resolvedAt), "MMM d, yyyy HH:mm")}</span>
                    </div>
                  )}
                </div>

                {/* Metadata JSON */}
                {selectedTicket.metadata && Object.keys(selectedTicket.metadata).length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Metadata</h4>
                    <pre className="p-3 bg-black/40 border border-white/5 rounded-xl font-mono text-[10px] text-white/60 overflow-x-auto max-h-40">
                      {JSON.stringify(selectedTicket.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
