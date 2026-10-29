import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const baseUrl = process.env.UI_AUDIT_URL || "http://127.0.0.1:8765";
const outputDirectory = join(process.cwd(), "_reports", "screenshots");
const roleUsers = [
  ["admin", "Cale", "admin@bfp.gov.ph", "mock-admin-token"],
  ["prevention", "Josh Lewis", "prevention@bfp.gov.ph", "mock-prevention-token"],
  ["operations", "John Earth", "operations@bfp.gov.ph", "mock-operations-token"],
  ["analyst", "Benedict Josef", "analyst@bfp.gov.ph", "mock-analyst-token"],
];
const pages = [
  "dashboard", "risk-map", "weather", "trends", "what-if", "incidents", "coverage",
  "alerts", "reports", "users", "ml-evaluation", "style-guide", "403", "404",
];
const widths = [[1440, 1000], [768, 900], [375, 812]];
const results = [];

await mkdir(outputDirectory, { recursive: true });

class DevTools {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 0;
    this.pending = new Map();
    socket.addEventListener("message", ({ data }) => {
      const message = JSON.parse(data);
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result || {});
    });
  }

  send(method, params = {}) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    }
    return result.result?.value;
  }
}

async function waitForEndpoint(url) {
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch { }
    await delay(250);
  }
  throw new Error(`DevTools endpoint did not become available: ${url}`);
}

async function openPageSocket(targetUrl) {
  const targets = await (await fetch(targetUrl)).json();
  const target = targets.find((item) => item.type === "page" && item.url.startsWith(baseUrl));
  if (!target?.webSocketDebuggerUrl) throw new Error("Could not find the app page in Edge DevTools.");
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  const devtools = new DevTools(socket);
  await devtools.send("Page.enable");
  await devtools.send("Network.enable");
  await devtools.send("Network.setCacheDisabled", { cacheDisabled: true });
  await devtools.send("Runtime.enable");
  return devtools;
}

async function navigate(devtools, url) {
  await devtools.send("Page.navigate", { url });
  for (let attempt = 0; attempt < 80; attempt++) {
    const ready = await devtools.evaluate(
      `(() => {
        const main = document.querySelector("#page-content");
        const staticPage = /\\/(login|403|404)\\.html$/.test(location.pathname);
        return document.readyState === "complete" &&
          (staticPage
            ? document.body?.innerText.trim().length > 20
            : main?.innerText.trim().length > 0 && !main.querySelector(".skeleton"));
      })()`,
    ).catch(() => false);
    if (ready) break;
    await delay(150);
  }
  await delay(900);
}

async function setViewport(devtools, width, height) {
  await devtools.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width <= 767,
    screenWidth: width,
    screenHeight: height,
  });
}

async function capture(devtools, name) {
  const result = await devtools.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: true,
  });
  await writeFile(join(outputDirectory, `${name}.png`), Buffer.from(result.data, "base64"));
}

async function loginAs(devtools, role) {
  const [, , email] = role;
  await navigate(devtools, `${baseUrl}/login.html`);
  await devtools.evaluate(`(() => {
    const form = document.querySelector(".login-form");
    if (!form) return false;
    form.elements.email.value = ${JSON.stringify(email)};
    form.elements.password.value = "visual-review";
    form.querySelector(".login-submit").click();
    return true;
  })()`);
  for (let attempt = 0; attempt < 80; attempt++) {
    const url = await devtools.evaluate("location.pathname").catch(() => "");
    if (url.endsWith("/dashboard.html")) break;
    await delay(150);
  }
  await delay(500);
}

async function auditCurrentPage(devtools, page, width) {
  const result = await devtools.evaluate(`(() => {
    const root = document.documentElement;
    const excluded = /^(sr-only|visually-hidden)$/;
    const overflowing = [...document.querySelectorAll("body *")].filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const hidden = [...element.classList].some((name) => excluded.test(name));
      return !hidden && rect.width > 0 &&
        (rect.left < -1 || rect.right > root.clientWidth + 1) &&
        style.position !== "fixed" && style.position !== "absolute";
    }).slice(0, 12).map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        selector: element.tagName.toLowerCase() +
          (element.id ? "#" + element.id : "") +
          (typeof element.className === "string" && element.className ?
            "." + element.className.trim().replace(/\\\\s+/g, ".") : ""),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
      };
    });
    return {
      title: document.title,
      viewportWidth: innerWidth,
      documentWidth: root.clientWidth,
      documentScrollWidth: root.scrollWidth,
      horizontalOverflow: root.scrollWidth > root.clientWidth + 1,
      contentLength: document.querySelector("#page-content")?.innerText.trim().length || 0,
      overflowing,
    };
  })()`);
  return { page, width, ...result };
}

const version = await waitForEndpoint("http://127.0.0.1:9331/json/version");
  const devtools = await openPageSocket("http://127.0.0.1:9331/json/list");
  await navigate(devtools, `${baseUrl}/login.html`);

  for (const [width, height] of widths) {
    await setViewport(devtools, width, height);
    await capture(devtools, `login-${width}`);
  }

  for (const role of roleUsers) {
    await setViewport(devtools, 1440, 1000);
    await loginAs(devtools, role);
    const [roleName] = role;
    for (const [width, height] of widths) {
      await setViewport(devtools, width, height);
      await navigate(devtools, `${baseUrl}/dashboard.html`);
      await capture(devtools, `dashboard-role-${roleName}-${width}`);
    }
    if (roleName === "admin") {
      for (const [width, height] of widths) {
        await setViewport(devtools, width, height);
        for (const page of pages) {
          await navigate(devtools, `${baseUrl}/${page}.html`);
          results.push(await auditCurrentPage(devtools, page, width));
          await capture(devtools, `${page}-${width}`);
        }

        const overlays = [
          ["alerts", ".alert-rules", "alerts-rules"],
          ["incidents", ".add-incident", "incident-add"],
          ["coverage", ".plan-station-button", "coverage-plan"],
          ["users", "button.add-user, button.invite-user, button[data-action='add-user']", "users-add"],
        ];
        for (const [page, selector, name] of overlays) {
          await navigate(devtools, `${baseUrl}/${page}.html`);
          const opened = await devtools.evaluate(`(() => {
            const button = document.querySelector(${JSON.stringify(selector)});
            if (!button || button.disabled) return false;
            button.click();
            return true;
          })()`).catch(() => false);
          if (opened) {
            await delay(500);
            await capture(devtools, `${name}-${width}`);
          }
        }

        await navigate(devtools, `${baseUrl}/alerts.html`);
        await devtools.evaluate("document.querySelector('.notification-button')?.click()");
        await delay(400);
        await capture(devtools, `notifications-${width}`);
      }
    }
    if (roleName === "analyst") {
      for (const [width, height] of widths) {
        await setViewport(devtools, width, height);
        await navigate(devtools, `${baseUrl}/ml-evaluation.html`);
        const opened = await devtools.evaluate(`(() => {
          const button = document.querySelector(".upload-dataset");
          if (!button || button.disabled) return false;
          button.click();
          return true;
        })()`).catch(() => false);
        if (opened) {
          await delay(500);
          await capture(devtools, `ml-upload-${width}`);
        }
      }
    }
  }

  await writeFile(
    join(outputDirectory, "layout-scan.json"),
    JSON.stringify({ edge: version.Browser, results }, null, 2),
  );
  console.log(`Captured screenshots in ${outputDirectory}`);
  console.log(`Scanned ${results.length} page/width combinations.`);
console.log(JSON.stringify(results.filter((item) => item.horizontalOverflow), null, 2));
  devtools.socket.close();
