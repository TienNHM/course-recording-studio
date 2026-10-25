<p align="center">
  <a href="https://github.com/remotion-dev/logo">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/remotion-dev/brand/main/recorder/dark.gif">
      <img alt="Animated Remotion Logo" src="https://raw.githubusercontent.com/remotion-dev/brand/main/recorder/light.gif">
    </picture>
  </a>
</p>

<p align="center"><strong>Video production for developers</strong></p>

Remotion Recorder is a customizable template for recording, editing and rendering videos in JavaScript.

View documentation at: [remotion.dev/recorder](https://remotion.dev/recorder)

## Automation (AI agents, MCP, CLI)

Course Recording Studio can be driven end to end by AI agents and scripts.
Start the app (`npm run dev`), then:

- **MCP server** for Claude Code, Claude Desktop and other MCP clients:
  `bun mcp/index.ts` (stdio). This repo ships a project `.mcp.json`, or run
  `claude mcp add course-studio -- bun D:/repos/course-recording-studio/mcp/index.ts`.
- **CLI** for shell scripts and CI:
  `npm run studio -- process --course "C# 101" --module "Basics" --lesson "Intro" --file D:\rec.mp4 --render`
- **HTTP API** on `http://localhost:4000/api/...`

See [docs/automation.md](docs/automation.md) for all tools, commands and routes.

## License

Note that for some entities a company license is needed. [Read the terms here](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).

## Commands

**Install Dependencies**

```console
npm install
```

**Start Preview**

```console
npm run dev
```

**Render video**

```console
npx remotion render
```

**Upgrade Remotion**

```console
npx remotion upgrade
```
