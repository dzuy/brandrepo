import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

const projectRoot = process.cwd();
const outDir = path.join(tmpdir(), "brandrepo-context-tests");

async function transpileModule(sourcePath, outputName) {
  const source = await readFile(path.join(projectRoot, sourcePath), "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      verbatimModuleSyntax: false,
    },
  }).outputText;
  let rewritten = transpiled
    .replaceAll('from "./access-errors"', 'from "./access-errors.js"')
    .replaceAll('from "./integration-tokens"', 'from "./integration-tokens.js"')
    .replaceAll('from "./oauth"', 'from "./oauth.js"')
    .replaceAll('from "./repo-model"', 'from "./repo-model.js"')
    .replaceAll('from "./repo-context"', 'from "./repo-context.js"');
  if (sourcePath === "lib/oauth.ts") {
    rewritten = rewritten.replace(
      'import { createClient } from "@supabase/supabase-js";',
      "const createClient = () => { throw new Error('Supabase client is not available in unit tests.'); };",
    );
  }
  await writeFile(path.join(outDir, outputName), rewritten);
}

async function loadLibraries() {
  await mkdir(outDir, { recursive: true });
  await transpileModule("lib/access-errors.ts", "access-errors.js");
  await transpileModule("lib/repo-model.ts", "repo-model.js");
  await transpileModule("lib/repo-context.ts", "repo-context.js");
  await transpileModule("lib/integration-tokens.ts", "integration-tokens.js");
  await transpileModule("lib/oauth.ts", "oauth.js");
  await transpileModule("lib/mcp.ts", "mcp.js");

  const cacheBust = `?v=${Date.now()}`;
  const repoModel = await import(`file://${path.join(outDir, "repo-model.js")}${cacheBust}`);
  const repoContext = await import(`file://${path.join(outDir, "repo-context.js")}${cacheBust}`);
  const oauth = await import(`file://${path.join(outDir, "oauth.js")}${cacheBust}`);
  const mcp = await import(`file://${path.join(outDir, "mcp.js")}${cacheBust}`);

  return { repoModel, repoContext, oauth, mcp };
}

function sampleWorkspace(initialRepo) {
  return {
    id: "repo-blueocean",
    name: "BlueOcean",
    generatedDraft: "",
    generationType: "social",
    chatMessages: [],
    repo: {
      ...initialRepo,
      company: {
        name: "BlueOcean",
        website: "https://blueocean.ai",
        description: "AI brand intelligence for marketing teams.",
      },
      brand: {
        ...initialRepo.brand,
        description: "BlueOcean helps teams turn market context into brand direction.",
        voice: ["Clear", "Direct"],
        rules: ["Use Electric Blue only for emphasis."],
        approvedTerms: ["brand intelligence"],
        prohibitedTerms: ["magic"],
      },
      messaging: [
        {
          id: "msg-1",
          positioning: "The brand layer behind every AI tool.",
          valueProps: ["One source of truth for your brand."],
          taglines: ["Context turns intelligence into direction."],
          keyMessages: ["Centralize brand context", "Keep every tool on-brand"],
          proofPoints: ["Works across ChatGPT, Claude, Figma, and Canva"],
          claims: [],
          sources: [],
        },
      ],
      audiences: [
        {
          id: "aud-1",
          name: "Marketing and brand teams",
          description: "",
          painPoints: ["Brand knowledge is fragmented."],
          needs: [],
          messaging: [],
          channels: [],
          sources: [],
        },
      ],
      colors: [
        {
          id: "color-1",
          name: "Electric Blue",
          hex: "#2563EB",
          description: "Primary action and emphasis color.",
        },
      ],
      assets: [
        {
          id: "asset-logo",
          name: "BlueOcean Logo",
          type: "Image",
          url: "data:image/png;base64,abc123",
          storagePath: "repo-blueocean/logos/logo.png",
          description: "Primary logo.",
          metadata: ["identity", "logo"],
          uploadedAt: "2026-08-13T00:00:00.000Z",
          sources: [],
        },
        {
          id: "asset-photo",
          name: "Team photography",
          type: "Image",
          url: "https://cdn.example.com/team.png",
          description: "Approved customer imagery.",
          metadata: ["imagery", "photo"],
          uploadedAt: "2026-08-13T00:00:00.000Z",
          sources: [],
        },
        {
          id: "asset-generated",
          name: "Generated banner",
          type: "Image",
          url: "https://cdn.example.com/banner.png",
          description: "Generated chat output.",
          metadata: ["generated", "chat"],
          uploadedAt: "2026-08-13T00:00:00.000Z",
          sources: [],
        },
      ],
    },
  };
}

