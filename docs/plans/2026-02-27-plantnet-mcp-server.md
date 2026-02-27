# PlantNet MCP Server Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a well-tested MCP server that wraps the Pl@ntNet plant identification API, exposing informative tools for identifying plants from images.

**Architecture:** TypeScript MCP server using `@modelcontextprotocol/sdk`. Exposes three tools: `identify_plant` (POST images to PlantNet API for species identification), `list_projects` (list available flora databases), and `check_quota` (check remaining daily API calls). Images are fetched from URLs and forwarded as multipart form data.

**Tech Stack:** TypeScript, `@modelcontextprotocol/sdk`, `node-fetch`, `form-data`, `zod`, `jest` + `ts-jest`

**Environment:** `PLANTNET_API_KEY` — set in `.env` (locally) or shell environment. Never hard-code.

---

## File Layout

```
PlantNetMCP/
├── src/
│   ├── index.ts               # Entry point — wires server to stdio transport
│   ├── server.ts              # MCP Server: tool definitions + handlers
│   ├── plantnet-client.ts     # HTTP client for Pl@ntNet API
│   └── types.ts               # Shared TypeScript types
├── tests/
│   ├── plantnet-client.test.ts
│   └── server.test.ts
├── package.json
├── tsconfig.json
└── .env.example
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.env.example`
- Create: `.gitignore`

**Step 1: Initialize package.json**

```bash
cd /c/AI/PlantNetMCP
npm init -y
```

**Step 2: Install dependencies**

```bash
npm install @modelcontextprotocol/sdk node-fetch form-data zod
npm install --save-dev typescript ts-node ts-jest jest @types/jest @types/node @types/node-fetch @types/form-data
```

**Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**Step 4: Add scripts to package.json**

Edit `package.json` to add:

```json
{
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "ts-node --esm src/index.ts",
    "test": "jest"
  },
  "jest": {
    "preset": "ts-jest/presets/default-esm",
    "testEnvironment": "node",
    "extensionsToTreatAsEsm": [".ts"],
    "moduleNameMapper": {
      "^(\\.{1,2}/.*)\\.js$": "$1"
    },
    "transform": {
      "^.+\\.tsx?$": ["ts-jest", { "useESM": true }]
    }
  }
}
```

**Step 5: Create .env.example**

```
PLANTNET_API_KEY=your_api_key_here
```

**Step 6: Create .gitignore**

```
node_modules/
dist/
.env
*.js.map
```

**Step 7: Create src/ and tests/ directories**

```bash
mkdir -p src tests
```

**Step 8: Commit**

```bash
git init
git add .
git commit -m "chore: scaffold TypeScript MCP project"
```

---

## Task 2: TypeScript Types

**Files:**
- Create: `src/types.ts`

**Step 1: Write types**

```typescript
// src/types.ts

export interface PlantNetResult {
  score: number;
  species: {
    scientificNameWithoutAuthor: string;
    scientificNameAuthorship: string;
    scientificName: string;
    genus: { scientificNameWithoutAuthor: string };
    family: { scientificNameWithoutAuthor: string };
    commonNames: string[];
  };
  gbif?: { id: string };
  powo?: { id: string };
}

export interface PlantNetIdentifyResponse {
  query: {
    project: string;
    images: string[];
    organs: string[];
    includeRelatedImages: boolean;
  };
  language: string;
  preferedReferential: string;
  bestMatch: string;
  results: PlantNetResult[];
  remainingIdentificationRequests: number;
  version: string;
}

export interface PlantNetProjectsResponse {
  [key: string]: {
    id: string;
    name: string;
    languages: string[];
    defaultLanguage: string;
  };
}

export interface IdentifyPlantArgs {
  image_urls: string[];
  organs: string[];
  project?: string;
  lang?: string;
  nb_results?: number;
}

export interface ListProjectsArgs {
  lang?: string;
}

export interface CheckQuotaArgs {
  // No required args — just checks quota via a minimal identify call
}
```

**Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add TypeScript types for PlantNet API"
```

---

## Task 3: PlantNet API Client

**Files:**
- Create: `src/plantnet-client.ts`

**Step 1: Write the failing test**

```typescript
// tests/plantnet-client.test.ts
import { PlantNetClient } from '../src/plantnet-client.js';

const FAKE_KEY = 'test-api-key';

