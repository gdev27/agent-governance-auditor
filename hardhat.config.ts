import '@nomicfoundation/hardhat-ethers';
import { config as loadEnv } from 'dotenv';
import { HardhatUserConfig } from 'hardhat/config';

loadEnv();

const config: HardhatUserConfig = {
  solidity: '0.8.24',
  networks: {
    xlayerTestnet: {
      type: 'http',
      url: process.env.X_LAYER_RPC_URL ?? 'https://testrpc.xlayer.tech/terigon',
      chainId: Number(process.env.X_LAYER_CHAIN_ID ?? 1952),
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    }
  }
};

export default config;
