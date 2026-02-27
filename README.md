# PlantNet MCP Server

An MCP (Model Context Protocol) server that wraps the [Pl@ntNet plant identification API](https://my.plantnet.org/). Enables AI assistants to identify plant species from photos.

## Tools

| Tool | Description |
|------|-------------|
| `identify_plant` | Identify plant species from 1–5 image URLs. Returns ranked matches with confidence, scientific/common names, taxonomy, and GBIF/POWO IDs. |
| `list_projects` | List all available regional flora databases (projects). |
| `check_quota` | Get information about daily API limits (500/day free tier). |

## Setup

### 1. Get a free API key

Register at [https://my.plantnet.org/](https://my.plantnet.org/) and copy your API key.

### 2. Install and build

```bash
git clone <this-repo>
cd PlantNetMCP
npm install
npm run build
```

### 3. Test

```bash
npm test
```

## Claude Desktop Configuration

Add to your Claude Desktop config file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "plantnet": {
      "command": "node",
      "args": ["C:/AI/PlantNetMCP/dist/index.js"],
      "env": {
        "PLANTNET_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

## Usage Examples

**Identify a plant from a photo URL:**
> "What plant is in this image: https://example.com/photo.jpg"

The assistant will call `identify_plant` with `organs: ["auto"]`.

**Identify with multiple photos for better accuracy:**
> "Identify this plant — I have a leaf photo and a flower photo."

Pass both URLs with matching organs: `["leaf", "flower"]`.

**Use a regional database:**
> "What European plant is this?"

1. Call `list_projects` to find the regional project ID (e.g., `"weurope"`)
2. Call `identify_plant` with `project: "weurope"`

## Project Structure

```
src/
  index.ts          # Entry point (stdio transport)
  server.ts         # MCP server + tool handlers
  plantnet-client.ts # Pl@ntNet HTTP client
  types.ts          # TypeScript interfaces
tests/
  plantnet-client.test.ts  # 13 client tests (mocked HTTP)
  server.test.ts           # 2 server tests
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PLANTNET_API_KEY` | Yes | Your Pl@ntNet API key from my.plantnet.org |

## API Limits

- Free tier: **500 identifications/day**
- Max images per request: **5**
- Supported formats: JPG, PNG
