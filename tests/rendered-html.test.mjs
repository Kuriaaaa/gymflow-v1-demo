import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function indexHtml() {
  return readFile(new URL("../dist-pages/index.html", import.meta.url), "utf8");
}

async function publishedPage() {
  const html = await indexHtml();
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
  assert.doesNotMatch(html, /onrender\.com/);
  assert.match(html, /No account setup required/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("uses product branding and an honest status line", async () => {
  const html = await publishedPage();
  assert.match(html, /GYM MANAGEMENT FOR EAST AFRICA/);
  assert.doesNotMatch(html, /KURIA'S GYM PROJECT|KURIA&apos;S GYM PROJECT/);
  assert.doesNotMatch(html, /All demo services operational/);
  assert.match(html, /mailto:johnkuria6996@gmail\.com\?subject=GymFlow%20demo%20request/);
});

test("ships a Content-Security-Policy and no inline scripts", async () => {
  const html = await indexHtml();
  assert.match(html, /<meta http-equiv="Content-Security-Policy" content="[^"]*script-src 'self'/);
  assert.doesNotMatch(html, /'unsafe-inline'|'unsafe-eval'/);
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
  assert.ok(scripts.length > 0);
  for (const [, attrs, body] of scripts) {
    assert.match(attrs, /\bsrc=/, "every script must be external");
    assert.equal(body.trim(), "", "scripts must not have inline bodies");
  }
  assert.doesNotMatch(html, /<style\b/, "no inline style blocks");
  assert.doesNotMatch(html, /\sstyle="/, "no inline style attributes");
});

test("uses an absolute Open Graph image", async () => {
  const html = await indexHtml();
  assert.match(html, /<meta property="og:image" content="https:\/\/kuriaaaa\.github\.io\/gymflow-v1-demo\/og\.jpg"/);
});