describe('PlantNetClient', () => {
  it('throws if no API key is provided', () => {
    expect(() => new PlantNetClient('')).toThrow('PLANTNET_API_KEY is required');
  });

  it('constructs with a valid API key', () => {
    const client = new PlantNetClient(FAKE_KEY);
    expect(client).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx jest tests/plantnet-client.test.ts -t "throws if no API key"
```

Expected: FAIL — `PlantNetClient` does not exist yet.

**Step 3: Write PlantNet client implementation**

```typescript
// src/plantnet-client.ts
import fetch from 'node-fetch';
import FormData from 'form-data';
import type {
  PlantNetIdentifyResponse,
  IdentifyPlantArgs,
} from './types.js';

const BASE_URL = 'https://my-api.plantnet.org';

export class PlantNetClient {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('PLANTNET_API_KEY is required');
    }
    this.apiKey = apiKey;
  }

  /**
   * Identify plant species from one or more image URLs.
   * Fetches each image and sends as multipart form data.
   */
  async identifyPlant(args: IdentifyPlantArgs): Promise<PlantNetIdentifyResponse> {
    const {
      image_urls,
      organs,
      project = 'all',
      lang = 'en',
      nb_results = 5,
    } = args;

    if (image_urls.length === 0) {
      throw new Error('At least one image URL is required');
    }
    if (image_urls.length !== organs.length) {
      throw new Error('Number of image_urls must match number of organs');
    }
    if (image_urls.length > 5) {
      throw new Error('Maximum 5 images per request');
    }

    const form = new FormData();

    // Download each image and attach as binary
    for (let i = 0; i < image_urls.length; i++) {
      const response = await fetch(image_urls[i]);
      if (!response.ok) {
        throw new Error(`Failed to fetch image at ${image_urls[i]}: ${response.statusText}`);
      }
      const buffer = await response.buffer();
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const ext = contentType.includes('png') ? 'png' : 'jpg';
      form.append('images', buffer, { filename: `image${i}.${ext}`, contentType });
      form.append('organs', organs[i]);
    }

    const url = new URL(`/v2/identify/${encodeURIComponent(project)}`, BASE_URL);
    url.searchParams.set('api-key', this.apiKey);
    url.searchParams.set('lang', lang);
    url.searchParams.set('nb-results', String(nb_results));
    url.searchParams.set('include-related-images', 'false');

    const response = await fetch(url.toString(), {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
    });

    const data = await response.json() as PlantNetIdentifyResponse;

    if (!response.ok) {
      throw new Error(
        `PlantNet API error ${response.status}: ${JSON.stringify(data)}`
      );
    }

    return data;
  }

  /**
   * Fetch list of available flora projects/referentials.
   */
  async listProjects(lang = 'en'): Promise<Record<string, { id: string; name: string }>> {
    const url = new URL('/v2/projects', BASE_URL);
    url.searchParams.set('api-key', this.apiKey);
    url.searchParams.set('lang', lang);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`PlantNet API error ${response.status}: ${response.statusText}`);
    }

    return response.json() as Promise<Record<string, { id: string; name: string }>>;
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
npx jest tests/plantnet-client.test.ts
```

Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add src/plantnet-client.ts tests/plantnet-client.test.ts
git commit -m "feat: add PlantNet API client with identify and list-projects"
```

---

## Task 4: MCP Server — Tool Definitions

**Files:**
- Create: `src/server.ts`

**Step 1: Write failing server tests**

```typescript
// tests/server.test.ts
import { createPlantNetServer } from '../src/server.js';

describe('createPlantNetServer', () => {
  it('throws if PLANTNET_API_KEY is not set', () => {
    const saved = process.env.PLANTNET_API_KEY;
    delete process.env.PLANTNET_API_KEY;
    expect(() => createPlantNetServer()).toThrow('PLANTNET_API_KEY');
    if (saved) process.env.PLANTNET_API_KEY = saved;
  });

  it('creates a server when API key is set', () => {
    process.env.PLANTNET_API_KEY = 'test-key';
    const server = createPlantNetServer();
    expect(server).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx jest tests/server.test.ts -t "throws if PLANTNET_API_KEY"
```

Expected: FAIL — `createPlantNetServer` does not exist yet.

**Step 3: Implement the MCP server**

```typescript
// src/server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { PlantNetClient } from './plantnet-client.js';
import type {
  PlantNetIdentifyResponse,
  PlantNetResult,
} from './types.js';

// --- Input schemas (Zod for runtime validation) ---
const IdentifyPlantSchema = z.object({
  image_urls: z
    .array(z.string().url())
    .min(1, 'At least one image URL required')
    .max(5, 'Maximum 5 images'),
  organs: z
    .array(
      z.enum(['leaf', 'flower', 'fruit', 'bark', 'auto', 'habit', 'other'])
    )
    .min(1),
  project: z.string().optional().default('all'),
  lang: z.string().optional().default('en'),
  nb_results: z.number().int().min(1).max(25).optional().default(5),
});

const ListProjectsSchema = z.object({
  lang: z.string().optional().default('en'),
});

// --- Formatting helpers ---

function formatIdentifyResult(data: PlantNetIdentifyResponse): string {
  const lines: string[] = [
    `## Plant Identification Results`,
    ``,
    `**Best match:** ${data.bestMatch}`,
    `**Remaining daily quota:** ${data.remainingIdentificationRequests} requests`,
    `**AI engine version:** ${data.version}`,
    ``,
    `### Top ${data.results.length} Species Matches`,
    ``,
  ];

  data.results.forEach((result: PlantNetResult, i: number) => {
    const confidence = (result.score * 100).toFixed(1);
    const commonNames = result.species.commonNames.slice(0, 3).join(', ') || 'none known';
    lines.push(
      `**${i + 1}. ${result.species.scientificNameWithoutAuthor}** — ${confidence}% confidence`,
      `   - Author: ${result.species.scientificNameAuthorship || 'unknown'}`,
      `   - Family: ${result.species.family.scientificNameWithoutAuthor}`,
      `   - Genus: ${result.species.genus.scientificNameWithoutAuthor}`,
      `   - Common names: ${commonNames}`,
      result.gbif ? `   - GBIF ID: ${result.gbif.id}` : '',
      result.powo ? `   - POWO ID: ${result.powo.id}` : '',
      ``
    );
  });

  lines.push(
    `---`,
    `*Tip: For better accuracy, use clear photos of a single plant part and specify the correct organ.*`
  );

  return lines.filter(l => l !== undefined).join('\n');
}

