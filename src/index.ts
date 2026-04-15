import { getConfig } from './config.js';
import { MarketClient } from './clients/marketClient.js';
import { parseIntent } from './intent.js';
import { auditIntent } from './decider.js';

export * from './config.js';
export * from './intent.js';
export * from './policy.js';
export * from './simulator.js';
export * from './risk.js';
export * from './decider.js';
export * from './auditLogger.js';

async function main(): Promise<void> {
  if (!process.argv[2]) {
    return;
  }

  const config = getConfig();
  const marketClient = new MarketClient(config);
  const parsedIntent = await parseIntent(process.argv[2], {
    defaultChainId: config.xLayerChainId,
    tokenResolver: (value) => marketClient.resolveToken(value)
  });

  const result = await auditIntent(parsedIntent, {
    walletAddress: process.env.DEMO_WALLET_ADDRESS ?? '0x0000000000000000000000000000000000000001',
    dailyVolumePct: 0.05
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
