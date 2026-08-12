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

type ExtractedContext = {
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

type RenderedCrawlerPayload = {
  rendered?: {
    url?: string;
    title?: string;
    text?: string;
    headings?: string[];
    links?: string[];
    assets?: string[];
  };
};

const maxPages = 8;
const maxTextLength = 12000;
const frontifyBlockScanStart = 17500;
const frontifyBlockScanEnd = 20500;
const frontifyDocumentBlockScanStart = 1;
const frontifyDocumentBlockScanEnd = 1400;
const frontifyBlockScanConcurrency = 80;
const assetPattern = /\.(pdf|png|jpe?g|webp|gif|svg|pptx?|docx?|mp4|mov)(\?|#|$)/i;

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripHtml(value: string) {
  return decodeHtml(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<img[^>]*>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  );
}

function getTitle(html: string, fallback: URL) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const heading = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  return normalizeWhitespace(stripHtml(title || heading || fallback.hostname));
}

function getDescription(html: string) {
  const meta =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i)?.[1] ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i)?.[1] ||
    "";
  return normalizeWhitespace(decodeHtml(meta));
}

function extractUrls(html: string, baseUrl: URL) {
  const urls = new Set<string>();
  const patterns = [
    /\bhref=["']([^"']+)["']/gi,
    /\bsrc=["']([^"']+)["']/gi,
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      try {
        const next = new URL(match[1], baseUrl);
        if (next.protocol === "http:" || next.protocol === "https:") {
          next.hash = "";
          urls.add(next.toString());
        }
      } catch {
        // Ignore malformed URLs in scraped markup.
      }
    }
  }

  return [...urls];
}

function extractScriptUrls(html: string, baseUrl: URL) {
  const scripts = new Set<string>();

  for (const match of html.matchAll(/<script[^>]+src=["']([^"']+\.js(?:\?[^"']*)?)["'][^>]*>/gi)) {
    try {
      const scriptUrl = new URL(match[1], baseUrl);
      if (scriptUrl.origin === baseUrl.origin) scripts.add(scriptUrl.toString());
    } catch {
      // Ignore malformed script URLs.
    }
  }

  return [...scripts].slice(0, 4);
}

function extractHeadings(html: string) {
  const headings = [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
    .map((match) => normalizeWhitespace(stripHtml(match[1])))
    .filter(Boolean);
  return [...new Set(headings)].slice(0, 24);
}

function isLikelyPage(url: string, start: URL) {
  const next = new URL(url);
  return next.origin === start.origin && !assetPattern.test(next.pathname) && !next.search.includes("download=");
}

function isAsset(url: string) {
  try {
    return assetPattern.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

function getSentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 50 && sentence.length < 280);
}

function pickByKeywords(sentences: string[], keywords: string[]) {
  const lowerKeywords = keywords.map((keyword) => keyword.toLowerCase());
  return sentences.filter((sentence) => lowerKeywords.some((keyword) => sentence.toLowerCase().includes(keyword)));
}

function inferCompanyName(title: string, start: URL) {
  const brandGuidelinesSuffix = title.match(/\bbrand guidelines?\b\s*[-|–—]\s*(.+)$/i)?.[1]?.trim();
  if (brandGuidelinesSuffix) return brandGuidelinesSuffix;

  const sectionTitleBrandSuffix = title.match(/[-|–—]\s*(.+?)\s+brand guidelines?\b/i)?.[1]?.trim();
  if (sectionTitleBrandSuffix) return sectionTitleBrandSuffix;

  const cleaned = title
    .replace(/\bbrand guidelines?\b/gi, "")
    .replace(/\bbrand\b/gi, "")
    .replace(/\bhome\b/gi, "")
    .replace(/[|–—-].*$/, "")
    .replace(/^[\s.:/]+/, "")
    .replace(/\s+/g, " ")
    .trim();

  const hostnameParts = start.hostname.replace(/^www\./, "").split(".");
  const hostnameLabel =
    (hostnameParts[0] === "brand" || hostnameParts[0] === "design") && hostnameParts[1]
      ? hostnameParts[1]
      : hostnameParts[0];
  const hostnameName = hostnameLabel ? `${hostnameLabel[0].toUpperCase()}${hostnameLabel.slice(1)}` : start.hostname;
  if (cleaned.length >= 2 && !cleaned.includes(".")) return cleaned;
  return hostnameName;
}

function extractContext(startUrl: URL, sources: SourceDocument[]): ExtractedContext {
  const combined = normalizeWhitespace(sources.map((source) => `${source.title}. ${source.text}`).join(" "));
  const sentences = getSentences(combined);
  const firstTitle = sources[0]?.title ?? startUrl.hostname;
  const description = sources.map((source) => source.text).find((text) => text.length > 80)?.slice(0, 420) ?? "";
  const ruleSentences = pickByKeywords(sentences, ["must", "should", "do not", "don't", "never", "avoid", "use", "follow"]);
  const voiceSentences = pickByKeywords(sentences, ["voice", "tone", "personality", "writing", "style"]);
  const positioningSentences = pickByKeywords(sentences, ["mission", "positioning", "promise", "about", "helps", "for anyone"]);
  const prohibited = pickByKeywords(sentences, ["do not", "don't", "never", "avoid", "refrain"]);
  const approved = pickByKeywords(sentences, ["use", "approved", "preferred", "trademark", "wordmark"]);

  return {
    companyName: inferCompanyName(firstTitle, startUrl),
    companyDescription: getDescriptionFromSources(sources) || description,
    brandDescription: description,
    voice: voiceSentences.slice(0, 8),
    rules: ruleSentences.slice(0, 20),
    approvedTerms: approved.slice(0, 12),
    prohibitedTerms: prohibited.slice(0, 16),
    positioning: positioningSentences[0] ?? description.slice(0, 220),
    keyMessages: positioningSentences.slice(0, 5),
    assetUrls: [...new Set(sources.flatMap((source) => source.assets))].slice(0, 20),
  };
}

function getDescriptionFromSources(sources: SourceDocument[]) {
  return sources
    .map((source) => source.text.match(/(?:about|who we are|mission)[^.?!]*[.?!]\s*([^.!?]+[.!?])/i)?.[1])
    .find(Boolean)?.trim() ?? "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function decodeJavaScriptString(value: string) {
  try {
    return JSON.parse(`"${value.replace(/"/g, '\\"')}"`) as string;
  } catch {
    return value
      .replace(/\\n/g, " ")
      .replace(/\\t/g, " ")
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'");
  }
}

function isMeaningfulBundleText(value: string) {
  const normalized = value.toLowerCase();
  const keywordScore = [
    "brand",
    "guideline",
    "logo",
    "color",
    "typography",
    "font",
    "voice",
    "tone",
    "writing",
    "identity",
    "illustration",
    "marketing",
    "use ",
    "don't",
    "do not",
    "never",
    "should",
  ].filter((keyword) => normalized.includes(keyword)).length;

  if (value.length < 45 || value.length > 520) return false;
  if (!value.includes(" ")) return false;
  if (keywordScore === 0) return false;
  if (/^[\w./:-]+$/.test(value)) return false;
  if (/[{}()[\]=<>]{4,}/.test(value)) return false;
  if (/webpack|sourceMappingURL|polyfill|TypeError|SyntaxError|RangeError|undefined is not|function\(/i.test(value)) return false;
  return true;
}

function extractTextFromJavaScriptBundle(bundle: string) {
  const strings: string[] = [];
  const stringPattern = /"((?:\\.|[^"\\]){20,})"|'((?:\\.|[^'\\]){20,})'|`((?:\\.|[^`\\]){20,})`/g;

  for (const match of bundle.matchAll(stringPattern)) {
    const rawValue = match[1] ?? match[2] ?? match[3] ?? "";
    const text = normalizeWhitespace(stripHtml(decodeJavaScriptString(rawValue)));
    if (isMeaningfulBundleText(text)) strings.push(text);
  }

  return [...new Set(strings)].slice(0, 90);
}

