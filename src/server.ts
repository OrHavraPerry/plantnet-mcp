import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { PlantNetClient } from './plantnet-client';
import type { PlantNetIdentifyResponse, PlantNetResult } from './types';

// --- Input validation schemas ---

const IdentifyPlantSchema = z.object({
  image_urls: z
    .array(z.string().url())
    .min(1, 'At least one image URL required')
    .max(5, 'Maximum 5 images'),
  organs: z.array(
    z.enum(['leaf', 'flower', 'fruit', 'bark', 'auto', 'habit', 'other'])
  ).min(1),
  project: z.string().optional().default('all'),
  lang: z.string().optional().default('en'),
  nb_results: z.number().int().min(1).max(25).optional().default(5),
});

const ListProjectsSchema = z.object({
  lang: z.string().optional().default('en'),
});

// --- Result formatting ---

function formatIdentifyResult(data: PlantNetIdentifyResponse): string {
  const lines: string[] = [
    '## Plant Identification Results',
    '',
    `**Best match:** ${data.bestMatch}`,
    `**Remaining daily quota:** ${data.remainingIdentificationRequests} requests`,
    `**AI engine version:** ${data.version}`,
    '',
    `### Top ${data.results.length} Species Matches`,
    '',
  ];

  data.results.forEach((result: PlantNetResult, i: number) => {
    const confidence = (result.score * 100).toFixed(1);
    const commonNames =
      result.species.commonNames.slice(0, 3).join(', ') || 'none known';
    lines.push(
      `**${i + 1}. ${result.species.scientificNameWithoutAuthor}** — ${confidence}% confidence`,
      `   - Author: ${result.species.scientificNameAuthorship || 'unknown'}`,
      `   - Family: ${result.species.family.scientificNameWithoutAuthor}`,
      `   - Genus: ${result.species.genus.scientificNameWithoutAuthor}`,
      `   - Common names: ${commonNames}`,
      ...(result.gbif ? [`   - GBIF ID: ${result.gbif.id}`] : []),
      ...(result.powo ? [`   - POWO ID: ${result.powo.id}`] : []),
      ''
    );
  });

  lines.push(
    '---',
    '*Tip: For better accuracy, use clear photos of a single plant part and specify the correct organ.*'
  );

  return lines.join('\n');
}

// --- Server factory ---

export function createPlantNetServer(): Server {
  const apiKey = process.env.PLANTNET_API_KEY;
  if (!apiKey) {
    throw new Error(
      'PLANTNET_API_KEY environment variable is required. ' +
        'Get your free API key at https://my.plantnet.org/'
    );
  }

  const client = new PlantNetClient(apiKey);

  const server = new Server(
    { name: 'plantnet-mcp', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'identify_plant',
        description:
          'Identify plant species from one or more photos using the Pl@ntNet AI. ' +
          'Provide image URLs and specify which plant organ appears in each photo. ' +
          'Returns ranked species matches with confidence scores, scientific and common names, ' +
          'taxonomic classification (genus, family), GBIF and POWO identifiers, ' +
          'and remaining daily API quota. Supports up to 5 images per request for improved accuracy. ' +
          'Example: identify a rose from a flower photo, or an oak from a leaf photo.',
        inputSchema: {
          type: 'object',
          properties: {
            image_urls: {
              type: 'array',
              items: { type: 'string', format: 'uri' },
              description:
                'List of publicly accessible image URLs (JPG or PNG). ' +
                'Using multiple images of different organs improves identification accuracy. ' +
                'Maximum 5 images.',
              minItems: 1,
              maxItems: 5,
            },
            organs: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['leaf', 'flower', 'fruit', 'bark', 'auto', 'habit', 'other'],
              },
              description:
                'Plant organ shown in each image. Must have the same count as image_urls. ' +
                '"leaf", "flower", "fruit", "bark" — specific organ types. ' +
                '"habit" — the whole plant. ' +
                '"auto" — let PlantNet detect automatically. ' +
                '"other" — unclassified plant part.',
            },
            project: {
              type: 'string',
              description:
                'Flora database to search. "all" (default) searches the global database. ' +
                'Use a regional project ID (e.g. "weurope" for Western Europe) for higher accuracy ' +
                'when you know the plant\'s geographic origin. ' +
                'Use the list_projects tool to discover available projects.',
              default: 'all',
            },
            lang: {
              type: 'string',
              description:
                'Language code for common names in results. ' +
                'Examples: "en" (English), "fr" (French), "es" (Spanish), "de" (German). Default: "en".',
              default: 'en',
            },
            nb_results: {
              type: 'number',
              description:
                'Number of species results to return (1–25). ' +
                'Higher values give more alternatives but the top result is usually most accurate. Default: 5.',
              default: 5,
              minimum: 1,
              maximum: 25,
            },
          },
          required: ['image_urls', 'organs'],
        },
      },
      {
        name: 'list_projects',
        description:
          'List all available Pl@ntNet flora databases (called projects or referentials). ' +
          'Each project covers a specific geographic region or taxonomic group. ' +
          'Use the project ID from this list as the "project" argument in identify_plant ' +
          'for more accurate region-specific identification. ' +
          'For example, if you know a plant is from Western Europe, use the "weurope" project.',
        inputSchema: {
          type: 'object',
          properties: {
            lang: {
              type: 'string',
              description:
                'Language for project names in the response. Default: "en".',
              default: 'en',
            },
          },
          required: [],
        },
      },
      {
        name: 'check_quota',
        description:
          'Get information about Pl@ntNet API rate limits and quota. ' +
          'The free Pl@ntNet API allows 500 identifications per day per API key. ' +
          'The exact remaining count for today is returned as part of every identify_plant response. ' +
          'Use this tool when you need to understand quota constraints before batch processing.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    ],
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      if (name === 'identify_plant') {
        const parsed = IdentifyPlantSchema.parse(args);
        const result = await client.identifyPlant(parsed);
        return {
          content: [{ type: 'text', text: formatIdentifyResult(result) }],
        };
      }

      if (name === 'list_projects') {
        const parsed = ListProjectsSchema.parse(args);
        const projects = await client.listProjects(parsed.lang);
        const lines = [
          '## Available Pl@ntNet Flora Projects',
          '',
          'Use the **Project ID** as the `project` argument in `identify_plant` for regional accuracy.',
          '',
          '| Project ID | Name |',
          '|-----------|------|',
        ];
        for (const [id, info] of Object.entries(projects)) {
          const p = info as { id?: string; name?: string };
          lines.push(`| \`${p.id ?? id}\` | ${p.name ?? id} |`);
        }
        return {
          content: [{ type: 'text', text: lines.join('\n') }],
        };
      }

      if (name === 'check_quota') {
        return {
          content: [
            {
              type: 'text',
              text: [
                '## Pl@ntNet API Quota Information',
                '',
                '**Free tier limit:** 500 identifications per day per API key.',
                '',
                'The exact number of remaining requests for today is returned in every `identify_plant` response ' +
                  'as the `remainingIdentificationRequests` field.',
                '',
                'To check your current quota, make any `identify_plant` request and note the value shown in:',
                '  **Remaining daily quota:** N requests',
                '',
                'If you exceed the daily limit, the API returns a 429 Too Many Requests error.',
                '',
                'To increase your quota, visit: https://my.plantnet.org/account/settings',
              ].join('\n'),
            },
          ],
        };
      }

      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    } catch (err) {
      if (err instanceof McpError) throw err;
      const message = err instanceof Error ? err.message : String(err);
      throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${message}`);
    }
  });

  return server;
}
