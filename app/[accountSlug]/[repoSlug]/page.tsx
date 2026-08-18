import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { classifyRepoAsset, getRepoApprovedClaims, getRepoProducts } from "../../../lib/repo-context";
import { loadPublicRepo } from "../../../lib/public-repo";
import {
  getAiSharePrompt,
  getPublicRepoSnapshot,
  getRepoCanonicalUrl,
  serializeRepoForAI,
} from "../../../lib/repo-share";
import { Asset, ColorToken, WorkspaceState } from "../../../lib/repo-model";
import { PublicRepoActions } from "./PublicRepoActions";

type PublicRepoParams = {
  accountSlug: string;
  repoSlug: string;
};

function brandTitle(workspace: WorkspaceState) {
  return workspace.repo.company.name || workspace.name || "Untitled brand";
}

function firstText(...values: Array<string | undefined>) {
  return values.find((value) => value?.trim())?.trim() ?? "";
}

function formatDate(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function paragraphs(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function SectionText({ text }: { text: string }) {
  const items = paragraphs(text);
  if (!items.length) return null;

  return (
    <>
      {items.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </>
  );
}

function ColorSwatches({ colors }: { colors: ColorToken[] }) {
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

function AssetPreviewGrid({ assets }: { assets: Asset[] }) {
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

export async function generateMetadata({ params }: { params: Promise<PublicRepoParams> }): Promise<Metadata> {
  const { accountSlug, repoSlug } = await params;
  const publicRepo = await loadPublicRepo(accountSlug, repoSlug).catch(() => null);
  if (!publicRepo) return {};

  const title = `${brandTitle(publicRepo.workspace)} — BrandRepo`;
  const description = firstText(publicRepo.workspace.repo.company.description, publicRepo.workspace.repo.brand.description, "Public BrandRepo guide.");
  const canonicalUrl = getRepoCanonicalUrl(publicRepo.accountSlug, publicRepo.repoSlug);
  const logo = publicRepo.workspace.repo.assets.find((asset) => asset.url && classifyRepoAsset(asset) === "logo");

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: "BrandRepo",
      images: logo?.url
        ? [
            {
              url: logo.url,
              alt: logo.description || `${brandTitle(publicRepo.workspace)} logo`,
            },
          ]
        : undefined,
    },
    twitter: {
      card: logo?.url ? "summary_large_image" : "summary",
      title,
      description,
      images: logo?.url ? [logo.url] : undefined,
    },
  };
}

export default async function PublicRepoPage({ params }: { params: Promise<PublicRepoParams> }) {
  const { accountSlug, repoSlug } = await params;
  const publicRepo = await loadPublicRepo(accountSlug, repoSlug).catch(() => null);
  if (!publicRepo) notFound();

  const { workspace, updatedAt, visibility } = publicRepo;
  const repo = workspace.repo;
  const snapshot = getPublicRepoSnapshot(workspace);
  const title = brandTitle(workspace);
  const canonicalUrl = getRepoCanonicalUrl(publicRepo.accountSlug, publicRepo.repoSlug);
  const aiUrl = `${canonicalUrl}/ai`;
  const aiPrompt = getAiSharePrompt(publicRepo);
  const aiMarkdown = serializeRepoForAI(publicRepo);
  const primaryLogo = snapshot.logoAssets[0];
  const messaging = repo.messaging[0];
  const audience = repo.audiences[0];
  const products = getRepoProducts(repo);
  const approvedClaims = getRepoApprovedClaims(repo).filter((claim) => claim.status === "Approved" && claim.claim.trim());
  const shortDescription = firstText(repo.company.description, messaging?.taglines[0]);
  const about = firstText(repo.brand.description, repo.company.description);
  const primaryValue = firstText(messaging?.valueProps[0], messaging?.positioning);
  const voiceWords = repo.brand.voice.slice(0, 6);
  const avoidWords = repo.brand.prohibitedTerms.slice(0, 6);
  const assetCounts = snapshot.assetCounts;

  return (
    <main className="public-repo-page">
      <section className="public-hero">
        <div className="public-hero-main">
          {primaryLogo?.url ? (
            <div className="public-logo-frame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt={primaryLogo.description || `${title} logo`} src={primaryLogo.url} />
            </div>
          ) : null}
          <div>
            <p className="eyebrow">BrandRepo</p>
            <h1>{title}</h1>
            {shortDescription ? <p>{shortDescription}</p> : null}
            <dl className="public-meta">
              <div>
                <dt>Visibility</dt>
                <dd>{visibility}</dd>
              </div>
              {updatedAt ? (
                <div>
                  <dt>Updated</dt>
                  <dd>{formatDate(updatedAt)}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        </div>
        <PublicRepoActions aiPrompt={aiPrompt} canonicalUrl={canonicalUrl} />
      </section>

      <section className="public-ai-callout" id="use-with-ai">
        <div>
          <p className="eyebrow">Use this brand with AI</p>
          <h2>Copy this BrandRepo into any AI tool.</h2>
          <p>Give ChatGPT, Claude, Gamma, or another AI tool this BrandRepo so it can use your approved brand guidelines when creating content.</p>
        </div>
        <div className="public-url-box">
          <code>{canonicalUrl}</code>
          <a href={aiUrl}>AI-readable version →</a>
        </div>
      </section>

      <section className="public-section public-glance" aria-labelledby="brand-at-a-glance">
        <div className="public-section-heading">
          <p className="eyebrow">Overview</p>
          <h2 id="brand-at-a-glance">Brand at a glance</h2>
        </div>
        <div className="public-glance-grid">
          {primaryLogo?.url ? (
            <article>
              <strong>Primary logo</strong>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt={primaryLogo.description || `${title} primary logo`} src={primaryLogo.url} />
              <a href={primaryLogo.url}>Direct logo URL</a>
            </article>
          ) : null}
          {snapshot.colors.length ? (
            <article>
              <strong>Colors</strong>
              <ColorSwatches colors={snapshot.colors} />
            </article>
          ) : null}
          {snapshot.typography.fontNames.length ? (
            <article>
              <strong>Typography</strong>
              <p className="public-font-sample">{snapshot.typography.fontNames.join(", ")}</p>
              {snapshot.typography.weights.length ? <small>{snapshot.typography.weights.join(", ")}</small> : null}
            </article>
          ) : null}
          {snapshot.usefulAssets.length ? (
            <article>
              <strong>Assets</strong>
              <AssetPreviewGrid assets={snapshot.usefulAssets} />
            </article>
          ) : null}
        </div>
      </section>

      {about ? (
        <section className="public-section" id="about">
          <div className="public-section-heading">
            <p className="eyebrow">About</p>
            <h2>What this brand is</h2>
          </div>
          <div className="public-prose">
            <SectionText text={about} />
            {repo.company.website ? (
              <p>
                Website: <a href={repo.company.website}>{repo.company.website}</a>
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {products.length ? (
        <section className="public-section" id="products">
          <div className="public-section-heading">
            <p className="eyebrow">Products</p>
            <h2>What this company offers</h2>
            <a href="#products">View Products →</a>
          </div>
          <div className="public-card-grid">
            {products.map((product) => (
              <article key={product.id}>
                <strong>{product.name || "Untitled product"}</strong>
                {product.status ? <small>{product.status}</small> : null}
                {product.description ? <SectionText text={product.description} /> : null}
                {product.keyCapabilities.length ? (
                  <>
                    <strong>Key capabilities</strong>
                    <ul>
                      {product.keyCapabilities.slice(0, 5).map((capability) => (
                        <li key={capability}>{capability}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {primaryValue || messaging?.keyMessages.length || messaging?.proofPoints.length || messaging?.taglines.length ? (
        <section className="public-section" id="messaging">
          <div className="public-section-heading">
            <p className="eyebrow">Messaging</p>
            <h2>How the brand communicates</h2>
            <a href="#messaging">View Messaging →</a>
          </div>
          <div className="public-card-grid">
            {primaryValue ? (
              <article>
                <strong>Primary value proposition</strong>
                <SectionText text={primaryValue} />
              </article>
            ) : null}
            {messaging?.keyMessages.length ? (
              <article>
                <strong>Key messages</strong>
                <ul>
                  {messaging.keyMessages.slice(0, 5).map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </article>
            ) : null}
            {messaging?.proofPoints.length ? (
              <article>
                <strong>Key differentiators</strong>
                <ul>
                  {messaging.proofPoints.slice(0, 5).map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </article>
            ) : null}
            {messaging?.taglines[0] ? (
              <article>
                <strong>Tagline</strong>
                <p>{messaging.taglines[0]}</p>
              </article>
            ) : null}
          </div>
        </section>
      ) : null}

      {approvedClaims.length ? (
        <section className="public-section" id="approved-claims">
          <div className="public-section-heading">
            <p className="eyebrow">Approved facts & claims</p>
            <h2>What this brand can say</h2>
            <a href="#approved-claims">View Approved Claims →</a>
          </div>
          <div className="public-card-grid">
            <article>
              <strong>Approved</strong>
              <ul>
                {approvedClaims.slice(0, 12).map((claim) => (
                  <li key={claim.id}>{claim.claim}</li>
                ))}
              </ul>
            </article>
          </div>
        </section>
      ) : null}

      {voiceWords.length || avoidWords.length || repo.brand.rules.length ? (
        <section className="public-section" id="voice-tone">
          <div className="public-section-heading">
            <p className="eyebrow">Voice & Tone</p>
            <h2>How it should sound</h2>
            <a href="#voice-tone">View Voice & Tone →</a>
          </div>
          <div className="public-card-grid">
            {voiceWords.length ? (
              <article>
                <strong>Sounds like</strong>
                <div className="public-chip-list">
                  {voiceWords.map((word) => (
                    <span key={word}>{word}</span>
                  ))}
                </div>
              </article>
            ) : null}
            {avoidWords.length ? (
              <article>
                <strong>Avoid</strong>
                <div className="public-chip-list">
                  {avoidWords.map((word) => (
                    <span key={word}>{word}</span>
                  ))}
                </div>
              </article>
            ) : null}
            {repo.brand.rules.length ? (
              <article>
                <strong>Important rules</strong>
                <ul>
                  {repo.brand.rules.slice(0, 5).map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              </article>
            ) : null}
          </div>
        </section>
      ) : null}

      {snapshot.logoAssets.length || snapshot.colors.length || snapshot.identity.usage || snapshot.identity.logos ? (
        <section className="public-section" id="identity">
          <div className="public-section-heading">
            <p className="eyebrow">Visual Identity</p>
            <h2>How the brand should look</h2>
            <a href="#identity">View Identity →</a>
          </div>
          <div className="public-card-grid">
            {snapshot.identity.logos ? (
              <article>
                <strong>Logos</strong>
                <SectionText text={snapshot.identity.logos} />
              </article>
            ) : null}
            {snapshot.identity.usage ? (
              <article>
                <strong>Usage</strong>
                <SectionText text={snapshot.identity.usage} />
              </article>
            ) : null}
            {snapshot.colors.length ? (
              <article>
                <strong>Palette</strong>
                <ColorSwatches colors={snapshot.colors} />
              </article>
            ) : null}
          </div>
        </section>
      ) : null}

      {audience || repo.audienceSettings.primaryAudience || repo.audienceSettings.secondaryAudiences ? (
        <section className="public-section" id="audiences">
          <div className="public-section-heading">
            <p className="eyebrow">Audiences</p>
            <h2>Who this brand is for</h2>
            <a href="#audiences">View Audiences →</a>
          </div>
          <div className="public-card-grid">
            {repo.audienceSettings.primaryAudience ? (
              <article>
                <strong>Primary audience</strong>
                <SectionText text={repo.audienceSettings.primaryAudience} />
              </article>
            ) : null}
            {repo.audienceSettings.secondaryAudiences ? (
              <article>
                <strong>Secondary audiences</strong>
                <SectionText text={repo.audienceSettings.secondaryAudiences} />
              </article>
            ) : null}
            {audience ? (
              <article>
                <strong>{audience.name}</strong>
                <SectionText text={audience.description} />
              </article>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="public-section" id="assets">
        <div className="public-section-heading">
          <p className="eyebrow">Assets</p>
          <h2>Brand asset summary</h2>
        </div>
        <div className="public-stats">
          <span>{assetCounts.logo} Logos</span>
          <span>{assetCounts.icon} Icons</span>
          <span>{assetCounts.element} Elements</span>
          <span>{assetCounts.imagery} Images</span>
        </div>
      </section>

      <section className="public-section public-ai-readable" id="ai-readable">
        <div className="public-section-heading">
          <p className="eyebrow">AI-readable</p>
          <h2>Plain text context</h2>
          <a href={aiUrl}>Open full AI version →</a>
        </div>
        <pre>{aiMarkdown}</pre>
      </section>
    </main>
  );
}