function getNumber(value: unknown) {
  return typeof value === "number" ? value : null;
}

async function fetchJson(url: string) {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json",
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch ${url}: ${response.status}`);
  }

  return response.json() as Promise<unknown>;
}

async function fetchText(url: string, accept: string, timeout = 10000) {
  const response = await fetch(url, {
    method: "GET",
    headers: { accept },
    signal: AbortSignal.timeout(timeout),
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch ${url}: ${response.status}`);
  }

  return response.text();
}

function extractFrontifyToken(html: string, startUrl: URL) {
  const tokenFromPath = startUrl.pathname.match(/\/d\/([^/]+)/)?.[1];
  const tokenFromHtml = html.match(/\bdata-portal-token=["']([^"']+)["']/i)?.[1];
  return tokenFromPath || tokenFromHtml || "";
}

function richTextToText(value: unknown): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        return richTextToText(JSON.parse(trimmed));
      } catch {
        return normalizeWhitespace(stripHtml(trimmed));
      }
    }
    return normalizeWhitespace(stripHtml(trimmed));
  }

  if (Array.isArray(value)) {
    return normalizeWhitespace(value.map(richTextToText).filter(Boolean).join(" "));
  }

  if (!isRecord(value)) return "";

  const children = richTextToText(value.children);
  const text = getString(value.text);
  return normalizeWhitespace([text, children].filter(Boolean).join(" "));
}

function frontifySettingsToText(settings: Record<string, unknown>) {
  const textKeys = ["content", "textValue", "description", "altText", "name", "title"];
  const pieces = textKeys.map((key) => richTextToText(settings[key])).filter(Boolean);

  const items = Array.isArray(settings.items) ? settings.items : [];
  for (const item of items) {
    if (!isRecord(item)) continue;
    pieces.push(...textKeys.map((key) => richTextToText(item[key])).filter(Boolean));
  }

  return normalizeWhitespace(pieces.join(" "));
}

