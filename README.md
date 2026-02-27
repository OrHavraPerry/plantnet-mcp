# plantnet-mcp

> An MCP server for the [Pl@ntNet](https://plantnet.org) plant identification API — identify plants from photos directly within Claude.

[![MCP](https://img.shields.io/badge/MCP-compatible-green)](https://modelcontextprotocol.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

---

## Overview

`plantnet-mcp` connects Claude to the [Pl@ntNet API](https://my.plantnet.org), enabling plant identification from images with scientific accuracy. Submit 1–5 photos of a plant and get back ranked species matches with confidence scores, taxonomic data, and regional flora support.

### Tools Provided

| Tool | Description |
|------|-------------|
| `identify_plant` | Identify a plant from 1–5 image URLs. Returns ranked species matches with confidence scores, scientific/common names, and taxonomic data (genus, family, GBIF/POWO IDs). |
| `list_projects` | List available regional flora databases (e.g., world flora, Europe, Africa, Americas). Useful for targeting location-specific identification. |
| `check_quota` | Check your daily API usage against your quota limit (500 identifications/day on the free tier). |

---

## Requirements

- [Node.js](https://nodejs.org) v18+
- A free Pl@ntNet API key — register at [my.plantnet.org](https://my.plantnet.org)

---

## Installation

```bash
git clone https://github.com/OrHavraPerry/plantnet-mcp
cd plantnet-mcp
npm install
npm run build
```

---

## Configuration

### 1. Set your API key

Copy `.env.example` to `.env` and add your key:

```bash
cp .env.example .env
```

```env
PLANTNET_API_KEY=your_api_key_here
```

### 2. Add to Claude Desktop

Edit your Claude Desktop config file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "plantnet": {
      "command": "node",
      "args": ["/absolute/path/to/plantnet-mcp/dist/index.js"],
      "env": {
        "PLANTNET_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

Restart Claude Desktop after saving.

---

## Usage Examples

**Identify a plant from a photo URL:**
```
Identify this plant: https://example.com/plant.jpg
```

**Multi-photo identification for better accuracy:**
```
Identify this plant using these photos — leaf: [url1], flower: [url2]
```

**Region-specific search:**
```
List available plant projects, then identify this plant [url] using the Europe flora
```

**Check API usage:**
```
How many plant identifications do I have left today?
```

---

## Tool Reference

### `identify_plant`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `images` | `string[]` | Yes | 1–5 image URLs (JPG or PNG) |
| `organs` | `string[]` | No | Plant organ per image: `leaf`, `flower`, `fruit`, `bark`, `habit`, `auto`, `other` |
| `project` | `string` | No | Flora database to search (default: `all`) |
| `lang` | `string` | No | Language for common names (default: `en`) |
| `nb_results` | `number` | No | Number of results to return, 1–25 (default: `5`) |

### `list_projects`

No parameters. Returns all available regional flora databases.

### `check_quota`

No parameters. Returns current daily usage and limit.

---

## Limits

- **Free tier:** 500 identifications/day per API key
- **Max images per request:** 5
- **Supported formats:** JPG, PNG

---

## Development

```bash
npm run dev      # Run with ts-node (no build needed)
npm run build    # Compile TypeScript to dist/
npm test         # Run test suite
```

---

## License

MIT — see [LICENSE](./LICENSE)
