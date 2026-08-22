"use client";

import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { BrandCreationContext, GammaCreationResult, PresentationCreationRequest } from "../lib/create/gamma";
import { getPublicRepoSnapshot, getRepoCanonicalUrl, getRepoSlug } from "../lib/repo-share";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import {
  classifyRepoAsset,
  generateSectionMarkdown,
  getRepoApprovedClaims,
  getRepoAudienceSettings,
  getRepoChannelSeo,
  getRepoColorRules,
  getRepoColors,
  getRepoContext,
  getRepoIdentity,
  getRepoProducts,
  getRepoSectionNotes,
  getRepoTypography,
  sectionMarkdownFileName,
} from "../lib/repo-context";
import {
  ApprovedClaim,
  Asset,
  Audience,
  AudienceSettings,
  ChannelSeoSettings,
  ChatMessage,
  ColorToken,
  IdentitySettings,
  Messaging,
  Product,
  RepoKind,
  RepoState,
  Source,
  WorkspaceRow,
  WorkspaceState,
  initialRepo,
  normalizeAudienceSettings,
  normalizeChannelSeoSettings,
  normalizeColorTokens,
  normalizeIdentitySettings,
  normalizeTypographySettings,
  repoTabs,
} from "../lib/repo-model";

type NavSection = "Overview" | "Create" | "Repo" | "Connected Apps" | "Campaigns" | "Assets" | "Admin" | "Settings";
type ThemeMode = "dark" | "light";
type AuthMode = "sign-in" | "sign-up" | "reset-password" | "update-password";

type MarketingAction = {
  id: string;
  title: string;
  appName: string;
  appLogo: string;
  description: string;
  enabled?: boolean;
};

type PresentationCreationStatus = "idle" | "creating" | "success" | "error";

type ImageReferenceAsset = {
  name: string;
  url: string;
  description: string;
  metadata: string[];
};

type IntegrationTokenView = {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
};

type OAuthConnectionView = {
  clientId: string;
  name: string;
  redirectUris: string[];
  scopes: string[];
  connectedAt: string | null;
  lastUsedAt: string | null;
  expiresAt: string | null;
};

type ExternalConnectionView = {
  provider: string;
  name: string;
  scopes: string[];
  connectedAt: string;
  updatedAt: string;
  expiresAt: string | null;
};

type AdminAccountView = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
  brandhub_workspaces?: { id: string; name: string; updated_at?: string | null }[];
  brandrepo_account_memberships?: { id: string; user_id: string; role: string; created_at: string }[];
  brandrepo_account_invites?: { id: string; email: string; role: string; status: string; created_at: string; accepted_at?: string | null }[];
};

type AccountOption = {
  id: string;
  name: string;
  slug: string;
  isLegacy?: boolean;
};

type AccountMembershipView = {
  account_id: string;
  role: string;
  brandrepo_accounts?: {
    id: string;
    name: string;
    slug: string;
  } | null;
};

type IdentityField = keyof IdentitySettings;
type MessagingField = "primaryValueProposition" | "keyMessages" | "targetCustomer" | "mainCustomerProblem" | "keyDifferentiators" | "tagline";
type VoiceToneField = "voiceCharacteristics" | "writingRules" | "wordsToUse" | "wordsToAvoid";
type TypographyField = "fontNames" | "weights" | "usageRules";
type ProductField =
  | "name"
  | "description"
  | "status"
  | "primaryAudience"
  | "problemsSolved"
  | "keyCapabilities"
  | "useCases"
  | "differentiators"
  | "limitations"
  | "productUrl"
  | "supportingAssetIds";
type ApprovedClaimField = "claim" | "status" | "appliesTo" | "productId" | "evidence" | "notes" | "reviewDate";

type SourceDocument = {
  id: string;
  url: string;
  title: string;
  contentType: "html" | "file";
  text: string;
  links: string[];
  assets: string[];
  crawledAt: string;
};

type ImportRun = {
  id: string;
  startUrl: string;
  status: "ready";
  needsRenderedCrawler?: boolean;
  sources: SourceDocument[];
  extractedContext: {
    companyName: string;
    companyDescription: string;
    brandDescription: string;
    voice: string[];
    rules: string[];
    approvedTerms: string[];
    prohibitedTerms: string[];
    positioning: string;
    keyMessages: string[];
    assetUrls: string[];
  };
};

const storageKey = "brandhub-workspaces-v2";
const themeStorageKey = "brandrepo-theme-v1";
const legacyThemeStorageKey = "brandhub-theme-v1";
const pendingGoogleAccountNameStorageKey = "brandrepo-pending-google-account-name-v1";
const drawerAnimationMs = 220;
const assetBucket = "brandhub-assets";
const chatSavedMessagingSourceLabel = "Chat answer saved to Messaging";
const previousWorkspaceStorageKey = "brandhub-workspaces-v1";
const singleWorkspaceStorageKey = "brandhub-empty-workspace-v1";
const legacyStorageKey = "brandhub-v1-prototype";
const brokenRepoCleanupStorageKey = "brandrepo-cleaned-repo2-nike-v2";
const brokenRepoNamesToDelete = new Set(["Repo2", "Repo 2", "Nike"]);

const navItems: NavSection[] = ["Overview", "Repo", "Create"];
const marketingActions: MarketingAction[] = [
  {
    id: "presentation-gamma",
    title: "Create a presentation",
    appName: "Gamma",
    appLogo: "https://www.google.com/s2/favicons?domain=gamma.app&sz=128",
    description: "Create an on-brand presentation with Gamma.",
    enabled: true,
  },
  {
    id: "landing-page-lovable",
    title: "Build a landing page",
    appName: "Lovable",
    appLogo: "https://www.google.com/s2/favicons?domain=lovable.dev&sz=128",
    description: "Create a branded landing page brief for Lovable.",
  },
  {
    id: "event-invitation-canva",
    title: "Design an event invitation",
    appName: "Canva",
    appLogo: "https://www.google.com/s2/favicons?domain=canva.com&sz=128",
    description: "Create a Canva-ready creative brief for an invitation asset.",
  },
  {
    id: "thought-leadership-claude",
    title: "Write a thought-leadership post",
    appName: "Claude",
    appLogo: "https://www.google.com/s2/favicons?domain=claude.ai&sz=128",
    description: "Generate a repo-grounded writing prompt for a strong POV post.",
  },
  {
    id: "campaign-imagery-chatgpt",
    title: "Generate campaign imagery",
    appName: "ChatGPT",
    appLogo: "https://www.google.com/s2/favicons?domain=chatgpt.com&sz=128",
    description: "Create an image-generation prompt that uses your brand assets and rules.",
  },
  {
    id: "product-interface-figma",
    title: "Design a product interface",
    appName: "Figma",
    appLogo: "https://www.google.com/s2/favicons?domain=figma.com&sz=128",
    description: "Create a Figma prompt for an interface that follows brand and product guidance.",
  },
];
const recommendedApps = [
  {
    name: "Claude",
    logo: "https://www.google.com/s2/favicons?domain=claude.ai&sz=128",
    aliases: ["claude", "anthropic"],
    description: "Ask Claude questions about your repo, brand rules, approved assets, and messaging.",
    sourceName: "Claude custom connector docs",
    sourceUrl: "https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp",
    steps: [
      "Open Claude, then go to Customize > Connectors.",
      "Click +, then choose Add custom connector.",
      "Enter BrandRepo as the name and https://www.brandrepo.dev/api/mcp as the remote MCP server URL.",
      "Click Add, then Connect, and approve the BrandRepo OAuth screen.",
      "Enable the connector in a chat from the + menu > Connectors.",
    ],
  },
  {
    name: "ChatGPT",
    logo: "https://www.google.com/s2/favicons?domain=chatgpt.com&sz=128",
    aliases: ["chatgpt", "openai"],
    description: "Bring BrandRepo context into ChatGPT once custom MCP connectors are available for your workspace.",
    sourceName: "OpenAI developer mode docs",
    sourceUrl: "https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt-beta",
    steps: [
      "Use a ChatGPT workspace that supports custom MCP apps.",
      "Have an admin or owner enable developer mode for custom MCP connectors.",
      "Create a custom app and enter https://www.brandrepo.dev/api/mcp as the MCP server URL.",
      "Test the app, then publish it to the workspace if required.",
      "Connect the app from ChatGPT and approve the BrandRepo OAuth screen.",
    ],
  },
  {
    name: "Gamma",
    logo: "https://www.google.com/s2/favicons?domain=gamma.app&sz=128",
    aliases: ["gamma"],
    description: "Create presentations that use approved messaging, voice, colors, and visual assets.",
    sourceName: "Gamma MCP docs",
    sourceUrl: "https://developers.gamma.app/mcp",
    steps: [
      "Gamma exposes its own MCP server for AI tools; it does not currently act as the place where you install BrandRepo.",
      "Connect BrandRepo to an MCP-capable assistant such as Claude or ChatGPT.",
      "Connect Gamma in that same assistant if your plan/tool supports Gamma MCP.",
      "Ask the assistant to use BrandRepo for messaging, voice, colors, and assets before creating the Gamma deck.",
    ],
  },
  {
    name: "Canva",
    logo: "https://www.google.com/s2/favicons?domain=canva.com&sz=128",
    aliases: ["canva"],
    description: "Make brand kits and creative assets from approved logos, colors, imagery, and rules.",
    sourceName: "Canva MCP docs",
    sourceUrl: "https://www.canva.dev/docs/mcp/",
    steps: [
      "Canva provides an MCP server and AI Connector for tools like Claude and ChatGPT.",
      "Connect BrandRepo to the same AI assistant where you use Canva.",
      "Connect Canva from that assistant's connector directory or app settings.",
      "Ask the assistant to reference BrandRepo first, then create or edit Canva designs with the approved brand context.",
      "A direct third-party connector inside Canva AI is not generally available yet.",
    ],
  },
  {
    name: "Google Docs",
    logo: "https://www.google.com/s2/favicons?domain=docs.google.com&sz=128",
    aliases: ["google docs", "google", "docs"],
    description: "Draft documents using the same approved brand messaging, voice, and terminology.",
    sourceName: "Google Drive connector docs",
    sourceUrl: "https://help.openai.com/en/articles/10948259",
    steps: [
      "Google Docs does not install custom MCP servers directly.",
      "Connect BrandRepo to an AI assistant such as Claude or ChatGPT.",
      "Connect Google Drive/Google Workspace in that same assistant.",
      "Use Docs through the Google Drive connector, then ask the assistant to draft or rewrite documents using BrandRepo context.",
    ],
  },
  {
    name: "Figma",
    logo: "https://www.google.com/s2/favicons?domain=figma.com&sz=128",
    aliases: ["figma"],
    description: "Sync identity assets, color tokens, typography, and design usage rules into design workflows.",
    sourceName: "Figma custom MCP connector docs",
    sourceUrl: "https://help.figma.com/hc/en-us/articles/38147204302743-Create-and-use-custom-MCP-connectors-in-the-Figma-agent-and-Figma-Make",
    steps: [
      "In Figma agent or Figma Make, click Add context from the prompt box.",
      "Hover over Connectors, then choose Manage.",
      "Go to Created by you and click Create.",
      "Enter the BrandRepo MCP server URL: https://www.brandrepo.dev/api/mcp.",
      "Click Connect, approve OAuth, and enable the BrandRepo tools you want Figma to use.",
    ],
  },
  {
    name: "Google Slides",
    logo: "https://www.google.com/s2/favicons?domain=slides.google.com&sz=128",
    aliases: ["google slides", "slides"],
    description: "Build sales and marketing decks from approved messaging, assets, and visual guidance.",
    sourceName: "Google Drive connector docs",
    sourceUrl: "https://help.openai.com/en/articles/10948259",
    steps: [
      "Google Slides is handled through Google Drive/Google Workspace connectors in AI assistants.",
      "Connect BrandRepo to Claude or ChatGPT.",
      "Connect Google Drive in the same assistant.",
      "Ask the assistant to create or rewrite Slides content using BrandRepo messaging, voice, and identity rules.",
    ],
  },
  {
    name: "Notion",
    logo: "https://www.google.com/s2/favicons?domain=notion.so&sz=128",
    aliases: ["notion"],
    description: "Keep launch docs, briefs, and team pages aligned to BrandRepo guidance.",
    sourceName: "Notion custom MCP docs",
    sourceUrl: "https://www.notion.com/help/mcp-connections-for-custom-agents",
    steps: [
      "Use a Notion Business or Enterprise workspace with Custom Agents.",
      "Have a workspace admin enable custom MCP servers under Settings > Connections.",
      "Open the Custom Agent settings, then go to Tools & Access.",
      "Choose Add connection > Custom MCP server.",
      "Enter https://www.brandrepo.dev/api/mcp, connect, and approve OAuth.",
    ],
  },
] as const;

const identitySections: { field: IdentityField; label: string; aliases: string[] }[] = [
  { field: "logos", label: "Logos", aliases: ["logos", "primary logo", "wordmark", "logomark", "logo variants"] },
  { field: "icons", label: "Icons", aliases: ["icons", "app icon", "favicon"] },
  { field: "elements", label: "Elements", aliases: ["elements", "asset package", "identity asset package"] },
  { field: "usage", label: "Usage", aliases: ["usage", "clear space", "minimum size", "approved usage", "incorrect usage", "background usage", "relationship to brand color"] },
];

function emptySectionUrls(): Partial<Record<RepoKind, string[]>> {
  return {};
}

function createWelcomeChat(): ChatMessage[] {
  return [
    {
      id: "welcome",
      role: "assistant",
      text: "Your repo is empty. Add company context or upload source material, then ask questions from the repo.",
    },
  ];
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createProduct(): Product {
  return {
    id: createId("product"),
    name: "Untitled product",
    description: "",
    status: "Available",
    primaryAudience: "",
    problemsSolved: [],
    keyCapabilities: [],
    useCases: [],
    differentiators: [],
    limitations: [],
    productUrl: "",
    supportingAssetIds: [],
    features: [],
    benefits: [],
    pricing: "",
    positioning: "",
    sources: [],
  };
}

function createApprovedClaim(status: ApprovedClaim["status"] = "Approved"): ApprovedClaim {
  return {
    id: createId("claim"),
    claim: "",
    status,
    appliesTo: "",
    productId: "",
    evidence: "",
    notes: "",
    reviewDate: "",
    sources: [],
  };
}

function createWorkspace(repo: RepoState = initialRepo, name?: string): WorkspaceState {
  const workspaceName = name || repo.company.name || "Untitled repo";

  return {
    id: createId("workspace"),
    name: workspaceName,
    visibility: "public",
    repo: {
      ...initialRepo,
      ...repo,
      colors: normalizeColorTokens(repo.colors),
      colorRules: repo.colorRules ?? "",
      typography: normalizeTypographySettings(repo.typography),
      audienceSettings: normalizeAudienceSettings(repo.audienceSettings),
      channelSeo: normalizeChannelSeoSettings(repo.channelSeo),
      identity: normalizeIdentitySettings(repo.identity),
    },
    chatMessages: createWelcomeChat(),
    generatedDraft: "",
    generationType: "social",
  };
}

function normalizeAccountName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isValidAccountName(value: string) {
  return /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/.test(value);
}

function getAccountName(user: User | null) {
  const value = user?.user_metadata?.account_name;
  return typeof value === "string" ? value : "";
}

function isPlatformAdmin(user: User | null) {
  return user?.email?.toLowerCase() === "dzuylinh@gmail.com";
}

function getLocallyActiveWorkspaceId() {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return "";
    const parsed = JSON.parse(stored) as { activeWorkspaceId?: string };
    return parsed.activeWorkspaceId ?? "";
  } catch {
    return "";
  }
}

const currentWorkspaceColumns = "id,user_id,name,data,account_id,account_slug,repo_slug,visibility";
const legacyWorkspaceColumns = "id,user_id,name,data";

function isMissingWorkspaceColumnError(error: { message?: string } | null) {
  const message = error?.message ?? "";
  return message.includes("Could not find the") && message.includes("brandhub_workspaces");
}

function workspaceHasContent(workspace: WorkspaceState) {
  const repo = workspace.repo;
  return Boolean(
    repo.company.name.trim() ||
      repo.company.website.trim() ||
      repo.company.description.trim() ||
      repo.brand.description.trim() ||
      repo.brand.voice.length ||
      repo.brand.rules.length ||
      repo.assets.length ||
      repo.messaging.length ||
      repo.products.length ||
      repo.approvedClaims.length,
  );
}

function pickInitialCloudWorkspace(workspaces: WorkspaceState[], localActiveWorkspaceId: string) {
  const localActive = localActiveWorkspaceId
    ? workspaces.find((workspace) => workspace.id === localActiveWorkspaceId)
    : null;

  if (localActive && workspaceHasContent(localActive)) return localActive;

  return workspaces.find((workspace) => workspaceHasContent(workspace)) ?? localActive ?? workspaces[0];
}

function getWorkspaceAccountId(workspace: WorkspaceState) {
  return workspace.accountId || `legacy:${getWorkspaceAccountSlug(workspace)}`;
}

function getWorkspaceAccountName(workspace: WorkspaceState) {
  return workspace.accountName || workspace.accountSlug || workspace.name || workspace.repo.company.name || "Personal account";
}

function getWorkspaceAccountSlug(workspace: WorkspaceState) {
  return workspace.accountSlug || normalizeAccountName(getWorkspaceAccountName(workspace)) || "account";
}

function workspaceBelongsToAccount(workspace: WorkspaceState, accountId: string) {
  return getWorkspaceAccountId(workspace) === accountId;
}

function buildAccountOptions(workspaces: WorkspaceState[], memberships: AccountMembershipView[]): AccountOption[] {
  const accounts = new Map<string, AccountOption>();

  for (const membership of memberships) {
    const account = membership.brandrepo_accounts;
    if (!account?.id) continue;
    accounts.set(account.id, {
      id: account.id,
      name: account.name,
      slug: account.slug,
    });
  }

  for (const workspace of workspaces) {
    const accountId = getWorkspaceAccountId(workspace);
    if (accounts.has(accountId)) continue;

    accounts.set(accountId, {
      id: accountId,
      name: getWorkspaceAccountName(workspace),
      slug: getWorkspaceAccountSlug(workspace),
      isLegacy: !workspace.accountId,
    });
  }

  return Array.from(accounts.values()).sort((first, second) => first.name.localeCompare(second.name));
}

function chooseAccountId(accounts: AccountOption[], preferredAccountId: string, selectedWorkspace: WorkspaceState | undefined) {
  if (preferredAccountId && accounts.some((account) => account.id === preferredAccountId)) return preferredAccountId;
  if (selectedWorkspace) return getWorkspaceAccountId(selectedWorkspace);
  return accounts[0]?.id ?? "";
}

function pickWorkspaceForAccount(workspaces: WorkspaceState[], accountId: string, preferredWorkspaceId = "") {
  const accountWorkspaces = workspaces.filter((workspace) => workspaceBelongsToAccount(workspace, accountId));
  return (
    accountWorkspaces.find((workspace) => workspace.id === preferredWorkspaceId) ??
    accountWorkspaces.find((workspace) => workspaceHasContent(workspace)) ??
    accountWorkspaces[0] ??
    null
  );
}

function classifyUpload(fileName: string): Asset["type"] {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".ppt") || lower.endsWith(".pptx")) return "Presentation";
  if (lower.endsWith(".svg") || lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".webp")) return "Image";
  if (lower.endsWith(".mp4") || lower.endsWith(".mov")) return "Video";
  if (lower.endsWith(".pdf")) return "PDF";
  return "Document";
}

function getNameFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const fileName = parsed.pathname.split("/").filter(Boolean).pop();
    return fileName ? decodeURIComponent(fileName) : parsed.hostname;
  } catch {
    return url;
  }
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function isMarkdownFile(fileName: string) {
  const lower = fileName.toLowerCase();
  return lower.endsWith(".md") || lower.endsWith(".markdown");
}

function safeStorageFileName(fileName: string) {
  const normalized = fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "asset";
}

function getStorageUploadErrorMessage(fileName: string, message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("bucket") && normalized.includes("not found")) {
    return `Unable to upload ${fileName}: Supabase Storage bucket "${assetBucket}" does not exist yet. Run supabase/schema.sql in the Supabase SQL Editor, then try again.`;
  }

  if (normalized.includes("row-level security") || normalized.includes("policy") || normalized.includes("permission")) {
    return `Unable to upload ${fileName}: Supabase Storage policy blocked the upload. Re-run supabase/schema.sql so authenticated users can write to their own asset folder.`;
  }

  if (normalized.includes("mime") || normalized.includes("type")) {
    return `Unable to upload ${fileName}: this file type is not allowed by the BrandRepo Storage bucket.`;
  }

  if (normalized.includes("exceeded") || normalized.includes("too large") || normalized.includes("file size")) {
    return `Unable to upload ${fileName}: this file is larger than the current 10 MB upload limit.`;
  }

  return `Unable to upload ${fileName}: ${message}`;
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function sectionForSource(source: { title: string; url: string }): RepoKind {
  const value = `${source.title} ${source.url}`.toLowerCase();
  if (
    value.includes("logo") ||
    value.includes("wordmark") ||
    value.includes("logotype") ||
    value.includes("icon") ||
    value.includes("pictogram") ||
    value.includes("symbol") ||
    value.includes("illustration") ||
    value.includes("element") ||
    value.includes("mascot") ||
    value.includes("duo")
  ) {
    return "Identity";
  }
  if (value.includes("photo") || value.includes("imagery") || value.includes("image")) return "Imagery";
  if (value.includes("color") || value.includes("colour") || value.includes("palette")) return "Colors";
  if (value.includes("type") || value.includes("font") || value.includes("typography")) return "Typography";
  if (value.includes("voice") || value.includes("tone") || value.includes("writing") || value.includes("style")) {
    return "Voice & Tone";
  }
  if (value.includes("audience") || value.includes("persona") || value.includes("customer") || value.includes("segment")) {
    return "Audiences";
  }
  if (value.includes("seo") || value.includes("search") || value.includes("channel") || value.includes("content distribution")) {
    return "Channel SEO";
  }
  if (value.includes("messaging") || value.includes("narrative") || value.includes("positioning")) return "Messaging";
  return "Brand Basics";
}

function getRepoSectionUrls(repo: RepoState, tab: RepoKind) {
  if (tab === "Identity") {
    const legacySectionUrls = repo.sectionUrls as Partial<Record<RepoKind | "Logos & Elements" | "Logos" | "Icons" | "Elements", string[]>>;
    return [
      ...new Set([
        ...(legacySectionUrls.Identity ?? []),
        ...(legacySectionUrls["Logos & Elements"] ?? []),
        ...(legacySectionUrls.Logos ?? []),
        ...(legacySectionUrls.Icons ?? []),
        ...(legacySectionUrls.Elements ?? []),
      ]),
    ];
  }

  if (tab === "Imagery") {
    const legacySectionUrls = repo.sectionUrls as Partial<Record<RepoKind | "Photography", string[]>>;
    return [...new Set([...(legacySectionUrls.Imagery ?? []), ...(legacySectionUrls.Photography ?? [])])];
  }

  return repo.sectionUrls?.[tab] ?? [];
}

function normalizeHexColor(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const withoutHash = trimmed.replace(/^#/, "").replace(/[^a-fA-F0-9]/g, "").slice(0, 6);
  return withoutHash ? `#${withoutHash}` : "";
}

function isCompleteHexColor(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value.trim());
}

type ParsedMarkdownSection = {
  level: number;
  title: string;
  displayTitle: string;
  content: string;
};

