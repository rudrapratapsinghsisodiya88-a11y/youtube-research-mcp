import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export class YouTubeResearchMCP extends McpAgent {
  server = new McpServer({
    name: "YouTube Research MCP",
    version: "1.0.0",
  });

  async init() {
    // Tool 1: Test connector
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

    // Tool 2: Search YouTube
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

    // Tool 3: Get video details
    this.server.tool(
      "get_video_details",
      "Get detailed information about a YouTube video using its video ID.",
      {
        videoId: z
          .string()
          .describe("The YouTube video ID, for example dQw4w9WgXcQ"),
      },
      async ({ videoId }) => {
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
          "https://www.googleapis.com/youtube/v3/videos",
        );

        url.searchParams.set(
          "part",
          "snippet,statistics,contentDetails",
        );
        url.searchParams.set("id", videoId);
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

        if (!data.items || data.items.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "Video not found.",
              },
            ],
          };
        }

        const video = data.items[0];

        const result = {
          title: video.snippet?.title,
          channel: video.snippet?.channelTitle,
          channelId: video.snippet?.channelId,
          description: video.snippet?.description,
          publishedAt: video.snippet?.publishedAt,
          duration: video.contentDetails?.duration,
          views: video.statistics?.viewCount,
          likes: video.statistics?.likeCount,
          comments: video.statistics?.commentCount,
          videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
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
