import { useListArticles, useDeleteArticle } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Edit2, Search, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function Articles() {
  const [searchTerm, setSearchTerm] = useState("");
  const { data: articles, isLoading, refetch } = useListArticles({}, { query: { enabled: true, queryKey: ['articles'] }});
  const deleteArticle = useDeleteArticle();
  const { toast } = useToast();

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this article? This action cannot be undone.")) {
      deleteArticle.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "Article deleted" });
          refetch();
        }
      });
    }
  };

  const filteredArticles = articles?.filter(a => 
    a.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.keyword?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Articles</h1>
          <p className="text-muted-foreground mt-1">Review, edit, and publish generated content.</p>
        </div>
      </div>

      <div className="flex items-center gap-4 bg-card p-2 rounded-lg border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search articles by title or keyword..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9 border-none bg-transparent shadow-none focus-visible:ring-0"
          />
        </div>
      </div>

      <div className="bg-card rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Title</TableHead>
              <TableHead>Keyword</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Scores</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">Loading articles...</TableCell>
              </TableRow>
            ) : filteredArticles?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">No articles found.</TableCell>
              </TableRow>
            ) : (
              filteredArticles?.map(article => (
                <TableRow key={article.id}>
                  <TableCell className="font-medium">
                    <div className="max-w-[300px] truncate">{article.title || "Untitled Article"}</div>
                    <div className="text-xs text-muted-foreground mt-1 truncate">{article.slug || "No slug yet"}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{article.keyword || `Keyword #${article.keywordId}`}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      article.status === 'published' ? 'border-emerald-500 text-emerald-500 bg-emerald-500/10' :
                      article.status === 'ready' ? 'border-primary text-primary bg-primary/10' :
                      article.status === 'failed' ? 'border-destructive text-destructive bg-destructive/10' :
                      'border-muted-foreground text-muted-foreground'
                    }>
                      {article.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {article.seoScore && (
                        <div className="flex items-center gap-1 text-xs font-medium">
                          <span className="text-muted-foreground">SEO:</span>
                          <span className={article.seoScore > 80 ? 'text-emerald-500' : 'text-yellow-500'}>{article.seoScore}</span>
                        </div>
                      )}
                      {article.readabilityScore && (
                        <div className="flex items-center gap-1 text-xs font-medium">
                          <span className="text-muted-foreground">Read:</span>
                          <span className={article.readabilityScore > 60 ? 'text-emerald-500' : 'text-yellow-500'}>{article.readabilityScore}</span>
                        </div>
                      )}
                      {!article.seoScore && !article.readabilityScore && <span className="text-muted-foreground text-xs">-</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/articles/${article.id}`} className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 w-8 p-0">
                        <Edit2 className="w-4 h-4 text-primary" />
                        <span className="sr-only">Edit</span>
                      </Link>
                      {article.status === 'published' && article.wordPressPostUrl && (
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0" title="View on WordPress" onClick={() => window.open(article.wordPressPostUrl!, '_blank')}>
                          <ExternalLink className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(article.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
