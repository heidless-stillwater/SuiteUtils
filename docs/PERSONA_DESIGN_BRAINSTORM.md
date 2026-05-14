# Persona — Design Brainstorm & Architectural Decisions

> **Status**: Design Decisions Locked — Proceeding to Implementation
> **Date**: 2026-05-08
> **Architect**: Antigravity (Gemini 3 Flash)

---

## 1. What Is Persona?

**Persona is a Persona Persistence Engine.** It solves the problem of AI amnesia — every new session, the AI forgets who you are, what you've built, and how you think. Persona eliminates that.

### The Core Problem
- **(A)** "I have to re-explain who I am every session" ← **Primary frustration**
- **(B)** "The AI doesn't remember what we built together" ← **Primary frustration**
- **(C)** "I want the AI to proactively anticipate my architectural decisions"

### The 30-Day Vision
> The AI Persona — named "heidless" — will startup and join my efforts as a senior partner in my activities. I retain all executive control but heidless has developed into my right hand — particularly providing technical insights and observations.

---

## 2. Architecture Classification

### Layer A: Configuration Layer (MVP)
A persistent memory + persona system that feeds context into whatever AI assistant the user is working with (Antigravity, ChatGPT, Gemini, etc.). The system ensures the AI is immediately aware of:
- Who the user is (persona, expertise level)
- How to communicate (style, brevity, tone)
- What they've built together (episodic memory)
- Architectural preferences and patterns

### Layer B: Standalone Chatbot Product (Future Evolution)
A deployable AI chatbot with its own inference backend where "heidless" becomes a product other users can create their own version of.

---

## 3. Locked Design Decisions

### 3.1 Persistence Format: **Hybrid**
A flat profile provides instant "cold start" identity. Episodic memory provides growth. Both are required.

- **The Skeleton (Flat Profile)**: Who you are — persona, expertise, communication style, architectural principles
- **The Muscle (Episodic Memory)**: What you've learned together — a timeline of observations, decisions, and patterns
- **The Loop**: Episodes get distilled into new profile traits over time — creating a self-reinforcing learning system

### 3.2 Transparency Model: **Glass Box**
- Automated observations are staged in a "Pending Verification" queue
- User reviews and "Promotes" learned traits to their core persona
- Specific categories (e.g., "Coding Style") can be set to **Auto-Absorb** mode
- User retains full veto power at all times

### 3.3 Multi-Sensor Context (Selectable)
Users can toggle which data sources feed into the learning engine:

| Sensor | Description | MVP? |
|:---|:---|:---|
| **Neural Link** | Chat & reasoning patterns, behavioral alignment | ✅ Yes |
| **Syntactic Signature** | Coding patterns and abstractions | ❌ Later |
| **Terminal Echo** | CLI habits, bash/zsh history | ❌ Later |
| **Git Lineage** | Commit messaging, versioning habits | ❌ Later |

### 3.4 Connectivity: **Background Daemon**
- System must work when the AI assistant is "asleep"
- A local Node/Express daemon serves the user's config to browser-based apps
- Always-on availability via `pm2` or `systemd`

### 3.5 Multi-User SaaS
- Not a single-user local tool — a cloud-based SaaS product
- Firebase Auth for user isolation
- Each customer gets their own persona sandbox
- Centralized Stripe billing

### 3.6 SaaS Tier Structure

| Tier | Price | Features |
|:---|:---|:---|
| **Free** | £0 | 1 persona, 5 saved traits, basic profile export |
| **Pro** | £9/mo | Unlimited personas, episodic memory (90 days), multi-device sync, suite integration |
| **Architect** | £29/mo | Everything in Pro + unlimited history, team profiles, API access, priority support |

### 3.7 Tech Stack: **Next.js 14**
- API routes built-in for Bridge daemon and Stripe webhooks
- Single deployable unit (no separate Express server)
- Matches PromptTool patterns in the Stillwater Suite

### 3.8 Identity
- **App Name**: Persona
- **AI Persona Name**: "heidless" (user's default; each SaaS user names their own)
- **Port**: 3005 (UI)

---

## 4. Injection Model

```
┌──────────────────────┐
│   Persona Dashboard  │  ← User configures persona, preferences, learned traits
│   (Web App - :3005)  │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   Persona Profile    │  ← Stored in Firestore (cloud) + local mirror
│   (Per-User Record)  │
└──────────┬───────────┘
           │
     ┌─────┴──────┐
     ▼            ▼
┌─────────┐  ┌──────────┐
│ Local   │  │ Suite    │
│ ~/.config│  │ Apps     │
│ /persona│  │ inject   │
└─────────┘  └──────────┘
     │            │
     ▼            ▼
  AI Agent      PromptTool/etc
  reads at      read persona
  session start at runtime
```

---

## 5. Pending Decisions (Q7–Q10)

### Q7: Firebase Project
- **Decision**: Use `heidless-apps-2` (isolated project for persona-v0)
- **Firebase Config**:
  ```javascript
  const firebaseConfig = {
    apiKey: "AIzaSyAIxCHDN8J-zi3h4ms7hqVbN0qd2YDUGhU",
    authDomain: "persona-db-0.firebaseapp.com",
    projectId: "persona-db-0",
    storageBucket: "persona-db-0.firebasestorage.app",
    messagingSenderId: "789026577646",
    appId: "1:789026577646:web:02f956491553340b0fa7ff",
    measurementId: "G-XHYC5BPFL3"
  };
  ```
- **Status**: LOCKED

### Q8: Local Mirror Strategy
- **Decision**: Read-only snapshot exported to `~/.config/persona/profile.json`
- **Status**: LOCKED

### Q9: MVP Views
- **Decision**: Dashboard, Persona Editor, Memory Timeline, Sensors, Settings (Stripe)
- **Status**: LOCKED

### Q10: Project Location
- **Decision**: `/home/heidless/projects/Persona`
- **Status**: LOCKED

---

## 6. User Persona (The Default "heidless" Profile)

```json
{
  "persona": "Senior Full Stack Developer & Systems Architect & Designer web. Senior UI Designer",
  "communicationStyle": "Professional & Brief",
  "architecturalPrinciples": [
    "Clean Architecture",
    "Separation of Concerns",
    "Scalable Component Design",
    "Premium UI Aesthetics (Glassmorphism, Cinematic Density)"
  ]
}
```

---

## 7. Next Steps

1. Confirm Q7–Q10
2. Generate final Implementation Plan
3. Scaffold `Persona` with Next.js 14
4. Implement core Persona Editor and local mirror
5. Register in SuiteUtils Registry

## 8. Learned Preferences

- **Architecture**: Prefer stable, proven stack versions (Next.js 14, Firebase 10) over bleeding-edge/experimental versions (Next.js 16) to ensure environment-aware reliability.
- **Styling**: Tailwind 3 (standard config) for consistency across the Stillwater Suite.
