import { getFirestore } from 'firebase-admin/firestore';
import { adminApp } from './FirebaseAdmin.js';

const tokenMarketDb = getFirestore(adminApp, 'tokenmarket-db-0');

export interface TokenMarketData {
  id: string;
  symbol: string;
  name: string;
  priceUSD: number;
  marketCap: number;
  circulatingSupply: number;
  volume24h: number;
  change24h: number;
  weight: number;
}

export interface IndexRecord {
  indexValue: number;
  timestamp: string;
  totalMarketCap: number;
  totalVolume24h: number;
  utilityValue: number;
  speculativeValue: number;
  utilityPercentage: number;
  speculativePercentage: number;
  openRouterMockCost: number;
  tokens: TokenMarketData[];
}

export class TokenMarketIndexer {
  private static COINGECKO_IDS = [
    'bittensor',       // TAO
    'render-token',    // RENDER
    'fetch-ai',        // FET
    'near',            // NEAR
    'virtual-protocol' // VIRTUAL
  ];

  static async runHourlyIndex(): Promise<IndexRecord> {
    console.log('[TokenMarketIndexer] Starting hourly index calculation...');
    try {
      // 1. Fetch from CoinGecko
      const idsParam = this.COINGECKO_IDS.join(',');
      const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${idsParam}`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'SuiteUtilsIndexer/1.0',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`CoinGecko API returned status ${response.status}: ${await response.text()}`);
      }

      const coins = await response.json() as any[];
      if (!Array.isArray(coins) || coins.length === 0) {
        throw new Error('CoinGecko API returned invalid data (empty list or not an array).');
      }

      console.log(`[TokenMarketIndexer] Successfully fetched ${coins.length} tokens.`);

      // 2. Perform Calculations
      let totalMarketCap = 0;
      let totalVolume24h = 0;

      // Group tokens to categorize them into Utility (Infrastructure) vs Speculative (Agents)
      const utilityIds = ['bittensor', 'render-token', 'near'];
      let utilityCap = 0;
      let speculativeCap = 0;

      coins.forEach(coin => {
        const cap = coin.market_cap || 0;
        totalMarketCap += cap;
        totalVolume24h += coin.total_volume || 0;

        if (utilityIds.includes(coin.id)) {
          utilityCap += cap;
        } else {
          speculativeCap += cap;
        }
      });

      if (totalMarketCap === 0) {
        throw new Error('Total market cap of AI sector calculated as 0.');
      }

      // Calculate ratios
      const utilityPercentage = (utilityCap / totalMarketCap) * 100;
      const speculativePercentage = (speculativeCap / totalMarketCap) * 100;

      // 3. Handle base market cap
      const configRef = tokenMarketDb.collection('market_index_metadata').doc('config');
      const configSnap = await configRef.get();
      let baseMarketCap: number;

      if (!configSnap.exists) {
        baseMarketCap = totalMarketCap;
        await configRef.set({
          baseMarketCap,
          establishedAt: new Date().toISOString()
        });
        console.log(`[TokenMarketIndexer] Established base market cap: $${baseMarketCap.toLocaleString()}`);
      } else {
        baseMarketCap = configSnap.data()?.baseMarketCap || totalMarketCap;
      }

      // Calculate current Index Value (base value = 1000)
      const indexValue = (totalMarketCap / baseMarketCap) * 1000;

      // 4. Map individual token details
      const tokensData: TokenMarketData[] = coins.map(coin => ({
        id: coin.id,
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
        priceUSD: coin.current_price || 0,
        marketCap: coin.market_cap || 0,
        circulatingSupply: coin.circulating_supply || 0,
        volume24h: coin.total_volume || 0,
        change24h: coin.price_change_percentage_24h || 0,
        weight: ((coin.market_cap || 0) / totalMarketCap) * 100
      }));

      // Sort by weight descending
      tokensData.sort((a, b) => b.weight - a.weight);

      // Mock OpenRouter Compute cost per 1M tokens (varies slightly around $0.15 for realism)
      const openRouterMockCost = parseFloat((0.15 + (Math.random() - 0.5) * 0.02).toFixed(4));

      const record: IndexRecord = {
        indexValue,
        timestamp: new Date().toISOString(),
        totalMarketCap,
        totalVolume24h,
        utilityValue: utilityCap,
        speculativeValue: speculativeCap,
        utilityPercentage,
        speculativePercentage,
        openRouterMockCost,
        tokens: tokensData
      };

      // 5. Persist to Firestore history
      const historyCollection = tokenMarketDb.collection('market_index_history');
      await historyCollection.add(record);

      console.log(`[TokenMarketIndexer] Successfully logged index record. Index Value: ${indexValue.toFixed(2)}`);
      return record;
    } catch (err: any) {
      console.error(`[TokenMarketIndexer] Error running index calculation: ${err.message}`);
      throw err;
    }
  }
}
