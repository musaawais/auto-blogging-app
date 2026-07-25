import { useState } from "react";
import { useCreateProject, useUpdateProject, useDeleteProject, useListProjects } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Settings2, Play, Trash2 } from "lucide-react";
import { formatNumber, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export default function Projects() {
  const { data: projects, isLoading, refetch } = useListProjects({ query: { enabled: true, queryKey: ['projects'] }});
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();
  const { toast } = useToast();
  
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleCreate = () => {
    createProject.mutate({
      data: { name, description }
    }, {
      onSuccess: () => {
        toast({ title: "Project created" });
        setOpen(false);
        setName("");
        setDescription("");
        refetch();
      }
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this project?")) {
      deleteProject.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "Project deleted" });
          refetch();
        }
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground mt-1">Manage your SEO content pipelines.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Project</DialogTitle>
              <DialogDescription>Setup a new content pipeline.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Project Name</label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Finance Blog 2024" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!name || createProject.isPending}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center">Loading projects...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {projects?.map(project => (
            <Card key={project.id} className="flex flex-col hover:border-primary/50 transition-colors group relative">
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                 <Button variant="ghost" size="icon" onClick={() => handleDelete(project.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10">
                   <Trash2 className="w-4 h-4" />
                 </Button>
              </div>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="pr-6">
                    <CardTitle className="text-xl">{project.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{project.description || "No description"}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 pb-3">
                <div className="grid grid-cols-3 gap-4 text-center divide-x border rounded-lg p-3 bg-muted/10">
                  <div>
                    <div className="text-xl font-bold">{formatNumber(project.keywordCount)}</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Keywords</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-primary">{formatNumber(project.articleCount)}</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Articles</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-emerald-500">{formatNumber(project.publishedCount)}</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Published</div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="outline" className={project.status === 'active' ? 'border-primary/50 text-primary bg-primary/5' : 'text-muted-foreground'}>
                    Status: {project.status}
                  </Badge>
                  {project.autoPublish && <Badge variant="outline" className="text-xs text-muted-foreground border-primary/20 bg-primary/5">Auto-Publish</Badge>}
                  {project.autoHumanize && <Badge variant="outline" className="text-xs text-muted-foreground border-primary/20 bg-primary/5">Auto-Humanize</Badge>}
                  {project.autoSeo && <Badge variant="outline" className="text-xs text-muted-foreground border-primary/20 bg-primary/5">Auto-SEO</Badge>}
                </div>
              </CardContent>
              <CardFooter className="pt-3 border-t flex items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">
                  Updated {formatDate(project.updatedAt)}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                    <Settings2 className="w-4 h-4" />
                  </Button>
                  <Button variant="default" size="sm" className="h-8 gap-1">
                    <Play className="w-3 h-3" />
                    Launch
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
