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

export interface ModelCostDetail {
  id: string;
  name: string;
  promptPrice: number;     // per 1M tokens
  completionPrice: number; // per 1M tokens
  blendedCost: number;     // per 1M tokens
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
  modelCosts?: ModelCostDetail[];
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

      // Dynamic OpenRouter Compute cost per 1M tokens (average of popular models)
      let openRouterMockCost = 0.3925; // Default fallback average
      const modelCosts: ModelCostDetail[] = [];

      // Standard fallback prices per token (USD)
      const fallbackPricing: Record<string, { name: string; prompt: number; completion: number }> = {
        'openai/gpt-4o-mini': { name: 'OpenAI: GPT-4o-mini', prompt: 0.15e-6, completion: 0.60e-6 },
        'google/gemini-2.5-flash': { name: 'Google: Gemini 2.5 Flash', prompt: 0.30e-6, completion: 2.50e-6 },
        'anthropic/claude-3-haiku': { name: 'Anthropic: Claude 3 Haiku', prompt: 0.25e-6, completion: 1.25e-6 },
        'meta-llama/llama-3-8b-instruct': { name: 'Meta: Llama 3 8B Instruct', prompt: 0.14e-6, completion: 0.14e-6 }
      };

      const targetModelIds = Object.keys(fallbackPricing);

      try {
        const orResponse = await fetch('https://openrouter.ai/api/v1/models', {
          headers: {
            'User-Agent': 'SuiteUtilsIndexer/1.0',
            'Accept': 'application/json'
          },
          signal: AbortSignal.timeout(5000)
        });
        if (orResponse.ok) {
          const orData = await orResponse.json() as any;
          if (orData && Array.isArray(orData.data)) {
            let totalBlendedCost = 0;
            let count = 0;

            for (const modelId of targetModelIds) {
              const model = orData.data.find((m: any) => m.id === modelId);
              let promptPrice = fallbackPricing[modelId].prompt;
              let completionPrice = fallbackPricing[modelId].completion;
              const modelName = model ? model.name : fallbackPricing[modelId].name;

              if (model && model.pricing) {
                const p = parseFloat(model.pricing.prompt);
                const c = parseFloat(model.pricing.completion);
                if (!isNaN(p) && p >= 0) promptPrice = p;
                if (!isNaN(c) && c >= 0) completionPrice = c;
              }

              // Compute price per 1M tokens based on 4:1 prompt/completion ratio (80% / 20%)
              const modelBlendedCost1M = (promptPrice * 0.8 + completionPrice * 0.2) * 1000000;
              totalBlendedCost += modelBlendedCost1M;
              count++;

              modelCosts.push({
                id: modelId,
                name: modelName,
                promptPrice: promptPrice * 1000000,
                completionPrice: completionPrice * 1000000,
                blendedCost: modelBlendedCost1M
              });
            }

            if (count > 0) {
              openRouterMockCost = parseFloat((totalBlendedCost / count).toFixed(4));
              console.log(`[TokenMarketIndexer] Successfully computed dynamic LLM pricing index from OpenRouter: $${openRouterMockCost} / 1M tokens`);
            }
          } else {
            throw new Error('Response data is not an array.');
          }
        } else {
          throw new Error(`HTTP ${orResponse.status}`);
        }
      } catch (err: any) {
        console.warn(`[TokenMarketIndexer] Failed to fetch live OpenRouter prices: ${err.message}. Using fallback average.`);
        modelCosts.length = 0;
        let totalBlendedCost = 0;
        for (const modelId of targetModelIds) {
          const fallback = fallbackPricing[modelId];
          const modelBlendedCost1M = (fallback.prompt * 0.8 + fallback.completion * 0.2) * 1000000;
          totalBlendedCost += modelBlendedCost1M;
          modelCosts.push({
            id: modelId,
            name: fallback.name,
            promptPrice: fallback.prompt * 1000000,
            completionPrice: fallback.completion * 1000000,
            blendedCost: modelBlendedCost1M
          });
        }
        openRouterMockCost = parseFloat((totalBlendedCost / targetModelIds.length).toFixed(4));
      }

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
        tokens: tokensData,
        modelCosts
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
