import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export class YouTubeResearchMCP extends McpAgent {
  server = new McpServer({
    name: "YouTube Research MCP",
    version: "1.0.0",
  });

  async init() {
    // =========================================================
    // TOOL 1: TEST CONNECTOR
    // =========================================================

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

    // =========================================================
    // TOOL 2: SEARCH YOUTUBE
    // =========================================================

    this.server.tool(
      "search_youtube",
      "Search YouTube videos for research.",
      {
        query: z
          .string()
          .describe("What you want to search for on YouTube"),

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
          videoUrl:
            `https://www.youtube.com/watch?v=${item.id?.videoId}`,
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

    // =========================================================
    // TOOL 3: GET VIDEO DETAILS
    // =========================================================

    this.server.tool(
      "get_video_details",
      "Get detailed information about a YouTube video using its video ID.",
      {
        videoId: z
          .string()
          .describe(
            "The YouTube video ID, for example dQw4w9WgXcQ",
          ),
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
                text:
                  `YouTube API error: ${response.status} ${errorText}`,
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
          views: Number(video.statistics?.viewCount || 0),
          likes: Number(video.statistics?.likeCount || 0),
          comments: Number(
            video.statistics?.commentCount || 0,
          ),
          videoUrl:
            `https://www.youtube.com/watch?v=${videoId}`,
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

    // =========================================================
    // TOOL 4: HISTORICAL HIGH PERFORMERS
    // =========================================================

    this.server.tool(
      "search_historical_videos",
      "Scan multiple years of a YouTube channel and find historical high-performing videos. Searches each year separately, collects candidates, removes duplicates, gets current statistics, calculates views per day and engagement, and ranks the results.",
      {
        channelId: z
          .string()
          .describe("The YouTube channel ID"),

        startYear: z
          .number()
          .int()
          .min(2005)
          .max(2100)
          .default(2019)
          .describe("First year to scan"),

        endYear: z
          .number()
          .int()
          .min(2005)
          .max(2100)
          .default(new Date().getUTCFullYear())
          .describe("Last year to scan"),

        query: z
          .string()
          .optional()
          .describe(
            "Optional keyword/topic to narrow the historical search",
          ),

        resultsPerYear: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(25)
          .describe(
            "Maximum number of search candidates to collect per year",
          ),

        pagesPerYear: z
          .number()
          .int()
          .min(1)
          .max(5)
          .default(3)
          .describe(
            "Maximum YouTube search pages to scan for each year",
          ),

        topResults: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(20)
          .describe(
            "Number of final historical performers to return",
          ),

        minViews: z
          .number()
          .int()
          .min(0)
          .default(0)
          .describe(
            "Optional minimum current view count",
          ),
      },

      async ({
        channelId,
        startYear,
        endYear,
        query,
        resultsPerYear,
        pagesPerYear,
        topResults,
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

        if (startYear > endYear) {
          return {
            content: [
              {
                type: "text",
                text:
                  "startYear must be less than or equal to endYear.",
              },
            ],
          };
        }

        // -----------------------------------------------------
        // STEP 1: Discover historical videos
        // -----------------------------------------------------

        const discovered = new Map<string, any>();

        for (
          let year = startYear;
          year <= endYear;
          year++
        ) {
          const publishedAfter =
            `${year}-01-01T00:00:00Z`;

          const publishedBefore =
            `${year + 1}-01-01T00:00:00Z`;

          let pageToken: string | undefined;
          let pagesScanned = 0;

          while (pagesScanned < pagesPerYear) {
            const searchUrl = new URL(
              "https://www.googleapis.com/youtube/v3/search",
            );

            searchUrl.searchParams.set(
              "part",
              "snippet",
            );

            searchUrl.searchParams.set(
              "channelId",
              channelId,
            );

            searchUrl.searchParams.set(
              "type",
              "video",
            );

            searchUrl.searchParams.set(
              "order",
              "date",
            );

            searchUrl.searchParams.set(
              "maxResults",
              String(
                Math.min(resultsPerYear, 50),
              ),
            );

            searchUrl.searchParams.set(
              "publishedAfter",
              publishedAfter,
            );

            searchUrl.searchParams.set(
              "publishedBefore",
              publishedBefore,
            );

            searchUrl.searchParams.set(
              "key",
              apiKey,
            );

            if (query && query.trim()) {
              searchUrl.searchParams.set(
                "q",
                query.trim(),
              );
            }

            if (pageToken) {
              searchUrl.searchParams.set(
                "pageToken",
                pageToken,
              );
            }

            const response = await fetch(
              searchUrl.toString(),
            );

            if (!response.ok) {
              const errorText =
                await response.text();

              return {
                content: [
                  {
                    type: "text",
                    text:
                      `Historical search failed for ${year}: ` +
                      `${response.status} ${errorText}`,
                  },
                ],
              };
            }

            const data: any =
              await response.json();

            for (
              const item of data.items || []
            ) {
              const videoId =
                item.id?.videoId;

              if (!videoId) continue;

              discovered.set(
                videoId,
                {
                  videoId,
                  title:
                    item.snippet?.title,
                  channel:
                    item.snippet?.channelTitle,
                  channelId:
                    item.snippet?.channelId,
                  description:
                    item.snippet?.description,
                  publishedAt:
                    item.snippet?.publishedAt,
                  year,
                  videoUrl:
                    `https://www.youtube.com/watch?v=${videoId}`,
                },
              );
            }

            pagesScanned++;

            if (!data.nextPageToken) {
              break;
            }

            pageToken =
              data.nextPageToken;
          }
        }

        const discoveredVideos =
          Array.from(
            discovered.values(),
          );

        if (discoveredVideos.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    message:
                      "No historical videos found.",
                    channelId,
                    startYear,
                    endYear,
                    query:
                      query || null,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        // -----------------------------------------------------
        // STEP 2: Fetch statistics in batches of 50
        // -----------------------------------------------------

        const detailedVideos: any[] = [];

        for (
          let i = 0;
          i < discoveredVideos.length;
          i += 50
        ) {
          const batch =
            discoveredVideos.slice(
              i,
              i + 50,
            );

          const videosUrl = new URL(
            "https://www.googleapis.com/youtube/v3/videos",
          );

          videosUrl.searchParams.set(
            "part",
            "snippet,statistics,contentDetails",
          );

          videosUrl.searchParams.set(
            "id",
            batch
              .map(
                (video) =>
                  video.videoId,
              )
              .join(","),
          );

          videosUrl.searchParams.set(
            "key",
            apiKey,
          );

          const response = await fetch(
            videosUrl.toString(),
          );

          if (!response.ok) {
            const errorText =
              await response.text();

            return {
              content: [
                {
                  type: "text",
                  text:
                    `YouTube statistics error: ` +
                    `${response.status} ${errorText}`,
                },
              ],
            };
          }

          const data: any =
            await response.json();

          for (
            const video of data.items || []
          ) {
            const views = Number(
              video.statistics
                ?.viewCount || 0,
            );

            const likes = Number(
              video.statistics
                ?.likeCount || 0,
            );

            const comments =
              Number(
                video.statistics
                  ?.commentCount || 0,
              );

            const publishedAt =
              video.snippet
                ?.publishedAt;

            const publishedTime =
              publishedAt
                ? new Date(
                    publishedAt,
                  ).getTime()
                : Date.now();

            const ageDays = Math.max(
              1,
              Math.floor(
                (Date.now() -
                  publishedTime) /
                  (1000 *
                    60 *
                    60 *
                    24),
              ),
            );

            const viewsPerDay =
              views / ageDays;

            const likeRate =
              views > 0
                ? likes / views
                : 0;

            const commentRate =
              views > 0
                ? comments / views
                : 0;

            const engagementRate =
              views > 0
                ? (likes + comments) /
                  views
                : 0;

            // Internal research score.
            // This is NOT an official YouTube metric.

            const logViews =
              Math.log10(
                views + 1,
              );

            const logViewsPerDay =
              Math.log10(
                viewsPerDay + 1,
              );

            const performanceScore =
              logViews * 0.55 +
              logViewsPerDay * 0.30 +
              engagementRate *
                100 *
                0.15;

            detailedVideos.push(
              {
                videoId:
                  video.id,

                title:
                  video.snippet
                    ?.title,

                channel:
                  video.snippet
                    ?.channelTitle,

                channelId:
                  video.snippet
                    ?.channelId,

                description:
                  video.snippet
                    ?.description,

                publishedAt,

                duration:
                  video
                    .contentDetails
                    ?.duration,

                views,
                likes,
                comments,

                ageDays,

                viewsPerDay:
                  Math.round(
                    viewsPerDay *
                      100,
                  ) / 100,

                likeRate:
                  Math.round(
                    likeRate *
                      10000,
                  ) / 100,

                commentRate:
                  Math.round(
                    commentRate *
                      10000,
                  ) / 100,

                engagementRate:
                  Math.round(
                    engagementRate *
                      10000,
                  ) / 100,

                performanceScore:
                  Math.round(
                    performanceScore *
                      100,
                  ) / 100,

                videoUrl:
                  `https://www.youtube.com/watch?v=${video.id}`,
              },
            );
          }
        }

        // -----------------------------------------------------
        // STEP 3: Minimum views filter
        // -----------------------------------------------------

        const filtered =
          detailedVideos.filter(
            (video) =>
              video.views >=
              minViews,
          );

        // -----------------------------------------------------
        // STEP 4: Rank
        // -----------------------------------------------------

        filtered.sort(
          (a, b) =>
            b.performanceScore -
            a.performanceScore,
        );

        const finalResults =
          filtered.slice(
            0,
            topResults,
          );

        // -----------------------------------------------------
        // STEP 5: Return research report
        // -----------------------------------------------------

        const report = {
          searchType:
            "historical_high_performers",

          channelId,

          scannedYears: {
            start: startYear,
            end: endYear,
          },

          query:
            query || null,

          discoveredVideos:
            discoveredVideos.length,

          analyzedVideos:
            detailedVideos.length,

          videosAfterMinViewsFilter:
            filtered.length,

          returned:
            finalResults.length,

          rankingMethod: {
            description:
              "Internal research score combining total views, views per day, and engagement rate.",

            weights: {
              totalViews: 0.55,
              viewsPerDay: 0.30,
              engagement: 0.15,
            },

            note:
              "Performance score is an internal research metric, not an official YouTube metric.",
          },

          results:
            finalResults,
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                report,
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
  fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ) {
    return YouTubeResearchMCP
      .serve("/mcp")
      .fetch(
        request,
        env,
        ctx,
      );
  },
};
