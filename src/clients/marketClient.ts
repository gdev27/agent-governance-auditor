import { AuditorConfig } from '../config.js';
import { buildOkxHeaders, parseOkxResponse } from './okxAuth.js';

export interface MarketLiquidity {
  pair: string;
  liquidityUsd: number;
}

const symbolFallbackMap: Record<string, string> = {
  ETH: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  USDT: '0xUSDT',
  USDC: '0xUSDC',
  OKB: '0xOKB',
  WETH: '0xWETH'
};

export class MarketClient {
  constructor(private readonly config: AuditorConfig) {}

  async resolveToken(symbolOrAddress: string): Promise<string> {
    if (symbolOrAddress.startsWith('0x')) {
      return symbolOrAddress;
    }

    const dexChainIndex = this.config.onchainOsDexChainIndex ?? this.config.xLayerChainId;
    const query = new URLSearchParams({
      chains: String(dexChainIndex),
      search: symbolOrAddress.toUpperCase(),
      limit: '1'
    });
    const requestPath = `/api/v6/dex/market/token/search?${query.toString()}`;
    try {
      const response = await fetch(`${this.config.onchainOsBaseUrl}${requestPath}`, {
        headers: buildOkxHeaders(this.config, 'GET', requestPath)
      });
      const data = await parseOkxResponse<Array<{ tokenContractAddress?: string }>>(
        response,
        'Token search API'
      );
      const tokenAddress = data[0]?.tokenContractAddress;
      if (!tokenAddress) {
        throw new Error(`Token not found for symbol ${symbolOrAddress}`);
      }
      return tokenAddress;
    } catch {
      const fallback = symbolFallbackMap[symbolOrAddress.toUpperCase()];
      if (!fallback) {
        throw new Error(`Unable to resolve token symbol: ${symbolOrAddress}`);
      }
      return fallback;
    }
  }

  async getLiquidity(tokenIn: string, tokenOut: string): Promise<MarketLiquidity> {
    const dexChainIndex = this.config.onchainOsDexChainIndex ?? this.config.xLayerChainId;
    const query = new URLSearchParams({
      chainIndex: String(dexChainIndex),
      tokenContractAddress: tokenOut
    });
    const requestPath = `/api/v6/dex/market/token/top-liquidity?${query.toString()}`;
    const response = await fetch(`${this.config.onchainOsBaseUrl}${requestPath}`, {
      headers: buildOkxHeaders(this.config, 'GET', requestPath)
    });
    const data = await parseOkxResponse<Array<{ liquidityUsd?: string }>>(response, 'Token liquidity API');
    const liquidityUsd = data.reduce((total, item) => total + Number(item.liquidityUsd ?? 0), 0);
    return {
      pair: `${tokenIn}:${tokenOut}`,
      liquidityUsd
    };
  }
}
