# BrandRepo Integration Architecture

This document is the source of truth for BrandRepo's technical strategy for connecting external AI and creative tools such as ChatGPT, Claude, Figma, Canva, and future agent clients.

The goal is to avoid building separate one-off integrations. BrandRepo should expose one stable repo context layer that every internal and external integration can use.

## Product Goal

BrandRepo is the system of record for brand knowledge:

- Structured repo sections such as Brand Basics, Messaging, Identity, Colors, Typography, Voice & Tone, Audiences, Channel SEO, Rules, and Imagery.
- Markdown representations of each section for agent-friendly access.
- Uploaded assets such as logos, icons, elements, imagery, and generated marketing assets.
- Account-owned repos with private access control.

External tools should be able to retrieve this context, reason over it, and eventually save approved outputs back into BrandRepo.

## Core Architecture

BrandRepo should be organized around a provider-agnostic core API.

```txt
BrandRepo database + object storage
        |
        v
Repo Context Service
        |
        v
BrandRepo API
        |
        +-- BrandRepo web app
        +-- BrandRepo internal chat
        +-- ChatGPT MCP server
        +-- Claude MCP server
        +-- Figma integration
        +-- Canva integration
        +-- future public API clients
```

The MCP server should not be the source of truth. It should be an adapter over the BrandRepo API.

## Required Internal Services

### Repo Context Service

The Repo Context Service assembles all useful repo knowledge into a predictable shape. This should power both BrandRepo's internal chat and external integrations.

Responsibilities:

- Load the active repo for an authenticated account.
- Generate current markdown for each repo section.
- Return structured field data for each section.
- Return asset metadata and stable asset URLs.
- Exclude irrelevant asset categories depending on the request.
- Trim or summarize large content when needed for model context limits.
- Preserve section boundaries so models can cite where information came from.

Example shape:

```ts
type RepoContext = {
  repo: {
    id: string;
    name: string;
    slug: string;
    websiteUrl?: string;
  };
  sections: Array<{
    key: string;
    title: string;
    markdownFileName: string;
    markdown: string;
    structuredData: unknown;
    updatedAt?: string;
  }>;
  assets: Array<{
    id: string;
    kind: "logo" | "icon" | "element" | "imagery" | "generated";
    name: string;
    description?: string;
    url: string;
    mimeType?: string;
    storagePath?: string;
    section?: string;
  }>;
};
```

### BrandRepo API

The API should expose stable primitives that do not depend on a specific external tool.

Initial read endpoints:

- `GET /api/repos`
- `GET /api/repos/:repoId`
- `GET /api/repos/:repoId/context`
- `GET /api/repos/:repoId/sections`
- `GET /api/repos/:repoId/sections/:sectionKey`
- `GET /api/repos/:repoId/sections/:sectionKey/markdown`
- `GET /api/repos/:repoId/assets`
- `GET /api/repos/:repoId/assets/:assetId`
- `GET /api/repos/:repoId/search?q=...`

Later write endpoints:

- `PATCH /api/repos/:repoId/sections/:sectionKey`
- `POST /api/repos/:repoId/assets`
- `PATCH /api/repos/:repoId/assets/:assetId`
- `DELETE /api/repos/:repoId/assets/:assetId`
- `POST /api/repos/:repoId/drafts`
- `POST /api/repos/:repoId/drafts/:draftId/approve`

## ChatGPT MCP Strategy

ChatGPT should connect to BrandRepo through a remote MCP server hosted at a stable HTTPS endpoint.

Preferred endpoint:

```txt
https://brandrepo.dev/api/mcp
```

Alternative if separation becomes useful:

```txt
https://mcp.brandrepo.dev
```

The MCP server should expose tools that call the BrandRepo API internally.

### V1 MCP Tools

Start read-only.

- `list_repos`
  - Lists repos available to the authenticated user.

- `get_repo_overview`
  - Returns repo metadata and section completeness.

- `get_repo_context`
  - Returns agent-ready repo context, including markdown and relevant assets.

- `get_section_markdown`
  - Returns the markdown for one section.

- `search_repo`
  - Searches repo sections and asset metadata.

- `list_assets`
  - Lists assets by kind, section, or metadata.

- `get_asset`
  - Returns metadata and URL for a specific asset.

### Later MCP Write Tools

Write tools should be added only after read behavior is reliable.

- `create_generated_asset_draft`
- `save_generated_asset`
- `propose_section_update`
- `create_content_draft`
- `approve_draft`

Avoid direct overwrite tools early. For example, do not start with `update_messaging` unless there is a confirmation and draft review flow.

## Auth Strategy

BrandRepo repos are private account data. External clients must not use Supabase anon keys directly.

Recommended path:

1. Prototype with scoped developer tokens.
2. Move to OAuth before broader testing.
3. Use short-lived access tokens for tool calls.
4. Scope tokens by account, repo, and permission level.

Permission scopes should be explicit:

- `repo:read`
- `repo:write`
- `assets:read`
- `assets:write`
- `drafts:write`

For ChatGPT, users should connect their BrandRepo account and grant access. The MCP server should validate that token on every request.

## Read vs. Write Policy

Read operations are safe enough for the first integration.

Write operations need stronger UX and safety controls:

- The model should create drafts, not silently overwrite repo sections.
- The user should review and approve changes inside BrandRepo.
- Generated assets should be saved explicitly.
- Destructive actions should not be exposed through MCP until the product has stronger permission controls.

Initial policy:

```txt
MCP v1 = read-only
MCP v2 = draft creation
MCP v3 = approved writes
MCP later = selective direct writes for trusted workflows
```

## Context Packaging Rules

Models need concise, well-labeled context. The Repo Context Service should:

- Include markdown by section.
- Include structured fields alongside markdown when useful.
- Include only relevant asset categories for the user request.
- Prefer stable storage URLs over base64 data.
- Never include large base64 assets in text context.
- Cap context length before sending to model providers.
- Preserve filenames like `messaging.md`, `logos.md`, and `channel-seo.md`.
- Include asset name and description so models know which asset to use.

For image generation, logo and identity assets should be passed as image references when the provider supports image inputs. Text descriptions alone are not enough.

## Provider Strategy

### ChatGPT

Use remote MCP for ChatGPT access to BrandRepo context.

V1 should answer questions and generate content from repo context. Saving back should happen as drafts or explicit user-approved actions.

### Claude

Use the same BrandRepo API and expose a Claude-compatible MCP server or configuration. The tools should mirror the ChatGPT MCP tools where possible.

### Figma

Figma likely needs a dedicated plugin or app integration rather than only MCP. It should call the BrandRepo API directly for:

- Logo access.
- Color tokens.
- Typography.
- Identity usage rules.
- Exporting selected design assets back into BrandRepo.

### Canva

Canva likely needs an app integration focused on assets and brand kit workflows. It should call the same BrandRepo API for:

- Approved logos.
- Colors.
- Typography guidance.
- Imagery.
- Generated campaign assets.

## Implementation Phases

### Phase 1: Internal API Foundation

- Create Repo Context Service.
- Add internal API endpoints for repo context, markdown, and assets.
- Refactor internal chat to use Repo Context Service.
- Ensure markdown generation is consistent across sections.

### Phase 2: Read-Only MCP

- Add remote MCP endpoint.
- Implement read-only tools.
- Add scoped token auth for local testing.
- Test in ChatGPT developer mode.

## Current Acceptance Criteria

The first integration foundation is considered acceptable when all of the following are true:

- `lib/repo-context.ts` is the centralized source for repo context assembly.
- BrandRepo Chat uses the centralized Repo Context Service rather than assembling markdown inline.
- Repo context includes repo metadata, section markdown files, structured section data, and asset metadata.
- Repo context excludes raw base64 asset data from markdown.
- Repo context preserves markdown filenames such as `brand-basics.md`, `messaging.md`, and `channel-seo.md`.
- Repo context supports size limits so model prompts do not grow without bound.
- Read-only API routes exist for repo listing, full context, section markdown, assets, and search.
- API routes require a Supabase bearer token and do not expose private repos anonymously.
- A read-only MCP endpoint exists at `/api/mcp`.
- MCP exposes tools for listing repos, retrieving repo context, retrieving section markdown, searching repo context, and listing/fetching assets.
- MCP write tools are intentionally not exposed yet.
- Automated tests confirm context generation, asset sanitization, context truncation, MCP tools, and server render health.

## Acceptance Test Loop

Run these commands before considering integration foundation work complete:

```bash
npm run lint
npm run build
npm test
```

The `npm test` command must include:

- Context generation tests.
- MCP read-only tool tests.
- Rendered app shell tests.

### Phase 3: Draft Workflow

- Add draft objects.
- Let external tools propose content or asset changes.
- Show drafts inside BrandRepo for review.
- Allow user approval before saving to repo sections.

### Phase 4: Production Auth

- Add OAuth connection flow.
- Add token scopes.
- Add audit logs for external tool access.
- Add per-repo access controls.

### Phase 5: Additional Integrations

- Claude MCP support.
- Figma plugin.
- Canva app.
- Public API documentation.

## Near-Term Decision

Before building the ChatGPT MCP server, build the internal Repo Context API first.

This keeps BrandRepo from becoming tied to one provider and gives every future integration the same stable source of brand truth.
