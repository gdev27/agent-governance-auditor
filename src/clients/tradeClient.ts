import { AuditorConfig } from '../config.js';

export interface SwapQuote {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  expectedAmountOut: string;
  estimatedSlippageBps: number;
}

async function safeJson(response: Response): Promise<unknown> {
  if (!response.ok) {
    throw new Error(`Trade API failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export class TradeClient {
  constructor(private readonly config: AuditorConfig) {}

  async getSwapQuote(tokenIn: string, tokenOut: string, amountIn: string): Promise<SwapQuote> {
    const url = `${this.config.onchainOsBaseUrl}/api/v5/dex/trade/quote?chainId=${this.config.xLayerChainId}&tokenIn=${tokenIn}&tokenOut=${tokenOut}&amount=${amountIn}`;
    const response = await fetch(url, { headers: this.buildHeaders() });
    const data = (await safeJson(response)) as Partial<SwapQuote>;
    return {
      tokenIn,
      tokenOut,
      amountIn,
      expectedAmountOut: data.expectedAmountOut ?? '0',
      estimatedSlippageBps: data.estimatedSlippageBps ?? this.config.defaultSlippageBps
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
      chainId: input.chainId,
      fromTokenAddress: input.tokenIn,
      toTokenAddress: input.tokenOut,
      amount: input.amountIn,
      slippageBps: input.maxSlippageBps,
      userWalletAddress: input.walletAddress
    };
  }

  private buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'OK-ACCESS-KEY': this.config.okxApiKey,
      'OK-ACCESS-PASSPHRASE': this.config.okxPassphrase
    };
  }
}
