import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createPlantNetServer } from './server';

async function main() {
  const server = createPlantNetServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('PlantNet MCP server running on stdio');
}

main().catch((err) => {
  console.error('Fatal error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