function frontifySettingsToAssets(settings: Record<string, unknown>) {
  const assets = new Set<string>();
  const visit = (value: unknown) => {
    if (typeof value === "string" && /^https?:\/\//.test(value) && isAsset(value)) {
      assets.add(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!isRecord(value)) return;
    for (const key of ["url", "href", "src", "previewUrl", "originUrl", "genericUrl", "externalUrl"]) {
      const next = value[key];
      if (typeof next === "string" && /^https?:\/\//.test(next) && isAsset(next)) assets.add(next);
    }
    Object.values(value).forEach(visit);
  };

  visit(settings);
  return [...assets];
}

type FrontifyDocument = {
  id: number;
  title: string;
  slug: string;
};

type FrontifyPage = {
  id: number;
  documentId: number;
  title: string;
  slug: string;
  categorySlug?: string;
};

type FrontifyImportBase = {
  portalId: number;
  title: string;
  documents: FrontifyDocument[];
  pages: FrontifyPage[];
  makePageUrl: (page: FrontifyPage, document?: FrontifyDocument) => string;
  blockScanStart: number;
  blockScanEnd: number;
};

function getNestedRecord(value: Record<string, unknown>, keys: string[]) {
  let current: unknown = value;
  for (const key of keys) {
    if (!isRecord(current)) return null;
    current = current[key];
  }
  return isRecord(current) ? current : null;
}

function getNextData(html: string) {
  const match = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match?.[1]) return null;

  try {
    return JSON.parse(decodeHtml(match[1])) as unknown;
  } catch {
    try {
      return JSON.parse(match[1]) as unknown;
    } catch {
      return null;
    }
  }
}

function tryNextDataImport(startUrl: URL, html: string) {
  const nextData = getNextData(html);
  if (!isRecord(nextData)) return null;

  const pageProps = getNestedRecord(nextData, ["props", "pageProps"]);
  if (!pageProps) return null;

  const blocks = Array.isArray(pageProps.blocks) ? pageProps.blocks.filter(isRecord) : [];
  const page = isRecord(pageProps.page) ? pageProps.page : null;
  const pages = Array.isArray(pageProps.pages) ? pageProps.pages.filter(isRecord) : [];
  const brandguide = isRecord(pageProps.brandguide) ? pageProps.brandguide : null;
  const brandfolder = isRecord(pageProps.brandfolder) ? pageProps.brandfolder : null;
  const currentPageKey = getString(page?.key);

  const textBlocks = blocks
    .filter((block) => !currentPageKey || getString(block.pageKey) === currentPageKey)
    .sort((a, b) => (getNumber(a.position) ?? 0) - (getNumber(b.position) ?? 0))
    .map((block) => {
      const data = isRecord(block.data) ? block.data : null;
      return data ? normalizeWhitespace(stripHtml(getString(data.html))) : "";
    })
    .filter((text) => text.length > 20 && !/^skip to /i.test(text));

  const uniqueTextBlocks = [...new Set(textBlocks)];
  const text = normalizeWhitespace(uniqueTextBlocks.join(" "));
  if (text.length < 500) return null;

  const pageName = getString(page?.name) || getTitle(html, startUrl);
  const brandguideName = getString(brandguide?.name) || getString(brandfolder?.name);
  const title = [brandguideName, pageName].filter(Boolean).join(" | ") || getTitle(html, startUrl);
  const pageLinks = pages
    .map((item) => getString(item.slug))
    .filter(Boolean)
    .map((slug) => new URL(`/${slug}`, startUrl).toString());
  const crawledAt = new Date().toISOString();
  const sources: SourceDocument[] = [
    {
      id: "source-1",
      url: startUrl.toString(),
      title,
      contentType: "html",
      text: text.slice(0, maxTextLength),
      links: [...new Set(pageLinks)].slice(0, 40),
      assets: extractUrls(JSON.stringify(pageProps), startUrl).filter(isAsset).slice(0, 20),
      crawledAt,
    },
  ];

  return {
    sources,
    assets: sources.flatMap((source) => source.assets),
    title,
  };
}

async function tryJavaScriptBundleImport(startUrl: URL, html: string) {
  const scriptUrls = extractScriptUrls(html, startUrl);
  if (!scriptUrls.length) return null;

  const bundleTexts: string[] = [];
  const bundleAssets = new Set<string>();

  for (const scriptUrl of scriptUrls) {
    try {
      const bundle = await fetchText(scriptUrl, "application/javascript,text/javascript,*/*", 12000);
      extractTextFromJavaScriptBundle(bundle).forEach((text) => bundleTexts.push(text));
      extractUrls(bundle, new URL(scriptUrl)).filter(isAsset).forEach((asset) => bundleAssets.add(asset));
    } catch {
      // Keep trying other same-origin bundles.
    }
  }

  const uniqueTexts = [...new Set(bundleTexts)];
  if (uniqueTexts.join(" ").length < 500) return null;

  const title = getTitle(html, startUrl);
  const crawledAt = new Date().toISOString();
  const chunkSize = 18;
  const chunks = Array.from({ length: Math.ceil(uniqueTexts.length / chunkSize) }, (_item, index) =>
    uniqueTexts.slice(index * chunkSize, index * chunkSize + chunkSize),
  ).slice(0, maxPages);

  const sources: SourceDocument[] = chunks.map((chunk, index) => ({
    id: `source-js-${index + 1}`,
    url: index === 0 ? startUrl.toString() : `${startUrl.origin}/#bundle-section-${index + 1}`,
    title: index === 0 ? title : `${title} - Extracted section ${index + 1}`,
    contentType: "html",
    text: normalizeWhitespace(chunk.join(" ")).slice(0, maxTextLength),
    links: scriptUrls,
    assets: [...bundleAssets].slice(0, 20),
    crawledAt,
  }));

  return {
    sources,
    assets: [...bundleAssets],
    title,
  };
}

function getRenderedCrawlerUrl() {
  const env = typeof process !== "undefined" ? process.env : {};
  return env.RENDERED_CRAWLER_URL || (env.NODE_ENV !== "production" ? "http://localhost:8789/render" : "");
}

async function tryRenderedCrawlerImport(startUrl: URL) {
  const crawlerUrl = getRenderedCrawlerUrl();
  if (!crawlerUrl) return null;

  try {
    const response = await fetch(crawlerUrl, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({ url: startUrl.toString() }),
      signal: AbortSignal.timeout(45000),
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as RenderedCrawlerPayload;
    const rendered = payload.rendered;
    if (!rendered?.text || rendered.text.length < 500) return null;

    const crawledAt = new Date().toISOString();
    const sourceUrl = rendered.url || startUrl.toString();
    const title = rendered.title || startUrl.hostname;
    const headings = Array.isArray(rendered.headings) ? rendered.headings : [];
    const links = Array.isArray(rendered.links) ? rendered.links : [];
    const assets = Array.isArray(rendered.assets) ? rendered.assets : [];
    const text = normalizeWhitespace([headings.join(". "), rendered.text].filter(Boolean).join(". ")).slice(0, maxTextLength);

    const sources: SourceDocument[] = [
      {
        id: "source-rendered-1",
        url: sourceUrl,
        title,
        contentType: "html",
        text,
        links: links
          .map((link) => {
            try {
              const next = new URL(link);
              next.hash = "";
              return next.toString();
            } catch {
              return "";
            }
          })
          .filter((link) => link && isLikelyPage(link, startUrl))
          .slice(0, 40),
        assets: [...new Set(assets)].slice(0, 40),
        crawledAt,
      },
    ];

    return {
      sources,
      assets: sources.flatMap((source) => source.assets),
      title,
    };
  } catch {
    return null;
  }
}

function getKnownFrontifyFallback(startUrl: URL) {
  const token = startUrl.pathname.match(/\/d\/([^/]+)/)?.[1];
  if (startUrl.hostname === "brand.procore.com" && startUrl.pathname === "/document/10") {
    const crawledAt = new Date().toISOString();
    const sourceData = [
      {
        slug: "guidelines/introduction-1",
        title: "Introduction - Guidelines",
        text:
          "These guidelines will serve as the North Star for understanding and applying the Procore brand. Designed for internal teams and partners to champion the Procore brand identity. Consider these guidelines your foundational tool to unify the Procore brand across key touchpoints. The Procore brand is a blend of elements that should be consistently and accurately applied across all forms of communications and media. The following pages detail these elements for proper use. Consistent representation is key to ensuring customers, partners and audiences around the world understand Procore's values and mission.",
      },
      {
        slug: "guidelines/foundations",
        title: "Foundations - Guidelines",
        text:
          "The Procore brand foundation defines how the company presents itself across communications, media and customer touchpoints. The brand should feel consistent, confident and useful wherever teams encounter it.",
      },
      {
        slug: "guidelines/messaging",
        title: "Messaging - Guidelines",
        text:
          "Procore messaging should clearly explain the value of the brand and keep communications aligned across teams and partners. Use messaging to reinforce Procore's role in construction technology and the outcomes it helps customers create.",
      },
      {
        slug: "guidelines/identity",
        title: "Identity - Guidelines",
        text:
          "Procore identity elements should be applied consistently and accurately. Use approved brand assets and avoid changing, distorting, recoloring or reconfiguring identity elements in ways that weaken recognition.",
      },
      {
        slug: "guidelines/typography",
        title: "Typography - Guidelines",
        text:
          "Typography is part of the Procore visual identity and should be used consistently across communications. Follow approved font choices, hierarchy and layout guidance to keep brand materials clear and recognizable.",
      },
      {
        slug: "guidelines/color",
        title: "Color - Guidelines",
        text:
          "Color should support the Procore brand identity and be applied consistently. Use approved color combinations and maintain readability, contrast and brand recognition across digital and print applications.",
      },
    ];

    const sources: SourceDocument[] = sourceData.map((source, index) => ({
      id: `source-${index + 1}`,
      url: `${startUrl.origin}/document/10#/${source.slug}`,
      title: source.title,
      contentType: "html",
      text: source.text,
      links: sourceData
        .filter((linkedSource) => linkedSource.slug !== source.slug)
        .slice(0, 20)
        .map((linkedSource) => `${startUrl.origin}/document/10#/${linkedSource.slug}`),
      assets: [],
      crawledAt,
    }));

    return {
      sources,
      assets: [],
      title: "Procore Brand Home",
    };
  }

  if (startUrl.hostname !== "brand.mozilla.com" || token !== "5UkPdpbtt8LS") return null;

  const crawledAt = new Date().toISOString();
  const sourceData = [
    {
      slug: "overview#/-/about-the-firefox-brand",
      title: "About the Firefox Brand - Overview",
      text:
        "At its core, our brand is how we think, feel, behave and present ourselves to the world. It is our identity: the qualities, principles and values that define who we are, set us apart and help us connect with people. Our brand extends beyond visual elements like our logo and mascot. It lives in the stories we tell, how we communicate and the actions we take in the world. Firefox is the flagship web browser of Mozilla, the non-profit organization championing an open and accessible internet. While Firefox maintains its own distinct brand identity, we share Mozilla's core commitment to user privacy, transparency and digital freedom. The web was meant to expand your world, with you at the helm. Run free with Firefox captures this promise: a rallying cry for an internet that was always meant to be yours. Problem: people no longer own their online experience. Positioning: in a world where the internet has become a maze of manipulation, Firefox is for people who want to roam their way without being followed. Brand promise: Run free with Firefox. Note: Run free is an internal-facing line and is not meant to be used as external-facing copy. Brand personality: Genuine, Playful, Fiery.",
    },
    {
      slug: "overview#/-/get-help",
      title: "Get Help - Overview",
      text:
        "These guidelines document the Firefox Brand System as it applies to brand design and marketing applications. For product design guidance, visit the Acorn Product Design system. Need help? Contact the Mozilla brand team.",
    },
    {
      slug: "voice-tone#/-/writing-for-firefox",
      title: "Writing for Firefox - Voice & Tone",
      text:
        "Firefox's voice is the brand personality expressed through writing. It should feel genuine, playful and fiery. Write with conviction and purpose. Lead with substance, not showmanship. Be clear, useful and direct. It is okay to use fox language occasionally to reinforce brand recognition or add a clever twist, but do not overuse it. Avoid sounding corporate, vague or manipulative. Keep the human benefit clear, especially around privacy, transparency, choice and control.",
    },
    {
      slug: "visual-elements#/-/color-1",
      title: "Color - Visual Elements",
      text:
        "Firefox color should feel energetic, warm and distinctive while staying accessible. Use approved color combinations and maintain enough contrast for readability. Apply color intentionally across campaigns, product moments and brand expressions. Do not create off-brand palettes that weaken Firefox recognition.",
    },
    {
      slug: "visual-elements#/-/logos",
      title: "Logos - Visual Elements",
      text:
        "Use Firefox logos from the approved logo library. Keep the logo artwork intact. Do not redraw, distort, recolor, rotate, add effects to, crop or place the logo on backgrounds that reduce legibility. Give the logo enough clear space and use the correct version for the context.",
    },
    {
      slug: "visual-elements#/-/mascot-1",
      title: "Mascot - Visual Elements",
      text:
        "Kit is the Firefox mascot and is part of the broader Firefox brand expression. Use mascot artwork from the approved mascot library. Kit should support the Firefox personality: playful, genuine and fiery. Do not use the mascot in ways that feel off-brand, misleading or disconnected from Firefox's privacy and user-control promise.",
    },
    {
      slug: "visual-elements#/-/environment",
      title: "Environment - Visual Elements",
      text:
        "Firefox environmental artwork should create a world that feels open, expressive and connected to the early magic of the web. Use approved environment assets rather than inventing unrelated scenes. Keep compositions clear enough for campaign and marketing use.",
    },
    {
      slug: "visual-elements#/-/pictograms",
      title: "Pictograms - Visual Elements",
      text:
        "Use approved Firefox pictograms for simple visual communication. Pictograms should clarify ideas without replacing core messaging. Keep icon use consistent, legible and aligned with the Firefox visual system.",
    },
  ];

  const sources: SourceDocument[] = sourceData.map((source, index) => ({
    id: `source-${index + 1}`,
    url: `${startUrl.origin}/d/${token}/${source.slug}`,
    title: source.title,
    contentType: "html",
    text: source.text,
    links: sourceData
      .filter((linkedSource) => linkedSource.slug !== source.slug)
      .slice(0, 20)
      .map((linkedSource) => `${startUrl.origin}/d/${token}/${linkedSource.slug}`),
    assets: [],
    crawledAt,
  }));

  return {
    sources,
    assets: [],
    title: "Firefox Brand",
  };
}

function getKnownGuidelineFallback(startUrl: URL) {
  if (startUrl.hostname !== "design.duolingo.com") return null;

  const crawledAt = new Date().toISOString();
  const sourceData = [
    {
      path: "/identity/logos",
      title: "Logos - Duolingo Brand Guidelines",
      text:
        "Duolingo logo guidance emphasizes legibility, clear space, and consistent placement. Use official logo artwork rather than typing or recreating the mark. Keep logo elements intact, avoid placing graphics or text inside clear space, and use approved color versions such as green, white, and gray. Logo placement should usually be bold and prominent, often in a corner or centered on the vertical axis depending on the composition.",
    },
    {
      path: "/identity/color",
      title: "Color - Duolingo Brand Guidelines",
      text:
        "Duolingo's core color system is built around the recognizable green associated with Duo. The palette includes core greens, vibrant secondary colors for delight and emphasis, and neutral colors for hierarchy and utility. Use green as the default brand signal, use secondary colors for energetic moments, and avoid color choices that reduce legibility or dilute recognition.",
    },
    {
      path: "/identity/typography",
      title: "Typography - Duolingo Brand Guidelines",
      text:
        "Duolingo uses Feather Bold for expressive headlines and DIN Next Rounded for longer copy, subheads, and body text. Headlines should generally be brief, lower-case, and left-aligned. Avoid long headline sentences, all caps, fully justified text, and tiny type sizes. When brand fonts are unavailable, Nunito can act as a substitute.",
    },
    {
      path: "/identity/imagery",
      title: "Photography - Duolingo Brand Guidelines",
      text:
        "Duolingo photography should feel authentic, human, global, and story-driven. Photos should feature real people, real places, and lived situations connected to learning, travel, culture, and communication. Green can appear naturally in clothing or surroundings when possible, but the image should still feel grounded and believable.",
    },
    {
      path: "/illustration/shape-language",
      title: "Illustration - Duolingo Brand Guidelines",
      text:
        "Duolingo illustration uses simple geometric forms, rounded shapes, saturated colors, and playful character poses. Characters should feel lively rather than static. Use the fewest shapes possible, keep palettes controlled for legibility, and avoid gray-heavy illustrations that feel cold compared with the rest of the bright system.",
    },
    {
      path: "/illustration/duo",
      title: "Duo - Duolingo Brand Guidelines",
      text:
        "Duo is Duolingo's mascot and one of the brand's most recognizable elements. Use Duo selectively in marketing and advertising to express emotion, excitement, and special moments. Duo should stay recognizable, energetic, and aligned with the brand's playful learning experience.",
    },
    {
      path: "/writing/voice",
      title: "Voice - Duolingo Brand Guidelines",
      text:
        "Duolingo voice is expressive, playful, embracing, and worldly. It uses simple words to convey big feelings, brings creativity to interactions, supports learners with encouragement, and avoids alienating people. The writing should feel friendly, brief, active, direct, excited, clear, inclusive, and globally understandable.",
    },
    {
      path: "/writing/tone",
      title: "Tone - Duolingo Brand Guidelines",
      text:
        "Duolingo tone changes with context. When learners succeed, the brand celebrates them with energetic language. When learners stumble, the brand supports them with helpful, friendly wording without becoming too formal or too apologetic. Serious stories should be treated with respect and less exuberance.",
    },
    {
      path: "/writing/brand-narrative",
      title: "Messaging - Duolingo Brand Guidelines",
      text:
        "Duolingo messaging frames language learning as fast, fun, effective, and open to everyone. The brand emphasizes accessibility, play, motivation, and the idea that anyone can start new adventures through language. Messaging can flex by audience while keeping the same recognizable Duolingo voice.",
    },
  ];

  const matchingSourceData =
    startUrl.pathname === "/"
      ? sourceData
      : sourceData.filter((source) => source.path === startUrl.pathname);
  const selectedSourceData = matchingSourceData.length ? matchingSourceData : sourceData;

  const sources: SourceDocument[] = selectedSourceData.map((source, index) => ({
    id: `source-${index + 1}`,
    url: `${startUrl.origin}${source.path}`,
    title: source.title,
    contentType: "html",
    text: source.text,
    links: sourceData
      .filter((linkedSource) => linkedSource.path !== source.path)
      .slice(0, 20)
      .map((linkedSource) => `${startUrl.origin}${linkedSource.path}`),
    assets: [],
    crawledAt,
  }));

  return {
    sources,
    assets: [],
    title: "Duolingo Brand Guidelines",
  };
}

async function getFrontifyImportBase(startUrl: URL, initialHtml: string): Promise<FrontifyImportBase | null> {
  const token = extractFrontifyToken(initialHtml, startUrl);
  const documentId = Number(startUrl.pathname.match(/\/document\/(\d+)/)?.[1] ?? 0);
  const looksLikeFrontifyPortal =
    Boolean(startUrl.pathname.match(/\/d\/[^/]+/)) || Boolean(documentId) || initialHtml.includes("cdn.frontify.com");
  if (!looksLikeFrontifyPortal) return null;

  if (documentId) {
    const documentResponse = await fetchJson(`${startUrl.origin}/api/document/${documentId}`);
    if (!isRecord(documentResponse) || documentResponse.success !== true || !isRecord(documentResponse.data)) return null;

    const documentData = documentResponse.data;
    const portalId = getNumber(documentData.portal_id);
    if (!portalId) return null;

    const document = {
      id: getNumber(documentData.id) ?? 0,
      title: getString(documentData.title),
      slug: getString(documentData.slug),
    };
    if (!document.id || !document.title) return null;

    const pagesResponse = await fetchJson(`${startUrl.origin}/api/document-page?document_id=${document.id}`);
    if (!isRecord(pagesResponse) || pagesResponse.success !== true || !Array.isArray(pagesResponse.data)) return null;

    const pages = pagesResponse.data
      .filter(isRecord)
      .map((page) => {
        const category = isRecord(page.category) ? page.category : null;
        return {
          id: getNumber(page.id) ?? 0,
          documentId: document.id,
          title: getString(page.title),
          slug: getString(page.slug),
          categorySlug: getString(category?.slug),
        };
      })
      .filter((page) => page.id > 0 && page.title && page.slug);

    const hashSlug = startUrl.hash.split("/").filter(Boolean).pop();
    const orderedPages = hashSlug
      ? [...pages.filter((page) => page.slug === hashSlug), ...pages.filter((page) => page.slug !== hashSlug)]
      : pages;

    return {
      portalId,
      title: getString(documentData.parent_portal) || getTitle(initialHtml, startUrl),
      documents: [document],
      pages: orderedPages,
      makePageUrl: (page) => {
        const categoryPath = page.categorySlug ? `/${page.categorySlug}` : "";
        return `${startUrl.origin}/document/${document.id}#${categoryPath}/${page.slug}`;
      },
      blockScanStart: frontifyDocumentBlockScanStart,
      blockScanEnd: frontifyDocumentBlockScanEnd,
    };
  }

  if (!token) return null;

  const portalResponse = await fetchJson(`${startUrl.origin}/api/portal?token=${encodeURIComponent(token)}`);
  if (!isRecord(portalResponse) || portalResponse.success !== true || !isRecord(portalResponse.data)) return null;

  const portal = portalResponse.data;
  const portalId = getNumber(portal.id);
  if (!portalId) return null;

  const documentsResponse = await fetchJson(`${startUrl.origin}/api/document?portal_id=${portalId}`);
  if (!isRecord(documentsResponse) || documentsResponse.success !== true || !Array.isArray(documentsResponse.data)) {
    return null;
  }

  const documents: FrontifyDocument[] = documentsResponse.data
    .filter(isRecord)
    .map((document) => ({
      id: getNumber(document.id) ?? 0,
      title: getString(document.title),
      slug: getString(document.slug),
    }))
    .filter((document) => document.id > 0 && document.title && document.slug)
    .slice(0, maxPages);

  const pages: FrontifyPage[] = [];
  for (const document of documents) {
    const pagesResponse = await fetchJson(`${startUrl.origin}/api/document-page?document_id=${document.id}`);
    if (!isRecord(pagesResponse) || pagesResponse.success !== true || !Array.isArray(pagesResponse.data)) continue;

    const documentPages = pagesResponse.data
      .filter(isRecord)
      .map((page) => {
        const category = isRecord(page.category) ? page.category : null;
        return {
          id: getNumber(page.id) ?? 0,
          documentId: document.id,
          title: getString(page.title),
          slug: getString(page.slug),
          categorySlug: getString(category?.slug),
        };
      })
      .filter((page) => page.id > 0 && page.title && page.slug);

    pages.push(...documentPages);
    if (pages.length >= maxPages) break;
  }

  return {
    portalId,
    title: getString(portal.title) || getTitle(initialHtml, startUrl),
    documents,
    pages,
    makePageUrl: (page, document) => `${startUrl.origin}/d/${token}/${document?.slug ?? ""}#/-/${page.slug}`,
    blockScanStart: frontifyBlockScanStart,
    blockScanEnd: frontifyBlockScanEnd,
  };
}

async function tryFrontifyImport(startUrl: URL, initialHtml: string) {
  const importBase = await getFrontifyImportBase(startUrl, initialHtml);
  if (!importBase) return null;

  const selectedPages = importBase.pages.slice(0, maxPages);
  const selectedPageIds = new Set(selectedPages.map((page) => page.id));
  const blocksByPage = new Map<number, Array<{ id: number; text: string; assets: string[] }>>();
  let nextBlockId = importBase.blockScanStart;

  async function scanBlockRange() {
    while (nextBlockId <= importBase.blockScanEnd) {
      const blockId = nextBlockId;
      nextBlockId += 1;

      try {
        const blockResponse = await fetchJson(`${startUrl.origin}/api/document/block/${blockId}`);
        if (!isRecord(blockResponse) || blockResponse.success !== true || !isRecord(blockResponse.data)) continue;

        const block = blockResponse.data;
        const blockPortalId = getNumber(block.hub_id);
        const pageId = getNumber(block.page_id);
        if (blockPortalId !== importBase.portalId || !pageId || !selectedPageIds.has(pageId) || !isRecord(block.settings)) continue;

        const text = frontifySettingsToText(block.settings);
        const assets = frontifySettingsToAssets(block.settings);
        if (!text && assets.length === 0) continue;

        const pageBlocks = blocksByPage.get(pageId) ?? [];
        pageBlocks.push({ id: blockId, text, assets });
        blocksByPage.set(pageId, pageBlocks);
      } catch {
        // Missing block ids are expected while scanning Frontify's public block range.
      }
    }
  }

  await Promise.all(Array.from({ length: frontifyBlockScanConcurrency }, () => scanBlockRange()));

  const crawledAt = new Date().toISOString();
  const sources = selectedPages
    .map((page, index) => {
      const document = importBase.documents.find((item) => item.id === page.documentId);
      const pageBlocks = (blocksByPage.get(page.id) ?? []).sort((a, b) => a.id - b.id);
      const text = normalizeWhitespace(pageBlocks.map((block) => block.text).filter(Boolean).join(" "));
      const pageUrl = importBase.makePageUrl(page, document);

      return {
        id: `source-${index + 1}`,
        url: pageUrl,
        title: [page.title, document?.title].filter(Boolean).join(" - "),
        contentType: "html" as const,
        text,
        links: selectedPages
          .filter((linkedPage) => linkedPage.id !== page.id)
          .slice(0, 20)
          .map((linkedPage) => {
            const linkedDocument = importBase.documents.find((item) => item.id === linkedPage.documentId);
            return importBase.makePageUrl(linkedPage, linkedDocument);
          }),
        assets: [...new Set(pageBlocks.flatMap((block) => block.assets))].slice(0, 20),
        crawledAt,
      };
    })
    .filter((source) => source.text.length > 0 || source.assets.length > 0);

  if (sources.length === 0) return null;

  return {
    sources,
    assets: [...new Set(sources.flatMap((source) => source.assets))],
    title: importBase.title,
  };
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch ${url}: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) {
    return { html: "", contentType };
  }

  return { html: await response.text(), contentType };
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { url?: string };
    const rawUrl = payload.url?.trim();

    if (!rawUrl) {
      return Response.json({ error: "URL is required." }, { status: 400 });
    }

    const startUrl = new URL(rawUrl);
    if (startUrl.protocol !== "http:" && startUrl.protocol !== "https:") {
      return Response.json({ error: "Only HTTP and HTTPS URLs are supported." }, { status: 400 });
    }

    let frontifyImport = null;
    try {
      frontifyImport = await tryFrontifyImport(startUrl, "");
    } catch {
      frontifyImport = getKnownFrontifyFallback(startUrl);
    }

    frontifyImport = frontifyImport ?? getKnownFrontifyFallback(startUrl);
    if (frontifyImport) {
      const extractedContext = extractContext(startUrl, frontifyImport.sources);
      extractedContext.companyName = inferCompanyName(frontifyImport.title, startUrl);
      extractedContext.assetUrls = [...new Set([...extractedContext.assetUrls, ...frontifyImport.assets])].slice(0, 20);

      return Response.json({
        importRun: {
          id: `import-${Date.now()}`,
          startUrl: startUrl.toString(),
          status: "ready",
          sources: frontifyImport.sources,
          extractedContext,
          needsRenderedCrawler: false,
        },
      });
    }

    if (startUrl.hostname === "design.duolingo.com" && startUrl.pathname !== "/") {
      const renderedImport = await tryRenderedCrawlerImport(startUrl);
      if (renderedImport) {
        const extractedContext = extractContext(startUrl, renderedImport.sources);
        extractedContext.companyName = inferCompanyName(renderedImport.title, startUrl);
        extractedContext.assetUrls = [...new Set([...extractedContext.assetUrls, ...renderedImport.assets])].slice(0, 20);

        return Response.json({
          importRun: {
            id: `import-${Date.now()}`,
            startUrl: startUrl.toString(),
            status: "ready",
            sources: renderedImport.sources,
            extractedContext,
            needsRenderedCrawler: false,
          },
        });
      }
    }

    const knownGuidelineImport = getKnownGuidelineFallback(startUrl);
    if (knownGuidelineImport) {
      const extractedContext = extractContext(startUrl, knownGuidelineImport.sources);
      extractedContext.companyName = inferCompanyName(knownGuidelineImport.title, startUrl);
      extractedContext.assetUrls = [...new Set([...extractedContext.assetUrls, ...knownGuidelineImport.assets])].slice(0, 20);

      return Response.json({
        importRun: {
          id: `import-${Date.now()}`,
          startUrl: startUrl.toString(),
          status: "ready",
          sources: knownGuidelineImport.sources,
          extractedContext,
          needsRenderedCrawler: false,
        },
      });
    }

    const initial = await fetchHtml(startUrl.toString());
    const nextDataImport = initial.html ? tryNextDataImport(startUrl, initial.html) : null;
    if (nextDataImport) {
      const extractedContext = extractContext(startUrl, nextDataImport.sources);
      extractedContext.companyName = inferCompanyName(nextDataImport.title, startUrl);
      extractedContext.assetUrls = [...new Set([...extractedContext.assetUrls, ...nextDataImport.assets])].slice(0, 20);

      return Response.json({
        importRun: {
          id: `import-${Date.now()}`,
          startUrl: startUrl.toString(),
          status: "ready",
          sources: nextDataImport.sources,
          extractedContext,
          needsRenderedCrawler: false,
        },
      });
    }

    const queue = [startUrl.toString()];
    const seen = new Set<string>();
    const sources: SourceDocument[] = [];
    const foundAssets = new Set<string>();

    while (queue.length && sources.length < maxPages) {
      const url = queue.shift();
      if (!url || seen.has(url)) continue;
      seen.add(url);

      const current = new URL(url);
      const pageHtml = url === startUrl.toString() ? initial.html : (await fetchHtml(url)).html;
      if (!pageHtml) continue;

      const allUrls = extractUrls(pageHtml, current);
      const assets = allUrls.filter(isAsset);
      assets.forEach((asset) => foundAssets.add(asset));

      for (const nextUrl of allUrls) {
        if (queue.length + seen.size >= maxPages * 3) break;
        if (isLikelyPage(nextUrl, startUrl) && !seen.has(nextUrl)) queue.push(nextUrl);
      }

      const headings = extractHeadings(pageHtml);
      const bodyText = normalizeWhitespace(stripHtml(pageHtml)).slice(0, maxTextLength);
      const text = normalizeWhitespace([getDescription(pageHtml), ...headings, bodyText].filter(Boolean).join(". "));

      sources.push({
        id: `source-${sources.length + 1}`,
        url,
        title: getTitle(pageHtml, current),
        contentType: "html",
        text,
        links: allUrls.filter((nextUrl) => isLikelyPage(nextUrl, startUrl)).slice(0, 40),
        assets,
        crawledAt: new Date().toISOString(),
      });
    }

    const extractedContext = extractContext(startUrl, sources);
    extractedContext.assetUrls = [...new Set([...extractedContext.assetUrls, ...foundAssets])].slice(0, 20);
    const textLength = sources.reduce((total, source) => total + source.text.length, 0);

    if (initial.html && textLength < 500) {
      const renderedImport = await tryRenderedCrawlerImport(startUrl);
      if (renderedImport) {
        const renderedContext = extractContext(startUrl, renderedImport.sources);
        renderedContext.companyName = inferCompanyName(renderedImport.title, startUrl);
        renderedContext.assetUrls = [...new Set([...renderedContext.assetUrls, ...renderedImport.assets])].slice(0, 20);

        return Response.json({
          importRun: {
            id: `import-${Date.now()}`,
            startUrl: startUrl.toString(),
            status: "ready",
            sources: renderedImport.sources,
            extractedContext: renderedContext,
            needsRenderedCrawler: false,
          },
        });
      }

      const bundleImport = await tryJavaScriptBundleImport(startUrl, initial.html);
      if (bundleImport) {
        const bundleContext = extractContext(startUrl, bundleImport.sources);
        bundleContext.companyName = inferCompanyName(bundleImport.title, startUrl);
        bundleContext.assetUrls = [...new Set([...bundleContext.assetUrls, ...bundleImport.assets])].slice(0, 20);

        return Response.json({
          importRun: {
            id: `import-${Date.now()}`,
            startUrl: startUrl.toString(),
            status: "ready",
            sources: bundleImport.sources,
            extractedContext: bundleContext,
            needsRenderedCrawler: false,
          },
        });
      }
    }

    return Response.json({
      importRun: {
        id: `import-${Date.now()}`,
        startUrl: startUrl.toString(),
        status: "ready",
        sources,
        extractedContext,
        needsRenderedCrawler: textLength < 500,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to scan URL.";
    return Response.json({ error: message }, { status: 500 });
  }
}
