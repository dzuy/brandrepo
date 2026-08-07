"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type NavSection = "Home" | "Repo" | "Chat" | "Campaigns" | "Assets";
type RepoKind = "Brand" | "Product" | "Audience" | "Messaging" | "Campaign" | "Asset";

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
  description: string;
  metadata: string[];
  uploadedAt: string;
  sources: Source[];
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  citations?: Source[];
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
  activity: string[];
};

const storageKey = "brandhub-v1-prototype";

const seedSources: Source[] = [
  { id: "source-brand-guide", label: "2026 brand guide.pdf", type: "upload" },
  { id: "source-sales-deck", label: "enterprise sales deck.pptx", type: "upload" },
  { id: "source-campaign", label: "spring launch recap.docx", type: "upload" },
];

const initialRepo: RepoState = {
  company: {
    name: "Northstar Dental",
    website: "https://northstardental.example",
    description:
      "A modern dental membership platform that helps independent practices retain patients and grow recurring revenue without insurance complexity.",
  },
  brand: {
    description:
      "Northstar Dental gives independent dental practices a calmer, clearer way to offer membership plans directly to patients.",
    voice: ["clear", "reassuring", "expert without jargon", "optimistic"],
    values: ["patient trust", "practice independence", "transparent pricing", "operational simplicity"],
    rules: [
      "Lead with practice growth and patient confidence.",
      "Avoid sounding like traditional insurance.",
      "Use plain language for operations and pricing.",
    ],
    approvedTerms: ["membership plan", "patient loyalty", "recurring care", "practice growth"],
    prohibitedTerms: ["insurance replacement", "discount club", "cheap dental"],
    sources: [seedSources[0]],
  },
  products: [
    {
      id: "product-membership",
      name: "Membership Plan Engine",
      description:
        "A configurable plan builder for dental teams to launch, price, and manage in-house membership programs.",
      features: ["plan templates", "patient enrollment", "billing reminders", "practice dashboard"],
      benefits: ["more predictable revenue", "higher patient retention", "less front-desk friction"],
      pricing: "Monthly SaaS subscription by practice location.",
      positioning:
        "The simplest way for dental practices to turn loyal patients into predictable recurring revenue.",
      sources: [seedSources[1]],
    },
  ],
  audiences: [
    {
      id: "audience-owners",
      name: "Independent practice owners",
      description:
        "Dentists who own one to five practices and want growth without adding insurance administration.",
      painPoints: ["unpredictable production", "patient churn", "limited marketing time"],
      needs: ["simple setup", "clear ROI", "staff-friendly workflows"],
      messaging: ["grow recurring revenue", "keep patients engaged between visits", "launch without operational drag"],
      channels: ["email", "webinars", "dental conferences", "LinkedIn"],
      sources: [seedSources[1]],
    },
    {
      id: "audience-managers",
      name: "Office managers",
      description:
        "Practice operators responsible for patient communication, billing, and day-to-day adoption.",
      painPoints: ["manual follow-up", "confusing patient questions", "too many disconnected tools"],
      needs: ["scripted messaging", "automation", "easy patient lookup"],
      messaging: ["less manual work", "clear answers for patients", "one place to manage plans"],
      channels: ["email", "training guides", "in-product education"],
      sources: [seedSources[0]],
    },
  ],
  messaging: [
    {
      id: "message-core",
      positioning:
        "Northstar Dental helps independent practices build loyalty and recurring revenue through patient membership plans.",
      valueProps: [
        "Launch a membership plan without rebuilding operations.",
        "Give uninsured patients a clear reason to keep coming back.",
        "Track membership growth from one practice dashboard.",
      ],
      taglines: ["Membership plans made practical.", "Turn patient loyalty into predictable growth."],
      keyMessages: [
        "BrandHub-approved language should contrast membership simplicity with insurance complexity.",
        "Primary proof should focus on retention, recurring revenue, and staff time saved.",
      ],
      proofPoints: ["Used by 180+ independent dental locations", "Typical launch in under two weeks"],
      claims: ["Increase retention with direct patient membership plans"],
      sources: [seedSources[0], seedSources[1]],
    },
  ],
  campaigns: [
    {
      id: "campaign-spring",
      name: "Spring Practice Growth Push",
      goal: "Generate qualified demos with independent dental practice owners.",
      audience: "Independent practice owners",
      brief:
        "A concise education campaign showing how membership programs reduce churn among uninsured patients.",
      messaging: ["Membership plans made practical.", "Launch without operational drag."],
      content: ["LinkedIn post series on recurring revenue for independent dental practices."],
      assets: ["spring launch recap.docx"],
      status: "Complete",
      results: "34 demo requests from 420 webinar registrations.",
      learnings: "Practice owners responded best to operational simplicity and patient retention proof.",
      sources: [seedSources[2]],
    },
  ],
  assets: [
    {
      id: "asset-brand-guide",
      name: "2026 brand guide.pdf",
      type: "PDF",
      description: "Voice, terminology, visual identity notes, and messaging guardrails.",
      metadata: ["brand", "voice", "terminology"],
      uploadedAt: "2026-07-18",
      sources: [seedSources[0]],
    },
    {
      id: "asset-sales-deck",
      name: "enterprise sales deck.pptx",
      type: "Presentation",
      description: "Current product positioning, audience objections, and proof points.",
      metadata: ["product", "audience", "proof"],
      uploadedAt: "2026-07-22",
      sources: [seedSources[1]],
    },
  ],
  activity: [
    "Saved Spring Practice Growth Push learnings to Campaigns",
    "Generated initial company profile from uploaded brand guide",
    "Added Membership Plan Engine product context",
  ],
};

