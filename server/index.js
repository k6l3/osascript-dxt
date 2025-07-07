#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

// Constants
const OSASCRIPT_TIMEOUT = 30000;

class OsascriptServer {
  constructor() {
    this.server = new Server(
      {
        name: "osascript",
        version: "0.0.1",
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.setupHandlers();
  }

  async executeOsascript(script) {
    try {
      const { stdout, stderr } = await execFileAsync(
        "osascript",
        ["-e", script],
        {
          timeout: OSASCRIPT_TIMEOUT,
          maxBuffer: 1024 * 1024,
        },
      );
      if (stderr) {
        console.error("Osascript stderr:", stderr);
      }
      return stdout.trim();
    } catch (error) {
      console.error("Failed to execute osascript:", error);
      throw error;
    }
  }

  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "osascript",
          description: "Execute osascript commands",
          inputSchema: {
            type: "object",
            properties: {
              script: {
                type: "string",
                description: "The AppleScript to execute",
              },
            },
            required: ["script"],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (!request.params.name) {
        throw new Error("Tool name is required");
      }

      const toolName = request.params.name;

      switch (toolName) {
        case "osascript": {
          const args = request.params.arguments;
          if (!args || typeof args.script !== "string") {
            throw new Error("Script argument is required");
          }

          try {
            const result = await this.executeOsascript(args.script);
            return {
              content: [
                {
                  type: "text",
                  text: result,
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: `Error executing osascript: ${error.message}`,
                },
              ],
              isError: true,
            };
          }
        }
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Osascript MCP server running on stdio");
  }
}

const server = new OsascriptServer();
server.run().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});