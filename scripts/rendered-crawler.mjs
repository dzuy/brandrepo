import { createServer } from "node:http";
import { chromium } from "playwright";

const port = Number(process.env.RENDERED_CRAWLER_PORT ?? 8789);
const host = process.env.RENDERED_CRAWLER_HOST ?? "127.0.0.1";
const maxTextLength = 50000;
const assetPattern = /\.(pdf|png|jpe?g|webp|gif|svg|pptx?|docx?|mp4|mov)(\?|#|$)/i;

let browserPromise;

function getBrowser() {
  browserPromise ??= chromium.launch({ headless: true });
  return browserPromise;
}

function isSafeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let previousHeight = 0;
      let attempts = 0;
      const timer = setInterval(() => {
        const height = document.documentElement.scrollHeight;
        window.scrollTo(0, height);
        attempts += 1;

        if (height === previousHeight || attempts >= 12) {
          clearInterval(timer);
          window.scrollTo(0, 0);
          resolve();
          return;
        }

        previousHeight = height;
      }, 350);
    });
  });
}

async function renderUrl(url) {
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1400 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36 BrandRepoCrawler/1.0",
  });
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    try {
      await page.waitForLoadState("networkidle", { timeout: 10000 });
    } catch {
      // Some pages keep long-running analytics or app requests open.
    }

    await autoScroll(page);

    return await page.evaluate(
      ({ assetPatternSource, maxTextLength }) => {
        const assetPattern = new RegExp(assetPatternSource, "i");
        const toAbsoluteUrl = (value) => {
          try {
            return new URL(value, location.href).toString();
          } catch {
            return "";
          }
        };

        const links = [...document.querySelectorAll("a[href]")]
          .map((element) => toAbsoluteUrl(element.getAttribute("href") || ""))
          .filter(Boolean);

        const imageAssets = [...document.querySelectorAll("img[src], source[src]")]
          .map((element) => toAbsoluteUrl(element.getAttribute("src") || ""))
          .filter(Boolean);

        const downloadableAssets = [...document.querySelectorAll("a[href]")]
          .map((element) => toAbsoluteUrl(element.getAttribute("href") || ""))
          .filter((asset) => assetPattern.test(asset));

        const headings = [...document.querySelectorAll("h1, h2, h3")]
          .map((element) => element.textContent?.replace(/\s+/g, " ").trim() || "")
          .filter(Boolean);

        return {
          url: location.href,
          title: document.title || location.hostname,
          text: (document.body?.innerText || "").replace(/\s+/g, " ").trim().slice(0, maxTextLength),
          headings: [...new Set(headings)].slice(0, 40),
          links: [...new Set(links)].slice(0, 120),
          assets: [...new Set([...imageAssets, ...downloadableAssets])].slice(0, 80),
        };
      },
      { assetPatternSource: assetPattern.source, maxTextLength },
    );
  } finally {
    await context.close();
  }
}

const server = createServer(async (request, response) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method !== "POST" || request.url !== "/render") {
    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "Not found." }));
    return;
  }

  try {
    const payload = JSON.parse(await readBody(request));
    const url = typeof payload.url === "string" ? payload.url.trim() : "";
    if (!isSafeUrl(url)) {
      response.writeHead(400, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: "A valid HTTP or HTTPS URL is required." }));
      return;
    }

    const rendered = await renderUrl(url);
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ rendered }));
  } catch (error) {
    response.writeHead(500, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Unable to render URL." }));
  }
});

server.listen(port, host, () => {
  console.log(`Rendered crawler listening on http://${host}:${port}/render`);
});

process.on("SIGINT", async () => {
  if (browserPromise) {
    const browser = await browserPromise;
    await browser.close();
  }
  server.close(() => process.exit(0));
});
