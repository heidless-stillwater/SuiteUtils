# URL_SHORTENER_PLAN_0: Architectural Blueprint & Strategy (Security-Hardened)

**Phase**: Brainstorming & Understanding Lock Loop
**Objective**: Build a clean, responsive SaaS URL Shortener app, integrated seamlessly into the Stillwater App Suite.

---

## 🏗️ 1. App Suite Integration & Architecture

The URLShortener will live at `/home/heidless/projects/URLShortener` and act as a standalone micro-frontend that connects to the broader Stillwater ecosystem. 

**Suite Awareness Strategy:**
- **Shared Identity**: It will utilize the same unified Firebase Auth patterns (and cross-app sync APIs) established by mature apps like `PromptTool`, ensuring immediate recognition across the ecosystem.
- **Global Navigation**: The app's header/sidebar will include a "Suite Switcher" allowing users to easily navigate back to PromptTool, PromptResources, PlanTune, etc.
- **SaaS Consistency**: We will mirror the Stripe integration and pricing tier terminology directly from the master app (PromptTool).
- **Backend-for-Frontend (BFF) Pattern**: Following the `mandatory-secure-web-skills` guidelines, the frontend will interact strictly with secure Next.js Server Actions and server-side routes rather than directly executing raw Firestore queries on the client. This keeps database configuration, roles, and rate limit validation securely isolated on the server.

---

## 🗄️ 2. Database Schema (`urlshortener-db-0`)

We will use the already-provisioned isolated Firestore instance `urlshortener-db-0` exclusively. The default database will NOT be used under any circumstances.

### `urls` Collection
Stores the mappings between short codes and long URLs.
- `id` (String): The generated short code (e.g., `aB3x9`) - used as the document ID for O(1) lookup.
- `originalUrl` (String): The destination URL.
- `createdAt` (Timestamp): Creation date.
- `userId` (String | null): UID of the creator (null if generated anonymously).
- `clicks` (Number): Total click count.
- `status` (String): `active`, `disabled`, or `flagged`.
- `customAlias` (Boolean): Flag indicating if this was a custom-chosen alias (SaaS feature).

### `users` Collection
Mirrors the Suite's standard user schema, extended for URL metrics.
- `id` (String): Firebase Auth UID.
- `email` (String): User's email (e.g., `heidlessemail18@gmail.com` as Master Admin / SU).
- `roles` (Array<String>): e.g., `['user']`, `['admin']`, `['su']`.
- `plan` (String): Subscription tier (e.g., `novice`, `hobbyist`, `premium`, `professional` - mapping to PromptTool tiers).
- `stripeCustomerId` (String): For billing integration.
- `settings` (Map): Standard account settings (Dark Mode, Notifications, etc.).

### `analytics` Collection (Subcollection under `urls` - Optional SaaS Feature)
- `timestamp` (Timestamp)
- `referrer` (String)
- `userAgent` (String)
- `country` (String)

---

## 🔄 3. Core User Flows

1. **The Anonymous Flow (Frictionless Core):**
   - User lands on the homepage, pastes a long URL, hits "Shorten".
   - A short code is generated and written to `urlshortener-db-0`.
   - The shortened URL is displayed instantly with a "Copy to Clipboard" button.
2. **The Redirection Flow:**
   - User visits `[domain]/[shortCode]`.
   - Middleware or dynamic route fetches the `urls` document from `urlshortener-db-0`.
   - If found, increments the `clicks` counter and triggers a 301/302 redirect.
3. **The Authenticated SaaS Flow:**
   - User signs in (or SSO from the Suite).
   - Can view a dashboard of all their created links.
   - Access to Stripe billing portal to upgrade to premium tiers.
   - **Admin capabilities**: If `roles` includes `admin` or `su`, the user accesses an Admin Dashboard to view global link metrics, suspend abusive URLs, and manage users.

---

## 🛡️ 4. Security Threat Model
*(Determined via `determine-threat-model` skill)*

### Component Overview
A Next.js 14+ standalone micro-frontend built on React, connecting to isolated Firestore `urlshortener-db-0`. Serving high-throughput anonymous redirections, dynamic rate-limited link generation, and premium SaaS management interfaces.

### Entry Points and Untrusted Inputs
| Entry Point | Type | Trusted? | Validation |
|---|---|---|---|
| `/api/shorten` / Server Actions | HTTP POST | No | URL pattern match, strict check for `http://` / `https://` prefixes to prevent `javascript:` and `data:` XSS, rate-limiting lookup |
| `/[shortCode]` | HTTP GET | No | Parameter format validation (alphanumeric pattern, length 5-10 chars), DB record existence check, status checks (`active`) |
| Admin Dashboard APIs | HTTP POST/PATCH | No | Full role verification (`admin` or `su`), custom limit configuration range validation, CSRF checks |
| Auth SSO Callback | HTTP GET | No | Firebase Auth token validation via HTTPS, verification of shared billing status with `prompttool-db-0` |