function stripMarkdownFormatting(value: string) {
  return value
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function normalizeMarkdownHeading(value: string) {
  return stripMarkdownFormatting(value)
    .replace(/^\s*\d+[).:-]?\s*/, "")
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanMarkdownValue(value: string | undefined) {
  const cleaned = (value ?? "")
    .split("\n")
    .map((line) =>
      stripMarkdownFormatting(line)
        .replace(/^#{1,6}\s+/, "")
        .replace(/^[-*]\s+/, "")
        .replace(/^\d+[).]\s+/, "")
        .trim(),
    )
    .filter(Boolean)
    .join("\n")
    .trim();

  if (!cleaned || cleaned === "_Not set._" || cleaned === "_None yet._") return "";
  return cleaned;
}

function extractMarkdownItems(value: string | undefined) {
  const section = value?.trim();
  if (!section) return [];

  const childHeadings = [...section.matchAll(/^(#{1,6})\s+(.+)$/gm)];

  if (childHeadings.length) {
    return childHeadings
      .map((heading, index) => {
        const title = stripMarkdownFormatting(heading[2]).replace(/^\s*\d+[).:-]?\s*/, "").trim();
        const contentStart = (heading.index ?? 0) + heading[0].length;
        const contentEnd = childHeadings[index + 1]?.index ?? section.length;
        const body = cleanMarkdownValue(section.slice(contentStart, contentEnd));
        return body ? `${title} - ${body}` : title;
      })
      .filter(Boolean);
  }

  const listItems = section
    .split("\n")
    .filter((line) => /^\s*(?:[-*]|\d+[).])\s+/.test(line))
    .map(cleanMarkdownValue)
    .filter(Boolean);

  if (listItems.length) return listItems;

  return cleanMarkdownValue(section)
    .split(/\n{2,}|\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseMarkdownSections(markdown: string) {
  const headingPattern = /^(#{1,6})\s+(.+)$/gm;
  const headings = [...markdown.matchAll(headingPattern)].map((heading) => ({
    level: heading[1].length,
    displayTitle: stripMarkdownFormatting(heading[2]).replace(/^\s*\d+[).:-]?\s*/, "").trim(),
    title: normalizeMarkdownHeading(heading[2]),
    index: heading.index ?? 0,
    length: heading[0].length,
  }));

  return headings.map((heading, index) => {
    const nextPeerOrParent = headings.slice(index + 1).find((candidate) => candidate.level <= heading.level);
    const contentStart = heading.index + heading.length;
    const contentEnd = nextPeerOrParent?.index ?? markdown.length;

    return {
      level: heading.level,
      title: heading.title,
      displayTitle: heading.displayTitle,
      content: markdown.slice(contentStart, contentEnd).trim(),
    };
  });
}

function findMarkdownSection(sections: ParsedMarkdownSection[], labels: string[]) {
  const normalizedLabels = labels.map(normalizeMarkdownHeading);
  const match = sections.find((section) =>
    normalizedLabels.some((label) => section.title === label || section.title.includes(label)),
  );
  return match?.content;
}

function parseMessagingMarkdown(markdown: string) {
  const sections = parseMarkdownSections(markdown);

  return {
    primaryValueProposition: cleanMarkdownValue(findMarkdownSection(sections, ["primary value proposition", "value proposition"])),
    keyMessages: extractMarkdownItems(findMarkdownSection(sections, ["key messages", "3-5 key messages"])).slice(0, 5),
    targetCustomer: cleanMarkdownValue(findMarkdownSection(sections, ["target customer", "customer", "audience"])),
    mainCustomerProblem: cleanMarkdownValue(findMarkdownSection(sections, ["main customer problem", "customer problem", "problem"])),
    keyDifferentiators: extractMarkdownItems(findMarkdownSection(sections, ["key differentiators", "differentiators"])),
    tagline: cleanMarkdownValue(findMarkdownSection(sections, ["tagline", "tagline if one exists"])),
  };
}

function parseVoiceToneMarkdown(markdown: string) {
  const sections = parseMarkdownSections(markdown);

  return {
    voiceCharacteristics: extractMarkdownItems(findMarkdownSection(sections, ["voice characteristics", "voice"])),
    writingRules: extractMarkdownItems(findMarkdownSection(sections, ["writing rules", "rules"])),
    wordsToUse: extractMarkdownItems(findMarkdownSection(sections, ["words phrases to use", "words/phrases to use", "phrases to use", "approved terminology"])),
    wordsToAvoid: extractMarkdownItems(findMarkdownSection(sections, ["words phrases to avoid", "words/phrases to avoid", "phrases to avoid", "prohibited terminology"])),
  };
}

function parseColorsMarkdown(markdown: string) {
  const sections = parseMarkdownSections(markdown);
  const rules = cleanMarkdownValue(findMarkdownSection(sections, ["rules", "color rules", "usage rules", "color usage", "guidelines"]));
  const sectionColors = sections
    .filter((section) => {
      const hasHex = /#[0-9a-fA-F]{6}\b/.test(section.content);
      const hasNestedHeadings = /^#{1,6}\s+/.test(section.content);
      const isRules = section.title.includes("rules") || section.title.includes("guidelines") || section.title.includes("usage");
      const isPaletteGroup = ["colors", "primary colors", "secondary colors", "accent color", "color palette", "palette"].includes(section.title);
      return hasHex && !hasNestedHeadings && !isRules && !isPaletteGroup;
    })
    .map((section, index) => {
      const hex = normalizeHexColor(section.content.match(/#[0-9a-fA-F]{6}\b/)?.[0] ?? "");
      const description = cleanMarkdownValue(
        section.content
          .split("\n")
          .filter((line) => !/#[0-9a-fA-F]{6}\b/.test(line))
          .join("\n"),
      );

      return {
        id: createId("color-md-import"),
        name: section.displayTitle || `Color ${index + 1}`,
        hex,
        description,
      };
    });
  const fallbackColors = markdown
    .split("\n")
    .filter((line) => /#[0-9a-fA-F]{6}\b/.test(line))
    .map((line, index) => {
      const hexMatch = line.match(/#[0-9a-fA-F]{6}\b/);
      const hex = normalizeHexColor(hexMatch?.[0] ?? "");
      const beforeHex = stripMarkdownFormatting(line.slice(0, hexMatch?.index ?? 0))
        .replace(/^#{1,6}\s+/, "")
        .replace(/^[-*]\s+/, "")
        .replace(/^\d+[).]\s+/, "")
        .replace(/\bhex\b\s*:?/i, "")
        .replace(/[:|–—-]+\s*$/, "")
        .trim();

      return {
        id: createId("color-md-import"),
        name: beforeHex || `Color ${index + 1}`,
        hex,
        description: "",
      };
    });

  return { colors: sectionColors.length ? sectionColors : fallbackColors, rules };
}

function parseTypographyMarkdown(markdown: string) {
  const sections = parseMarkdownSections(markdown);

  return {
    fontNames: extractMarkdownItems(findMarkdownSection(sections, ["font names", "fonts", "typefaces"])),
    weights: extractMarkdownItems(findMarkdownSection(sections, ["weights", "font weights"])),
    usageRules: cleanMarkdownValue(findMarkdownSection(sections, ["basic usage rules", "usage rules", "typography guidance", "rules"])),
  };
}

function parseAudiencesMarkdown(markdown: string) {
  const sections = parseMarkdownSections(markdown);

  return {
    primaryAudience: cleanMarkdownValue(findMarkdownSection(sections, ["primary audience"])),
    secondaryAudiences: cleanMarkdownValue(findMarkdownSection(sections, ["secondary audiences", "secondary audience"])),
    coreJobs: cleanMarkdownValue(findMarkdownSection(sections, ["core jobs to be done", "jobs to be done", "jtbd"])),
    painPoints: cleanMarkdownValue(findMarkdownSection(sections, ["common pain points", "pain points"])),
    customerWants: cleanMarkdownValue(findMarkdownSection(sections, ["what customers want", "customer wants"])),
  };
}

function parseChannelSeoMarkdown(markdown: string) {
  const sections = parseMarkdownSections(markdown);
  const intro = markdown.slice(0, markdown.search(/^##\s+/m) >= 0 ? markdown.search(/^##\s+/m) : 0);

  return {
    outputDefaults: cleanMarkdownValue(intro),
    blog: cleanMarkdownValue(findMarkdownSection(sections, ["blog"])),
    linkedin: cleanMarkdownValue(findMarkdownSection(sections, ["linkedin"])),
    x: cleanMarkdownValue(findMarkdownSection(sections, ["x", "twitter"])),
    instagram: cleanMarkdownValue(findMarkdownSection(sections, ["instagram"])),
    carousel: cleanMarkdownValue(findMarkdownSection(sections, ["carousel", "carousel alternative to instagram asset"])),
    closingLines: cleanMarkdownValue(findMarkdownSection(sections, ["closing lines"])),
    seoPlanning: cleanMarkdownValue(findMarkdownSection(sections, ["seo", "seo for planning"])),
    keywords: cleanMarkdownValue(findMarkdownSection(sections, ["keywords by pillar", "keywords"])),
    hashtags: cleanMarkdownValue(findMarkdownSection(sections, ["hashtags"])),
    successMetrics: cleanMarkdownValue(findMarkdownSection(sections, ["success metrics"])),
  };
}

function parseIdentityMarkdown(markdown: string) {
  const sections = parseMarkdownSections(markdown);
  const firstSectionIndex = markdown.search(/^##\s+/m);
  const overview = firstSectionIndex > -1 ? markdown.slice(0, firstSectionIndex) : markdown;

  return {
    logos: [
      cleanMarkdownValue(findMarkdownSection(sections, ["logos"])),
      cleanMarkdownValue(overview.replace(/^#\s+Identity\s*/i, "")),
      cleanMarkdownValue(findMarkdownSection(sections, ["primary logo"])),
      cleanMarkdownValue(findMarkdownSection(sections, ["wordmark"])),
      cleanMarkdownValue(findMarkdownSection(sections, ["logomark"])),
      cleanMarkdownValue(findMarkdownSection(sections, ["logo variants"])),
    ].filter(Boolean).join("\n\n"),
    icons: [
      cleanMarkdownValue(findMarkdownSection(sections, ["icons"])),
      cleanMarkdownValue(findMarkdownSection(sections, ["app icon"])),
      cleanMarkdownValue(findMarkdownSection(sections, ["favicon"])),
    ].filter(Boolean).join("\n\n"),
    elements: [
      cleanMarkdownValue(findMarkdownSection(sections, ["elements"])),
      cleanMarkdownValue(findMarkdownSection(sections, ["identity asset package", "asset package"])),
    ].filter(Boolean).join("\n\n"),
    usage: [
      cleanMarkdownValue(findMarkdownSection(sections, ["usage"])),
      cleanMarkdownValue(findMarkdownSection(sections, ["clear space"])),
      cleanMarkdownValue(findMarkdownSection(sections, ["minimum size"])),
      cleanMarkdownValue(findMarkdownSection(sections, ["approved usage"])),
      cleanMarkdownValue(findMarkdownSection(sections, ["incorrect usage"])),
      cleanMarkdownValue(findMarkdownSection(sections, ["background usage"])),
      cleanMarkdownValue(findMarkdownSection(sections, ["relationship to brand color"])),
    ].filter(Boolean).join("\n\n"),
  };
}

function cleanProductDescription(content: string) {
  const cleaned = cleanMarkdownValue(
    content
      .split("\n")
      .filter((line) => !/^status\s*:/i.test(stripMarkdownFormatting(line).trim()))
      .filter((line) => !/^product url\s*:/i.test(stripMarkdownFormatting(line).trim()))
      .join("\n"),
  );

  return cleaned;
}

function lineValue(content: string, label: string) {
  const match = content.match(new RegExp(`^${label}\\s*:\\s*(.+)$`, "im"));
  return cleanMarkdownValue(match?.[1]);
}

function parseProductMarkdown(markdown: string): Product[] {
  const sections = parseMarkdownSections(markdown);
  const productSections = sections.filter((section) => section.level === 2 && !["products", "notes"].includes(section.title));

  return productSections.map((section) => {
    const nestedSections = parseMarkdownSections(section.content);
    const descriptionSection = findMarkdownSection(nestedSections, ["description", "short description"]);
    const audienceSection = findMarkdownSection(nestedSections, ["primary audience", "audience"]);
    const differentiators = extractMarkdownItems(findMarkdownSection(nestedSections, ["differentiators", "key differentiators"]));

    return {
      ...createProduct(),
      id: createId("product-md-import"),
      name: section.displayTitle || "Untitled product",
      status: (lineValue(section.content, "Status") as Product["status"]) || "",
      description: descriptionSection ? cleanMarkdownValue(descriptionSection) : cleanProductDescription(section.content.split(/^#{1,6}\s+/m)[0] ?? ""),
      primaryAudience: audienceSection ? cleanMarkdownValue(audienceSection) : lineValue(section.content, "Primary audience"),
      problemsSolved: extractMarkdownItems(findMarkdownSection(nestedSections, ["problems solved", "problems"])),
      keyCapabilities: extractMarkdownItems(findMarkdownSection(nestedSections, ["key capabilities", "capabilities"])),
      useCases: extractMarkdownItems(findMarkdownSection(nestedSections, ["use cases", "usecases"])),
      differentiators,
      limitations: extractMarkdownItems(findMarkdownSection(nestedSections, ["limitations", "not supported", "limitations not supported"])),
      productUrl: lineValue(section.content, "Product URL"),
      features: [],
      benefits: [],
      positioning: differentiators.join("\n"),
    };
  });
}

function statusFromClaimHeading(title: string): ApprovedClaim["status"] | null {
  if (title.includes("approved")) return "Approved";
  if (title.includes("draft")) return "Draft";
  if (title.includes("expired")) return "Expired";
  if (title.includes("do not use") || title.includes("do-not-use") || title.includes("prohibited") || title.includes("unsupported")) return "Do not use";
  return null;
}

function parseApprovedClaimsMarkdown(markdown: string): ApprovedClaim[] {
  const sections = parseMarkdownSections(markdown);
  const claimSections = sections.filter((section) => statusFromClaimHeading(section.title));

  if (claimSections.length) {
    return claimSections.flatMap((section) => {
      const status = statusFromClaimHeading(section.title) ?? "Approved";
      return extractMarkdownItems(section.content).map((claim) => ({
        ...createApprovedClaim(status),
        id: createId("claim-md-import"),
        claim,
      }));
    });
  }

  const claims = extractMarkdownItems(markdown);
  return claims.map((claim) => ({
    ...createApprovedClaim("Approved"),
    id: createId("claim-md-import"),
    claim,
  }));
}

function isImageGenerationPrompt(prompt: string) {
  const normalized = prompt.toLowerCase();
  const hasCreationIntent = /\b(generate|generated|generating|create|created|creating|make|made|design|designed|mock\s?up|mockup|draft|produce|produced|producing)\b/.test(normalized);
  const hasVisualTarget = /\b(image|imagery|picture|photo|graphic|illustration|ad|advertisement|mock\s?up|mockup|visual|poster|banner|social graphic|creative|asset)\b/.test(normalized);
  return hasCreationIntent && hasVisualTarget;
}

function getImageGenerationReferences(repo: RepoState): ImageReferenceAsset[] {
  const priorityTerms = ["logo", "wordmark", "logotype", "identity", "icon", "element"];
  const maxEmbeddedReferenceLength = 650_000;

  return repo.assets
    .filter((asset) => {
      if (asset.type !== "Image" || !asset.url || asset.metadata.includes("generated")) return false;
      if (!asset.url.startsWith("data:")) return true;
      return asset.url.length <= maxEmbeddedReferenceLength;
    })
    .map((asset) => {
      const haystack = `${asset.name} ${asset.description} ${asset.metadata.join(" ")}`.toLowerCase();
      const priorityIndex = priorityTerms.findIndex((term) => haystack.includes(term));
      return { asset, priorityIndex: priorityIndex === -1 ? 99 : priorityIndex };
    })
    .filter((item) => item.priorityIndex < 99)
    .sort((first, second) => first.priorityIndex - second.priorityIndex)
    .slice(0, 5)
    .map(({ asset }) => ({
      name: asset.name,
      url: asset.url as string,
      description: asset.description,
      metadata: asset.metadata,
    }));
}

function getChatAssetPreviews(prompt: string, repo: RepoState): ChatMessage["assetPreviews"] {
  const normalized = prompt.toLowerCase();
  const wantsAssets = /\b(asset|assets|file|files|image|images|logo|logos|wordmark|icon|icons|element|elements|imagery|photo|photos|photography)\b/.test(
    normalized,
  );

  if (!wantsAssets) return [];

  const wantsGeneratedAssets = /\b(generated|mockup|mock-up|ad|banner|creative)\b/.test(normalized);
  const requestedKinds = [
    { kind: "logo", terms: ["logo", "logos", "wordmark", "logotype"] },
    { kind: "icon", terms: ["icon", "icons", "favicon", "symbol"] },
    { kind: "element", terms: ["element", "elements", "pattern", "graphic", "illustration"] },
    { kind: "imagery", terms: ["imagery", "photo", "photos", "photography", "image", "images"] },
  ].filter((group) => group.terms.some((term) => normalized.includes(term)));
  const fallbackTerms = requestedKinds.length ? [] : ["asset", "assets", "file", "files", "image", "images"];

  return repo.assets
    .filter((asset) => {
      if (asset.type !== "Image" || !asset.url) return false;
      const assetKind = classifyRepoAsset(asset);
      if (assetKind === "generated" && !wantsGeneratedAssets) return false;
      if (requestedKinds.length) {
        return requestedKinds.some((group) => group.kind === assetKind);
      }
      const haystack = `${asset.name} ${asset.metadata.join(" ")}`.toLowerCase();
      return wantsGeneratedAssets || fallbackTerms.some((term) => haystack.includes(term));
    })
    .slice(0, 8)
    .map((asset) => ({
      id: asset.id,
      name: asset.name,
      url: asset.url,
      description: asset.description,
      metadata: asset.metadata,
    }));
}

function isRepoSectionVisualAsset(asset: Asset) {
  const haystack = `${asset.name} ${asset.description} ${asset.metadata.join(" ")}`.toLowerCase();
  const sectionTerms = [
    "identity",
    "logo",
    "logos",
    "wordmark",
    "logotype",
    "icon",
    "icons",
    "favicon",
    "element",
    "elements",
    "pattern",
    "graphic",
    "imagery",
    "photo",
    "photography",
  ];

  return asset.type === "Image" && sectionTerms.some((term) => haystack.includes(term));
}

function hasText(value: string | undefined) {
  return Boolean(value?.trim());
}

function countList(values: boolean[]) {
  return {
    filled: values.filter(Boolean).length,
    total: values.length,
  };
}

function getRepoSectionCompleteness(repo: RepoState, tab: RepoKind) {
  if (tab === "Brand Basics") {
    return countList([
      hasText(repo.company.name),
      hasText(repo.company.website),
      hasText(repo.company.description),
      hasText(repo.brand.description),
    ]);
  }

  if (tab === "Identity") {
    const identity = getRepoIdentity(repo);
    const identityAssets = repo.assets.filter((asset) => {
      const metadata = asset.metadata.join(" ").toLowerCase();
      return asset.type === "Image" && metadata.includes("identity");
    });

    return countList([
      hasText(identity.logos) || identityAssets.some((asset) => asset.metadata.join(" ").toLowerCase().includes("logo")),
      hasText(identity.icons) || identityAssets.some((asset) => asset.metadata.join(" ").toLowerCase().includes("icon")),
      hasText(identity.elements) || identityAssets.some((asset) => asset.metadata.join(" ").toLowerCase().includes("element")),
      hasText(identity.usage),
    ]);
  }

  if (tab === "Imagery") {
    const hasImagery = repo.assets.some((asset) => {
      const haystack = `${asset.name} ${asset.description} ${asset.metadata.join(" ")}`.toLowerCase();
      return asset.type === "Image" && (haystack.includes("imagery") || haystack.includes("photo"));
    });
    return countList([hasImagery]);
  }

  if (tab === "Colors") {
    const colors = getRepoColors(repo);
    return countList([colors.length > 0, colors.some((color) => isCompleteHexColor(color.hex)), hasText(getRepoColorRules(repo))]);
  }

  if (tab === "Voice & Tone") {
    return countList([
      repo.brand.voice.length > 0,
      repo.brand.rules.length > 0,
      repo.brand.approvedTerms.length > 0,
      repo.brand.prohibitedTerms.length > 0,
    ]);
  }

  if (tab === "Typography") {
    const typography = getRepoTypography(repo);
    return countList([typography.fontNames.length > 0, typography.weights.length > 0, hasText(typography.usageRules)]);
  }

  if (tab === "Messaging") {
    const message = repo.messaging[0];
    const audience = repo.audiences[0];
    return countList([
      hasText(message?.valueProps[0] ?? message?.positioning),
      Boolean(message?.keyMessages.length),
      hasText(audience?.name),
      hasText(audience?.painPoints[0]),
      Boolean(message?.proofPoints.length),
      hasText(message?.taglines[0]),
    ]);
  }

  if (tab === "Audiences") {
    const audiences = getRepoAudienceSettings(repo);
    return countList([
      hasText(audiences.primaryAudience),
      hasText(audiences.secondaryAudiences),
      hasText(audiences.coreJobs),
      hasText(audiences.painPoints),
      hasText(audiences.customerWants),
    ]);
  }

  if (tab === "Channel SEO") {
    const channelSeo = getRepoChannelSeo(repo);
    return countList([
      hasText(channelSeo.outputDefaults),
      hasText(channelSeo.blog),
      hasText(channelSeo.linkedin),
      hasText(channelSeo.x),
      hasText(channelSeo.instagram),
      hasText(channelSeo.seoPlanning),
      hasText(channelSeo.keywords),
      hasText(channelSeo.successMetrics),
    ]);
  }

  if (tab === "Products") {
    const products = getRepoProducts(repo);

    return countList([
      products.length > 0,
      products.some((product) => hasText(product.description)),
      products.some((product) => product.keyCapabilities.length > 0),
      products.some((product) => product.useCases.length > 0),
      products.some((product) => product.limitations.length > 0),
    ]);
  }

  if (tab === "Approved Claims") {
    const claims = getRepoApprovedClaims(repo);
    return countList([
      claims.some((claim) => claim.claim.trim() && claim.status === "Approved"),
      claims.some((claim) => claim.claim.trim() && claim.status === "Do not use"),
    ]);
  }

  return { filled: 0, total: 1 };
}

function getRepoCompleteness(repo: RepoState) {
  const sections = repoTabs.map((tab) => {
    const completeness = getRepoSectionCompleteness(repo, tab);
    const percentage = completeness.total ? Math.round((completeness.filled / completeness.total) * 100) : 0;
    return {
      tab,
      ...completeness,
      percentage,
      mostlyFilled: percentage >= 70,
    };
  });
  const total = sections.reduce((sum, item) => sum + item.total, 0);
  const filled = sections.reduce((sum, item) => sum + item.filled, 0);

  return {
    sections,
    filled,
    total,
    percentage: total ? Math.round((filled / total) * 100) : 0,
  };
}

function getBrandContext({
  contentType,
  workspace,
}: {
  contentType: "presentation";
  workspace: WorkspaceState;
}): BrandCreationContext {
  void contentType;
  const repo = workspace.repo;
  const messaging = repo.messaging[0];

  return {
    brandName: repo.company.name || workspace.name || "Untitled brand",
    websiteUrl: repo.company.website,
    identity: getRepoIdentity(repo),
    messaging: {
      primaryValueProposition: messaging?.valueProps[0] ?? messaging?.positioning ?? "",
      keyMessages: messaging?.keyMessages ?? [],
      differentiators: messaging?.proofPoints ?? [],
    },
    voice: {
      characteristics: repo.brand.voice,
      rules: repo.brand.rules,
    },
    audiences: getRepoAudienceSettings(repo),
    colors: getRepoColors(repo),
    typography: getRepoTypography(repo),
    assets: repo.assets
      .filter((asset) => {
        if (asset.type !== "Image" || !asset.url) return false;
        if (asset.metadata.includes("generated")) return false;
        return /^https?:\/\//.test(asset.url);
      })
      .map((asset) => ({
        name: asset.name,
        url: asset.url as string,
        description: asset.description,
        kind: classifyRepoAsset(asset),
      }))
      .filter((asset) => ["logo", "icon", "element", "imagery"].includes(asset.kind))
      .slice(0, 12),
  };
}

type GammaStartResponse = {
  id?: string;
  error?: string;
};

type GammaPollResponse =
  | (GammaCreationResult & { providerStatus?: string })
  | {
      id?: string;
      status: "creating" | "failed";
      providerStatus?: string;
      error?: string;
    };

async function readJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }

  return payload;
}

async function waitForGammaPresentation(generationId: string, accessToken: string): Promise<GammaCreationResult> {
  const maxAttempts = 30;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, attempt === 0 ? 2500 : 5000));

    const response = await fetch(`/api/create/gamma/${encodeURIComponent(generationId)}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const payload = await readJsonResponse<GammaPollResponse>(response);

    if (payload.status === "complete") {
      return payload;
    }

    if (payload.status === "failed") {
      throw new Error(payload.error || "Gamma could not create this presentation.");
    }
  }

  throw new Error("Gamma is still creating this presentation. Try opening this workflow again in a minute.");
}

async function createGammaPresentation(request: PresentationCreationRequest, accessToken: string): Promise<GammaCreationResult> {
  const response = await fetch("/api/create/gamma", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  const payload = await readJsonResponse<GammaStartResponse>(response);

  if (!payload.id) {
    throw new Error("Gamma did not return a generation ID.");
  }

  return waitForGammaPresentation(payload.id, accessToken);
}

function sourceDocumentsToSectionUrls(sources: SourceDocument[]) {
  return sources.reduce<Partial<Record<RepoKind, string[]>>>((accumulator, source) => {
    const section = sectionForSource(source);
    accumulator[section] = [...new Set([...(accumulator[section] ?? []), source.url])];
    return accumulator;
  }, emptySectionUrls());
}

function mergeSectionUrls(
  current: Partial<Record<RepoKind, string[]>> | undefined,
  next: Partial<Record<RepoKind, string[]>>,
) {
  const merged: Partial<Record<RepoKind, string[]>> = { ...(current ?? {}) };

  for (const section of repoTabs) {
    const values = next[section];
    if (!values?.length) continue;
    merged[section] = [...new Set([...(merged[section] ?? []), ...values])];
  }

  return merged;
}

export default function Home() {
  const [workspaces, setWorkspaces] = useState<WorkspaceState[]>(() => [createWorkspace()]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState("");
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [activeAccountId, setActiveAccountId] = useState("");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(!isSupabaseConfigured);
  const [authMode, setAuthMode] = useState<AuthMode>("sign-in");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authPasswordConfirm, setAuthPasswordConfirm] = useState("");
  const [authAccountName, setAuthAccountName] = useState("");
  const [authStatus, setAuthStatus] = useState<"idle" | "working" | "success" | "error">("idle");
  const [authError, setAuthError] = useState("");
  const [settingsAccountName, setSettingsAccountName] = useState("");
  const [settingsStatus, setSettingsStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [settingsError, setSettingsError] = useState("");
  const [developerToken, setDeveloperToken] = useState("");
  const [developerTokenVisible, setDeveloperTokenVisible] = useState(false);
  const [developerTokenStatus, setDeveloperTokenStatus] = useState<"idle" | "loading" | "copied" | "error">("idle");
  const [developerTokenError, setDeveloperTokenError] = useState("");
  const [integrationTokens, setIntegrationTokens] = useState<IntegrationTokenView[]>([]);
  const [integrationTokenName, setIntegrationTokenName] = useState("ChatGPT MCP");
  const [newIntegrationTokenSecret, setNewIntegrationTokenSecret] = useState("");
  const [integrationTokenStatus, setIntegrationTokenStatus] = useState<"idle" | "loading" | "creating" | "revoking" | "copied" | "error">("idle");
  const [integrationTokenError, setIntegrationTokenError] = useState("");
  const [oauthConnections, setOauthConnections] = useState<OAuthConnectionView[]>([]);
  const [oauthConnectionStatus, setOauthConnectionStatus] = useState<"idle" | "loading" | "revoking" | "error">("idle");
  const [oauthConnectionError, setOauthConnectionError] = useState("");
  const [externalConnections, setExternalConnections] = useState<ExternalConnectionView[]>([]);
  const [externalConnectionStatus, setExternalConnectionStatus] = useState<"idle" | "loading" | "connecting" | "saving" | "revoking" | "error">("idle");
  const [externalConnectionError, setExternalConnectionError] = useState("");
  const [adminAccounts, setAdminAccounts] = useState<AdminAccountView[]>([]);
  const [adminStatus, setAdminStatus] = useState<"idle" | "loading" | "creating" | "inviting" | "success" | "error">("idle");
  const [adminError, setAdminError] = useState("");
  const [adminAccountName, setAdminAccountName] = useState("");
  const [adminInviteEmail, setAdminInviteEmail] = useState("");
  const [adminInviteAccountId, setAdminInviteAccountId] = useState("");
  const [developerSettingsOpen, setDeveloperSettingsOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [themePreferenceReady, setThemePreferenceReady] = useState(false);
  const [cloudHydrated, setCloudHydrated] = useState(false);
  const [workspaceSchemaMode, setWorkspaceSchemaMode] = useState<"current" | "legacy">("current");
  const [syncStatus, setSyncStatus] = useState("Local only");
  const [section, setSection] = useState<NavSection>("Create");
  const [repoTab, setRepoTab] = useState<RepoKind>("Brand Basics");
  const [brandBasicsStatus, setBrandBasicsStatus] = useState("Auto saved.");
  const [colorsStatus, setColorsStatus] = useState("Auto saved.");
  const [typographyStatus, setTypographyStatus] = useState("Auto saved.");
  const [channelSeoStatus, setChannelSeoStatus] = useState("Auto saved.");
  const [audiencesStatus, setAudiencesStatus] = useState("Auto saved.");
  const [identityStatus, setIdentityStatus] = useState("Auto saved.");
  const [voiceToneStatus, setVoiceToneStatus] = useState("Auto saved.");
  const [messagingStatus, setMessagingStatus] = useState("Auto saved.");
  const [productsStatus, setProductsStatus] = useState("Auto saved.");
  const [approvedClaimsStatus, setApprovedClaimsStatus] = useState("Auto saved.");
  const [persistenceReady, setPersistenceReady] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatStatus, setChatStatus] = useState<"idle" | "thinking" | "generating-image">("idle");
  const [importError, setImportError] = useState("");
  const [sectionScanUrl, setSectionScanUrl] = useState("");
  const [lastSectionScan, setLastSectionScan] = useState<{ tab: RepoKind; url: string } | null>(null);
  const [repoOverviewActive, setRepoOverviewActive] = useState(true);
  const [identityExpanded, setIdentityExpanded] = useState(true);
  const [identityField, setIdentityField] = useState<IdentityField>("logos");
  const [markdownDrawerSection, setMarkdownDrawerSection] = useState<RepoKind | null>(null);
  const [markdownDrawerOpen, setMarkdownDrawerOpen] = useState(false);
  const [newRepoModalOpen, setNewRepoModalOpen] = useState(false);
  const [newRepoName, setNewRepoName] = useState("");
  const [messagingImportDrawerOpen, setMessagingImportDrawerOpen] = useState(false);
  const [messagingImportDrawerMounted, setMessagingImportDrawerMounted] = useState(false);
  const [messagingImportDraft, setMessagingImportDraft] = useState("");
  const [markdownImportSection, setMarkdownImportSection] = useState<RepoKind>("Messaging");
  const [assetDrawerAssetId, setAssetDrawerAssetId] = useState<string | null>(null);
  const [assetDrawerOpen, setAssetDrawerOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [connectGuideAppName, setConnectGuideAppName] = useState<string | null>(null);
  const [gammaApiKeyModalOpen, setGammaApiKeyModalOpen] = useState(false);
  const [gammaApiKeyDraft, setGammaApiKeyDraft] = useState("");
  const [gammaDrawerOpen, setGammaDrawerOpen] = useState(false);
  const [gammaDrawerMounted, setGammaDrawerMounted] = useState(false);
  const [gammaPrompt, setGammaPrompt] = useState("");
  const [gammaStatus, setGammaStatus] = useState<PresentationCreationStatus>("idle");
  const [gammaResult, setGammaResult] = useState<GammaCreationResult | null>(null);
  const [gammaError, setGammaError] = useState("");

  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? workspaces[0];
  const activeAccount =
    accounts.find((account) => account.id === activeAccountId) ??
    (activeWorkspace
      ? {
          id: getWorkspaceAccountId(activeWorkspace),
          name: getWorkspaceAccountName(activeWorkspace),
          slug: getWorkspaceAccountSlug(activeWorkspace),
          isLegacy: !activeWorkspace.accountId,
        }
      : null);
  const activeAccountWorkspaces = activeAccount
    ? workspaces.filter((workspace) => workspaceBelongsToAccount(workspace, activeAccount.id))
    : workspaces;
  const repo = activeWorkspace?.repo ?? initialRepo;
  const chatMessages = activeWorkspace?.chatMessages ?? createWelcomeChat();
  const visibleNavItems: NavSection[] = isPlatformAdmin(currentUser) ? [...navItems, "Admin"] : navItems;
  const hasChatConversation = chatMessages.some((message) => message.id !== "welcome");
  const visibleAssets = repo.assets.filter((asset) => asset.metadata.includes("generated") || !isRepoSectionVisualAsset(asset));
  const selectedAsset = assetDrawerAssetId ? repo.assets.find((asset) => asset.id === assetDrawerAssetId) ?? null : null;
  const markdownDrawerContent = markdownDrawerSection ? generateSectionMarkdown(repo, markdownDrawerSection) : "";
  const markdownDrawerFileName = markdownDrawerSection ? sectionMarkdownFileName(markdownDrawerSection) : "";
  const recommendedAppCards = recommendedApps.map((app) => {
    const connection = oauthConnections.find((candidate) => {
      const haystack = [candidate.name, candidate.clientId, ...candidate.redirectUris].join(" ").toLowerCase();
      return app.aliases.some((alias) => haystack.includes(alias));
    });
    const externalConnection =
      app.name === "Gamma" ? externalConnections.find((candidate) => candidate.provider === "gamma") ?? null : null;

    return { ...app, connectionRecord: connection ?? null, externalConnectionRecord: externalConnection };
  });
  const connectGuideApp = connectGuideAppName ? recommendedApps.find((app) => app.name === connectGuideAppName) ?? null : null;

  async function applyPendingGoogleAccountName(user: User | null) {
    if (!supabase || !user || getAccountName(user)) return user;

    const pendingAccountName = normalizeAccountName(window.localStorage.getItem(pendingGoogleAccountNameStorageKey) ?? "");
    if (!isValidAccountName(pendingAccountName)) return user;

    const { data, error } = await supabase.auth.updateUser({
      data: {
        ...(user.user_metadata ?? {}),
        account_name: pendingAccountName,
      },
    });

    if (error) {
      setSettingsStatus("error");
      setSettingsError(error.message);
      return user;
    }

    window.localStorage.removeItem(pendingGoogleAccountNameStorageKey);
    return data.user ?? user;
  }

  useEffect(() => {
    const themeTimer = window.setTimeout(() => {
      const storedTheme = window.localStorage.getItem(themeStorageKey) ?? window.localStorage.getItem(legacyThemeStorageKey);
      if (storedTheme === "light" || storedTheme === "dark") {
        setTheme(storedTheme);
      }
      setThemePreferenceReady(true);
    }, 0);

    return () => window.clearTimeout(themeTimer);
  }, []);

  useEffect(() => {
    if (!themePreferenceReady) return;
    window.localStorage.setItem(themeStorageKey, theme);
    window.localStorage.removeItem(legacyThemeStorageKey);
  }, [theme, themePreferenceReady]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") !== "gamma") return;

    const timer = window.setTimeout(() => {
      setSection("Connected Apps");
      if (params.get("status") === "error") {
        setExternalConnectionStatus("error");
        setExternalConnectionError(params.get("error") ?? "Gamma connection failed.");
      } else {
        setExternalConnectionStatus("idle");
        setExternalConnectionError("");
        if (currentUser && isSupabaseConfigured) {
          // eslint-disable-next-line react-hooks/immutability
          void loadExternalConnections();
        }
      }

      window.history.replaceState({}, "", window.location.pathname);
    }, 0);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  useEffect(() => {
    if ((section !== "Settings" && section !== "Connected Apps") || !currentUser || !isSupabaseConfigured) return;
    // eslint-disable-next-line react-hooks/immutability
    void loadOAuthConnections();
    void loadExternalConnections();
    if (section === "Settings") {
      // eslint-disable-next-line react-hooks/immutability
      void loadIntegrationTokens();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, currentUser?.id]);

  useEffect(() => {
    if (section !== "Admin" || !currentUser || !isPlatformAdmin(currentUser)) return;
    // eslint-disable-next-line react-hooks/immutability
    void loadAdminAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, currentUser?.id]);

  useEffect(() => {
    if (!supabase) return;

    const recoveryParams = new URLSearchParams(`${window.location.search.replace(/^\?/, "")}&${window.location.hash.replace(/^#/, "")}`);
    let recoveryModeTimer: ReturnType<typeof window.setTimeout> | null = null;
    if (recoveryParams.get("type") === "recovery") {
      recoveryModeTimer = window.setTimeout(() => setAuthMode("update-password"), 0);
    }

    supabase.auth.getUser().then(async ({ data }) => {
      const user = await applyPendingGoogleAccountName(data.user ?? null);
      setCurrentUser(user ?? null);
      setSettingsAccountName(getAccountName(user ?? null));
      setCloudHydrated(false);
      setAuthChecked(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      const user = await applyPendingGoogleAccountName(session?.user ?? null);
      setCurrentUser(user ?? null);
      if (event === "PASSWORD_RECOVERY") {
        setAuthMode("update-password");
        setAuthStatus("idle");
        setAuthError("");
      }
      setSettingsAccountName(getAccountName(user ?? null));
      setSettingsStatus("idle");
      setSettingsError("");
      setCloudHydrated(false);
      setAuthChecked(true);
      setSyncStatus(user ? "Loading repos..." : "Local only");
    });

    return () => {
      if (recoveryModeTimer) window.clearTimeout(recoveryModeTimer);
      listener.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    const loadStoredWorkspaces = window.setTimeout(() => {
      const stored = window.localStorage.getItem(storageKey);
      const storedSingleWorkspace = window.localStorage.getItem(singleWorkspaceStorageKey);
      window.localStorage.removeItem(previousWorkspaceStorageKey);
      window.localStorage.removeItem(legacyStorageKey);
      if (!stored) {
        if (storedSingleWorkspace) {
          try {
            const parsed = JSON.parse(storedSingleWorkspace) as RepoState;
            const migratedWorkspace = createWorkspace(parsed, parsed.company.name || "Untitled repo");
            const storedAccounts = buildAccountOptions([migratedWorkspace], []);
            setWorkspaces([migratedWorkspace]);
            setAccounts(storedAccounts);
            setActiveAccountId(getWorkspaceAccountId(migratedWorkspace));
            setActiveWorkspaceId(migratedWorkspace.id);
          } catch {
            window.localStorage.removeItem(singleWorkspaceStorageKey);
          } finally {
            setPersistenceReady(true);
          }
          return;
        }

        setPersistenceReady(true);
        return;
      }

      try {
        const parsed = JSON.parse(stored) as { activeWorkspaceId?: string; workspaces?: WorkspaceState[] };
        const storedWorkspaces = parsed.workspaces?.length ? parsed.workspaces : [createWorkspace()];
        const selectedWorkspace =
          parsed.activeWorkspaceId && storedWorkspaces.some((workspace) => workspace.id === parsed.activeWorkspaceId)
            ? storedWorkspaces.find((workspace) => workspace.id === parsed.activeWorkspaceId)
            : storedWorkspaces[0];
        const storedAccounts = buildAccountOptions(storedWorkspaces, []);
        setWorkspaces(storedWorkspaces);
        setAccounts(storedAccounts);
        setActiveAccountId(selectedWorkspace ? getWorkspaceAccountId(selectedWorkspace) : storedAccounts[0]?.id ?? "");
        setActiveWorkspaceId(selectedWorkspace?.id ?? storedWorkspaces[0].id);
      } catch {
        window.localStorage.removeItem(storageKey);
      } finally {
        setPersistenceReady(true);
      }

    }, 0);

    return () => window.clearTimeout(loadStoredWorkspaces);
  }, []);

  useEffect(() => {
    if (!persistenceReady) return;
    window.localStorage.setItem(storageKey, JSON.stringify({ activeWorkspaceId, workspaces }));
  }, [activeWorkspaceId, persistenceReady, workspaces]);

  useEffect(() => {
    if (brandBasicsStatus !== "Saving...") return;

    const saveTimer = window.setTimeout(() => {
      setBrandBasicsStatus("Auto saved.");
    }, 900);

    return () => window.clearTimeout(saveTimer);
  }, [brandBasicsStatus, repo.company.description, repo.company.name, repo.company.website, repo.brand.description]);

  useEffect(() => {
    if (messagingStatus !== "Saving...") return;

    const saveTimer = window.setTimeout(() => {
      setMessagingStatus("Auto saved.");
    }, 900);

    return () => window.clearTimeout(saveTimer);
  }, [messagingStatus, repo.audiences, repo.messaging]);

  useEffect(() => {
    if (voiceToneStatus !== "Saving...") return;

    const saveTimer = window.setTimeout(() => {
      setVoiceToneStatus("Auto saved.");
    }, 900);

    return () => window.clearTimeout(saveTimer);
  }, [repo.brand.approvedTerms, repo.brand.prohibitedTerms, repo.brand.rules, repo.brand.voice, voiceToneStatus]);

  useEffect(() => {
    if (colorsStatus !== "Saving...") return;

    const saveTimer = window.setTimeout(() => {
      setColorsStatus("Auto saved.");
    }, 900);

    return () => window.clearTimeout(saveTimer);
  }, [colorsStatus, repo.colors]);

  useEffect(() => {
    if (typographyStatus !== "Saving...") return;

    const saveTimer = window.setTimeout(() => {
      setTypographyStatus("Auto saved.");
    }, 900);

    return () => window.clearTimeout(saveTimer);
  }, [repo.typography, typographyStatus]);

  useEffect(() => {
    if (audiencesStatus !== "Saving...") return;

    const saveTimer = window.setTimeout(() => {
      setAudiencesStatus("Auto saved.");
    }, 900);

    return () => window.clearTimeout(saveTimer);
  }, [audiencesStatus, repo.audienceSettings]);

  useEffect(() => {
    if (channelSeoStatus !== "Saving...") return;

    const saveTimer = window.setTimeout(() => {
      setChannelSeoStatus("Auto saved.");
    }, 900);

    return () => window.clearTimeout(saveTimer);
  }, [channelSeoStatus, repo.channelSeo]);

  useEffect(() => {
    if (productsStatus !== "Saving...") return;

    const saveTimer = window.setTimeout(() => {
      setProductsStatus("Auto saved.");
    }, 900);

    return () => window.clearTimeout(saveTimer);
  }, [productsStatus, repo.products]);

  useEffect(() => {
    if (approvedClaimsStatus !== "Saving...") return;

    const saveTimer = window.setTimeout(() => {
      setApprovedClaimsStatus("Auto saved.");
    }, 900);

    return () => window.clearTimeout(saveTimer);
  }, [approvedClaimsStatus, repo.approvedClaims]);

  useEffect(() => {
    if (identityStatus !== "Saving...") return;

    const saveTimer = window.setTimeout(() => {
      setIdentityStatus("Auto saved.");
    }, 900);

    return () => window.clearTimeout(saveTimer);
  }, [identityStatus, repo.identity]);

  useEffect(() => {
    if (!supabase || !currentUser || !persistenceReady || cloudHydrated) return;

    let cancelled = false;

    async function loadCloudWorkspaces() {
      setSyncStatus("Loading repos...");
      const { data: membershipRows, error: membershipError } = await supabase
        .from("brandrepo_account_memberships")
        .select("account_id,role,brandrepo_accounts(id,name,slug)");

      if (cancelled) return;

      const memberships = membershipError ? [] : ((membershipRows ?? []) as AccountMembershipView[]);
      const membershipAccountIds = new Set(memberships.map((membership) => membership.account_id));
      let resolvedSchemaMode = workspaceSchemaMode;
      let { data, error } = await supabase
        .from("brandhub_workspaces")
        .select(workspaceSchemaMode === "current" ? currentWorkspaceColumns : legacyWorkspaceColumns)
        .order("updated_at", { ascending: false });

      if (cancelled) return;

      if (workspaceSchemaMode === "current" && isMissingWorkspaceColumnError(error)) {
        resolvedSchemaMode = "legacy";
        setWorkspaceSchemaMode("legacy");
        const legacyResult = await supabase
          .from("brandhub_workspaces")
          .select(legacyWorkspaceColumns)
          .order("updated_at", { ascending: false });

        if (cancelled) return;
        data = legacyResult.data;
        error = legacyResult.error;
      }

      if (error) {
        setSyncStatus("Supabase setup needed");
        setCloudHydrated(true);
        return;
      }

      const rows =
        resolvedSchemaMode === "legacy"
          ? ((data ?? []) as WorkspaceRow[]).filter((row) => row.user_id === currentUser.id)
          : ((data ?? []) as WorkspaceRow[]).filter(
              (row) => row.user_id === currentUser.id || Boolean(row.account_id && membershipAccountIds.has(row.account_id)),
            );
      if (rows.length) {
        const cloudWorkspaces = rows.map((row) => ({
          ...row.data,
          id: row.id,
          name: row.name,
          ownerUserId: row.user_id ?? row.data.ownerUserId,
          accountId: row.account_id ?? row.data.accountId,
          accountName: row.data.accountName ?? memberships.find((membership) => membership.account_id === row.account_id)?.brandrepo_accounts?.name,
          accountSlug: row.account_slug ?? row.data.accountSlug,
          visibility: row.visibility ?? row.data.visibility,
        }));
        const localActiveWorkspaceId = activeWorkspaceId || getLocallyActiveWorkspaceId();
        const selectedWorkspace = pickInitialCloudWorkspace(cloudWorkspaces, localActiveWorkspaceId);
        const nextAccounts = buildAccountOptions(cloudWorkspaces, memberships);
        const selectedAccountId = chooseAccountId(nextAccounts, activeAccountId, selectedWorkspace);
        const selectedAccountWorkspace = pickWorkspaceForAccount(cloudWorkspaces, selectedAccountId, selectedWorkspace.id) ?? selectedWorkspace;
        setAccounts(nextAccounts);
        setActiveAccountId(selectedAccountId);
        setWorkspaces(cloudWorkspaces);
        setActiveWorkspaceId(selectedAccountWorkspace.id);
        window.localStorage.setItem(storageKey, JSON.stringify({ activeWorkspaceId: selectedAccountWorkspace.id, workspaces: cloudWorkspaces }));
        setImportError("");
        setChatInput("");
        setMarkdownDrawerSection(null);
        setSyncStatus("Synced to Supabase");
      } else {
        setAccounts([]);
        setActiveAccountId("");
        setSyncStatus("Ready to sync");
      }

      setCloudHydrated(true);
    }

    loadCloudWorkspaces();

    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId, cloudHydrated, currentUser, persistenceReady, workspaceSchemaMode]);

  useEffect(() => {
    if (!supabase || !currentUser || !persistenceReady || !cloudHydrated) return;

    const saveTimer = window.setTimeout(async () => {
      setSyncStatus("Saving...");
      const payload = workspaces.map((workspace) => ({
        id: workspace.id,
        user_id: workspace.ownerUserId ?? currentUser.id,
        name: workspace.name,
        data: {
          ...workspace,
          ownerUserId: workspace.ownerUserId ?? currentUser.id,
        },
        ...(workspaceSchemaMode === "current"
          ? {
              account_id: workspace.accountId ?? null,
              account_slug: workspace.accountSlug ?? normalizeAccountName(getAccountName(currentUser)),
              repo_slug: getRepoSlug(workspace),
              visibility: workspace.visibility ?? "public",
            }
          : {}),
        updated_at: new Date().toISOString(),
      }));

      let { error } = await supabase.from("brandhub_workspaces").upsert(payload, { onConflict: "id" });
      if (workspaceSchemaMode === "current" && isMissingWorkspaceColumnError(error)) {
        setWorkspaceSchemaMode("legacy");
        const legacyPayload = workspaces.map((workspace) => ({
          id: workspace.id,
          user_id: workspace.ownerUserId ?? currentUser.id,
          name: workspace.name,
          data: {
            ...workspace,
            ownerUserId: workspace.ownerUserId ?? currentUser.id,
          },
          updated_at: new Date().toISOString(),
        }));
        const legacyResult = await supabase.from("brandhub_workspaces").upsert(legacyPayload, { onConflict: "id" });
        error = legacyResult.error;
      }
      setSyncStatus(error ? `Sync failed: ${error.message}` : "Synced to Supabase");
    }, 700);

    return () => window.clearTimeout(saveTimer);
  }, [cloudHydrated, currentUser, persistenceReady, workspaceSchemaMode, workspaces]);

  useEffect(() => {
    if (!persistenceReady || !cloudHydrated) return;
    if (window.localStorage.getItem(brokenRepoCleanupStorageKey) === "complete") return;

    const reposToDelete = workspaces.filter((workspace) => {
      const repoName = workspace.name.trim();
      const brandName = workspace.repo.company.name.trim();
      return brokenRepoNamesToDelete.has(repoName) || brokenRepoNamesToDelete.has(brandName);
    });

    if (!reposToDelete.length) {
      window.localStorage.setItem(brokenRepoCleanupStorageKey, "complete");
      return;
    }

    let cancelled = false;

    async function deleteBrokenRepos() {
      setSyncStatus("Deleting repos...");
      const deleteIds = reposToDelete.map((workspace) => workspace.id);

      if (supabase && currentUser) {
        const { error } = await supabase
          .from("brandhub_workspaces")
          .delete()
          .in("id", deleteIds);

        if (error) {
          setSyncStatus(`Delete failed: ${error.message}`);
          return;
        }
      }

      if (cancelled) return;

      setWorkspaces((current) => {
        const filtered = current.filter((workspace) => !deleteIds.includes(workspace.id));
        const fallback = filtered[0] ?? createWorkspace();
        const nextActiveId = filtered.some((workspace) => workspace.id === activeWorkspaceId) ? activeWorkspaceId : fallback.id;
        const nextWorkspaces = filtered.length ? filtered : [fallback];

        setActiveWorkspaceId(nextActiveId);
        window.localStorage.setItem(storageKey, JSON.stringify({ activeWorkspaceId: nextActiveId, workspaces: nextWorkspaces }));
        setImportError("");
        setRepoOverviewActive(true);

        return nextWorkspaces;
      });
      setSyncStatus(supabase && currentUser ? "Synced to Supabase" : "Local only");
      window.localStorage.setItem(brokenRepoCleanupStorageKey, "complete");
    }

    void deleteBrokenRepos();

    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId, cloudHydrated, currentUser, persistenceReady, workspaces]);

  function updateActiveWorkspace(updater: (workspace: WorkspaceState) => WorkspaceState) {
    setWorkspaces((current) => current.map((workspace) => (workspace.id === activeWorkspace?.id ? updater(workspace) : workspace)));
  }

  function updateRepo(updater: (repo: RepoState) => RepoState) {
    updateActiveWorkspace((workspace) => {
      const nextRepo = updater(workspace.repo);
      return {
        ...workspace,
        name: nextRepo.company.name || workspace.name,
        repo: nextRepo,
      };
    });
  }

  function updateChatMessages(updater: (messages: ChatMessage[]) => ChatMessage[]) {
    updateActiveWorkspace((workspace) => ({ ...workspace, chatMessages: updater(workspace.chatMessages) }));
  }

  function startNewCreate() {
    setSection("Create");
    setChatInput("");
    setChatStatus("idle");
    setGammaDrawerOpen(false);
    setGammaDrawerMounted(false);
    setGammaPrompt("");
    setGammaStatus("idle");
    setGammaResult(null);
    setGammaError("");
    updateChatMessages(() => createWelcomeChat());
    setMobileNavOpen(false);
  }

  useEffect(() => {
    if (!activeWorkspace?.id || !persistenceReady) return;
    const activeId = activeWorkspace.id;

    const cleanupTimer = window.setTimeout(() => {
      setWorkspaces((current) =>
        current.map((workspace) => {
          if (workspace.id !== activeId) return workspace;

          const nextMessaging = workspace.repo.messaging.filter(
            (message) => !message.sources.some((source) => source.label === chatSavedMessagingSourceLabel),
          );

          if (nextMessaging.length === workspace.repo.messaging.length) return workspace;

          return {
            ...workspace,
            repo: {
              ...workspace.repo,
              messaging: nextMessaging,
              activity: ["Undid chat answer save", ...workspace.repo.activity],
            },
          };
        }),
      );
    }, 0);

    return () => window.clearTimeout(cleanupTimer);
  }, [activeWorkspace?.id, persistenceReady, repo.messaging]);

  function openMarkdownDrawer(tab: RepoKind) {
    setMarkdownDrawerSection(tab);
    setMarkdownDrawerOpen(false);
    window.setTimeout(() => {
      setMarkdownDrawerOpen(true);
    }, 0);
  }

  function closeMarkdownDrawer() {
    setMarkdownDrawerOpen(false);
    window.setTimeout(() => {
      setMarkdownDrawerSection(null);
    }, drawerAnimationMs);
  }

  function openAssetDrawer(assetId: string) {
    setAssetDrawerAssetId(assetId);
    setAssetDrawerOpen(false);
    window.setTimeout(() => {
      setAssetDrawerOpen(true);
    }, 0);
  }

  function closeAssetDrawer() {
    setAssetDrawerOpen(false);
    window.setTimeout(() => {
      setAssetDrawerAssetId(null);
    }, drawerAnimationMs);
  }

  function openGammaPresentationDrawer() {
    setGammaPrompt("");
    setGammaStatus("idle");
    setGammaResult(null);
    setGammaError("");
    setGammaDrawerMounted(true);
    setGammaDrawerOpen(false);
    window.setTimeout(() => {
      setGammaDrawerOpen(true);
    }, 0);
  }

  function closeGammaPresentationDrawer() {
    setGammaDrawerOpen(false);
    window.setTimeout(() => {
      setGammaDrawerMounted(false);
      setGammaPrompt("");
      setGammaStatus("idle");
      setGammaResult(null);
      setGammaError("");
    }, drawerAnimationMs);
  }

  async function submitGammaPresentation() {
    if (!activeWorkspace || !gammaPrompt.trim() || gammaStatus === "creating") return;

    setGammaStatus("creating");
    setGammaError("");
    setGammaResult(null);

    const request: PresentationCreationRequest = {
      type: "presentation",
      provider: "gamma",
      prompt: gammaPrompt.trim(),
      brandId: activeWorkspace.id,
      brandContext: getBrandContext({ workspace: activeWorkspace, contentType: "presentation" }),
    };

    try {
      const accessToken = await getCurrentAccessToken();
      const result = await createGammaPresentation(request, accessToken);
      setGammaResult(result);
      setGammaStatus("success");
    } catch (error) {
      setGammaError(error instanceof Error ? error.message : "Something went wrong while sending this request to Gamma.");
      setGammaStatus("error");
    }
  }

  function openSectionMarkdownImportDrawer(tab: RepoKind) {
    setMarkdownImportSection(tab);
    setMessagingImportDraft("");
    setMessagingImportDrawerMounted(true);
    setMessagingImportDrawerOpen(false);
    window.setTimeout(() => {
      setMessagingImportDrawerOpen(true);
    }, 0);
  }

  function closeMessagingImportDrawer() {
    setMessagingImportDrawerOpen(false);
    window.setTimeout(() => {
      setMessagingImportDrawerMounted(false);
    }, drawerAnimationMs);
  }

  function showRepoSection(tab: RepoKind) {
    setSection("Repo");
    setRepoTab(tab);
    setRepoOverviewActive(false);
  }

  function saveSectionMarkdownImport() {
    if (markdownImportSection === "Identity") {
      const parsed = parseIdentityMarkdown(messagingImportDraft);
      const hasParsedContent = Object.values(parsed).some(Boolean);

      if (!hasParsedContent) return;

      setIdentityStatus("Saving...");
      updateRepo((current) => ({
        ...current,
        identity: {
          ...getRepoIdentity(current),
          ...Object.fromEntries(Object.entries(parsed).filter(([, value]) => value)),
        },
        activity: ["Imported Identity Markdown", ...current.activity],
      }));
      closeMessagingImportDrawer();
      showRepoSection("Identity");
      return;
    }

    if (markdownImportSection === "Colors") {
      const parsed = parseColorsMarkdown(messagingImportDraft);
      const hasParsedContent = parsed.colors.length || parsed.rules;

      if (!hasParsedContent) return;

      setColorsStatus("Saving...");
      updateRepo((current) => ({
        ...current,
        colors: parsed.colors.length ? parsed.colors : getRepoColors(current),
        colorRules: parsed.rules || getRepoColorRules(current),
        activity: ["Imported Colors Markdown", ...current.activity],
      }));
      closeMessagingImportDrawer();
      showRepoSection("Colors");
      return;
    }

    if (markdownImportSection === "Voice & Tone") {
      const parsed = parseVoiceToneMarkdown(messagingImportDraft);
      const hasParsedContent =
        parsed.voiceCharacteristics.length ||
        parsed.writingRules.length ||
        parsed.wordsToUse.length ||
        parsed.wordsToAvoid.length;

      if (!hasParsedContent) return;

      setVoiceToneStatus("Saving...");
      updateRepo((current) => ({
        ...current,
        brand: {
          ...current.brand,
          voice: parsed.voiceCharacteristics.length ? parsed.voiceCharacteristics : current.brand.voice,
          rules: parsed.writingRules.length ? parsed.writingRules : current.brand.rules,
          approvedTerms: parsed.wordsToUse.length ? parsed.wordsToUse : current.brand.approvedTerms,
          prohibitedTerms: parsed.wordsToAvoid.length ? parsed.wordsToAvoid : current.brand.prohibitedTerms,
        },
        activity: ["Imported Voice & Tone Markdown", ...current.activity],
      }));
      closeMessagingImportDrawer();
      showRepoSection("Voice & Tone");
      return;
    }

    if (markdownImportSection === "Typography") {
      const parsed = parseTypographyMarkdown(messagingImportDraft);
      const hasParsedContent = parsed.fontNames.length || parsed.weights.length || parsed.usageRules;

      if (!hasParsedContent) return;

      setTypographyStatus("Saving...");
      updateRepo((current) => ({
        ...current,
        typography: {
          ...getRepoTypography(current),
          fontNames: parsed.fontNames.length ? parsed.fontNames : getRepoTypography(current).fontNames,
          weights: parsed.weights.length ? parsed.weights : getRepoTypography(current).weights,
          usageRules: parsed.usageRules || getRepoTypography(current).usageRules,
        },
        activity: ["Imported Typography Markdown", ...current.activity],
      }));
      closeMessagingImportDrawer();
      showRepoSection("Typography");
      return;
    }

    if (markdownImportSection === "Audiences") {
      const parsed = parseAudiencesMarkdown(messagingImportDraft);
      const hasParsedContent = Object.values(parsed).some(Boolean);

      if (!hasParsedContent) return;

      setAudiencesStatus("Saving...");
      updateRepo((current) => ({
        ...current,
        audienceSettings: {
          ...getRepoAudienceSettings(current),
          ...Object.fromEntries(Object.entries(parsed).filter(([, value]) => value)),
        },
        activity: ["Imported Audiences Markdown", ...current.activity],
      }));
      closeMessagingImportDrawer();
      showRepoSection("Audiences");
      return;
    }

    if (markdownImportSection === "Channel SEO") {
      const parsed = parseChannelSeoMarkdown(messagingImportDraft);
      const hasParsedContent = Object.values(parsed).some(Boolean);

      if (!hasParsedContent) return;

      setChannelSeoStatus("Saving...");
      updateRepo((current) => ({
        ...current,
        channelSeo: {
          ...getRepoChannelSeo(current),
          ...Object.fromEntries(Object.entries(parsed).filter(([, value]) => value)),
        },
        activity: ["Imported Channel SEO Markdown", ...current.activity],
      }));
      closeMessagingImportDrawer();
      showRepoSection("Channel SEO");
      return;
    }

    if (markdownImportSection === "Products") {
      const parsed = parseProductMarkdown(messagingImportDraft);

      if (!parsed.length) return;

      setProductsStatus("Saving...");
      updateRepo((current) => ({
        ...current,
        products: parsed,
        activity: ["Imported Products Markdown", ...current.activity],
      }));
      closeMessagingImportDrawer();
      showRepoSection("Products");
      return;
    }

    if (markdownImportSection === "Approved Claims") {
      const parsed = parseApprovedClaimsMarkdown(messagingImportDraft);

      if (!parsed.length) return;

      setApprovedClaimsStatus("Saving...");
      updateRepo((current) => ({
        ...current,
        approvedClaims: parsed,
        activity: ["Imported Approved Claims Markdown", ...current.activity],
      }));
      closeMessagingImportDrawer();
      showRepoSection("Approved Claims");
      return;
    }

    if (markdownImportSection !== "Messaging") {
      addSectionMarkdown(markdownImportSection, messagingImportDraft);
      closeMessagingImportDrawer();
      showRepoSection(markdownImportSection);
      return;
    }

    const parsed = parseMessagingMarkdown(messagingImportDraft);
    const hasParsedContent =
      parsed.primaryValueProposition ||
      parsed.keyMessages.length ||
      parsed.targetCustomer ||
      parsed.mainCustomerProblem ||
      parsed.keyDifferentiators.length ||
      parsed.tagline;

    if (!hasParsedContent) return;

    setMessagingStatus("Saving...");
    updateRepo((current) => {
      const currentMessage = current.messaging[0];
      const message: Messaging = currentMessage ?? {
        id: createId("message-md-import"),
        positioning: "",
        valueProps: [],
        taglines: [],
        keyMessages: [],
        proofPoints: [],
        claims: [],
        sources: [],
      };
      const currentAudience = current.audiences[0];
      const audience: Audience = currentAudience ?? {
        id: createId("audience-md-import"),
        name: "",
        description: "",
        painPoints: [],
        needs: [],
        messaging: [],
        channels: [],
        sources: [],
      };
      const nextMessage = {
        ...message,
        positioning: parsed.primaryValueProposition || message.positioning,
        valueProps: parsed.primaryValueProposition ? [parsed.primaryValueProposition] : message.valueProps,
        keyMessages: parsed.keyMessages.length ? parsed.keyMessages : message.keyMessages,
        proofPoints: parsed.keyDifferentiators.length ? parsed.keyDifferentiators : message.proofPoints,
        taglines: parsed.tagline ? [parsed.tagline] : message.taglines,
      };
      const nextAudience = {
        ...audience,
        name: parsed.targetCustomer || audience.name,
        painPoints: parsed.mainCustomerProblem ? [parsed.mainCustomerProblem] : audience.painPoints,
      };

      return {
        ...current,
        audiences: currentAudience ? [nextAudience, ...current.audiences.slice(1)] : [nextAudience, ...current.audiences],
        messaging: currentMessage ? [nextMessage, ...current.messaging.slice(1)] : [nextMessage, ...current.messaging],
        activity: ["Imported Messaging Markdown", ...current.activity],
      };
    });
    closeMessagingImportDrawer();
    showRepoSection("Messaging");
  }

  function addWorkspace(name: string) {
    const repoName = name.trim();
    const accountContext = activeAccount;
    const nextWorkspace = createWorkspace(
      {
        ...initialRepo,
        company: {
          ...initialRepo.company,
          name: repoName,
        },
      },
      repoName,
    );
    if (accountContext && !accountContext.isLegacy) {
      nextWorkspace.accountId = accountContext.id;
      nextWorkspace.accountName = accountContext.name;
      nextWorkspace.accountSlug = accountContext.slug;
    }
    setWorkspaces((current) => [...current, nextWorkspace]);
    if (accountContext) {
      setActiveAccountId(accountContext.id);
    }
    setActiveWorkspaceId(nextWorkspace.id);
    setImportError("");
    setMarkdownDrawerOpen(false);
    setMarkdownDrawerSection(null);
    setMessagingImportDrawerOpen(false);
    setMessagingImportDrawerMounted(false);
    setSection("Repo");
    setRepoTab("Brand Basics");
    setRepoOverviewActive(true);
  }

  function openNewRepoModal() {
    setNewRepoName("");
    setNewRepoModalOpen(true);
  }

  function closeNewRepoModal() {
    setNewRepoModalOpen(false);
    setNewRepoName("");
  }

  function submitNewRepo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newRepoName.trim();
    if (!name) return;
    addWorkspace(name);
    closeNewRepoModal();
  }

  async function deleteActiveWorkspace() {
    if (!activeWorkspace) return;

    const confirmed = window.confirm(`Delete ${activeWorkspace.name}? This cannot be undone.`);
    if (!confirmed) return;

    const deleteId = activeWorkspace.id;
    setImportError("");
    setSyncStatus("Deleting repo...");

    if (supabase && currentUser) {
      const { error } = await supabase
        .from("brandhub_workspaces")
        .delete()
        .eq("id", deleteId);

      if (error) {
        setSyncStatus(`Delete failed: ${error.message}`);
        setImportError(`Unable to delete repo: ${error.message}`);
        return;
      }
    }

    const remainingWorkspaces = workspaces.filter((workspace) => workspace.id !== deleteId);
    const nextWorkspaces = remainingWorkspaces.length ? remainingWorkspaces : [createWorkspace()];
    const nextAccounts = buildAccountOptions(nextWorkspaces, []);
    const fallbackAccountId = activeAccountId && nextAccounts.some((account) => account.id === activeAccountId) ? activeAccountId : nextAccounts[0]?.id ?? "";
    const nextWorkspace = pickWorkspaceForAccount(nextWorkspaces, fallbackAccountId) ?? nextWorkspaces[0];

    setWorkspaces(nextWorkspaces);
    setAccounts(nextAccounts);
    setActiveAccountId(getWorkspaceAccountId(nextWorkspace));
    setRepoOverviewActive(true);
    setSection("Repo");
    setRepoTab("Brand Basics");
    resetTransientWorkspaceState(nextWorkspace, nextWorkspaces);
    setSyncStatus(supabase && currentUser ? "Synced to Supabase" : "Local only");
  }

  function resetTransientWorkspaceState(nextWorkspace: WorkspaceState, availableWorkspaces = workspaces) {
    const nextAccounts = buildAccountOptions(availableWorkspaces, []);
    setAccounts(nextAccounts);
    setActiveAccountId(getWorkspaceAccountId(nextWorkspace));
    setActiveWorkspaceId(nextWorkspace.id);
    if (persistenceReady) {
      window.localStorage.setItem(storageKey, JSON.stringify({ activeWorkspaceId: nextWorkspace.id, workspaces: availableWorkspaces }));
    }
    setImportError("");
    setChatInput("");
    setMarkdownDrawerOpen(false);
    setMarkdownDrawerSection(null);
    setMessagingImportDrawerOpen(false);
    setMessagingImportDrawerMounted(false);
  }

  function activateWorkspace(workspaceId: string) {
    const nextWorkspace = workspaces.find((workspace) => workspace.id === workspaceId);
    if (!nextWorkspace) return;

    resetTransientWorkspaceState(nextWorkspace, workspaces);
  }

  function handleAccountSelection(accountId: string) {
    const nextWorkspace = pickWorkspaceForAccount(workspaces, accountId);
    if (!nextWorkspace) return;

    setActiveAccountId(accountId);
    resetTransientWorkspaceState(nextWorkspace, workspaces);
    setMobileNavOpen(false);
  }

  function handleRepoSelection(workspaceId: string) {
    if (workspaceId === "new-repo") {
      openNewRepoModal();
      return;
    }

    activateWorkspace(workspaceId);
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;

    if (authMode === "reset-password") {
      if (!authEmail.trim()) return;
      setAuthStatus("working");
      setAuthError("");
      const { error } = await supabase.auth.resetPasswordForEmail(authEmail.trim(), {
        redirectTo: window.location.origin,
      });

      if (error) {
        setAuthStatus("error");
        setAuthError(error.message);
        return;
      }

      setAuthStatus("success");
      return;
    }

    if (authMode === "update-password") {
      if (!authPassword || !authPasswordConfirm) return;
      if (authPassword !== authPasswordConfirm) {
        setAuthStatus("error");
        setAuthError("Passwords do not match.");
        return;
      }

      setAuthStatus("working");
      setAuthError("");
      const { data, error } = await supabase.auth.updateUser({ password: authPassword });

      if (error) {
        setAuthStatus("error");
        setAuthError(error.message);
        return;
      }

      setCurrentUser(data.user ?? currentUser);
      setAuthPassword("");
      setAuthPasswordConfirm("");
      setAuthMode("sign-in");
      setAuthStatus("success");
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (!authEmail.trim() || !authPassword) return;

    const accountName = normalizeAccountName(authAccountName);
    if (authMode === "sign-up" && !isValidAccountName(accountName)) {
      setAuthStatus("error");
      setAuthError("Account name must be 3-40 characters and use lowercase letters, numbers, or hyphens.");
      return;
    }

    setAuthStatus("working");
    setAuthError("");
    const { data, error } =
      authMode === "sign-up"
        ? await supabase.auth.signUp({
            email: authEmail.trim(),
            password: authPassword,
            options: {
              data: {
                account_name: accountName,
              },
            },
          })
        : await supabase.auth.signInWithPassword({
            email: authEmail.trim(),
            password: authPassword,
          });

    if (error) {
      setAuthStatus("error");
      setAuthError(error.message);
      return;
    }

    if (data.session?.user) {
      setCurrentUser(data.session.user);
      setCloudHydrated(false);
      setAuthStatus("success");
      return;
    }

    if (authMode === "sign-up") {
      setCurrentUser(null);
      setAuthAccountName("");
      setAuthStatus("success");
      setAuthError("");
      return;
    }

    setCurrentUser(null);
    setAuthStatus("error");
    setAuthError("Sign-in did not return an active session.");
  }

  async function signInWithGoogle() {
    if (!supabase) return;

    if (authMode === "sign-up") {
      const accountName = normalizeAccountName(authAccountName);
      if (!isValidAccountName(accountName)) {
        setAuthStatus("error");
        setAuthError("Account name must be 3-40 characters and use lowercase letters, numbers, or hyphens.");
        return;
      }
      window.localStorage.setItem(pendingGoogleAccountNameStorageKey, accountName);
    } else {
      window.localStorage.removeItem(pendingGoogleAccountNameStorageKey);
    }

    setAuthStatus("working");
    setAuthError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      setAuthStatus("error");
      setAuthError(error.message);
      window.localStorage.removeItem(pendingGoogleAccountNameStorageKey);
    }
  }

  async function submitAccountSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !currentUser) return;

    const accountName = normalizeAccountName(settingsAccountName);
    if (!isValidAccountName(accountName)) {
      setSettingsStatus("error");
      setSettingsError("Account name must be 3-40 characters and use lowercase letters, numbers, or hyphens.");
      return;
    }

    setSettingsStatus("saving");
    setSettingsError("");
    const { data, error } = await supabase.auth.updateUser({
      data: {
        ...(currentUser.user_metadata ?? {}),
        account_name: accountName,
      },
    });

    if (error) {
      setSettingsStatus("error");
      setSettingsError(error.message);
      return;
    }

    if (data.user) {
      setCurrentUser(data.user);
    }
    setSettingsAccountName(accountName);
    setSettingsStatus("success");
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setCurrentUser(null);
    setDeveloperToken("");
    setDeveloperTokenVisible(false);
    setDeveloperTokenStatus("idle");
    setDeveloperTokenError("");
    setCloudHydrated(false);
    setSyncStatus("Local only");
  }

  async function refreshDeveloperToken() {
    if (!supabase) return;

    setDeveloperTokenStatus("loading");
    setDeveloperTokenError("");
    const { data, error } = await supabase.auth.getSession();

    if (error || !data.session?.access_token) {
      setDeveloperToken("");
      setDeveloperTokenVisible(false);
      setDeveloperTokenStatus("error");
      setDeveloperTokenError(error?.message ?? "No active Supabase session token is available.");
      return;
    }

    setDeveloperToken(data.session.access_token);
    setDeveloperTokenVisible(true);
    setDeveloperTokenStatus("idle");
  }

  async function copyDeveloperToken() {
    if (!developerToken) return;

    try {
      await navigator.clipboard.writeText(developerToken);
      setDeveloperTokenStatus("copied");
    } catch {
      setDeveloperTokenStatus("error");
      setDeveloperTokenError("Unable to copy token automatically.");
    }
  }

  async function getCurrentAccessToken() {
    if (!supabase) return "";
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.access_token) {
      throw new Error(error?.message ?? "No active Supabase session token is available.");
    }
    return data.session.access_token;
  }

  async function loadOAuthConnections() {
    try {
      const accessToken = await getCurrentAccessToken();
      setOauthConnectionStatus("loading");
      setOauthConnectionError("");
      const response = await fetch("/api/oauth/connections", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load connected apps.");
      }

      setOauthConnections(payload.connections ?? []);
      setOauthConnectionStatus("idle");
    } catch (error) {
      setOauthConnectionStatus("error");
      setOauthConnectionError(error instanceof Error ? error.message : "Unable to load connected apps.");
    }
  }

  async function revokeOAuthConnection(clientId: string) {
    try {
      const accessToken = await getCurrentAccessToken();
      setOauthConnectionStatus("revoking");
      setOauthConnectionError("");
      const response = await fetch(`/api/oauth/connections/${encodeURIComponent(clientId)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to revoke connected app.");
      }

      setOauthConnections((current) => current.filter((connection) => connection.clientId !== clientId));
      setOauthConnectionStatus("idle");
    } catch (error) {
      setOauthConnectionStatus("error");
      setOauthConnectionError(error instanceof Error ? error.message : "Unable to revoke connected app.");
    }
  }

  async function loadExternalConnections() {
    try {
      const accessToken = await getCurrentAccessToken();
      setExternalConnectionStatus("loading");
      setExternalConnectionError("");
      const response = await fetch("/api/external/connections", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load external app connections.");
      }

      setExternalConnections(payload.connections ?? []);
      setExternalConnectionStatus("idle");
    } catch (error) {
      setExternalConnectionStatus("error");
      setExternalConnectionError(error instanceof Error ? error.message : "Unable to load external app connections.");
    }
  }

  async function revokeExternalConnection(provider: string) {
    try {
      const accessToken = await getCurrentAccessToken();
      setExternalConnectionStatus("revoking");
      setExternalConnectionError("");
      const response = await fetch(`/api/external/connections/${encodeURIComponent(provider)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to revoke external app connection.");
      }

      setExternalConnections((current) => current.filter((connection) => connection.provider !== provider));
      setExternalConnectionStatus("idle");
    } catch (error) {
      setExternalConnectionStatus("error");
      setExternalConnectionError(error instanceof Error ? error.message : "Unable to revoke external app connection.");
    }
  }

  async function loadAdminAccounts() {
    if (!isPlatformAdmin(currentUser)) return;

    try {
      const accessToken = await getCurrentAccessToken();
      setAdminStatus("loading");
      setAdminError("");
      const response = await fetch("/api/admin/accounts", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const payload = (await response.json().catch(() => ({}))) as { accounts?: AdminAccountView[]; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load customer accounts.");
      }

      setAdminAccounts(payload.accounts ?? []);
      setAdminStatus("idle");
    } catch (error) {
      setAdminStatus("error");
      setAdminError(error instanceof Error ? error.message : "Unable to load customer accounts.");
    }
  }

  async function createCustomerAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adminAccountName.trim()) return;

    try {
      const accessToken = await getCurrentAccessToken();
      setAdminStatus("creating");
      setAdminError("");
      const response = await fetch("/api/admin/accounts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: adminAccountName.trim() }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        account?: AdminAccountView;
        workspace?: WorkspaceState;
        error?: string;
      };

      if (!response.ok || !payload.account || !payload.workspace) {
        throw new Error(payload.error ?? "Unable to create customer account.");
      }

      const nextWorkspace = {
        ...payload.workspace,
        ownerUserId: currentUser?.id,
        accountId: payload.account.id,
        accountName: payload.account.name,
        accountSlug: payload.account.slug,
      };
      const nextWorkspaces = [nextWorkspace, ...workspaces.filter((workspace) => workspace.id !== nextWorkspace.id)];
      setWorkspaces(nextWorkspaces);
      resetTransientWorkspaceState(nextWorkspace, nextWorkspaces);
      setAdminAccountName("");
      setSection("Repo");
      setRepoOverviewActive(true);
      setSyncStatus("Synced to Supabase");
      await loadAdminAccounts();
      setAdminStatus("success");
    } catch (error) {
      setAdminStatus("error");
      setAdminError(error instanceof Error ? error.message : "Unable to create customer account.");
    }
  }

  async function inviteCustomerAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adminInviteAccountId || !adminInviteEmail.trim()) return;

    try {
      const accessToken = await getCurrentAccessToken();
      setAdminStatus("inviting");
      setAdminError("");
      const response = await fetch(`/api/admin/accounts/${adminInviteAccountId}/invite`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: adminInviteEmail.trim(), role: "admin" }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to send invite.");
      }

      setAdminInviteEmail("");
      await loadAdminAccounts();
      setAdminStatus("success");
    } catch (error) {
      setAdminStatus("error");
      setAdminError(error instanceof Error ? error.message : "Unable to send invite.");
    }
  }

  async function saveGammaApiKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const accessToken = await getCurrentAccessToken();
      setExternalConnectionStatus("saving");
      setExternalConnectionError("");
      const response = await fetch("/api/external/gamma/api-key", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ apiKey: gammaApiKeyDraft.trim() }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save Gamma API key.");
      }

      setGammaApiKeyDraft("");
      setGammaApiKeyModalOpen(false);
      await loadExternalConnections();
      setExternalConnectionStatus("idle");
    } catch (error) {
      setExternalConnectionStatus("error");
      setExternalConnectionError(error instanceof Error ? error.message : "Unable to save Gamma API key.");
    }
  }

  async function loadIntegrationTokens() {
    try {
      const accessToken = await getCurrentAccessToken();
      setIntegrationTokenStatus("loading");
      setIntegrationTokenError("");
      const response = await fetch("/api/integration-tokens", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load integration tokens.");
      }

      setIntegrationTokens(payload.tokens ?? []);
      setIntegrationTokenStatus("idle");
    } catch (error) {
      setIntegrationTokenStatus("error");
      setIntegrationTokenError(error instanceof Error ? error.message : "Unable to load integration tokens.");
    }
  }

  async function createIntegrationToken() {
    try {
      const accessToken = await getCurrentAccessToken();
      setIntegrationTokenStatus("creating");
      setIntegrationTokenError("");
      setNewIntegrationTokenSecret("");
      const response = await fetch("/api/integration-tokens", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: integrationTokenName }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to create integration token.");
      }

      setNewIntegrationTokenSecret(payload.secret ?? "");
      setIntegrationTokens((current) => [payload.token, ...current].filter(Boolean));
      setIntegrationTokenStatus("idle");
    } catch (error) {
      setIntegrationTokenStatus("error");
      setIntegrationTokenError(error instanceof Error ? error.message : "Unable to create integration token.");
    }
  }

  async function copyIntegrationTokenSecret() {
    if (!newIntegrationTokenSecret) return;

    try {
      await navigator.clipboard.writeText(newIntegrationTokenSecret);
      setIntegrationTokenStatus("copied");
    } catch {
      setIntegrationTokenStatus("error");
      setIntegrationTokenError("Unable to copy token automatically.");
    }
  }

  async function revokeIntegrationToken(tokenId: string) {
    try {
      const accessToken = await getCurrentAccessToken();
      setIntegrationTokenStatus("revoking");
      setIntegrationTokenError("");
      const response = await fetch(`/api/integration-tokens/${encodeURIComponent(tokenId)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to revoke integration token.");
      }

      setIntegrationTokens((current) =>
        current.map((token) => (token.id === tokenId ? { ...token, revokedAt: new Date().toISOString() } : token)),
      );
      setIntegrationTokenStatus("idle");
    } catch (error) {
      setIntegrationTokenStatus("error");
      setIntegrationTokenError(error instanceof Error ? error.message : "Unable to revoke integration token.");
    }
  }

  function switchAuthMode(mode: AuthMode) {
    setAuthMode(mode);
    setAuthStatus("idle");
    setAuthError("");
    setAuthPassword("");
    setAuthPasswordConfirm("");
  }

  if (isSupabaseConfigured && !authChecked) {
    return (
      <main className="auth-page" data-theme={theme}>
        <section className="auth-card">
          <div className="brand-mark auth-brand">
            <BrandRepoLogo />
          </div>
          <p className="eyebrow">Checking session</p>
          <h1>Loading your repo.</h1>
        </section>
      </main>
    );
  }

  if (!currentUser || authMode === "update-password") {
    const authUnavailable = !isSupabaseConfigured;
    const authTitle =
      authUnavailable
        ? "Sign in is not configured."
        : authMode === "sign-up"
        ? "Create your BrandRepo account."
        : authMode === "reset-password"
          ? "Reset your password."
          : authMode === "update-password"
            ? "Choose a new password."
            : "Sign in to BrandRepo.";
    const authEyebrow =
      authUnavailable
        ? "Sign in"
        : authMode === "sign-up"
        ? "Create account"
        : authMode === "reset-password"
          ? "Password reset"
          : authMode === "update-password"
            ? "Update password"
            : "Sign in";
    const authSubtitle =
      authUnavailable
        ? "Google sign-in needs Supabase configuration before repos can be opened."
        : authMode === "reset-password"
        ? "Enter your email and we will send you a password reset link."
        : authMode === "update-password"
          ? "Enter a new password for your account."
          : "Your repos are saved to the account you use here.";

    return (
      <main className="auth-page" data-theme={theme}>
        <section className="auth-card">
          <div className="brand-mark auth-brand">
            <BrandRepoLogo />
          </div>
          <div>
            <p className="eyebrow">{authEyebrow}</p>
            <h1>{authTitle}</h1>
            <p className="auth-subtitle">{authSubtitle}</p>
          </div>
          <form className="auth-form" onSubmit={submitAuth}>
            {authMode !== "update-password" && (
              <div className="auth-mode-toggle" role="group" aria-label="Account mode">
                <button className={authMode === "sign-in" ? "active" : ""} onClick={() => switchAuthMode("sign-in")} type="button">
                  Sign in
                </button>
                <button className={authMode === "sign-up" ? "active" : ""} onClick={() => switchAuthMode("sign-up")} type="button">
                  Create account
                </button>
              </div>
            )}
            {authMode === "sign-up" && (
              <label>
                Account name
                <input
                  autoComplete="username"
                  onChange={(event) => setAuthAccountName(normalizeAccountName(event.target.value))}
                  placeholder="dzuy"
                  required
                  value={authAccountName}
                />
                <span className="form-note">This will become brandrepo.dev/{authAccountName || "account-name"}.</span>
              </label>
            )}
            {authMode !== "update-password" && (
              <label>
                Email
                <input
                  autoComplete="email"
                  onChange={(event) => setAuthEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                  type="email"
                  value={authEmail}
                />
              </label>
            )}
            {authMode !== "reset-password" && (
              <label>
                {authMode === "update-password" ? "New password" : "Password"}
                <input
                  autoComplete={authMode === "sign-in" ? "current-password" : "new-password"}
                  minLength={6}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  placeholder={authMode === "update-password" ? "New password" : "Password"}
                  required
                  type="password"
                  value={authPassword}
                />
              </label>
            )}
            {authMode === "update-password" && (
              <label>
                Confirm new password
                <input
                  autoComplete="new-password"
                  minLength={6}
                  onChange={(event) => setAuthPasswordConfirm(event.target.value)}
                  placeholder="Confirm new password"
                  required
                  type="password"
                  value={authPasswordConfirm}
                />
              </label>
            )}
            <button disabled={authUnavailable || authStatus === "working"} type="submit">
              {authStatus === "working"
                ? "Working..."
                : authMode === "sign-up"
                  ? "Create account"
                  : authMode === "reset-password"
                    ? "Send reset link"
                    : authMode === "update-password"
                      ? "Update password"
                      : "Sign in"}
            </button>
            {authMode !== "reset-password" && authMode !== "update-password" && (
              <>
                <div className="auth-divider">
                  <span>or</span>
                </div>
                <button
                  className="auth-oauth-button"
                  disabled={authUnavailable || authStatus === "working"}
                  onClick={signInWithGoogle}
                  type="button"
                >
                  <span className="google-mark" aria-hidden="true">
                    G
                  </span>
                  Continue with Google
                </button>
              </>
            )}
            {authStatus === "success" && authMode === "sign-up" && (
              <span>Account created. If email confirmation is enabled, check your email before signing in.</span>
            )}
            {authStatus === "success" && authMode === "reset-password" && (
              <span>If an account exists for that email, a password reset link has been sent.</span>
            )}
            {authStatus === "success" && authMode === "sign-in" && <span>Password updated. Sign in with your new password.</span>}
            {authError && <span>{authError}</span>}
            {authMode === "sign-in" && (
              <button className="auth-text-button" onClick={() => switchAuthMode("reset-password")} type="button">
                Forgot password?
              </button>
            )}
            {authMode === "reset-password" && (
              <button className="auth-text-button" onClick={() => switchAuthMode("sign-in")} type="button">
                Back to sign in
              </button>
            )}
          </form>
        </section>
      </main>
    );
  }

  const isNewWorkspace =
    !repo.company.name.trim() &&
    repo.products.length === 0 &&
    repo.audiences.length === 0 &&
    repo.messaging.length === 0 &&
    repo.campaigns.length === 0 &&
    repo.assets.length === 0;

  function updateBrandBasics(field: "name" | "website" | "description" | "about", value: string) {
    setBrandBasicsStatus("Saving...");
    if (field === "about") {
      updateRepo((current) => ({
        ...current,
        brand: {
          ...current.brand,
          description: value,
        },
      }));
      return;
    }

    updateRepo((current) => ({
      ...current,
      company: {
        ...current.company,
        [field]: value,
      },
    }));
  }

  function updateMessagingField(
    field: "primaryValueProposition" | "keyMessages" | "targetCustomer" | "mainCustomerProblem" | "keyDifferentiators" | "tagline",
    value: string,
  ) {
    setMessagingStatus("Saving...");
    updateRepo((current) => {
      const currentMessage = current.messaging[0];
      const message: Messaging = currentMessage ?? {
        id: createId("message-manual"),
        positioning: "",
        valueProps: [],
        taglines: [],
        keyMessages: [],
        proofPoints: [],
        claims: [],
        sources: [],
      };
      const currentAudience = current.audiences[0];
      const audience: Audience = currentAudience ?? {
        id: createId("audience-manual"),
        name: "",
        description: "",
        painPoints: [],
        needs: [],
        messaging: [],
        channels: [],
        sources: [],
      };
      const values = value
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean);

      if (field === "targetCustomer" || field === "mainCustomerProblem") {
        const nextAudience = {
          ...audience,
          name: field === "targetCustomer" ? value : audience.name,
          painPoints: field === "mainCustomerProblem" ? (value.trim() ? [value] : []) : audience.painPoints,
        };
        return {
          ...current,
          audiences: currentAudience ? [nextAudience, ...current.audiences.slice(1)] : [nextAudience, ...current.audiences],
        };
      }

      const nextMessage = {
        ...message,
        positioning: field === "primaryValueProposition" ? value : message.positioning,
        valueProps: field === "primaryValueProposition" ? (value.trim() ? [value] : []) : message.valueProps,
        keyMessages: field === "keyMessages" ? values.slice(0, 5) : message.keyMessages,
        proofPoints: field === "keyDifferentiators" ? values : message.proofPoints,
        taglines: field === "tagline" ? (value.trim() ? [value] : []) : message.taglines,
      };

      return {
        ...current,
        messaging: currentMessage ? [nextMessage, ...current.messaging.slice(1)] : [nextMessage, ...current.messaging],
      };
    });
  }

  function updateVoiceToneField(
    field: "voiceCharacteristics" | "writingRules" | "wordsToUse" | "wordsToAvoid",
    value: string,
  ) {
    setVoiceToneStatus("Saving...");
    const values = value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    updateRepo((current) => ({
      ...current,
      brand: {
        ...current.brand,
        voice: field === "voiceCharacteristics" ? values : current.brand.voice,
        rules: field === "writingRules" ? values : current.brand.rules,
        approvedTerms: field === "wordsToUse" ? values : current.brand.approvedTerms,
        prohibitedTerms: field === "wordsToAvoid" ? values : current.brand.prohibitedTerms,
      },
    }));
  }

  function updateTypographyField(field: "fontNames" | "weights" | "usageRules", value: string) {
    setTypographyStatus("Saving...");
    const values = value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    updateRepo((current) => ({
      ...current,
      typography: {
        ...getRepoTypography(current),
        fontNames: field === "fontNames" ? values : getRepoTypography(current).fontNames,
        weights: field === "weights" ? values : getRepoTypography(current).weights,
        usageRules: field === "usageRules" ? value : getRepoTypography(current).usageRules,
      },
    }));
  }

  function updateAudienceField(field: keyof AudienceSettings, value: string) {
    setAudiencesStatus("Saving...");
    updateRepo((current) => ({
      ...current,
      audienceSettings: {
        ...getRepoAudienceSettings(current),
        [field]: value,
      },
    }));
  }

  function updateChannelSeoField(field: keyof ChannelSeoSettings, value: string) {
    setChannelSeoStatus("Saving...");
    updateRepo((current) => ({
      ...current,
      channelSeo: {
        ...getRepoChannelSeo(current),
        [field]: value,
      },
    }));
  }

  function updateIdentityField(field: IdentityField, value: string) {
    setIdentityStatus("Saving...");
    updateRepo((current) => ({
      ...current,
      identity: {
        ...getRepoIdentity(current),
        [field]: value,
      },
    }));
  }

  function addColorToken() {
    setColorsStatus("Saving...");
    updateRepo((current) => ({
      ...current,
      colors: [...getRepoColors(current), { id: createId("color"), name: "", hex: "", description: "" }],
    }));
  }

  function updateColorToken(colorId: string, field: "name" | "hex" | "description", value: string) {
    setColorsStatus("Saving...");
    updateRepo((current) => ({
      ...current,
      colors: getRepoColors(current).map((color) =>
        color.id === colorId
          ? {
              ...color,
              [field]: field === "hex" ? normalizeHexColor(value) : value,
            }
          : color,
      ),
    }));
  }

  function updateColorRules(value: string) {
    setColorsStatus("Saving...");
    updateRepo((current) => ({
      ...current,
      colorRules: value,
    }));
  }

  function deleteColorToken(colorId: string) {
    setColorsStatus("Saving...");
    updateRepo((current) => ({
      ...current,
      colors: getRepoColors(current).filter((color) => color.id !== colorId),
    }));
  }

  function addProduct() {
    setProductsStatus("Saving...");
    const product = createProduct();
    updateRepo((current) => ({
      ...current,
      products: [...getRepoProducts(current), product],
    }));
    return product.id;
  }

  function updateProductField(productId: string, field: ProductField, value: string) {
    setProductsStatus("Saving...");
    const listValue = value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    updateRepo((current) => ({
      ...current,
      products: getRepoProducts(current).map((product) =>
        product.id === productId
          ? {
              ...product,
              [field]:
                field === "problemsSolved" ||
                field === "keyCapabilities" ||
                field === "useCases" ||
                field === "differentiators" ||
                field === "limitations" ||
                field === "supportingAssetIds"
                  ? listValue
                  : value,
              features: field === "keyCapabilities" ? listValue : product.features,
              benefits: field === "useCases" ? listValue : product.benefits,
              positioning: field === "differentiators" ? listValue.join("\n") : product.positioning,
            }
          : product,
      ),
    }));
  }

  function deleteProduct(productId: string) {
    setProductsStatus("Saving...");
    updateRepo((current) => ({
      ...current,
      products: getRepoProducts(current).filter((product) => product.id !== productId),
      approvedClaims: getRepoApprovedClaims(current).map((claim) =>
        claim.productId === productId
          ? {
              ...claim,
              appliesTo: "",
              productId: "",
            }
          : claim,
      ),
      messaging: current.messaging.map((message) => ({ ...message, claims: [] })),
    }));
  }

  function addApprovedClaim(status: ApprovedClaim["status"] = "Approved") {
    setApprovedClaimsStatus("Saving...");
    const claim = createApprovedClaim(status);
    updateRepo((current) => ({
      ...current,
      approvedClaims: [...getRepoApprovedClaims(current), claim],
      messaging: current.messaging.map((message) => ({ ...message, claims: [] })),
    }));
    return claim.id;
  }

  function updateApprovedClaimField(claimId: string, field: ApprovedClaimField, value: string) {
    setApprovedClaimsStatus("Saving...");
    updateRepo((current) => ({
      ...current,
      approvedClaims: getRepoApprovedClaims(current).map((claim) =>
        claim.id === claimId
          ? {
              ...claim,
              [field]: value,
              productId: field === "appliesTo" && value !== "Specific product" ? "" : field === "productId" ? value : claim.productId,
            }
          : claim,
      ),
      messaging: current.messaging.map((message) => ({ ...message, claims: [] })),
    }));
  }

  function deleteApprovedClaim(claimId: string) {
    setApprovedClaimsStatus("Saving...");
    updateRepo((current) => ({
      ...current,
      approvedClaims: getRepoApprovedClaims(current).filter((claim) => claim.id !== claimId),
      messaging: current.messaging.map((message) => ({ ...message, claims: [] })),
    }));
  }

  async function scanSectionUrl(url: string, tab: RepoKind) {
    setSectionScanUrl(url);
    setLastSectionScan(null);
    setImportError("");

    try {
      const response = await fetch("/api/import-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const payload = (await response.json()) as { importRun?: ImportRun; error?: string };

      if (!response.ok || !payload.importRun) {
        throw new Error(payload.error ?? "Unable to scan section URL.");
      }

      const sectionRun = payload.importRun;
      const importedSources: Source[] = sectionRun.sources.map((source) => ({
        id: createId("source-section"),
        label: source.title || source.url,
        type: "structured",
      }));
      const extracted = sectionRun.extractedContext;
      const importedAssets = extracted.assetUrls.map<Asset>((assetUrl) => ({
        id: createId("asset-section-url"),
        name: getNameFromUrl(assetUrl),
        type: classifyUpload(assetUrl),
        url: assetUrl,
        description: `${tab} asset discovered while scanning ${url}.`,
        metadata: ["section scan", tab.toLowerCase(), classifyUpload(assetUrl).toLowerCase()],
        uploadedAt: new Date().toISOString().slice(0, 10),
        sources: importedSources,
      }));
      const sectionUrls = mergeSectionUrls(sourceDocumentsToSectionUrls(sectionRun.sources), { [tab]: [url] });

      updateRepo((current) => ({
        ...current,
        brand: {
          ...current.brand,
          description: current.brand.description || extracted.brandDescription || `Imported ${tab.toLowerCase()} guidance from ${url}.`,
          voice: [...new Set([...current.brand.voice, ...extracted.voice])],
          rules: [...new Set([...current.brand.rules, ...extracted.rules])],
          approvedTerms: [...new Set([...current.brand.approvedTerms, ...extracted.approvedTerms])],
          prohibitedTerms: [...new Set([...current.brand.prohibitedTerms, ...extracted.prohibitedTerms])],
          sources: [...importedSources, ...current.brand.sources],
        },
        assets: [...importedAssets, ...current.assets],
        sectionUrls: mergeSectionUrls(current.sectionUrls, sectionUrls),
        activity: [`Scanned ${tab} source URL`, ...current.activity],
      }));
      setLastSectionScan({ tab, url });
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Unable to scan section URL.");
    } finally {
      setSectionScanUrl("");
    }
  }

  async function handleUpload(files: FileList | null, nextSection?: NavSection, options?: { repoTab?: RepoKind; assetTag?: string }) {
    if (!files?.length) return;

    try {
      setImportError("");
      if (supabase && currentUser) setSyncStatus("Uploading assets...");

      const fileList = Array.from(files);
      const markdownNotes = options?.repoTab
        ? (await Promise.all(fileList.filter((file) => isMarkdownFile(file.name)).map(async (file) => readFileAsText(file))))
            .map((value) => value.trim())
            .filter(Boolean)
        : [];
      const newAssets = await Promise.all(fileList.map<Promise<Asset>>(async (file) => {
        const source = { id: createId("source"), label: file.name, type: "upload" as const };
        const assetType = classifyUpload(file.name);
        const assetId = createId("asset");
        const metadata = ["uploaded", assetType.toLowerCase(), "source context"];
        if (options?.repoTab) metadata.push(options.repoTab.toLowerCase());
        if (options?.assetTag) metadata.push(options.assetTag.toLowerCase());
        let previewUrl = assetType === "Image" ? await readFileAsDataUrl(file) : undefined;
        let storagePath: string | undefined;

        if (supabase && currentUser && activeWorkspace) {
          storagePath = `${currentUser.id}/${activeWorkspace.id}/${assetId}-${safeStorageFileName(file.name)}`;
          const { error } = await supabase.storage.from(assetBucket).upload(storagePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

          if (error) {
            throw new Error(getStorageUploadErrorMessage(file.name, error.message));
          }

          const { data } = supabase.storage.from(assetBucket).getPublicUrl(storagePath);
          previewUrl = data.publicUrl;
        }

        return {
          id: assetId,
          name: file.name,
          type: assetType,
          url: previewUrl,
          storagePath,
          description: options?.repoTab
            ? `${options.assetTag ? `${options.assetTag} ` : ""}${options.repoTab} asset uploaded directly to this repo section.`
            : "Uploaded context ready for BrandRepo analysis. Prototype summary generated from filename and file type.",
          metadata,
          uploadedAt: new Date().toISOString().slice(0, 10),
          sources: [source],
        };
      }));

      updateRepo((current) => ({
        ...current,
        assets: [...newAssets, ...current.assets],
        sectionNotes: options?.repoTab && markdownNotes.length
          ? {
              ...(current.sectionNotes ?? {}),
              [options.repoTab]: [...new Set([...(current.sectionNotes?.[options.repoTab] ?? []), ...markdownNotes])],
            }
          : current.sectionNotes,
        brand: {
          ...current.brand,
          sources: [...newAssets.flatMap((asset) => asset.sources), ...current.brand.sources],
        },
        activity: [`Uploaded ${newAssets.length} new source asset${newAssets.length > 1 ? "s" : ""}`, ...current.activity],
      }));
      if (nextSection) setSection(nextSection);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to upload files.";
      setImportError(message);
      setSyncStatus(`Upload failed: ${message}`);
    }
  }

  function addSectionMarkdown(tab: RepoKind, markdown: string) {
    const note = markdown.trim();
    if (!note) return;

    const source: Source = {
      id: createId("source-md"),
      label: `${tab} markdown note`,
      type: "structured",
    };

    updateRepo((current) => ({
      ...current,
      sectionNotes: {
        ...(current.sectionNotes ?? {}),
        [tab]: [...new Set([...(current.sectionNotes?.[tab] ?? []), note])],
      },
      brand: {
        ...current.brand,
        sources: [source, ...current.brand.sources],
      },
      activity: [`Saved Markdown note to ${tab}`, ...current.activity],
    }));
  }

  function updateSectionMarkdown(tab: RepoKind, index: number, markdown: string) {
    const note = markdown.trim();
    if (!note) return;

    updateRepo((current) => {
      const currentNotes = current.sectionNotes?.[tab] ?? [];
      if (!currentNotes[index]) return current;

      return {
        ...current,
        sectionNotes: {
          ...(current.sectionNotes ?? {}),
          [tab]: currentNotes.map((item, itemIndex) => (itemIndex === index ? note : item)),
        },
        activity: [`Updated Markdown note in ${tab}`, ...current.activity],
      };
    });
  }

  function deleteSectionMarkdown(tab: RepoKind, index: number) {
    updateRepo((current) => {
      const currentNotes = current.sectionNotes?.[tab] ?? [];
      if (!currentNotes[index]) return current;

      return {
        ...current,
        sectionNotes: {
          ...(current.sectionNotes ?? {}),
          [tab]: currentNotes.filter((_item, itemIndex) => itemIndex !== index),
        },
        activity: [`Deleted Markdown note from ${tab}`, ...current.activity],
      };
    });
  }

  async function deleteAsset(assetId: string) {
    const asset = repo.assets.find((item) => item.id === assetId);

    if (asset?.storagePath && supabase && currentUser) {
      setSyncStatus("Deleting asset...");
      const { error } = await supabase.storage.from(assetBucket).remove([asset.storagePath]);
      if (error) {
        setImportError(`Unable to delete uploaded file: ${error.message}`);
        setSyncStatus("Delete failed");
        return;
      }
    }

    updateRepo((current) => ({
      ...current,
      assets: current.assets.filter((asset) => asset.id !== assetId),
      activity: ["Deleted extracted asset", ...current.activity],
    }));
  }

  function updateAssetDetails(assetId: string, field: "name" | "description", value: string) {
    setIdentityStatus("Saving...");
    updateRepo((current) => ({
      ...current,
      assets: current.assets.map((asset) => (asset.id === assetId ? { ...asset, [field]: value } : asset)),
    }));
  }

  async function saveGeneratedChatImage(message: ChatMessage) {
    if (!message.generatedImage || message.generatedImage.saved) return;

    const assetId = createId("generated-image");
    const source: Source = { id: createId("source-generated-image"), label: "Generated in BrandRepo Chat", type: "generated" };
    let imageUrl = message.generatedImage.dataUrl;
    let storagePath: string | undefined;

    try {
      if (supabase && currentUser && activeWorkspace) {
        setSyncStatus("Saving generated image...");
        const blob = await fetch(message.generatedImage.dataUrl).then((response) => response.blob());
        storagePath = `${currentUser.id}/${activeWorkspace.id}/${assetId}.png`;
        const { error } = await supabase.storage.from(assetBucket).upload(storagePath, blob, {
          cacheControl: "3600",
          contentType: "image/png",
          upsert: false,
        });

        if (error) {
          throw new Error(getStorageUploadErrorMessage("generated-image.png", error.message));
        }

        const { data } = supabase.storage.from(assetBucket).getPublicUrl(storagePath);
        imageUrl = data.publicUrl;
      }

      const generatedAsset: Asset = {
        id: assetId,
        name: "Generated ad mockup.png",
        type: "Image",
        url: imageUrl,
        storagePath,
        description: message.generatedImage.prompt,
        metadata: ["generated", "chat", "image", "ad mockup"],
        uploadedAt: new Date().toISOString().slice(0, 10),
        sources: [source],
      };

      updateRepo((current) => ({
        ...current,
        assets: [generatedAsset, ...current.assets],
        activity: ["Saved generated image from Chat", ...current.activity],
      }));
      updateChatMessages((current) =>
        current.map((item) =>
          item.id === message.id && item.generatedImage
            ? { ...item, generatedImage: { ...item.generatedImage, saved: true } }
            : item,
        ),
      );
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Unable to save generated image.");
      setSyncStatus("Save failed");
    }
  }

  async function sendChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = chatInput.trim();
    if (!prompt || chatStatus !== "idle") return;
    const userMessage: ChatMessage = { id: createId("user"), role: "user", text: chatInput.trim() };
    const history = chatMessages.filter((message) => message.id !== "welcome").slice(-8);
    updateChatMessages((current) => [...current.filter((message) => message.id !== "welcome"), userMessage]);
    setChatInput("");
    const isImageRequest = isImageGenerationPrompt(prompt);
    setChatStatus(isImageRequest ? "generating-image" : "thinking");

    try {
      const response = await fetch(isImageRequest ? "/api/chat-image" : "/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt,
          messages: history,
          repoContext: getRepoContext(activeWorkspace, { includeAssets: true }).markdown,
          referenceAssets: isImageRequest ? getImageGenerationReferences(repo) : [],
        }),
      });
      const payload = (await response.json()) as { answer?: string; imageDataUrl?: string; revisedPrompt?: string; error?: string };

      if (!response.ok || !payload.answer) {
        throw new Error(payload.error ?? "Unable to answer from the repo.");
      }

      const assistantMessage: ChatMessage = {
        id: createId("assistant"),
        role: "assistant",
        text: payload.answer,
        assetPreviews: payload.imageDataUrl ? [] : getChatAssetPreviews(prompt, repo),
        generatedImage: payload.imageDataUrl
          ? {
              dataUrl: payload.imageDataUrl,
              prompt: payload.revisedPrompt ?? prompt,
            }
          : undefined,
        citations: payload.imageDataUrl ? [] : repo.brand.sources.slice(0, 3),
      };
      updateChatMessages((current) => [...current, assistantMessage]);
    } catch (error) {
      const assistantMessage: ChatMessage = {
        id: createId("assistant-error"),
        role: "assistant",
        text:
          error instanceof Error
            ? error.message
            : "Unable to answer from the repo. Check the server logs and OpenAI API configuration.",
      };
      updateChatMessages((current) => [...current, assistantMessage]);
    } finally {
      setChatStatus("idle");
    }
  }

  return (
    <main className="app-shell" data-theme={theme}>
      <header className="mobile-app-header">
        <BrandRepoLogo />
        <button
          aria-expanded={mobileNavOpen}
          aria-label="Open navigation"
          className="hamburger-button"
          onClick={() => setMobileNavOpen(true)}
          type="button"
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
      </header>
      <button
        aria-label="Close navigation"
        className={`mobile-nav-backdrop ${mobileNavOpen ? "open" : ""}`}
        onClick={() => setMobileNavOpen(false)}
        type="button"
      />
      <aside className={`sidebar ${mobileNavOpen ? "open" : ""}`} aria-label="Primary navigation">
        <div className="brand-mark">
          <BrandRepoLogo />
        </div>
        <div className="workspace-switcher">
          <label className="repo-select account-select">
            <span className="select-label">Account</span>
            <select
              aria-label="Select account"
              value={activeAccount?.id ?? ""}
              onChange={(event) => handleAccountSelection(event.target.value)}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
            <span aria-hidden="true" />
          </label>
          <label className="repo-select">
            <span className="select-label">Repo</span>
            <select
              aria-label="Select repo"
              value={activeWorkspace?.id ?? ""}
              onChange={(event) => {
                handleRepoSelection(event.target.value);
                setMobileNavOpen(false);
              }}
            >
              {activeAccountWorkspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
              <option value="new-repo">New repo...</option>
            </select>
            <span aria-hidden="true" />
          </label>
        </div>
        <nav>
          {visibleNavItems.map((item) => (
            <div className="nav-group" key={item}>
              <div className="nav-row">
                <button
                  className={section === item ? "active" : ""}
                  onClick={() => {
                    if (item === "Repo") {
                      setSection("Repo");
                      setRepoOverviewActive(true);
                      setMobileNavOpen(false);
                      return;
                    }
                    if (item === "Overview") {
                      setSection("Overview");
                      setMobileNavOpen(false);
                      return;
                    }
                    setSection(item);
                    setMobileNavOpen(false);
                  }}
                >
                  <NavIcon item={item} />
                  <span>{item}</span>
                </button>
                {item === "Create" ? (
                  <button
                    aria-label="New Create"
                    className="nav-icon-button"
                    disabled={chatStatus !== "idle"}
                    onClick={startNewCreate}
                    title="New Create"
                    type="button"
                  >
                    <span aria-hidden="true" />
                  </button>
                ) : null}
              </div>
              {item === "Repo" && !isNewWorkspace && (
                <div className="repo-subnav">
                  {repoTabs.map((repoSection) => {
                    if (repoSection === "Identity") {
                      return (
                        <div className="repo-subnav-group" key={repoSection}>
                          <button
                            className={section === "Repo" && !repoOverviewActive && repoTab === repoSection ? "active" : ""}
                            onClick={() => {
                              showRepoSection(repoSection);
                              setIdentityExpanded((current) => !current);
                              setMobileNavOpen(false);
                            }}
                            type="button"
                          >
                            Identity
                          </button>
                          {identityExpanded && repoTab === "Identity" ? (
                            <div className="identity-rail-subnav">
                              {identitySections.map((identitySection) => (
                                <button
                                  className={section === "Repo" && identityField === identitySection.field ? "active" : ""}
                                  key={identitySection.field}
                                  onClick={() => {
                                    showRepoSection("Identity");
                                    setIdentityField(identitySection.field);
                                    setMobileNavOpen(false);
                                  }}
                                  type="button"
                                >
                                  {identitySection.label}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    }

                    return (
                      <button
                        className={section === "Repo" && !repoOverviewActive && repoTab === repoSection ? "active" : ""}
                        key={repoSection}
                        onClick={() => {
                          showRepoSection(repoSection);
                          setMobileNavOpen(false);
                        }}
                        type="button"
                      >
                        {repoSection}
                      </button>
                    );
                  })}
                  <button
                    className={section === "Assets" ? "active" : ""}
                    onClick={() => {
                      setSection("Assets");
                      setMobileNavOpen(false);
                    }}
                    type="button"
                  >
                    Assets
                  </button>
                </div>
              )}
            </div>
          ))}
        </nav>
        <nav className="rail-footer" aria-label="Account navigation">
          <button
            className={section === "Settings" ? "active" : ""}
            onClick={() => {
              setSection("Settings");
              setMobileNavOpen(false);
            }}
          >
            <NavIcon item="Settings" />
            <span>Settings</span>
          </button>
        </nav>
      </aside>

      <section className="workspace">
        {section === "Overview" && activeWorkspace ? (
          <OwnedPublicRepoOverview
            accountSlug={activeAccount?.slug || getAccountName(currentUser) || "account-name"}
            repoSlug={getRepoSlug(activeWorkspace)}
            workspace={activeWorkspace}
          />
        ) : null}

        {section === "Create" && (
          <section className="actions-page">
            <header className="actions-header">
              <h1>Create</h1>
              <p>
                Turn repo knowledge into better work. Each action creates a structured prompt for the app that should do the job.
              </p>
            </header>
            <div className="action-card-grid">
              {marketingActions.map((action) => (
                <button
                  className={action.enabled ? "action-card" : "action-card is-placeholder"}
                  disabled={!action.enabled}
                  key={action.id}
                  onClick={action.enabled ? openGammaPresentationDrawer : undefined}
                  type="button"
                >
                  <span className="action-app-logo">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt={`${action.appName} logo`} src={action.appLogo} />
                  </span>
                  <span>
                    <strong>{action.title}</strong>
                    <em>with {action.appName}</em>
                  </span>
                  <small>{action.description}</small>
                  {!action.enabled ? <small className="action-card-status">Coming soon</small> : null}
                </button>
              ))}
            </div>
            <section className={`actions-chat ${hasChatConversation ? "has-conversation" : "is-empty"}`}>
              {hasChatConversation ? (
                <div className="messages">
                  {chatMessages.filter((message) => message.id !== "welcome").map((message) => (
                    <article className={message.role} key={message.id}>
                      <p>{message.text}</p>
                      {message.generatedImage ? (
                        <div className="chat-generated-image">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img alt="Generated BrandRepo mockup" src={message.generatedImage.dataUrl} />
                          <button
                            className="small-action"
                            disabled={message.generatedImage.saved}
                            onClick={() => void saveGeneratedChatImage(message)}
                            type="button"
                          >
                            {message.generatedImage.saved ? "Saved to Assets" : "Save to Assets"}
                          </button>
                        </div>
                      ) : null}
                      {message.assetPreviews?.length ? (
                        <div className="chat-asset-previews">
                          {message.assetPreviews.map((asset) => (
                            <a className="chat-asset-preview" href={asset.url} key={`${message.id}-${asset.id}`} rel="noreferrer" target="_blank">
                              <span>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img alt={asset.name} src={asset.url} />
                              </span>
                              <strong>{asset.name}</strong>
                              {asset.description && !asset.metadata.includes("generated") ? <small>{asset.description}</small> : null}
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  ))}
                  {chatStatus !== "idle" ? (
                    <article className="assistant">
                      <p>{chatStatus === "generating-image" ? "Generating image..." : "Thinking..."}</p>
                    </article>
                  ) : null}
                </div>
              ) : null}
              <form className="chat-input" onSubmit={sendChat}>
                <input
                  disabled={chatStatus !== "idle"}
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder="Ask BrandRepo about your brand or what to create"
                  value={chatInput}
                />
                <button disabled={!chatInput.trim() || chatStatus !== "idle"} type="submit">
                  {chatStatus === "generating-image" ? "..." : chatStatus === "thinking" ? "..." : "Ask"}
                </button>
              </form>
            </section>
          </section>
        )}

        {section === "Repo" && (
          <div className="repo-view">
            {!repoOverviewActive ? (
              <header className="topbar repo-upload-header">
                <button className="secondary" onClick={() => openSectionMarkdownImportDrawer(repoTab)} type="button">
                  Upload .md
                </button>
              </header>
            ) : null}
            {isNewWorkspace ? (
              <EmptyState
                title="Set up this repo first"
                description="Add a repo name to start reviewing brand guideline sections."
              />
            ) : null}
            {importError && <p className="import-error">{importError}</p>}
            {!isNewWorkspace && repoOverviewActive ? (
              <RepoOverview
                onDeleteRepo={deleteActiveWorkspace}
                onSelectSection={(nextTab) => {
                  setRepoTab(nextTab);
                  setRepoOverviewActive(false);
                  if (nextTab === "Identity") {
                    setIdentityExpanded(true);
                  }
                }}
                publicUrl={getRepoCanonicalUrl(activeAccount?.slug || getAccountName(currentUser) || "account-name", getRepoSlug(activeWorkspace))}
                repo={repo}
              />
            ) : null}
            {!isNewWorkspace && !repoOverviewActive ? (
              <RepoPanel
                channelSeoStatus={channelSeoStatus}
                colorsStatus={colorsStatus}
                approvedClaimsStatus={approvedClaimsStatus}
                onAddApprovedClaim={addApprovedClaim}
                onAddProduct={addProduct}
                onDeleteApprovedClaim={deleteApprovedClaim}
                onScanSectionUrl={scanSectionUrl}
                onUpdateBrandBasics={updateBrandBasics}
                onAddColorToken={addColorToken}
                onDeleteColorToken={deleteColorToken}
                onDeleteProduct={deleteProduct}
                onOpenAssetDetails={openAssetDrawer}
                onUploadSectionAssets={(files, tab, assetTag) => void handleUpload(files, undefined, { repoTab: tab, assetTag })}
                onDeleteSectionMarkdown={deleteSectionMarkdown}
                onUpdateSectionMarkdown={updateSectionMarkdown}
                brandBasicsStatus={brandBasicsStatus}
                identityStatus={identityStatus}
                identityField={identityField}
                lastSectionScan={lastSectionScan}
                messagingStatus={messagingStatus}
                onViewMarkdown={openMarkdownDrawer}
                audiencesStatus={audiencesStatus}
                onUpdateAudienceField={updateAudienceField}
                onUpdateChannelSeoField={updateChannelSeoField}
                onUpdateIdentityField={updateIdentityField}
                onUpdateApprovedClaimField={updateApprovedClaimField}
                onUpdateProductField={updateProductField}
                onUpdateTypographyField={updateTypographyField}
                onUpdateColorRules={updateColorRules}
                onUpdateColorToken={updateColorToken}
                onUpdateMessagingField={updateMessagingField}
                onUpdateVoiceToneField={updateVoiceToneField}
                repo={repo}
                scanningUrl={sectionScanUrl}
                tab={repoTab}
                typographyStatus={typographyStatus}
                productsStatus={productsStatus}
                voiceToneStatus={voiceToneStatus}
              />
            ) : null}
          </div>
        )}

        {section === "Campaigns" && (
          <div className="campaign-list">
            {repo.campaigns.length ? repo.campaigns.map((campaign) => (
              <article className="campaign-detail" key={campaign.id}>
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">{campaign.status}</p>
                    <h2>{campaign.name}</h2>
                  </div>
                  <span>{campaign.audience}</span>
                </div>
                <p>{campaign.brief}</p>
                <dl>
                  <div>
                    <dt>Goal</dt>
                    <dd>{campaign.goal}</dd>
                  </div>
                  <div>
                    <dt>Messaging</dt>
                    <dd>{campaign.messaging.join(" ")}</dd>
                  </div>
                  <div>
                    <dt>Generated content</dt>
                    <dd>{campaign.content.join("\n\n")}</dd>
                  </div>
                  <div>
                    <dt>Learnings</dt>
                    <dd>{campaign.learnings}</dd>
                  </div>
                </dl>
              </article>
            )) : <EmptyState title="No campaigns yet" description="Saved generated content and campaign concepts will appear here." />}
          </div>
        )}

        {section === "Connected Apps" && (
          <section className="connected-apps-page">
            <header className="connected-apps-header">
              <h1>Connected Apps</h1>
              <p>
                Connect BrandRepo to the tools where marketing work happens so approved messaging, voice, identity assets, colors, and repo markdown travel with the work.
              </p>
            </header>
            {oauthConnectionError ? <p className="import-error">{oauthConnectionError}</p> : null}
            {externalConnectionError ? <p className="import-error">{externalConnectionError}</p> : null}
            <section className="recommended-apps">
              <div className="recommended-app-grid">
                {recommendedAppCards.map((app) => (
                  <article className={app.connectionRecord || app.externalConnectionRecord ? "app-card connected" : "app-card"} key={app.name}>
                    <div className="app-card-header">
                      <span className="app-logo">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img alt={`${app.name} logo`} src={app.logo} />
                      </span>
                      <span className={app.connectionRecord || app.externalConnectionRecord ? "connection-badge connected" : "connection-badge"}>
                        {app.connectionRecord || app.externalConnectionRecord ? "Connected" : "Not connected"}
                      </span>
                    </div>
                    <div className="app-card-body">
                      <h3>{app.name}</h3>
                      <p>{app.description}</p>
                    </div>
                    <div className="app-card-footer">
                      {app.externalConnectionRecord ? (
                        <>
                          <small>{app.externalConnectionRecord.name}</small>
                          <button
                            className="danger-secondary"
                            disabled={externalConnectionStatus === "revoking"}
                            onClick={() => revokeExternalConnection(app.externalConnectionRecord?.provider ?? "")}
                            type="button"
                          >
                            Revoke
                          </button>
                        </>
                      ) : app.name === "Gamma" ? (
                        <button
                          className="app-connect-pill"
                          disabled={externalConnectionStatus === "saving"}
                          onClick={() => {
                            setGammaApiKeyDraft("");
                            setExternalConnectionError("");
                            setGammaApiKeyModalOpen(true);
                          }}
                          type="button"
                        >
                          Connect Gamma
                        </button>
                      ) : app.connectionRecord ? (
                        <>
                          <small>
                            {app.connectionRecord.lastUsedAt
                              ? `Last used ${new Date(app.connectionRecord.lastUsedAt).toLocaleDateString()}`
                              : "Connected to BrandRepo"}
                          </small>
                          <button
                            className="danger-secondary"
                            disabled={oauthConnectionStatus === "revoking"}
                            onClick={() => revokeOAuthConnection(app.connectionRecord?.clientId ?? "")}
                            type="button"
                          >
                            Revoke
                          </button>
                        </>
                      ) : (
                        <button className="app-connect-pill" onClick={() => setConnectGuideAppName(app.name)} type="button">
                          How to Connect
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </section>
        )}

        {section === "Assets" && (
          <div className="assets-view">
            <section className="asset-upload-band">
              <div>
                <p className="eyebrow">File upload interface</p>
                <h2>Add marketing source material</h2>
                <p>Uploaded files become source-backed assets for your Marketing Repo.</p>
              </div>
              <label>
                Select files
                <input multiple onChange={(event) => handleUpload(event.target.files, "Assets")} type="file" />
              </label>
            </section>
            <section className="asset-grid">
              {visibleAssets.length ? visibleAssets.map((asset) => (
                <AssetCard asset={asset} key={asset.id} onOpenDetails={openAssetDrawer} />
              )) : <EmptyState title="No assets yet" description="Uploaded brand guides, decks, documents, images, and other source material will appear here." />}
            </section>
          </div>
        )}

        {section === "Admin" && isPlatformAdmin(currentUser) ? (
          <section className="admin-page">
            <header className="admin-hero">
              <div>
                <h1>Admin</h1>
                <p>Create customer accounts, prepare their repos, and invite their team when the setup is ready.</p>
              </div>
              <button className="secondary admin-refresh" disabled={adminStatus === "loading"} onClick={loadAdminAccounts} type="button">
                {adminStatus === "loading" ? "Loading..." : "Refresh"}
              </button>
            </header>
            {adminError ? (
              <aside className="admin-alert" role="status">
                <strong>Admin setup needed</strong>
                <span>{adminError}</span>
              </aside>
            ) : null}
            {adminStatus === "success" ? <p className="admin-success">Done.</p> : null}
            <section className="admin-grid">
              <form className="admin-card" onSubmit={createCustomerAccount}>
                <div className="admin-card-header">
                  <span>01</span>
                  <div>
                    <p className="eyebrow">Customer account</p>
                    <h2>Create account and repo</h2>
                    <p>Create the customer org and a starter repo you can fill in before inviting them.</p>
                  </div>
                </div>
                <div className="admin-form-fields">
                  <label>
                    Account name
                    <input
                      onChange={(event) => setAdminAccountName(event.target.value)}
                      placeholder="Acme"
                      required
                      value={adminAccountName}
                    />
                    <span className="form-note">The public account slug is generated from this name.</span>
                  </label>
                </div>
                <div className="admin-card-actions">
                  <button disabled={adminStatus === "creating"} type="submit">
                    {adminStatus === "creating" ? "Creating..." : "Create account"}
                  </button>
                </div>
              </form>
              <form className="admin-card" onSubmit={inviteCustomerAdmin}>
                <div className="admin-card-header">
                  <span>02</span>
                  <div>
                    <p className="eyebrow">Customer invite</p>
                    <h2>Invite customer admin</h2>
                    <p>Invite the customer after the repo is ready. They can edit every repo in their account.</p>
                  </div>
                </div>
                <div className="admin-form-fields">
                  <label>
                    Account
                    <select
                      onChange={(event) => setAdminInviteAccountId(event.target.value)}
                      required
                      value={adminInviteAccountId}
                    >
                      <option value="">Select account</option>
                      {adminAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Email
                    <input
                      onChange={(event) => setAdminInviteEmail(event.target.value)}
                      placeholder="customer@example.com"
                      required
                      type="email"
                      value={adminInviteEmail}
                    />
                  </label>
                </div>
                <div className="admin-card-actions">
                  <button disabled={adminStatus === "inviting"} type="submit">
                    {adminStatus === "inviting" ? "Sending..." : "Send invite"}
                  </button>
                </div>
              </form>
            </section>
            <section className="admin-account-list">
              <div className="section-heading">
                <div>
                  <h2>Customer accounts</h2>
                  <p>Accounts you manage as platform admin.</p>
                </div>
              </div>
              {adminAccounts.length ? (
                <div className="admin-account-stack">
                  {adminAccounts.map((account) => (
                    <article className="admin-account-row" key={account.id}>
                      <div>
                        <h3>{account.name}</h3>
                        <p>brandrepo.dev/{account.slug}</p>
                      </div>
                      <dl>
                        <div>
                          <dt>Repos</dt>
                          <dd>{account.brandhub_workspaces?.length ?? 0}</dd>
                        </div>
                        <div>
                          <dt>Members</dt>
                          <dd>{account.brandrepo_account_memberships?.length ?? 0}</dd>
                        </div>
                        <div>
                          <dt>Invites</dt>
                          <dd>{account.brandrepo_account_invites?.length ?? 0}</dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState title="No customer accounts yet" description="Create a customer account to start setting up repos for them." />
              )}
            </section>
          </section>
        ) : null}

        {section === "Settings" && (
          <section className="settings-page">
            <header className="topbar">
              <div>
                <p>Account</p>
                <h1>Settings</h1>
              </div>
            </header>
            <section className="settings-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Account settings</p>
                  <h2>Account</h2>
                </div>
              </div>
              <section className="settings-block">
                <div>
                  <h3>Appearance</h3>
                  <p>Choose how BrandRepo appears on this device.</p>
                </div>
                <div className="theme-toggle" role="group" aria-label="Theme">
                  <button className={theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")} type="button">
                    Dark
                  </button>
                  <button className={theme === "light" ? "active" : ""} onClick={() => setTheme("light")} type="button">
                    Light
                  </button>
                </div>
              </section>
              <dl className="settings-list">
                <div>
                  <dt>Account name</dt>
                  <dd>{getAccountName(currentUser) || "Not set"}</dd>
                </div>
                <div>
                  <dt>Account URL</dt>
                  <dd>brandrepo.dev/{getAccountName(currentUser) || "account-name"}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{currentUser?.email ?? "Not signed in"}</dd>
                </div>
                <div>
                  <dt>Repo sync</dt>
                  <dd>{syncStatus}</dd>
                </div>
                <div>
                  <dt>Database</dt>
                  <dd>{isSupabaseConfigured ? "Supabase configured" : "Supabase env vars missing"}</dd>
                </div>
                <div>
                  <dt>Repos</dt>
                  <dd>{pluralize(workspaces.length, "repo")}</dd>
                </div>
              </dl>
              {isSupabaseConfigured && currentUser ? (
                <form className="settings-form" onSubmit={submitAccountSettings}>
                  <label>
                    Account name
                    <input
                      autoComplete="username"
                      onChange={(event) => {
                        setSettingsAccountName(normalizeAccountName(event.target.value));
                        setSettingsStatus("idle");
                        setSettingsError("");
                      }}
                      placeholder="dzuy"
                      required
                      value={settingsAccountName}
                    />
                  </label>
                  <p className="form-note">
                    Use lowercase letters, numbers, and hyphens. This will become brandrepo.dev/{settingsAccountName || "account-name"}.
                  </p>
                  <button disabled={settingsStatus === "saving"} type="submit">
                    {settingsStatus === "saving" ? "Saving..." : "Save account name"}
                  </button>
                  {settingsStatus === "success" && <span className="success-text">Account name saved.</span>}
                  {settingsError && <span className="error-text">{settingsError}</span>}
                </form>
              ) : null}
              {isSupabaseConfigured && currentUser ? (
                <section className="settings-block developer-settings-block">
                  <button
                    className="developer-settings-toggle"
                    aria-expanded={developerSettingsOpen}
                    onClick={() => setDeveloperSettingsOpen((current) => !current)}
                    type="button"
                  >
                    <span>
                      <strong>Advanced developer settings</strong>
                      <small>Testing tokens for local debugging. Production connectors should use OAuth.</small>
                    </span>
                    <span aria-hidden="true">{developerSettingsOpen ? "Hide" : "Show"}</span>
                  </button>

                  {developerSettingsOpen ? (
                    <div className="developer-settings-content">
                      <section className="settings-block settings-token-block">
                        <div>
                          <h3>Developer token</h3>
                          <p>Temporary local testing token for read-only API and MCP calls. Treat it like a password.</p>
                        </div>
                        <div className="developer-token-actions">
                          <button disabled={developerTokenStatus === "loading"} onClick={refreshDeveloperToken} type="button">
                            {developerTokenStatus === "loading" ? "Loading..." : developerToken ? "Refresh token" : "Show token"}
                          </button>
                          {developerToken ? (
                            <button className="secondary" onClick={copyDeveloperToken} type="button">
                              Copy
                            </button>
                          ) : null}
                          {developerToken ? (
                            <button
                              className="secondary"
                              onClick={() => {
                                setDeveloperTokenVisible((current) => !current);
                                setDeveloperTokenStatus("idle");
                                setDeveloperTokenError("");
                              }}
                              type="button"
                            >
                              {developerTokenVisible ? "Hide" : "Show"}
                            </button>
                          ) : null}
                        </div>
                        {developerToken ? (
                          <textarea
                            className="developer-token-field"
                            readOnly
                            value={developerTokenVisible ? developerToken : "Token hidden. Use Copy or Show when needed."}
                          />
                        ) : null}
                        <p className="form-note">Use this as an `Authorization: Bearer ...` token while testing locally.</p>
                        {developerTokenStatus === "copied" && <span className="success-text">Token copied.</span>}
                        {developerTokenError && <span className="error-text">{developerTokenError}</span>}
                      </section>

                      <section className="settings-block integration-token-block">
                        <div>
                          <h3>Integration tokens</h3>
                          <p>Developer-only read tokens for curl and MCP Inspector. New tokens are shown once.</p>
                        </div>
                        <label>
                          Token name
                          <input
                            onChange={(event) => setIntegrationTokenName(event.target.value)}
                            placeholder="MCP Inspector"
                            value={integrationTokenName}
                          />
                        </label>
                        <div className="developer-token-actions">
                          <button disabled={integrationTokenStatus === "creating"} onClick={createIntegrationToken} type="button">
                            {integrationTokenStatus === "creating" ? "Creating..." : "Create token"}
                          </button>
                          <button className="secondary" disabled={integrationTokenStatus === "loading"} onClick={loadIntegrationTokens} type="button">
                            {integrationTokenStatus === "loading" ? "Loading..." : "Refresh list"}
                          </button>
                        </div>
                        {newIntegrationTokenSecret ? (
                          <div className="integration-token-secret">
                            <p>Copy this token now. BrandRepo will not show it again.</p>
                            <textarea className="developer-token-field" readOnly value={newIntegrationTokenSecret} />
                            <button className="secondary" onClick={copyIntegrationTokenSecret} type="button">
                              Copy new token
                            </button>
                          </div>
                        ) : null}
                        <div className="integration-token-list">
                          {integrationTokens.length ? (
                            integrationTokens.map((token) => (
                              <article key={token.id}>
                                <div>
                                  <strong>{token.name}</strong>
                                  <span>{token.tokenPrefix}...</span>
                                  <small>
                                    {token.scopes.join(", ")} · Created {new Date(token.createdAt).toLocaleDateString()}
                                    {token.lastUsedAt ? ` · Last used ${new Date(token.lastUsedAt).toLocaleDateString()}` : ""}
                                    {token.revokedAt ? " · Revoked" : ""}
                                  </small>
                                </div>
                                {!token.revokedAt ? (
                                  <button className="danger-secondary" onClick={() => revokeIntegrationToken(token.id)} type="button">
                                    Revoke
                                  </button>
                                ) : null}
                              </article>
                            ))
                          ) : (
                            <p>No developer integration tokens yet.</p>
                          )}
                        </div>
                        <p className="form-note">
                          Use these only for local testing with `Authorization: Bearer ...` against `https://www.brandrepo.dev/api/mcp`.
                        </p>
                        {integrationTokenStatus === "copied" && <span className="success-text">Token copied.</span>}
                        {integrationTokenError && <span className="error-text">{integrationTokenError}</span>}
                      </section>
                    </div>
                  ) : null}
                </section>
              ) : null}
              {isSupabaseConfigured ? (
                <button className="danger-secondary" onClick={signOut} type="button">
                  Sign out
                </button>
              ) : null}
            </section>
          </section>
        )}
      </section>
      {markdownDrawerSection ? (
        <MarkdownDrawer
          fileName={markdownDrawerFileName}
          isOpen={markdownDrawerOpen}
          markdown={markdownDrawerContent}
          onClose={closeMarkdownDrawer}
          section={markdownDrawerSection}
        />
      ) : null}
      {newRepoModalOpen ? (
        <NewRepoModal
          name={newRepoName}
          onChange={setNewRepoName}
          onClose={closeNewRepoModal}
          onSubmit={submitNewRepo}
        />
      ) : null}
      {connectGuideApp ? <AppConnectModal app={connectGuideApp} onClose={() => setConnectGuideAppName(null)} /> : null}
      {gammaApiKeyModalOpen ? (
        <GammaApiKeyModal
          apiKey={gammaApiKeyDraft}
          error={externalConnectionError}
          isSaving={externalConnectionStatus === "saving"}
          onChangeApiKey={setGammaApiKeyDraft}
          onClose={() => {
            setGammaApiKeyModalOpen(false);
            setGammaApiKeyDraft("");
          }}
          onSubmit={saveGammaApiKey}
        />
      ) : null}
      {messagingImportDrawerMounted ? (
        <SectionMarkdownImportDrawer
          isOpen={messagingImportDrawerOpen}
          markdown={messagingImportDraft}
          onChange={setMessagingImportDraft}
          onClose={closeMessagingImportDrawer}
          onSave={saveSectionMarkdownImport}
          section={markdownImportSection}
        />
      ) : null}
      {selectedAsset ? (
        <AssetDetailsDrawer
          asset={selectedAsset}
          isOpen={assetDrawerOpen}
          onClose={closeAssetDrawer}
          onDelete={(assetId) => {
            deleteAsset(assetId);
            closeAssetDrawer();
          }}
          onUpdate={updateAssetDetails}
        />
      ) : null}
      {gammaDrawerMounted ? (
        <GammaPresentationDrawer
          brandName={repo.company.name || activeWorkspace?.name || "Untitled brand"}
          error={gammaError}
          isOpen={gammaDrawerOpen}
          onBackToCreate={closeGammaPresentationDrawer}
          onCancel={closeGammaPresentationDrawer}
          onChangePrompt={setGammaPrompt}
          onSubmit={submitGammaPresentation}
          prompt={gammaPrompt}
          result={gammaResult}
          status={gammaStatus}
        />
      ) : null}
    </main>
  );
}

