const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');
const fs = require('fs');

// Resolve service account path
const saPath = path.resolve(__dirname, '../suite-admin-sovereign.json');
if (!fs.existsSync(saPath)) {
  console.error(`❌ Service account file not found at: ${saPath}`);
  process.exit(1);
}

const serviceAccount = require(saPath);

const app = initializeApp({
  credential: cert(serviceAccount),
  projectId: serviceAccount.project_id || 'stillwater-sovereign-02'
}, 'tokenmarket-email-templates-seed-app');

const db = getFirestore(app, 'tokenmarket-db-0');

const templates = [
  {
    key: 'email-template-system',
    type: 'email-template',
    title: 'System Email Template',
    content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>{{subject}}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #050811;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #e2e8f0;
    }
    .email-container {
      max-width: 600px;
      margin: 40px auto;
      background-color: #0b1120;
      border: 1px solid rgba(0, 229, 255, 0.15);
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
    }
    .glow-bar {
      height: 4px;
      background: linear-gradient(90deg, #00e5ff 0%, #7000ff 100%);
    }
    .header {
      padding: 32px 40px;
      background: linear-gradient(180deg, rgba(0, 229, 255, 0.05) 0%, rgba(0, 0, 0, 0) 100%);
      border-bottom: 1px solid rgba(255, 255, 255, 0.03);
    }
    .header h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 0.5px;
      color: #00e5ff;
      display: flex;
      align-items: center;
    }
    .content {
      padding: 40px;
      line-height: 1.6;
      font-size: 15px;
    }
    .content h1 {
      font-size: 22px;
      color: #ffffff;
      margin-top: 0;
      margin-bottom: 20px;
    }
    .meta-card {
      background-color: rgba(0, 229, 255, 0.03);
      border: 1px solid rgba(0, 229, 255, 0.1);
      border-radius: 8px;
      padding: 16px 20px;
      margin-top: 28px;
    }
    .meta-item {
      font-size: 12px;
      color: #94a3b8;
      margin: 4px 0;
    }
    .meta-item strong {
      color: #00e5ff;
    }
    .footer {
      padding: 32px 40px;
      background-color: #070b16;
      border-top: 1px solid rgba(255, 255, 255, 0.03);
      text-align: center;
      font-size: 12px;
      color: #64748b;
    }
    .footer p {
      margin: 4px 0;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="glow-bar"></div>
    <div class="header">
      <h2>⚠️ SYSTEM ALERT</h2>
    </div>
    <div class="content">
      {{body}}
      
      <div class="meta-card">
        <div class="meta-item">Recipient: <strong>{{name}}</strong></div>
        <div class="meta-item">Subscription Tier: <strong>{{tier}}</strong></div>
      </div>
    </div>
    <div class="footer">
      <p>This is a mandatory system email regarding your TokenMarket account.</p>
      <p>&copy; 2026 TokenMarket Intelligence. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`
  },
  {
    key: 'email-template-marketing',
    type: 'email-template',
    title: 'Marketing Email Template',
    content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>{{subject}}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #050811;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #e2e8f0;
    }
    .email-container {
      max-width: 600px;
      margin: 40px auto;
      background-color: #0b1120;
      border: 1px solid rgba(112, 0, 255, 0.15);
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
    }
    .glow-bar {
      height: 4px;
      background: linear-gradient(90deg, #7000ff 0%, #ff007a 100%);
    }
    .header {
      padding: 32px 40px;
      background: linear-gradient(180deg, rgba(112, 0, 255, 0.05) 0%, rgba(0, 0, 0, 0) 100%);
      border-bottom: 1px solid rgba(255, 255, 255, 0.03);
    }
    .header h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 0.5px;
      color: #a78bfa;
    }
    .content {
      padding: 40px;
      line-height: 1.6;
      font-size: 15px;
    }
    .content h1 {
      font-size: 24px;
      color: #ffffff;
      margin-top: 0;
      margin-bottom: 20px;
      background: linear-gradient(90deg, #ffffff 0%, #cbd5e1 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .cta-button {
      display: inline-block;
      padding: 12px 24px;
      background: linear-gradient(90deg, #7000ff 0%, #8b5cf6 100%);
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin-top: 20px;
      text-align: center;
      box-shadow: 0 4px 20px rgba(112, 0, 255, 0.3);
    }
    .footer {
      padding: 32px 40px;
      background-color: #070b16;
      border-top: 1px solid rgba(255, 255, 255, 0.03);
      text-align: center;
      font-size: 12px;
      color: #64748b;
    }
    .footer p {
      margin: 4px 0;
    }
    .unsubscribe-link {
      color: #a78bfa;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="glow-bar"></div>
    <div class="header">
      <h2>🚀 TOKENMARKET INSIGHTS</h2>
    </div>
    <div class="content">
      {{body}}
    </div>
    <div class="footer">
      <p>You are receiving this because you opted in to marketing communications from TokenMarket.</p>
      <p>Want to change how you receive these emails? <a href="{{unsubscribeLink}}" class="unsubscribe-link">Unsubscribe here</a> at any time.</p>
      <p style="margin-top: 12px;">&copy; 2026 TokenMarket Intelligence. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`
  },
  {
    key: 'email-template-policy',
    type: 'email-template',
    title: 'Policy Email Template',
    content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>{{subject}}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #050811;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #e2e8f0;
    }
    .email-container {
      max-width: 600px;
      margin: 40px auto;
      background-color: #0b1120;
      border: 1px solid rgba(148, 163, 184, 0.15);
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
    }
    .glow-bar {
      height: 4px;
      background-color: #64748b;
    }
    .header {
      padding: 32px 40px;
      background: linear-gradient(180deg, rgba(148, 163, 184, 0.05) 0%, rgba(0, 0, 0, 0) 100%);
      border-bottom: 1px solid rgba(255, 255, 255, 0.03);
    }
    .header h2 {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 1px;
      color: #94a3b8;
      text-transform: uppercase;
    }
    .content {
      padding: 40px;
      line-height: 1.6;
      font-size: 15px;
    }
    .content h1 {
      font-size: 20px;
      color: #ffffff;
      margin-top: 0;
      margin-bottom: 20px;
      font-weight: 600;
    }
    .footer {
      padding: 32px 40px;
      background-color: #070b16;
      border-top: 1px solid rgba(255, 255, 255, 0.03);
      text-align: center;
      font-size: 12px;
      color: #64748b;
    }
    .footer p {
      margin: 4px 0;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="glow-bar"></div>
    <div class="header">
      <h2>⚖️ LEGAL & POLICY UPDATE</h2>
    </div>
    <div class="content">
      {{body}}
    </div>
    <div class="footer">
      <p>This is a mandatory legal notice sent to all registered users of TokenMarket.</p>
      <p>&copy; 2026 TokenMarket Intelligence. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`
  }
];

async function seed() {
  console.log('--- Seeding TokenMarket Email Templates ---');
  const collectionRef = db.collection('market_content');
  
  for (const template of templates) {
    console.log(`Setting template document: ${template.key}...`);
    await collectionRef.doc(template.key).set({
      ...template,
      updatedAt: new Date().toISOString()
    });
    console.log(`✅ ${template.key} written.`);
  }
  
  console.log('🎉 Seeding of email templates successfully completed!');
}

seed()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  });
