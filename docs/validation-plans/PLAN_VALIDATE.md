# 🪙 TokenMarket: Manual Validation Test Plan

This validation plan provides the step-by-step test cases to manually verify **Plan Management**, **Subscription Upgrades**, and **Google AdSense Integrations / A/B Experiments** in the TokenMarket application.

## 📋 Prerequisites & Test Accounts Setup

To thoroughly validate all user paths, we will configure three separate test accounts:

1. **Account A (Administrator)**
   - **Email**: `heidlessemail18@gmail.com`
   - **Role**: Automatically bootstrapped as `admin` on Google login.
   - **Purpose**: Accessing the Ad placement editor, controlling experiments, and toggling visual overlays.

2. **Account B (Standard User)**
   - **Email**: Any non-admin tester email (e.g., `test_standard@example.com` or similar Google Account).
   - **Role**: Standard `user` role.
   - **Purpose**: Testing the "Standard" upgrade path and validating banner ad suppression.

3. **Account C (Premium Developer User)**
   - **Email**: Any separate non-admin tester email (e.g., `test_pro@example.com` or similar Google Account).
   - **Role**: Standard `user` role.
   - **Purpose**: Testing the "Pro" upgrade path, API keys, limits, and banner ad suppression.

### Cleanup Check
Before starting any test suite, clear the browser cache and storage elements:
- Open Chrome DevTools (`F12`) -> **Application** -> **Storage** -> Click **Clear site data**.
- Make sure `localStorage` has no active keys (`tokenmarket_ad_bucket` is cleared).

---

## 🛠️ Test Suite 1: User Onboarding & Profile Syncing

### Goal
Verify that logging in creates a Firestore user profile document with the correct default free values.

### Steps
1. Navigate to the application (e.g., `http://localhost:5173` or live staging URL).
2. Click the **Settings** tab (or **Sign In / Profile** link in the footer).
3. Click the **Sign In with Google** button.
4. Log in using **Account B** (non-admin tester email).
5. Open your terminal or check the Firebase Console under the `users` collection for a document with the matching UID.

### Verification Criteria
- [ ] User is signed in and displays their Google avatar and name in the settings panel.
- [ ] **Firestore Verification**: Inspect the document `users/[UID]`. Confirm it has the following fields:
  ```json
  {
    "tier": "free",
    "apiCallLimit": 100,
    "apiCallsUsed": 0,
    "apiExtraCredits": 0,
    "apiKey": "tm_...",
    "role": "user"
  }
  ```
- [ ] On the top navigation bar, the API Tier badge displays **API Tier: Free (Delayed)**, accompanied by an **Upgrade** button.

---

## 💳 Test Suite 2: Upgrade Flow & Stripe Simulation

### Goal
Verify that upgrading to the Standard or Pro tier redirects to Stripe or triggers the simulated checkout fallback, updating the user's tier.

### Steps
1. Log in with **Account B** (Free Tier).
2. Click the **Upgrade** button next to the API Tier badge (or navigate to a page that triggers the `UpgradeModal`).
3. Under the **Standard** tier, click **Upgrade to Standard**.
4. You will see the checkout details view containing simulated card input fields.
5. Enter a mock credit card (e.g., `4242 •••• •••• 4242`), any MM/YY expiry date, and any 3-digit CVC code.
6. Click **Pay Securely & Subscribe**.
7. Wait 2 seconds for the simulated payment check-out to execute.

### Verification Criteria
- [ ] After clicking submit, the button should display a spinner with the text **"Processing Secure Payment..."**.
- [ ] If Stripe is running, verify redirection to the official Stripe checkout page. If unavailable, confirm it falls back cleanly to the simulated modal.
- [ ] **Payment Success Screen**: The modal displays a green checkmark stating: *"Payment Successful! Your TokenMarket subscription has been updated to standard."*
- [ ] Click **Return to Dashboard**. The modal closes, and the API Tier badge in the top right changes immediately to: **API Tier: Premium (Live)** (no Upgrade button should be visible).
- [ ] **Firestore Verification**: Verify `users/[UID]` has updated:
  ```json
  "tier": "standard",
  "apiCallLimit": 10000
  ```

