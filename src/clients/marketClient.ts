import { AuditorConfig } from '../config.js';

export interface MarketLiquidity {
  pair: string;
  liquidityUsd: number;
}

const symbolFallbackMap: Record<string, string> = {
  USDT: '0xUSDT',
  USDC: '0xUSDC',
  OKB: '0xOKB',
  WETH: '0xWETH'
};

async function safeJson(response: Response): Promise<unknown> {
  if (!response.ok) {
    throw new Error(`Market API failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export class MarketClient {
  constructor(private readonly config: AuditorConfig) {}

  async resolveToken(symbolOrAddress: string): Promise<string> {
    if (symbolOrAddress.startsWith('0x')) {
      return symbolOrAddress;
    }

    const url = `${this.config.onchainOsBaseUrl}/api/v5/dex/market/token?chainId=${this.config.xLayerChainId}&symbol=${symbolOrAddress.toUpperCase()}`;
    try {
      const response = await fetch(url, { headers: this.buildHeaders() });
      const data = (await safeJson(response)) as { address?: string };
      if (!data.address) {
        throw new Error(`Token not found for symbol ${symbolOrAddress}`);
      }
      return data.address;
    } catch {
      const fallback = symbolFallbackMap[symbolOrAddress.toUpperCase()];
      if (!fallback) {
        throw new Error(`Unable to resolve token symbol: ${symbolOrAddress}`);
      }
      return fallback;
    }
  }

  async getLiquidity(tokenIn: string, tokenOut: string): Promise<MarketLiquidity> {
    const url = `${this.config.onchainOsBaseUrl}/api/v5/dex/market/liquidity?chainId=${this.config.xLayerChainId}&tokenIn=${tokenIn}&tokenOut=${tokenOut}`;
    const response = await fetch(url, { headers: this.buildHeaders() });
    const data = (await safeJson(response)) as { liquidityUsd?: number };
    return {
      pair: `${tokenIn}:${tokenOut}`,
      liquidityUsd: data.liquidityUsd ?? 0
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
