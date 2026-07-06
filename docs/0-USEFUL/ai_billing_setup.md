# AI Billing & Token Management Setup

This guide provides copy-pasteable examples for switching between different Gemini API keys (personal free/paid keys) and falling back to your GCP Billing Account.

To ensure both your main suite and background services (like the Persona system) recognize the keys, you should manage them in these two files:
1. **SuiteUtils Env:** [SuiteUtils/.env](file:///home/heidless/projects/SuiteUtils/.env)
2. **Persona Env:** [Persona/.env.local](file:///home/heidless/projects/Persona/.env.local)

---

## 1. Use a Personal Free/Paid Key
To route all development LLM traffic to your first personal Google AI Studio account:

### In `SuiteUtils/.env` (add at the bottom):
```env
# ----- AI INFERENCE / GEMINI API CONFIG -----
GEMINI_API_KEY=AIzaSy_Personal_Account_1_Key_Placeholder_ABC123XYZ
```

### In `Persona/.env.local` (add at the bottom):
```env
# ----- AI INFERENCE / GEMINI API CONFIG -----
GEMINI_API_KEY=AIzaSy_Personal_Account_1_Key_Placeholder_ABC123XYZ
```

---

## 2. Switch to a Different Personal Account
If your first account runs out of quota or you want to isolate billing, replace the value of `GEMINI_API_KEY` in both files:

### In `SuiteUtils/.env` (replace the previous line):
```env
# ----- AI INFERENCE / GEMINI API CONFIG -----
GEMINI_API_KEY=AIzaSy_Different_Account_2_Key_Placeholder_987DEF654
```

### In `Persona/.env.local` (replace the previous line):
```env
# ----- AI INFERENCE / GEMINI API CONFIG -----
GEMINI_API_KEY=AIzaSy_Different_Account_2_Key_Placeholder_987DEF654
```

---

## 3. Fallback to GCP Project Billing
To bypass personal AI Studio keys completely and let the enterprise GCP Billing Account handle the AI costs as a last resort:

### Option A: Comment Out the Key (Recommended)
By commenting out or removing the `GEMINI_API_KEY`, the application fails over to native GCP Authentication (Vertex AI) using your GCP project service account and bills your GCP billing account.

#### In `SuiteUtils/.env`:
```env
# ----- AI INFERENCE / GEMINI API CONFIG -----
# GEMINI_API_KEY=disabled_to_fallback_to_gcp_billing
```

#### In `Persona/.env.local`:
```env
# ----- AI INFERENCE / GEMINI API CONFIG -----
# GEMINI_API_KEY=disabled_to_fallback_to_gcp_billing
```

### Option B: Configure a GCP-bound API Key explicitly
If you want to create an API Key inside your GCP Console that is explicitly restricted and linked to your `stillwater-sovereign-02` project:

#### In `SuiteUtils/.env`:
```env
# ----- AI INFERENCE / GEMINI API CONFIG -----
GEMINI_API_KEY=AIzaSy_GCP_Project_Linked_Key_Placeholder_GCP777_STILLWATER
```

#### In `Persona/.env.local`:
```env
# ----- AI INFERENCE / GEMINI API CONFIG -----
GEMINI_API_KEY=AIzaSy_GCP_Project_Linked_Key_Placeholder_GCP777_STILLWATER
```