---

## 🚫 Test Suite 3: Ad Placement Display & Premium Suppression

### Goal
Verify that Free tier users see AdSense placements, whereas Standard and Pro tier users do not see ads.

### Steps
1. Sign out of Account B and refresh. Keep the user in a logged-out state (simulating a default guest/Free tier user).
2. Navigate between the **Sector Index** (`token-market` tab) and the **Live Market** (`dashboard` tab).
3. Observe all active ad placements.
4. Log back in with **Account B** (who was upgraded to Standard in Test Suite 2).
5. Navigate back to the **Sector Index** and **Live Market** tabs.

### Verification Criteria
- [ ] **Free Tier (Logged-out / Guest)**:
  - Ad placements display the **Google AdSense Sandbox** placeholder card indicating client publisher ID `pub-6174098740076925`.
  - Placeholders must appear at:
    - **Header Banner** (top of page).
    - **Footer Banner** (above page footer).
    - **Sector Index Sponsorship** (bottom of token lists).
    - **Dashboard Grid sponsored slot** (middle of market graphs).
- [ ] **Premium Tier (Account B - Standard)**:
  - Banners are completely hidden. The surrounding padding and spacers collapse nicely without leaving blank frames or awkward margins.

---

## ⚙️ Test Suite 4: Ad Placement Editor (Admin Interface)

### Goal
Verify that administrators can customize ad placements, modify configurations, and save them.

### Steps
1. Click **Sign Out** and then log in using **Account A** (`heidlessemail18@gmail.com`).
2. Verify that an additional **Sparkles** icon appears in the sidebar menu.
3. Click the **Sparkles** menu icon to open **Ad Placements & Experiments** (`AdsTab`).
4. Select the **Placement Editor** tab.
5. In the left panel, select the **Control (Baseline Ads)** set (or create a custom set using the "Add New Set" button).
6. Enable the `header-banner` slot by checking its checkbox.
7. Change the `Slot ID` value to `9999999999`.
8. Change the `Format` dropdown to `Horizontal`.
9. Click **Save Placements** in the top right.
10. Refresh the page to reload configurations.

### Verification Criteria
- [ ] Click **Save Placements** displays a green success message: *"Placement set saved successfully!"*.
- [ ] **Firestore Verification**: Inspect document `ads_config/main` inside the database. Confirm the JSON structure matches your modifications:
  ```json
  "sets": [
    {
      "id": "control",
      "slots": {
        "header-banner": {
          "enabled": true,
          "slotId": "9999999999",
          "format": "horizontal",
          "responsive": "true",
          "customHeight": 90
        }
      }
    }
  ]
  ```

---

## 🎨 Test Suite 5: Visual Layout Highlight & CLS Shift Metrics

### Goal
Verify that the admin overlays display structural ad placeholders and compute Cumulative Layout Shift (CLS) impacts dynamically.

### Steps
1. Logged in as **Account A** (Admin), observe the floating toolbar at the bottom of the screen: **Ad Experiment Tool**.
2. Click the **Highlight Placements** button on the toolbar.
3. Select the **Live Market** tab to view the page.

### Verification Criteria
- [ ] Highlighting active ad units surrounds placements with a **dashed red border** and a transparent red backdrop.
- [ ] Overlays display key metadata in monospace font:
  - The slot key (e.g. `TOP CONTENT`).
  - Active AdSense Slot ID (e.g. `Slot: 1234567890`).
  - Expected size and CLS layout shift metrics: `CLS Shift: +90px (~11% viewport)`.
- [ ] Disabled slots must display a faint white dashed border with the indicator text: *"[placement-name] slot is empty - Available Placement Opportunity"*.

