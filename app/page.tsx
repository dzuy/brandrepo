"use client";

import { DragEvent, FormEvent, ReactNode, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

type NavSection = "Home" | "Repo" | "Chat" | "Campaigns" | "Assets" | "Settings";
type ThemeMode = "dark" | "light";
type RepoKind =
  | "Brand Guidelines"
  | "Identity"
  | "Imagery"
  | "Colors"
  | "Voice & Tone"
  | "Typography"
  | "Messaging"
  | "Audiences"
  | "Channel SEO"
  | "Rules";

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
const themeStorageKey = "brandhub-theme-v1";
const assetBucket = "brandhub-assets";
const previousWorkspaceStorageKey = "brandhub-workspaces-v1";
const singleWorkspaceStorageKey = "brandhub-empty-workspace-v1";
const legacyStorageKey = "brandhub-v1-prototype";

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
  sectionUrls: {},
  sectionNotes: {},
  activity: [],
};

const navItems: NavSection[] = ["Home", "Repo", "Chat", "Campaigns", "Assets"];
const repoTabs: RepoKind[] = [
  "Brand Guidelines",
  "Identity",
  "Imagery",
  "Colors",
  "Voice & Tone",
  "Typography",
  "Messaging",
  "Audiences",
  "Channel SEO",
  "Rules",
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
    repo,
    chatMessages: createWelcomeChat(),
    generatedDraft: "",
    generationType: "social",
  };
}

