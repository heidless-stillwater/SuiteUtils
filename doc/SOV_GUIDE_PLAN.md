# 🏰 Sovereign Control Guide Remediation Plan

This document outlines the finalized strategy to resolve the contradictory implementations of the "Sovereign Control Guide" commands in the Persona app. By using a single source of truth and a build-time synchronization pipeline, we will keep all command details in sync with zero runtime overhead.

---

## 🔍 1. Current State & Inconsistencies

1. **Frontend**: `Persona/src/components/GuideModal.tsx` hardcodes 13 commands in `COMMAND_DETAILS`.
2. **Backend**: `Persona/bridge/commands/help.js` hardcodes 11 commands.
3. **Mismatches**: 
   - `!distiller` is missing from the frontend guide.
   - `!baseline`, `!alamo`, and `!finalize` are missing from the backend help command.

---

## 🧭 2. Decided Architecture & Design Decisions

Through a collaborative grilling session, the following choices have been locked in:

1. **Storage Location & Format**:
   - **Source of Truth**: [guide.config.json](file:///home/heidless/projects/SuiteUtils/config/guide.config.json) (a structured JSON configuration file at the root config folder of `SuiteUtils`).
   - **Fidelity**: This file will store the *complete union* of all command descriptions, parameter options, and examples from both frontend and backend guides without any loss of detail.
   
2. **Synchronization Pattern**:
   - **Build-Time Generation**: A TypeScript script (`scripts/sync-guide.ts` in `SuiteUtils`) will validate the source JSON file and write output JSON files directly to the respective directories:
     - [guide-data.json](file:///home/heidless/projects/Persona/src/components/guide-data.json) (imported by frontend `GuideModal.tsx`).
     - [guide-data.json](file:///home/heidless/projects/Persona/bridge/commands/guide-data.json) (imported by backend `help.js`).

3. **Execution Hook**:
   - **Automatic Triggering**: Integrated directly into `package.json` dev and build script hooks:
     - `"predev": "npm run sync-guide"` or `"dev": "npm run sync-guide && next dev"`
     - `"prebuild": "npm run sync-guide"` or `"build": "npm run sync-guide && next build"`
   - This ensures the UI is always up-to-date with zero manual steps.

---

## 🛠️ 3. Structural Breakdown & Proposed Changes

Below is the architectural breakdown of the changes we propose to make:

### File 1: Source Config
- **Path**: `SuiteUtils/config/guide.config.json`
- **Action**: Create new file.
- **Content**: A map of command keys to details:
  ```json
  {
    "!suite": {
      "description": "Orchestrate apps (start, stop, restart, attach)",
      "category": "System & Orchestration",
      "example": "!suite start | !suite stop prompttool | !suite restart video",
      "options": [
        { "opt": "start", "desc": "Bootstrap the full stack (UI, Bridge, Sensors) in a tmux session" },
        ...
      ]
    },
    ...
  }
  ```

### File 2: Sync Script
- **Path**: `SuiteUtils/scripts/sync-guide.ts`
- **Action**: Create new file.
- **Content**: Script that reads `guide.config.json`, runs basic schema validation, and copies/writes it to:
  1. `Persona/src/components/guide-data.json`
  2. `Persona/bridge/commands/guide-data.json`

### File 3: Frontend Component Refactor
- **Path**: `Persona/src/components/GuideModal.tsx`
- **Action**: Modify file.
- **Changes**:
  - Remove hardcoded `COMMAND_DETAILS` object.
  - Import `guide-data.json` statically.
  - Map dynamic entries to build categories and list views.

### File 4: Backend CLI Command Refactor
- **Path**: `Persona/bridge/commands/help.js`
- **Action**: Modify file.
- **Changes**:
  - Remove hardcoded `commands` object.
  - Read `guide-data.json` statically.
  - Construct command descriptions and lists dynamically from the shared dataset.

### File 5: Package.json Integration
- **Path**: `Persona/package.json`
- **Action**: Modify file.
- **Changes**:
  - Add `"sync-guide": "npx tsx ../SuiteUtils/scripts/sync-guide.ts"` script.
  - Prepend `npm run sync-guide` to `"dev"` and `"build"`.

---

## 📋 4. Validation Plan

To ensure zero regressions:
1. **VAL-SYS-051**: Run `!help` and `!help distiller` on the backend chat and verify all commands return matching help texts.
2. **VAL-UI-046**: Open the Guide modal in the Persona app UI and verify all 13 commands are rendered with identical sub-options, categories, and styles as before, including the newly added `!distiller`.
