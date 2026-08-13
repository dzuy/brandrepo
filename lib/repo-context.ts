import {
  Asset,
  RepoKind,
  RepoState,
  WorkspaceState,
  normalizeAudienceSettings,
  normalizeChannelSeoSettings,
  normalizeColorTokens,
  normalizeIdentitySettings,
  normalizeTypographySettings,
  repoTabs,
} from "./repo-model";

export type RepoAssetKind = "logo" | "icon" | "element" | "imagery" | "generated" | "document" | "other";

export type RepoContextAsset = {
  id: string;
  kind: RepoAssetKind;
  name: string;
  description?: string;
  url?: string;
  mimeType?: string;
  storagePath?: string;
  section?: string;
  metadata: string[];
  uploadedAt: string;
};

export type RepoContextSection = {
  key: string;
  title: RepoKind;
  markdownFileName: string;
  markdown: string;
  structuredData: unknown;
};

export type RepoContext = {
  repo: {
    id: string;
    name: string;
    slug: string;
    websiteUrl?: string;
  };
  sections: RepoContextSection[];
  assets: RepoContextAsset[];
  markdown: string;
};

export type RepoContextOptions = {
  includeAssets?: boolean;
  includeAssetUrls?: boolean;
  maxMarkdownLength?: number;
  assetKinds?: RepoAssetKind[];
};

const defaultMaxMarkdownLength = 60_000;

const identitySections: { field: "logos" | "icons" | "elements" | "usage"; label: string }[] = [
  { field: "logos", label: "Logos" },
  { field: "icons", label: "Icons" },
  { field: "elements", label: "Elements" },
  { field: "usage", label: "Usage" },
];

export function sectionMarkdownFileName(tab: RepoKind) {
  return `${tab.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}.md`;
}

export function sectionKey(tab: RepoKind) {
  return sectionMarkdownFileName(tab).replace(/\.md$/, "");
}

export function markdownLine(value: string | undefined) {
  return value?.trim() || "_Not set._";
}

export function markdownList(values: string[]) {
  return values.length ? values.map((value) => `- ${value}`).join("\n") : "_None yet._";
}

export function markdownNotes(notes: string[]) {
  return notes.length ? notes.map((note, index) => `### Note ${index + 1}\n\n${note}`).join("\n\n") : "_No notes yet._";
}

export function getRepoSectionNotes(repo: RepoState, tab: RepoKind) {
  const notes = repo.sectionNotes ?? {};
  return notes[tab] ?? [];
}

export function getRepoColors(repo: RepoState) {
  return normalizeColorTokens(repo.colors);
}

export function getRepoColorRules(repo: RepoState) {
  return repo.colorRules ?? "";
}

export function getRepoTypography(repo: RepoState) {
  return normalizeTypographySettings(repo.typography);
}

export function getRepoAudienceSettings(repo: RepoState) {
  return normalizeAudienceSettings(repo.audienceSettings);
}

export function getRepoChannelSeo(repo: RepoState) {
  return normalizeChannelSeoSettings(repo.channelSeo);
}

export function getRepoIdentity(repo: RepoState) {
  return normalizeIdentitySettings(repo.identity);
}

function stableSlug(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "untitled-repo";
}

function assetContextUrl(asset: Asset, includeAssetUrls: boolean) {
  if (!includeAssetUrls || !asset.url) return "";
  if (asset.url.startsWith("data:")) {
    return asset.storagePath ? "Uploaded file stored in BrandRepo storage." : "Local uploaded file available in BrandRepo.";
  }
  return asset.url;
}

function assetHaystack(asset: Asset) {
  return `${asset.name} ${asset.description} ${asset.metadata.join(" ")}`.toLowerCase();
}

export function classifyRepoAsset(asset: Asset): RepoAssetKind {
  const haystack = assetHaystack(asset);
  const metadata = asset.metadata.join(" ").toLowerCase();

  if (metadata.includes("generated")) return "generated";
  if (asset.type !== "Image") return asset.type === "Document" || asset.type === "PDF" || asset.type === "Presentation" ? "document" : "other";
  if (["logo", "wordmark", "logotype"].some((term) => haystack.includes(term))) return "logo";
  if (["icon", "favicon", "symbol"].some((term) => haystack.includes(term))) return "icon";
  if (["element", "pattern", "graphic", "illustration"].some((term) => haystack.includes(term))) return "element";
  if (["imagery", "photo", "photography", "image"].some((term) => haystack.includes(term))) return "imagery";
  return "other";
}

function sectionForAsset(asset: Asset, kind: RepoAssetKind) {
  if (kind === "logo" || kind === "icon" || kind === "element") return "Identity";
  if (kind === "imagery") return "Imagery";
  if (kind === "generated") return "Assets";
  return undefined;
}

export function normalizeRepoContextAsset(asset: Asset, options: RepoContextOptions = {}): RepoContextAsset {
  const kind = classifyRepoAsset(asset);

  return {
    id: asset.id,
    kind,
    name: asset.name,
    description: asset.description || undefined,
    url: assetContextUrl(asset, options.includeAssetUrls ?? true) || undefined,
    storagePath: asset.storagePath,
    section: sectionForAsset(asset, kind),
    metadata: asset.metadata,
    uploadedAt: asset.uploadedAt,
  };
}

