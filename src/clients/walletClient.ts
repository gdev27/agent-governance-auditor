import { AuditorConfig } from '../config.js';
import { buildOkxHeaders, parseOkxResponse } from './okxAuth.js';

export interface WalletState {
  address: string;
  portfolioValueUsd: number;
  balances: Record<string, string>;
  lastSwapTimestamp?: number;
}

export class WalletClient {
  constructor(private readonly config: AuditorConfig) {}

  async getWalletState(walletAddress: string): Promise<WalletState> {
    const [portfolioValueUsd, balances, lastSwapTimestamp] = await Promise.all([
      this.getPortfolioValueUsd(walletAddress),
      this.getBalances(walletAddress),
      this.getLastSwapTimestamp(walletAddress)
    ]);

    return {
      address: walletAddress,
      portfolioValueUsd,
      balances,
      lastSwapTimestamp
    };
  }

  async getPortfolioValueUsd(walletAddress: string): Promise<number> {
    const query = new URLSearchParams({
      address: walletAddress,
      chains: String(this.config.xLayerChainId),
      assetType: '0'
    });
    const requestPath = `/api/v6/dex/balance/total-value-by-address?${query.toString()}`;
    const response = await fetch(`${this.config.onchainOsBaseUrl}${requestPath}`, {
      headers: buildOkxHeaders(this.config, 'GET', requestPath)
    });
    const data = await parseOkxResponse<Array<{ totalValue?: string }>>(response, 'Wallet value API');
    return Number(data[0]?.totalValue ?? 0);
  }

  async getBalances(walletAddress: string): Promise<Record<string, string>> {
    const query = new URLSearchParams({
      address: walletAddress,
      chains: String(this.config.xLayerChainId),
      excludeRiskToken: 'true'
    });
    const requestPath = `/api/v6/dex/balance/all-token-balances-by-address?${query.toString()}`;
    const response = await fetch(`${this.config.onchainOsBaseUrl}${requestPath}`, {
      headers: buildOkxHeaders(this.config, 'GET', requestPath)
    });
    const data = await parseOkxResponse<Array<{ tokenAssets?: Array<TokenAsset> }>>(
      response,
      'Wallet balances API'
    );
    const tokenAssets = data[0]?.tokenAssets ?? [];
    const balances: Record<string, string> = {};
    for (const asset of tokenAssets) {
      if (asset.tokenContractAddress) {
        balances[asset.tokenContractAddress] = asset.balance ?? '0';
      }
      if (asset.symbol) {
        balances[asset.symbol.toUpperCase()] = asset.balance ?? '0';
      }
    }
    return balances;
  }

  async getLastSwapTimestamp(walletAddress: string): Promise<number | undefined> {
    const now = Date.now();
    const query = new URLSearchParams({
      chainIndex: String(this.config.xLayerChainId),
      walletAddress,
      begin: String(now - 30 * 24 * 60 * 60 * 1000),
      end: String(now),
      limit: '1'
    });
    const requestPath = `/api/v6/dex/market/portfolio/dex-history?${query.toString()}`;
    const response = await fetch(`${this.config.onchainOsBaseUrl}${requestPath}`, {
      headers: buildOkxHeaders(this.config, 'GET', requestPath)
    });
    const data = await parseOkxResponse<{ transactionList?: Array<{ time?: string }> }>(
      response,
      'Wallet history API'
    );
    const last = data.transactionList?.[0]?.time;
    return last ? Number(last) : undefined;
  }
}

interface TokenAsset {
  tokenContractAddress?: string;
  symbol?: string;
  balance?: string;
}
