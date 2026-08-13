import { getRepoContext, getSectionByKey, searchRepoContext } from "./repo-context";
import { WorkspaceState } from "./repo-model";

type JsonRpcRequest = {
  jsonrpc?: "2.0";
  id?: string | number | null;
  method?: string;
  params?: unknown;
};

type ToolCallParams = {
  name?: string;
  arguments?: Record<string, unknown>;
};

function jsonRpcResult(id: JsonRpcRequest["id"], result: unknown) {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    result,
  };
}

function jsonRpcError(id: JsonRpcRequest["id"], code: number, message: string) {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: {
      code,
      message,
    },
  };
}

function textContent(payload: unknown) {
  return {
    content: [
      {
        type: "text",
        text: typeof payload === "string" ? payload : JSON.stringify(payload, null, 2),
      },
    ],
  };
}

function getStringArgument(args: Record<string, unknown>, key: string) {
  const value = args[key];
  return typeof value === "string" ? value : "";
}

function findWorkspaceForTool(workspaces: WorkspaceState[], repoId: string) {
  return workspaces.find((workspace) => workspace.id === repoId || workspace.name.toLowerCase() === repoId.toLowerCase());
}

export const brandRepoMcpTools = [
  {
    name: "list_repos",
    description: "List BrandRepo repos available to the authenticated user.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "get_repo_overview",
    description: "Return metadata and section names for a BrandRepo repo.",
    inputSchema: {
      type: "object",
      properties: {
        repo_id: { type: "string" },
      },
      required: ["repo_id"],
      additionalProperties: false,
    },
  },
  {
    name: "get_repo_context",
    description: "Return agent-ready markdown, structured sections, and asset metadata for a BrandRepo repo.",
    inputSchema: {
      type: "object",
      properties: {
        repo_id: { type: "string" },
      },
      required: ["repo_id"],
      additionalProperties: false,
    },
  },
  {
    name: "get_section_markdown",
    description: "Return one BrandRepo section as markdown.",
    inputSchema: {
      type: "object",
      properties: {
        repo_id: { type: "string" },
        section: { type: "string" },
      },
      required: ["repo_id", "section"],
      additionalProperties: false,
    },
  },
  {
    name: "search_repo",
    description: "Search BrandRepo section markdown and asset metadata.",
    inputSchema: {
      type: "object",
      properties: {
        repo_id: { type: "string" },
        query: { type: "string" },
      },
      required: ["repo_id", "query"],
      additionalProperties: false,
    },
  },
  {
    name: "list_assets",
    description: "List BrandRepo assets, optionally filtered by kind.",
    inputSchema: {
      type: "object",
      properties: {
        repo_id: { type: "string" },
        kind: { type: "string" },
      },
      required: ["repo_id"],
      additionalProperties: false,
    },
  },
  {
    name: "get_asset",
    description: "Return one BrandRepo asset by id.",
    inputSchema: {
      type: "object",
      properties: {
        repo_id: { type: "string" },
        asset_id: { type: "string" },
      },
      required: ["repo_id", "asset_id"],
      additionalProperties: false,
    },
  },
];

function callTool(name: string, args: Record<string, unknown>, workspaces: WorkspaceState[]) {
  if (name === "list_repos") {
    return textContent({
      repos: workspaces.map((workspace) => {
        const context = getRepoContext(workspace, { includeAssets: false, maxMarkdownLength: 1 });
        return context.repo;
      }),
    });
  }

  const repoId = getStringArgument(args, "repo_id");
  const workspace = findWorkspaceForTool(workspaces, repoId);

  if (!repoId) return textContent({ error: "repo_id is required." });
  if (!workspace) return textContent({ error: "Repo not found." });

  const context = getRepoContext(workspace, { includeAssets: true });

  if (name === "get_repo_overview") {
    return textContent({
      repo: context.repo,
      sections: context.sections.map((section) => ({
        key: section.key,
        title: section.title,
        markdownFileName: section.markdownFileName,
      })),
      assetCount: context.assets.length,
    });
  }

  if (name === "get_repo_context") {
    return textContent(context);
  }

  if (name === "get_section_markdown") {
    const section = getSectionByKey(getStringArgument(args, "section"));
    const match = section ? context.sections.find((item) => item.title === section) : null;
    return textContent(match ?? { error: "Section not found." });
  }

  if (name === "search_repo") {
    return textContent({
      query: getStringArgument(args, "query"),
      results: searchRepoContext(context, getStringArgument(args, "query")),
    });
  }

  if (name === "list_assets") {
    const kind = getStringArgument(args, "kind");
    return textContent({
      assets: kind ? context.assets.filter((asset) => asset.kind === kind) : context.assets,
    });
  }

  if (name === "get_asset") {
    const assetId = getStringArgument(args, "asset_id");
    return textContent(context.assets.find((asset) => asset.id === assetId) ?? { error: "Asset not found." });
  }

  return textContent({ error: `Unknown tool: ${name}` });
}

export function handleBrandRepoMcpRequest(message: JsonRpcRequest, workspaces: WorkspaceState[]) {
  if (message.method === "initialize") {
    return jsonRpcResult(message.id, {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {},
      },
      serverInfo: {
        name: "brandrepo",
        version: "0.1.0",
      },
    });
  }

  if (message.method === "tools/list") {
    return jsonRpcResult(message.id, { tools: brandRepoMcpTools });
  }

  if (message.method === "tools/call") {
    const params = (message.params ?? {}) as ToolCallParams;
    if (!params.name) return jsonRpcError(message.id, -32602, "Missing tool name.");
    return jsonRpcResult(message.id, callTool(params.name, params.arguments ?? {}, workspaces));
  }

  return jsonRpcError(message.id, -32601, `Unsupported method: ${message.method ?? "unknown"}`);
}

