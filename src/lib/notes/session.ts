export type SessionUser = {
  id: string;
  username: string;
  name: string;
};

const SESSION_KEY = "daftar-session";
const NOTES_PREFIX = "daftar-notes-v2";

const USERS: { id: string; username: string; name: string; hash: string }[] = [
  {
    id: "mmli",
    username: "mmli",
    name: "mmli",
    hash: "23b767b8165c38065d609eaed068cab4e26c670361497ce4816bd720e29f7a08",
  },
  {
    id: "hadis",
    username: "hadis",
    name: "hadis",
    hash: "5ce9bb0a0f996217508a7b9b42be32aa999f1287a3e239ceb9531e66f4926b82",
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

function copyIfMissing(fromKey: string, toKey: string) {
  const dest = localStorage.getItem(toKey);
  const src = localStorage.getItem(fromKey);
  if (!dest && src) localStorage.setItem(toKey, src);
}

function migrateLegacyNotes(userId: string) {
  if (typeof localStorage === "undefined") return;
  if (userId === "mmli") {
    copyIfMissing(NOTES_PREFIX, notesStorageKey("mmli"));
    copyIfMissing(notesStorageKey("daftar"), notesStorageKey("mmli"));
  }
  if (userId === "hadis") {
    copyIfMissing(notesStorageKey("rafiq"), notesStorageKey("hadis"));
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
