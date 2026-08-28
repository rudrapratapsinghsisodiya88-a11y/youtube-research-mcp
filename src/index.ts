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
          channelId: item.snippet?.channelId,
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

    // Tool 4: Search Historical High Performers
    this.server.tool(
      "search_historical_videos",
      "Find older/high-performing videos from a specific YouTube channel using historical date ranges. Results are ranked by current view count.",
      {
        channelId: z
          .string()
          .describe(
            "The YouTube channel ID, for example UCxxxxxxxxxxxxxxxxxxxxxx",
          ),

        query: z
          .string()
          .optional()
          .describe(
            "Optional topic/keyword to narrow the historical search",
          ),

        publishedAfter: z
          .string()
          .describe(
            "Start date in ISO 8601 format, for example 2022-01-01T00:00:00Z",
          ),

        publishedBefore: z
          .string()
          .describe(
            "End date in ISO 8601 format, for example 2023-01-01T00:00:00Z",
          ),

        maxResults: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(20)
          .describe("Maximum number of historical videos to return"),

        minViews: z
          .number()
          .int()
          .min(0)
          .default(0)
          .describe("Optional minimum current view count"),
      },
      async ({
        channelId,
        query,
        publishedAfter,
        publishedBefore,
        maxResults,
        minViews,
      }) => {
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

        // Step 1: Search the selected channel inside the requested
        // historical date range.
        const searchUrl = new URL(
          "https://www.googleapis.com/youtube/v3/search",
        );

        searchUrl.searchParams.set("part", "snippet");
        searchUrl.searchParams.set("channelId", channelId);
        searchUrl.searchParams.set("type", "video");
        searchUrl.searchParams.set("order", "date");
        searchUrl.searchParams.set("maxResults", String(maxResults));
        searchUrl.searchParams.set("publishedAfter", publishedAfter);
        searchUrl.searchParams.set("publishedBefore", publishedBefore);
        searchUrl.searchParams.set("key", apiKey);

        if (query && query.trim()) {
          searchUrl.searchParams.set("q", query.trim());
        }

        const searchResponse = await fetch(searchUrl.toString());

        if (!searchResponse.ok) {
          const errorText = await searchResponse.text();

          return {
            content: [
              {
                type: "text",
                text: `YouTube historical search error: ${searchResponse.status} ${errorText}`,
              },
            ],
          };
        }

        const searchData: any = await searchResponse.json();

        const videoIds = (searchData.items || [])
          .map((item: any) => item.id?.videoId)
          .filter(Boolean);

        if (videoIds.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    message: "No historical videos found.",
                    channelId,
                    query: query || null,
                    publishedAfter,
                    publishedBefore,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        // Step 2: Get actual video statistics.
        const videosUrl = new URL(
          "https://www.googleapis.com/youtube/v3/videos",
        );

        videosUrl.searchParams.set(
          "part",
          "snippet,statistics,contentDetails",
        );
        videosUrl.searchParams.set("id", videoIds.join(","));
        videosUrl.searchParams.set("key", apiKey);

        const videosResponse = await fetch(videosUrl.toString());

        if (!videosResponse.ok) {
          const errorText = await videosResponse.text();

          return {
            content: [
              {
                type: "text",
                text: `YouTube video statistics error: ${videosResponse.status} ${errorText}`,
              },
            ],
          };
        }

        const videosData: any = await videosResponse.json();

        // Step 3: Build clean historical records.
        const results = (videosData.items || [])
          .map((video: any) => {
            const views = Number(video.statistics?.viewCount || 0);

            return {
              videoId: video.id,
              title: video.snippet?.title,
              channel: video.snippet?.channelTitle,
              channelId: video.snippet?.channelId,
              description: video.snippet?.description,
              publishedAt: video.snippet?.publishedAt,
              duration: video.contentDetails?.duration,
              views,
              likes: Number(video.statistics?.likeCount || 0),
              comments: Number(video.statistics?.commentCount || 0),
              videoUrl: `https://www.youtube.com/watch?v=${video.id}`,
            };
          })
          .filter((video: any) => video.views >= minViews)
          .sort((a: any, b: any) => b.views - a.views);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  searchType: "historical_high_performers",
                  channelId,
                  query: query || null,
                  publishedAfter,
                  publishedBefore,
                  totalFound: results.length,
                  results,
                },
                null,
                2,
              ),
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
