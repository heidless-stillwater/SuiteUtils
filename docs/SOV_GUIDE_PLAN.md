# 🏰 Sovereign Control Guide Remediation Plan

This document outlines the analysis and proposed strategy to resolve the contradictory implementations of the "Sovereign Control Guide" commands in the Persona app, establishing a single source of truth ("src") and a reliable management mechanism.

---

## 🔍 1. Current State & Conflict Analysis

Currently, command metadata is duplicated and inconsistent across two separate layers of the Persona app stack:

1. **Frontend Presentation**:
   - **File**: `Persona/src/components/GuideModal.tsx`
   - **Mechanism**: Hardcoded `COMMAND_DETAILS` object inside the client-side Next.js React component.
   - **Scope**: Contains 13 commands (`!suite`, `!validate`, `!verify`, `!baseline`, `!alamo`, `!finalize`, `!np`, `!remember`, `!forget`, `!status`, `!sync`, `!attach`, `!help`) and details their subcommands/options.
   
2. **Backend/CLI Execution**:
   - **File**: `Persona/bridge/commands/help.js`
   - **Mechanism**: Hardcoded `commands` object inside the bridge CLI interpreter.
   - **Scope**: Contains 11 commands (`np`, `remember`, `forget`, `status`, `suite`, `sync`, `validate`, `verify`, `attach`, `distiller`, `help`).
   - **Discrepancy**: 
     - **Missing in Frontend**: `!distiller` is documented in `help.js` but completely missing from `GuideModal.tsx`.
     - **Missing in Backend Help**: `!baseline`, `!alamo`, and `!finalize` are documented in `GuideModal.tsx` but missing from `help.js`.

3. **Potential Placeholder**:
   - **File**: `SuiteUtils/docs/GUIDE.md` exists but is currently empty (0 bytes).

---

## 🧭 2. Architectural Objectives

1. **Keep Current Content Unchanged**: The existing command definitions, options, descriptions, and examples must not lose any fidelity or detail.
2. **Single Source of Truth ("src")**: Define one location where the command guides are written.
3. **Simple Management**: Adding or modifying a command or subcommand must be straightforward (e.g., editing a JSON/YAML file or a Firestore document).
4. **Sync Mechanism**: The frontend UI and the backend CLI help should pull from this "src".

---

## ⚔️ 3. The Grill Matrix: Design Options

We must evaluate options across three categories: **Storage Location**, **Data Format**, and **Synchronization Pattern**.

### A. Storage Location & Format (Where is "src"?)
1. **Option A.1: Local File (JSON / YAML)**
   - *Description*: Save a structured config file (e.g., `guide.config.json`) in `SuiteUtils/config/` or `Persona/config/`.
   - *Pros*: Extremely simple to edit, version-controlled by git.
   - *Cons*: Modifying requires a git commit; doesn't dynamically update a running production instance without redeployment/restart.
2. **Option A.2: Firestore Database (persona-db-0)**
   - *Description*: Store command metadata in a Firestore collection (e.g. `system_config/guide`).
   - *Pros*: Can be updated in real-time without code deployments; leverages the database already used by Persona.
   - *Cons*: Cannot be easily tracked in Git history; requires a UI/script to modify easily instead of a plain text file.
3. **Option A.3: Markdown File (SuiteUtils/docs/GUIDE.md)**
   - *Description*: Write the guide in standard markdown format in the existing `GUIDE.md` file.
   - *Pros*: Human-readable, native markdown editing.
   - *Cons*: Requires writing a markdown parser script to ingest and structure it for the frontend component and backend command.

### B. Synchronization Mechanism (How to update?)
1. **Option B.1: Static Compile-Time Generation (Sync Script)**
   - *Description*: A script (e.g., `npm run sync-guide`) reads the "src" config and generates/writes:
     - The static React file `GuideModal.tsx` (or a JSON import it uses).
     - The static bridge file `help.js` (or a JSON import it uses).
   - *Pros*: Zero database lookup latency; standard typesafe bundler output; zero runtime overhead.
   - *Cons*: Updates require running the script and redeploying.
2. **Option B.2: Dynamic Runtime Fetching (API / Database)**
   - *Description*: The frontend and backend fetch the commands dynamically at runtime:
     - Either directly from Firestore.
     - Or from a next.js backend endpoint `/api/guide` that reads the "src" file.
   - *Pros*: Real-time updates without building or redeploying.
   - *Cons*: Introduces query latency and potential API fail paths.

---

## 📝 4. Next Steps & Action Plan
1. **Alignment**: Resolve options via interactive grilling.
2. **Implementation Draft**:
   - Create the source schema and move all current command details into the new "src".
   - Refactor `GuideModal.tsx` and `help.js` to consume from this source.
   - Create any necessary synchronization scripts or API routes.
3. **Verification**: Run local tests (VAL-UI-046, VAL-SYS-051) to verify registry alignment.