### Trust Boundaries and Auth Assumptions
- **Authentication**: CENTRALIZED Firebase Auth (SSO from PromptTool / SuiteUtils standard).
- **Authorization**: Role-based access control (RBAC) via User document `roles` attribute (`['user']`, `['admin']`, `['su']`). Ownership check on resource mutations (users can only edit/delete their own links).
- **Implicit trust**: The app trusts `prompttool-db-0` shared billing records verified via the backend Firebase Admin SDK.
- **Boundary crossings**: End-user to Admin dashboard, Anonymous visitor to Authenticated SaaS portal.

### Sensitive Data Paths
| Data Type | Source | Destination | Protection |
|---|---|---|---|
| Billing/Subscription status | `prompttool-db-0` | `urlshortener-db-0` / Client state | Server-side read via Firebase Admin SDK, read-only cache, secure token validation |
| Original URL | User input | Firestore / HTTP Redirect | Strict URL scheme validation (`https://` or `http://` only), output escaping in dashboard UI |
| User/Admin credentials | Auth Context | Server APIs | Secure, stateless session tokens, HttpOnly/Secure cookies if used |

### Privileged Actions
| Action | Location | Guard |
|---|---|---|
| Edit global rate limits | Server Action / API | Server-side `roles.includes('admin') || roles.includes('su')` |
| Flag/Disable URL | Server Action / API | Server-side `roles.includes('admin') || roles.includes('su')` |
| Delete custom alias link | Server Action / API | Strict owner UID match or Admin/SU role |

### Priority Review Areas
1. **Dynamic Redirection Sink**: Ensure `/[shortCode]` redirection route strictly checks for valid `http://` or `https://` schemes, completely preventing open javascript/data protocol execution XSS.
2. **Firestore Rules & BFF Layer**: Ensure all DB operations go through secure server-side routes or strict Firestore Security Rules checking resource ownership and roles.
3. **Rate Limiting Engine**: IP-based rate limiting logic to prevent Firestore database read/write exhaustion from anonymous requests.

---

## ❓ 5. Clarifying Questions & Architectural Agreements

1. **Anonymous Rate Limiting [RESOLVED]:** Implement strict IP limiting. Add configuration in the Admin dashboard to customize this max limit dynamically, including the ability to toggle it to "unlimited".
2. **SaaS Value Proposition [RESOLVED]:** All premium features (Custom Aliases, Advanced Analytics, API Access) will be locked behind the SaaS paywall tiers (`premium`, `professional`).
3. **Hosting Domain [RESOLVED]:** The app will be deployed on a dedicated Subdomain (e.g., `s.stillwater.com` or `link.prompttool.com`) to isolate traffic, protect the root domain's SEO/security reputation, and maintain brand cohesion.
4. **Suite Navigation [RESOLVED]:** Implement a "Unified App Drawer" (9-dot Waffle menu). It will be a cinematic, glassmorphic modal powered by Framer Motion, linking to production URLs of all Suite apps.
5. **Admin Designation [RESOLVED]:** SuiteUtils Target Expansion. We will update the existing `update_suite_targets.ts` and `seed_architect_user.ts` scripts inside SuiteUtils. Running the global seed command will push `heidlessemail18@gmail.com` as the master admin into `urlshortener-db-0` alongside the other apps, ensuring global orchestration consistency.
6. **Stripe Billing Architecture [RESOLVED]:** Shared Suite Subscription (Umbrella Billing). The URL Shortener will not have its own standalone checkout. It will read the user's existing subscription tier from `prompttool-db-0`. If they are `premium` on PromptTool, they automatically unlock premium shortener features.

---

## 🛠️ 6. Verification Plan
*(Structured via `create-security-implementation-plan` skill)*

### Automated Security Check
- **Security Scanner**: Run the `run_security_scanner` automated checking tool on all newly created files to identify common vulnerabilities (e.g., XSS, SQL injection). If findings are detected, auto-apply the fix and document the results.
- **Security Audit**: Audit the new code for design-level security issues (input validation, secrets handling, auth checks). Document findings and remediations in the `walkthrough.md` artifact using the `generate_security_audit_report` skill.

### Manual Verification Checklist
- **Strict Protocol Filtering**: Test inputting raw payloads like `javascript:alert(1)`, `data:text/html,...`, or relative URLs. Verify they are safely rejected, only allowing absolute web protocols `http://` or `https://`.
- **Ecosytem Admin Authentication**: Log in as `heidlessemail18@gmail.com` and ensure global orchestrator role validation displays the administration settings correctly.
- **BFF Boundary Tests**: Try requesting admin APIs from a regular non-admin account, and verify that they fail-close with HTTP 403 Forbidden.
