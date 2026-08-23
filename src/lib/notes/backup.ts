import { exportImagesMap, importImagesMap } from "./images";
import { pageToMarkdown } from "./markdown";
import { getActiveUserId } from "./session";
import type { NotesSnapshot, Page } from "./types";

export type DaftarBackup = {
  kind: "daftar-backup";
  version: 2;
  savedAt: number;
  user: string;
  snapshot: NotesSnapshot;
  images: Record<string, string>;
};

export function isBackup(data: unknown): data is DaftarBackup {
  if (!data || typeof data !== "object") return false;
  const v = data as DaftarBackup;
  return v.kind === "daftar-backup" && !!v.snapshot?.pages;
}

export function isSnapshot(data: unknown): data is NotesSnapshot {
  if (!data || typeof data !== "object") return false;
  const v = data as NotesSnapshot;
  return !!v.pages && Array.isArray(v.order);
}

export function backupFileName(user: string, ext = "json"): string {
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `daftar-${user}-${stamp}.${ext}`;
}

export async function buildBackup(snapshot: NotesSnapshot, user = getActiveUserId()): Promise<DaftarBackup> {
  return {
    kind: "daftar-backup",
    version: 2,
    savedAt: Date.now(),
    user,
    snapshot,
    images: await exportImagesMap(),
  };
}

export async function applyBackupImages(data: DaftarBackup): Promise<void> {
  await importImagesMap(data.images);
}

export function parseBackupFile(raw: string): { snapshot: NotesSnapshot; images?: Record<string, string> } | null {
  try {
    const data = JSON.parse(raw) as unknown;
    if (isBackup(data)) return { snapshot: data.snapshot, images: data.images };
    if (isSnapshot(data)) return { snapshot: data };
    return null;
  } catch {
    return null;
  }
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadJsonBackup(snapshot: NotesSnapshot, user: string) {
  const backup = await buildBackup(snapshot, user);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json;charset=utf-8" });
  downloadBlob(backupFileName(user, "json"), blob);
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(`daftar-last-backup:${user}`, String(Date.now()));
  }
}

function safeName(title: string) {
  const t = title.trim() || "بدون-عنوان";
  return t.replace(/[\\/:*?"<>|]/g, "_").slice(0, 80);
}

function pagePath(pages: Record<string, Page>, page: Page): string {
  const parts: string[] = [];
  let cur: Page | undefined = page;
  const guard = new Set<string>();
  while (cur && !guard.has(cur.id)) {
    guard.add(cur.id);
    parts.unshift(safeName(cur.title));
    cur = cur.parentId ? pages[cur.parentId] : undefined;
  }
  return `${parts.join("/")}.md`;
}

export async function downloadAllZip(snapshot: NotesSnapshot, user: string) {
  const backup = await buildBackup(snapshot, user);
  const files: { name: string; data: Uint8Array }[] = [];
  const enc = new TextEncoder();
  files.push({
    name: "daftar-backup.json",
    data: enc.encode(JSON.stringify(backup, null, 2)),
  });
  const used = new Set<string>(["daftar-backup.json"]);
  for (const page of Object.values(snapshot.pages)) {
    let name = `notes/${pagePath(snapshot.pages, page)}`;
    if (used.has(name)) name = name.replace(/\.md$/, `-${page.id.slice(0, 6)}.md`);
    used.add(name);
    files.push({ name, data: enc.encode(pageToMarkdown(page)) });
  }
  downloadBlob(backupFileName(user, "zip"), zipStore(files));
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function concat(parts: Uint8Array[]) {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function u16(n: number) {
  const b = new Uint8Array(2);
  b[0] = n & 255;
  b[1] = (n >> 8) & 255;
  return b;
}

function u32(n: number) {
  const b = new Uint8Array(4);
  b[0] = n & 255;
  b[1] = (n >> 8) & 255;
  b[2] = (n >> 16) & 255;
  b[3] = (n >> 24) & 255;
  return b;
}

function zipStore(files: { name: string; data: Uint8Array }[]): Blob {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  const now = new Date();
  const dosTime =
    (now.getHours() << 11) | (now.getMinutes() << 5) | (Math.floor(now.getSeconds() / 2) & 31);
  const dosDate =
    ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  for (const file of files) {
    const name = enc.encode(file.name);
    const crc = crc32(file.data);
    const local = concat([
      u32(0x04034b50),
      u16(20),
      u16(1 << 11),
      u16(0),
      u16(dosTime),
      u16(dosDate),
      u32(crc),
      u32(file.data.length),
      u32(file.data.length),
      u16(name.length),
      u16(0),
      name,
      file.data,
    ]);
    const central = concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(1 << 11),
      u16(0),
      u16(dosTime),
      u16(dosDate),
      u32(crc),
      u32(file.data.length),
      u32(file.data.length),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      name,
    ]);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }

  const centralDir = concat(centrals);
  const end = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralDir.length),
    u32(offset),
    u16(0),
  ]);
  return new Blob([concat([...locals, centralDir, end])], { type: "application/zip" });
}