function sampleSparseWorkspace(initialRepo) {
  return {
    id: "repo-empty",
    name: "EmptyCo",
    generatedDraft: "",
    generationType: "social",
    chatMessages: [],
    repo: {
      ...initialRepo,
      company: {
        name: "EmptyCo",
        website: "",
        description: "",
      },
      brand: {
        ...initialRepo.brand,
        description: "",
      },
      messaging: [],
      audiences: [],
      assets: [],
    },
  };
}

test("repo context creates agent-ready markdown and sanitizes embedded assets", async () => {
  const { repoModel, repoContext } = await loadLibraries();
  const workspace = sampleWorkspace(repoModel.initialRepo);
  const context = repoContext.getRepoContext(workspace, { includeAssets: true });

  assert.equal(context.repo.slug, "blueocean");
  assert.match(context.markdown, /--- brand-basics\.md ---/);
  assert.match(context.markdown, /# Messaging/);
  assert.match(context.markdown, /One source of truth for your brand/);
  assert.doesNotMatch(context.markdown, /data:image/);
  assert.match(context.markdown, /Uploaded file stored in BrandRepo storage/);
  assert.equal(context.assets.find((asset) => asset.id === "asset-logo").kind, "logo");
  assert.equal(context.assets.find((asset) => asset.id === "asset-photo").kind, "imagery");
  assert.equal(context.assets.find((asset) => asset.id === "asset-generated").kind, "generated");
});

test("repo context enforces markdown size limits", async () => {
  const { repoModel, repoContext } = await loadLibraries();
  const workspace = sampleWorkspace(repoModel.initialRepo);
  const context = repoContext.getRepoContext(workspace, { maxMarkdownLength: 120 });

  assert.ok(context.markdown.length < 220);
  assert.match(context.markdown, /Truncated by BrandRepo context limit/);
});

test("OAuth helpers expose Claude-compatible metadata and PKCE validation", async () => {
  const { oauth } = await loadLibraries();
  const baseUrl = "https://www.brandrepo.dev";
  const metadata = oauth.oauthMetadata(baseUrl);
  const protectedResource = oauth.protectedResourceMetadata(baseUrl);

  assert.equal(metadata.issuer, baseUrl);
  assert.equal(metadata.authorization_endpoint, `${baseUrl}/oauth/authorize`);
  assert.equal(metadata.token_endpoint, `${baseUrl}/api/oauth/token`);
  assert.equal(metadata.registration_endpoint, `${baseUrl}/api/oauth/register`);
  assert.deepEqual(metadata.code_challenge_methods_supported, ["S256"]);
  assert.equal(protectedResource.resource, `${baseUrl}/api/mcp`);
  assert.deepEqual(protectedResource.authorization_servers, [baseUrl]);

  const verifier = "brandrepo-oauth-test-verifier";
  const challenge = await oauth.pkceChallengeForVerifier(verifier);
  assert.equal(await oauth.verifyPkce(verifier, challenge, "S256"), true);
  assert.equal(await oauth.verifyPkce("wrong-verifier", challenge, "S256"), false);
});

test("read-only MCP tools expose repo context, sections, assets, and search", async () => {
  const { repoModel, mcp } = await loadLibraries();
  const workspace = sampleWorkspace(repoModel.initialRepo);

  const tools = mcp.handleBrandRepoMcpRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" }, [workspace]);
  assert.equal(tools.result.tools.some((tool) => tool.name === "get_repo_context"), true);
  assert.equal(tools.result.tools.some((tool) => tool.name === "get_section_markdown"), true);
  assert.equal(tools.result.tools.some((tool) => tool.name === "list_assets"), true);

  const section = mcp.handleBrandRepoMcpRequest(
    {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "get_section_markdown", arguments: { repo_id: "repo-blueocean", section: "messaging" } },
    },
    [workspace],
  );
  assert.match(section.result.content[0].text, /# Messaging/);

  const assets = mcp.handleBrandRepoMcpRequest(
    {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "list_assets", arguments: { repo_id: "repo-blueocean", kind: "logo" } },
    },
    [workspace],
  );
  assert.match(assets.result.content[0].text, /BlueOcean Logo/);
  assert.doesNotMatch(assets.result.content[0].text, /Team photography/);

  const search = mcp.handleBrandRepoMcpRequest(
    {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "search_repo", arguments: { repo_id: "repo-blueocean", query: "figma" } },
    },
    [workspace],
  );
  assert.match(search.result.content[0].text, /Works across ChatGPT, Claude, Figma, and Canva/);
});

