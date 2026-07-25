import { useParams } from "wouter";
import { useGetArticle, useUpdateArticle, useListWordPressSites } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Save, RefreshCw, Send, CheckCircle2, Eye, Edit3, ExternalLink, Globe } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

const BASE = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");

// Renders article HTML in a styled preview
function ArticlePreview({ html, keyword }: { html: string; keyword: string }) {
  return (
    <div
      className="prose prose-invert prose-sm max-w-none px-6 py-5
        prose-headings:text-foreground prose-headings:font-semibold
        prose-p:text-muted-foreground prose-p:leading-relaxed
        prose-li:text-muted-foreground
        prose-a:text-primary prose-a:no-underline hover:prose-a:underline
        prose-strong:text-foreground
        [&_.toc]:bg-muted/50 [&_.toc]:rounded-lg [&_.toc]:p-4 [&_.toc]:my-4
        [&_.toc_h3]:text-sm [&_.toc_h3]:font-semibold [&_.toc_h3]:mb-2 [&_.toc_h3]:mt-0
        [&_.toc_ol]:text-sm [&_.toc_ol]:space-y-1 [&_.toc_ol]:list-decimal [&_.toc_ol]:pl-4
        [&_.key-takeaways]:bg-primary/5 [&_.key-takeaways]:border [&_.key-takeaways]:border-primary/20 [&_.key-takeaways]:rounded-lg [&_.key-takeaways]:p-4 [&_.key-takeaways]:my-4
        [&_.key-takeaways_h3]:text-sm [&_.key-takeaways_h3]:font-semibold [&_.key-takeaways_h3]:mb-2 [&_.key-takeaways_h3]:mt-0 [&_.key-takeaways_h3]:text-primary"
      dangerouslySetInnerHTML={{ __html: html || `<p class="text-muted-foreground italic">Article content goes here once generation completes…</p>` }}
    />
  );
}

