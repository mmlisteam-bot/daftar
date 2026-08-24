export type SessionUser = {
  id: string;
  username: string;
  name: string;
};

const SESSION_KEY = "daftar-session";
const REMEMBER_KEY = "daftar-remember";
const NOTES_PREFIX = "daftar-notes-v2";
const HADIS_HELLO = "daftar-hadis-hello";

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
    if (!localStorage.getItem("daftar-hadis-blank-v1")) {
      localStorage.removeItem(notesStorageKey("hadis"));
      localStorage.removeItem(notesStorageKey("rafiq"));
      localStorage.setItem("daftar-hadis-blank-v1", "1");
    }
  }
}

function readSessionRaw(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY);
}

export function getSession(): SessionUser | null {
  try {
    const raw = readSessionRaw();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionUser;
    const known = USERS.find((u) => u.id === parsed.id);
    if (!known) return null;
    return { id: known.id, username: known.username, name: known.name };
  } catch {
    return null;
  }
}

export function getRememberedUsername(): string {
  if (typeof localStorage === "undefined") return "";
  try {
    const raw = localStorage.getItem(REMEMBER_KEY);
    if (!raw) return "";
    const parsed = JSON.parse(raw) as { username?: string };
    return parsed.username ?? "";
  } catch {
    return "";
  }
}

export function getRememberPref(): boolean {
  if (typeof localStorage === "undefined") return true;
  return localStorage.getItem(REMEMBER_KEY) !== "off";
}

export async function login(
  username: string,
  password: string,
  remember = true,
): Promise<SessionUser | null> {
  const uname = username.trim().toLowerCase();
  const digest = await sha256Hex(`${uname}:${password}`);
  const user = USERS.find((u) => u.username === uname && u.hash === digest);
  if (!user) return null;
  migrateLegacyNotes(user.id);
  setActiveUserId(user.id);
  if (user.id === "hadis") sessionStorage.removeItem(HADIS_HELLO);
  const session: SessionUser = { id: user.id, username: user.username, name: user.name };
  const payload = JSON.stringify(session);
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  if (remember) {
    localStorage.setItem(SESSION_KEY, payload);
    localStorage.setItem(REMEMBER_KEY, JSON.stringify({ username: user.username }));
  } else {
    sessionStorage.setItem(SESSION_KEY, payload);
    localStorage.setItem(REMEMBER_KEY, "off");
  }
  return session;
}

export function logout(): void {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(HADIS_HELLO);
  setActiveUserId("guest");
}

export function shouldShowHadisHello(userId: string): boolean {
  if (userId !== "hadis") return false;
  if (typeof sessionStorage === "undefined") return true;
  return !sessionStorage.getItem(HADIS_HELLO);
}

export function markHadisHelloSeen(): void {
  sessionStorage.setItem(HADIS_HELLO, "1");
}