const navItems: NavSection[] = ["Home", "Repo", "Chat", "Campaigns", "Assets"];

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sourceText(source: Source) {
  return `${source.label}${source.type === "generated" ? " generated" : ""}`;
}

function classifyUpload(fileName: string): Asset["type"] {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".ppt") || lower.endsWith(".pptx")) return "Presentation";
  if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".webp")) return "Image";
  if (lower.endsWith(".mp4") || lower.endsWith(".mov")) return "Video";
  if (lower.endsWith(".pdf")) return "PDF";
  return "Document";
}

function describeContext(repo: RepoState) {
  return [
    `${repo.company.name} is positioned as ${repo.messaging[0]?.positioning.toLowerCase()}`,
    `Primary audience: ${repo.audiences[0]?.name}.`,
    `Brand voice: ${repo.brand.voice.join(", ")}.`,
    `Use approved terms like ${repo.brand.approvedTerms.slice(0, 3).join(", ")}.`,
  ];
}

function answerFromRepo(repo: RepoState, prompt: string): ChatMessage {
  const normalized = prompt.toLowerCase();
  const citations = [repo.brand.sources[0], repo.messaging[0]?.sources[0], repo.audiences[0]?.sources[0]].filter(
    Boolean,
  ) as Source[];

  if (normalized.includes("position")) {
    return {
      id: createId("assistant"),
      role: "assistant",
      text: `The core positioning is: ${repo.messaging[0].positioning} The strongest supporting ideas are ${repo.messaging[0].valueProps.join(" ")}`,
      citations,
    };
  }

  if (normalized.includes("audience") || normalized.includes("who")) {
    return {
      id: createId("assistant"),
      role: "assistant",
      text: `The primary audiences are ${repo.audiences
        .map((audience) => `${audience.name}, who need ${audience.needs.join(", ")}`)
        .join("; ")}.`,
      citations: repo.audiences.flatMap((audience) => audience.sources),
    };
  }

  if (normalized.includes("campaign") || normalized.includes("run")) {
    return {
      id: createId("assistant"),
      role: "assistant",
      text: `${repo.company.name} has campaign memory for ${repo.campaigns
        .map((campaign) => `${campaign.name}: ${campaign.learnings}`)
        .join(" ")}.`,
      citations: repo.campaigns.flatMap((campaign) => campaign.sources),
    };
  }

  return {
    id: createId("assistant"),
    role: "assistant",
    text: `Based on the repo, ${repo.company.name} should communicate in a ${repo.brand.voice.join(
      ", ",
    )} voice and anchor marketing around ${repo.messaging[0].valueProps[0].toLowerCase()} This answer uses Brand, Messaging, and Audience context already saved in BrandHub.`,
    citations,
  };
}

function generateContent(repo: RepoState, type: "social" | "email" | "concept") {
  const audience = repo.audiences[0];
  const product = repo.products[0];
  const valueProp = repo.messaging[0].valueProps[0];

  if (type === "email") {
    return `Subject: A practical way to grow patient loyalty\n\nHi {{first_name}},\n\nIndependent practices do not need more insurance complexity to build predictable growth. ${repo.company.name} helps teams launch patient membership plans that are simple to explain, easy to manage, and built around recurring care.\n\nWith ${product.name}, your team can turn ${audience.painPoints[1]} into a clear retention system while keeping the front desk focused on patients.\n\nWorth a short look this month?`;
  }

  if (type === "concept") {
    return `Campaign concept: Membership Plans Made Practical\n\nGoal: Show ${audience.name.toLowerCase()} how a membership program can improve retention without creating operational drag.\n\nCore message: ${valueProp}\n\nContent pieces: founder LinkedIn post, office manager one-page guide, webinar invite, and follow-up email using proof around launch speed and recurring revenue.`;
  }

  return `Dental practices do not need another complicated growth system.\n\n${repo.company.name} helps independent teams launch patient membership plans that are clear for patients, manageable for staff, and built for predictable recurring revenue.\n\n${repo.messaging[0].taglines[0]}`;
}

