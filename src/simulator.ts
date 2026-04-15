import { CanonicalIntent } from './intent.js';
import { MarketClient } from './clients/marketClient.js';
import { TradeClient, SwapQuote } from './clients/tradeClient.js';
import { WalletClient } from './clients/walletClient.js';

export interface SimulationContext {
  walletAddress: string;
  amountIn: string;
  quote?: SwapQuote;
  expectedSlippageBps?: number;
  liquidityUsd?: number;
  simulationErrors: string[];
}

export interface SimulatorDeps {
  walletClient: WalletClient;
  tradeClient: TradeClient;
  marketClient: MarketClient;
}

export async function simulateTx(
  intent: CanonicalIntent,
  walletAddress: string,
  amountIn: string,
  deps: SimulatorDeps
): Promise<SimulationContext> {
  const simulationErrors: string[] = [];
  let quote: SwapQuote | undefined;
  let liquidityUsd: number | undefined;

  if (intent.action === 'swap' && intent.sourceToken && intent.destinationToken) {
    try {
      quote = await deps.tradeClient.getSwapQuote(intent.sourceToken, intent.destinationToken, amountIn);
    } catch (error) {
      simulationErrors.push(
        `Quote unavailable: ${error instanceof Error ? error.message : 'unknown quote error'}`
      );
    }

    try {
      const liquidity = await deps.marketClient.getLiquidity(intent.sourceToken, intent.destinationToken);
      liquidityUsd = liquidity.liquidityUsd;
    } catch (error) {
      simulationErrors.push(
        `Liquidity unavailable: ${error instanceof Error ? error.message : 'unknown liquidity error'}`
      );
    }
  }

  return {
    walletAddress,
    amountIn,
    quote,
    expectedSlippageBps: quote?.estimatedSlippageBps,
    liquidityUsd,
    simulationErrors
  };
}
