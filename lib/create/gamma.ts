import type { AudienceSettings, IdentitySettings, TypographySettings } from "../repo-model";

export type BrandCreationContext = {
  brandName: string;
  websiteUrl: string;
  identity: IdentitySettings;
  messaging: {
    primaryValueProposition: string;
    keyMessages: string[];
    differentiators: string[];
  };
  voice: {
    characteristics: string[];
    rules: string[];
  };
  audiences: AudienceSettings;
  colors: Array<{
    id: string;
    tag?: string;
    name: string;
    hex: string;
    description: string;
  }>;
  typography: TypographySettings;
  assets: Array<{
    name: string;
    url: string;
    description: string;
    kind: string;
  }>;
};

export type PresentationCreationRequest = {
  type: "presentation";
  provider: "gamma";
  prompt: string;
  brandId: string;
  brandContext: BrandCreationContext;
};

export type GammaCreationResult = {
  id: string;
  status: "complete";
  url: string;
  exportUrl?: string;
  credits?: {
    deducted?: number;
    remaining?: number;
  };
};

type GammaGenerationPayload = {
  inputText: string;
  textMode: "generate";
  format: "presentation";
  numCards: number;
  additionalInstructions: string;
  imageOptions: {
    source: "aiGenerated";
  };
  cardOptions: {
    dimensions: "fluid";
  };
};

const maxGammaInputTextLength = 400000;
const maxGammaAdditionalInstructionsLength = 5000;

function compactList(items: string[] | undefined, fallback = "Not specified.") {
  const values = (items ?? []).map((item) => item.trim()).filter(Boolean);
  if (!values.length) return fallback;
  return values.map((item) => `- ${item}`).join("\n");
}

function compactAudienceSection(audiences: AudienceSettings) {
  const sections = [
    ["Primary audience", audiences.primaryAudience],
    ["Secondary audiences", audiences.secondaryAudiences],
    ["Core jobs to be done", audiences.coreJobs],
    ["Common pain points", audiences.painPoints],
    ["What customers want", audiences.customerWants],
  ];

  return sections.map(([title, body]) => `## ${title}\n${String(body || "Not specified.").trim()}`).join("\n\n");
}

function compactColors(colors: BrandCreationContext["colors"]) {
  const values = colors.filter((color) => color.hex.trim());
  if (!values.length) return "Not specified.";

  return values
    .map((color) => {
      const label = [color.tag, color.name].map((value) => value.trim()).filter(Boolean).join(" - ");
      const description = color.description.trim() ? `: ${color.description.trim()}` : "";
      return `- ${label || "Color"} (${color.hex})${description}`;
    })
    .join("\n");
}

function compactTypography(typography: TypographySettings) {
  return [
    `Font names:\n${compactList(typography.fontNames)}`,
    `Weights:\n${compactList(typography.weights)}`,
    `Basic usage rules:\n${typography.usageRules.trim() || "Not specified."}`,
  ].join("\n\n");
}

function compactAssets(assets: BrandCreationContext["assets"]) {
  const values = assets.filter((asset) => asset.url.trim());
  if (!values.length) return "Not specified.";

  return values
    .map((asset) => {
      const description = asset.description.trim() ? ` - ${asset.description.trim()}` : "";
      return `- ${asset.kind}: ${asset.name}${description}\n  ${asset.url}`;
    })
    .join("\n");
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 40).trim()}\n\n[Truncated by BrandRepo for API limits.]`;
}

export function buildGammaGenerationPayload(request: PresentationCreationRequest): GammaGenerationPayload {
  const context = request.brandContext;

  const inputText = `# Presentation request
${request.prompt.trim()}

# BrandRepo source context

## Brand
Name: ${context.brandName || "Not specified."}
Website: ${context.websiteUrl || "Not specified."}

## Messaging
Primary value proposition:
${context.messaging.primaryValueProposition || "Not specified."}

Key messages:
${compactList(context.messaging.keyMessages)}

Key differentiators:
${compactList(context.messaging.differentiators)}

## Voice and tone
Voice characteristics:
${compactList(context.voice.characteristics)}

Writing rules:
${compactList(context.voice.rules)}

## Audiences
${compactAudienceSection(context.audiences)}

## Identity
Logo rules:
${context.identity.logos || "Not specified."}

Icon rules:
${context.identity.icons || "Not specified."}

Element rules:
${context.identity.elements || "Not specified."}

Usage rules:
${context.identity.usage || "Not specified."}

## Colors
${compactColors(context.colors)}

## Typography
${compactTypography(context.typography)}

## Reference assets
Use these public BrandRepo asset URLs when relevant. Preserve logo proportions and follow identity rules.
${compactAssets(context.assets)}
`;

  const additionalInstructions = `Create a polished, client-ready presentation in Gamma. Use the BrandRepo source context as the source of truth for messaging, audience, voice, colors, typography, and visual identity. Structure the deck with clear narrative flow, concise slide copy, strong section transitions, and practical speaker-ready content. Do not invent unsupported brand facts; if a detail is missing, keep it generic and useful.`;

  return {
    inputText: truncate(inputText, maxGammaInputTextLength),
    textMode: "generate",
    format: "presentation",
    numCards: 10,
    additionalInstructions: truncate(additionalInstructions, maxGammaAdditionalInstructionsLength),
    imageOptions: {
      source: "aiGenerated",
    },
    cardOptions: {
      dimensions: "fluid",
    },
  };
}
