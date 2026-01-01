# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**When you need to reference documentation for any library (Vercel AI SDK, Three.js, Next.js, etc.), use the context7 MCP tool to fetch up-to-date docs.**

## Project Overview

Interactive 3D scene creation application where Claude AI controls a Three.js scene through natural language. Users chat with Claude to create/modify 3D objects, lighting, animations, and camera positioning.

## Commands

```bash
npm run dev      # Start dev server on port 8000
npm run build    # Production build
npm run lint     # ESLint
```

## Architecture

### Data Flow
1. User sends message via chat sidebar (`useChat` hook from Vercel AI SDK 6)
2. `/app/api/chat/route.ts` streams response from Claude (sonnet-4.5)
3. Claude returns text + scene commands wrapped in `<scene-commands>...</scene-commands>` tags
4. `page.tsx` extracts commands from `data-scene-command` stream parts
5. Commands applied to Zustand store (`lib/scene-store.ts`)
6. `ThreeBackground.tsx` watches store and syncs Three.js scene

### Key Files
- **`/lib/scene-store.ts`** - Zustand store with scene state (objects, lights, camera, config) and `applyCommand()` dispatcher
- **`/lib/scene-types.ts`** - TypeScript types for all scene objects and commands
- **`/lib/system-prompt.ts`** - Claude's instructions for generating scene commands (JSON schema, geometry params, material types)
- **`/app/components/ThreeBackground.tsx`** - Three.js renderer that syncs with store state
- **`/app/api/chat/route.ts`** - Streaming API endpoint using Vercel AI SDK 6

### Scene Command Actions
9 action types: `addObject`, `updateObject`, `removeObject`, `addLight`, `updateLight`, `removeLight`, `setCamera`, `setConfig`, `clearScene`

### Supported Types
- **Geometries (14):** box, sphere, cylinder, cone, torus, torusKnot, plane, circle, ring, dodecahedron, icosahedron, octahedron, tetrahedron
- **Materials (6):** basic, standard (PBR), phong, lambert, toon, normal
- **Lights (5):** ambient, directional, point, spot, hemisphere
- **Animations (6):** rotate, bounce, float, pulse, orbit, none

### UI Components
- `/components/ai-elements/` - Vercel AI elements (chat components built on shadcn)
- `/components/ui/` - Shadcn components (Radix-based)

## Environment

Requires `ANTHROPIC_API_KEY` in `.env.local`

## Tech Stack
Next.js 16 (App Router), React 19, Three.js, Zustand, Vercel AI SDK 6 (sonnet-4.5), Vercel AI elements, Tailwind v4, shadcn/Radix UI