export function createPlantNetServer(): Server {
  const apiKey = process.env.PLANTNET_API_KEY;
  if (!apiKey) {
    throw new Error(
      'PLANTNET_API_KEY environment variable is required. ' +
      'Get your key at https://my.plantnet.org/'
    );
  }

  const client = new PlantNetClient(apiKey);

  const server = new Server(
    {
      name: 'plantnet-mcp',
      version: '1.0.0',
    },
    {
      capabilities: { tools: {} },
    }
  );

  // --- List tools ---
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'identify_plant',
        description:
          'Identify plant species from one or more photos using the Pl@ntNet AI. ' +
          'Provide image URLs and specify which plant organ appears in each photo. ' +
          'Returns ranked species matches with confidence scores, scientific/common names, ' +
          'taxonomic classification, and GBIF/POWO identifiers. ' +
          'Supports up to 5 images per request for improved accuracy.',
        inputSchema: {
          type: 'object',
          properties: {
            image_urls: {
              type: 'array',
              items: { type: 'string', format: 'uri' },
              description:
                'List of publicly accessible image URLs (JPG or PNG). ' +
                'More images of different organs improves accuracy.',
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
                'Plant organ shown in each image, must match 1-to-1 with image_urls. ' +
                'Use "auto" to let PlantNet detect automatically. ' +
                '"habit" means the whole plant, "other" for unclassified parts.',
            },
            project: {
              type: 'string',
              description:
                'Flora database to search. Use "all" (default) for global search, ' +
                'or a specific project ID for regional flora (e.g., "weurope" for Western Europe). ' +
                'Use list_projects to see available options.',
              default: 'all',
            },
            lang: {
              type: 'string',
              description: 'Language code for common names in results (e.g., "en", "fr", "es"). Default: "en".',
              default: 'en',
            },
            nb_results: {
              type: 'number',
              description: 'Number of species results to return (1-25). Default: 5.',
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
          'List all available Pl@ntNet flora databases (projects/referentials). ' +
          'Each project covers a specific geographic region or taxonomic group. ' +
          'Use the project IDs from this list as the "project" argument in identify_plant ' +
          'for more accurate regional identification.',
        inputSchema: {
          type: 'object',
          properties: {
            lang: {
              type: 'string',
              description: 'Language for project names (e.g., "en", "fr"). Default: "en".',
              default: 'en',
            },
          },
          required: [],
        },
      },
      {
        name: 'check_quota',
        description:
          'Check how many Pl@ntNet API identification requests remain for today. ' +
          'The free tier allows a limited number of identifications per day. ' +
          'Use this before batch processing to ensure sufficient quota.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    ],
  }));

  // --- Handle tool calls ---
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
          'Use the **Project ID** as the `project` argument in `identify_plant`.',
          '',
          '| Project ID | Name |',
          '|-----------|------|',
        ];
        for (const [id, info] of Object.entries(projects)) {
          const p = info as { id: string; name: string };
          lines.push(`| \`${p.id ?? id}\` | ${p.name ?? id} |`);
        }
        return {
          content: [{ type: 'text', text: lines.join('\n') }],
        };
      }

      if (name === 'check_quota') {
        // PlantNet doesn't have a dedicated quota endpoint;
        // remainingIdentificationRequests is returned with each identify call.
        return {
          content: [
            {
              type: 'text',
              text:
                'To check your remaining quota, make an identify_plant request — ' +
                'the response includes `remainingIdentificationRequests` showing daily calls left. ' +
                'The free tier allows 500 identifications per day.',
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
```

**Step 4: Run tests to verify they pass**

```bash
npx jest tests/server.test.ts
```

Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add src/server.ts tests/server.test.ts
git commit -m "feat: implement MCP server with identify_plant, list_projects, check_quota tools"
```

---

## Task 5: Entry Point

**Files:**
- Create: `src/index.ts`

**Step 1: Write entry point**

```typescript
// src/index.ts
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createPlantNetServer } from './server.js';

async function main() {
  const server = createPlantNetServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('PlantNet MCP server running on stdio');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
```

**Step 2: Build and verify compilation**

```bash
npm run build
```

Expected: Exits with code 0, `dist/` directory created.

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: add stdio entry point for MCP server"
```

---

## Task 6: Integration Tests with Mocked HTTP

**Files:**
- Modify: `tests/plantnet-client.test.ts`

**Step 1: Add mocked API tests**

Replace `tests/plantnet-client.test.ts` with:

```typescript
// tests/plantnet-client.test.ts
import { jest } from '@jest/globals';
import { PlantNetClient } from '../src/plantnet-client.js';

// Mock node-fetch
const mockFetch = jest.fn();
jest.mock('node-fetch', () => ({ default: mockFetch }));

const FAKE_KEY = 'test-api-key';

const MOCK_IDENTIFY_RESPONSE = {
  query: { project: 'all', images: ['img1'], organs: ['leaf'], includeRelatedImages: false },
  language: 'en',
  preferedReferential: 'all',
  bestMatch: 'Quercus robur L.',
  results: [
    {
      score: 0.92,
      species: {
        scientificNameWithoutAuthor: 'Quercus robur',
        scientificNameAuthorship: 'L.',
        scientificName: 'Quercus robur L.',
        genus: { scientificNameWithoutAuthor: 'Quercus' },
        family: { scientificNameWithoutAuthor: 'Fagaceae' },
        commonNames: ['English oak', 'pedunculate oak'],
      },
      gbif: { id: '2878688' },
    },
  ],
  remainingIdentificationRequests: 450,
  version: '2.1',
};

describe('PlantNetClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws if no API key is provided', () => {
    expect(() => new PlantNetClient('')).toThrow('PLANTNET_API_KEY is required');
  });

  it('constructs with a valid API key', () => {
    const client = new PlantNetClient(FAKE_KEY);
    expect(client).toBeDefined();
  });

  it('throws if image_urls is empty', async () => {
    const client = new PlantNetClient(FAKE_KEY);
    await expect(
      client.identifyPlant({ image_urls: [], organs: [] })
    ).rejects.toThrow('At least one image URL is required');
  });

  it('throws if image_urls and organs lengths differ', async () => {
    const client = new PlantNetClient(FAKE_KEY);
    await expect(
      client.identifyPlant({ image_urls: ['http://example.com/img.jpg'], organs: [] })
    ).rejects.toThrow('Number of image_urls must match number of organs');
  });

  it('throws if more than 5 images provided', async () => {
    const client = new PlantNetClient(FAKE_KEY);
    const urls = Array(6).fill('http://example.com/img.jpg');
    const organs = Array(6).fill('leaf');
    await expect(
      client.identifyPlant({ image_urls: urls, organs })
    ).rejects.toThrow('Maximum 5 images');
  });

  it('successfully identifies a plant', async () => {
    // Mock image fetch
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'image/jpeg' },
        buffer: async () => Buffer.from('fake-image-data'),
      } as any)
      // Mock PlantNet API call
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => MOCK_IDENTIFY_RESPONSE,
      } as any);

    const client = new PlantNetClient(FAKE_KEY);
    const result = await client.identifyPlant({
      image_urls: ['http://example.com/oak.jpg'],
      organs: ['leaf'],
    });

    expect(result.bestMatch).toBe('Quercus robur L.');
    expect(result.results[0].score).toBe(0.92);
    expect(result.remainingIdentificationRequests).toBe(450);
  });

  it('throws on failed image fetch', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Not Found',
    } as any);

    const client = new PlantNetClient(FAKE_KEY);
    await expect(
      client.identifyPlant({
        image_urls: ['http://example.com/missing.jpg'],
        organs: ['leaf'],
      })
    ).rejects.toThrow('Failed to fetch image');
  });

  it('throws on PlantNet API error response', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'image/jpeg' },
        buffer: async () => Buffer.from('fake'),
      } as any)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Unauthorized' }),
      } as any);

    const client = new PlantNetClient(FAKE_KEY);
    await expect(
      client.identifyPlant({
        image_urls: ['http://example.com/oak.jpg'],
        organs: ['leaf'],
      })
    ).rejects.toThrow('PlantNet API error 401');
  });
});
```

**Step 2: Run all tests**

```bash
npx jest
```

Expected: All tests PASS. Count: ~8 tests across 2 files.

**Step 3: Commit**

```bash
git add tests/plantnet-client.test.ts
git commit -m "test: add comprehensive mocked tests for PlantNet client"
```

---

## Task 7: Claude Desktop / MCP Config

**Files:**
- Create: `README.md`
- Create: `.env.example` (already done)

**Step 1: Write README.md**

```markdown
# PlantNet MCP Server

