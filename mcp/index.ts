#!/usr/bin/env bun
// stdio entry point of the Course Recording Studio MCP server.
//   claude mcp add course-studio -- bun D:/repos/course-recording-studio/mcp/index.ts
// The app itself must be running (`npm run dev`); set COURSE_STUDIO_URL if it
// does not run on http://localhost:4000.
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StudioClient } from "./studio-client";
import { createStudioMcpServer } from "./server";

const client = new StudioClient();
const server = createStudioMcpServer(client);
await server.connect(new StdioServerTransport());
// stdout carries the protocol; diagnostics go to stderr.
console.error(`course-studio MCP server ready (app: ${client.baseUrl})`);
