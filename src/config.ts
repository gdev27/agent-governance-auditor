import { config as loadEnv } from 'dotenv';

loadEnv();

export interface AuditorConfig {
  okxApiKey: string;
  okxSecretKey: string;
  okxPassphrase: string;
  onchainOsBaseUrl: string;
  xLayerRpcUrl: string;
  xLayerChainId: number;
  xLayerMainnetChainId: number;
  responsibilityContractAddress?: string;
  privateKey?: string;
  defaultSlippageBps: number;
}

export function getConfig(): AuditorConfig {
  return {
    okxApiKey: process.env.OKX_API_KEY ?? '',
    okxSecretKey: process.env.OKX_SECRET_KEY ?? '',
    okxPassphrase: process.env.OKX_PASSPHRASE ?? '',
    onchainOsBaseUrl: process.env.ONCHAINOS_BASE_URL ?? 'https://web3.okx.com',
    xLayerRpcUrl: process.env.X_LAYER_RPC_URL ?? '',
    xLayerChainId: Number(process.env.X_LAYER_CHAIN_ID ?? 1952),
    xLayerMainnetChainId: Number(process.env.X_LAYER_MAINNET_CHAIN_ID ?? 196),
    responsibilityContractAddress: process.env.RESPONSIBILITY_CONTRACT_ADDRESS,
    privateKey: process.env.PRIVATE_KEY,
    defaultSlippageBps: Number(process.env.DEFAULT_SLIPPAGE_BPS ?? 100)
  };
}
