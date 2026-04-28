Activating obra/superpowers/brainstorming.

App home directory: /home/heidless/projects/SuiteUtils
Generate a plan in "./docs/" called "SUITE_UTILS_PLAN_0" to achieve the following.


═══════════════════════════════════════════════════════════════
1. STILLWATER ECOSYSTEM REGISTRY
═══════════════════════════════════════════════════════════════

The complete Stillwater App Suite consists of SEVEN applications.
Remember these apps, locations, databases, hosting targets, and
deployment methods at all times:

  ┌─────────────────────┬──────────────────────────────────┬────────────────────────┬───────────────────────────┬────────────────┐
  │ App                 │ Path                             │ Firestore Database     │ Hosting Target            │ Deploy Method  │
  ├─────────────────────┼──────────────────────────────────┼────────────────────────┼───────────────────────────┼────────────────┤
  │ ag-video-system     │ ~/projects/ag-video-system       │ autovideo-db-0         │ videosystem-v0            │ Firebase       │
  │ PromptTool          │ ~/projects/PromptTool            │ prompttool-db-0        │ prompttool-v0             │ Firebase       │
  │ PromptResources     │ ~/projects/PromptResources       │ promptresources-db-0   │ promptresources-v0        │ Firebase       │
  │ PromptMasterSPA     │ ~/projects/PromptMasterSPA       │ promptmaster-db-0      │ promptmaster-v0           │ Firebase       │
  │ PromptAccreditation │ ~/projects/PromptAccreditation   │ promptaccreditation-db-0│ promptaccreditation-v0   │ Firebase       │
  │ PlanTune            │ ~/projects/PlanTune              │ plantune-db-0          │ Cloud Run (us-central1)   │ Cloud Build    │
  │ SuiteUtils (NEW)    │ ~/projects/SuiteUtils            │ suiteutils-db-0        │ TBD                       │ TBD            │
  └─────────────────────┴──────────────────────────────────┴────────────────────────┴───────────────────────────┴────────────────┘

  All apps share GCP project: heidless-apps-0
  DO NOT use the "(default)" Firestore database for SuiteUtils — use "suiteutils-db-0" exclusively.


═══════════════════════════════════════════════════════════════
2. OBJECTIVE
═══════════════════════════════════════════════════════════════

Create a NEW application "SuiteUtils" — the central technical
operations hub for the entire Stillwater App Suite.

SuiteUtils is the infrastructure command centre that manages
deployment, monitoring, theme governance, and lifecycle
operations across all suite apps.

DO NOT modify any existing app's source code. Only CREATE files
in ~/projects/SuiteUtils. READ other apps for reference only.


═══════════════════════════════════════════════════════════════
3. CORE FEATURE: DEPLOYMENT ORCHESTRATOR
═══════════════════════════════════════════════════════════════

3a. Multi-App Deployment Console
   • Deploy any COMBINATION of apps in a single operation.
   • Each app already has successful live deployment configs —
     inspect each app's firebase.json, .firebaserc,
     cloudbuild.yaml, deploy.sh, and Dockerfile for the
     correct settings. DO NOT hardcode — read from source.
   • Support both Firebase Hosting and Cloud Build/Cloud Run
     deployment methods.
   • Provide a checklist UI to select which apps to deploy.

3b. Per-App Operation Control
   • For each app in an active deployment batch, provide:
     – Real-time status indicator (queued / building / deploying / live / failed)
     – Elapsed time counter
     – Estimated time to completion (from expert system — see 3d)
     – Progress bar or step indicator
   • Controls per app: PAUSE, STOP, START, REMOVE from batch.
   • Overall batch summary: total elapsed, estimated remaining,
     success/failure count.

3c. Deployment History & Statistics
   • Log every deployment with:
     – Timestamp, app name, duration, success/failure,
       build size, error logs (if any), deploy method used.
   • Store all stats in Firestore (suiteutils-db-0).
   • Provide a history view with filtering by app, date range,
     and outcome.

