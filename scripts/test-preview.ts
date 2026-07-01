import { BroadcastService } from '../server/services/BroadcastService.js';
import dotenv from 'dotenv';

dotenv.config();

async function runTest() {
  console.log('=== START PREVIEW TEST ===');
  
  // 1. Preview System - Target All
  try {
    const countSystemAll = await BroadcastService.previewRecipientCount('all', 'system');
    console.log(`✅ System Category (Target: "all") -> Expected Count: ${countSystemAll}`);
  } catch (err: any) {
    console.error('❌ System Target All failed:', err.message);
  }

  // 2. Preview Marketing - Target All (tests the opt-out filtering)
  try {
    const countMarketingAll = await BroadcastService.previewRecipientCount('all', 'marketing');
    console.log(`✅ Marketing Category (Target: "all") -> Expected Count: ${countMarketingAll} (should filter out unsubscribed)`);
  } catch (err: any) {
    console.error('❌ Marketing Target All failed:', err.message);
  }

  // 3. Preview System - Target tier:pro
  try {
    const countProSystem = await BroadcastService.previewRecipientCount('tier:pro', 'system');
    console.log(`✅ System Category (Target: "tier:pro") -> Expected Count: ${countProSystem}`);
  } catch (err: any) {
    console.error('❌ System Target tier:pro failed:', err.message);
  }

  console.log('=== END PREVIEW TEST ===');
}

runTest();