test("MCP repo discovery returns selection metadata and bad repo guidance", async () => {
  const { repoModel, mcp } = await loadLibraries();
  const fullWorkspace = sampleWorkspace(repoModel.initialRepo);
  const sparseWorkspace = sampleSparseWorkspace(repoModel.initialRepo);

  const repos = mcp.handleBrandRepoMcpRequest(
    {
      jsonrpc: "2.0",
      id: 9,
      method: "tools/call",
      params: { name: "list_repos", arguments: {} },
    },
    [fullWorkspace, sparseWorkspace],
  );
  const reposPayload = JSON.parse(repos.result.content[0].text);
  assert.equal(reposPayload.repos.length, 2);
  assert.equal(reposPayload.repos[0].id, "repo-blueocean");
  assert.equal(reposPayload.repos[0].slug, "blueocean");
  assert.equal(typeof reposPayload.repos[0].completeness.percentage, "number");
  assert.equal(reposPayload.repos[0].assetCounts.logo, 1);
  assert.equal(reposPayload.repos[1].id, "repo-empty");
  assert.ok(reposPayload.repos[0].completeness.percentage > reposPayload.repos[1].completeness.percentage);

  const overview = mcp.handleBrandRepoMcpRequest(
    {
      jsonrpc: "2.0",
      id: 10,
      method: "tools/call",
      params: { name: "get_repo_overview", arguments: { repo_id: "repo-blueocean" } },
    },
    [fullWorkspace, sparseWorkspace],
  );
  const overviewPayload = JSON.parse(overview.result.content[0].text);
  assert.equal(overviewPayload.id, "repo-blueocean");
  assert.equal(overviewPayload.completeness.sections.some((section) => section.key === "messaging"), true);
  assert.equal(overviewPayload.assetCounts.generated, 1);

  const missing = mcp.handleBrandRepoMcpRequest(
    {
      jsonrpc: "2.0",
      id: 11,
      method: "tools/call",
      params: { name: "get_repo_context", arguments: { repo_id: "missing" } },
    },
    [fullWorkspace, sparseWorkspace],
  );
  assert.match(missing.result.content[0].text, /Call list_repos first/);
  assert.match(missing.result.content[0].text, /repo-blueocean/);
  assert.match(missing.result.content[0].text, /repo-empty/);
});

test("MCP tools cap large responses and return safe protocol errors", async () => {
  const { repoModel, mcp } = await loadLibraries();
  const workspace = sampleWorkspace(repoModel.initialRepo);
  workspace.repo.messaging[0].keyMessages = Array.from({ length: 800 }, (_, index) => `Large message ${index}: ${"brand context ".repeat(8)}`);

  const context = mcp.handleBrandRepoMcpRequest(
    {
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "get_repo_context", arguments: { repo_id: "repo-blueocean" } },
    },
    [workspace],
  );
  assert.ok(context.result.content[0].text.length <= 28100);
  assert.match(context.result.content[0].text, /Truncated by BrandRepo MCP response limit|Truncated by BrandRepo context limit/);

  const unknownTool = mcp.handleBrandRepoMcpRequest(
    {
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: { name: "delete_repo", arguments: { repo_id: "repo-blueocean" } },
    },
    [workspace],
  );
  assert.equal(unknownTool.error.code, -32601);
  assert.equal(unknownTool.error.message, "Unknown tool.");

  const invalidArgs = mcp.handleBrandRepoMcpRequest(
    {
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: { name: "get_repo_context", arguments: "repo-blueocean" },
    },
    [workspace],
  );
  assert.equal(invalidArgs.error.code, -32602);
  assert.equal(invalidArgs.error.message, "Tool arguments must be an object.");

  const unsupported = mcp.handleBrandRepoMcpRequest({ jsonrpc: "2.0", id: 8, method: "repo/delete" }, [workspace]);
  assert.equal(unsupported.error.code, -32601);
  assert.equal(unsupported.error.message, "Unsupported method.");
});