function RepoPanel({
  approvedClaimsStatus,
  audiencesStatus,
  brandBasicsStatus,
  channelSeoStatus,
  colorsStatus,
  identityField,
  identityStatus,
  lastSectionScan,
  messagingStatus,
  onAddApprovedClaim,
  onAddColorToken,
  onAddProduct,
  onDeleteApprovedClaim,
  onDeleteColorToken,
  onDeleteProduct,
  onDeleteSectionMarkdown,
  onOpenAssetDetails,
  onScanSectionUrl,
  onUpdateApprovedClaimField,
  onUpdateAudienceField,
  onUpdateBrandBasics,
  onUpdateChannelSeoField,
  onUpdateColorRules,
  onUpdateColorToken,
  onUpdateIdentityField,
  onUpdateMessagingField,
  onUpdateProductField,
  onUpdateSectionMarkdown,
  onUpdateTypographyField,
  onUpdateVoiceToneField,
  onUploadSectionAssets,
  onViewMarkdown,
  repo,
  scanningUrl,
  tab,
  productsStatus,
  typographyStatus,
  voiceToneStatus,
}: {
  approvedClaimsStatus: string;
  audiencesStatus: string;
  brandBasicsStatus: string;
  channelSeoStatus: string;
  colorsStatus: string;
  identityField: IdentityField;
  identityStatus: string;
  lastSectionScan: { tab: RepoKind; url: string } | null;
  messagingStatus: string;
  onAddApprovedClaim: (status?: ApprovedClaim["status"]) => string;
  onAddColorToken: () => void;
  onAddProduct: () => string;
  onDeleteApprovedClaim: (claimId: string) => void;
  onDeleteColorToken: (colorId: string) => void;
  onDeleteProduct: (productId: string) => void;
  onDeleteSectionMarkdown: (tab: RepoKind, index: number) => void;
  onOpenAssetDetails: (assetId: string) => void;
  onScanSectionUrl: (url: string, tab: RepoKind) => void;
  onUpdateApprovedClaimField: (claimId: string, field: ApprovedClaimField, value: string) => void;
  onUpdateAudienceField: (field: keyof AudienceSettings, value: string) => void;
  onUpdateBrandBasics: (field: "name" | "website" | "description" | "about", value: string) => void;
  onUpdateChannelSeoField: (field: keyof ChannelSeoSettings, value: string) => void;
  onUpdateColorRules: (value: string) => void;
  onUpdateColorToken: (colorId: string, field: "name" | "hex" | "description", value: string) => void;
  onUpdateIdentityField: (field: IdentityField, value: string) => void;
  onUpdateMessagingField: (field: MessagingField, value: string) => void;
  onUpdateProductField: (productId: string, field: ProductField, value: string) => void;
  onUpdateSectionMarkdown: (tab: RepoKind, index: number, markdown: string) => void;
  onUpdateTypographyField: (field: TypographyField, value: string) => void;
  onUpdateVoiceToneField: (field: VoiceToneField, value: string) => void;
  onUploadSectionAssets: (files: FileList | null, tab: RepoKind, assetTag?: string) => void;
  onViewMarkdown: (tab: RepoKind) => void;
  repo: RepoState;
  scanningUrl: string;
  tab: RepoKind;
  productsStatus: string;
  typographyStatus: string;
  voiceToneStatus: string;
}) {
  const [fieldEditTarget, setFieldEditTarget] = useState<{ section: RepoKind; field: string } | null>(null);
  const [fieldEditDrawerOpen, setFieldEditDrawerOpen] = useState(false);
  const [productDrawerProductId, setProductDrawerProductId] = useState<string | null>(null);
  const [productDrawerOpen, setProductDrawerOpen] = useState(false);
  const [claimDrawerClaimId, setClaimDrawerClaimId] = useState<string | null>(null);
  const [claimDrawerOpen, setClaimDrawerOpen] = useState(false);
  const sectionUrls = getRepoSectionUrls(repo, tab);
  const sectionNotes = getRepoSectionNotes(repo, tab);
  const notes = (
    <SectionNotes
      notes={sectionNotes}
      onDelete={(index) => onDeleteSectionMarkdown(tab, index)}
      onUpdate={(index, markdown) => onUpdateSectionMarkdown(tab, index, markdown)}
    />
  );
  const visualAssets = repo.assets.filter((asset) => {
    const haystack = `${asset.name} ${asset.description} ${asset.metadata.join(" ")}`.toLowerCase();
    if (tab === "Identity") {
      return (
        haystack.includes("logo") ||
        haystack.includes("logotype") ||
        haystack.includes("wordmark") ||
        haystack.includes("icon") ||
        haystack.includes("symbol") ||
        haystack.includes("element") ||
        haystack.includes("pattern") ||
        haystack.includes("graphic") ||
        haystack.includes("illustration")
      );
    }
    if (tab === "Imagery") {
      const metadata = asset.metadata.join(" ").toLowerCase();
      const isIdentityAsset =
        metadata.includes("identity") ||
        ["logo", "logotype", "wordmark", "icon", "symbol", "favicon", "element", "pattern", "graphic", "illustration"].some((term) =>
          haystack.includes(term),
        );
      return !isIdentityAsset && (metadata.includes("imagery") || metadata.includes("photo") || haystack.includes("photo") || haystack.includes("imagery"));
    }
    return false;
  });
  const rulesForTab = repo.brand.rules.filter((rule) => {
    const normalized = rule.toLowerCase();
    if (tab === "Colors") return normalized.includes("color") || normalized.includes("colour") || normalized.includes("#");
    if (tab === "Typography") return normalized.includes("type") || normalized.includes("font") || normalized.includes("typography");
    if (tab === "Identity") {
      return (
        normalized.includes("logo") ||
        normalized.includes("wordmark") ||
        normalized.includes("logotype") ||
        normalized.includes("icon") ||
        normalized.includes("symbol") ||
        normalized.includes("pictogram") ||
        normalized.includes("illustration") ||
        normalized.includes("element") ||
        normalized.includes("mascot") ||
        normalized.includes("shape") ||
        normalized.includes("duo")
      );
    }
    if (tab === "Imagery") return normalized.includes("photo") || normalized.includes("image") || normalized.includes("imagery");
    return false;
  });

  function openFieldEditor(section: RepoKind, field: string) {
    setFieldEditTarget({ section, field });
    window.setTimeout(() => setFieldEditDrawerOpen(true), 0);
  }

  function closeFieldEditor() {
    setFieldEditDrawerOpen(false);
    window.setTimeout(() => setFieldEditTarget(null), drawerAnimationMs);
  }

  function openProductEditor(productId: string) {
    setProductDrawerProductId(productId);
    setProductDrawerOpen(false);
    window.setTimeout(() => setProductDrawerOpen(true), 0);
  }

  function closeProductEditor() {
    setProductDrawerOpen(false);
    window.setTimeout(() => setProductDrawerProductId(null), drawerAnimationMs);
  }

  function openClaimEditor(claimId: string) {
    setClaimDrawerClaimId(claimId);
    setClaimDrawerOpen(false);
    window.setTimeout(() => setClaimDrawerOpen(true), 0);
  }

  function closeClaimEditor() {
    setClaimDrawerOpen(false);
    window.setTimeout(() => setClaimDrawerClaimId(null), drawerAnimationMs);
  }

  if (tab === "Brand Basics") {
    return (
      <section className="repo-panel">
        <RepoSectionHeader
          className="prominent-section-header"
          fileName={sectionMarkdownFileName(tab)}
          hideFileName
          hideViewMarkdown
          onViewMarkdown={() => onViewMarkdown(tab)}
          title="Brand Basics"
        />
        <div className="basic-fields">
          <label>
            Brand name
            <input
              onChange={(event) => onUpdateBrandBasics("name", event.target.value)}
              value={repo.company.name}
            />
          </label>
          <label>
            Website URL
            <input
              onChange={(event) => onUpdateBrandBasics("website", event.target.value)}
              value={repo.company.website}
            />
          </label>
          <label>
            One-line description
            <input
              onChange={(event) => onUpdateBrandBasics("description", event.target.value)}
              value={repo.company.description}
            />
          </label>
          <label>
            Short About paragraph
            <textarea
              onChange={(event) => onUpdateBrandBasics("about", event.target.value)}
              value={repo.brand.description}
            />
          </label>
          <p className="autosave-status">{brandBasicsStatus}</p>
        </div>
      </section>
    );
  }

  if (tab === "Identity") {
    const identity = getRepoIdentity(repo);
    const activeIdentitySection = identitySections.find((section) => section.field === identityField) ?? identitySections[0];
    const logoAssets = visualAssets.filter((asset) => {
      const metadata = asset.metadata.join(" ").toLowerCase();
      return metadata.includes("logo");
    });
    const iconAssets = visualAssets.filter((asset) => {
      const metadata = asset.metadata.join(" ").toLowerCase();
      return metadata.includes("icon");
    });
    const elementAssets = visualAssets.filter((asset) => {
      const metadata = asset.metadata.join(" ").toLowerCase();
      return metadata.includes("element");
    });

    return (
      <section className="repo-panel">
        <RepoSectionHeader
          className="prominent-section-header"
          fileName={sectionMarkdownFileName(tab)}
          hideFileName
          hideViewMarkdown
          onViewMarkdown={() => onViewMarkdown(tab)}
          title="Identity"
        />
        <div className="identity-editor">
          {identityField === "logos" ? (
            <section className="identity-assets">
              <label className="logo-upload">
                <span>Logo files</span>
                <strong>Select SVG, PNG, JPG, or WebP files</strong>
                <input
                  accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp"
                  multiple
                  onChange={(event) => onUploadSectionAssets(event.target.files, "Identity", "logo")}
                  type="file"
                />
              </label>
              {logoAssets.length ? (
                <section className="object-list asset-list">
                  {logoAssets.map((asset) => (
                    <AssetCard
                      asset={asset}
                      compact
                      key={asset.id}
                      onOpenDetails={onOpenAssetDetails}
                    />
                  ))}
                </section>
              ) : null}
            </section>
          ) : null}
          {identityField === "icons" ? (
            <section className="identity-assets">
              <label className="logo-upload">
                <span>Icon files</span>
                <strong>Select SVG, PNG, JPG, or WebP files</strong>
                <input
                  accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp"
                  multiple
                  onChange={(event) => onUploadSectionAssets(event.target.files, "Identity", "icon")}
                  type="file"
                />
              </label>
              {iconAssets.length ? (
                <section className="object-list asset-list">
                  {iconAssets.map((asset) => (
                    <AssetCard
                      asset={asset}
                      compact
                      key={asset.id}
                      onOpenDetails={onOpenAssetDetails}
                    />
                  ))}
                </section>
              ) : null}
            </section>
          ) : null}
          {identityField === "elements" ? (
            <section className="identity-assets">
              <label className="logo-upload">
                <span>Element files</span>
                <strong>Select SVG, PNG, JPG, or WebP files</strong>
                <input
                  accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp"
                  multiple
                  onChange={(event) => onUploadSectionAssets(event.target.files, "Identity", "element")}
                  type="file"
                />
              </label>
              {elementAssets.length ? (
                <section className="object-list asset-list">
                  {elementAssets.map((asset) => (
                    <AssetCard
                      asset={asset}
                      compact
                      key={asset.id}
                      onOpenDetails={onOpenAssetDetails}
                    />
                  ))}
                </section>
              ) : null}
            </section>
          ) : null}
          <label>
            {identityField === "logos" ? "Rules" : activeIdentitySection.label}
            <textarea
              onChange={(event) => onUpdateIdentityField(identityField, event.target.value)}
              value={identity[identityField]}
            />
          </label>
          <p className="autosave-status">{identityStatus}</p>
        </div>
      </section>
    );
  }

  if (tab === "Imagery") {
    return (
      <section className="repo-panel">
        <RepoSectionHeader
          className="prominent-section-header"
          fileName={sectionMarkdownFileName(tab)}
          hideFileName
          hideViewMarkdown
          onViewMarkdown={() => onViewMarkdown(tab)}
          title={tab}
        />
        <section className="identity-assets">
          <label className="logo-upload">
            <span>Imagery files</span>
            <strong>Select photography or image files</strong>
            <input
              accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
              multiple
              onChange={(event) => onUploadSectionAssets(event.target.files, "Imagery", "imagery")}
              type="file"
            />
          </label>
          {visualAssets.length ? (
            <section className="object-list asset-list">
              {visualAssets.map((asset) => (
                <AssetCard asset={asset} compact key={asset.id} onOpenDetails={onOpenAssetDetails} />
              ))}
            </section>
          ) : null}
        </section>
        <SectionSources lastSectionScan={lastSectionScan} onScanSectionUrl={onScanSectionUrl} scanningUrl={scanningUrl} tab={tab} urls={sectionUrls} />
        {notes}
        {rulesForTab.length ? (
          <Field label="Usage guidance" values={rulesForTab} />
        ) : null}
      </section>
    );
  }

  if (tab === "Colors") {
    const colors = getRepoColors(repo);

    return (
      <section className="repo-panel">
        <RepoSectionHeader
          className="prominent-section-header"
          fileName={sectionMarkdownFileName(tab)}
          hideFileName
          hideViewMarkdown
          onViewMarkdown={() => onViewMarkdown(tab)}
          title="Colors"
        />
        <div className="color-section">
          <div className="color-list">
            {colors.map((color) => {
              const hasPreview = isCompleteHexColor(color.hex);

              return (
                <article className="color-card" key={color.id}>
                  <div
                    aria-label={hasPreview ? `${color.name || "Color"} preview ${color.hex}` : "Color preview"}
                    className="color-preview"
                    style={{ backgroundColor: hasPreview ? color.hex : undefined }}
                  />
                  <div className="color-card-fields">
                    <label>
                      Name
                      <input
                        onChange={(event) => onUpdateColorToken(color.id, "name", event.target.value)}
                        placeholder="Primary"
                        value={color.name}
                      />
                    </label>
                    <label>
                      Hex value
                      <input
                        inputMode="text"
                        onChange={(event) => onUpdateColorToken(color.id, "hex", event.target.value)}
                        placeholder="#0057ff"
                        value={color.hex}
                      />
                    </label>
                    <label>
                      Description
                      <textarea
                        onChange={(event) => onUpdateColorToken(color.id, "description", event.target.value)}
                        placeholder="Describe where this color should be used."
                        value={color.description}
                      />
                    </label>
                  </div>
                  <button className="danger-secondary icon-action" onClick={() => onDeleteColorToken(color.id)} type="button">
                    Delete
                  </button>
                </article>
              );
            })}
          </div>
          <button className="secondary" onClick={onAddColorToken} type="button">
            Add color
          </button>
          <label>
            Rules
            <textarea
              onChange={(event) => onUpdateColorRules(event.target.value)}
              placeholder="Describe color usage rules, contrast guidance, accessibility notes, or restrictions."
              value={getRepoColorRules(repo)}
            />
          </label>
          <p className="autosave-status">{colorsStatus}</p>
        </div>
      </section>
    );
  }

  if (tab === "Voice & Tone") {
    const voiceToneFields: { field: VoiceToneField; label: string; value: string }[] = [
      { field: "voiceCharacteristics", label: "Voice characteristics", value: repo.brand.voice.join("\n") },
      { field: "writingRules", label: "Writing rules", value: repo.brand.rules.join("\n") },
      { field: "wordsToUse", label: "Words/phrases to use", value: repo.brand.approvedTerms.join("\n") },
      { field: "wordsToAvoid", label: "Words/phrases to avoid", value: repo.brand.prohibitedTerms.join("\n") },
    ];
    const activeVoiceToneField =
      fieldEditTarget?.section === "Voice & Tone" ? voiceToneFields.find((field) => field.field === fieldEditTarget.field) ?? null : null;

    return (
      <section className="repo-panel">
        <RepoSectionHeader
          className="prominent-section-header"
          fileName={sectionMarkdownFileName(tab)}
          hideFileName
          hideViewMarkdown
          onViewMarkdown={() => onViewMarkdown(tab)}
          title="Voice & Tone"
        />
        <div className="read-fields">
          {voiceToneFields.map((field) => (
            <ReadFieldCard
              key={field.field}
              label={field.label}
              onEdit={() => openFieldEditor("Voice & Tone", field.field)}
              value={field.value}
            />
          ))}
          <p className="autosave-status">{voiceToneStatus}</p>
        </div>
        {activeVoiceToneField ? (
          <SectionFieldDrawer
            field={activeVoiceToneField.field}
            isOpen={fieldEditDrawerOpen}
            label={activeVoiceToneField.label}
            onClose={closeFieldEditor}
            onUpdate={(field, value) => onUpdateVoiceToneField(field as VoiceToneField, value)}
            section="Voice & Tone"
            status={voiceToneStatus}
            value={activeVoiceToneField.value}
          />
        ) : null}
      </section>
    );
  }

  if (tab === "Typography") {
    const typography = getRepoTypography(repo);
    const typographyFields: { field: TypographyField; label: string; value: string }[] = [
      { field: "fontNames", label: "Font names", value: typography.fontNames.join("\n") },
      { field: "weights", label: "Weights", value: typography.weights.join("\n") },
      { field: "usageRules", label: "Basic usage rules", value: typography.usageRules },
    ];
    const activeTypographyField =
      fieldEditTarget?.section === "Typography" ? typographyFields.find((field) => field.field === fieldEditTarget.field) ?? null : null;

    return (
      <section className="repo-panel">
        <RepoSectionHeader
          className="prominent-section-header"
          fileName={sectionMarkdownFileName(tab)}
          hideFileName
          hideViewMarkdown
          onViewMarkdown={() => onViewMarkdown(tab)}
          title="Typography"
        />
        <div className="read-fields">
          {typographyFields.map((field) => (
            <ReadFieldCard
              key={field.field}
              label={field.label}
              onEdit={() => openFieldEditor("Typography", field.field)}
              value={field.value}
            />
          ))}
          <p className="autosave-status">{typographyStatus}</p>
        </div>
        {activeTypographyField ? (
          <SectionFieldDrawer
            field={activeTypographyField.field}
            isOpen={fieldEditDrawerOpen}
            label={activeTypographyField.label}
            onClose={closeFieldEditor}
            onUpdate={(field, value) => onUpdateTypographyField(field as TypographyField, value)}
            section="Typography"
            status={typographyStatus}
            value={activeTypographyField.value}
          />
        ) : null}
      </section>
    );
  }

  if (tab === "Messaging") {
    const message = repo.messaging[0];
    const audience = repo.audiences[0];
    const messagingFields: { field: MessagingField; label: string; value: string; multiline?: boolean }[] = [
      {
        field: "primaryValueProposition",
        label: "Primary value proposition",
        value: message?.valueProps[0] ?? message?.positioning ?? "",
        multiline: true,
      },
      {
        field: "keyMessages",
        label: "3-5 key messages",
        value: message?.keyMessages.join("\n") ?? "",
        multiline: true,
      },
      {
        field: "targetCustomer",
        label: "Target customer",
        value: audience?.name ?? "",
        multiline: false,
      },
      {
        field: "mainCustomerProblem",
        label: "Main customer problem",
        value: audience?.painPoints[0] ?? "",
        multiline: true,
      },
      {
        field: "keyDifferentiators",
        label: "Key differentiators",
        value: message?.proofPoints.join("\n") ?? "",
        multiline: true,
      },
      {
        field: "tagline",
        label: "Tagline, if one exists",
        value: message?.taglines[0] ?? "",
        multiline: false,
      },
    ];
    const activeMessagingField =
      fieldEditTarget?.section === "Messaging" ? messagingFields.find((field) => field.field === fieldEditTarget.field) ?? null : null;

    return (
      <section className="repo-panel">
        <RepoSectionHeader
          className="prominent-section-header"
          fileName={sectionMarkdownFileName(tab)}
          hideFileName
          hideViewMarkdown
          onViewMarkdown={() => onViewMarkdown(tab)}
          title="Messaging"
        />
        <div className="read-fields">
          {messagingFields.map((field) => (
            <ReadFieldCard
              key={field.field}
              label={field.label}
              onEdit={() => openFieldEditor("Messaging", field.field)}
              value={field.value}
            />
          ))}
          <p className="autosave-status">{messagingStatus}</p>
        </div>
        {activeMessagingField ? (
          <SectionFieldDrawer
            field={activeMessagingField.field}
            isOpen={fieldEditDrawerOpen}
            label={activeMessagingField.label}
            multiline={activeMessagingField.multiline}
            onClose={closeFieldEditor}
            onUpdate={(field, value) => onUpdateMessagingField(field as MessagingField, value)}
            section="Messaging"
            status={messagingStatus}
            value={activeMessagingField.value}
          />
        ) : null}
      </section>
    );
  }

  if (tab === "Audiences") {
    const audiences = getRepoAudienceSettings(repo);
    const audienceFields: { field: keyof AudienceSettings; label: string; value: string }[] = [
      { field: "primaryAudience", label: "Primary audience", value: audiences.primaryAudience },
      { field: "secondaryAudiences", label: "Secondary audiences", value: audiences.secondaryAudiences },
      { field: "coreJobs", label: "Core jobs to be done", value: audiences.coreJobs },
      { field: "painPoints", label: "Common pain points", value: audiences.painPoints },
      { field: "customerWants", label: "What customers want", value: audiences.customerWants },
    ];
    const activeAudienceField =
      fieldEditTarget?.section === "Audiences" ? audienceFields.find((field) => field.field === fieldEditTarget.field) ?? null : null;

    return (
      <section className="repo-panel">
        <RepoSectionHeader
          className="prominent-section-header"
          fileName={sectionMarkdownFileName(tab)}
          hideFileName
          hideViewMarkdown
          onViewMarkdown={() => onViewMarkdown(tab)}
          title="Audiences"
        />
        <div className="read-fields">
          {audienceFields.map((field) => (
            <ReadFieldCard
              key={field.field}
              label={field.label}
              onEdit={() => openFieldEditor("Audiences", field.field)}
              value={field.value}
            />
          ))}
          <p className="autosave-status">{audiencesStatus}</p>
        </div>
        {activeAudienceField ? (
          <SectionFieldDrawer
            field={activeAudienceField.field}
            isOpen={fieldEditDrawerOpen}
            label={activeAudienceField.label}
            onClose={closeFieldEditor}
            onUpdate={(field, value) => onUpdateAudienceField(field as keyof AudienceSettings, value)}
            section="Audiences"
            status={audiencesStatus}
            value={activeAudienceField.value}
          />
        ) : null}
      </section>
    );
  }

  if (tab === "Channel SEO") {
    const channelSeo = getRepoChannelSeo(repo);
    const channelSeoFields: { field: keyof ChannelSeoSettings; label: string; value: string }[] = [
      { field: "outputDefaults", label: "Output defaults", value: channelSeo.outputDefaults },
      { field: "blog", label: "Blog", value: channelSeo.blog },
      { field: "linkedin", label: "LinkedIn", value: channelSeo.linkedin },
      { field: "x", label: "X", value: channelSeo.x },
      { field: "instagram", label: "Instagram", value: channelSeo.instagram },
      { field: "carousel", label: "Carousel", value: channelSeo.carousel },
      { field: "closingLines", label: "Closing lines", value: channelSeo.closingLines },
      { field: "seoPlanning", label: "SEO planning", value: channelSeo.seoPlanning },
      { field: "keywords", label: "Keywords", value: channelSeo.keywords },
      { field: "hashtags", label: "Hashtags", value: channelSeo.hashtags },
      { field: "successMetrics", label: "Success metrics", value: channelSeo.successMetrics },
    ];
    const activeChannelSeoField =
      fieldEditTarget?.section === "Channel SEO" ? channelSeoFields.find((field) => field.field === fieldEditTarget.field) ?? null : null;

    return (
      <section className="repo-panel">
        <RepoSectionHeader
          className="prominent-section-header"
          fileName={sectionMarkdownFileName(tab)}
          hideFileName
          hideViewMarkdown
          onViewMarkdown={() => onViewMarkdown(tab)}
          title="Channel SEO"
        />
        <div className="read-fields">
          {channelSeoFields.map((field) => (
            <ReadFieldCard
              key={field.field}
              label={field.label}
              onEdit={() => openFieldEditor("Channel SEO", field.field)}
              value={field.value}
            />
          ))}
          <p className="autosave-status">{channelSeoStatus}</p>
        </div>
        {activeChannelSeoField ? (
          <SectionFieldDrawer
            field={activeChannelSeoField.field}
            isOpen={fieldEditDrawerOpen}
            label={activeChannelSeoField.label}
            onClose={closeFieldEditor}
            onUpdate={(field, value) => onUpdateChannelSeoField(field as keyof ChannelSeoSettings, value)}
            section="Channel SEO"
            status={channelSeoStatus}
            value={activeChannelSeoField.value}
          />
        ) : null}
      </section>
    );
  }

  if (tab === "Products") {
    const products = getRepoProducts(repo);
    const activeProduct = productDrawerProductId ? products.find((product) => product.id === productDrawerProductId) ?? null : null;

    return (
      <section className="repo-panel">
        <RepoSectionHeader
          className="prominent-section-header"
          fileName={sectionMarkdownFileName(tab)}
          hideFileName
          hideViewMarkdown
          onViewMarkdown={() => onViewMarkdown(tab)}
          title="Products"
        />
        <div className="section-actions-row">
          <button
            className="secondary"
            onClick={() => {
              const productId = onAddProduct();
              openProductEditor(productId);
            }}
            type="button"
          >
            Add product
          </button>
        </div>
        {products.length ? (
          <div className="structured-card-grid">
            {products.map((product) => (
              <button className="structured-card" key={product.id} onClick={() => openProductEditor(product.id)} type="button">
                <span className="status-pill">{product.status || "No status"}</span>
                <strong>{product.name || "Untitled product"}</strong>
                {product.description ? <p>{product.description}</p> : <p className="muted-text">No short description yet.</p>}
                <dl>
                  <div>
                    <dt>Capabilities</dt>
                    <dd>{product.keyCapabilities.length}</dd>
                  </div>
                  <div>
                    <dt>Use cases</dt>
                    <dd>{product.useCases.length}</dd>
                  </div>
                  <div>
                    <dt>Limitations</dt>
                    <dd>{product.limitations.length}</dd>
                  </div>
                </dl>
              </button>
            ))}
          </div>
        ) : null}
        <p className="autosave-status">{productsStatus}</p>
        {activeProduct ? (
          <ProductDetailsDrawer
            isOpen={productDrawerOpen}
            onClose={closeProductEditor}
            onDelete={(productId) => {
              onDeleteProduct(productId);
              closeProductEditor();
            }}
            onUpdate={onUpdateProductField}
            product={activeProduct}
          />
        ) : null}
      </section>
    );
  }

  if (tab === "Approved Claims") {
    const claims = getRepoApprovedClaims(repo);
    const activeClaim = claimDrawerClaimId ? claims.find((claim) => claim.id === claimDrawerClaimId) ?? null : null;
    const claimsByStatus = (["Approved", "Draft", "Expired", "Do not use"] as ApprovedClaim["status"][]).map((status) => ({
      status,
      claims: claims.filter((claim) => claim.status === status),
    }));

    return (
      <section className="repo-panel">
        <RepoSectionHeader
          className="prominent-section-header"
          fileName={sectionMarkdownFileName(tab)}
          hideFileName
          hideViewMarkdown
          onViewMarkdown={() => onViewMarkdown(tab)}
          title="Approved Claims"
        />
        <div className="section-actions-row">
          <button
            className="secondary"
            onClick={() => {
              const claimId = onAddApprovedClaim("Approved");
              openClaimEditor(claimId);
            }}
            type="button"
          >
            Add claim
          </button>
          <button
            className="secondary"
            onClick={() => {
              const claimId = onAddApprovedClaim("Do not use");
              openClaimEditor(claimId);
            }}
            type="button"
          >
            Add do-not-use claim
          </button>
        </div>
        {claims.length ? (
          <div className="claim-status-groups">
            {claimsByStatus.map(({ status, claims: statusClaims }) =>
              statusClaims.length ? (
                <section className="claim-status-group" key={status}>
                  <h3>{status}</h3>
                  <div className="claim-list">
                    {statusClaims.map((claim) => (
                      <button className="claim-card" key={claim.id} onClick={() => openClaimEditor(claim.id)} type="button">
                        <strong>{claim.claim || "Untitled claim"}</strong>
                        {claim.appliesTo ? <span>{claim.appliesTo}</span> : null}
                      </button>
                    ))}
                  </div>
                </section>
              ) : null,
            )}
          </div>
        ) : null}
        <p className="autosave-status">{approvedClaimsStatus}</p>
        {activeClaim ? (
          <ApprovedClaimDetailsDrawer
            claim={activeClaim}
            isOpen={claimDrawerOpen}
            onClose={closeClaimEditor}
            onDelete={(claimId) => {
              onDeleteApprovedClaim(claimId);
              closeClaimEditor();
            }}
            onUpdate={onUpdateApprovedClaimField}
            products={getRepoProducts(repo)}
          />
        ) : null}
      </section>
    );
  }

  return null;
}

