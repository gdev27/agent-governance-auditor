import { config as loadEnv } from 'dotenv';
import hre from 'hardhat';

loadEnv();

async function main(): Promise<void> {
  const chainId = Number(process.env.X_LAYER_CHAIN_ID ?? 1952);
  const { ethers } = hre as unknown as { ethers: any };
  const contractFactory = await ethers.getContractFactory('ResponsibilityContract');
  const contract = await contractFactory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  const deploymentTx = contract.deploymentTransaction();

  console.log('ResponsibilityContract deployed');
  console.log(`Chain ID: ${chainId}`);
  console.log(`Address: ${address}`);
  if (deploymentTx) {
    console.log(`Deployment Tx: ${deploymentTx.hash}`);
    console.log(`Explorer: https://www.oklink.com/xlayer-test/tx/${deploymentTx.hash}`);
  }
  console.log('Set RESPONSIBILITY_CONTRACT_ADDRESS to this value in your .env');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
