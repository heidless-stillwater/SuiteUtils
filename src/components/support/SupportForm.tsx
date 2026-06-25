// src/components/support/SupportForm.tsx

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Send, AlertCircle } from "lucide-react";
import { ActionModal } from "../common/ActionModal";
import { API_URL } from "../../lib/api-config";
import { useAuth } from "../../contexts/AuthContext";

/**
 * Premium support ticket form.
 * Uses the same glass‑morphism design language as the rest of the app.
 * Submits a POST request to /api/support/ticket – the backend endpoint
 * implemented in `server/routes/support.ts`.
 */
export function SupportForm() {
  const { user } = useAuth();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [app, setApp] = useState("SuiteUtils");
  const [func, setFunc] = useState("");
  const [priority, setPriority] = useState("medium");
  const [metadata, setMetadata] = useState(""); // JSON string for optional extra data
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSuccess, setModalSuccess] = useState(true);
  const [modalMessage, setModalMessage] = useState("");

  const resetForm = () => {
    setSubject("");
    setDescription("");
    setApp("SuiteUtils");
    setFunc("");
    setMetadata("");
    setPriority("medium");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      setModalSuccess(false);
      setModalMessage("Subject and description are required.");
      setModalOpen(true);
      return;
    }
    setIsSubmitting(true);
    try {
      const token = user ? await user.getIdToken() : "";
      const payload = {
        subject,
        description,
        app,
        function: func,
        priority,
        metadata: metadata ? JSON.parse(metadata) : {},
      };
      const res = await fetch(`${API_URL}/api/support/ticket`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setModalSuccess(true);
        setModalMessage("Ticket submitted successfully! Your ticket ID is " + data.ticket.id);
        resetForm();
      } else {
        setModalSuccess(false);
        setModalMessage(data.error || "Failed to submit ticket.");
      }
    } catch (err: any) {
      setModalSuccess(false);
      setModalMessage(err.message ?? "Unexpected error.");
    } finally {
      setIsSubmitting(false);
      setModalOpen(true);
    }
  };

  return (
    <motion.div
      className="glass-panel p-8 rounded-2xl"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <h2 className="text-2xl font-bold text-white mb-4">Support Request</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary" />
          <input
            type="text"
            placeholder="Subject"
            className="input-cinematic"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={isSubmitting}
          />
        </div>
        <textarea
          placeholder="Description"
          className="input-cinematic h-32 resize-none"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isSubmitting}
        />
        <div className="flex gap-4">
          <div className="flex-1">
            <select
              className="input-cinematic"
              style={{ colorScheme: 'dark' }}
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              disabled={isSubmitting}
            >
              <option value="low" className="bg-slate-900 text-white">Priority: Low</option>
              <option value="medium" className="bg-slate-900 text-white">Priority: Medium</option>
              <option value="high" className="bg-slate-900 text-white">Priority: High</option>
              <option value="critical" className="bg-slate-900 text-white">Priority: Critical</option>
            </select>
          </div>
          <div className="flex-1">
            <input
              type="text"
              placeholder="App Context"
              className="input-cinematic"
              value={app}
              onChange={(e) => setApp(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
        </div>
        <input
          type="text"
          placeholder="Function (optional)"
          className="input-cinematic"
          value={func}
          onChange={(e) => setFunc(e.target.value)}
          disabled={isSubmitting}
        />
        <textarea
          placeholder="Metadata (JSON, optional)"
          className="input-cinematic h-20 resize-none"
          value={metadata}
          onChange={(e) => setMetadata(e.target.value)}
          disabled={isSubmitting}
        />
        <button
          type="submit"
          className="btn-primary w-full flex items-center justify-center gap-2"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
          {isSubmitting ? "Submitting…" : "Send Ticket"}
        </button>
      </form>
      <ActionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={() => setModalOpen(false)}
        title={modalSuccess ? "Success" : "Error"}
        message={modalMessage}
        confirmLabel="OK"
        confirmVariant={modalSuccess ? "primary" : "danger"}
        type="deploy"
        isLoading={false}
      />
    </motion.div>
  );
}
