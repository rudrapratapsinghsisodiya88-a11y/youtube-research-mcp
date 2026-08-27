import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";

const app = express();

app.use(express.json());

const server = new McpServer({
  name: "youtube-research-mcp",
  version: "1.0.0"
});

server.tool(
  "test_connector",
  "Test whether the YouTube Research MCP connector is working.",
  {},
  async () => {
    return {
      content: [
        {
          type: "text",
          text: "YouTube Research MCP Connector is working successfully!"
        }
      ]
    };
  }
);

app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined
  });

  await server.connect(transport);

  await transport.handleRequest(req, res, req.body);
});

app.get("/", (req, res) => {
  res.send("YouTube Research MCP Server is running.");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`MCP server running on port ${PORT}`);
});
