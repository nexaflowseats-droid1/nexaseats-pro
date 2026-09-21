import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Trash2, Upload } from "lucide-react";
import { AppShell, Panel, EmptyState, StatCard } from "@/components/app/AppShell";
import { EventPicker, useActiveEvent } from "@/components/app/EventPicker";
import { supabase } from "@/integrations/supabase/client";
import { useOrg, canManageEvents } from "@/lib/org-context";
import { useDocuments, formatDate } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/documents")({
  head: () => ({
    meta: [
      { title: "Documents & PDFs — Nexa Flow Seats" },
      { name: "description", content: "Upload, organize and download secure event documents." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DocumentsPage,
});

const CATEGORIES = ["contract", "floor-plan", "menu", "run-sheet", "invoice", "other"];

function DocumentsPage() {
  const { currentOrgId, role } = useOrg();
  const editable = canManageEvents(role);
  const { events, eventId, setEventId } = useActiveEvent();
  const { data: documents, isLoading } = useDocuments(currentOrgId);
  const queryClient = useQueryClient();
  const [category, setCategory] = useState("other");
  const [busy, setBusy] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["documents", currentOrgId] });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > 50 * 1024 * 1024) throw new Error("File must be under 50MB");
      const { data: userData } = await supabase.auth.getUser();
      const path = `${currentOrgId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("event-documents").upload(path, file);
      if (upErr) throw upErr;
      const { error } = await supabase.from("documents").insert({
        organization_id: currentOrgId!,
        event_id: eventId,
        name: file.name.slice(0, 160),
        category,
        file_url: path,
        file_size: file.size,
        file_type: file.type || null,
        uploaded_by: userData.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Document uploaded");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setBusy(false),
  });

  const remove = useMutation({
    mutationFn: async ({ id, path }: { id: string; path: string }) => {
      await supabase.storage.from("event-documents").remove([path]);
      const { error } = await supabase.from("documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Document deleted");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function signedOpen(bucket: "event-documents" | "generated-pdfs", path: string) {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60);
    if (error || !data) {
      toast.error(error?.message ?? "Could not create download link");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }
  const download = (path: string) => signedOpen("event-documents", path);
  const downloadPdf = (path: string) => signedOpen("generated-pdfs", path);

  const totalSize = (documents ?? []).reduce((s, d) => s + (d.file_size ?? 0), 0);

  return (
    <AppShell
      title="Documents & PDFs"
      subtitle="Private storage for contracts, run sheets and generated files"
      actions={<EventPicker events={events} eventId={eventId} onChange={setEventId} />}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard label="Documents" value={documents?.length ?? 0} />
          <StatCard label="Storage used" value={`${(totalSize / 1024 / 1024).toFixed(1)} MB`} />
          <StatCard
            label="Linked to events"
            value={(documents ?? []).filter((d) => d.event_id).length}
            tone="primary"
          />
        </div>

        {editable && (
          <Panel title="Upload document">
            <div className="flex flex-wrap items-end gap-3">
              <label>
                <span className="label-mono">Category</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1.5 rounded-[8px] border border-input bg-background px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-primary/60"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="font-mono text-xs text-muted-foreground">
                <span className="label-mono block">File (max 50MB)</span>
                <input
                  type="file"
                  disabled={busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setBusy(true);
                      upload.mutate(f);
                    }
                  }}
                  className="mt-1.5"
                />
              </label>
              {busy && (
                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-primary">
                  <Upload className="size-3.5" /> Uploading…
                </span>
              )}
            </div>
          </Panel>
        )}

        <Panel title="Library">
          {isLoading ? (
            <p className="font-mono text-xs text-subtle">Loading documents…</p>
          ) : (documents ?? []).length === 0 ? (
            <EmptyState
              title="No documents yet"
              body="Upload contracts, floor plans, menus and run sheets here."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse">
                <thead>
                  <tr className="border-b border-border text-left">
                    {["Name", "Category", "Event", "Size", "Added", ""].map((h) => (
                      <th key={h} className="label-mono px-2 pb-2">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(documents ?? []).map((d) => (
                    <tr key={d.id} className="border-b border-border/60 last:border-0">
                      <td className="px-2 py-3 font-display text-sm text-foreground">{d.name}</td>
                      <td className="px-2 py-3 font-mono text-[10px] uppercase text-primary">
                        {d.category}
                      </td>
                      <td className="px-2 py-3 font-mono text-[11px] text-muted-foreground">
                        {(d.events as { name: string } | null)?.name ?? "—"}
                      </td>
                      <td className="px-2 py-3 font-mono text-[11px] text-muted-foreground">
                        {((d.file_size ?? 0) / 1024).toFixed(0)} KB
                      </td>
                      <td className="px-2 py-3 font-mono text-[11px] text-muted-foreground">
                        {formatDate(d.created_at)}
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            aria-label="Download"
                            onClick={() => void download(d.file_url)}
                            className="grid size-7 place-items-center rounded text-subtle hover:bg-secondary hover:text-foreground"
                          >
                            <Download className="size-3.5" />
                          </button>
                          {editable && (
                            <button
                              type="button"
                              aria-label="Delete document"
                              onClick={() => remove.mutate({ id: d.id, path: d.file_url })}
                              className="grid size-7 place-items-center rounded text-subtle hover:bg-destructive/15 hover:text-destructive"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="PDF generation center">
          {(pdfs ?? []).length === 0 ? (
            <p className="font-mono text-xs text-subtle">
              Generated seating plans and guest lists appear here. Create one from the Seating
              Designer.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {(pdfs ?? []).map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-border bg-elevated px-3 py-2"
                >
                  <span className="font-mono text-[11px] text-foreground">
                    <span className="text-primary uppercase">{p.type}</span>{" "}
                    {(p.events as { name: string } | null)?.name ?? "—"}
                    <span className="ml-2 text-subtle">{formatDate(p.created_at)}</span>
                  </span>
                  {p.file_url && (
                    <button
                      type="button"
                      onClick={() => void downloadPdf(p.file_url!)}
                      className="inline-flex items-center gap-1.5 font-mono text-[10px] text-primary hover:underline"
                    >
                      <Download className="size-3" /> Download
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

    </AppShell>
  );
}
