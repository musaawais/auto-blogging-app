import React, { useState, useEffect } from "react";
import { useListPublishingQueue, usePublishQueueItem, useCancelQueueItem, useListWordPressSites } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Send, XCircle, ExternalLink, CheckCircle2, Globe, Clock, Inbox,
  RefreshCw, AlertTriangle, Tag, ChevronRight, ChevronLeft, Search, FolderOpen,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString();
}

interface WpCategory {
  id: number;
  name: string;
  slug: string;
  count: number;
  parent: number;
}

// ── Queue Dialog — Site + Category picker ─────────────────────────────────────

function QueueDialog({
  open, article, sites, onClose,
}: {
  open: boolean;
  article: { id: number; title: string } | null;
  sites: any[];
  onClose: (queued?: boolean) => void;
}) {
  const [step, setStep] = useState<"site" | "category">("site");
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [categories, setCategories] = useState<WpCategory[]>([]);
  const [loadingCats, setLoadingCats] = useState(false);
  const [catSearch, setCatSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const connected = sites.filter((s: any) => s.status === "connected");

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setStep("site");
      setSelectedSiteId(null);
      setSelectedCategoryId(null);
      setCategories([]);
      setCatSearch("");
    }
  }, [open]);

  async function loadCategories(siteId: number) {
    setLoadingCats(true);
    setCategories([]);
    try {
      const res = await fetch(`${BASE}/api/wordpress/sites/${siteId}/categories`);
      if (res.ok) {
        const data: WpCategory[] = await res.json();
        setCategories(data.sort((a, b) => a.name.localeCompare(b.name)));
      }
    } catch {
      // silently continue — category is optional
    } finally {
      setLoadingCats(false);
    }
  }

  function handleSiteNext() {
    if (!selectedSiteId) return;
    setStep("category");
    loadCategories(selectedSiteId);
  }

  async function handleQueue() {
    if (!article || !selectedSiteId) return;
    setBusy(true);
    try {
      const res = await fetch(`${BASE}/api/publishing/queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleId: article.id,
          siteId: selectedSiteId,
          categoryId: selectedCategoryId ?? undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to queue");
      const selectedCat = categories.find(c => c.id === selectedCategoryId);
      toast({
        title: "Added to queue",
        description: `"${article.title}" queued${selectedCat ? ` under "${selectedCat.name}"` : ""}.`,
      });
      onClose(true);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  const filteredCats = categories.filter(c =>
    c.name.toLowerCase().includes(catSearch.toLowerCase())
  );

  const selectedCat = categories.find(c => c.id === selectedCategoryId);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-4 h-4 text-primary" />
            {step === "site" ? "Select WordPress Site" : "Select Category"}
          </DialogTitle>
          <DialogDescription>
            {step === "site"
              ? <>Where should <strong>"{article?.title}"</strong> be published?</>
              : <>Pick a category for this article on <strong>{connected.find(s => s.id === selectedSiteId)?.name}</strong>. You can skip this step.</>
            }
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className={`flex items-center gap-1 ${step === "site" ? "text-primary font-medium" : "text-muted-foreground"}`}>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${step === "site" ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-muted-foreground/30"}`}>1</div>
            Site
          </div>
          <ChevronRight className="w-3 h-3" />
          <div className={`flex items-center gap-1 ${step === "category" ? "text-primary font-medium" : "text-muted-foreground"}`}>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${step === "category" ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-muted-foreground/30"}`}>2</div>
            Category
          </div>
        </div>

        {/* Step 1 — Site */}
        {step === "site" && (
          <div className="space-y-2 py-1">
            {connected.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No connected WordPress sites. Add one under <strong>WordPress Sites</strong>.
              </p>
            ) : (
              connected.map((site: any) => (
                <button
                  key={site.id}
                  onClick={() => setSelectedSiteId(site.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors
                    ${selectedSiteId === site.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/30 hover:bg-muted/60 text-foreground"
                    }`}
                >
                  <Globe className="w-4 h-4 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{site.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{site.url}</div>
                  </div>
                  {selectedSiteId === site.id && <CheckCircle2 className="w-4 h-4 ml-auto shrink-0 text-primary" />}
                </button>
              ))
            )}
          </div>
        )}

        {/* Step 2 — Category */}
        {step === "category" && (
          <div className="space-y-3 py-1">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                className="pl-8 h-8 text-sm"
                placeholder="Search categories…"
                value={catSearch}
                onChange={e => setCatSearch(e.target.value)}
              />
            </div>

            {/* List */}
            <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
              {loadingCats ? (
                <div className="text-center py-6 text-sm text-muted-foreground flex items-center justify-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading categories…
                </div>
              ) : (
                <>
                  {/* Uncategorized option */}
                  <button
                    onClick={() => setSelectedCategoryId(null)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors text-sm
                      ${selectedCategoryId === null
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/20 hover:bg-muted/40 text-muted-foreground"
                      }`}
                  >
                    <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-medium">Uncategorized</span>
                    {selectedCategoryId === null && <CheckCircle2 className="w-3.5 h-3.5 ml-auto shrink-0" />}
                  </button>

                  {filteredCats.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategoryId(cat.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors text-sm
                        ${selectedCategoryId === cat.id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted/20 hover:bg-muted/40 text-foreground"
                        }`}
                    >
                      <Tag className="w-3.5 h-3.5 shrink-0 opacity-60" />
                      <span className="truncate">{cat.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground shrink-0">{cat.count}</span>
                      {selectedCategoryId === cat.id && <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-primary" />}
                    </button>
                  ))}

                  {filteredCats.length === 0 && !loadingCats && catSearch && (
                    <p className="text-xs text-muted-foreground text-center py-4">No categories match "{catSearch}"</p>
                  )}
                </>
              )}
            </div>

            {selectedCat && (
              <p className="text-xs text-muted-foreground">
                Will publish under: <span className="text-foreground font-medium">{selectedCat.name}</span>
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === "site" ? (
            <>
              <Button variant="outline" onClick={() => onClose()} disabled={busy}>Cancel</Button>
              <Button onClick={handleSiteNext} disabled={!selectedSiteId}>
                Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("site")} disabled={busy}>
                <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Back
              </Button>
              <Button variant="outline" onClick={handleQueue} disabled={busy}>
                Skip Category
              </Button>
              <Button onClick={handleQueue} disabled={busy || selectedCategoryId === null}>
                {busy ? <><RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" /> Queuing…</> : "Add to Queue"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Publishing() {
  const { data: queue = [], isLoading, refetch } = useListPublishingQueue({}, { query: { queryKey: ["publishing-queue"] } });
  const { data: sites = [] } = useListWordPressSites({ query: { queryKey: ["wp-sites"] } });
  const publishItem = usePublishQueueItem();
  const cancelItem = useCancelQueueItem();
  const { toast } = useToast();

  const [queueDialog, setQueueDialog] = useState<{ id: number; title: string } | null>(null);
  const [readyArticles, setReadyArticles] = useState<any[]>([]);
  const [publishingIds, setPublishingIds] = useState<Set<number>>(new Set());

  async function refreshReady() {
    const res = await fetch(`${BASE}/api/publishing/ready`);
    if (res.ok) setReadyArticles(await res.json());
  }

  useEffect(() => { refreshReady(); }, []);

  const queueItems = queue as any[];
  const queuedCount = queueItems.filter((i) => i.status === "queued").length;
  const failedCount = queueItems.filter((i) => i.status === "failed").length;

  async function handlePublish(id: number) {
    setPublishingIds(prev => new Set(prev).add(id));
    try {
      await publishItem.mutateAsync({ id });
      toast({ title: "Published successfully" });
      refetch();
    } catch (e: any) {
      toast({ title: "Publish failed", description: e.message, variant: "destructive" });
    } finally {
      setPublishingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
      refetch();
    }
  }

  function handleCancel(id: number) {
    cancelItem.mutate({ id }, {
      onSuccess: () => { toast({ title: "Cancelled" }); refetch(); },
    });
  }

  function statusBadge(status: string) {
    switch (status) {
      case "queued":     return <Badge variant="secondary" className="gap-1"><Clock className="w-2.5 h-2.5" />Queued</Badge>;
      case "publishing": return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 gap-1"><RefreshCw className="w-2.5 h-2.5 animate-spin" />Publishing</Badge>;
      case "published":  return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1"><CheckCircle2 className="w-2.5 h-2.5" />Published</Badge>;
      case "failed":     return <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20 gap-1"><AlertTriangle className="w-2.5 h-2.5" />Failed</Badge>;
      case "cancelled":  return <Badge variant="outline" className="text-muted-foreground gap-1"><XCircle className="w-2.5 h-2.5" />Cancelled</Badge>;
      default:           return <Badge variant="outline">{status}</Badge>;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Publishing Queue</h1>
        <p className="text-muted-foreground mt-1">
          Manage articles ready to go live on WordPress — with SEO meta and category routing.
        </p>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3">
        <div className="text-center px-4 py-2 bg-card border rounded-lg">
          <div className="text-xl font-bold">{queuedCount}</div>
          <div className="text-xs text-muted-foreground">Queued</div>
        </div>
        <div className="text-center px-4 py-2 bg-card border rounded-lg">
          <div className="text-xl font-bold text-destructive">{failedCount}</div>
          <div className="text-xs text-muted-foreground">Failed</div>
        </div>
        <div className="text-center px-4 py-2 bg-card border rounded-lg">
          <div className="text-xl font-bold text-emerald-500">{readyArticles.length}</div>
          <div className="text-xs text-muted-foreground">Ready to Queue</div>
        </div>
      </div>

      {/* Ready articles panel */}
      {readyArticles.length > 0 && (
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <Inbox className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">Ready to Publish</span>
            <Badge variant="secondary" className="ml-auto">{readyArticles.length}</Badge>
          </div>
          <div className="divide-y">
            {readyArticles.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{a.title || a.keyword}</p>
                  <p className="text-xs text-muted-foreground">{a.wordCount?.toLocaleString() ?? "—"} words</p>
                </div>
                <Button
                  size="sm"
                  className="shrink-0 gap-1.5"
                  onClick={() => setQueueDialog({ id: a.id, title: a.title || a.keyword })}
                >
                  <Send className="w-3.5 h-3.5" />
                  Queue
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Queue table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <span className="font-semibold text-sm">Publishing Queue</span>
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-7 gap-1 text-xs">
            <RefreshCw className="w-3 h-3" /> Refresh
          </Button>
        </div>

        {isLoading ? (
          <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : queueItems.length === 0 ? (
          <div className="h-32 flex flex-col items-center justify-center text-muted-foreground gap-2">
            <Clock className="w-6 h-6 opacity-30" />
            <p className="text-sm">Queue is empty</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Article</TableHead>
                <TableHead>Site</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queueItems.map((item: any) => (
                <React.Fragment key={item.id}>
                  <TableRow>
                    <TableCell className="font-medium max-w-[200px] truncate">{item.articleTitle}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.siteName}</TableCell>
                    <TableCell>{statusBadge(item.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(item.scheduledAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {(item.status === "queued" || item.status === "failed") && (
                          <>
                            <Button
                              size="sm"
                              className="h-8 gap-1"
                              onClick={() => handlePublish(item.id)}
                              disabled={publishingIds.has(item.id)}
                            >
                              {publishingIds.has(item.id)
                                ? <><RefreshCw className="w-3 h-3 animate-spin" /> Publishing…</>
                                : <><Send className="w-3 h-3" /> Publish</>
                              }
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground"
                              onClick={() => handleCancel(item.id)}
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                        {item.status === "publishing" && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <RefreshCw className="w-3 h-3 animate-spin" /> Publishing…
                          </span>
                        )}
                        {item.status === "published" && item.wordPressPostUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1"
                            onClick={() => window.open(item.wordPressPostUrl, "_blank")}
                          >
                            <ExternalLink className="w-3 h-3" />
                            View Post
                          </Button>
                        )}
                        {item.status === "published" && !item.wordPressPostUrl && (
                          <span className="text-xs text-muted-foreground">Published</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  {item.status === "failed" && item.error && (
                    <TableRow className="bg-destructive/5 hover:bg-destructive/5">
                      <TableCell colSpan={5} className="py-1.5 px-4">
                        <span className="flex items-center gap-2 text-xs text-destructive">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          {item.error}
                        </span>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Queue dialog */}
      <QueueDialog
        open={!!queueDialog}
        article={queueDialog}
        sites={sites as any[]}
        onClose={(queued) => {
          setQueueDialog(null);
          if (queued) { refetch(); refreshReady(); }
        }}
      />
    </div>
  );
}
