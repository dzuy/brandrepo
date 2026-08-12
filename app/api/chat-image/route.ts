type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

type ImagePayload = {
  prompt?: string;
  messages?: ChatMessage[];
  repoContext?: string;
  referenceAssets?: ImageReferenceAsset[];
};

type ImageReferenceAsset = {
  name: string;
  url: string;
  description: string;
  metadata: string[];
};

type ImageGenerationResponse = {
  data?: Array<{
    b64_json?: string;
    revised_prompt?: string;
  }>;
  error?: {
    message?: string;
  };
};

const maxImagePromptLength = 30000;
const maxImageRepoContextLength = 22000;
const maxImageConversationLength = 2500;

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trimEnd()}\n\n[Truncated for image generation prompt length.]`;
}

function compactRepoContextForImage(repoContext: string) {
  const priorityFileNames = [
    "brand-basics.md",
    "identity.md",
    "colors.md",
    "typography.md",
    "voice-tone.md",
    "messaging.md",
    "channel-seo.md",
    "assets.md",
  ];
  const sections = repoContext.split(/\n(?=--- .+? ---\n)/);
  const prioritized = priorityFileNames
    .map((fileName) => sections.find((section) => section.toLowerCase().startsWith(`--- ${fileName}`)))
    .filter((section): section is string => Boolean(section));
  const ordered = prioritized.length ? prioritized : sections;

  return truncateText(ordered.join("\n"), maxImageRepoContextLength);
}

function buildImagePrompt(prompt: string, repoContext: string, messages: ChatMessage[], referenceAssets: ImageReferenceAsset[]) {
  const conversation = messages
    .slice(-6)
    .map((message) => `${message.role === "user" ? "User" : "BrandRepo"}: ${message.text}`)
    .join("\n\n");
  const compactRepoContext = compactRepoContextForImage(repoContext);
  const compactConversation = truncateText(conversation, maxImageConversationLength);
  const references = referenceAssets.length
    ? referenceAssets
        .map((asset, index) =>
          [
            `${index + 1}. ${asset.name}`,
            asset.description ? `Description: ${asset.description}` : "",
            asset.metadata.length ? `Metadata: ${asset.metadata.join(", ")}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        )
        .join("\n\n")
    : "_No visual reference files were provided._";

  const imagePrompt = `Create a polished marketing image for BrandRepo's user request.

User request:
${prompt}

BrandRepo context:
${compactRepoContext || "_No repo context available._"}

Recent conversation:
${compactConversation || "_No prior conversation._"}

Visual reference files supplied as image inputs:
${references}

Use the BrandRepo context and the supplied visual reference images as the source of truth for logos, identity assets, colors, typography, messaging, voice, and rules. If a logo reference is supplied, place that logo visibly in the mockup and preserve its core shape, proportions, and wordmark as closely as possible. Follow any usage rules from the repo. Create a clean, professional SaaS-grade marketing mockup. Avoid tiny unreadable text.`;

  return truncateText(imagePrompt, maxImagePromptLength);
}

function sanitizeFileName(value: string, fallback: string) {
  const clean = value.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  return clean || fallback;
}

function getDataUrlParts(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) return null;
  const binary = atob(match[2]);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return {
    mimeType: match[1],
    bytes,
  };
}

async function getReferenceImageFile(asset: ImageReferenceAsset, index: number) {
  if (asset.url.startsWith("data:")) {
    const parsed = getDataUrlParts(asset.url);
    if (!parsed) return null;
    return {
      blob: new Blob([parsed.bytes], { type: parsed.mimeType }),
      fileName: sanitizeFileName(asset.name, `reference-${index + 1}.png`),
    };
  }

  const response = await fetch(asset.url);
  if (!response.ok) return null;
  const contentType = response.headers.get("content-type") ?? "image/png";
  const buffer = await response.arrayBuffer();

  return {
    blob: new Blob([buffer], { type: contentType }),
    fileName: sanitizeFileName(asset.name, `reference-${index + 1}.png`),
  };
}

function getResponseImage(payload: ImageGenerationResponse) {
  return payload.data?.[0];
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1";

  if (!apiKey) {
    return Response.json(
      {
        error: "OpenAI is not configured yet. Add OPENAI_API_KEY to your environment, then restart the dev server.",
      },
      { status: 500 },
    );
  }

  const body = (await request.json()) as ImagePayload;
  const prompt = body.prompt?.trim();
  const referenceAssets = (body.referenceAssets ?? []).filter((asset) => asset.url).slice(0, 5);

  if (!prompt) {
    return Response.json({ error: "Missing image prompt." }, { status: 400 });
  }

  const imagePrompt = buildImagePrompt(prompt, body.repoContext?.trim() ?? "", body.messages ?? [], referenceAssets);
  let response: Response;

  if (referenceAssets.length) {
    const formData = new FormData();
    formData.append("model", model);
    formData.append("prompt", imagePrompt);
    formData.append("n", "1");
    formData.append("size", "1536x1024");
    formData.append("quality", "medium");
    formData.append("output_format", "png");
    if (model === "gpt-image-1" || model === "gpt-image-1.5") {
      formData.append("input_fidelity", "high");
    }

    const files = await Promise.all(referenceAssets.map((asset, index) => getReferenceImageFile(asset, index)));
    const validFiles = files.filter((file): file is { blob: Blob; fileName: string } => Boolean(file));

    if (validFiles.length) {
      validFiles.forEach((file) => formData.append("image[]", file.blob, file.fileName));
      response = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      });
    } else {
      response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          prompt: imagePrompt,
          n: 1,
          size: "1536x1024",
          quality: "medium",
          output_format: "png",
        }),
      });
    }
  } else {
    response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt: imagePrompt,
        n: 1,
        size: "1536x1024",
        quality: "medium",
        output_format: "png",
      }),
    });
  }

  const payload = (await response.json()) as ImageGenerationResponse;

  if (!response.ok) {
    return Response.json({ error: payload.error?.message ?? "OpenAI image generation failed." }, { status: response.status });
  }

  const image = getResponseImage(payload);

  if (!image?.b64_json) {
    return Response.json({ error: "OpenAI returned an empty image." }, { status: 502 });
  }

  return Response.json({
    answer: referenceAssets.length
      ? `Generated a brand-aware image mockup using ${referenceAssets.length} repo visual reference${referenceAssets.length === 1 ? "" : "s"}.`
      : "Generated a brand-aware image mockup from the repo context.",
    imageDataUrl: `data:image/png;base64,${image.b64_json}`,
    revisedPrompt: image.revised_prompt ?? imagePrompt,
  });
}
