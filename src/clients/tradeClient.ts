import { AuditorConfig } from '../config.js';
import { buildOkxHeaders, parseOkxResponse } from './okxAuth.js';

export interface SwapQuote {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  expectedAmountOut: string;
  estimatedSlippageBps: number;
}

export class TradeClient {
  constructor(private readonly config: AuditorConfig) {}

  async getSwapQuote(tokenIn: string, tokenOut: string, amountIn: string): Promise<SwapQuote> {
    const query = new URLSearchParams({
      chainIndex: String(this.config.xLayerChainId),
      fromTokenAddress: tokenIn,
      toTokenAddress: tokenOut,
      amount: amountIn,
      swapMode: 'exactIn'
    });
    const requestPath = `/api/v6/dex/aggregator/quote?${query.toString()}`;
    const url = `${this.config.onchainOsBaseUrl}${requestPath}`;
    const response = await fetch(url, {
      headers: buildOkxHeaders(this.config, 'GET', requestPath)
    });
    const data = await parseOkxResponse<
      Array<{ toTokenAmount?: string; priceImpactPercent?: string }>
    >(response, 'Trade quote API');
    const quote = data[0] ?? {};

    return {
      tokenIn,
      tokenOut,
      amountIn,
      expectedAmountOut: quote.toTokenAmount ?? '0',
      estimatedSlippageBps: this.toBps(quote.priceImpactPercent)
    };
  }

  buildSwapRequest(input: {
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    maxSlippageBps: number;
    chainId: number;
    walletAddress: string;
  }): Record<string, unknown> {
    return {
      chainIndex: String(input.chainId),
      fromTokenAddress: input.tokenIn,
      toTokenAddress: input.tokenOut,
      amount: input.amountIn,
      swapMode: 'exactIn',
      slippagePercent: (input.maxSlippageBps / 100).toString(),
      userWalletAddress: input.walletAddress
    };
  }

  private toBps(priceImpactPercent?: string): number {
    if (!priceImpactPercent) {
      return this.config.defaultSlippageBps;
    }

    const parsed = Number(priceImpactPercent);
    if (!Number.isFinite(parsed)) {
      return this.config.defaultSlippageBps;
    }

    return Math.max(0, Math.round(Math.abs(parsed) * 100));
  }
}
