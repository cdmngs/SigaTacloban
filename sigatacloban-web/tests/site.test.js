import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const htmlFiles = (await readdir(new URL("../", import.meta.url)))
  .filter((file) => file.endsWith(".html"))
  .sort();
const requiredCssOrder = [
  "tokens.css", "base.css", "layout.css", "components.css", "overlays.css", "pages.css", "accessibility.css",
];

test("every HTML page has unique metadata, safe-area viewport, CSP, favicon and ordered stylesheets", async () => {
  const titles = [];
  for (const file of htmlFiles) {
    const html = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
    const title = html.match(/<title>([^<]+)<\/title>/i)?.[1];
    assert.ok(title, `${file} has a title`);
    titles.push(title);
    assert.match(html, /<html\s+lang="en-PH"/i, `${file} declares its document language`);
    assert.match(html, /name="viewport" content="width=device-width,\s*initial-scale=1,\s*viewport-fit=cover"/i, `${file} supports safe areas`);
    assert.match(html, /http-equiv="Content-Security-Policy"/i, `${file} declares a CSP`);
    assert.match(html, /rel="icon"[^>]+favicon-32\.png/i, `${file} has a favicon`);
    assert.match(html, /rel="manifest"[^>]+manifest\.webmanifest/i, `${file} links the app manifest`);
    const css = [...html.matchAll(/href="assets\/css\/([^"]+\.css)"/g)].map((match) => match[1]);
    assert.deepEqual(css.slice(0, requiredCssOrder.length), requiredCssOrder, `${file} loads base styles in order`);
  }
  assert.equal(new Set(titles).size, titles.length, "all static document titles are unique");
});

test("the development component bench is absent from the shipped static site", async () => {
  assert.equal(htmlFiles.includes("dev-components.html"), false);
  const scripts = await readdir(new URL("../assets/js/pages/", import.meta.url));
  const styles = await readdir(new URL("../assets/css/", import.meta.url));
  assert.equal(scripts.includes("dev-components.js"), false);
  assert.equal(styles.includes("dev-components.css"), false);
});