function sourceText(source: Source) {
  return `${source.label}${source.type === "generated" ? " generated" : ""}`;
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
  if (value.includes("rule") || value.includes("usage") || value.includes("do not") || value.includes("don't") || value.includes("avoid")) {
    return "Rules";
  }
  if (value.includes("messaging") || value.includes("narrative") || value.includes("positioning")) return "Messaging";
  return "Brand Guidelines";
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

function answerFromRepo(repo: RepoState, prompt: string): ChatMessage {
  const normalized = prompt.toLowerCase();
  const citations = [repo.brand.sources[0], repo.messaging[0]?.sources[0], repo.audiences[0]?.sources[0]].filter(
    Boolean,
  ) as Source[];

  const hasContext =
    Boolean(repo.company.description) ||
    Boolean(repo.brand.description) ||
    repo.products.length > 0 ||
    repo.audiences.length > 0 ||
    repo.messaging.length > 0 ||
    repo.campaigns.length > 0 ||
    repo.assets.length > 0;

  if (!hasContext) {
    return {
      id: createId("assistant"),
      role: "assistant",
      text: "I do not have any repo context yet. Add company details or upload source material in Repo, then I can answer from BrandRepo context.",
    };
  }

  if (normalized.includes("position") && repo.messaging[0]) {
    return {
      id: createId("assistant"),
      role: "assistant",
      text: `The core positioning is: ${repo.messaging[0].positioning} The strongest supporting ideas are ${repo.messaging[0].valueProps.join(" ")}`,
      citations,
    };
  }

  if ((normalized.includes("audience") || normalized.includes("who")) && repo.audiences.length) {
    return {
      id: createId("assistant"),
      role: "assistant",
      text: `The primary audiences are ${repo.audiences
        .map((audience) => `${audience.name}, who need ${audience.needs.join(", ")}`)
        .join("; ")}.`,
      citations: repo.audiences.flatMap((audience) => audience.sources),
    };
  }

  if ((normalized.includes("campaign") || normalized.includes("run")) && repo.campaigns.length) {
    return {
      id: createId("assistant"),
      role: "assistant",
      text: `${repo.company.name || "This repo"} has campaign memory for ${repo.campaigns
        .map((campaign) => `${campaign.name}: ${campaign.learnings}`)
        .join(" ")}.`,
      citations: repo.campaigns.flatMap((campaign) => campaign.sources),
    };
  }

  return {
    id: createId("assistant"),
    role: "assistant",
    text: "I found some context in the repo, but not enough structured Brand, Audience, and Messaging data to answer that fully yet.",
    citations,
  };
}

function generateContent(repo: RepoState, type: "social" | "email" | "concept") {
  const audience = repo.audiences[0];
  const product = repo.products[0];
  const message = repo.messaging[0];

  if (!repo.company.name || !audience || !product || !message) {
    return "Add company, product, audience, and messaging context before generating content from the repo.";
  }

  const valueProp = message.valueProps[0] ?? message.positioning;

  if (type === "email") {
    return `Subject: ${valueProp}\n\nHi {{first_name}},\n\n${repo.company.name} helps ${audience.name.toLowerCase()} with ${product.name}.\n\n${message.positioning}\n\nWould it be useful to talk through whether this fits your current priorities?`;
  }

  if (type === "concept") {
    return `Campaign concept: ${message.taglines[0] ?? product.name}\n\nAudience: ${audience.name}\n\nCore message: ${valueProp}\n\nContent pieces: social post, email, landing page draft, and follow-up note using the saved repo context.`;
  }

  return `${repo.company.name}\n\n${message.positioning}\n\n${message.taglines[0] ?? valueProp}`;
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
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "dark";
    const storedTheme = window.localStorage.getItem(themeStorageKey);
    return storedTheme === "light" || storedTheme === "dark" ? storedTheme : "dark";
  });
  const [cloudHydrated, setCloudHydrated] = useState(false);
  const [syncStatus, setSyncStatus] = useState("Local only");
  const [section, setSection] = useState<NavSection>("Home");
  const [repoTab, setRepoTab] = useState<RepoKind>("Brand Guidelines");
  const [companyDraft, setCompanyDraft] = useState(initialRepo.company);
  const [persistenceReady, setPersistenceReady] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [importRun, setImportRun] = useState<ImportRun | null>(null);
  const [importStatus, setImportStatus] = useState<"idle" | "scanning" | "ready" | "importing" | "error">("idle");
  const [importError, setImportError] = useState("");
  const [sectionScanUrl, setSectionScanUrl] = useState("");
  const [lastSectionScan, setLastSectionScan] = useState<{ tab: RepoKind; url: string } | null>(null);

  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? workspaces[0];
  const repo = activeWorkspace?.repo ?? initialRepo;
  const chatMessages = activeWorkspace?.chatMessages ?? createWelcomeChat();
  const generationType = activeWorkspace?.generationType ?? "social";
  const generatedDraft = activeWorkspace?.generatedDraft ?? "";

  useEffect(() => {
    window.localStorage.setItem(themeStorageKey, theme);
  }, [theme]);

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
    window.localStorage.setItem(storageKey, JSON.stringify({ activeWorkspaceId: activeWorkspace?.id, workspaces }));
  }, [activeWorkspace?.id, persistenceReady, workspaces]);

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
        const selectedWorkspace = cloudWorkspaces[0];
        setWorkspaces(cloudWorkspaces);
        resetTransientWorkspaceState(selectedWorkspace);
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
  }, [cloudHydrated, currentUser, persistenceReady]);

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

  function updateGeneratedDraft(value: string) {
    updateActiveWorkspace((workspace) => ({ ...workspace, generatedDraft: value }));
  }

  function updateGenerationType(value: "social" | "email" | "concept") {
    updateActiveWorkspace((workspace) => ({ ...workspace, generationType: value }));
  }

  function addWorkspace() {
    const nextWorkspace = createWorkspace(initialRepo, `Repo ${workspaces.length + 1}`);
    setWorkspaces((current) => [...current, nextWorkspace]);
    setActiveWorkspaceId(nextWorkspace.id);
    setCompanyDraft(nextWorkspace.repo.company);
    setImportRun(null);
    setImportStatus("idle");
    setImportError("");
    setSection("Home");
    setRepoTab("Brand Guidelines");
  }

  function resetTransientWorkspaceState(nextWorkspace: WorkspaceState) {
    setActiveWorkspaceId(nextWorkspace.id);
    setCompanyDraft(nextWorkspace.repo.company);
    setImportRun(null);
    setImportStatus("idle");
    setImportError("");
    setChatInput("");
  }

  function activateWorkspace(workspaceId: string) {
    const nextWorkspace = workspaces.find((workspace) => workspace.id === workspaceId);
    if (!nextWorkspace) return;

    resetTransientWorkspaceState(nextWorkspace);
  }

  function handleRepoSelection(workspaceId: string) {
    if (workspaceId === "new-repo") {
      addWorkspace();
      return;
    }

    activateWorkspace(workspaceId);
  }

  function deleteActiveWorkspace() {
    if (!activeWorkspace) return;

    const confirmed = window.confirm(`Delete "${activeWorkspace.name}"? This removes this repo from this prototype.`);
    if (!confirmed) return;

    const remainingWorkspaces = workspaces.filter((workspace) => workspace.id !== activeWorkspace.id);
    const nextWorkspaces = remainingWorkspaces.length ? remainingWorkspaces : [createWorkspace()];
    const nextWorkspace = nextWorkspaces[0];

    setWorkspaces(nextWorkspaces);
    if (supabase && currentUser) {
      supabase.from("brandhub_workspaces").delete().eq("id", activeWorkspace.id).eq("user_id", currentUser.id).then(() => {
        setSyncStatus("Synced to Supabase");
      });
    }
    resetTransientWorkspaceState(nextWorkspace);
    setSection("Repo");
    setRepoTab("Brand Guidelines");
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
            <span>BR</span>
            <div>
              <strong>BrandRepo</strong>
              <small>Marketing Repo</small>
            </div>
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
            <span>BR</span>
            <div>
              <strong>BrandRepo</strong>
              <small>Marketing Repo</small>
            </div>
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

  const canGenerate = Boolean(repo.company.name && repo.products[0] && repo.audiences[0] && repo.messaging[0]);
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

  async function handleUpload(files: FileList | null, nextSection?: NavSection, options?: { repoTab?: RepoKind }) {
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
            ? `${options.repoTab} asset uploaded directly to this repo section.`
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

  function sendChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!chatInput.trim()) return;
    const userMessage: ChatMessage = { id: createId("user"), role: "user", text: chatInput.trim() };
    const assistantMessage = answerFromRepo(repo, chatInput);
    updateChatMessages((current) => [...current, userMessage, assistantMessage]);
    setChatInput("");
  }

  function runGeneration() {
    updateGeneratedDraft(generateContent(repo, generationType));
  }

  function saveGeneratedContent() {
    if (!generatedDraft.trim()) return;
    const source: Source = {
      id: createId("source-generated"),
      label: `${generationType} draft from BrandRepo Chat`,
      type: "generated",
    };
    const campaign: Campaign = {
      id: createId("campaign"),
      name: generationType === "concept" ? "Generated Campaign Concept" : "Generated Content Draft",
      goal: "Turn BrandRepo context into reusable marketing work.",
      audience: repo.audiences[0]?.name ?? "Unassigned",
      brief: "Generated in Chat using saved Brand, Product, Audience, Messaging, and Campaign context.",
      messaging: repo.messaging[0] ? [repo.messaging[0].positioning, ...repo.messaging[0].valueProps.slice(0, 2)] : [],
      content: [generatedDraft],
      assets: [],
      status: "Draft",
      results: "Not yet launched.",
      learnings: "Saved as new institutional marketing memory.",
      sources: [source, repo.brand.sources[0], repo.messaging[0]?.sources[0]].filter(Boolean) as Source[],
    };
    updateRepo((current) => ({
      ...current,
      campaigns: [campaign, ...current.campaigns],
      activity: [`Saved generated ${generationType} content to Campaigns`, ...current.activity],
    }));
    updateGeneratedDraft("");
    setSection("Campaigns");
  }

  function saveChatAnswer(message: ChatMessage) {
    const source: Source = { id: createId("source-chat"), label: "Chat answer saved to Messaging", type: "generated" };
    const messaging: Messaging = {
      id: createId("message"),
      positioning: message.text,
      valueProps: ["Saved insight from a repo-grounded BrandRepo answer."],
      taglines: [],
      keyMessages: [message.text],
      proofPoints: message.citations?.map(sourceText) ?? [],
      claims: [],
      sources: [source, ...(message.citations ?? [])],
    };
    updateRepo((current) => ({
      ...current,
      messaging: [messaging, ...current.messaging],
      activity: ["Saved chat answer to Messaging", ...current.activity],
    }));
    updateChatMessages((current) => current.map((item) => (item.id === message.id ? { ...item, saved: true } : item)));
  }

  return (
    <main className="app-shell" data-theme={theme}>
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand-mark">
          <span>BR</span>
          <div>
            <strong>BrandRepo</strong>
            <small>Marketing Repo</small>
          </div>
        </div>
        <div className="workspace-switcher">
          <label>
            Repo
            <select value={activeWorkspace?.id ?? ""} onChange={(event) => handleRepoSelection(event.target.value)}>
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
              <button className={section === item ? "active" : ""} onClick={() => setSection(item)}>
                {item}
              </button>
              {item === "Repo" && section === "Repo" && !isNewWorkspace && (
                <div className="repo-subnav">
                  {repoTabs.map((repoSection) => (
                    <button
                      className={repoTab === repoSection ? "active" : ""}
                      key={repoSection}
                      onClick={() => setRepoTab(repoSection)}
                    >
                      {repoSection}
                    </button>
                  ))}
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
            {isNewWorkspace ? (
              <>
                <header className="topbar">
                  <div>
                    <p>No website added</p>
                    <h1>New repo</h1>
                  </div>
                  <button className="danger-secondary" onClick={deleteActiveWorkspace} type="button">
                    Delete repo
                  </button>
                </header>
                <EmptyState
                  title="Set up this repo first"
                  description="Add a company name and website on Home before reviewing brand guideline sections."
                />
              </>
            ) : (
              <>
                <header className="topbar">
                  <div>
                    <p>{repo.company.website || "No website added"}</p>
                    <h1>{repo.company.name || "New repo"}</h1>
                  </div>
                  <button className="danger-secondary" onClick={deleteActiveWorkspace} type="button">
                    Delete repo
                  </button>
                </header>
              </>
            )}
            {importError && <p className="import-error">{importError}</p>}
            {!isNewWorkspace && (
              <RepoPanel
                onScanSectionUrl={scanSectionUrl}
                onDeleteAsset={deleteAsset}
                onUploadSectionAssets={(files, tab) => void handleUpload(files, undefined, { repoTab: tab })}
                onAddSectionMarkdown={addSectionMarkdown}
                onDeleteSectionMarkdown={deleteSectionMarkdown}
                onUpdateSectionMarkdown={updateSectionMarkdown}
                lastSectionScan={lastSectionScan}
                repo={repo}
                scanningUrl={sectionScanUrl}
                tab={repoTab}
              />
            )}
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
                <button className={generationType === "social" ? "active" : ""} onClick={() => updateGenerationType("social")}>
                  Social post
                </button>
                <button className={generationType === "email" ? "active" : ""} onClick={() => updateGenerationType("email")}>
                  Email
                </button>
                <button className={generationType === "concept" ? "active" : ""} onClick={() => updateGenerationType("concept")}>
                  Campaign concept
                </button>
              </div>
              <button disabled={!canGenerate} onClick={runGeneration}>Generate from repo</button>
              <textarea
                aria-label="Generated content draft"
                onChange={(event) => updateGeneratedDraft(event.target.value)}
                placeholder={canGenerate ? "Generated draft appears here" : "Add company, product, audience, and messaging context before generating content."}
                value={generatedDraft}
              />
              <button disabled={!generatedDraft.trim()} onClick={saveGeneratedContent}>
                Save to BrandRepo
              </button>
            </section>
          </div>
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
              {repo.assets.length ? repo.assets.map((asset) => (
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
    </main>
  );
}

function RepoPanel({
  lastSectionScan,
  onAddSectionMarkdown,
  onDeleteAsset,
  onDeleteSectionMarkdown,
  onScanSectionUrl,
  onUpdateSectionMarkdown,
  onUploadSectionAssets,
  repo,
  scanningUrl,
  tab,
}: {
  lastSectionScan: { tab: RepoKind; url: string } | null;
  onAddSectionMarkdown: (tab: RepoKind, markdown: string) => void;
  onDeleteAsset: (assetId: string) => void;
  onDeleteSectionMarkdown: (tab: RepoKind, index: number) => void;
  onScanSectionUrl: (url: string, tab: RepoKind) => void;
  onUpdateSectionMarkdown: (tab: RepoKind, index: number, markdown: string) => void;
  onUploadSectionAssets: (files: FileList | null, tab: RepoKind) => void;
  repo: RepoState;
  scanningUrl: string;
  tab: RepoKind;
}) {
  const sectionUrls = getRepoSectionUrls(repo, tab);
  const sectionNotes = getRepoSectionNotes(repo, tab);
  const sectionIntake = (
    <SectionIntake
      isCloudReady={Boolean(supabase)}
      onSaveMarkdown={(markdown) => onAddSectionMarkdown(tab, markdown)}
      onUpload={(files) => onUploadSectionAssets(files, tab)}
    />
  );
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
    if (tab === "Imagery") return haystack.includes("photo") || haystack.includes("image") || haystack.includes("imagery") || asset.type === "Image";
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

  if (tab === "Brand Guidelines") {
    return (
      <section className="repo-panel">
        <h2>Brand Guidelines</h2>
        <SectionSources lastSectionScan={lastSectionScan} onScanSectionUrl={onScanSectionUrl} scanningUrl={scanningUrl} tab={tab} urls={sectionUrls} />
        {sectionIntake}
        {notes}
        {repo.brand.description ? <p>{repo.brand.description}</p> : null}
        <Field label="Values" values={repo.brand.values} />
        <Field label="Rules" values={repo.brand.rules} />
        <Field label="Approved terminology" values={repo.brand.approvedTerms} />
        <Field label="Prohibited terminology" values={repo.brand.prohibitedTerms} />
      </section>
    );
  }

  if (tab === "Identity" || tab === "Imagery") {
    return (
      <section className="repo-panel">
        <h2>{tab}</h2>
        <SectionSources lastSectionScan={lastSectionScan} onScanSectionUrl={onScanSectionUrl} scanningUrl={scanningUrl} tab={tab} urls={sectionUrls} />
        {sectionIntake}
        {notes}
        {rulesForTab.length ? (
          <Field label="Usage guidance" values={rulesForTab} />
        ) : null}
        {visualAssets.length ? (
          <section className="object-list asset-list">
            {visualAssets.map((asset) => (
              <AssetCard asset={asset} compact key={asset.id} onDelete={onDeleteAsset} />
            ))}
          </section>
        ) : null}
      </section>
    );
  }

  if (tab === "Colors") {
    return (
      <section className="repo-panel">
        <h2>Colors</h2>
        <SectionSources lastSectionScan={lastSectionScan} onScanSectionUrl={onScanSectionUrl} scanningUrl={scanningUrl} tab={tab} urls={sectionUrls} />
        {sectionIntake}
        {notes}
        {rulesForTab.length ? <Field label="Color guidance" values={rulesForTab} /> : null}
      </section>
    );
  }

  if (tab === "Voice & Tone") {
    return (
      <section className="repo-panel">
        <h2>Voice & Tone</h2>
        <SectionSources lastSectionScan={lastSectionScan} onScanSectionUrl={onScanSectionUrl} scanningUrl={scanningUrl} tab={tab} urls={sectionUrls} />
        {sectionIntake}
        {notes}
        <Field label="Voice" values={repo.brand.voice} />
        <Field label="Approved terminology" values={repo.brand.approvedTerms} />
        <Field label="Prohibited terminology" values={repo.brand.prohibitedTerms} />
      </section>
    );
  }

  if (tab === "Typography") {
    return (
      <section className="repo-panel">
        <h2>Typography</h2>
        <SectionSources lastSectionScan={lastSectionScan} onScanSectionUrl={onScanSectionUrl} scanningUrl={scanningUrl} tab={tab} urls={sectionUrls} />
        {sectionIntake}
        {notes}
        {rulesForTab.length ? <Field label="Typography guidance" values={rulesForTab} /> : null}
      </section>
    );
  }

  if (tab === "Messaging") {
    return (
      <section className="repo-panel">
        <h2>Messaging</h2>
        <SectionSources lastSectionScan={lastSectionScan} onScanSectionUrl={onScanSectionUrl} scanningUrl={scanningUrl} tab={tab} urls={sectionUrls} />
        {sectionIntake}
        {notes}
        {repo.messaging.length ? (
          <ObjectList emptyDescription="" emptyTitle="" items={repo.messaging} title={(item) => item.positioning} render={(item) => item.valueProps.join(" ")} />
        ) : null}
      </section>
    );
  }

  if (tab === "Audiences") {
    return (
      <section className="repo-panel">
        <h2>Audiences</h2>
        <SectionSources lastSectionScan={lastSectionScan} onScanSectionUrl={onScanSectionUrl} scanningUrl={scanningUrl} tab={tab} urls={sectionUrls} />
        {sectionIntake}
        {notes}
        {repo.audiences.length ? (
          <ObjectList
            emptyDescription=""
            emptyTitle=""
            items={repo.audiences}
            title={(item) => item.name}
            render={(item) => [item.description, ...item.needs, ...item.painPoints, ...item.messaging, ...item.channels].filter(Boolean).join(" ")}
          />
        ) : null}
      </section>
    );
  }

  const channels = [...new Set(repo.audiences.flatMap((audience) => audience.channels).filter(Boolean))];
  const seoGuidance = [
    ...repo.messaging.flatMap((message) => [...message.valueProps, ...message.keyMessages, ...message.claims]),
    ...repo.audiences.flatMap((audience) => [...audience.needs, ...audience.messaging]),
  ].filter((value) => {
    const normalized = value.toLowerCase();
    return normalized.includes("seo") || normalized.includes("search") || normalized.includes("channel") || normalized.includes("content");
  });

  if (tab === "Channel SEO") {
    return (
      <section className="repo-panel">
        <h2>Channel SEO</h2>
        <SectionSources lastSectionScan={lastSectionScan} onScanSectionUrl={onScanSectionUrl} scanningUrl={scanningUrl} tab={tab} urls={sectionUrls} />
        {sectionIntake}
        {notes}
        {channels.length || seoGuidance.length ? (
          <>
            <Field label="Channels" values={channels} />
            <Field label="SEO guidance" values={seoGuidance} />
          </>
        ) : null}
      </section>
    );
  }

  return (
    <section className="repo-panel">
      <h2>Rules</h2>
      <SectionSources lastSectionScan={lastSectionScan} onScanSectionUrl={onScanSectionUrl} scanningUrl={scanningUrl} tab={tab} urls={sectionUrls} />
      {sectionIntake}
      {notes}
      {repo.brand.rules.length || repo.brand.approvedTerms.length || repo.brand.prohibitedTerms.length ? (
        <>
          <Field label="Usage rules" values={repo.brand.rules} />
          <Field label="Approved terminology" values={repo.brand.approvedTerms} />
          <Field label="Prohibited terminology" values={repo.brand.prohibitedTerms} />
        </>
      ) : null}
    </section>
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

function SectionIntake({
  isCloudReady,
  onSaveMarkdown,
  onUpload,
}: {
  isCloudReady: boolean;
  onSaveMarkdown: (markdown: string) => void;
  onUpload: (files: FileList | null) => void;
}) {
  const [markdown, setMarkdown] = useState("");

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    onUpload(event.dataTransfer.files);
  }

  function saveMarkdown() {
    onSaveMarkdown(markdown);
    setMarkdown("");
  }

  return (
    <div className="section-intake">
      <label className="section-asset-upload" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
        <span>Upload assets</span>
        <strong>Select files or drag them here</strong>
        <input
          accept=".md,.markdown,.svg,.png,.jpg,.jpeg,.webp,.pdf,.doc,.docx,.ppt,.pptx,text/markdown,text/plain,image/svg+xml,image/png,image/jpeg,image/webp,application/pdf"
          multiple
          onChange={(event) => onUpload(event.target.files)}
          type="file"
        />
      </label>
      <div className="markdown-intake">
        <label htmlFor="section-markdown">Paste Markdown</label>
        <textarea
          id="section-markdown"
          onChange={(event) => setMarkdown(event.target.value)}
          placeholder="Paste rules.md or section notes here"
          value={markdown}
        />
        <button disabled={!markdown.trim()} onClick={saveMarkdown} type="button">
          Save Markdown
        </button>
      </div>
      {!isCloudReady ? <em>Sign in and set up this repo before uploading files.</em> : null}
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

function AssetCard({ asset, compact = false, onDelete }: { asset: Asset; compact?: boolean; onDelete?: (assetId: string) => void }) {
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

function ObjectList<T extends { id: string; name?: string; sources: Source[] }>({
  emptyDescription,
  emptyTitle,
  items,
  render,
  title,
}: {
  emptyDescription: string;
  emptyTitle: string;
  items: T[];
  render: (item: T) => ReactNode;
  title?: (item: T) => string;
}) {
  if (!items.length) {
    return (
      <section className="object-list">
        <EmptyState description={emptyDescription} title={emptyTitle} />
      </section>
    );
  }

  return (
    <section className="object-list">
      {items.map((item) => (
        <article key={item.id}>
          <h2>{title ? title(item) : item.name}</h2>
          <div>{render(item)}</div>
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
