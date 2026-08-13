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
  const rewritten = transpiled
    .replaceAll('from "./repo-model"', 'from "./repo-model.js"')
    .replaceAll('from "./repo-context"', 'from "./repo-context.js"');
  await writeFile(path.join(outDir, outputName), rewritten);
}

async function loadLibraries() {
  await mkdir(outDir, { recursive: true });
  await transpileModule("lib/repo-model.ts", "repo-model.js");
  await transpileModule("lib/repo-context.ts", "repo-context.js");
  await transpileModule("lib/mcp.ts", "mcp.js");

  const cacheBust = `?v=${Date.now()}`;
  const repoModel = await import(`file://${path.join(outDir, "repo-model.js")}${cacheBust}`);
  const repoContext = await import(`file://${path.join(outDir, "repo-context.js")}${cacheBust}`);
  const mcp = await import(`file://${path.join(outDir, "mcp.js")}${cacheBust}`);

  return { repoModel, repoContext, mcp };
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

