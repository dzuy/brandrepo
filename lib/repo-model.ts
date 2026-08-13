export type RepoKind =
  | "Brand Basics"
  | "Identity"
  | "Imagery"
  | "Colors"
  | "Voice & Tone"
  | "Typography"
  | "Messaging"
  | "Audiences"
  | "Channel SEO";

export type Source = {
  id: string;
  label: string;
  type: "upload" | "structured" | "generated";
};

export type Brand = {
  description: string;
  voice: string[];
  values: string[];
  rules: string[];
  approvedTerms: string[];
  prohibitedTerms: string[];
  sources: Source[];
};

export type Product = {
  id: string;
  name: string;
  description: string;
  features: string[];
  benefits: string[];
  pricing: string;
  positioning: string;
  sources: Source[];
};

export type Audience = {
  id: string;
  name: string;
  description: string;
  painPoints: string[];
  needs: string[];
  messaging: string[];
  channels: string[];
  sources: Source[];
};

export type Messaging = {
  id: string;
  positioning: string;
  valueProps: string[];
  taglines: string[];
  keyMessages: string[];
  proofPoints: string[];
  claims: string[];
  sources: Source[];
};

export type Campaign = {
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

export type Asset = {
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

export type ColorToken = {
  id: string;
  name: string;
  hex: string;
  description: string;
  tag?: string;
};

export type TypographySettings = {
  fontNames: string[];
  weights: string[];
  usageRules: string;
};

export type ChannelSeoSettings = {
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

export type AudienceSettings = {
  primaryAudience: string;
  secondaryAudiences: string;
  coreJobs: string;
  painPoints: string;
  customerWants: string;
};

export type IdentitySettings = {
  logos: string;
  icons: string;
  elements: string;
  usage: string;
};

export type RepoState = {
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

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  assetPreviews?: Pick<Asset, "id" | "name" | "url" | "description" | "metadata">[];
  citations?: Source[];
  generatedImage?: {
    dataUrl: string;
    prompt: string;
    saved?: boolean;
  };
  saved?: boolean;
};

export type WorkspaceState = {
  id: string;
  name: string;
  repo: RepoState;
  chatMessages: ChatMessage[];
  generatedDraft: string;
  generationType: "social" | "email" | "concept";
};

export type WorkspaceRow = {
  id: string;
  name: string;
  data: WorkspaceState;
};

export const repoTabs: RepoKind[] = [
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

export const initialRepo: RepoState = {
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

export function normalizeColorTokens(colors: ColorToken[] | undefined) {
  return (colors ?? []).map((color) => ({
    id: color.id,
    name: color.name ?? color.tag ?? "",
    hex: color.hex ?? "",
    description: color.description ?? "",
  }));
}

export function normalizeTypographySettings(typography: TypographySettings | undefined) {
  return {
    fontNames: typography?.fontNames ?? [],
    weights: typography?.weights ?? [],
    usageRules: typography?.usageRules ?? "",
  };
}

export function normalizeAudienceSettings(audienceSettings: AudienceSettings | undefined) {
  return {
    primaryAudience: audienceSettings?.primaryAudience ?? "",
    secondaryAudiences: audienceSettings?.secondaryAudiences ?? "",
    coreJobs: audienceSettings?.coreJobs ?? "",
    painPoints: audienceSettings?.painPoints ?? "",
    customerWants: audienceSettings?.customerWants ?? "",
  };
}

export function normalizeChannelSeoSettings(channelSeo: ChannelSeoSettings | undefined) {
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

export function normalizeIdentitySettings(identity: (Partial<IdentitySettings> & Record<string, string | undefined>) | undefined) {
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
