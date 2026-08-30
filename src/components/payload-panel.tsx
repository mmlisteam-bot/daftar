import { Check, Copy, Plus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PAYLOAD_GROUPS, type PayloadItem } from "@/lib/notes/payloads";
import { useNotes } from "@/lib/notes/store";
import { cn } from "@/lib/utils";

export function PayloadPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const currentId = useNotes((s) => s.currentId);
  const pages = useNotes((s) => s.pages);
  const appendBody = useNotes((s) => s.appendBody);
  const [copied, setCopied] = useState<string | null>(null);
  const [openGroup, setOpenGroup] = useState<string>(PAYLOAD_GROUPS[0]?.id ?? "sqli");
  const page = pages[currentId];

  if (!open) return null;

  async function copyItem(item: PayloadItem) {
    await navigator.clipboard.writeText(item.code);
    setCopied(item.id);
    setTimeout(() => setCopied(null), 1200);
  }

  function insertItem(item: PayloadItem) {
    if (!page) return;
    appendBody(page.id, `\`\`\`${item.lang}\n${item.code}\n\`\`\``);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-end md:items-stretch">
      <button type="button" className="absolute inset-0 bg-bg/50" aria-label="بستن" onClick={onClose} />
      <aside className="relative flex h-[78dvh] w-full max-w-none flex-col rounded-t-2xl border border-border bg-surface shadow-2xl md:h-full md:max-w-[360px] md:rounded-none md:border-s md:border-t-0">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border md:hidden" />
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <div>
            <div className="text-[14px] font-semibold">کتابخانه Payload</div>
            <div className="text-[11px] text-muted">کپی یا درج در صفحه</div>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="بستن">
            <X className="size-4" />
          </Button>
        </div>
        <div className="flex gap-1 overflow-x-auto border-b border-border px-2 py-1.5 md:hidden">
          {PAYLOAD_GROUPS.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => setOpenGroup(group.id)}
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-[12px]",
                openGroup === group.id ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted",
              )}
            >
              {group.title}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {PAYLOAD_GROUPS.map((group) => {
            const collapsed = openGroup !== group.id;
            return (
              <div key={group.id} className={cn("mb-4", collapsed && "hidden md:block")}>
                <button
                  type="button"
                  className="mb-1.5 hidden w-full px-0.5 text-start text-[11px] font-medium text-subtle md:block"
                  onClick={() => setOpenGroup(group.id)}
                >
                  {group.title}
                </button>
                <div className="space-y-1.5">
                  {group.items.map((item) => (
                    <div key={item.id} className="rounded-md border border-border bg-bg p-2">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-[12px] font-medium">{item.title}</span>
                        <div className="flex gap-0.5">
                          <button
                            type="button"
                            className="flex size-8 items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-fg md:size-7"
                            title="کپی"
                            onClick={() => void copyItem(item)}
                          >
                            {copied === item.id ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />}
                          </button>
                          <button
                            type="button"
                            className="flex size-8 items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-fg md:size-7"
                            title="درج در صفحه"
                            onClick={() => insertItem(item)}
                          >
                            <Plus className="size-3.5" />
                          </button>
                        </div>
                      </div>
                      <pre dir="ltr" className="overflow-x-auto font-mono text-[11px] leading-5 text-muted">
                        {item.code}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
