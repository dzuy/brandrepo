"use client";

import { FormEvent, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

type NavSection = "Home" | "Repo" | "Chat" | "Campaigns" | "Assets" | "Settings";
type ThemeMode = "dark" | "light";
type RepoKind =
  | "Brand Basics"
  | "Identity"
  | "Imagery"
  | "Colors"
  | "Voice & Tone"
  | "Typography"
  | "Messaging"
  | "Audiences"
  | "Channel SEO";

type Source = {
  id: string;
  label: string;
  type: "upload" | "structured" | "generated";
};

type Brand = {
  description: string;
  voice: string[];
  values: string[];
  rules: string[];
  approvedTerms: string[];
  prohibitedTerms: string[];
  sources: Source[];
};

type Product = {
  id: string;
  name: string;
  description: string;
  features: string[];
  benefits: string[];
  pricing: string;
  positioning: string;
  sources: Source[];
};

type Audience = {
  id: string;
  name: string;
  description: string;
  painPoints: string[];
  needs: string[];
  messaging: string[];
  channels: string[];
  sources: Source[];
};

type Messaging = {
  id: string;
  positioning: string;
  valueProps: string[];
  taglines: string[];
  keyMessages: string[];
  proofPoints: string[];
  claims: string[];
  sources: Source[];
};

type Campaign = {
  id: string;
  name: string;
  goal: string;
  audience: string;
  brief: string;
  messaging: string[];
  content: string[];
  assets: string[];
  status: "Draft" | "Planned" | "Active" | "Complete";
  results: string;
  learnings: string;
  sources: Source[];
};

type Asset = {
  id: string;
  name: string;
  type: "PDF" | "Presentation" | "Image" | "Document" | "Video";
  url?: string;
  storagePath?: string;
  description: string;
  metadata: string[];
  uploadedAt: string;
  sources: Source[];
};

type ImageReferenceAsset = {
  name: string;
  url: string;
  description: string;
  metadata: string[];
};

type ColorToken = {
  id: string;
  name: string;
  hex: string;
  description: string;
  tag?: string;
};

type TypographySettings = {
  fontNames: string[];
  weights: string[];
  usageRules: string;
};

type ChannelSeoSettings = {
  outputDefaults: string;
  blog: string;
  linkedin: string;
  x: string;
  instagram: string;
  carousel: string;
  closingLines: string;
  seoPlanning: string;
  keywords: string;
  hashtags: string;
  successMetrics: string;
};

type AudienceSettings = {
  primaryAudience: string;
  secondaryAudiences: string;
  coreJobs: string;
  painPoints: string;
  customerWants: string;
};

type IdentitySettings = {
  logos: string;
  icons: string;
  elements: string;
  usage: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  citations?: Source[];
  generatedImage?: {
    dataUrl: string;
    prompt: string;
    saved?: boolean;
  };
  saved?: boolean;
};

type RepoState = {
  company: {
    name: string;
    website: string;
    description: string;
  };
  brand: Brand;
  products: Product[];
  audiences: Audience[];
  messaging: Messaging[];
  campaigns: Campaign[];
  assets: Asset[];
  colors: ColorToken[];
  colorRules: string;
  typography: TypographySettings;
  audienceSettings: AudienceSettings;
  channelSeo: ChannelSeoSettings;
  identity: IdentitySettings;
  sectionUrls: Partial<Record<RepoKind, string[]>>;
  sectionNotes: Partial<Record<RepoKind, string[]>>;
  activity: string[];
};

type WorkspaceState = {
  id: string;
  name: string;
  repo: RepoState;
  chatMessages: ChatMessage[];
  generatedDraft: string;
  generationType: "social" | "email" | "concept";
};

type WorkspaceRow = {
  id: string;
  name: string;
  data: WorkspaceState;
};

type IdentityField = keyof IdentitySettings;

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
const drawerAnimationMs = 220;
const assetBucket = "brandhub-assets";
const chatSavedMessagingSourceLabel = "Chat answer saved to Messaging";
const previousWorkspaceStorageKey = "brandhub-workspaces-v1";
const singleWorkspaceStorageKey = "brandhub-empty-workspace-v1";
const legacyStorageKey = "brandhub-v1-prototype";
const brokenRepoCleanupStorageKey = "brandrepo-cleaned-repo2-nike-v2";
const brokenRepoNamesToDelete = new Set(["Repo2", "Repo 2", "Nike"]);

const initialRepo: RepoState = {
  company: {
    name: "",
    website: "",
    description: "",
  },
  brand: {
    description: "",
    voice: [],
    values: [],
    rules: [],
    approvedTerms: [],
    prohibitedTerms: [],
    sources: [],
  },
  products: [],
  audiences: [],
  messaging: [],
  campaigns: [],
  assets: [],
  colors: [],
  colorRules: "",
  typography: {
    fontNames: [],
    weights: [],
    usageRules: "",
  },
  audienceSettings: {
    primaryAudience: "",
    secondaryAudiences: "",
    coreJobs: "",
    painPoints: "",
    customerWants: "",
  },
  channelSeo: {
    outputDefaults: "",
    blog: "",
    linkedin: "",
    x: "",
    instagram: "",
    carousel: "",
    closingLines: "",
    seoPlanning: "",
    keywords: "",
    hashtags: "",
    successMetrics: "",
  },
  identity: {
    logos: "",
    icons: "",
    elements: "",
    usage: "",
  },
  sectionUrls: {},
  sectionNotes: {},
  activity: [],
};

const navItems: NavSection[] = ["Home", "Repo", "Chat", "Assets"];
const repoTabs: RepoKind[] = [
  "Brand Basics",
  "Identity",
  "Imagery",
  "Colors",
  "Voice & Tone",
  "Typography",
  "Messaging",
  "Audiences",
  "Channel SEO",
];

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

function createWorkspace(repo: RepoState = initialRepo, name?: string): WorkspaceState {
  const workspaceName = name || repo.company.name || "Untitled repo";

  return {
    id: createId("workspace"),
    name: workspaceName,
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

function getRepoSectionNotes(repo: RepoState, tab: RepoKind) {
  const notes = repo.sectionNotes ?? {};
  return notes[tab] ?? [];
}

function getRepoColors(repo: RepoState) {
  return normalizeColorTokens(repo.colors);
}

function getRepoColorRules(repo: RepoState) {
  return repo.colorRules ?? "";
}

function getRepoTypography(repo: RepoState) {
  return normalizeTypographySettings(repo.typography);
}

function getRepoAudienceSettings(repo: RepoState) {
  return normalizeAudienceSettings(repo.audienceSettings);
}

function getRepoChannelSeo(repo: RepoState) {
  return normalizeChannelSeoSettings(repo.channelSeo);
}

function getRepoIdentity(repo: RepoState) {
  return normalizeIdentitySettings(repo.identity);
}

function normalizeColorTokens(colors: ColorToken[] | undefined) {
  return (colors ?? []).map((color) => ({
    id: color.id,
    name: color.name ?? color.tag ?? "",
    hex: color.hex ?? "",
    description: color.description ?? "",
  }));
}

function normalizeTypographySettings(typography: TypographySettings | undefined) {
  return {
    fontNames: typography?.fontNames ?? [],
    weights: typography?.weights ?? [],
    usageRules: typography?.usageRules ?? "",
  };
}

function normalizeAudienceSettings(audienceSettings: AudienceSettings | undefined) {
  return {
    primaryAudience: audienceSettings?.primaryAudience ?? "",
    secondaryAudiences: audienceSettings?.secondaryAudiences ?? "",
    coreJobs: audienceSettings?.coreJobs ?? "",
    painPoints: audienceSettings?.painPoints ?? "",
    customerWants: audienceSettings?.customerWants ?? "",
  };
}

function normalizeChannelSeoSettings(channelSeo: ChannelSeoSettings | undefined) {
  return {
    outputDefaults: channelSeo?.outputDefaults ?? "",
    blog: channelSeo?.blog ?? "",
    linkedin: channelSeo?.linkedin ?? "",
    x: channelSeo?.x ?? "",
    instagram: channelSeo?.instagram ?? "",
    carousel: channelSeo?.carousel ?? "",
    closingLines: channelSeo?.closingLines ?? "",
    seoPlanning: channelSeo?.seoPlanning ?? "",
    keywords: channelSeo?.keywords ?? "",
    hashtags: channelSeo?.hashtags ?? "",
    successMetrics: channelSeo?.successMetrics ?? "",
  };
}

function normalizeIdentitySettings(identity: (Partial<IdentitySettings> & Record<string, string | undefined>) | undefined) {
  const logos = [
    identity?.logos,
    identity?.overview,
    identity?.primaryLogo,
    identity?.wordmark,
    identity?.logomark,
    identity?.logoVariants,
  ].filter(Boolean);
  const icons = [identity?.icons, identity?.appIcon, identity?.favicon].filter(Boolean);
  const elements = [identity?.elements, identity?.assetPackage].filter(Boolean);
  const usage = [
    identity?.usage,
    identity?.clearSpace,
    identity?.minimumSize,
    identity?.approvedUsage,
    identity?.incorrectUsage,
    identity?.backgroundUsage,
    identity?.relationshipToColor,
  ].filter(Boolean);

  return {
    logos: logos.join("\n\n"),
    icons: icons.join("\n\n"),
    elements: elements.join("\n\n"),
    usage: usage.join("\n\n"),
  };
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

function sectionMarkdownFileName(tab: RepoKind) {
  return `${tab.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}.md`;
}

function markdownLine(value: string | undefined) {
  return value?.trim() || "_Not set._";
}

function markdownList(values: string[]) {
  return values.length ? values.map((value) => `- ${value}`).join("\n") : "_None yet._";
}

function markdownNotes(notes: string[]) {
  return notes.length ? notes.map((note, index) => `### Note ${index + 1}\n\n${note}`).join("\n\n") : "_No notes yet._";
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

function generateSectionMarkdown(repo: RepoState, tab: RepoKind) {
  const notes = getRepoSectionNotes(repo, tab);
  const visualAssets = repo.assets.filter((asset) => {
    const haystack = `${asset.name} ${asset.description} ${asset.metadata.join(" ")}`.toLowerCase();
    if (tab === "Identity") {
      return ["logo", "logotype", "wordmark", "icon", "symbol", "element", "pattern", "graphic", "illustration"].some((term) =>
        haystack.includes(term),
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
    if (tab === "Identity") return ["logo", "wordmark", "logotype", "icon", "symbol", "pictogram", "illustration", "element"].some((term) => normalized.includes(term));
    if (tab === "Imagery") return normalized.includes("photo") || normalized.includes("image") || normalized.includes("imagery");
    return false;
  });

  if (tab === "Brand Basics") {
    return `# Brand Basics

## Brand name
${markdownLine(repo.company.name)}

## Website URL
${markdownLine(repo.company.website)}

## One-line description
${markdownLine(repo.company.description)}

## About
${markdownLine(repo.brand.description)}
`;
  }

  if (tab === "Identity") {
    const identity = getRepoIdentity(repo);
    const identityAssetMarkdown = identitySections
      .map((section) => {
        const singularTag = section.field.replace(/s$/, "");
        const sectionAssets = visualAssets.filter((asset) => asset.metadata.join(" ").toLowerCase().includes(singularTag));
        return `### ${section.label} files\n${
          sectionAssets.length
            ? sectionAssets
                .map((asset) =>
                  [
                    `- ${markdownLine(asset.name)}`,
                    asset.description ? `  Description: ${markdownLine(asset.description)}` : "",
                    asset.url ? `  URL: ${asset.url}` : "",
                  ]
                    .filter(Boolean)
                    .join("\n"),
                )
                .join("\n")
            : "_No files yet._"
        }`;
      })
      .join("\n\n");

    return `# Identity

${identitySections
  .map((section) => `## ${section.label}\n${markdownLine(identity[section.field])}`)
  .join("\n\n")}

## Uploaded files
${identityAssetMarkdown}
`;
  }

  if (tab === "Imagery") {
    return `# Imagery

## Usage guidance
${markdownList(rulesForTab)}

## Assets
${visualAssets.length ? visualAssets.map((asset) => `- ${asset.name}${asset.url ? `: ${asset.url}` : ""}`).join("\n") : "_No assets yet._"}

## Notes
${markdownNotes(notes)}
`;
  }

  if (tab === "Colors") {
    return `# Colors

## Palette
${getRepoColors(repo).length ? getRepoColors(repo).map((color) => `### ${markdownLine(color.name)}\n\n- Hex: ${markdownLine(color.hex)}\n- Description: ${markdownLine(color.description)}`).join("\n\n") : "_No colors yet._"}

## Rules
${markdownLine(getRepoColorRules(repo))}
`;
  }

  if (tab === "Voice & Tone") {
    return `# Voice & Tone

## Voice characteristics
${markdownList(repo.brand.voice)}

## Writing rules
${markdownList(repo.brand.rules)}

## Words/phrases to use
${markdownList(repo.brand.approvedTerms)}

## Words/phrases to avoid
${markdownList(repo.brand.prohibitedTerms)}
`;
  }

  if (tab === "Typography") {
    const typography = getRepoTypography(repo);

    return `# Typography

## Font names
${markdownList(typography.fontNames)}

## Weights
${markdownList(typography.weights)}

## Basic usage rules
${markdownLine(typography.usageRules)}
`;
  }

  if (tab === "Messaging") {
    const message = repo.messaging[0];
    const audience = repo.audiences[0];
    return `# Messaging

## Primary value proposition
${markdownLine(message?.valueProps[0] ?? message?.positioning)}

## Key messages
${markdownList(message?.keyMessages ?? [])}

## Target customer
${markdownLine(audience?.name)}

## Main customer problem
${markdownLine(audience?.painPoints[0])}

## Key differentiators
${markdownList(message?.proofPoints ?? [])}

## Tagline
${markdownLine(message?.taglines[0])}
`;
  }

  if (tab === "Audiences") {
    const audiences = getRepoAudienceSettings(repo);

    return `# Audiences

## Primary Audience
${markdownLine(audiences.primaryAudience)}

## Secondary Audiences
${markdownLine(audiences.secondaryAudiences)}

## Core Jobs to Be Done
${markdownLine(audiences.coreJobs)}

## Common Pain Points
${markdownLine(audiences.painPoints)}

## What Customers Want
${markdownLine(audiences.customerWants)}

## Notes
${markdownNotes(notes)}
`;
  }

  if (tab === "Channel SEO") {
    const channelSeo = getRepoChannelSeo(repo);

    return `# Channel SEO

## Output defaults
${markdownLine(channelSeo.outputDefaults)}

## Blog
${markdownLine(channelSeo.blog)}

## LinkedIn
${markdownLine(channelSeo.linkedin)}

## X
${markdownLine(channelSeo.x)}

## Instagram
${markdownLine(channelSeo.instagram)}

## Carousel
${markdownLine(channelSeo.carousel)}

## Closing lines
${markdownLine(channelSeo.closingLines)}

## SEO planning
${markdownLine(channelSeo.seoPlanning)}

## Keywords
${markdownLine(channelSeo.keywords)}

## Hashtags
${markdownLine(channelSeo.hashtags)}

## Success metrics
${markdownLine(channelSeo.successMetrics)}
`;
  }
}

function generateRepoMarkdownContext(repo: RepoState) {
  function assetContextUrl(asset: Asset) {
    if (!asset.url) return "";
    if (asset.url.startsWith("data:")) {
      return asset.storagePath ? "Uploaded file stored in BrandRepo storage." : "Local uploaded file available in BrandRepo.";
    }
    return asset.url;
  }

  const sectionMarkdown = repoTabs
    .map((tab) => `--- ${sectionMarkdownFileName(tab)} ---\n${generateSectionMarkdown(repo, tab)}`)
    .join("\n\n");
  const assetMarkdown = repo.assets.length
    ? repo.assets
        .map((asset) =>
          [
            `- ${asset.name}`,
            `  Type: ${asset.type}`,
            asset.description ? `  Description: ${asset.description}` : "",
            asset.metadata.length ? `  Metadata: ${asset.metadata.join(", ")}` : "",
            assetContextUrl(asset) ? `  URL: ${assetContextUrl(asset)}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        )
        .join("\n")
    : "_No assets uploaded._";

  return `${sectionMarkdown}\n\n--- assets.md ---\n# Assets\n${assetMarkdown}`;
}

function isImageGenerationPrompt(prompt: string) {
  const normalized = prompt.toLowerCase();
  const hasCreationIntent = /\b(generate|create|make|design|mock\s?up|mockup|draft|produce)\b/.test(normalized);
  const hasVisualTarget = /\b(image|ad|advertisement|mock\s?up|mockup|visual|poster|banner|social graphic|creative|asset)\b/.test(normalized);
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
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(!isSupabaseConfigured);
  const [authMode, setAuthMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authAccountName, setAuthAccountName] = useState("");
  const [authStatus, setAuthStatus] = useState<"idle" | "working" | "success" | "error">("idle");
  const [authError, setAuthError] = useState("");
  const [settingsAccountName, setSettingsAccountName] = useState("");
  const [settingsStatus, setSettingsStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [settingsError, setSettingsError] = useState("");
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [themePreferenceReady, setThemePreferenceReady] = useState(false);
  const [cloudHydrated, setCloudHydrated] = useState(false);
  const [syncStatus, setSyncStatus] = useState("Local only");
  const [section, setSection] = useState<NavSection>("Home");
  const [repoTab, setRepoTab] = useState<RepoKind>("Brand Basics");
  const [companyDraft, setCompanyDraft] = useState(initialRepo.company);
  const [brandBasicsStatus, setBrandBasicsStatus] = useState("Auto saved.");
  const [colorsStatus, setColorsStatus] = useState("Auto saved.");
  const [typographyStatus, setTypographyStatus] = useState("Auto saved.");
  const [channelSeoStatus, setChannelSeoStatus] = useState("Auto saved.");
  const [audiencesStatus, setAudiencesStatus] = useState("Auto saved.");
  const [identityStatus, setIdentityStatus] = useState("Auto saved.");
  const [voiceToneStatus, setVoiceToneStatus] = useState("Auto saved.");
  const [messagingStatus, setMessagingStatus] = useState("Auto saved.");
  const [persistenceReady, setPersistenceReady] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatStatus, setChatStatus] = useState<"idle" | "thinking" | "generating-image">("idle");
  const [importRun, setImportRun] = useState<ImportRun | null>(null);
  const [importStatus, setImportStatus] = useState<"idle" | "scanning" | "ready" | "importing" | "error">("idle");
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

  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? workspaces[0];
  const repo = activeWorkspace?.repo ?? initialRepo;
  const chatMessages = activeWorkspace?.chatMessages ?? createWelcomeChat();
  const hasChatConversation = chatMessages.some((message) => message.id !== "welcome");
  const visibleAssets = repo.assets.filter((asset) => asset.metadata.includes("generated") || !isRepoSectionVisualAsset(asset));
  const markdownDrawerContent = markdownDrawerSection ? generateSectionMarkdown(repo, markdownDrawerSection) : "";
  const markdownDrawerFileName = markdownDrawerSection ? sectionMarkdownFileName(markdownDrawerSection) : "";

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
    if (!supabase) return;

    supabase.auth.getUser().then(({ data }) => {
      setCurrentUser(data.user ?? null);
      setSettingsAccountName(getAccountName(data.user ?? null));
      setCloudHydrated(false);
      setAuthChecked(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
      setSettingsAccountName(getAccountName(session?.user ?? null));
      setSettingsStatus("idle");
      setSettingsError("");
      setCloudHydrated(false);
      setAuthChecked(true);
      setSyncStatus(session?.user ? "Loading repos..." : "Local only");
    });

    return () => listener.subscription.unsubscribe();
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
            setWorkspaces([migratedWorkspace]);
            setActiveWorkspaceId(migratedWorkspace.id);
            setCompanyDraft(parsed.company);
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
        setWorkspaces(storedWorkspaces);
        setActiveWorkspaceId(selectedWorkspace?.id ?? storedWorkspaces[0].id);
        setCompanyDraft(selectedWorkspace?.repo.company ?? initialRepo.company);
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
      const { data, error } = await supabase
        .from("brandhub_workspaces")
        .select("id,name,data")
        .eq("user_id", currentUser.id)
        .order("updated_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        setSyncStatus("Supabase setup needed");
        setCloudHydrated(true);
        return;
      }

      const rows = (data ?? []) as WorkspaceRow[];
      if (rows.length) {
        const cloudWorkspaces = rows.map((row) => ({ ...row.data, id: row.id, name: row.name }));
        const localActiveWorkspaceId = activeWorkspaceId || getLocallyActiveWorkspaceId();
        const selectedWorkspace =
          cloudWorkspaces.find((workspace) => workspace.id === localActiveWorkspaceId) ?? cloudWorkspaces[0];
        setWorkspaces(cloudWorkspaces);
        setActiveWorkspaceId(selectedWorkspace.id);
        window.localStorage.setItem(storageKey, JSON.stringify({ activeWorkspaceId: selectedWorkspace.id, workspaces: cloudWorkspaces }));
        setCompanyDraft(selectedWorkspace.repo.company);
        setImportRun(null);
        setImportStatus("idle");
        setImportError("");
        setChatInput("");
        setMarkdownDrawerSection(null);
        setSyncStatus("Synced to Supabase");
      } else {
        setSyncStatus("Ready to sync");
      }

      setCloudHydrated(true);
    }

    loadCloudWorkspaces();

    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId, cloudHydrated, currentUser, persistenceReady]);

  useEffect(() => {
    if (!supabase || !currentUser || !persistenceReady || !cloudHydrated) return;

    const saveTimer = window.setTimeout(async () => {
      setSyncStatus("Saving...");
      const payload = workspaces.map((workspace) => ({
        id: workspace.id,
        user_id: currentUser.id,
        name: workspace.name,
        data: workspace,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from("brandhub_workspaces").upsert(payload, { onConflict: "id" });
      setSyncStatus(error ? `Sync failed: ${error.message}` : "Synced to Supabase");
    }, 700);

    return () => window.clearTimeout(saveTimer);
  }, [cloudHydrated, currentUser, persistenceReady, workspaces]);

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
          .eq("user_id", currentUser.id)
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
        const selected = nextWorkspaces.find((workspace) => workspace.id === nextActiveId) ?? nextWorkspaces[0];
        setCompanyDraft(selected.repo.company);
        setImportRun(null);
        setImportStatus("idle");
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

  function startNewChat() {
    setChatInput("");
    setChatStatus("idle");
    updateChatMessages(() => createWelcomeChat());
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
    setWorkspaces((current) => [...current, nextWorkspace]);
    setActiveWorkspaceId(nextWorkspace.id);
    setCompanyDraft(nextWorkspace.repo.company);
    setImportRun(null);
    setImportStatus("idle");
    setImportError("");
    setMarkdownDrawerOpen(false);
    setMarkdownDrawerSection(null);
    setMessagingImportDrawerOpen(false);
    setMessagingImportDrawerMounted(false);
    setSection("Home");
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
        .eq("user_id", currentUser.id)
        .eq("id", deleteId);

      if (error) {
        setSyncStatus(`Delete failed: ${error.message}`);
        setImportError(`Unable to delete repo: ${error.message}`);
        return;
      }
    }

    const remainingWorkspaces = workspaces.filter((workspace) => workspace.id !== deleteId);
    const nextWorkspaces = remainingWorkspaces.length ? remainingWorkspaces : [createWorkspace()];
    const nextWorkspace = nextWorkspaces[0];

    setWorkspaces(nextWorkspaces);
    setRepoOverviewActive(true);
    setSection(nextWorkspace.repo.company.name.trim() ? "Repo" : "Home");
    setRepoTab("Brand Basics");
    resetTransientWorkspaceState(nextWorkspace, nextWorkspaces);
    setSyncStatus(supabase && currentUser ? "Synced to Supabase" : "Local only");
  }

  function resetTransientWorkspaceState(nextWorkspace: WorkspaceState, availableWorkspaces = workspaces) {
    setActiveWorkspaceId(nextWorkspace.id);
    if (persistenceReady) {
      window.localStorage.setItem(storageKey, JSON.stringify({ activeWorkspaceId: nextWorkspace.id, workspaces: availableWorkspaces }));
    }
    setCompanyDraft(nextWorkspace.repo.company);
    setImportRun(null);
    setImportStatus("idle");
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

  function handleRepoSelection(workspaceId: string) {
    if (workspaceId === "new-repo") {
      openNewRepoModal();
      return;
    }

    activateWorkspace(workspaceId);
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !authEmail.trim() || !authPassword) return;

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
    setCloudHydrated(false);
    setSyncStatus("Local only");
  }

  function switchAuthMode(mode: "sign-in" | "sign-up") {
    setAuthMode(mode);
    setAuthStatus("idle");
    setAuthError("");
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

  if (isSupabaseConfigured && !currentUser) {
    return (
      <main className="auth-page" data-theme={theme}>
        <section className="auth-card">
          <div className="brand-mark auth-brand">
            <BrandRepoLogo />
          </div>
          <div>
            <p className="eyebrow">{authMode === "sign-in" ? "Sign in" : "Create account"}</p>
            <h1>{authMode === "sign-in" ? "Sign in to BrandRepo." : "Create your BrandRepo account."}</h1>
            <p className="auth-subtitle">Your repos are saved to the account you use here.</p>
          </div>
          <form className="auth-form" onSubmit={submitAuth}>
            <div className="auth-mode-toggle" role="group" aria-label="Account mode">
              <button className={authMode === "sign-in" ? "active" : ""} onClick={() => switchAuthMode("sign-in")} type="button">
                Sign in
              </button>
              <button className={authMode === "sign-up" ? "active" : ""} onClick={() => switchAuthMode("sign-up")} type="button">
                Create account
              </button>
            </div>
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
            <label>
              Email
              <input
                autoComplete="email"
                onChange={(event) => setAuthEmail(event.target.value)}
                placeholder="you@example.com"
                type="email"
                value={authEmail}
              />
            </label>
            <label>
              Password
              <input
                autoComplete={authMode === "sign-in" ? "current-password" : "new-password"}
                minLength={6}
                onChange={(event) => setAuthPassword(event.target.value)}
                placeholder="Password"
                type="password"
                value={authPassword}
              />
            </label>
            <button disabled={authStatus === "working"} type="submit">
              {authStatus === "working" ? "Working..." : authMode === "sign-in" ? "Sign in" : "Create account"}
            </button>
            {authStatus === "success" && authMode === "sign-up" && (
              <span>Account created. If email confirmation is enabled, check your email before signing in.</span>
            )}
            {authError && <span>{authError}</span>}
          </form>
        </section>
      </main>
    );
  }

  const importTextLength = importRun?.sources.reduce((total, source) => total + source.text.length, 0) ?? 0;
  const importHasLowText = Boolean(importRun && importTextLength < 500);
  const isNewWorkspace =
    !repo.company.name.trim() &&
    repo.products.length === 0 &&
    repo.audiences.length === 0 &&
    repo.messaging.length === 0 &&
    repo.campaigns.length === 0 &&
    repo.assets.length === 0;

  function updateCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateRepo((current) => ({
      ...current,
      company: companyDraft,
      activity: [`Updated company context for ${companyDraft.name}`, ...current.activity],
    }));
  }

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

    setCompanyDraft((current) => ({
      ...current,
      [field]: value,
    }));
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

  async function scanBrandUrl() {
    const url = companyDraft.website.trim();
    if (!url) {
      setImportError("Add a URL before scanning.");
      setImportStatus("error");
      return;
    }

    setImportStatus("scanning");
    setImportError("");
    setImportRun(null);

    try {
      const response = await fetch("/api/import-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const payload = (await response.json()) as { importRun?: ImportRun; error?: string };

      if (!response.ok || !payload.importRun) {
        throw new Error(payload.error ?? "Unable to scan URL.");
      }

      setImportRun(payload.importRun);
      setImportStatus("ready");
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Unable to scan URL.");
      setImportStatus("error");
    }
  }

  function applyImportRun() {
    if (!importRun) return;

    setImportStatus("importing");

    const importedSources: Source[] = importRun.sources.map((source) => ({
      id: createId("source-url"),
      label: source.title || source.url,
      type: "structured",
    }));
    const sourceForImport = importedSources[0] ?? {
      id: createId("source-url"),
      label: importRun.startUrl,
      type: "structured" as const,
    };
    const extracted = importRun.extractedContext;
    const importedSectionUrls = sourceDocumentsToSectionUrls(importRun.sources);
    const assetSources = [sourceForImport];
    const importedAssets = extracted.assetUrls.map<Asset>((url) => ({
      id: createId("asset-url"),
      name: getNameFromUrl(url),
      type: classifyUpload(url),
      url,
      description: `Asset discovered while scanning ${importRun.startUrl}.`,
      metadata: ["url import", classifyUpload(url).toLowerCase()],
      uploadedAt: new Date().toISOString().slice(0, 10),
      sources: assetSources,
    }));
    const messaging: Messaging[] = extracted.positioning
      ? [
          {
            id: createId("message-url"),
            positioning: extracted.positioning,
            valueProps: extracted.keyMessages.slice(0, 3),
            taglines: [],
            keyMessages: extracted.keyMessages,
            proofPoints: importRun.sources.map((source) => source.title),
            claims: [],
            sources: importedSources,
          },
        ]
      : [];

    updateRepo((current) => ({
      ...current,
      company: {
        name: current.company.name || companyDraft.name || extracted.companyName,
        website: current.company.website || companyDraft.website || importRun.startUrl,
        description: current.company.description || companyDraft.description || extracted.companyDescription,
      },
      brand: {
        ...current.brand,
        description: current.brand.description || extracted.brandDescription || `Imported source content from ${importRun.startUrl}.`,
        voice: [...new Set([...current.brand.voice, ...extracted.voice])],
        rules: [...new Set([...current.brand.rules, ...extracted.rules])],
        approvedTerms: [...new Set([...current.brand.approvedTerms, ...extracted.approvedTerms])],
        prohibitedTerms: [...new Set([...current.brand.prohibitedTerms, ...extracted.prohibitedTerms])],
        sources: [...importedSources, ...current.brand.sources],
      },
      messaging: [...messaging, ...current.messaging],
      assets: [...importedAssets, ...current.assets],
      sectionUrls: mergeSectionUrls(current.sectionUrls, importedSectionUrls),
      activity: [`Imported ${importRun.sources.length} URL source${importRun.sources.length === 1 ? "" : "s"}`, ...current.activity],
    }));
    setCompanyDraft((current) => ({
      name: current.name || extracted.companyName,
      website: current.website || importRun.startUrl,
      description: current.description || extracted.companyDescription,
    }));
    setImportStatus("idle");
    setImportRun(null);
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
          repoContext: generateRepoMarkdownContext(repo),
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
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand-mark">
          <BrandRepoLogo />
        </div>
        <div className="workspace-switcher">
          <label>
            <select aria-label="Select repo" value={activeWorkspace?.id ?? ""} onChange={(event) => handleRepoSelection(event.target.value)}>
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
              <option value="new-repo">New repo...</option>
            </select>
          </label>
        </div>
        <nav>
          {navItems.map((item) => (
            <div className="nav-group" key={item}>
              <div className="nav-row">
                <button
                  className={section === item ? "active" : ""}
                  onClick={() => {
                    if (item === "Repo") {
                      setSection("Repo");
                      setRepoOverviewActive(true);
                      return;
                    }
                    setSection(item);
                  }}
                >
                  {item}
                </button>
                {item === "Chat" ? (
                  <button
                    aria-label="New chat"
                    className="nav-icon-button"
                    disabled={chatStatus !== "idle"}
                    onClick={startNewChat}
                    title="New chat"
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
                        }}
                        type="button"
                      >
                        {repoSection}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </nav>
        <nav className="rail-footer" aria-label="Account navigation">
          <button className={section === "Settings" ? "active" : ""} onClick={() => setSection("Settings")}>
            Settings
          </button>
        </nav>
      </aside>

      <section className="workspace">
        {section === "Home" && (
          <div className="home-intro">
            <section className="home-copy">
              <p className="eyebrow">BrandRepo</p>
              <h1>A Marketing Repo for company context.</h1>
              <p>
                BrandRepo keeps brand, product, audience, messaging, campaign, and asset knowledge in one structured place
                so marketing work can build on the context you add over time.
              </p>
              <button onClick={() => setSection("Repo")}>Get started</button>
            </section>
            <form className="setup-panel" onSubmit={updateCompany}>
              <div>
                <p className="eyebrow">{isNewWorkspace ? "New repo" : "Repo setup"}</p>
                <h2>Start with your company basics.</h2>
                <p className="form-note">Changes save automatically after you apply them.</p>
              </div>
              <label>
                Company name
                <input
                  onChange={(event) => setCompanyDraft({ ...companyDraft, name: event.target.value })}
                  value={companyDraft.name}
                />
              </label>
              <label>
                Website URL
                <input
                  onChange={(event) => setCompanyDraft({ ...companyDraft, website: event.target.value })}
                  value={companyDraft.website}
                />
              </label>
              <div className="url-scan-row">
                <button disabled={importStatus === "scanning"} onClick={scanBrandUrl} type="button">
                  {importStatus === "scanning" ? "Scanning..." : "Scan URL"}
                </button>
                <span>{importStatus === "ready" ? "Scan ready to review" : "Optional: scan a public brand guideline URL."}</span>
              </div>
              <button type="submit">Update repo</button>
            </form>
            {importError && <p className="import-error">{importError}</p>}
            {importRun && (
              <section className="import-review">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">URL import review</p>
                    <h2>{importRun.extractedContext.companyName || "Scanned brand site"}</h2>
                  </div>
                  <button disabled={importStatus === "importing" || importHasLowText} onClick={applyImportRun}>
                    {importHasLowText ? "Needs rendered scan" : importStatus === "importing" ? "Importing..." : "Import into repo"}
                  </button>
                </div>
                <p>{importRun.extractedContext.companyDescription || importRun.extractedContext.brandDescription || "BrandRepo found source content that can seed this repo."}</p>
                <div className="import-summary">
                  <span>{pluralize(importRun.sources.length, "page")} scanned</span>
                  <span>{pluralize(importRun.extractedContext.assetUrls.length, "asset")} found</span>
                  <span>{pluralize(importRun.extractedContext.rules.length, "rule")} found</span>
                </div>
                {importHasLowText && (
                  <p className="import-warning">
                    This scan found very little readable text. The site likely renders its guideline content in JavaScript, so BrandRepo should use a rendered crawler before importing it.
                  </p>
                )}
                <div className="import-sources">
                  {importRun.sources.slice(0, 5).map((source) => (
                    <article key={source.id}>
                      <strong>{source.title}</strong>
                      <small>{source.url}</small>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </div>
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
                repo={repo}
              />
            ) : null}
            {!isNewWorkspace && !repoOverviewActive ? (
              <RepoPanel
                channelSeoStatus={channelSeoStatus}
                colorsStatus={colorsStatus}
                onScanSectionUrl={scanSectionUrl}
                onUpdateBrandBasics={updateBrandBasics}
                onAddColorToken={addColorToken}
                onDeleteColorToken={deleteColorToken}
                onDeleteAsset={deleteAsset}
                onUpdateAssetDetails={updateAssetDetails}
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
                onUpdateTypographyField={updateTypographyField}
                onUpdateColorRules={updateColorRules}
                onUpdateColorToken={updateColorToken}
                onUpdateMessagingField={updateMessagingField}
                onUpdateVoiceToneField={updateVoiceToneField}
                repo={repo}
                scanningUrl={sectionScanUrl}
                tab={repoTab}
                typographyStatus={typographyStatus}
                voiceToneStatus={voiceToneStatus}
              />
            ) : null}
          </div>
        )}

        {section === "Chat" && (
          <section className={`chat-layout ${hasChatConversation ? "has-conversation" : "is-empty"}`}>
            {!hasChatConversation ? (
              <div className="chat-empty-state">
                <h1>Ready when you are.</h1>
              </div>
            ) : (
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
                    {message.citations?.length && !message.generatedImage ? (
                      <div className="citations">
                        {message.citations.map((source) => (
                          <span key={`${message.id}-${source.id}`}>{source.label}</span>
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
            )}
            <form className="chat-input" onSubmit={sendChat}>
              <input
                disabled={chatStatus !== "idle"}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder="Ask BrandRepo about your brand"
                value={chatInput}
              />
              <button disabled={!chatInput.trim() || chatStatus !== "idle"} type="submit">
                {chatStatus === "generating-image" ? "..." : chatStatus === "thinking" ? "..." : "Ask"}
              </button>
            </form>
          </section>
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
                <AssetCard asset={asset} key={asset.id} onDelete={deleteAsset} />
              )) : <EmptyState title="No assets yet" description="Uploaded brand guides, decks, documents, images, and other source material will appear here." />}
            </section>
          </div>
        )}

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
    </main>
  );
}

function RepoPanel({
  audiencesStatus,
  brandBasicsStatus,
  channelSeoStatus,
  colorsStatus,
  identityField,
  identityStatus,
  lastSectionScan,
  messagingStatus,
  onAddColorToken,
  onDeleteAsset,
  onDeleteColorToken,
  onDeleteSectionMarkdown,
  onScanSectionUrl,
  onUpdateAssetDetails,
  onUpdateAudienceField,
  onUpdateBrandBasics,
  onUpdateChannelSeoField,
  onUpdateColorRules,
  onUpdateColorToken,
  onUpdateIdentityField,
  onUpdateMessagingField,
  onUpdateSectionMarkdown,
  onUpdateTypographyField,
  onUpdateVoiceToneField,
  onUploadSectionAssets,
  onViewMarkdown,
  repo,
  scanningUrl,
  tab,
  typographyStatus,
  voiceToneStatus,
}: {
  audiencesStatus: string;
  brandBasicsStatus: string;
  channelSeoStatus: string;
  colorsStatus: string;
  identityField: IdentityField;
  identityStatus: string;
  lastSectionScan: { tab: RepoKind; url: string } | null;
  messagingStatus: string;
  onAddColorToken: () => void;
  onDeleteAsset: (assetId: string) => void;
  onDeleteColorToken: (colorId: string) => void;
  onDeleteSectionMarkdown: (tab: RepoKind, index: number) => void;
  onScanSectionUrl: (url: string, tab: RepoKind) => void;
  onUpdateAssetDetails: (assetId: string, field: "name" | "description", value: string) => void;
  onUpdateAudienceField: (field: keyof AudienceSettings, value: string) => void;
  onUpdateBrandBasics: (field: "name" | "website" | "description" | "about", value: string) => void;
  onUpdateChannelSeoField: (field: keyof ChannelSeoSettings, value: string) => void;
  onUpdateColorRules: (value: string) => void;
  onUpdateColorToken: (colorId: string, field: "name" | "hex" | "description", value: string) => void;
  onUpdateIdentityField: (field: IdentityField, value: string) => void;
  onUpdateMessagingField: (
    field: "primaryValueProposition" | "keyMessages" | "targetCustomer" | "mainCustomerProblem" | "keyDifferentiators" | "tagline",
    value: string,
  ) => void;
  onUpdateSectionMarkdown: (tab: RepoKind, index: number, markdown: string) => void;
  onUpdateTypographyField: (field: "fontNames" | "weights" | "usageRules", value: string) => void;
  onUpdateVoiceToneField: (
    field: "voiceCharacteristics" | "writingRules" | "wordsToUse" | "wordsToAvoid",
    value: string,
  ) => void;
  onUploadSectionAssets: (files: FileList | null, tab: RepoKind, assetTag?: string) => void;
  onViewMarkdown: (tab: RepoKind) => void;
  repo: RepoState;
  scanningUrl: string;
  tab: RepoKind;
  typographyStatus: string;
  voiceToneStatus: string;
}) {
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

  if (tab === "Brand Basics") {
    return (
      <section className="repo-panel">
        <RepoSectionHeader fileName={sectionMarkdownFileName(tab)} onViewMarkdown={() => onViewMarkdown(tab)} title="Brand Basics" />
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
        <RepoSectionHeader fileName={sectionMarkdownFileName(tab)} onViewMarkdown={() => onViewMarkdown(tab)} title="Identity" />
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
                      editable
                      key={asset.id}
                      onDelete={onDeleteAsset}
                      onUpdate={onUpdateAssetDetails}
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
                      editable
                      key={asset.id}
                      onDelete={onDeleteAsset}
                      onUpdate={onUpdateAssetDetails}
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
                      editable
                      key={asset.id}
                      onDelete={onDeleteAsset}
                      onUpdate={onUpdateAssetDetails}
                    />
                  ))}
                </section>
              ) : null}
            </section>
          ) : null}
          <label>
            {activeIdentitySection.label}
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
        <RepoSectionHeader fileName={sectionMarkdownFileName(tab)} onViewMarkdown={() => onViewMarkdown(tab)} title={tab} />
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
                <AssetCard asset={asset} compact key={asset.id} onDelete={onDeleteAsset} />
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
        <RepoSectionHeader fileName={sectionMarkdownFileName(tab)} onViewMarkdown={() => onViewMarkdown(tab)} title="Colors" />
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
    return (
      <section className="repo-panel">
        <RepoSectionHeader fileName={sectionMarkdownFileName(tab)} onViewMarkdown={() => onViewMarkdown(tab)} title="Voice & Tone" />
        <div className="basic-fields">
          <label>
            Voice characteristics
            <textarea
              onChange={(event) => onUpdateVoiceToneField("voiceCharacteristics", event.target.value)}
              value={repo.brand.voice.join("\n")}
            />
          </label>
          <label>
            Writing rules
            <textarea
              onChange={(event) => onUpdateVoiceToneField("writingRules", event.target.value)}
              value={repo.brand.rules.join("\n")}
            />
          </label>
          <label>
            Words/phrases to use
            <textarea
              onChange={(event) => onUpdateVoiceToneField("wordsToUse", event.target.value)}
              value={repo.brand.approvedTerms.join("\n")}
            />
          </label>
          <label>
            Words/phrases to avoid
            <textarea
              onChange={(event) => onUpdateVoiceToneField("wordsToAvoid", event.target.value)}
              value={repo.brand.prohibitedTerms.join("\n")}
            />
          </label>
          <p className="autosave-status">{voiceToneStatus}</p>
        </div>
      </section>
    );
  }

  if (tab === "Typography") {
    const typography = getRepoTypography(repo);

    return (
      <section className="repo-panel">
        <RepoSectionHeader fileName={sectionMarkdownFileName(tab)} onViewMarkdown={() => onViewMarkdown(tab)} title="Typography" />
        <div className="basic-fields">
          <label>
            Font names
            <textarea
              onChange={(event) => onUpdateTypographyField("fontNames", event.target.value)}
              value={typography.fontNames.join("\n")}
            />
          </label>
          <label>
            Weights
            <textarea
              onChange={(event) => onUpdateTypographyField("weights", event.target.value)}
              value={typography.weights.join("\n")}
            />
          </label>
          <label>
            Basic usage rules
            <textarea
              onChange={(event) => onUpdateTypographyField("usageRules", event.target.value)}
              value={typography.usageRules}
            />
          </label>
          <p className="autosave-status">{typographyStatus}</p>
        </div>
      </section>
    );
  }

  if (tab === "Messaging") {
    const message = repo.messaging[0];
    const audience = repo.audiences[0];
    return (
      <section className="repo-panel">
        <RepoSectionHeader fileName={sectionMarkdownFileName(tab)} onViewMarkdown={() => onViewMarkdown(tab)} title="Messaging" />
        <div className="basic-fields">
          <label>
            Primary value proposition
            <textarea
              onChange={(event) => onUpdateMessagingField("primaryValueProposition", event.target.value)}
              value={message?.valueProps[0] ?? message?.positioning ?? ""}
            />
          </label>
          <label>
            3-5 key messages
            <textarea
              onChange={(event) => onUpdateMessagingField("keyMessages", event.target.value)}
              value={message?.keyMessages.join("\n") ?? ""}
            />
          </label>
          <label>
            Target customer
            <input
              onChange={(event) => onUpdateMessagingField("targetCustomer", event.target.value)}
              value={audience?.name ?? ""}
            />
          </label>
          <label>
            Main customer problem
            <textarea
              onChange={(event) => onUpdateMessagingField("mainCustomerProblem", event.target.value)}
              value={audience?.painPoints[0] ?? ""}
            />
          </label>
          <label>
            Key differentiators
            <textarea
              onChange={(event) => onUpdateMessagingField("keyDifferentiators", event.target.value)}
              value={message?.proofPoints.join("\n") ?? ""}
            />
          </label>
          <label>
            Tagline, if one exists
            <input
              onChange={(event) => onUpdateMessagingField("tagline", event.target.value)}
              value={message?.taglines[0] ?? ""}
            />
          </label>
          <p className="autosave-status">{messagingStatus}</p>
        </div>
      </section>
    );
  }

  if (tab === "Audiences") {
    const audiences = getRepoAudienceSettings(repo);

    return (
      <section className="repo-panel">
        <RepoSectionHeader fileName={sectionMarkdownFileName(tab)} onViewMarkdown={() => onViewMarkdown(tab)} title="Audiences" />
        <div className="basic-fields">
          <label>
            Primary audience
            <textarea
              onChange={(event) => onUpdateAudienceField("primaryAudience", event.target.value)}
              value={audiences.primaryAudience}
            />
          </label>
          <label>
            Secondary audiences
            <textarea
              onChange={(event) => onUpdateAudienceField("secondaryAudiences", event.target.value)}
              value={audiences.secondaryAudiences}
            />
          </label>
          <label>
            Core jobs to be done
            <textarea
              onChange={(event) => onUpdateAudienceField("coreJobs", event.target.value)}
              value={audiences.coreJobs}
            />
          </label>
          <label>
            Common pain points
            <textarea
              onChange={(event) => onUpdateAudienceField("painPoints", event.target.value)}
              value={audiences.painPoints}
            />
          </label>
          <label>
            What customers want
            <textarea
              onChange={(event) => onUpdateAudienceField("customerWants", event.target.value)}
              value={audiences.customerWants}
            />
          </label>
          <p className="autosave-status">{audiencesStatus}</p>
        </div>
      </section>
    );
  }

  if (tab === "Channel SEO") {
    const channelSeo = getRepoChannelSeo(repo);

    return (
      <section className="repo-panel">
        <RepoSectionHeader fileName={sectionMarkdownFileName(tab)} onViewMarkdown={() => onViewMarkdown(tab)} title="Channel SEO" />
        <div className="basic-fields">
          <label>
            Output defaults
            <textarea onChange={(event) => onUpdateChannelSeoField("outputDefaults", event.target.value)} value={channelSeo.outputDefaults} />
          </label>
          <label>
            Blog
            <textarea onChange={(event) => onUpdateChannelSeoField("blog", event.target.value)} value={channelSeo.blog} />
          </label>
          <label>
            LinkedIn
            <textarea onChange={(event) => onUpdateChannelSeoField("linkedin", event.target.value)} value={channelSeo.linkedin} />
          </label>
          <label>
            X
            <textarea onChange={(event) => onUpdateChannelSeoField("x", event.target.value)} value={channelSeo.x} />
          </label>
          <label>
            Instagram
            <textarea onChange={(event) => onUpdateChannelSeoField("instagram", event.target.value)} value={channelSeo.instagram} />
          </label>
          <label>
            Carousel
            <textarea onChange={(event) => onUpdateChannelSeoField("carousel", event.target.value)} value={channelSeo.carousel} />
          </label>
          <label>
            Closing lines
            <textarea onChange={(event) => onUpdateChannelSeoField("closingLines", event.target.value)} value={channelSeo.closingLines} />
          </label>
          <label>
            SEO planning
            <textarea onChange={(event) => onUpdateChannelSeoField("seoPlanning", event.target.value)} value={channelSeo.seoPlanning} />
          </label>
          <label>
            Keywords
            <textarea onChange={(event) => onUpdateChannelSeoField("keywords", event.target.value)} value={channelSeo.keywords} />
          </label>
          <label>
            Hashtags
            <textarea onChange={(event) => onUpdateChannelSeoField("hashtags", event.target.value)} value={channelSeo.hashtags} />
          </label>
          <label>
            Success metrics
            <textarea onChange={(event) => onUpdateChannelSeoField("successMetrics", event.target.value)} value={channelSeo.successMetrics} />
          </label>
          <p className="autosave-status">{channelSeoStatus}</p>
        </div>
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

function RepoOverview({
  onDeleteRepo,
  onSelectSection,
  repo,
}: {
  onDeleteRepo: () => void;
  onSelectSection: (tab: RepoKind) => void;
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

function RepoSectionHeader({
  fileName,
  onViewMarkdown,
  title,
}: {
  fileName: string;
  onViewMarkdown: () => void;
  title: string;
}) {
  return (
    <div className="repo-section-header">
      <div>
        <h2>{title}</h2>
        <span>{fileName}</span>
      </div>
      <button className="secondary" onClick={onViewMarkdown} type="button">
        View .md
      </button>
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
  editable = false,
  onDelete,
  onUpdate,
}: {
  asset: Asset;
  compact?: boolean;
  editable?: boolean;
  onDelete?: (assetId: string) => void;
  onUpdate?: (assetId: string, field: "name" | "description", value: string) => void;
}) {
  return (
    <article className={compact ? "asset-card compact" : "asset-card"}>
      {isPreviewableAsset(asset) ? (
        <a className="asset-preview" href={asset.url} rel="noreferrer" target="_blank">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt={asset.name} src={asset.url} />
        </a>
      ) : (
        <div className="asset-preview asset-preview-empty">
          <span>{asset.type}</span>
        </div>
      )}
      {editable && onUpdate ? (
        <div className="asset-edit-fields">
          <label>
            Name
            <input onChange={(event) => onUpdate(asset.id, "name", event.target.value)} value={asset.name} />
          </label>
          <label>
            Description
            <textarea onChange={(event) => onUpdate(asset.id, "description", event.target.value)} value={asset.description} />
          </label>
        </div>
      ) : null}
      <div className="asset-actions">
        {asset.url ? (
          <a className="asset-link" href={asset.url} rel="noreferrer" target="_blank">
            Open
          </a>
        ) : null}
        {onDelete ? (
          <button className="asset-delete" onClick={() => onDelete(asset.id)} type="button">
            Delete
          </button>
        ) : null}
      </div>
    </article>
  );
}
