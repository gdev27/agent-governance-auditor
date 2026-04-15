import { config as loadEnv } from 'dotenv';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JsonRpcProvider, Wallet, ContractFactory } from 'ethers';

loadEnv();

async function main(): Promise<void> {
  if (!process.env.PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY is required for deployment.');
  }
  if (!process.env.X_LAYER_RPC_URL) {
    throw new Error('X_LAYER_RPC_URL is required for deployment.');
  }

  const provider = new JsonRpcProvider(process.env.X_LAYER_RPC_URL);
  const signer = new Wallet(process.env.PRIVATE_KEY, provider);
  const here = path.dirname(fileURLToPath(import.meta.url));
  const artifactPath = path.resolve(
    here,
    '../artifacts/contracts/ResponsibilityContract.sol/ResponsibilityContract.json'
  );
  const artifactRaw = await readFile(artifactPath, 'utf-8');
  const artifact = JSON.parse(artifactRaw) as { abi: unknown; bytecode: string };
  const contractFactory = new ContractFactory(artifact.abi as any, artifact.bytecode, signer);
  const contract = await contractFactory.deploy();
  await contract.waitForDeployment();
  const connectedNetwork = await provider.getNetwork();
  const chainId = Number(connectedNetwork.chainId);

  const address = await contract.getAddress();
  const deploymentTx = contract.deploymentTransaction();

  console.log('ResponsibilityContract deployed');
  console.log(`Chain ID: ${chainId}`);
  console.log(`Address: ${address}`);
  if (deploymentTx) {
    console.log(`Deployment Tx: ${deploymentTx.hash}`);
    const explorerBase =
      chainId === 196 ? 'https://www.oklink.com/xlayer/tx' : 'https://www.oklink.com/xlayer-test/tx';
    console.log(`Explorer: ${explorerBase}/${deploymentTx.hash}`);
  }
  console.log('Set RESPONSIBILITY_CONTRACT_ADDRESS to this value in your .env');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
