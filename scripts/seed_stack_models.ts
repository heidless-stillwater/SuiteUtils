import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccountPath = './suite-admin-sovereign-02.json';
if (!fs.existsSync(serviceAccountPath)) {
  console.error(`❌ Service account key not found at ${serviceAccountPath}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

// Initialize app if not already initialized
let app;
if (!admin.apps.length) {
  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id || 'stillwater-sovereign-02'
  });
} else {
  app = admin.app();
}

const db = getFirestore(app, 'tokenmarket-db-0');

const seedModels = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    type: 'cloud',
    cost1MInput: 2.50,
    cost1MOutput: 10.00,
    contextWindow: 128000,
    arenaElo: 1335,
    codingElo: 1350,
    throughput: 85,
    ttft: 220,
    description: 'High-speed flagship multimodal reasoning and generation engine.'
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o-mini',
    provider: 'OpenAI',
    type: 'cloud',
    cost1MInput: 0.15,
    cost1MOutput: 0.60,
    contextWindow: 128000,
    arenaElo: 1220,
    codingElo: 1200,
    throughput: 110,
    ttft: 180,
    description: 'Fast, highly cost-efficient reasoning engine for standard agent flows.'
  },
  {
    id: 'o1',
    name: 'o1',
    provider: 'OpenAI',
    type: 'cloud',
    cost1MInput: 15.00,
    cost1MOutput: 60.00,
    contextWindow: 200000,
    arenaElo: 1355,
    codingElo: 1420,
    throughput: 25,
    ttft: 1200,
    description: 'Reasoning model optimized for complex STEM coding challenges and math.'
  },
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    type: 'cloud',
    cost1MInput: 3.00,
    cost1MOutput: 15.00,
    contextWindow: 200000,
    arenaElo: 1342,
    codingElo: 1380,
    throughput: 75,
    ttft: 280,
    description: 'Industry-standard frontrunner for multi-file codebase refactoring and coding agents.'
  },
  {
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    provider: 'Anthropic',
    type: 'cloud',
    cost1MInput: 15.00,
    cost1MOutput: 75.00,
    contextWindow: 200000,
    arenaElo: 1250,
    codingElo: 1210,
    throughput: 30,
    ttft: 450,
    description: 'Deep contextual understanding engine with high nuance, albeit higher latency.'
  },
  {
    id: 'gemini-1-5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'Google',
    type: 'cloud',
    cost1MInput: 1.25,
    cost1MOutput: 5.00,
    contextWindow: 2000000,
    arenaElo: 1260,
    codingElo: 1240,
    throughput: 60,
    ttft: 320,
    description: 'Massive 2M token context window ideal for processing complete repos.'
  },
  {
    id: 'gemini-2-5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'Google',
    type: 'cloud',
    cost1MInput: 0.075,
    cost1MOutput: 0.30,
    contextWindow: 1000000,
    arenaElo: 1282,
    codingElo: 1290,
    throughput: 150,
    ttft: 150,
    description: 'Sleek speed-optimized model with vast context window and low pricing.'
  },
  {
    id: 'deepseek-v3',
    name: 'DeepSeek-V3',
    provider: 'DeepSeek',
    type: 'cloud',
    cost1MInput: 0.14,
    cost1MOutput: 0.28,
    contextWindow: 64000,
    arenaElo: 1295,
    codingElo: 1310,
    throughput: 80,
    ttft: 240,
    description: 'Extremely affordable frontier-class model with superb code synthesis.'
  },
  {
    id: 'deepseek-r1',
    name: 'DeepSeek-R1',
    provider: 'DeepSeek',
    type: 'cloud',
    cost1MInput: 0.55,
    cost1MOutput: 2.19,
    contextWindow: 160000,
    arenaElo: 1361,
    codingElo: 1440,
    throughput: 30,
    ttft: 900,
    description: 'Deep-reasoning chain-of-thought engine offering elite code execution at a low cost.'
  },
  {
    id: 'glm-4',
    name: 'GLM-4',
    provider: 'Zhipu (GLM)',
    type: 'cloud',
    cost1MInput: 1.38,
    cost1MOutput: 1.38,
    contextWindow: 128000,
    arenaElo: 1210,
    codingElo: 1180,
    throughput: 55,
    ttft: 350,
    description: 'Bilingual English/Chinese reasoning engine tailored for structural SaaS logic.'
  },
  {
    id: 'glm-4-flash',
    name: 'GLM-4-Flash',
    provider: 'Zhipu (GLM)',
    type: 'cloud',
    cost1MInput: 0.00,
    cost1MOutput: 0.00,
    contextWindow: 128000,
    arenaElo: 1120,
    codingElo: 1080,
    throughput: 90,
    ttft: 200,
    description: 'Zero-cost or near-zero cost API option for simple categorization micro-services.'
  },
  {
    id: 'minimax-text-01',
    name: 'MiniMax-Text-01',
    provider: 'MiniMax',
    type: 'cloud',
    cost1MInput: 0.20,
    cost1MOutput: 0.80,
    contextWindow: 128000,
    arenaElo: 1190,
    codingElo: 1150,
    throughput: 70,
    ttft: 290,
    description: 'Balanced latency-to-quality model optimized for text composition and agents.'
  },
  {
    id: 'qwen-2-5-72b',
    name: 'Qwen 2.5 72B',
    provider: 'Alibaba (Qwen)',
    type: 'cloud',
    cost1MInput: 0.40,
    cost1MOutput: 0.40,
    contextWindow: 128000,
    arenaElo: 1275,
    codingElo: 1280,
    throughput: 65,
    ttft: 260,
    description: 'Highly competitive open-weights model hosted at production grade.'
  },
  {
    id: 'llama-3-8b-local',
    name: 'Llama 3 8B (Local)',
    provider: 'Meta (Local)',
    type: 'local',
    cost1MInput: 0.00,
    cost1MOutput: 0.00,
    contextWindow: 8192,
    arenaElo: 1140,
    codingElo: 1120,
    throughput: 45,
    ttft: 50,
    description: 'Lightweight local model suitable for desktop execution and minimal server overhead.'
  },
  {
    id: 'llama-3-70b-local',
    name: 'Llama 3 70B (Local)',
    provider: 'Meta (Local)',
    type: 'local',
    cost1MInput: 0.00,
    cost1MOutput: 0.00,
    contextWindow: 8192,
    arenaElo: 1255,
    codingElo: 1230,
    throughput: 15,
    ttft: 120,
    description: 'Heavyweight local model with high capability, requiring advanced GPU resources.'
  },
  {
    id: 'qwen-2-5-coder-7b-local',
    name: 'Qwen 2.5 Coder 7B (Local)',
    provider: 'Qwen (Local)',
    type: 'local',
    cost1MInput: 0.00,
    cost1MOutput: 0.00,
    contextWindow: 32768,
    arenaElo: 1160,
    codingElo: 1240,
    throughput: 50,
    ttft: 60,
    description: 'Exceptional lightweight coding specialist model running natively.'
  }
];

async function seed() {
  console.log('🏁 Starting StackModel database seeding...');
  const collectionRef = db.collection('stack_models');
  
  for (const model of seedModels) {
    console.log(`seeding model document: ${model.id}...`);
    await collectionRef.doc(model.id).set({
      ...model,
      updatedAt: new Date().toISOString()
    });
    console.log(`✅ Model ${model.id} successfully saved.`);
  }
  
  console.log('🎉 Seeding successfully completed for 16 models!');
}

seed().catch(err => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