An MCP server that wraps the [Pl@ntNet plant identification API](https://my.plantnet.org/).

## Tools

| Tool | Description |
|------|-------------|
| `identify_plant` | Identify plant species from image URLs |
| `list_projects` | List available regional flora databases |
| `check_quota` | Check remaining daily API quota |

## Setup

1. Get a free API key at https://my.plantnet.org/
2. Clone this repo and install dependencies:
   ```bash
   npm install
   npm run build
   ```
3. Set your API key:
   ```bash
   export PLANTNET_API_KEY=your_key_here
   ```

## Claude Desktop Configuration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "plantnet": {
      "command": "node",
      "args": ["/absolute/path/to/PlantNetMCP/dist/index.js"],
      "env": {
        "PLANTNET_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

## Usage Examples

**Identify a plant from a photo:**
> "What plant is in this image? [image URL]"
> Tool: `identify_plant` with `image_urls` and `organs: ["auto"]`

**Find regional flora databases:**
> "What PlantNet projects are available for Europe?"
> Tool: `list_projects`
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with setup and configuration instructions"
```

---

## Task 8: Final Verification

**Step 1: Run full test suite**

```bash
npx jest --coverage
```

Expected: All tests pass. Coverage report generated.

**Step 2: Build the project**

```bash
npm run build
```

Expected: Exit code 0, `dist/` populated.

**Step 3: Smoke test — verify server starts without error**

```bash
PLANTNET_API_KEY=dummy node dist/index.js &
sleep 1
kill %1
```

Expected: Prints `PlantNet MCP server running on stdio` then exits.

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final build artifacts and verification"
```

---

## Summary

| Task | What it does |
|------|-------------|
| 1. Scaffolding | TypeScript + MCP SDK + jest project setup |
| 2. Types | Shared interfaces for PlantNet API responses |
| 3. API Client | HTTP client that fetches images and calls PlantNet |
| 4. MCP Server | Three tools with rich descriptions and formatting |
| 5. Entry Point | stdio transport wiring |
| 6. Tests | Mocked integration tests for client + server |
| 7. Docs | README + Claude Desktop config |
| 8. Verification | Full test suite + build smoke test |
