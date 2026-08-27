import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export class YouTubeResearchMCP extends McpAgent {
  server = new McpServer({
    name: "YouTube Research MCP",
    version: "1.0.0",
  });

  async init() {
    this.server.tool(
      "test_connector",
      "Test whether the YouTube Research MCP server is working.",
      {},
      async () => ({
        content: [
          {
            type: "text",
            text: "YouTube Research MCP is working successfully!",
          },
        ],
      }),
    );

    this.server.tool(
      "search_youtube",
      "Search YouTube videos for research.",
      {
        query: z.string().describe("What you want to search for on YouTube"),
        maxResults: z
          .number()
          .int()
          .min(1)
          .max(10)
          .default(5)
          .describe("Number of videos to return, from 1 to 10"),
      },
      async ({ query, maxResults }) => {
        const apiKey = (this.env as any).YOUTUBE_API_KEY;

        if (!apiKey) {
          return {
            content: [
              {
                type: "text",
                text: "YouTube API key is not configured.",
              },
            ],
          };
        }

        const url = new URL(
          "https://www.googleapis.com/youtube/v3/search",
        );

        url.searchParams.set("part", "snippet");
        url.searchParams.set("q", query);
        url.searchParams.set("type", "video");
        url.searchParams.set("maxResults", String(maxResults));
        url.searchParams.set("key", apiKey);

        const response = await fetch(url.toString());

        if (!response.ok) {
          const errorText = await response.text();

          return {
            content: [
              {
                type: "text",
                text: `YouTube API error: ${response.status} ${errorText}`,
              },
            ],
          };
        }

        const data: any = await response.json();

        const results = (data.items || []).map((item: any) => ({
          title: item.snippet?.title,
          channel: item.snippet?.channelTitle,
          description: item.snippet?.description,
          publishedAt: item.snippet?.publishedAt,
          videoUrl: `https://www.youtube.com/watch?v=${item.id?.videoId}`,
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      },
    );
  }
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return YouTubeResearchMCP.serve("/mcp").fetch(request, env, ctx);
  },
};
