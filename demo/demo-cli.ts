import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getConfig } from '../src/config.js';
import { MarketClient } from '../src/clients/marketClient.js';
import { parseIntent } from '../src/intent.js';
import { auditIntent } from '../src/decider.js';

interface DemoScenario {
  name: string;
  intent: string | Record<string, unknown>;
  walletAddress: string;
  dailyVolumePct?: number;
}

async function readScenarios(): Promise<DemoScenario[]> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const filePath = path.resolve(here, './scenarios.json');
  const raw = await readFile(filePath, 'utf-8');
  return JSON.parse(raw) as DemoScenario[];
}

async function main(): Promise<void> {
  const config = getConfig();
  const marketClient = new MarketClient(config);
  const scenarios = await readScenarios();

  for (const scenario of scenarios) {
    const canonicalIntent = await parseIntent(scenario.intent, {
      defaultChainId: config.xLayerChainId,
      tokenResolver: (value) => marketClient.resolveToken(value)
    });

    const result = await auditIntent(canonicalIntent, {
      walletAddress: scenario.walletAddress,
      dailyVolumePct: scenario.dailyVolumePct
    });

    console.log('\n==================================================');
    console.log(`Scenario: ${scenario.name}`);
    console.log(JSON.stringify(result, null, 2));
    if (result.onchainTxHash) {
      console.log(`Explorer URL: https://www.oklink.com/xlayer-test/tx/${result.onchainTxHash}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