---

## 🧪 Test Suite 6: A/B Experiments & Split Traffic Routing

### Goal
Verify that administrators can launch traffic-splitting experiments and visitors are assigned to variant buckets.

### Steps
1. Open the **Ad Experiments** tab (`AdsTab`) -> select **A/B Experiments** sub-tab.
2. Enter the name: `Layout Density Validation Test`.
3. Check the variants to participate:
   - `Control (Baseline Ads)`: set weight to `50%`.
   - `Aggressive Ads (All Placements)`: set weight to `50%`.
4. Click **Launch Experiment**.
5. Clear site cookies and local storage (to mimic a new session).
6. Visit the dashboard 10 times in Incognito mode or via private tabs.
7. Check the browser **Local Storage** under the key: `tokenmarket_ad_bucket`.

### Verification Criteria
- [ ] Tapping **Launch Experiment** transitions the dashboard to the running stats table showing variants, traffic weights, page views, clicks, CTR, and revenue.
- [ ] **Local Storage**: The key `tokenmarket_ad_bucket` is stored on page load. Verify it contains the JSON payload matching the current experiment:
  ```json
  {
    "experimentId": "exp-17...",
    "setId": "aggressive" // or "control"
  }
  ```
- [ ] Split traffic is routed; some incognito sessions will cache `aggressive` and others will cache `control`, according to weights.
- [ ] **Firestore Verification**: Check that `ads_config/main` contains `"activeExperiment"` with `status: "running"`.

---

## 📈 Test Suite 7: Analytics Event & Revenue Tracking

### Goal
Verify that client interactions (Page Views, Click-throughs, and Page Bounces) correctly update statistics in real-time.

### Steps
1. Launch an experiment as described in Test Suite 6.
2. In the browser console, inspect local storage and confirm your assigned bucket (e.g., `aggressive`).
3. Click an ad sandbox placeholder (e.g., Header Banner).
4. Perform a page refresh (triggering an additional view).
5. **Bounce Test**: Open a new private window, land on the page, and close/unload it within **less than 10 seconds** (triggers the exit bounce sensor).
6. **No-Bounce Test**: Open a separate private window, land on the page, and stay active on the page for **more than 10 seconds** before navigating away.

### Verification Criteria
- [ ] **Clicks Metric**: Check the Admin stats dashboard or `ads_config/main` document. Confirm `clicks` has incremented by 1, and the variant's `revenueSimulated` has incremented by **$0.45** (CPC credit).
- [ ] **Page Views Metric**: Confirm `pageViews` has incremented by 1, and the variant's `revenueSimulated` has incremented by **$0.0025** (CPM credit).
- [ ] **Bounce Metric**: Confirm the bounce test recorded a bounce inside Firestore, whereas the no-bounce session did not increment the bounce count.

---

## 📱 Test Suite 8: Viewport Simulator Audits

### Goal
Verify that the Admin Layout Simulator properly renders pages responsively and displays mobile/tablet ad layout shifts.

### Steps
1. Navigate to the **Ad Experiments** panel -> click **Layout Simulator**.
2. From the simulator settings selector, choose the **Sector Index (Token List)** page.
3. Click the **Mobile (375px)** viewport button. Observe the render.
4. Click the **Tablet (768px)** viewport button. Observe the render.
5. Switch the simulated page to **Live Market (Dashboard & Charts)**.
6. Click **Highlight Placements** on the admin overlay toolbar.

### Verification Criteria
- [ ] The mock viewport simulator scales the page frame dimensions responsively (e.g., fitting inside a 375px mobile border frame).
- [ ] Check mobile view: Ad banners remain centered, do not overflow horizontally, and text elements adjust around them without overlapping.
- [ ] The pink placement highlight overlay and CLS statistics accurately recalculate percentages relative to the simulated viewport height (e.g., CLS shift percentage rises on smaller mobile screen bounds).
