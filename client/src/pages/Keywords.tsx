import { useState } from "react";
import { useListKeywords, useRunKeywordWorkflow, useCreateKeyword, useListProjects, useDeleteKeyword } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Play, Search, Upload, Plus, Trash2 } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export default function Keywords() {
  const [searchTerm, setSearchTerm] = useState("");
  const { data: keywords, isLoading, refetch } = useListKeywords({}, { query: { enabled: true, queryKey: ['keywords'] }});
  const { data: projects } = useListProjects({ query: { enabled: true, queryKey: ['projects'] }});
  
  const runWorkflow = useRunKeywordWorkflow();
  const createKeyword = useCreateKeyword();
  const deleteKeyword = useDeleteKeyword();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [keywordStr, setKeywordStr] = useState("");
  const [projectId, setProjectId] = useState("");

  const handleRun = (id: number) => {
    runWorkflow.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Workflow started" });
        refetch();
      }
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete this keyword?")) {
      deleteKeyword.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "Keyword deleted" });
          refetch();
        }
      });
    }
  };

  const handleCreate = () => {
    createKeyword.mutate({
      data: {
        keyword: keywordStr,
        projectId: Number(projectId)
      }
    }, {
      onSuccess: () => {
        toast({ title: "Keyword added" });
        setOpen(false);
        setKeywordStr("");
        refetch();
      }
    });
  };

  const filteredKeywords = keywords?.filter(k => 
    k.keyword.toLowerCase().includes(searchTerm.toLowerCase()) ||
    k.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Keywords</h1>
          <p className="text-muted-foreground mt-1">Target keywords and trigger article generation.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2">
            <Upload className="w-4 h-4" />
            Import CSV
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Add Keyword
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Keyword</DialogTitle>
                <DialogDescription>Add a new keyword to a project.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Keyword</label>
                  <Input value={keywordStr} onChange={e => setKeywordStr(e.target.value)} placeholder="e.g. best credit cards 2024" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Project</label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={projectId}
                    onChange={e => setProjectId(e.target.value)}
                  >
                    <option value="" disabled>Select a project</option>
                    {projects?.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={!keywordStr || !projectId || createKeyword.isPending}>Add Keyword</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex items-center gap-4 bg-card p-2 rounded-lg border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search keywords or categories..." 
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
              <TableHead>Keyword</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Volume</TableHead>
              <TableHead>Difficulty</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">Loading keywords...</TableCell>
              </TableRow>
            ) : filteredKeywords?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">No keywords found.</TableCell>
              </TableRow>
            ) : (
              filteredKeywords?.map(kw => (
                <TableRow key={kw.id}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{kw.keyword}</span>
                      {kw.category && <span className="text-xs text-muted-foreground">{kw.category}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">Proj #{kw.projectId}</TableCell>
                  <TableCell>{formatNumber(kw.searchVolume)}</TableCell>
                  <TableCell>
                    {kw.difficulty !== undefined && kw.difficulty !== null ? (
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${kw.difficulty > 70 ? 'bg-destructive' : kw.difficulty > 40 ? 'bg-yellow-500' : 'bg-emerald-500'}`} 
                            style={{ width: `${kw.difficulty}%`}}
                          />
                        </div>
                        <span className="text-xs">{kw.difficulty}</span>
                      </div>
                    ) : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      kw.status === 'completed' ? 'border-emerald-500 text-emerald-500' :
                      kw.status === 'processing' ? 'border-primary text-primary' :
                      kw.status === 'failed' ? 'border-destructive text-destructive' :
                      'border-muted-foreground text-muted-foreground'
                    }>
                      {kw.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-primary hover:text-primary hover:bg-primary/10"
                        onClick={() => handleRun(kw.id)}
                        disabled={kw.status === 'processing' || kw.status === 'completed'}
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Run
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                        onClick={() => handleDelete(kw.id)}
                      >
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
