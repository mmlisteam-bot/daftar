export type SessionUser = {
  id: string;
  username: string;
  name: string;
};

const SESSION_KEY = "daftar-session";
const NOTES_PREFIX = "daftar-notes-v2";

const USERS: { id: string; username: string; name: string; hash: string }[] = [
  {
    id: "daftar",
    username: "daftar",
    name: "دفتر من",
    hash: "5a444b15487f3094c0fd0d24d2e8a91105535a432441d8a9de395552972261f4",
  },
  {
    id: "rafiq",
    username: "rafiq",
    name: "رفیق",
    hash: "027e834f1c8917db44464111234192722bf123291938055e9ceb8441830f8d53",
  },
];

let activeUserId = "guest";

export function getActiveUserId(): string {
  return activeUserId;
}

export function setActiveUserId(id: string): void {
  activeUserId = id;
}

export function notesStorageKey(userId = activeUserId): string {
  return `${NOTES_PREFIX}:${userId}`;
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function migrateLegacyNotes(userId: string) {
  if (typeof localStorage === "undefined") return;
  if (userId !== "daftar") return;
  const namespaced = localStorage.getItem(notesStorageKey("daftar"));
  const legacy = localStorage.getItem(NOTES_PREFIX);
  if (!namespaced && legacy) {
    localStorage.setItem(notesStorageKey("daftar"), legacy);
  }
}

export function getSession(): SessionUser | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionUser;
    const known = USERS.find((u) => u.id === parsed.id);
    if (!known) return null;
    return { id: known.id, username: known.username, name: known.name };
  } catch {
    return null;
  }
}

export async function login(username: string, password: string): Promise<SessionUser | null> {
  const uname = username.trim().toLowerCase();
  const digest = await sha256Hex(`${uname}:${password}`);
  const user = USERS.find((u) => u.username === uname && u.hash === digest);
  if (!user) return null;
  migrateLegacyNotes(user.id);
  setActiveUserId(user.id);
  const session: SessionUser = { id: user.id, username: user.username, name: user.name };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function logout(): void {
  localStorage.removeItem(SESSION_KEY);
  setActiveUserId("guest");
}
