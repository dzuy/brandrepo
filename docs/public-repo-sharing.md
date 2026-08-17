# Public Repo Sharing

BrandRepo public sharing makes each public repo available at a canonical URL:

```text
https://brandrepo.dev/{accountSlug}/{repoSlug}
```

The goal is to let a marketer copy a BrandRepo URL into any AI tool without needing MCP, OAuth, API keys, or a custom integration.

## Routes

- `/{accountSlug}/{repoSlug}` renders a public, human-readable brand guide.
- `/{accountSlug}/{repoSlug}/ai` returns a markdown-like AI-readable representation.

## Data Model

Public routing uses `brandhub_workspaces` with these columns:

- `account_slug`
- `repo_slug`
- `visibility`

`visibility` is intentionally minimal for now:

- `public`
- `unlisted`
- `private`

Only `public` rows are returned by the public loader. Private repos should not be exposed through these routes.

## Shared Utilities

The reusable sharing logic lives in `lib/repo-share.ts`:

- `getRepoCanonicalUrl(accountSlug, repoSlug)`
- `getAiSharePrompt({ accountSlug, repoSlug })`
- `serializeRepoForAI({ workspace, accountSlug, repoSlug })`
- `getRepoSlug(workspace)`

The server-side public repo loader lives in `lib/public-repo.ts`.

## Copy for AI

`Copy for AI` copies:

```text
Use this BrandRepo as the source of truth for this brand:

https://brandrepo.dev/{accountSlug}/{repoSlug}

Read the relevant brand guidelines and assets before creating anything. Follow the brand's messaging, voice and tone, visual identity, audience guidance, and usage rules.
```

This prompt should remain simple and reusable. Future Create workflows can append task-specific instructions before or after this base prompt.

## Implementation Notes

- Public pages are server-rendered so humans and agents can read meaningful HTML without running client-side JavaScript.
- The `/ai` route returns markdown with useful direct asset URLs.
- The public page uses existing repo data and does not duplicate brand content into a separate store.
- The page presents the repo as a polished brand guide, not a markdown file browser.
