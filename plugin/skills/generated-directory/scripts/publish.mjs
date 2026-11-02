#!/usr/bin/env node
import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

const API = process.env.GD_API ?? "https://upload.generated.directory";
const CREDENTIALS = path.join(homedir(), ".config", "generated.directory", "credentials.json");
const ALLOWED = new Set(["html", "htm", "css", "js", "mjs", "map", "json", "txt", "svg", "png", "jpg", "jpeg", "gif", "webp", "ico", "avif", "woff", "woff2", "ttf", "otf", "wasm", "webmanifest"]);

const args = process.argv.slice(2);
const dirFlag = args.includes("--dir") ? args[args.indexOf("--dir") + 1] : process.env.GD_DIR;
const slugFlag = args.includes("--slug") ? args[args.indexOf("--slug") + 1] : process.env.GD_SLUG;
const listOnly = args.includes("--list");
const deleteOnly = args.includes("--delete");

try {
  if (listOnly) {
    const auth = await ensureAuth();
    const apps = await api("/v1/apps", { headers: authHeader(auth.accessKey) });
    console.log(JSON.stringify(apps, null, 2));
    process.exit(0);
  }
  if (deleteOnly) {
    const auth = await ensureAuth();
    const slug = slugFlag?.trim().toLowerCase();
    if (!slug) throw new Error("Set GD_SLUG or pass --slug.");
    await api(`/v1/apps/${encodeURIComponent(slug)}`, { method: "DELETE", headers: authHeader(auth.accessKey) });
    console.log(`Deleted https://generated.directory/${auth.username}/${slug}/`);
    process.exit(0);
  }
  const directory = await findBuild(dirFlag);
  const slug = slugFlag?.trim().toLowerCase();
  if (!slug) throw new Error("Set GD_SLUG or pass --slug.");
  const files = await collect(directory);
  if (!files.some((file) => file.path === "index.html")) throw new Error("The build must include index.html.");
  const title = process.env.GD_TITLE || (await readTitle(path.join(directory, "index.html"))) || slug;
  const auth = await ensureAuth();
  const started = await api(`/v1/apps/${encodeURIComponent(slug)}/deploys`, {
    method: "POST",
    headers: { ...authHeader(auth.accessKey), "content-type": "application/json" },
    body: JSON.stringify({ title, files: files.map(({ path: filePath, hash, size }) => ({ path: filePath, hash, size })) }),
  });
  const byHash = new Map(files.map((file) => [file.hash, file]));
  const missing = started.missing ?? [];
  const known = missing.filter((hash) => byHash.has(hash));
  const unknown = missing.filter((hash) => !byHash.has(hash));
  for (let i = 0; i < known.length; i += 4) {
    await Promise.all(known.slice(i, i + 4).map(async (hash) => {
      const file = byHash.get(hash);
      const body = await readFile(file.absolute);
      await api(`/v1/apps/${encodeURIComponent(slug)}/deploys/${started.deployId}?hash=${hash}`, {
        method: "PUT",
        headers: { ...authHeader(auth.accessKey), "content-type": "application/octet-stream" },
        body,
      });
    }));
  }
  if (unknown.length > 0) {
    throw new Error(`The API asked for a hash that is not in the build: ${unknown.join(", ")}.`);
  }
  const committed = await api(`/v1/apps/${encodeURIComponent(slug)}/deploys/${started.deployId}/commit`, {
    method: "POST",
    headers: { ...authHeader(auth.accessKey), "content-type": "application/json" },
    body: JSON.stringify({ title }),
  });
  console.log(committed.url);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

async function ensureAuth() {
  try {
    const saved = JSON.parse(await readFile(CREDENTIALS, "utf8"));
    if (saved.username && saved.accessKey) return saved;
  } catch {
    // No saved access key yet.
  }
  const action = process.env.GD_ACTION;
  if (action === "create") {
    const username = process.env.GD_USERNAME?.trim().toLowerCase();
    const email = process.env.GD_EMAIL?.trim().toLowerCase();
    const body = {};
    if (username) body.username = username;
    if (email) body.email = email;
    const result = await api("/v1/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    await saveCredentials(result);
    console.log(`Account id: ${result.username}`);
    console.log(`Access key: ${result.accessKey}`);
    console.log("Keep this key. It is stored in ~/.config/generated.directory/credentials.json. Sign in with it at https://generated.directory/login");
    return result;
  }
  if (action === "login") {
    const accessKey = process.env.GD_ACCESS_KEY?.trim();
    if (!accessKey) throw new Error("No saved account. Set GD_ACTION=login and GD_ACCESS_KEY.");
    const result = await api("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accessKey }),
    });
    const saved = { username: result.username, email: result.email, accessKey };
    await saveCredentials(saved);
    return saved;
  }
  throw new Error("No saved account. Set GD_ACTION=create, or GD_ACTION=login with GD_ACCESS_KEY.");
}

async function saveCredentials(record) {
  await mkdir(path.dirname(CREDENTIALS), { recursive: true });
  await writeFile(CREDENTIALS, `${JSON.stringify({ username: record.username, email: record.email, accessKey: record.accessKey }, null, 2)}\n`);
  await chmod(CREDENTIALS, 0o600);
}

async function findBuild(explicit) {
  if (explicit) return path.resolve(explicit);
  for (const candidate of ["dist", "build", "out", "."]) {
    const full = path.resolve(candidate);
    try {
      await stat(path.join(full, "index.html"));
      return full;
    } catch {
      // Try the next conventional directory.
    }
  }
  throw new Error("No index.html in dist, build, out, or the current directory. Pass --dir.");
}

async function collect(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolute = path.join(directory, entry.name);
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      files.push(...await collect(absolute, relative));
      continue;
    }
    if (!entry.isFile()) continue;
    const extension = fileExtension(relative);
    if (!ALLOWED.has(extension.toLowerCase())) throw new Error(`File type is not allowed: ${relative}`);
    const body = await readFile(absolute);
    files.push({ path: relative.split(path.sep).join("/"), absolute, hash: assetHash(body, relative), size: body.byteLength });
  }
  return files;
}

function assetHash(body, filePath) {
  const extension = fileExtension(filePath);
  return createHash("sha256").update(body.toString("base64") + extension).digest("hex").slice(0, 32);
}

function fileExtension(filePath) {
  const base = filePath.split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "";
  return base.slice(dot + 1);
}

async function readTitle(file) {
  const html = await readFile(file, "utf8");
  const match = /<title>([^<]*)<\/title>/i.exec(html);
  return match?.[1]?.trim() ?? "";
}

function authHeader(token) {
  return { authorization: `Bearer ${token}` };
}

async function api(pathname, init = {}) {
  const response = await fetch(`${API}${pathname}`, init);
  const text = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { error: text };
  }
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
  return payload;
}
