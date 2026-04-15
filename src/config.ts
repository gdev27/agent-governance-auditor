import { config as loadEnv } from 'dotenv';

// Always prefer the project's current .env values over inherited shell variables.
loadEnv({ override: true });

export interface AuditorConfig {
  okxApiKey: string;
  okxSecretKey: string;
  okxPassphrase: string;
  onchainOsBaseUrl: string;
  xLayerRpcUrl: string;
  xLayerChainId: number;
  xLayerMainnetChainId: number;
  onchainOsDexChainIndex?: number;
  responsibilityContractAddress?: string;
  privateKey?: string;
  onchainLogSignerMode: 'private_key' | 'agentic_wallet';
  agenticWalletCliPath: string;
  agenticWalletChain: string;
  agenticWalletAddress?: string;
  defaultSlippageBps: number;
}

export function getConfig(): AuditorConfig {
  const xLayerChainId = Number(process.env.X_LAYER_CHAIN_ID ?? 1952);
  const xLayerMainnetChainId = Number(process.env.X_LAYER_MAINNET_CHAIN_ID ?? 196);
  const onchainOsDexChainIndex = Number(
    process.env.ONCHAINOS_DEX_CHAIN_INDEX ??
      (xLayerChainId === 1952 ? xLayerMainnetChainId : xLayerChainId)
  );

  return {
    okxApiKey: process.env.OKX_API_KEY ?? '',
    okxSecretKey: process.env.OKX_SECRET_KEY ?? '',
    okxPassphrase: process.env.OKX_PASSPHRASE ?? '',
    onchainOsBaseUrl: process.env.ONCHAINOS_BASE_URL ?? 'https://web3.okx.com',
    xLayerRpcUrl: process.env.X_LAYER_RPC_URL ?? '',
    xLayerChainId,
    xLayerMainnetChainId,
    onchainOsDexChainIndex: Number.isFinite(onchainOsDexChainIndex)
      ? onchainOsDexChainIndex
      : xLayerMainnetChainId,
    responsibilityContractAddress: process.env.RESPONSIBILITY_CONTRACT_ADDRESS,
    privateKey: process.env.PRIVATE_KEY,
    onchainLogSignerMode:
      process.env.ONCHAIN_LOG_SIGNER_MODE === 'agentic_wallet' ? 'agentic_wallet' : 'private_key',
    agenticWalletCliPath: process.env.AGENTIC_WALLET_CLI_PATH ?? 'onchainos',
    agenticWalletChain: process.env.AGENTIC_WALLET_CHAIN ?? 'xlayer',
    agenticWalletAddress: process.env.AGENTIC_WALLET_ADDRESS,
    defaultSlippageBps: Number(process.env.DEFAULT_SLIPPAGE_BPS ?? 100)
  };
}
