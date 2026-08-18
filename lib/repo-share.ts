import {
  classifyRepoAsset,
  generateSectionMarkdown,
  getRepoAssetCounts,
  getRepoApprovedClaims,
  getRepoAudienceSettings,
  getRepoColors,
  getRepoIdentity,
  getRepoProducts,
  getRepoTypography,
} from "./repo-context";
import { Asset, WorkspaceState, repoTabs } from "./repo-model";

export type RepoVisibility = "public" | "unlisted" | "private";

const defaultPublicBaseUrl = "https://brandrepo.dev";
const reservedAccountSlugs = new Set([
  "api",
  "create",
  "settings",
  "login",
  "logout",
  "oauth",
  "assets",
  "connected-apps",
  "favicon.ico",
]);

export function slugify(value: string, fallback = "untitled-repo") {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || fallback;
}

export function getAccountSlug(accountName: string) {
  return slugify(accountName, "account");
}

export function getRepoSlug(workspace: WorkspaceState) {
  return slugify(workspace.name || workspace.repo.company.name, "untitled-repo");
}

export function isReservedAccountSlug(accountSlug: string) {
  return reservedAccountSlugs.has(accountSlug.toLowerCase());
}

export function getPublicBaseUrl() {
  return (process.env.NEXT_PUBLIC_BRANDREPO_URL || defaultPublicBaseUrl).replace(/\/+$/, "");
}

export function getRepoCanonicalPath(accountSlug: string, repoSlug: string) {
  return `/${getAccountSlug(accountSlug)}/${slugify(repoSlug)}`;
}

export function getRepoCanonicalUrl(accountSlug: string, repoSlug: string) {
  return `${getPublicBaseUrl()}${getRepoCanonicalPath(accountSlug, repoSlug)}`;
}

export function getAiSharePrompt({
  accountSlug,
  repoSlug,
}: {
  accountSlug: string;
  repoSlug: string;
}) {
  return `Use this BrandRepo as the source of truth for this brand:

${getRepoCanonicalUrl(accountSlug, repoSlug)}

Read the relevant brand guidelines and assets before creating anything. Follow the brand's messaging, voice and tone, visual identity, audience guidance, and usage rules.`;
}

export function getWorkspaceVisibility(workspace: WorkspaceState): RepoVisibility {
  return workspace.visibility ?? "public";
}

export function usefulAssetKinds(asset: Asset) {
  const kind = classifyRepoAsset(asset);
  return kind === "logo" || kind === "icon" || kind === "element" || kind === "imagery";
}

function hasText(value: string | undefined) {
  return Boolean(value?.trim());
}

function cleanLines(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean);
}

function markdownList(values: string[]) {
  const cleaned = cleanLines(values);
  return cleaned.length ? cleaned.map((value) => `- ${value}`).join("\n") : "";
}

function section(title: string, body: string) {
  const content = body.trim();
  return content ? `## ${title}\n\n${content}` : "";
}