3d. Expert System (Learning Estimator)
   • Build an expert system that improves over time:
     – Initially: use heuristic estimates based on app type
       (Firebase ~2min, Cloud Build ~5min).
     – As data accumulates: use rolling averages per app,
       weighted toward recent deployments.
     – Surface confidence intervals alongside estimates.
   • The expert system should expose its reasoning
     (e.g. "Based on 12 prior deploys of PromptTool,
     avg build time: 1m42s ±15s").

3e. Deployment Rollback — HYBRID STRATEGY (Placeholder Only)
   • DECIDED: Use a hybrid rollback approach:
     – Firebase apps → Firebase Hosting version revert
       (instant, API-driven, no rebuild).
     – PlanTune → Cloud Run revision rollback
       (route traffic to a prior revision, instant).
     – Fallback → Git-based redeploy (checkout prior commit
       and run full build+deploy) as a manual nuclear option.
   • Each deployment record must store:
     – firebaseVersionId (for Firebase rollback)
     – cloudRunRevision (for Cloud Run rollback)
     – gitCommitSha (for git-based fallback)
   • Create a UI placeholder with a "Coming Soon" badge.
   • DO NOT implement the rollback execution logic yet.
   • Design the data model now so it's ready when we implement.


═══════════════════════════════════════════════════════════════
4. CORE FEATURE: THEME MANAGEMENT SYSTEM
═══════════════════════════════════════════════════════════════

   • Build a fully functional theme editor and selector.
   • This is a PROOF OF CONCEPT / PROTOTYPE for suite-wide
     theme governance.

4a. DECIDED: Hierarchical Scope (Suite Default + User Override)
   • Admin sets a suite-wide default theme.
   • Individual users CAN override it for themselves.
   • Data model must support both layers:

     Suite level (suites/{suiteId}):
       defaultThemeId: "stillwater-midnight"
       themes: { "stillwater-midnight": { ...tokens }, ... }

     User level (users/{uid}):
       themeOverrideId: "ocean-deep" | null  (null = use suite default)

   • FOR THE PROTOTYPE: Build the suite-default theme selector.
     Design the data model for user overrides but DO NOT build
     the user-override UI yet.

4b. Theme Tokens
   • The Stillwater design tokens are defined in
     stillwater-tokens.css (see PromptMasterSPA/src/ for the
     canonical reference). These include:
     – Color palette (bg, text, accent, status colors)
     – Gradients & glass depth system
     – Typography scale
     – Shadow, spacing, radius scales
     – Kinetic transitions
   • Allow creating, editing, previewing, and saving named themes.
   • FOR NOW: only apply the selected theme to SuiteUtils itself.
   • Data model should support future cross-app theme distribution.


═══════════════════════════════════════════════════════════════
5. SUITE AWARENESS & ARCHITECTURE
═══════════════════════════════════════════════════════════════

5a. DECIDED: Full Multi-Tenancy
   • SuiteUtils MUST support MULTIPLE suites per user.
   • A user can define suites like "Stillwater Production",
     "Stillwater Staging", "Client X Suite", etc.
   • Each suite contains a set of apps with their own configs.
   • Provide a suite selector in the global UI (similar to
     org/workspace selectors in tools like Vercel or Stripe).

5b. DECIDED: Lightweight Environment Tags
   • Within each suite, each app gets an environment tag:
     production, staging, or dev.
   • The tag drives which hosting target / Cloud Run service
     to deploy to.
   • No separate GCP projects per environment — just different
     hosting sites or services within heidless-apps-0.
   • The deploy console UI should show an environment dropdown
     per app in the deployment checklist.
   • For the prototype: default "Stillwater" suite with all apps
     tagged "production". The dropdown exists but only has
     "production" as an option until staging targets are created.

5c. Data Model
   • Maintain a "suites" collection in Firestore (suiteutils-db-0):
     suites/{suiteId}:
       name: "Stillwater"
       ownerId: uid
       apps: {
         "prompttool": {
           displayName: "PromptTool"
           path: "~/projects/PromptTool"
           database: "prompttool-db-0"
           environments: {
             "production": {
               hostingTarget: "prompttool-v0"
               deployMethod: "firebase"
               lastDeployAt: Timestamp
               status: "live"
             }
             "staging": {
               hostingTarget: null  // not configured yet
               deployMethod: "firebase"
               status: "not-configured"
             }
           }
         }
         // ... other apps
       }

   • Include a suite-level health dashboard aggregating
     status across all apps.


═══════════════════════════════════════════════════════════════
6. AUTHENTICATION & ACCOUNT SETTINGS
═══════════════════════════════════════════════════════════════

   • Use Firebase Authentication (Google sign-in), matching
     the pattern in PromptTool's auth-context.tsx.
   • Standard Account Settings page:
     – Display name, email, avatar
     – Admin designation toggle (for SU/admin roles)
     – Linked accounts / sign-out
   • Role model: mirror PromptTool's effectiveRole / switchRole
     / isSu / isAdmin pattern.


═══════════════════════════════════════════════════════════════
7. SAAS INTEGRATION & MONETISATION
═══════════════════════════════════════════════════════════════

   • This app MAY be offered as a SaaS product.
   • Integrate fully into the Stillwater suite alongside
     PromptTool, PromptResources, etc.
   • Use the SAME Stripe keys, webhook patterns, and checkout
     flow as PromptTool (see src/lib/stripe.ts,
     src/app/api/stripe/checkout/route.ts,
     src/app/api/stripe/webhook/route.ts).
   • Include a Pricing page with tiered plans
     (mirror PromptTool's SUBSCRIPTION_PLANS pattern).
   • Include the SuiteSwitcher navigation component for
     cross-app navigation.


═══════════════════════════════════════════════════════════════
8. APP STYLING
═══════════════════════════════════════════════════════════════

   • Use PromptMasterSPA as the EXEMPLAR for all style decisions:
     – Stillwater design tokens (stillwater-tokens.css)
     – Cinematic glass-panel / glass-card system
     – brand-gradient-text, premium-label typography
     – Badge system (badge-primary, badge-accent, badge-success)
     – Custom scrollbar styling
     – Inter (body) + Outfit (headings) font pairing
     – Dark-mode-first, slate/teal/emerald palette
   • Match the visual density, spacing rhythm, and motion
     language of PromptMasterSPA.


═══════════════════════════════════════════════════════════════
9. SUGGESTED ADDITIONAL CAPABILITIES
═══════════════════════════════════════════════════════════════

Please evaluate and suggest which of these (or others) belong
in SuiteUtils. I want your creative input:

   • Environment variable manager (centralised .env governance)
   • Firestore rules / indexes diff & deploy across apps
   • Dependency audit dashboard (outdated packages, security)
   • Cross-app log aggregator / error monitor
   • Database backup & migration tooling
   • CI/CD pipeline visualiser
   • SSL / domain / DNS management console
   • Suite-wide analytics dashboard (build times, uptime, costs)
   • Runbook / playbook system for common operations

Feel free to propose additional ideas. Get creative.


═══════════════════════════════════════════════════════════════
10. META-INSTRUCTIONS
═══════════════════════════════════════════════════════════════

   • Interrogate me for clarifications as you build the plan.
   • Use PromptTool terminology throughout (e.g. "Studio",
     "Vault", "Sovereign" patterns where applicable).
   • The plan should be structured as an implementation plan
     with phases, dependencies, and verification criteria.
   • I value your suggestions, thoughts, and opinions —
     flag anything you'd do differently or see as a risk.
   • DO NOT modify any files outside ~/projects/SuiteUtils.
