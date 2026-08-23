import {
  BookOpen,
  Bug,
  Code2,
  Database,
  FileText,
  Globe,
  Lock,
  Network,
  Shield,
  Terminal,
  type LucideIcon,
} from "lucide-react";
import type { PageIcon } from "@/lib/notes/types";
import { cn } from "@/lib/utils";

export const PAGE_ICONS: Record<PageIcon, LucideIcon> = {
  book: BookOpen,
  globe: Globe,
  bug: Bug,
  database: Database,
  lock: Lock,
  code: Code2,
  shield: Shield,
  file: FileText,
  terminal: Terminal,
  network: Network,
};

export const PAGE_ICON_KEYS = Object.keys(PAGE_ICONS) as PageIcon[];

export function PageGlyph({
  name,
  className,
}: {
  name: PageIcon;
  className?: string;
}) {
  const Icon = PAGE_ICONS[name] ?? FileText;
  return <Icon className={cn("size-4 shrink-0", className)} strokeWidth={1.75} />;
}
