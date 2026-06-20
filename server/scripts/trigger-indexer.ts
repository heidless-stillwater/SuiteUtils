import '../services/config-env.js';
import { TokenMarketIndexer } from '../services/TokenMarketIndexer.js';

async function main() {
  console.log('[Script] Manually triggering TokenMarket index calculation...');
  const record = await TokenMarketIndexer.runHourlyIndex();
  console.log('[Script] Execution successful.');
  console.log('Index Value:', record.indexValue.toFixed(2));
  console.log('Total Market Cap:', record.totalMarketCap);
  console.log('Utility Percentage:', record.utilityPercentage.toFixed(1) + '%');
  console.log('Speculative Percentage:', record.speculativePercentage.toFixed(1) + '%');
  console.log('OpenRouter Mock Cost:', '$' + record.openRouterMockCost);
  process.exit(0);
}

main().catch(err => {
  console.error('[Script] Error triggering index:', err);
  process.exit(1);
});