function loadInitialRepo() {
  if (typeof window === "undefined") return initialRepo;

  const stored = window.localStorage.getItem(storageKey);
  if (!stored) return initialRepo;

  try {
    return JSON.parse(stored) as RepoState;
  } catch {
    return initialRepo;
  }
}

export default function Home() {
  const [repo, setRepo] = useState<RepoState>(loadInitialRepo);
  const [section, setSection] = useState<NavSection>("Home");
  const [repoTab, setRepoTab] = useState<RepoKind>("Brand");
  const [setupOpen, setSetupOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return !window.localStorage.getItem(storageKey);
  });
  const [companyDraft, setCompanyDraft] = useState(() => loadInitialRepo().company);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Ask about positioning, audiences, prior campaigns, or generate a first draft. I will answer from the BrandHub repo context.",
      citations: [seedSources[0], seedSources[1]],
    },
  ]);
  const [generationType, setGenerationType] = useState<"social" | "email" | "concept">("social");
  const [generatedDraft, setGeneratedDraft] = useState("");

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(repo));
  }, [repo]);

  const understanding = useMemo(() => describeContext(repo), [repo]);
  const repoCounts = [
    { label: "Products", value: repo.products.length },
    { label: "Audiences", value: repo.audiences.length },
    { label: "Campaigns", value: repo.campaigns.length },
    { label: "Assets", value: repo.assets.length },
  ];

  function updateCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRepo((current) => ({
      ...current,
      company: companyDraft,
      activity: [`Updated company context for ${companyDraft.name}`, ...current.activity],
    }));
    setSetupOpen(false);
  }

  function handleUpload(files: FileList | null) {
    if (!files?.length) return;

    const newAssets = Array.from(files).map<Asset>((file) => {
      const source = { id: createId("source"), label: file.name, type: "upload" as const };
      return {
        id: createId("asset"),
        name: file.name,
        type: classifyUpload(file.name),
        description: "Uploaded context ready for BrandHub analysis. Prototype summary generated from filename and file type.",
        metadata: ["uploaded", classifyUpload(file.name).toLowerCase(), "source context"],
        uploadedAt: new Date().toISOString().slice(0, 10),
        sources: [source],
      };
    });

    setRepo((current) => ({
      ...current,
      assets: [...newAssets, ...current.assets],
      brand: {
        ...current.brand,
        sources: [...newAssets.flatMap((asset) => asset.sources), ...current.brand.sources],
      },
      activity: [`Uploaded ${newAssets.length} new source asset${newAssets.length > 1 ? "s" : ""}`, ...current.activity],
    }));
    setSection("Assets");
  }

  function sendChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!chatInput.trim()) return;
    const userMessage: ChatMessage = { id: createId("user"), role: "user", text: chatInput.trim() };
    const assistantMessage = answerFromRepo(repo, chatInput);
    setChatMessages((current) => [...current, userMessage, assistantMessage]);
    setChatInput("");
  }

  function runGeneration() {
    setGeneratedDraft(generateContent(repo, generationType));
  }

  function saveGeneratedContent() {
    if (!generatedDraft.trim()) return;
    const source: Source = {
      id: createId("source-generated"),
      label: `${generationType} draft from BrandHub Chat`,
      type: "generated",
    };
    const campaign: Campaign = {
      id: createId("campaign"),
      name: generationType === "concept" ? "Generated Membership Campaign" : "Generated Content Draft",
      goal: "Turn BrandHub context into reusable marketing work.",
      audience: repo.audiences[0].name,
      brief: "Generated in Chat using saved Brand, Product, Audience, Messaging, and Campaign context.",
      messaging: [repo.messaging[0].positioning, ...repo.messaging[0].valueProps.slice(0, 2)],
      content: [generatedDraft],
      assets: [],
      status: "Draft",
      results: "Not yet launched.",
      learnings: "Saved as new institutional marketing memory.",
      sources: [source, repo.brand.sources[0], repo.messaging[0].sources[0]],
    };
    setRepo((current) => ({
      ...current,
      campaigns: [campaign, ...current.campaigns],
      activity: [`Saved generated ${generationType} content to Campaigns`, ...current.activity],
    }));
    setGeneratedDraft("");
    setSection("Campaigns");
  }

  function saveChatAnswer(message: ChatMessage) {
    const source: Source = { id: createId("source-chat"), label: "Chat answer saved to Messaging", type: "generated" };
    const messaging: Messaging = {
      id: createId("message"),
      positioning: message.text,
      valueProps: ["Saved insight from a repo-grounded BrandHub answer."],
      taglines: [],
      keyMessages: [message.text],
      proofPoints: message.citations?.map(sourceText) ?? [],
      claims: [],
      sources: [source, ...(message.citations ?? [])],
    };
    setRepo((current) => ({
      ...current,
      messaging: [messaging, ...current.messaging],
      activity: ["Saved chat answer to Messaging", ...current.activity],
    }));
    setChatMessages((current) => current.map((item) => (item.id === message.id ? { ...item, saved: true } : item)));
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand-mark">
          <span>BH</span>
          <div>
            <strong>BrandHub</strong>
            <small>Marketing Repo</small>
          </div>
        </div>
        <nav>
          {navItems.map((item) => (
            <button className={section === item ? "active" : ""} key={item} onClick={() => setSection(item)}>
              {item}
            </button>
          ))}
        </nav>
        <label className="upload-drop">
          <span>Upload context</span>
          <small>Brand guides, decks, PDFs, images</small>
          <input multiple onChange={(event) => handleUpload(event.target.files)} type="file" />
        </label>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p>{repo.company.website}</p>
            <h1>{repo.company.name}</h1>
          </div>
          <button className="secondary" onClick={() => setSetupOpen((open) => !open)}>
            Workspace setup
          </button>
        </header>

        {setupOpen && (
          <form className="setup-panel" onSubmit={updateCompany}>
            <div>
              <p className="eyebrow">Company workspace setup</p>
              <h2>Create the Marketing Repo foundation</h2>
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
            <label className="wide">
              Short description
              <textarea
                onChange={(event) => setCompanyDraft({ ...companyDraft, description: event.target.value })}
                value={companyDraft.description}
              />
            </label>
            <button type="submit">Save workspace</button>
          </form>
        )}

        {section === "Home" && (
          <div className="content-grid">
            <section className="understanding">
              <p className="eyebrow">Here is what BrandHub understands</p>
              <h2>{repo.company.description}</h2>
              <div className="understanding-list">
                {understanding.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            </section>
            <section className="metric-row">
              {repoCounts.map((item) => (
                <article key={item.label}>
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </article>
              ))}
            </section>
            <section>
              <div className="section-heading">
                <h2>Suggested next actions</h2>
              </div>
              <div className="action-list">
                <button onClick={() => setSection("Chat")}>Ask what positioning to use in the next campaign</button>
                <button onClick={() => setSection("Assets")}>Upload the latest sales deck or brand guide</button>
                <button onClick={() => setSection("Campaigns")}>Review saved campaign memory</button>
              </div>
            </section>
            <section>
              <div className="section-heading">
                <h2>Recent activity</h2>
              </div>
              <div className="activity-list">
                {repo.activity.slice(0, 5).map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            </section>
          </div>
        )}

        {section === "Repo" && (
          <div className="repo-view">
            <div className="repo-tabs">
              {(["Brand", "Product", "Audience", "Messaging", "Campaign", "Asset"] as RepoKind[]).map((item) => (
                <button className={repoTab === item ? "active" : ""} key={item} onClick={() => setRepoTab(item)}>
                  {item}
                </button>
              ))}
            </div>
            <RepoPanel repo={repo} tab={repoTab} />
          </div>
        )}

        {section === "Chat" && (
          <div className="chat-layout">
            <section className="chat-panel">
              <div className="section-heading">
                <h2>Repo-grounded chat</h2>
                <span>{repo.assets.length} sources available</span>
              </div>
              <div className="messages">
                {chatMessages.map((message) => (
                  <article className={message.role} key={message.id}>
                    <p>{message.text}</p>
                    {message.citations?.length ? (
                      <div className="citations">
                        {message.citations.map((source) => (
                          <span key={`${message.id}-${source.id}`}>{source.label}</span>
                        ))}
                      </div>
                    ) : null}
                    {message.role === "assistant" && message.id !== "welcome" && (
                      <button className="small-action" disabled={message.saved} onClick={() => saveChatAnswer(message)}>
                        {message.saved ? "Saved" : "Save to Messaging"}
                      </button>
                    )}
                  </article>
                ))}
              </div>
              <form className="chat-input" onSubmit={sendChat}>
                <input
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder="Ask about positioning, audiences, or campaign history"
                  value={chatInput}
                />
                <button type="submit">Ask</button>
              </form>
            </section>
            <section className="generation-panel">
              <div className="section-heading">
                <h2>Generate content</h2>
              </div>
              <div className="segmented">
                <button className={generationType === "social" ? "active" : ""} onClick={() => setGenerationType("social")}>
                  Social post
                </button>
                <button className={generationType === "email" ? "active" : ""} onClick={() => setGenerationType("email")}>
                  Email
                </button>
                <button className={generationType === "concept" ? "active" : ""} onClick={() => setGenerationType("concept")}>
                  Campaign concept
                </button>
              </div>
              <button onClick={runGeneration}>Generate from repo</button>
              <textarea
                aria-label="Generated content draft"
                onChange={(event) => setGeneratedDraft(event.target.value)}
                placeholder="Generated draft appears here"
                value={generatedDraft}
              />
              <button disabled={!generatedDraft.trim()} onClick={saveGeneratedContent}>
                Save to BrandHub
              </button>
            </section>
          </div>
        )}

        {section === "Campaigns" && (
          <div className="campaign-list">
            {repo.campaigns.map((campaign) => (
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
            ))}
          </div>
        )}

        {section === "Assets" && (
          <div className="assets-view">
            <section className="asset-upload-band">
              <div>
                <p className="eyebrow">File upload interface</p>
                <h2>Add marketing source material</h2>
                <p>Uploaded files become source-backed assets and feed the initial company understanding in this prototype.</p>
              </div>
              <label>
                Select files
                <input multiple onChange={(event) => handleUpload(event.target.files)} type="file" />
              </label>
            </section>
            <section className="asset-grid">
              {repo.assets.map((asset) => (
                <article key={asset.id}>
                  <span>{asset.type}</span>
                  <h3>{asset.name}</h3>
                  <p>{asset.description}</p>
                  <small>{asset.metadata.join(" · ")} · {asset.uploadedAt}</small>
                </article>
              ))}
            </section>
          </div>
        )}
      </section>
    </main>
  );
}

function RepoPanel({ repo, tab }: { repo: RepoState; tab: RepoKind }) {
  if (tab === "Brand") {
    return (
      <section className="repo-panel">
        <h2>Brand</h2>
        <p>{repo.brand.description}</p>
        <Field label="Voice" values={repo.brand.voice} />
        <Field label="Values" values={repo.brand.values} />
        <Field label="Rules" values={repo.brand.rules} />
        <Field label="Approved terminology" values={repo.brand.approvedTerms} />
        <Field label="Prohibited terminology" values={repo.brand.prohibitedTerms} />
      </section>
    );
  }

  if (tab === "Product") {
    return <ObjectList items={repo.products} render={(product) => `${product.positioning} Features: ${product.features.join(", ")}`} />;
  }

  if (tab === "Audience") {
    return <ObjectList items={repo.audiences} render={(audience) => `${audience.description} Needs: ${audience.needs.join(", ")}`} />;
  }

  if (tab === "Messaging") {
    return <ObjectList items={repo.messaging} title={(item) => item.positioning} render={(item) => item.valueProps.join(" ")} />;
  }

  if (tab === "Campaign") {
    return <ObjectList items={repo.campaigns} render={(campaign) => `${campaign.goal} ${campaign.learnings}`} />;
  }

  return <ObjectList items={repo.assets} render={(asset) => `${asset.description} Metadata: ${asset.metadata.join(", ")}`} />;
}

function Field({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="field-row">
      <strong>{label}</strong>
      <div>
        {values.map((value) => (
          <span key={value}>{value}</span>
        ))}
      </div>
    </div>
  );
}

function ObjectList<T extends { id: string; name?: string; sources: Source[] }>({
  items,
  render,
  title,
}: {
  items: T[];
  render: (item: T) => string;
  title?: (item: T) => string;
}) {
  return (
    <section className="object-list">
      {items.map((item) => (
        <article key={item.id}>
          <h2>{title ? title(item) : item.name}</h2>
          <p>{render(item)}</p>
          <div className="citations">
            {item.sources.map((source) => (
              <span key={source.id}>{source.label}</span>
            ))}
          </div>
        </article>
      ))}
    </section>
  );
}