function visualAssetsForSection(repo: RepoState, tab: RepoKind) {
  return repo.assets.filter((asset) => {
    const haystack = assetHaystack(asset);
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
}

export function generateSectionMarkdown(repo: RepoState, tab: RepoKind) {
  const notes = getRepoSectionNotes(repo, tab);
  const visualAssets = visualAssetsForSection(repo, tab);
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
                    asset.url && !asset.url.startsWith("data:") ? `  URL: ${asset.url}` : "",
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
${visualAssets.length ? visualAssets.map((asset) => `- ${asset.name}${asset.url && !asset.url.startsWith("data:") ? `: ${asset.url}` : ""}`).join("\n") : "_No assets yet._"}

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

function structuredDataForSection(repo: RepoState, tab: RepoKind) {
  if (tab === "Brand Basics") {
    return {
      brandName: repo.company.name,
      websiteUrl: repo.company.website,
      oneLineDescription: repo.company.description,
      about: repo.brand.description,
    };
  }
  if (tab === "Identity") return getRepoIdentity(repo);
  if (tab === "Colors") return { colors: getRepoColors(repo), rules: getRepoColorRules(repo) };
  if (tab === "Voice & Tone") {
    return {
      voiceCharacteristics: repo.brand.voice,
      writingRules: repo.brand.rules,
      wordsToUse: repo.brand.approvedTerms,
      wordsToAvoid: repo.brand.prohibitedTerms,
    };
  }
  if (tab === "Typography") return getRepoTypography(repo);
  if (tab === "Messaging") {
    const message = repo.messaging[0];
    const audience = repo.audiences[0];
    return {
      primaryValueProposition: message?.valueProps[0] ?? message?.positioning ?? "",
      keyMessages: message?.keyMessages ?? [],
      targetCustomer: audience?.name ?? "",
      mainCustomerProblem: audience?.painPoints[0] ?? "",
      keyDifferentiators: message?.proofPoints ?? [],
      tagline: message?.taglines[0] ?? "",
    };
  }
  if (tab === "Audiences") return getRepoAudienceSettings(repo);
  if (tab === "Channel SEO") return getRepoChannelSeo(repo);
  return {
    assets: visualAssetsForSection(repo, tab).map((asset) => normalizeRepoContextAsset(asset)),
    notes: getRepoSectionNotes(repo, tab),
  };
}

export function getSectionByKey(section: string): RepoKind | null {
  const normalized = section.toLowerCase().replace(/\.md$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return repoTabs.find((tab) => sectionKey(tab) === normalized || tab.toLowerCase() === section.toLowerCase()) ?? null;
}

function truncateMarkdown(markdown: string, maxLength: number) {
  if (markdown.length <= maxLength) return markdown;
  return `${markdown.slice(0, maxLength).trimEnd()}\n\n[Truncated by BrandRepo context limit.]`;
}

export function getRepoContext(workspace: WorkspaceState, options: RepoContextOptions = {}): RepoContext {
  const includeAssets = options.includeAssets ?? true;
  const includeAssetUrls = options.includeAssetUrls ?? true;
  const maxMarkdownLength = options.maxMarkdownLength ?? defaultMaxMarkdownLength;
  const assetKindFilter = options.assetKinds ? new Set(options.assetKinds) : null;

  const sections = repoTabs.map((tab) => ({
    key: sectionKey(tab),
    title: tab,
    markdownFileName: sectionMarkdownFileName(tab),
    markdown: generateSectionMarkdown(workspace.repo, tab),
    structuredData: structuredDataForSection(workspace.repo, tab),
  }));
  const assets = includeAssets
    ? workspace.repo.assets
        .map((asset) => normalizeRepoContextAsset(asset, { ...options, includeAssetUrls }))
        .filter((asset) => !assetKindFilter || assetKindFilter.has(asset.kind))
    : [];
  const assetMarkdown = assets.length
    ? assets
        .map((asset) =>
          [
            `- ${asset.name}`,
            `  Kind: ${asset.kind}`,
            asset.description ? `  Description: ${asset.description}` : "",
            asset.metadata.length ? `  Metadata: ${asset.metadata.join(", ")}` : "",
            asset.url ? `  URL: ${asset.url}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        )
        .join("\n")
    : "_No assets uploaded._";
  const rawMarkdown = `${sections
    .map((section) => `--- ${section.markdownFileName} ---\n${section.markdown}`)
    .join("\n\n")}\n\n--- assets.md ---\n# Assets\n${assetMarkdown}`;
  const markdown = truncateMarkdown(rawMarkdown, maxMarkdownLength);

  return {
    repo: {
      id: workspace.id,
      name: workspace.name || workspace.repo.company.name || "Untitled repo",
      slug: stableSlug(workspace.name || workspace.repo.company.name),
      websiteUrl: workspace.repo.company.website || undefined,
    },
    sections,
    assets,
    markdown,
  };
}

export function searchRepoContext(context: RepoContext, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  const sectionMatches = context.sections
    .map((section) => {
      const haystack = `${section.title} ${section.markdown}`.toLowerCase();
      const index = haystack.indexOf(normalizedQuery);
      if (index === -1) return null;
      const source = section.markdown;
      const snippetStart = Math.max(0, index - 80);
      const snippetEnd = Math.min(source.length, index + normalizedQuery.length + 180);
      return {
        type: "section" as const,
        title: section.title,
        key: section.key,
        markdownFileName: section.markdownFileName,
        snippet: source.slice(snippetStart, snippetEnd).trim(),
      };
    })
    .filter((match): match is NonNullable<typeof match> => Boolean(match));
  const assetMatches = context.assets
    .filter((asset) => `${asset.name} ${asset.description ?? ""} ${asset.metadata.join(" ")}`.toLowerCase().includes(normalizedQuery))
    .map((asset) => ({
      type: "asset" as const,
      id: asset.id,
      kind: asset.kind,
      name: asset.name,
      description: asset.description,
    }));

  return [...sectionMatches, ...assetMatches].slice(0, 12);
}

