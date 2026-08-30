export type BlockType =
  | "p"
  | "h1"
  | "h2"
  | "h3"
  | "ul"
  | "ol"
  | "todo"
  | "code"
  | "quote"
  | "callout"
  | "image"
  | "divider"
  | "toggle"
  | "table";

export type CalloutKind =
  | "info"
  | "warning"
  | "tip"
  | "abstract"
  | "note"
  | "danger"
  | "example";

export type Block = {
  id: string;
  type: BlockType;
  content: string;
  checked?: boolean;
  lang?: string;
  imageId?: string;
  callout?: CalloutKind;
  open?: boolean;
  inner?: string;
  headers?: string[];
  rows?: string[][];
  indent?: number;
};

export type PageIcon =
  | "book"
  | "globe"
  | "bug"
  | "database"
  | "lock"
  | "code"
  | "shield"
  | "file"
  | "terminal"
  | "network";

export type Page = {
  id: string;
  title: string;
  parentId: string | null;
  icon: PageIcon;
  tags: string[];
  blocks: Block[];
  /** Markdown source. When set, this is what you edit; blocks are derived. */
  body?: string;
  createdAt: number;
  updatedAt: number;
  sort?: number;
  starred?: boolean;
  deletedAt?: number;
};

export type NotesSnapshot = {
  pages: Record<string, Page>;
  order: string[];
  currentId: string;
  theme: "dark" | "light";
  expanded: Record<string, boolean>;
  trash?: Record<string, Page>;
  recentIds?: string[];
};

export function nid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function emptyBlock(type: BlockType = "p"): Block {
  const block: Block = { id: nid(), type, content: "" };
  if (type === "todo") block.checked = false;
  if (type === "code") block.lang = "text";
  if (type === "callout") block.callout = "info";
  if (type === "toggle") {
    block.open = true;
    block.inner = "";
  }
  if (type === "table") {
    block.headers = ["ستون ۱", "ستون ۲", "ستون ۳"];
    block.rows = [
      ["", "", ""],
      ["", "", ""],
    ];
  }
  return block;
}

export function emptyPage(partial?: Partial<Page>): Page {
  const now = Date.now();
  return {
    id: nid(),
    title: "بدون عنوان",
    parentId: null,
    icon: "file",
    tags: [],
    blocks: [emptyBlock("p")],
    body: "",
    createdAt: now,
    updatedAt: now,
    sort: now,
    ...partial,
  };
}