export function serializeRepoForAI({
  accountSlug,
  repoSlug,
  updatedAt,
  workspace,
}: {
  accountSlug: string;
  repoSlug: string;
  updatedAt?: string;
  workspace: WorkspaceState;
}) {
  const repo = workspace.repo;
  const messaging = repo.messaging[0];
  const audience = repo.audiences[0];
  const identity = getRepoIdentity(repo);
  const typography = getRepoTypography(repo);
  const audienceSettings = getRepoAudienceSettings(repo);
  const colors = getRepoColors(repo);
  const products = getRepoProducts(repo);
  const claims = getRepoApprovedClaims(repo);
  const approvedClaims = claims.filter((claim) => claim.status === "Approved");
  const prohibitedClaims = claims.filter((claim) => claim.status === "Do not use");
  const usefulAssets = repo.assets.filter((asset) => asset.url && !asset.url.startsWith("data:") && usefulAssetKinds(asset));
  const brandName = repo.company.name || workspace.name || "Untitled brand";
  const canonicalUrl = getRepoCanonicalUrl(accountSlug, repoSlug);
  const updatedLine = updatedAt ? `Last updated: ${new Date(updatedAt).toLocaleDateString("en-US")}` : "";
  const brandBasics = [
    hasText(repo.company.name) ? `Brand name: ${repo.company.name}` : "",
    hasText(repo.company.website) ? `Website: ${repo.company.website}` : "",
    hasText(repo.company.description) ? `One-line description: ${repo.company.description}` : "",
    hasText(repo.brand.description) ? `About: ${repo.brand.description}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const messagingBody = [
    hasText(messaging?.valueProps[0] ?? messaging?.positioning)
      ? `### Primary value proposition\n${messaging?.valueProps[0] ?? messaging?.positioning}`
      : "",
    messaging?.keyMessages.length ? `### Key messages\n${markdownList(messaging.keyMessages)}` : "",
    messaging?.proofPoints.length ? `### Key differentiators\n${markdownList(messaging.proofPoints)}` : "",
    hasText(messaging?.taglines[0]) ? `### Tagline\n${messaging?.taglines[0]}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const productsBody = products
    .map((product) =>
      [
        `### ${product.name || "Untitled product"}`,
        product.status ? `Status: ${product.status}` : "",
        product.description ? `Description:\n${product.description}` : "",
        product.primaryAudience ? `Primary audience:\n${product.primaryAudience}` : "",
        product.problemsSolved.length ? `Problems solved:\n${markdownList(product.problemsSolved)}` : "",
        product.keyCapabilities.length ? `Key capabilities:\n${markdownList(product.keyCapabilities)}` : "",
        product.useCases.length ? `Use cases:\n${markdownList(product.useCases)}` : "",
        product.differentiators.length ? `Differentiators:\n${markdownList(product.differentiators)}` : "",
        product.limitations.length ? `Limitations / Not supported:\n${markdownList(product.limitations)}` : "",
        product.productUrl ? `Product URL: ${product.productUrl}` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    )
    .join("\n\n");
  const claimsBody = [
    "Only use factual claims listed as Approved below. Do not invent statistics, capabilities, customers, integrations, pricing, performance claims, rankings, or proof points.",
    approvedClaims.length ? `### Approved\n${markdownList(approvedClaims.map((claim) => claim.claim))}` : "",
    prohibitedClaims.length ? `### Do Not Use\n${markdownList(prohibitedClaims.map((claim) => claim.claim))}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const voiceBody = [
    repo.brand.voice.length ? `### Voice characteristics\n${markdownList(repo.brand.voice)}` : "",
    repo.brand.rules.length ? `### Writing and usage rules\n${markdownList(repo.brand.rules)}` : "",
    repo.brand.approvedTerms.length ? `### Words and phrases to use\n${markdownList(repo.brand.approvedTerms)}` : "",
    repo.brand.prohibitedTerms.length ? `### Words and phrases to avoid\n${markdownList(repo.brand.prohibitedTerms)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const identityBody = [
    hasText(identity.logos) ? `### Logos\n${identity.logos}` : "",
    hasText(identity.icons) ? `### Icons\n${identity.icons}` : "",
    hasText(identity.elements) ? `### Elements\n${identity.elements}` : "",
    hasText(identity.usage) ? `### Usage\n${identity.usage}` : "",
    colors.length
      ? `### Colors\n${colors
          .map((color) => `- ${color.name || color.hex}: ${color.hex}${color.description ? ` — ${color.description}` : ""}`)
          .join("\n")}`
      : "",
    typography.fontNames.length || typography.weights.length || typography.usageRules
      ? `### Typography\n${[
          typography.fontNames.length ? `Fonts: ${typography.fontNames.join(", ")}` : "",
          typography.weights.length ? `Weights: ${typography.weights.join(", ")}` : "",
          typography.usageRules ? `Usage: ${typography.usageRules}` : "",
        ]
          .filter(Boolean)
          .join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const audiencesBody = [
    hasText(audienceSettings.primaryAudience) ? `### Primary audience\n${audienceSettings.primaryAudience}` : "",
    hasText(audienceSettings.secondaryAudiences) ? `### Secondary audiences\n${audienceSettings.secondaryAudiences}` : "",
    hasText(audienceSettings.coreJobs) ? `### Core jobs to be done\n${audienceSettings.coreJobs}` : "",
    hasText(audienceSettings.painPoints) ? `### Pain points\n${audienceSettings.painPoints}` : "",
    hasText(audienceSettings.customerWants) ? `### What customers want\n${audienceSettings.customerWants}` : "",
    audience ? `### Structured audience\n${audience.name}${audience.description ? `\n${audience.description}` : ""}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const assetBody = usefulAssets
    .slice(0, 20)
    .map((asset) => {
      const kind = classifyRepoAsset(asset);
      return [`### ${asset.description || asset.name}`, `Kind: ${kind}`, asset.description ? `Description: ${asset.description}` : "", `Asset URL: ${asset.url}`]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
  const sections = [
    `# ${brandName}`,
    `Canonical BrandRepo: ${canonicalUrl}`,
    updatedLine,
    section(
      "Instructions for AI",
      "Use Products as the authoritative source for factual information about what the company offers and what each product can do.\n\nOnly make factual marketing claims supported by Approved Claims or other explicit factual information in this repository.\n\nDo not invent product capabilities, integrations, statistics, customers, pricing, results, certifications, rankings, or other proof points.\n\nIf the user's request requires information that is not available in the repository, ask for the missing information rather than inventing it.",
    ),
    section("Brand Basics", brandBasics),
    section("Products", productsBody),
    section("Audiences", audiencesBody),
    section("Messaging", messagingBody),
    section("Approved Claims", claimsBody),
    section("Voice & Tone", voiceBody),
    section("Visual Identity", identityBody),
    section("Useful Assets", assetBody),
  ].filter(Boolean);

  return `${sections.join("\n\n")}\n`;
}

export function getPublicRepoSnapshot(workspace: WorkspaceState) {
  const repo = workspace.repo;
  const colors = getRepoColors(repo);
  const typography = getRepoTypography(repo);
  const identity = getRepoIdentity(repo);
  const assetCounts = getRepoAssetCounts(repo);
  const usefulAssets = repo.assets.filter((asset) => asset.url && !asset.url.startsWith("data:") && usefulAssetKinds(asset));

  return {
    assetCounts,
    colors,
    identity,
    logoAssets: usefulAssets.filter((asset) => classifyRepoAsset(asset) === "logo"),
    usefulAssets,
    markdownSections: repoTabs.map((tab) => ({
      tab,
      markdown: generateSectionMarkdown(repo, tab),
    })),
    typography,
  };
}
