import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod/v4';
import { getConfig } from '../config.js';
import { MarketClient } from '../clients/marketClient.js';
import { parseIntent } from '../intent.js';
import { auditIntent } from '../decider.js';

const config = getConfig();
const marketClient = new MarketClient(config);

const server = new McpServer({
  name: 'okx-agent-governance-auditor',
  version: '1.0.0'
});

server.registerTool(
  'governance_audit',
  {
    description:
      'Validate intent against policy, run simulation and risk scoring, then return normalized governance decision.',
    inputSchema: {
      intent: z.union([z.string(), z.record(z.string(), z.unknown())]),
      walletAddress: z.string().optional(),
      dailyVolumePct: z.number().min(0).max(1).optional()
    }
  },
  async ({ intent, walletAddress, dailyVolumePct }, _extra) => {
    const canonicalIntent = await parseIntent(intent, {
      defaultChainId: config.xLayerChainId,
      tokenResolver: (value) => marketClient.resolveToken(value)
    });

    const result = await auditIntent(canonicalIntent, {
      walletAddress: walletAddress ?? '0x0000000000000000000000000000000000000001',
      dailyVolumePct
    });

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      structuredContent: result as unknown as Record<string, unknown>
    };
  }
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('MCP server error:', error);
  process.exit(1);
});