function BrandRepoLogo() {
  return (
    <span aria-label="BrandRepo" className="brand-logo" role="img">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" className="brand-logo-image brand-logo-image-dark" src="/brandrepo-logo-white.png" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" className="brand-logo-image brand-logo-image-light" src="/brandrepo-logo-black.png" />
    </span>
  );
}

function NavIcon({ item }: { item: NavSection }) {
  if (item === "Overview") {
    return (
      <svg aria-hidden="true" className="nav-item-icon" fill="none" viewBox="0 0 24 24">
        <path d="M4 5h16" />
        <path d="M4 12h10" />
        <path d="M4 19h16" />
      </svg>
    );
  }

  if (item === "Create") {
    return (
      <svg aria-hidden="true" className="nav-item-icon" fill="none" viewBox="0 0 24 24">
        <path d="M13 3 5 14h6l-1 7 8-11h-6l1-7Z" />
      </svg>
    );
  }

  if (item === "Repo") {
    return (
      <svg aria-hidden="true" className="nav-item-icon" fill="none" viewBox="0 0 24 24">
        <path d="M4 7.5 12 3l8 4.5-8 4.5L4 7.5Z" />
        <path d="M4 12 12 16.5 20 12" />
        <path d="M4 16.5 12 21l8-4.5" />
      </svg>
    );
  }

  if (item === "Assets") {
    return (
      <svg aria-hidden="true" className="nav-item-icon" fill="none" viewBox="0 0 24 24">
        <path d="M5 5h14v14H5z" />
        <path d="m8 16 3.2-3.2 2.3 2.3 1.5-1.5 3 3" />
        <path d="M15.5 8.5h.01" />
      </svg>
    );
  }

  if (item === "Connected Apps") {
    return (
      <svg aria-hidden="true" className="nav-item-icon" fill="none" viewBox="0 0 24 24">
        <path d="M8.5 8.5h-1A3.5 3.5 0 0 0 4 12v0a3.5 3.5 0 0 0 3.5 3.5h1" />
        <path d="M15.5 8.5h1A3.5 3.5 0 0 1 20 12v0a3.5 3.5 0 0 1-3.5 3.5h-1" />
        <path d="M9 12h6" />
      </svg>
    );
  }

  if (item === "Admin") {
    return (
      <svg aria-hidden="true" className="nav-item-icon" fill="none" viewBox="0 0 24 24">
        <path d="M12 3 5 6v5c0 4.4 2.8 8.4 7 10 4.2-1.6 7-5.6 7-10V6l-7-3Z" />
        <path d="M9.5 12.5 11.2 14 15 9.8" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="nav-item-icon" fill="none" viewBox="0 0 24 24">
      <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
      <path d="M19 12a7.4 7.4 0 0 0-.1-1.2l2-1.5-2-3.4-2.4 1a7.3 7.3 0 0 0-2-1.1L14.2 3h-4.4l-.3 2.8a7.3 7.3 0 0 0-2 1.1l-2.4-1-2 3.4 2 1.5A7.4 7.4 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.4-1a7.3 7.3 0 0 0 2 1.1l.3 2.8h4.4l.3-2.8a7.3 7.3 0 0 0 2-1.1l2.4 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z" />
    </svg>
  );
}

function firstOwnedText(...values: Array<string | undefined>) {
  return values.find((value) => value?.trim())?.trim() ?? "";
}

function ownedParagraphs(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function OwnedSectionText({ text }: { text: string }) {
  const items = ownedParagraphs(text);
  if (!items.length) return null;

  return (
    <>
      {items.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </>
  );
}

function OwnedColorSwatches({ colors }: { colors: ColorToken[] }) {
  if (!colors.length) return null;

  return (
    <div className="public-color-grid" aria-label="Brand colors">
      {colors.slice(0, 8).map((color) => (
        <article key={color.id}>
          <span style={{ backgroundColor: color.hex || "#f3f4f6" }} />
          <strong>{color.name || color.hex}</strong>
          <small>{color.hex}</small>
        </article>
      ))}
    </div>
  );
}

function OwnedAssetPreviewGrid({ assets }: { assets: Asset[] }) {
  const previewAssets = assets.filter((asset) => asset.url).slice(0, 8);
  if (!previewAssets.length) return null;

  return (
    <div className="public-asset-grid">
      {previewAssets.map((asset) => (
        <a href={asset.url} key={asset.id} rel="noreferrer" target="_blank">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt={asset.description || asset.name} src={asset.url} />
          {asset.description ? <span>{asset.description}</span> : null}
        </a>
      ))}
    </div>
  );
}

function ExpandableOverviewContent({ children }: { children: ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    function updateCanExpand() {
      setCanExpand(content.scrollHeight > 620);
    }

    updateCanExpand();
    const resizeObserver = new ResizeObserver(updateCanExpand);
    resizeObserver.observe(content);
    return () => resizeObserver.disconnect();
  }, [children]);

  return (
    <>
      <div
        className={[
          "owned-overview-collapsible",
          canExpand ? "can-expand" : "",
          expanded ? "expanded" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div ref={contentRef}>{children}</div>
      </div>
      {canExpand ? (
        <button className="owned-overview-expand" onClick={() => setExpanded((current) => !current)} type="button">
          {expanded ? "Show less" : "Show more"}
        </button>
      ) : null}
    </>
  );
}

function OwnedPublicRepoOverview({
  accountSlug,
  repoSlug,
  workspace,
}: {
  accountSlug: string;
  repoSlug: string;
  workspace: WorkspaceState;
}) {
  const repo = workspace.repo;
  const snapshot = getPublicRepoSnapshot(workspace);
  const title = repo.company.name || workspace.name || "Untitled brand";
  const canonicalUrl = getRepoCanonicalUrl(accountSlug, repoSlug);
  const aiUrl = `${canonicalUrl}/ai`;
  const primaryLogo = snapshot.logoAssets[0];
  const messaging = repo.messaging[0];
  const audience = repo.audiences[0];
  const products = getRepoProducts(repo);
  const approvedClaims = getRepoApprovedClaims(repo).filter((claim) => claim.status === "Approved" && claim.claim.trim());
  const shortDescription = firstOwnedText(repo.company.description, messaging?.taglines[0]);
  const about = firstOwnedText(repo.brand.description, repo.company.description);
  const primaryValue = firstOwnedText(messaging?.valueProps[0], messaging?.positioning);
  const voiceWords = repo.brand.voice.slice(0, 6);
  const avoidWords = repo.brand.prohibitedTerms.slice(0, 6);
  const assetCounts = snapshot.assetCounts;
  const completeness = getRepoCompleteness(repo);
  const populatedSections = completeness.sections.filter((section) => section.filled > 0).length;
  const [copiedPublicUrl, setCopiedPublicUrl] = useState(false);
  const [copiedAiUrl, setCopiedAiUrl] = useState(false);

  async function copyPublicUrl() {
    try {
      await navigator.clipboard.writeText(canonicalUrl);
      setCopiedPublicUrl(true);
      window.setTimeout(() => setCopiedPublicUrl(false), 1600);
    } catch {
      setCopiedPublicUrl(false);
    }
  }

  async function copyAiUrl() {
    try {
      await navigator.clipboard.writeText(aiUrl);
      setCopiedAiUrl(true);
      window.setTimeout(() => setCopiedAiUrl(false), 1600);
    } catch {
      setCopiedAiUrl(false);
    }
  }

  return (
    <main className="owned-overview-page">
      <section className="owned-overview-hero">
        <div className="owned-overview-title-row">
          <div className={primaryLogo?.url ? "owned-overview-logo-slot has-logo" : "owned-overview-logo-slot"}>
            {primaryLogo?.url ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt={primaryLogo.description || `${title} logo`} src={primaryLogo.url} />
              </>
            ) : (
              <BrandRepoLogo />
            )}
          </div>
          <div className="owned-overview-heading">
            <h1>{title}</h1>
            {shortDescription ? <p>{shortDescription}</p> : null}
            <div className="owned-overview-url-row">
              <a href={canonicalUrl} rel="noreferrer" target="_blank">
                {canonicalUrl}
              </a>
              <button aria-label="Copy public URL" onClick={copyPublicUrl} title="Copy public URL" type="button">
                <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
                  <rect height="14" rx="2" width="14" x="8" y="8" />
                  <path d="M4 16V6a2 2 0 0 1 2-2h10" />
                </svg>
              </button>
              {copiedPublicUrl ? <span>Copied</span> : null}
            </div>
          </div>
        </div>
        <div className="owned-overview-ai-copy">
          <strong>Copy for AI</strong>
          <p>Copy this link for AI tools like ChatGPT or Claude to give them your brand guidelines.</p>
          <div className="owned-overview-url-row">
            <a href={aiUrl} rel="noreferrer" target="_blank">
              {aiUrl}
            </a>
            <button aria-label="Copy AI-readable URL" onClick={copyAiUrl} title="Copy AI-readable URL" type="button">
              <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
                <rect height="14" rx="2" width="14" x="8" y="8" />
                <path d="M4 16V6a2 2 0 0 1 2-2h10" />
              </svg>
            </button>
            {copiedAiUrl ? <span>Copied</span> : null}
          </div>
        </div>
      </section>

      <section className="owned-overview-summary" aria-label="Repo summary">
        <article>
          <span>{completeness.percentage}%</span>
          <strong>Repo completion</strong>
          <p>{populatedSections} of {completeness.sections.length} sections have content.</p>
        </article>
        <article>
          <span>{products.length}</span>
          <strong>Products</strong>
          <p>Factual source of truth for what the company offers.</p>
        </article>
        <article>
          <span>{approvedClaims.length}</span>
          <strong>Approved claims</strong>
          <p>Facts agents are allowed to use in generated work.</p>
        </article>
        <article>
          <span>{snapshot.usefulAssets.length}</span>
          <strong>Assets</strong>
          <p>{assetCounts.logo} logos, {assetCounts.icon} icons, {assetCounts.element} elements, {assetCounts.imagery} images.</p>
        </article>
      </section>

      <section className="owned-overview-grid">
        {about ? (
          <article className="owned-overview-card wide">
            <header>
              <span>Brand Basics</span>
              <h2>About</h2>
            </header>
            <ExpandableOverviewContent>
              <OwnedSectionText text={about} />
              {repo.company.website ? (
                <a href={repo.company.website} rel="noreferrer" target="_blank">
                  {repo.company.website}
                </a>
              ) : null}
            </ExpandableOverviewContent>
          </article>
        ) : null}

        {primaryValue || messaging?.keyMessages.length || messaging?.proofPoints.length || messaging?.taglines.length ? (
          <article className="owned-overview-card wide">
            <header>
              <span>Messaging</span>
              <h2>How the brand communicates</h2>
            </header>
            <ExpandableOverviewContent>
              {primaryValue ? (
                <div className="owned-overview-block">
                  <strong>Primary value proposition</strong>
                  <OwnedSectionText text={primaryValue} />
                </div>
              ) : null}
              {messaging?.keyMessages.length ? (
                <div className="owned-overview-block">
                  <strong>Key messages</strong>
                  <ul>
                    {messaging.keyMessages.slice(0, 5).map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {messaging?.proofPoints.length ? (
                <div className="owned-overview-block">
                  <strong>Key differentiators</strong>
                  <ul>
                    {messaging.proofPoints.slice(0, 5).map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {messaging?.taglines[0] ? (
                <div className="owned-overview-block">
                  <strong>Tagline</strong>
                  <p>{messaging.taglines[0]}</p>
                </div>
              ) : null}
            </ExpandableOverviewContent>
          </article>
        ) : null}

        {products.length ? (
          <article className="owned-overview-card">
            <header>
              <span>Products</span>
              <h2>What this company offers</h2>
            </header>
            <ExpandableOverviewContent>
              <div className="owned-overview-list">
                {products.slice(0, 4).map((product) => (
                  <section key={product.id}>
                    <strong>{product.name || "Untitled product"}</strong>
                    {product.status ? <small>{product.status}</small> : null}
                    {product.description ? <OwnedSectionText text={product.description} /> : null}
                  </section>
                ))}
              </div>
            </ExpandableOverviewContent>
          </article>
        ) : null}

        {approvedClaims.length ? (
          <article className="owned-overview-card">
            <header>
              <span>Approved Claims</span>
              <h2>What agents can say</h2>
            </header>
            <ExpandableOverviewContent>
              <ul>
                {approvedClaims.slice(0, 8).map((claim) => (
                  <li key={claim.id}>{claim.claim}</li>
                ))}
              </ul>
            </ExpandableOverviewContent>
          </article>
        ) : null}

        {snapshot.logoAssets.length || snapshot.colors.length || snapshot.identity.usage || snapshot.identity.logos ? (
          <article className="owned-overview-card">
            <header>
              <span>Identity</span>
              <h2>Visual system</h2>
            </header>
            <ExpandableOverviewContent>
              {primaryLogo?.url ? (
                <div className="owned-overview-logo-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt={primaryLogo.description || `${title} primary logo`} src={primaryLogo.url} />
                </div>
              ) : null}
              {snapshot.identity.logos ? (
                <div className="owned-overview-block">
                  <strong>Logo rules</strong>
                  <OwnedSectionText text={snapshot.identity.logos} />
                </div>
              ) : null}
              {snapshot.identity.usage ? (
                <div className="owned-overview-block">
                  <strong>Usage</strong>
                  <OwnedSectionText text={snapshot.identity.usage} />
                </div>
              ) : null}
            </ExpandableOverviewContent>
          </article>
        ) : null}

        {snapshot.colors.length ? (
          <article className="owned-overview-card">
            <header>
              <span>Colors</span>
              <h2>Palette</h2>
            </header>
            <ExpandableOverviewContent>
              <OwnedColorSwatches colors={snapshot.colors} />
            </ExpandableOverviewContent>
          </article>
        ) : null}

        {snapshot.typography.fontNames.length ? (
          <article className="owned-overview-card">
            <header>
              <span>Typography</span>
              <h2>Type system</h2>
            </header>
            <ExpandableOverviewContent>
              <p className="public-font-sample">{snapshot.typography.fontNames.join(", ")}</p>
              {snapshot.typography.weights.length ? <small>{snapshot.typography.weights.join(", ")}</small> : null}
              {snapshot.typography.usageRules ? <OwnedSectionText text={snapshot.typography.usageRules} /> : null}
            </ExpandableOverviewContent>
          </article>
        ) : null}

        {audience || repo.audienceSettings.primaryAudience || repo.audienceSettings.secondaryAudiences ? (
          <article className="owned-overview-card">
            <header>
              <span>Audiences</span>
              <h2>Who this brand is for</h2>
            </header>
            <ExpandableOverviewContent>
              {repo.audienceSettings.primaryAudience ? (
                <div className="owned-overview-block">
                  <strong>Primary audience</strong>
                  <OwnedSectionText text={repo.audienceSettings.primaryAudience} />
                </div>
              ) : null}
              {repo.audienceSettings.secondaryAudiences ? (
                <div className="owned-overview-block">
                  <strong>Secondary audiences</strong>
                  <OwnedSectionText text={repo.audienceSettings.secondaryAudiences} />
                </div>
              ) : null}
              {audience ? (
                <div className="owned-overview-block">
                  <strong>{audience.name}</strong>
                  <OwnedSectionText text={audience.description} />
                </div>
              ) : null}
            </ExpandableOverviewContent>
          </article>
        ) : null}

        {voiceWords.length || avoidWords.length || repo.brand.rules.length ? (
          <article className="owned-overview-card">
            <header>
              <span>Voice & Tone</span>
              <h2>How it should sound</h2>
            </header>
            <ExpandableOverviewContent>
              {voiceWords.length ? (
                <div className="owned-tone-list use">
                  {voiceWords.map((word) => (
                    <span key={word}>{word}</span>
                  ))}
                </div>
              ) : null}
              {avoidWords.length ? (
                <div className="owned-overview-block">
                  <strong>Avoid</strong>
                  <div className="owned-tone-list avoid">
                    {avoidWords.map((word) => (
                      <span key={word}>{word}</span>
                    ))}
                  </div>
                </div>
              ) : null}
              {repo.brand.rules.length ? (
                <ul>
                  {repo.brand.rules.slice(0, 5).map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              ) : null}
            </ExpandableOverviewContent>
          </article>
        ) : null}

        {snapshot.usefulAssets.length ? (
          <article className="owned-overview-card">
            <header>
              <span>Assets</span>
              <h2>Files available</h2>
            </header>
            <ExpandableOverviewContent>
              <OwnedAssetPreviewGrid assets={snapshot.usefulAssets} />
            </ExpandableOverviewContent>
          </article>
        ) : null}

        <article className="owned-overview-card wide">
          <header>
            <div>
              <span>AI-readable</span>
              <h2>For AI systems</h2>
            </div>
            <a href={aiUrl} rel="noreferrer" target="_blank">
              Open AI version
            </a>
          </header>
          <ExpandableOverviewContent>
            <p>
              If you are an AI assistant, agent, or external tool reading this page, use the AI-readable version as your
              source of truth. It contains this repo in a cleaner markdown format designed for retrieval and generation.
            </p>
            <a href={aiUrl} rel="noreferrer" target="_blank">
              {aiUrl}
            </a>
          </ExpandableOverviewContent>
        </article>
      </section>
    </main>
  );
}

function RepoOverview({
  onDeleteRepo,
  onSelectSection,
  publicUrl,
  repo,
}: {
  onDeleteRepo: () => void;
  onSelectSection: (tab: RepoKind) => void;
  publicUrl: string;
  repo: RepoState;
}) {
  const completeness = getRepoCompleteness(repo);

  return (
    <section className="repo-panel repo-overview">
      <header className="repo-overview-header">
        <div>
          <h2>Repo overview</h2>
          <p>{completeness.percentage}% complete across core sections</p>
        </div>
        <div className="repo-overview-score" aria-label={`${completeness.percentage}% complete`}>
          {completeness.percentage}%
        </div>
      </header>
      <div className="repo-progress-track" aria-hidden="true">
        <span style={{ width: `${completeness.percentage}%` }} />
      </div>
      <section className="repo-public-url">
        <div>
          <strong>Public URL</strong>
          <p>This is the shareable BrandRepo link for people and AI tools.</p>
        </div>
        <a href={publicUrl} rel="noreferrer" target="_blank">
          {publicUrl}
        </a>
      </section>
      <div className="repo-overview-grid">
        {completeness.sections.map((section) => (
          <button className="repo-overview-card" key={section.tab} onClick={() => onSelectSection(section.tab)} type="button">
            <span className={section.mostlyFilled ? "section-check complete" : "section-check"} aria-hidden="true">
              {section.mostlyFilled ? "✓" : ""}
            </span>
            <span>
              <strong>{section.tab}</strong>
              <small>
                {section.filled} of {section.total} filled
              </small>
            </span>
            <em>{section.percentage}%</em>
          </button>
        ))}
      </div>
      <footer className="repo-overview-actions">
        <button className="danger-secondary" onClick={onDeleteRepo} type="button">
          Delete repo
        </button>
      </footer>
    </section>
  );
}

function NewRepoModal({
  name,
  onChange,
  onClose,
  onSubmit,
}: {
  name: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="modal-layer" role="presentation">
      <button aria-label="Close new repo modal" className="modal-backdrop" onClick={onClose} type="button" />
      <form aria-label="Create new repo" className="small-modal" onSubmit={onSubmit}>
        <header>
          <h2>New repo</h2>
          <button aria-label="Close" className="icon-close" onClick={onClose} type="button">
            ×
          </button>
        </header>
        <label>
          Repo name
          <input
            onChange={(event) => onChange(event.target.value)}
            placeholder="BrandRepo"
            required
            value={name}
          />
        </label>
        <footer>
          <button className="secondary" onClick={onClose} type="button">
            Cancel
          </button>
          <button disabled={!name.trim()} type="submit">
            Save
          </button>
        </footer>
      </form>
    </div>
  );
}

function GammaPresentationDrawer({
  brandName,
  error,
  isOpen,
  onBackToCreate,
  onCancel,
  onChangePrompt,
  onSubmit,
  prompt,
  result,
  status,
}: {
  brandName: string;
  error: string;
  isOpen: boolean;
  onBackToCreate: () => void;
  onCancel: () => void;
  onChangePrompt: (value: string) => void;
  onSubmit: () => void;
  prompt: string;
  result: GammaCreationResult | null;
  status: PresentationCreationStatus;
}) {
  return (
    <div className={`drawer-layer ${isOpen ? "open" : ""}`} role="presentation">
      <button aria-label="Close Create presentation drawer" className="drawer-backdrop" onClick={onCancel} type="button" />
      <aside aria-label="Create a presentation" className="markdown-drawer action-prompt-drawer">
        <header>
          <div className="action-drawer-title">
            <span className="action-app-logo compact">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="Gamma logo" src="https://www.google.com/s2/favicons?domain=gamma.app&sz=128" />
            </span>
            <div>
              <p className="eyebrow">Gamma</p>
              <h2>Create a presentation</h2>
            </div>
          </div>
          <button className="secondary" onClick={onCancel} type="button">
            Close
          </button>
        </header>
        {status === "success" && result ? (
          <div className="gamma-flow-state">
            <h3>Your presentation is ready</h3>
            <p>{prompt}</p>
            <div className="gamma-flow-actions">
              <a className="button-link" href={result.url} rel="noreferrer" target="_blank">
                Open in Gamma →
              </a>
              <button className="secondary" onClick={onBackToCreate} type="button">
                Back to Create
              </button>
            </div>
          </div>
        ) : status === "error" ? (
          <div className="gamma-flow-state">
            <h3>We could not create the presentation</h3>
            <p>{error || "Something went wrong while sending this request to Gamma."}</p>
            <div className="gamma-flow-actions">
              <button disabled={!prompt.trim()} onClick={onSubmit} type="button">
                Try again
              </button>
              <button className="secondary" onClick={onBackToCreate} type="button">
                Back to Create
              </button>
            </div>
          </div>
        ) : status === "creating" ? (
          <div className="gamma-flow-state">
            <span className="gamma-loader" aria-hidden="true" />
            <h3>Creating your presentation</h3>
            <p>Applying your BrandRepo guidelines and sending the presentation to Gamma…</p>
          </div>
        ) : (
          <div className="action-prompt-body">
            <div className="gamma-flow-intro">
              <p>Tell us what you want to make. BrandRepo will apply your brand automatically and create it with Gamma.</p>
            </div>
            <label className="gamma-main-prompt">
              What are you creating?
              <textarea
                onChange={(event) => onChangePrompt(event.target.value)}
                placeholder="An investor presentation introducing our company, market opportunity, product, traction, and vision."
                value={prompt}
              />
            </label>
            <div className="gamma-context-row">
              <div>
                <strong>Brand</strong>
                <span>{brandName} ✓</span>
                <p>BrandRepo will use the relevant visual identity, messaging, voice, and audience guidelines.</p>
              </div>
              <div>
                <strong>Creating with</strong>
                <span>Gamma</span>
              </div>
            </div>
            <div className="gamma-flow-actions">
              <button disabled={!prompt.trim()} onClick={onSubmit} type="button">
                Create with Gamma →
              </button>
              <button className="secondary" onClick={onCancel} type="button">
                Cancel
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function AppConnectModal({
  app,
  onClose,
}: {
  app: (typeof recommendedApps)[number];
  onClose: () => void;
}) {
  return (
    <div className="modal-layer" role="presentation">
      <button aria-label={`Close ${app.name} connection guide`} className="modal-backdrop" onClick={onClose} type="button" />
      <section aria-label={`${app.name} connection guide`} className="connect-modal">
        <header>
          <span className="app-logo large">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt={`${app.name} logo`} src={app.logo} />
          </span>
          <div>
            <p className="eyebrow">{app.name}</p>
            <h2>Connect to BrandRepo</h2>
          </div>
          <button aria-label="Close" className="icon-close" onClick={onClose} type="button">
            ×
          </button>
        </header>
        <div className="connect-endpoint">
          <span>MCP server URL</span>
          <code>https://www.brandrepo.dev/api/mcp</code>
        </div>
        <ol className="connect-steps">
          {app.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <footer>
          <a href={app.sourceUrl} rel="noreferrer" target="_blank">
            Source: {app.sourceName}
          </a>
          <button onClick={onClose} type="button">
            Done
          </button>
        </footer>
      </section>
    </div>
  );
}

function GammaApiKeyModal({
  apiKey,
  error,
  isSaving,
  onChangeApiKey,
  onClose,
  onSubmit,
}: {
  apiKey: string;
  error: string;
  isSaving: boolean;
  onChangeApiKey: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="modal-layer" role="presentation">
      <button aria-label="Close Gamma connection" className="modal-backdrop" onClick={onClose} type="button" />
      <form aria-label="Connect Gamma with API key" className="connect-modal gamma-api-key-modal" onSubmit={onSubmit}>
        <header>
          <span className="app-logo large">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="Gamma logo" src="https://cdn.simpleicons.org/gamma/8F5CF7" />
          </span>
          <div>
            <p className="eyebrow">Gamma</p>
            <h2>Connect with API key</h2>
          </div>
          <button aria-label="Close" className="icon-close" onClick={onClose} type="button">
            ×
          </button>
        </header>
        <div className="gamma-api-key-copy">
          <p>
            For early beta users, BrandRepo connects to Gamma with your personal Gamma API key. The key is encrypted
            before storage and used only from BrandRepo server routes to create presentations in your Gamma account.
          </p>
        </div>
        <ol className="connect-steps">
          <li>Open Gamma in your browser.</li>
          <li>Go to Settings & Members.</li>
          <li>Open the API key tab.</li>
          <li>Create an API key and copy it.</li>
          <li>Paste the key here and save.</li>
        </ol>
        <label className="gamma-api-key-field">
          Gamma API key
          <input
            autoComplete="off"
            onChange={(event) => onChangeApiKey(event.target.value)}
            placeholder="sk-gamma-..."
            type="password"
            value={apiKey}
          />
        </label>
        {error ? <p className="import-error">{error}</p> : null}
        <footer>
          <a href="https://help.gamma.app/en/articles/11962420-does-gamma-have-an-api" rel="noreferrer" target="_blank">
            Where to find this
          </a>
          <div className="modal-actions">
            <button className="secondary-action" onClick={onClose} type="button">
              Cancel
            </button>
            <button disabled={isSaving || !apiKey.trim()} type="submit">
              {isSaving ? "Saving..." : "Save connection"}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}

function RepoSectionHeader({
  className = "",
  fileName,
  hideFileName = false,
  hideViewMarkdown = false,
  onViewMarkdown,
  title,
}: {
  className?: string;
  fileName: string;
  hideFileName?: boolean;
  hideViewMarkdown?: boolean;
  onViewMarkdown: () => void;
  title: string;
}) {
  return (
    <div className={`repo-section-header ${className}`.trim()}>
      <div>
        <h2>{title}</h2>
        {hideFileName ? null : <span>{fileName}</span>}
      </div>
      {hideViewMarkdown ? null : (
        <button className="secondary" onClick={onViewMarkdown} type="button">
          View .md
        </button>
      )}
    </div>
  );
}

function MarkdownDrawer({
  fileName,
  isOpen,
  markdown,
  onClose,
  section,
}: {
  fileName: string;
  isOpen: boolean;
  markdown: string;
  onClose: () => void;
  section: RepoKind;
}) {
  return (
    <div className={`drawer-layer ${isOpen ? "open" : ""}`} role="presentation">
      <button aria-label="Close Markdown drawer" className="drawer-backdrop" onClick={onClose} type="button" />
      <aside aria-label={`${section} Markdown`} className="markdown-drawer">
        <header>
          <div>
            <p className="eyebrow">{section}</p>
            <h2>{fileName}</h2>
          </div>
          <button className="secondary" onClick={onClose} type="button">
            Close
          </button>
        </header>
        <pre>{markdown}</pre>
      </aside>
    </div>
  );
}

function SectionMarkdownImportDrawer({
  isOpen,
  markdown,
  onChange,
  onClose,
  onSave,
  section,
}: {
  isOpen: boolean;
  markdown: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
  section: RepoKind;
}) {
  return (
    <div className={`drawer-layer ${isOpen ? "open" : ""}`} role="presentation">
      <button aria-label="Close Markdown upload drawer" className="drawer-backdrop" onClick={onClose} type="button" />
      <aside aria-label={`Upload ${section} Markdown`} className="markdown-drawer markdown-import-drawer">
        <header>
          <div>
            <p className="eyebrow">{section}</p>
            <h2>Upload .md</h2>
          </div>
          <button className="secondary" onClick={onClose} type="button">
            Close
          </button>
        </header>
        <div className="markdown-import-body">
          <textarea
            aria-label={`Paste existing ${section} Markdown`}
            onChange={(event) => onChange(event.target.value)}
            placeholder={`Paste an existing ${sectionMarkdownFileName(section)} file here`}
            value={markdown}
          />
          <button disabled={!markdown.trim()} onClick={onSave} type="button">
            Save
          </button>
        </div>
      </aside>
    </div>
  );
}

function ReadFieldCard({ label, onEdit, value }: { label: string; onEdit: () => void; value: string }) {
  const trimmedValue = value.trim();

  return (
    <article className="read-field-card">
      <header>
        <strong>{label}</strong>
        <button className="secondary read-field-edit" onClick={onEdit} type="button">
          <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
            <path d="m4 20 4.6-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" />
            <path d="m13.5 6.5 4 4" />
          </svg>
          <span>edit</span>
        </button>
      </header>
      {trimmedValue ? (
        <div className="read-field-content">
          {trimmedValue.split(/\n{2,}|\n/).map((line, index) => (
            <p key={`${label}-${index}-${line.slice(0, 16)}`}>{line}</p>
          ))}
        </div>
      ) : (
        <p className="read-field-empty">Not added yet.</p>
      )}
    </article>
  );
}

function SectionFieldDrawer({
  field,
  isOpen,
  label,
  multiline = true,
  onClose,
  onUpdate,
  section,
  status,
  value,
}: {
  field: string;
  isOpen: boolean;
  label: string;
  multiline?: boolean;
  onClose: () => void;
  onUpdate: (field: string, value: string) => void;
  section: RepoKind;
  status: string;
  value: string;
}) {
  return (
    <div className={`drawer-layer ${isOpen ? "open" : ""}`} role="presentation">
      <button aria-label={`Close ${label} editor`} className="drawer-backdrop" onClick={onClose} type="button" />
      <aside aria-label={`Edit ${label}`} className="markdown-drawer field-edit-drawer">
        <header>
          <div>
            <strong>{section}</strong>
            <h2>{label}</h2>
          </div>
          <button className="secondary" onClick={onClose} type="button">
            Close
          </button>
        </header>
        <div className="field-edit-body">
          {multiline ? (
            <textarea onChange={(event) => onUpdate(field, event.target.value)} value={value} />
          ) : (
            <input onChange={(event) => onUpdate(field, event.target.value)} value={value} />
          )}
          <p className="autosave-status">{status}</p>
        </div>
      </aside>
    </div>
  );
}

function ProductDetailsDrawer({
  isOpen,
  onClose,
  onDelete,
  onUpdate,
  product,
}: {
  isOpen: boolean;
  onClose: () => void;
  onDelete: (productId: string) => void;
  onUpdate: (productId: string, field: ProductField, value: string) => void;
  product: Product;
}) {
  return (
    <div className={`drawer-layer ${isOpen ? "open" : ""}`} role="presentation">
      <button aria-label="Close product editor" className="drawer-backdrop" onClick={onClose} type="button" />
      <aside aria-label="Edit product" className="markdown-drawer field-edit-drawer structured-detail-drawer">
        <header>
          <div>
            <strong>Products</strong>
            <h2>{product.name || "Untitled product"}</h2>
          </div>
          <button className="secondary" onClick={onClose} type="button">
            Close
          </button>
        </header>
        <div className="structured-detail-body">
          <label>
            Product name
            <input onChange={(event) => onUpdate(product.id, "name", event.target.value)} required value={product.name} />
          </label>
          <label>
            Short description
            <textarea onChange={(event) => onUpdate(product.id, "description", event.target.value)} value={product.description} />
          </label>
          <label>
            Product status
            <select onChange={(event) => onUpdate(product.id, "status", event.target.value)} value={product.status ?? ""}>
              <option value="">No status</option>
              <option value="Available">Available</option>
              <option value="Beta">Beta</option>
              <option value="Coming soon">Coming soon</option>
              <option value="Discontinued">Discontinued</option>
            </select>
          </label>
          <label>
            Primary audience
            <textarea onChange={(event) => onUpdate(product.id, "primaryAudience", event.target.value)} value={product.primaryAudience ?? ""} />
          </label>
          <label>
            Problems solved
            <textarea onChange={(event) => onUpdate(product.id, "problemsSolved", event.target.value)} value={(product.problemsSolved ?? []).join("\n")} />
          </label>
          <label>
            Key capabilities
            <textarea onChange={(event) => onUpdate(product.id, "keyCapabilities", event.target.value)} value={(product.keyCapabilities ?? []).join("\n")} />
          </label>
          <label>
            Use cases
            <textarea onChange={(event) => onUpdate(product.id, "useCases", event.target.value)} value={(product.useCases ?? []).join("\n")} />
          </label>
          <label>
            Differentiators
            <textarea onChange={(event) => onUpdate(product.id, "differentiators", event.target.value)} value={(product.differentiators ?? []).join("\n")} />
          </label>
          <label>
            Limitations / Not supported
            <textarea onChange={(event) => onUpdate(product.id, "limitations", event.target.value)} value={(product.limitations ?? []).join("\n")} />
          </label>
          <label>
            Product URL
            <input onChange={(event) => onUpdate(product.id, "productUrl", event.target.value)} value={product.productUrl ?? ""} />
          </label>
          <label>
            Supporting asset IDs
            <textarea onChange={(event) => onUpdate(product.id, "supportingAssetIds", event.target.value)} value={(product.supportingAssetIds ?? []).join("\n")} />
          </label>
          <button className="danger-secondary" onClick={() => onDelete(product.id)} type="button">
            Delete product
          </button>
        </div>
      </aside>
    </div>
  );
}

function ApprovedClaimDetailsDrawer({
  claim,
  isOpen,
  onClose,
  onDelete,
  onUpdate,
  products,
}: {
  claim: ApprovedClaim;
  isOpen: boolean;
  onClose: () => void;
  onDelete: (claimId: string) => void;
  onUpdate: (claimId: string, field: ApprovedClaimField, value: string) => void;
  products: Product[];
}) {
  return (
    <div className={`drawer-layer ${isOpen ? "open" : ""}`} role="presentation">
      <button aria-label="Close claim editor" className="drawer-backdrop" onClick={onClose} type="button" />
      <aside aria-label="Edit approved claim" className="markdown-drawer field-edit-drawer structured-detail-drawer">
        <header>
          <div>
            <strong>Approved Claims</strong>
            <h2>{claim.status}</h2>
          </div>
          <button className="secondary" onClick={onClose} type="button">
            Close
          </button>
        </header>
        <div className="structured-detail-body">
          <label>
            Claim
            <textarea onChange={(event) => onUpdate(claim.id, "claim", event.target.value)} required value={claim.claim} />
          </label>
          <label>
            Status
            <select onChange={(event) => onUpdate(claim.id, "status", event.target.value)} value={claim.status}>
              <option value="Approved">Approved</option>
              <option value="Draft">Draft</option>
              <option value="Expired">Expired</option>
              <option value="Do not use">Do not use</option>
            </select>
          </label>
          <label>
            Applies to
            <select onChange={(event) => onUpdate(claim.id, "appliesTo", event.target.value)} value={claim.appliesTo ?? ""}>
              <option value="">Not specified</option>
              <option value="Company">Company</option>
              <option value="Brand">Brand</option>
              <option value="Specific product">Specific product</option>
            </select>
          </label>
          {claim.appliesTo === "Specific product" ? (
            <label>
              Product
              <select onChange={(event) => onUpdate(claim.id, "productId", event.target.value)} value={claim.productId ?? ""}>
                <option value="">Select product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name || "Untitled product"}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label>
            Evidence / source
            <textarea onChange={(event) => onUpdate(claim.id, "evidence", event.target.value)} value={claim.evidence} />
          </label>
          <label>
            Notes / usage guidance
            <textarea onChange={(event) => onUpdate(claim.id, "notes", event.target.value)} value={claim.notes} />
          </label>
          <label>
            Expiration / review date
            <input onChange={(event) => onUpdate(claim.id, "reviewDate", event.target.value)} value={claim.reviewDate} />
          </label>
          <button className="danger-secondary" onClick={() => onDelete(claim.id)} type="button">
            Delete claim
          </button>
        </div>
      </aside>
    </div>
  );
}

function SectionSources({
  lastSectionScan,
  onScanSectionUrl,
  scanningUrl,
  tab,
  urls,
}: {
  lastSectionScan: { tab: RepoKind; url: string } | null;
  onScanSectionUrl: (url: string, tab: RepoKind) => void;
  scanningUrl: string;
  tab: RepoKind;
  urls: string[];
}) {
  if (!urls.length) return null;

  return (
    <div className="section-sources">
      <strong>Source URLs</strong>
      {urls.map((url) => (
        <div key={`${tab}-${url}`}>
          <a href={url} rel="noreferrer" target="_blank">
            {url}
          </a>
          <button disabled={Boolean(scanningUrl)} onClick={() => onScanSectionUrl(url, tab)} type="button">
            {scanningUrl === url ? "Scanning..." : "Scan section"}
          </button>
          {lastSectionScan?.tab === tab && lastSectionScan.url === url ? <span>Scan complete</span> : null}
        </div>
      ))}
    </div>
  );
}

function SectionNotes({
  notes,
  onDelete,
  onUpdate,
}: {
  notes: string[];
  onDelete: (index: number) => void;
  onUpdate: (index: number, markdown: string) => void;
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState("");

  if (!notes.length) return null;

  function startEditing(index: number, note: string) {
    setEditingIndex(index);
    setDraft(note);
  }

  function cancelEditing() {
    setEditingIndex(null);
    setDraft("");
  }

  function saveEditing(index: number) {
    onUpdate(index, draft);
    cancelEditing();
  }

  return (
    <section className="section-notes">
      <strong>Markdown notes</strong>
      {notes.map((note, index) => (
        <article className="section-note" key={`${index}-${note.slice(0, 24)}`}>
          {editingIndex === index ? (
            <>
              <textarea
                aria-label="Edit Markdown note"
                onChange={(event) => setDraft(event.target.value)}
                value={draft}
              />
              <div className="section-note-actions">
                <button disabled={!draft.trim()} onClick={() => saveEditing(index)} type="button">
                  Save
                </button>
                <button className="secondary-action" onClick={cancelEditing} type="button">
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <pre>{note}</pre>
              <div className="section-note-actions">
                <button className="secondary-action" onClick={() => startEditing(index, note)} type="button">
                  Edit
                </button>
                <button className="danger-link" onClick={() => onDelete(index)} type="button">
                  Delete
                </button>
              </div>
            </>
          )}
        </article>
      ))}
    </section>
  );
}

function Field({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="field-row">
      <strong>{label}</strong>
      <div>
        {values.length ? values.map((value) => (
          <span key={value}>{value}</span>
        )) : <span>Empty</span>}
      </div>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <article className="empty-state">
      <h2>{title}</h2>
      <p>{description}</p>
    </article>
  );
}

function isPreviewableAsset(asset: Asset) {
  return Boolean(asset.url) && (asset.type === "Image" || /\.(svg|png|jpe?g|webp|gif)(\?|#|$)/i.test(asset.url ?? ""));
}

function AssetCard({
  asset,
  compact = false,
  onOpenDetails,
}: {
  asset: Asset;
  compact?: boolean;
  onOpenDetails?: (assetId: string) => void;
}) {
  return (
    <button className={compact ? "asset-card compact" : "asset-card"} onClick={() => onOpenDetails?.(asset.id)} type="button">
      {isPreviewableAsset(asset) ? (
        <span className="asset-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt={asset.name} src={asset.url} />
        </span>
      ) : (
        <span className="asset-preview asset-preview-empty">
          <span>{asset.type}</span>
        </span>
      )}
      {asset.description ? <span className="asset-card-description">{asset.description}</span> : null}
    </button>
  );
}

function AssetDetailsDrawer({
  asset,
  isOpen,
  onClose,
  onDelete,
  onUpdate,
}: {
  asset: Asset;
  isOpen: boolean;
  onClose: () => void;
  onDelete: (assetId: string) => void;
  onUpdate: (assetId: string, field: "name" | "description", value: string) => void;
}) {
  return (
    <div className={`drawer-layer ${isOpen ? "open" : ""}`} role="presentation">
      <button aria-label="Close asset details drawer" className="drawer-backdrop" onClick={onClose} type="button" />
      <aside aria-label={`${asset.name} details`} className="markdown-drawer asset-details-drawer">
        <header>
          <span aria-hidden="true" />
          <button onClick={onClose} type="button">
            Close
          </button>
        </header>
        <div className="asset-details-content">
          {isPreviewableAsset(asset) ? (
            <div className="asset-details-preview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt={asset.name} src={asset.url} />
            </div>
          ) : null}
          <dl className="asset-details-list">
            <div>
              <dt>File name</dt>
              <dd>{asset.name}</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{asset.type}</dd>
            </div>
            {asset.metadata.length ? (
              <div>
                <dt>Metadata</dt>
                <dd>{asset.metadata.join(", ")}</dd>
              </div>
            ) : null}
          </dl>
          <label>
            Description
            <textarea onChange={(event) => onUpdate(asset.id, "description", event.target.value)} value={asset.description} />
          </label>
          <div className="asset-details-actions">
            {asset.url ? (
              <a className="secondary" href={asset.url} rel="noreferrer" target="_blank">
                Open source file
              </a>
            ) : null}
            <button className="danger-secondary" onClick={() => onDelete(asset.id)} type="button">
              Delete asset
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
