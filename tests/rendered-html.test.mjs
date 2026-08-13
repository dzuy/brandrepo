import assert from "node:assert/strict";
import { access, readdir } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the BrandRepo loading shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>BrandRepo<\/title>/i);
  assert.match(html, /brandrepo\.dev/);
  assert.match(html, /Checking session/);
  assert.match(html, /Loading your repo\./);
  assert.match(html, /class="auth-page"/);
  assert.match(html, /data-theme="dark"/);
  assert.match(html, /brandrepo-logo-white\.png/);
  assert.match(html, /brandrepo-logo-black\.png/);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton|codex-preview/i);
});

test("does not keep the disposable starter preview scaffold", async () => {
  const previewEntries = await readdir(new URL("app/_sites-preview", templateRoot)).catch(() => []);
  assert.deepEqual(previewEntries, []);
  await assert.rejects(access(new URL("public/_sites-preview", templateRoot)));
});
