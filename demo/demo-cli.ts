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
  const directIntentArg = process.argv[2];
  const scenarios = directIntentArg
    ? ([
        {
          name: 'CLI input',
          intent: directIntentArg,
          walletAddress:
            process.env.DEMO_WALLET_ADDRESS ??
            process.env.AGENTIC_WALLET_ADDRESS ??
            '0x0000000000000000000000000000000000000001',
          dailyVolumePct: 0.05
        }
      ] satisfies DemoScenario[])
    : await readScenarios();

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
      const explorerBase =
        config.xLayerChainId === config.xLayerMainnetChainId
          ? 'https://www.oklink.com/xlayer/tx'
          : 'https://www.oklink.com/xlayer-test/tx';
      console.log(`Explorer URL: ${explorerBase}/${result.onchainTxHash}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
