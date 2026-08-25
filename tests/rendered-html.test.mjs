import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function publishedPage() {
  const html = await readFile(new URL("../dist-pages/index.html", import.meta.url), "utf8");
  const scriptMatch = html.match(/<script[^>]+src="([^"]+\.js)"/);
  assert.ok(scriptMatch, "the GitHub Pages build must include its application script");
  const scriptPath = scriptMatch[1].replace(/^\/?gymflow-v1-demo\//, "").replace(/^\//, "");
  const script = await readFile(new URL(`../dist-pages/${scriptPath}`, import.meta.url), "utf8");
  return `${html}\n${script}`;
}

test("renders the GymFlow public demo", async () => {
  const html = await publishedPage();
  assert.match(html, /GymFlow V1/);
  assert.match(html, /every role/i);
  assert.match(html, /PUBLIC DEMO/);
  assert.match(html, /owner/);
  assert.match(html, /receptionist/);
  assert.match(html, /trainer/);
  assert.match(html, /member/);
  assert.doesNotMatch(html, /gymflow-v1-app\.onrender\.com/);
  assert.match(html, /No account setup required/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});
