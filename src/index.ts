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
          .describe(
            "Number of videos to return, from 1 to 10",
          ),
      },

      async ({ query, maxResults }) => {
        const apiKey =
          (this.env as any).YOUTUBE_API_KEY;

        if (!apiKey) {
          return {
            content: [
              {
                type: "text",
                text:
                  "YouTube API key is not configured.",
              },
            ],
          };
        }

        const url = new URL(
          "https://www.googleapis.com/youtube/v3/search",
        );

        url.searchParams.set(
          "part",
          "snippet",
        );

        url.searchParams.set(
          "q",
          query,
        );

        url.searchParams.set(
          "type",
          "video",
        );

        url.searchParams.set(
          "maxResults",
          String(maxResults),
        );

        url.searchParams.set(
          "key",
          apiKey,
        );

        const response =
          await fetch(
            url.toString(),
          );

        if (!response.ok) {
          const errorText =
            await response.text();

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

        const data: any =
          await response.json();

        const results =
          (data.items || []).map(
            (item: any) => ({
              videoId:
                item.id?.videoId,

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

              videoUrl:
                `https://www.youtube.com/watch?v=${item.id?.videoId}`,
            }),
          );

        return {
          content: [
            {
              type: "text",
              text:
                JSON.stringify(
                  results,
                  null,
                  2,
                ),
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
        const apiKey =
          (this.env as any).YOUTUBE_API_KEY;

        if (!apiKey) {
          return {
            content: [
              {
                type: "text",
                text:
                  "YouTube API key is not configured.",
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

        url.searchParams.set(
          "id",
          videoId,
        );

        url.searchParams.set(
          "key",
          apiKey,
        );

        const response =
          await fetch(
            url.toString(),
          );

        if (!response.ok) {
          const errorText =
            await response.text();

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

        const data: any =
          await response.json();

        if (
          !data.items ||
          data.items.length === 0
        ) {
          return {
            content: [
              {
                type: "text",
                text:
                  "Video not found.",
              },
            ],
          };
        }

        const video =
          data.items[0];

        const result = {
          videoId:
            video.id,

          title:
            video.snippet?.title,

          channel:
            video.snippet?.channelTitle,

          channelId:
            video.snippet?.channelId,

          description:
            video.snippet?.description,

          publishedAt:
            video.snippet?.publishedAt,

          duration:
            video.contentDetails?.duration,

          views:
            Number(
              video.statistics
                ?.viewCount || 0,
            ),

          likes:
            Number(
              video.statistics
                ?.likeCount || 0,
            ),

          comments:
            Number(
              video.statistics
                ?.commentCount || 0,
            ),

          videoUrl:
            `https://www.youtube.com/watch?v=${videoId}`,
        };

        return {
          content: [
            {
              type: "text",
              text:
                JSON.stringify(
                  result,
                  null,
                  2,
                ),
            },
          ],
        };
      },
    );

   
     // =========================================================
    // TOOL 4: GET VIDEO COMMENTS
    // =========================================================

    this.server.tool(
      "get_video_comments",
      "Read and analyze YouTube comments from a video. Automatically follows pagination and collects comments for audience research, sentiment analysis, questions, feedback, content ideas, and audience insights.",

      {
        videoId: z
          .string()
          .describe(
            "The YouTube video ID, for example dQw4w9WgXcQ",
          ),

        maxComments: z
          .number()
          .int()
          .min(1)
          .max(2000)
          .default(500)
          .describe(
            "Maximum number of top-level comments to collect. The tool automatically follows pagination.",
          ),

        order: z
          .enum([
            "relevance",
            "time",
          ])
          .default("relevance")
          .describe(
            "Comment ordering. Use relevance for audience research or time for newest comments.",
          ),
      },

      async ({
        videoId,
        maxComments,
        order,
      }) => {

        const apiKey =
          (this.env as any)
            .YOUTUBE_API_KEY;

        if (!apiKey) {
          return {
            content: [
              {
                type: "text",
                text:
                  "YouTube API key is not configured.",
              },
            ],
          };
        }

        const comments: any[] = [];

        let pageToken:
          string | undefined;

        let pagesScanned = 0;

        const maxPages = Math.ceil(
          maxComments / 100,
        );

        try {

          while (
            comments.length <
              maxComments &&
            pagesScanned <
              maxPages
          ) {

            const url =
              new URL(
                "https://www.googleapis.com/youtube/v3/commentThreads",
              );

            url.searchParams.set(
              "part",
              "snippet",
            );

            url.searchParams.set(
              "videoId",
              videoId,
            );

            url.searchParams.set(
              "maxResults",
              String(
                Math.min(
                  100,
                  maxComments -
                    comments.length,
                ),
              ),
            );

            url.searchParams.set(
              "order",
              order,
            );

            url.searchParams.set(
              "textFormat",
              "plainText",
            );

            url.searchParams.set(
              "key",
              apiKey,
            );

            if (pageToken) {
              url.searchParams.set(
                "pageToken",
                pageToken,
              );
            }

            const response =
              await fetch(
                url.toString(),
              );

            if (!response.ok) {

              const errorText =
                await response.text();

              return {
                content: [
                  {
                    type: "text",
                    text:
                      `YouTube comments API error: ${response.status} ${errorText}`,
                  },
                ],
              };
            }

            const data: any =
              await response.json();

            const items =
              data.items || [];

            for (
              const item of items
            ) {

              const comment =
                item.snippet
                  ?.topLevelComment
                  ?.snippet;

              if (!comment) {
                continue;
              }

              comments.push({
                commentId:
                  item.snippet
                    ?.topLevelComment
                    ?.id,

                author:
                  comment
                    ?.authorDisplayName,

                text:
                  comment
                    ?.textDisplay,

                likeCount:
                  Number(
                    comment
                      ?.likeCount || 0,
                  ),

                publishedAt:
                  comment
                    ?.publishedAt,

                updatedAt:
                  comment
                    ?.updatedAt,

                totalReplies:
                  Number(
                    item.snippet
                      ?.totalReplyCount ||
                      0,
                  ),
              });

              if (
                comments.length >=
                maxComments
              ) {
                break;
              }
            }

            pagesScanned++;

            if (
              !data.nextPageToken
            ) {
              break;
            }

            pageToken =
              data.nextPageToken;
          }

          const result = {
            videoId,

            commentsRequested:
              maxComments,

            commentsReturned:
              comments.length,

            pagesScanned,

            order,

            comments,
          };

          return {
            content: [
              {
                type: "text",
                text:
                  JSON.stringify(
                    result,
                    null,
                    2,
                  ),
              },
            ],
          };

        } catch (error: any) {

          return {
            content: [
              {
                type: "text",
                text:
                  `Failed to fetch YouTube comments: ${error?.message || String(error)}`,
              },
            ],
          };
        }
      },
    );
    
    
    // =========================================================
    // TOOL 5: GET VIDEO THUMBNAIL
    // =========================================================

    this.server.tool(
      "get_video_thumbnail",
      "Fetch the actual YouTube video thumbnail and return it as an MCP image for visual analysis.",
      {
        videoId: z
          .string()
          .describe(
            "The YouTube video ID, for example dQw4w9WgXcQ",
          ),
      },

      async ({ videoId }) => {
        const apiKey =
          (this.env as any)
            .YOUTUBE_API_KEY;

        if (!apiKey) {
          return {
            content: [
              {
                type: "text",
                text:
                  "YouTube API key is not configured.",
              },
            ],
          };
        }

        try {
          // -------------------------------------------------
          // STEP 1: Get thumbnail URL from YouTube API
          // -------------------------------------------------

          const apiUrl =
            new URL(
              "https://www.googleapis.com/youtube/v3/videos",
            );

          apiUrl.searchParams.set(
            "part",
            "snippet",
          );

          apiUrl.searchParams.set(
            "id",
            videoId,
          );

          apiUrl.searchParams.set(
            "key",
            apiKey,
          );

          const apiResponse =
            await fetch(
              apiUrl.toString(),
            );

          if (!apiResponse.ok) {
            const errorText =
              await apiResponse.text();

            return {
              content: [
                {
                  type: "text",
                  text:
                    `YouTube API error: ${apiResponse.status} ${errorText}`,
                },
              ],
            };
          }

          const apiData: any =
            await apiResponse.json();

          if (
            !apiData.items ||
            apiData.items.length === 0
          ) {
            return {
              content: [
                {
                  type: "text",
                  text:
                    "Video not found.",
                },
              ],
            };
          }

          const video =
            apiData.items[0];

          const thumbnails =
            video.snippet?.thumbnails;

          const thumbnailUrl =
            thumbnails?.maxres?.url ||
            thumbnails?.standard?.url ||
            thumbnails?.high?.url ||
            thumbnails?.medium?.url ||
            thumbnails?.default?.url;

          if (!thumbnailUrl) {
            return {
              content: [
                {
                  type: "text",
                  text:
                    "No thumbnail was available for this video.",
                },
              ],
            };
          }

          // -------------------------------------------------
          // STEP 2: Fetch the actual thumbnail image
          // -------------------------------------------------

          const imageResponse =
            await fetch(
              thumbnailUrl,
            );

          if (!imageResponse.ok) {
            return {
              content: [
                {
                  type: "text",
                  text:
                    `Could not fetch thumbnail image: ${imageResponse.status}`,
                },
              ],
            };
          }

          // -------------------------------------------------
          // STEP 3: Convert image bytes to Base64
          // -------------------------------------------------

          const imageBuffer =
            await imageResponse.arrayBuffer();

          const bytes =
            new Uint8Array(
              imageBuffer,
            );

          let binary = "";

          const chunkSize =
            0x8000;

          for (
            let i = 0;
            i < bytes.length;
            i += chunkSize
          ) {
            const chunk =
              bytes.subarray(
                i,
                Math.min(
                  i + chunkSize,
                  bytes.length,
                ),
              );

            binary += String.fromCharCode(
              ...chunk,
            );
          }

          const base64 =
            btoa(binary);

          // -------------------------------------------------
          // STEP 4: Detect MIME type
          // -------------------------------------------------

          const contentType =
            imageResponse.headers.get(
              "content-type",
            ) || "image/jpeg";

          const mimeType =
            contentType.split(";")[0];

          // -------------------------------------------------
          // STEP 5: Return actual MCP image
          // -------------------------------------------------

          return {
            content: [
              {
                type: "image",
                data: base64,
                mimeType,
              },
              {
                type: "text",
                text:
                  `Thumbnail fetched successfully for video ${videoId}.`,
              },
            ],
          };

        } catch (error: any) {
          return {
            content: [
              {
                type: "text",
                text:
                  `Failed to fetch YouTube thumbnail: ${error?.message || String(error)}`,
              },
            ],
          };
        }
      }, 
    );

    
    // =========================================================
    // TOOL 6: CHANNEL STATISTICS
    // =========================================================

    this.server.tool(
      "get_channel_statistics",
      "Get basic statistics and information about a YouTube channel.",
      {
        channelId: z
          .string()
          .describe(
            "The YouTube channel ID",
          ),
      },

      async ({ channelId }) => {
        const apiKey =
          (this.env as any).YOUTUBE_API_KEY;

        if (!apiKey) {
          return {
            content: [
              {
                type: "text",
                text:
                  "YouTube API key is not configured.",
              },
            ],
          };
        }

        const url = new URL(
          "https://www.googleapis.com/youtube/v3/channels",
        );

        url.searchParams.set(
          "part",
          "snippet,statistics,contentDetails",
        );

        url.searchParams.set(
          "id",
          channelId,
        );

        url.searchParams.set(
          "key",
          apiKey,
        );

        const response =
          await fetch(
            url.toString(),
          );

        if (!response.ok) {
          const errorText =
            await response.text();

          return {
            content: [
              {
                type: "text",
                text:
                  `YouTube channel statistics error: ${response.status} ${errorText}`,
              },
            ],
          };
        }

        const data: any =
          await response.json();

        if (
          !data.items ||
          data.items.length === 0
        ) {
          return {
            content: [
              {
                type: "text",
                text:
                  "Channel not found.",
              },
            ],
          };
        }

        const channel =
          data.items[0];

        const result = {
          channelId:
            channel.id,

          channelName:
            channel.snippet?.title,

          description:
            channel.snippet?.description,

          publishedAt:
            channel.snippet?.publishedAt,

          country:
            channel.snippet?.country ||
            null,

          subscribers:
            Number(
              channel.statistics
                ?.subscriberCount || 0,
            ),

          totalViews:
            Number(
              channel.statistics
                ?.viewCount || 0,
            ),

          totalVideos:
            Number(
              channel.statistics
                ?.videoCount || 0,
            ),

          hiddenSubscriberCount:
            Boolean(
              channel.statistics
                ?.hiddenSubscriberCount ||
                false,
            ),

          uploadsPlaylistId:
            channel.contentDetails
              ?.relatedPlaylists
              ?.uploads || null,

          channelUrl:
            `https://www.youtube.com/channel/${channel.id}`,
        };

        return {
          content: [
            {
              type: "text",
              text:
                JSON.stringify(
                  result,
                  null,
                  2,
                ),
            },
          ],
        };
      },
    );


    // =========================================================
    // TOOL 7: HISTORICAL HIGH PERFORMERS
    // =========================================================

    this.server.tool(
      "search_historical_videos",

      "Scan a YouTube channel year-by-year, follow pagination for every year, collect historical videos, fetch their statistics, calculate multiple performance metrics, and return separate rankings for views, views per day, engagement, and overall performance.",

      {
        channelId: z
          .string()
          .describe(
            "The YouTube channel ID",
          ),

        startYear: z
          .number()
          .int()
          .min(2005)
          .max(2100)
          .default(2019)
          .describe(
            "First year to scan",
          ),

        endYear: z
          .number()
          .int()
          .min(2005)
          .max(2100)
          .default(
            new Date().getUTCFullYear(),
          )
          .describe(
            "Last year to scan",
          ),

        query: z
          .string()
          .optional()
          .describe(
            "Optional keyword/topic to narrow the historical search",
          ),

        resultsPerPage: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(50)
          .describe(
            "Number of YouTube search results requested per page",
          ),

        pagesPerYear: z
          .number()
          .int()
          .min(1)
          .max(20)
          .default(5)
          .describe(
            "Maximum number of search pages to scan for each year",
          ),

        topResults: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(20)
          .describe(
            "Number of videos returned in each ranking",
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
        resultsPerPage,
        pagesPerYear,
        topResults,
        minViews,
      }) => {

        const apiKey =
          (this.env as any)
            .YOUTUBE_API_KEY;

        if (!apiKey) {
          return {
            content: [
              {
                type: "text",
                text:
                  "YouTube API key is not configured.",
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


        // =====================================================
        // STEP 1: YEAR-BY-YEAR HISTORICAL SEARCH
        // =====================================================

        const discovered =
          new Map<string, any>();

        const yearlyStats:
          Record<string, number> = {};


        for (
          let year = startYear;
          year <= endYear;
          year++
        ) {

          const publishedAfter =
            `${year}-01-01T00:00:00Z`;

          const publishedBefore =
            `${year + 1}-01-01T00:00:00Z`;

          let pageToken:
            string | undefined;

          let pagesScanned = 0;

          let videosFoundThisYear =
            0;


          while (
            pagesScanned <
            pagesPerYear
          ) {

            const searchUrl =
              new URL(
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
                Math.min(
                  resultsPerPage,
                  50,
                ),
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


            if (
              query &&
              query.trim()
            ) {
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


            const response =
              await fetch(
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
                      `Historical search failed for ${year}: ${response.status} ${errorText}`,
                  },
                ],
              };
            }


            const data: any =
              await response.json();

            const items =
              data.items || [];


            for (
              const item of items
            ) {

              const videoId =
                item.id?.videoId;

              if (!videoId) {
                continue;
              }


              if (
                !discovered.has(
                  videoId,
                )
              ) {

                discovered.set(
                  videoId,
                  {
                    videoId,

                    title:
                      item.snippet
                        ?.title,

                    channel:
                      item.snippet
                        ?.channelTitle,

                    channelId:
                      item.snippet
                        ?.channelId,

                    description:
                      item.snippet
                        ?.description,

                    publishedAt:
                      item.snippet
                        ?.publishedAt,

                    year,

                    videoUrl:
                      `https://www.youtube.com/watch?v=${videoId}`,
                  },
                );

                videosFoundThisYear++;
              }
            }


            pagesScanned++;


            if (
              !data.nextPageToken
            ) {
              break;
            }


            pageToken =
              data.nextPageToken;
          }


          yearlyStats[
            String(year)
          ] =
            videosFoundThisYear;
        }


        const discoveredVideos =
          Array.from(
            discovered.values(),
          );


        if (
          discoveredVideos.length === 0
        ) {
          return {
            content: [
              {
                type: "text",
                text:
                  JSON.stringify(
                    {
                      message:
                        "No historical videos found.",

                      channelId,

                      startYear,

                      endYear,

                      query:
                        query || null,

                      yearlyDiscovery:
                        yearlyStats,
                    },
                    null,
                    2,
                  ),
              },
            ],
          };
        }


        // =====================================================
        // STEP 2: GET VIDEO STATISTICS
        // =====================================================

        const detailedVideos:
          any[] = [];


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


          const videosUrl =
            new URL(
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


          const response =
            await fetch(
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
                    `YouTube statistics error: ${response.status} ${errorText}`,
                },
              ],
            };
          }


          const data: any =
            await response.json();


          for (
            const video of
              data.items || []
          ) {

            const views =
              Number(
                video.statistics
                  ?.viewCount || 0,
              );

            const likes =
              Number(
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

            const ageDays =
              Math.max(
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
                ? (likes +
                    comments) /
                  views
                : 0;

            // -------------------------------------------------
            // Internal research score
            // -------------------------------------------------

            const logViews =
              Math.log10(
                views + 1,
              );

            const logViewsPerDay =
              Math.log10(
                viewsPerDay + 1,
              );

            const engagementPoints =
              engagementRate *
              100;

            const performanceScore =
              logViews * 0.55 +
              logViewsPerDay * 0.30 +
              engagementPoints * 0.15;

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

                year: publishedAt
                  ? new Date(
                      publishedAt,
                    ).getUTCFullYear()
                  : null,

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


        // =====================================================
        // STEP 3: MINIMUM VIEWS FILTER
        // =====================================================

        const filtered =
          detailedVideos.filter(
            (video) =>
              video.views >=
              minViews,
          );


        // =====================================================
        // STEP 4: CREATE SEPARATE RANKINGS
        // =====================================================

        const byViews = [
          ...filtered,
        ]
          .sort(
            (a, b) =>
              b.views -
              a.views,
          )
          .slice(
            0,
            topResults,
          );


        const byViewsPerDay = [
          ...filtered,
        ]
          .sort(
            (a, b) =>
              b.viewsPerDay -
              a.viewsPerDay,
          )
          .slice(
            0,
            topResults,
          );


        const byEngagement = [
          ...filtered,
        ]
          .sort(
            (a, b) =>
              b.engagementRate -
              a.engagementRate,
          )
          .slice(
            0,
            topResults,
          );


        const byOverallPerformance = [
          ...filtered,
        ]
          .sort(
            (a, b) =>
              b.performanceScore -
              a.performanceScore,
          )
          .slice(
            0,
            topResults,
          );


        // =====================================================
        // STEP 5: FINAL RESULT
        // =====================================================

        const result = {
          channelId,

          scanRange: {
            startYear,
            endYear,
          },

          query:
            query || null,

          settings: {
            resultsPerPage,
            pagesPerYear,
            topResults,
            minViews,
          },

          discovery: {
            totalUniqueVideos:
              discoveredVideos.length,

            videosWithStatistics:
              detailedVideos.length,

            videosAfterMinViewsFilter:
              filtered.length,

            yearlyDiscovery:
              yearlyStats,
          },

          rankings: {
            highestViews:
              byViews,

            highestViewsPerDay:
              byViewsPerDay,

            highestEngagement:
              byEngagement,

            overallPerformance:
              byOverallPerformance,
          },
        };


        return {
          content: [
            {
              type: "text",
              text:
                JSON.stringify(
                  result,
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

export default YouTubeResearchMCP.serve("/mcp");