// Publish dialog — pick site then confirm
function PublishDialog({
  open, onClose, articleId, articleTitle,
}: {
  open: boolean;
  onClose: () => void;
  articleId: number;
  articleTitle: string;
}) {
  const { data: sites = [] } = useListWordPressSites({});
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);
  const { toast } = useToast();

  const connectedSites = (sites as any[]).filter((s: any) => s.status === "connected");

  async function handlePublish() {
    if (!selectedSiteId) return;
    setPublishing(true);
    try {
      // Add to publishing queue — user triggers the actual WP push from the Queue tab
      const qRes = await fetch(`${BASE}/api/publishing/queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId, siteId: selectedSiteId }),
      });
      if (!qRes.ok) throw new Error("Failed to add article to queue");

      toast({
        title: "Added to publishing queue",
        description: `"${articleTitle}" is queued. Go to the Publishing tab to send it live.`,
      });
      onClose();
    } catch (e: any) {
      toast({ title: "Queue failed", description: e.message, variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-4 h-4 text-primary" /> Publish Article
          </DialogTitle>
          <DialogDescription>
            Select a WordPress site to publish <strong>"{articleTitle}"</strong> to.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          {connectedSites.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No connected WordPress sites. Add one under <strong>WordPress Sites</strong> first.
            </p>
          ) : (
            connectedSites.map((site: any) => (
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
                {selectedSiteId === site.id && <CheckCircle2 className="w-4 h-4 ml-auto shrink-0" />}
              </button>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={publishing}>Cancel</Button>
          <Button
            onClick={handlePublish}
            disabled={!selectedSiteId || publishing || connectedSites.length === 0}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Send className="w-4 h-4" />
            {publishing ? "Adding…" : "Add to Queue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ArticleEditor() {
  const { id } = useParams<{ id: string }>();
  const articleId = Number(id);

  const { data: article, isLoading, refetch } = useGetArticle(articleId, {
    query: { enabled: !!articleId, queryKey: ["article", articleId] },
  });
  const updateArticle = useUpdateArticle();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [viewMode, setViewMode] = useState<"preview" | "edit">("preview");
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);

  useEffect(() => {
    if (article) {
      setTitle((article as any).title || "");
      setContent((article as any).content || "");
      setMetaTitle((article as any).metaTitle || "");
      setMetaDescription((article as any).metaDescription || "");
    }
  }, [article]);

  if (isLoading) return <div className="h-[80vh] flex items-center justify-center">Loading editor…</div>;
  if (!article) return <div className="h-[80vh] flex items-center justify-center text-destructive">Article not found</div>;

  const art = article as any;

  const handleSave = () => {
    updateArticle.mutate(
      { id: articleId, data: { title, content, metaTitle, metaDescription } },
      { onSuccess: () => { toast({ title: "Article saved" }); refetch(); } }
    );
  };

  const statusColor: Record<string, string> = {
    completed: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
    published: "bg-primary/10 text-primary border-primary/30",
    generating: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
    failed: "bg-destructive/10 text-destructive border-destructive/30",
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 shrink-0 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-xl font-bold tracking-tight truncate max-w-[420px]">{art.title}</h1>
          <Badge className={`capitalize border ${statusColor[art.status] ?? "bg-muted text-muted-foreground"}`}>
            {art.status}
          </Badge>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleSave} disabled={updateArticle.isPending} className="gap-1.5">
            <Save className="w-3.5 h-3.5" /> Save
          </Button>
          {(art.status === "completed" || art.status === "published") && (
            <Button
              size="sm"
              onClick={() => setPublishDialogOpen(true)}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Send className="w-3.5 h-3.5" />
              {art.status === "published" ? "Republish" : "Publish"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5 flex-1 min-h-0">
        {/* Left: content */}
        <div className="xl:col-span-3 flex flex-col gap-4 overflow-y-auto pb-6">
          {/* Title */}
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-base font-semibold"
            placeholder="Article title"
          />

          {/* Content editor / preview */}
          <Card className="flex-1 border-border">
            <CardHeader className="py-3 px-4 border-b flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {viewMode === "preview" ? "Article Preview" : "Content Editor"}
              </CardTitle>
              <div className="flex gap-1 bg-muted rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode("preview")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${viewMode === "preview" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Eye className="w-3 h-3" /> Preview
                </button>
                <button
                  onClick={() => setViewMode("edit")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${viewMode === "edit" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Edit3 className="w-3 h-3" /> Edit HTML
                </button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {viewMode === "preview" ? (
                <ArticlePreview html={content} keyword={art.keyword ?? ""} />
              ) : (
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[600px] font-mono text-xs border-0 rounded-none resize-none focus-visible:ring-0"
                  placeholder="<p>Start writing your article HTML here…</p>"
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: metadata & scores */}
        <div className="flex flex-col gap-4 overflow-y-auto pb-6">
          {/* SEO Metadata */}
          <Card>
            <CardHeader className="py-3 px-4 border-b">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" /> SEO Metadata
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Meta Title</span>
                  <span>{metaTitle.length}/60</span>
                </div>
                <Input
                  value={metaTitle}
                  onChange={(e) => setMetaTitle(e.target.value)}
                  className="text-sm"
                  placeholder="SEO title"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Meta Description</span>
                  <span className={metaDescription.length > 160 ? "text-destructive" : ""}>{metaDescription.length}/160</span>
                </div>
                <Textarea
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  className="text-sm min-h-[80px] resize-none"
                  placeholder="Meta description"
                />
              </div>
            </CardContent>
          </Card>

          {/* Quality Scores */}
          <Card>
            <CardHeader className="py-3 px-4 border-b">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Quality Scores
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {[
                { label: "SEO Score", value: art.seoScore, max: 100, color: "bg-emerald-500", textColor: "text-emerald-500" },
                { label: "Readability", value: art.readabilityScore, max: 100, color: "bg-primary", textColor: "text-primary" },
                { label: "AI Detection", value: art.aiScore, max: 100, color: "bg-yellow-500", textColor: "text-yellow-500", invertGood: true },
              ].map(({ label, value, color, textColor, max, invertGood }) => (
                <div key={label} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span className={`font-bold text-xs ${textColor}`}>
                      {value ?? "—"}{value != null ? (invertGood ? "% AI" : `/${max}`) : ""}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${value ?? 0}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Article stats */}
          <Card>
            <CardHeader className="py-3 px-4 border-b">
              <CardTitle className="text-sm font-semibold">Article Info</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2 text-sm">
              {[
                ["Word Count", art.wordCount ? `${art.wordCount.toLocaleString()} words` : "—"],
                ["Keyword", art.keyword ?? "—"],
                ["Language", art.language ?? "en"],
                ["Images", art.imageCount ?? 0],
              ].map(([k, v]) => (
                <div key={k as string} className="flex justify-between">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium text-right truncate ml-2 max-w-[140px]">{v as string}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Publish status */}
          {art.status === "published" && art.publishedAt && (
            <Card className="border-emerald-500/20 bg-emerald-500/5">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-emerald-500 mb-0.5">Published</div>
                    <div className="text-xs text-muted-foreground">{new Date(art.publishedAt).toLocaleDateString()}</div>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                </div>
                {art.wordPressPostUrl && (
                  <a
                    href={art.wordPressPostUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-emerald-500 hover:text-emerald-400 transition-colors font-medium"
                  >
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    View on WordPress
                  </a>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Publish dialog */}
      <PublishDialog
        open={publishDialogOpen}
        onClose={() => { setPublishDialogOpen(false); refetch(); }}
        articleId={articleId}
        articleTitle={art.title}
      />
    </div>
  );
}
