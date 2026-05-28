# Manual Validation Plan: Persona Expert System v1.0

This plan outlines the steps required to verify the end-to-end functionality of the automated Persona expert system, ensuring sensors, distillation, and prompt injection are working correctly and securely.

---

## 1. Environment Startup
**Objective**: Ensure all system components start in the correct order.

1.  Stop any existing Persona processes.
2.  Run `./scripts/start-persona.sh`.
3.  **Verify**:
    - [x] [AI] Bridge Daemon starts on port 3006.
    - [x] [AI] Distiller service logs "🧠 Persona Distiller Service Active".
    - [x] [AI] Background sensors log "🧠 Persona Heartbeat Sensor Active".
    - [x] [AI] Next.js UI starts on port 3005.

---

## 2. Sensor Integrity & Security
**Objective**: Verify that activity is captured and sensitive data is filtered.### 2.1 Terminal Sensor (Filtering)
1.  Open a new terminal session.
2.  Run a benign command: `ls -la ~/projects`.
3.  Run a sensitive command: `export SECRET_KEY=12345`.
4.  **Verify**:
    - [x] [AI] Benign command appears in Bridge logs (`tail -f /home/heidless/projects/Persona/logs/bridge.log`).
    - [x] [AI] Sensitive command (`export`) DOES NOT appear in Bridge logs.### 2.2 Project Heartbeat
1.  Open a file in `~/projects/SuiteUtils/` and make a small edit (e.g., add a comment).
2.  Wait 10 seconds.
3.  **Verify**:
    - [x] [AI] Log shows: `[Heartbeat] Active work detected in ...`.
    - [x] [AI] Bridge records a `heartbeat` observation.

---

## 3. Neural Ingestion (The Distiller)
**Objective**: Verify automated AI analysis of raw activity.

1.  Perform a series of related technical actions (e.g., 3-4 `git` commands or editing multiple CSS files).
2.  Wait 2 minutes (distillation interval).
3.  **Verify**:
    - [x] [AI] Distiller logs: `[Distiller] Distilling X observations...`.

---

## 4. Sovereign Promotion (Glass Box)
**Objective**: Verify the "Promotion" loop updates the local-first profile.

1.  In the Persona UI, identify a candidate insight.
2.  Click **"Retain Insight"**.
3.  **Verify**:

---

## 5. Prompt Engine & Identity Injection
**Objective**: Verify that the AI's "Technical Consciousness" is updated.

1.  Visit `http://localhost:3005/api/persona/prompt` in your browser.
2.  **Verify**:

---

## 6. Cleanup & Reset
1.  [AI] Verify that stopping the script (`Ctrl+C`) correctly kills all 5 background PIDs (Bridge, Distiller, Git, Heartbeat, Conv Sensor).
