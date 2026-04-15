import { AuditorConfig } from '../config.js';

export interface WalletState {
  address: string;
  portfolioValueUsd: number;
  balances: Record<string, string>;
  lastSwapTimestamp?: number;
}

async function safeJson(response: Response): Promise<unknown> {
  if (!response.ok) {
    throw new Error(`Wallet API failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
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
    const url = `${this.config.onchainOsBaseUrl}/api/v5/dex/wallet/portfolio-value?address=${walletAddress}&chainId=${this.config.xLayerChainId}`;
    const response = await fetch(url, { headers: this.buildHeaders() });
    const data = (await safeJson(response)) as { valueUsd?: number };
    return data.valueUsd ?? 0;
  }

  async getBalances(walletAddress: string): Promise<Record<string, string>> {
    const url = `${this.config.onchainOsBaseUrl}/api/v5/dex/wallet/balances?address=${walletAddress}&chainId=${this.config.xLayerChainId}`;
    const response = await fetch(url, { headers: this.buildHeaders() });
    const data = (await safeJson(response)) as { balances?: Record<string, string> };
    return data.balances ?? {};
  }

  async getLastSwapTimestamp(walletAddress: string): Promise<number | undefined> {
    const url = `${this.config.onchainOsBaseUrl}/api/v5/dex/wallet/last-swap?address=${walletAddress}&chainId=${this.config.xLayerChainId}`;
    const response = await fetch(url, { headers: this.buildHeaders() });
    const data = (await safeJson(response)) as { timestamp?: number };
    return data.timestamp;
  }

  private buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'OK-ACCESS-KEY': this.config.okxApiKey,
      'OK-ACCESS-PASSPHRASE': this.config.okxPassphrase,
      'X-OKX-SECRET': this.config.okxSecretKey
    };
  }
}
