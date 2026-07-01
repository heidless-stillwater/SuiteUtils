const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('../suite-admin-sovereign-02.json');

const app = initializeApp({
  credential: cert(serviceAccount),
  projectId: serviceAccount.project_id || 'stillwater-sovereign-02'
}, 'tokenmarket-seed-app');

const db = getFirestore(app, 'tokenmarket-db-0');

const baselineContent = [
  {
    key: 'privacy-policy',
    type: 'policy',
    title: 'Privacy Policy',
    order: 1,
    content: `# Privacy Policy\n\nYour privacy is important to us. This policy describes how we collect, use, and handle your data on this site.\n\n## Cookie Consent & Third-Party Advertising\n* We integrate with **Google AdSense** to serve advertisements.\n* Google and other third-party vendors use cookies to serve ads based on your prior visits to this website or other websites.\n* Google's use of advertising cookies enables it and its partners to serve ads to you based on your visit to this site and/or other sites on the Internet.\n* Users may opt out of personalized advertising by visiting **Ad Settings** in their Google accounts.\n\n## Data Collection & Storage\n* We do not collect or store any personal user profiles or identifiers unless voluntarily submitted through our Contact form.\n* Any feedback messages submitted via the Contact form are stored securely in Firestore for support purposes.`
  },
  {
    key: 'terms-of-service',
    type: 'policy',
    title: 'Terms of Service',
    order: 2,
    content: `# Terms of Service

Last Updated: June 2026

Welcome to **TokenMarket**. By accessing, browsing, or using this platform—including our commodity AI sector indices, compute cost models, dashboard visualisations, and Developer API endpoints—you agree to comply with and be bound by the following Terms of Service. If you do not agree to these terms, you must immediately discontinue use of the platform and our services.

---

## 1. Scope of Services & Disclaimer of Advice

### 1.1 Informational & Educational Purposes Only
The content, metrics, valuations, calculations, and custom portfolio returns provided on this platform are for **informational and educational purposes only**.

> **No Financial Advice**: None of the content on this website constitutes investment, financial, tax, or legal advice. No action should be taken based on any information contained herein. We are not a registered broker-dealer, investment advisor, or commodity trading advisor.

### 1.2 Data Source Limitations
We rely on third-party public feeds (including the CoinGecko API) and hardware provider price lists to compute our indices and compute-to-market ratios. We do not guarantee the accuracy, completeness, timeliness, or reliability of these external feeds.

---

## 2. Developer API & Acceptable Use Policy

We provision API keys to allow developers to retrieve real-time indices, compute metrics, and sector weights. By using our API, you agree to the following conditions:

* **Rate Limits**: You must not exceed the standard limit of **60 requests per minute** (unless otherwise upgraded to a higher tier plan).
* **Automated Scrapers**: You must not run aggressive scraping tools or bots that mimic human traffic to bypass programmatic rate-limiting.
* **No Redistribution**: Commercial redistribution or white-label embedding of raw API payloads without developer license attributes is strictly prohibited.
* **Key Security**: You are solely responsible for keeping your developer key secure. Any activity traced to your key will be deemed your responsibility.

---

## 3. Account Tiering & Premium Upgrades

* **Free Plan**: Provided on an "as-available" basis with standard rate limits and standard data latency.
* **Standard & Pro Tiers**: Unlock high-frequency streams, raised API limits, and support ticketing priority.
* **Billing & Subscriptions**: Payments are processed securely via third-party providers. All subscriptions are billed on a recurring basis and can be managed or cancelled from your Account tab.

---

## 4. Intellectual Property Rights

* **Platform Content**: All calculations, proprietary composite scoring algorithms (such as the **Compute-to-Market Ratio**), visual designs, dashboards, and source code are the intellectual property of TokenMarket and its operators.
* **Trademarks**: The names, logos, and taglines associated with **TokenMarket** are protected trademark assets. You may not use them in connection with any product or service without prior written consent.

---

## 5. Limitation of Liability & Indemnification

### 5.1 No Warranties
The platform and API are provided on an **"as-is"** and **"as-available"** basis. We make no warranties, express or implied, regarding uptime, stability, or database persistence.

### 5.2 Limitation of Liability
In no event shall TokenMarket, its developers, or its affiliates be liable for any direct, indirect, incidental, special, or consequential damages—including but not limited to investment losses, trading losses, loss of profits, data loss, or server downtime—arising from your use or inability to use the platform.

### 5.3 Indemnification
You agree to indemnify and hold harmless TokenMarket and its operators from any claims, losses, liabilities, and expenses (including legal fees) arising from your breach of these Terms or misuse of the platform and API endpoints.

---

## 6. Amendments & Governing Law

### 6.1 Changes to Terms
We reserve the right to amend these Terms at any time. Any changes will be posted on this page with an updated "Last Updated" timestamp. Your continued use of the platform after updates are made constitutes acceptance of the new Terms.

### 6.2 Governing Law
These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which the operators of TokenMarket reside, without regard to conflicts of law principles.

---

For inquiries, licensing requests, or support regarding these terms, please contact us at **support@fundingcloud.com**.`
  },
  {
    key: 'about-algorithms',
    type: 'algorithm',
    title: 'Index Algorithms & Methodology',
    order: 3,
    content: `# Index Algorithms & Methodology\n\nThe **TokenMarket AI Index** provides a standardized, real-time commodity pricing benchmark for the decentralized Artificial Intelligence sector.\n\n## 1. AI Sector Index Calculation\nThe Index measures the combined capitalization of the AI sector relative to a genesis base value of \`1000\`.\n* **Formula**:\n  \`Index Value = (Current Combined Market Cap / Base Market Cap) * 1000\`\n* **Base Market Cap**: Established on initialization (genesis run) to calibrate the index starting point.\n\n## 2. Archetype Weights (Utility vs. Speculative)\nWe group component tokens into two functional baskets to evaluate infrastructure vs. application speculation:\n* **Utility (Infrastructure)**: Includes Bittensor (\`TAO\`), Render (\`RENDER\`), and Near Protocol (\`NEAR\`). These represent decentralized compute, hardware grids, and layer-1 data protocols.\n  \`Utility % = (Utility Cap / Total Combined Market Cap) * 100\`\n* **Speculative (Agents)**: Includes Fetch.ai (\`FET\`) and Virtual Protocol (\`VIRTUAL\`). These represent autonomous agent frameworks and developer environments.\n  \`Speculative % = (Speculative Cap / Total Combined Market Cap) * 100\`\n\n## 3. Compute-to-Market Ratio (CMR)\nThe Compute-to-Market Ratio measures the valuation index relative to real-world LLM hardware access costs.\n* **Formula**:\n  \`CMR = Index Value / Average Basket Compute Cost\`\n* **Compute Basket**: Based on average pricing per 1 Million tokens across a popular model basket:\n  - OpenAI: GPT-4o-mini ($0.24/1M blended)\n  - Google: Gemini 2.5 Flash ($0.74/1M blended)\n  - Anthropic: Claude 3 Haiku ($0.45/1M blended)\n  - Meta: Llama 3 8B Instruct ($0.14/1M blended)`
  },
  {
    key: 'contact-faq',
    type: 'faq',
    title: 'Frequently Asked Questions & Contact',
    order: 4,
    content: `# Frequently Asked Questions & Contact\n\nFind definitions and answers to common questions below.\n\n## FAQ & Glossary\n\n* **What is the Compute-to-Market Ratio (CMR)?**\n  CMR measures the relative speculation level of AI assets against actual hardware pricing. A high CMR indicates AI asset prices are rising faster than raw GPU utility access costs.\n\n* **How often does the index update?**\n  The background indexer queries CoinGecko once every hour to recalculate market caps, volume metrics, and update the database feeds.\n\n* **What is the difference between Utility and Speculative tokens?**\n  Utility tokens (like TAO and RENDER) serve as the underlying compute layer or currency for AI operations. Speculative tokens (like FET and VIRTUAL) fund agent protocols and developer platforms.\n\n## Contact Us\nIf you have questions or wish to contact the site administrator, email us at **support@fundingcloud.com**.`
  },
  {
    key: 'about-us',
    type: 'policy',
    title: 'About Us',
    order: 0,
    content: `# About TokenMarket\n\nTokenMarket provides standardized, real-time commodity pricing benchmarks and indices for the decentralized Artificial Intelligence sector.\n\n## Our Mission\nOur goal is to make AI compute markets and speculative asset indexes transparent and accessible. We bridge the gap between financial valuations and real-world hardware costs. We expose these proprietary index calculations and pricing structures via our developer-friendly public API.\n\n## Data Sources & Accuracy\n* **Market Data**: Sourced via public CoinGecko API data feeds.\n* **Compute Cost Metrics**: Compiled from aggregate API compute pricing.\n* **Exposed API Endpoint Feeds**: Programmatic JSON datasets are distributed to developers for live sector indexing.\n\n## Contact\nFor inquiries or API key provisioning questions, contact our team at **support@fundingcloud.com**.`
  },
  {
    key: 'sector-index-guide',
    type: 'kb',
    title: 'AI Sector Index Guide',
    order: 1,
    content: `# AI Sector Index Guide\n\nThis guide explains how to read and interpret the dynamic **TokenMarket AI Index**.\n\n## Index Formula\nThe index value measures the combined market capitalization of the decentralized AI sector relative to a base value of \`1000\` established at genesis:\n\n\`Index Value = (Current Combined Market Cap / Base Market Cap) * 1000\`\n\n## Weighting Baskets\nWe group component assets into two main baskets:\n* **Utility (Infrastructure)**: Hardware grids and decentralized compute protocols (e.g. TAO, RENDER, NEAR).\n* **Speculative (Applications)**: Autonomous agents, developer kits, and frameworks (e.g. FET, VIRTUAL).\n\n## Interpretation\n* **Index Rising**: Indicates capital inflows into AI tokens.\n* **CMR Divergence**: Indicates speculative premiums relative to underlying raw compute access costs.`
  },
  {
    key: 'live-market-guide',
    type: 'kb',
    title: 'Live Market Volatility Guide',
    order: 2,
    content: `# Live Market Volatility Guide\n\nUnderstand how to interpret the real-time tickers and volume indicators.\n\n## Key Metrics\n* **API Tier**: Delayed updates (Free tier) vs Live streams (Premium tier).\n* **Combined Volatility**: Represents standard deviation variations in pricing over the past 24 hours.\n* **Indices Divergence**: Measures price differences between primary indexes to locate arbitrage options.\n\n## Tips for Analysis\n* Volatility spikes often precede significant breakouts.\n* Always reference the **Compute-to-Market Ratio (CMR)** when analyzing live price fluctuations.`
  },
  {
    key: 'understanding-cmr',
    type: 'kb',
    title: 'Understanding the CMR Metric',
    order: 3,
    content: `# Understanding the CMR Metric\n\nThe **Compute-to-Market Ratio (CMR)** is our proprietary index measuring speculation in AI tokens relative to real-world compute instance costs.\n\n## Valuation Concept\n* **Numerator**: TokenMarket Index Value (speculative token valuation).\n* **Denominator**: Wholesale H100/A100 compute pricing basket ($ per 1 Million tokens).\n\n## CMR Interpretations\n* **High CMR**: The market is placing a heavy speculation premium on AI tokens. Asset prices are rising faster than raw compute utility values.\n* **Low CMR**: Tokens are undervalued relative to the actual real-world GPU compute instances they represent.`
  },
  {
    key: 'token-archetypes',
    type: 'kb',
    title: 'AI Token Archetype Classifications',
    order: 4,
    content: `# AI Token Archetype Classifications\n\nWe categorize tokens into clear functional groups to assess sector strength.\n\n## Utility & Infrastructure\n* **Bittensor (TAO)**: Decentralized machine learning and incentive subnet networks.\n* **Render (RENDER)**: Distributed GPU graphics and general compute grid networks.\n* **Near Protocol (NEAR)**: High-performance Layer-1 blockchain supporting AI data processing.\n\n## Speculative & Application\n* **Fetch.ai (FET / ASI)**: Autonomous agent search and task automation systems.\n* **Virtuals Protocol (VIRTUAL)**: Agent frameworks and game co-ownership environments.`
  },
  {
    key: 'insight-active',
    type: 'insights',
    title: 'AI Market Consolidation & Compute Specs',
    order: 1,
    content: `The commodity AI sector index has shown **healthy consolidation** over the past 48 hours, hovering around the \`1000\` point threshold. Speculative compute valuations are aligning closer to raw GPU access costs. We observe strong support in hardware grid networks (\`RENDER\`, \`TAO\`), while application-focused autonomous agent frameworks (\`FET\`, \`VIRTUAL\`) are demonstrating temporary range-bound behavior.\n\n## Core Findings\n* **GPU cost alignment**: Average pricing for 1M compute tokens remains highly competitive.\n* **Infrastructure stability**: decentralized hardware networks are anchoring the sector value.\n* **Speculative premiums**: The Compute-to-Market Ratio (CMR) is stabilizing, showing a reduction in bubble speculation.`
  },
  {
    key: 'insight-past-1',
    type: 'insights',
    title: 'Genesis Index Launch and Compute Benchmarks',
    order: 2,
    content: `Welcome to the launch of the **TokenMarket AI Index** commentary feed. Our index starts with a base valuation of \`1000\` units representing the aggregate cap of top decentralized AI tokens relative to genesis compute benchmarks.\n\n## Initial Metrics\n* **Primary weightings**: Utility and Speculative baskets are split \`60/40\` respectively.\n* **Compute Index**: The baseline model cost basket averages \`$0.39\` per 1 Million tokens.`
  },
  {
    key: 'insight-settings',
    type: 'policy',
    title: 'Commentary Settings',
    order: 99,
    intervalDays: 7,
    content: 'Interval configuration for insights prompts.'
  }
];

async function seed() {
  console.log('--- Seeding TokenMarket CMS Content ---');
  const collectionRef = db.collection('market_content');
  
  for (const item of baselineContent) {
    console.log(`Setting document: ${item.key}...`);
    await collectionRef.doc(item.key).set({
      ...item,
      updatedAt: new Date().toISOString()
    });
    console.log(`✅ ${item.key} written.`);
  }
  
  console.log('🎉 Seeding successfully completed!');
}

seed().then(() => process.exit(0)).catch(err => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
