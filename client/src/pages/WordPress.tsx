import { useState } from "react";
import { useListWordPressSites, useTestWordPressSite, useDeleteWordPressSite, useCreateWordPressSite } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Globe, Plus, Trash2, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { formatNumber, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export default function WordPress() {
  const { data: sites, isLoading, refetch } = useListWordPressSites({ query: { enabled: true, queryKey: ['wordpress-sites'] }});
  const createSite = useCreateWordPressSite();
  const testSite = useTestWordPressSite();
  const deleteSite = useDeleteWordPressSite();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [appPassword, setAppPassword] = useState("");

  const handleCreate = () => {
    createSite.mutate({
      data: { name, url, username, appPassword }
    }, {
      onSuccess: () => {
        toast({ title: "Site connected successfully" });
        setOpen(false);
        setName("");
        setUrl("");
        setUsername("");
        setAppPassword("");
        refetch();
      }
    });
  };

  const handleTest = (id: number) => {
    testSite.mutate({ id }, {
      onSuccess: (data) => {
        toast({
          title: data.success ? "Connection Successful" : "Connection Failed",
          description: data.message,
          variant: data.success ? "default" : "destructive"
        });
        refetch();
      }
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to disconnect this WordPress site?")) {
      deleteSite.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "Site removed" });
          refetch();
        }
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">WordPress Connections</h1>
          <p className="text-muted-foreground mt-1">Connect your sites to automate publishing.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Connect Site
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Connect WordPress Site</DialogTitle>
              <DialogDescription>Enter your WordPress application password details.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Site Name</label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Main Blog" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Site URL</label>
                <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Admin Username</label>
                <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="admin" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Application Password</label>
                <Input value={appPassword} onChange={e => setAppPassword(e.target.value)} type="password" placeholder="xxxx xxxx xxxx xxxx" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!name || !url || !username || !appPassword || createSite.isPending}>Connect</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center">Loading connected sites...</div>
      ) : sites?.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg border">
          <Globe className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium">No sites connected</h3>
          <p className="text-muted-foreground mt-1 mb-4">Connect a WordPress site to start publishing articles automatically.</p>
          <Button onClick={() => setOpen(true)}>Connect your first site</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sites?.map(site => (
            <Card key={site.id} className="flex flex-col border-t-4 border-t-primary">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Globe className="w-5 h-5 text-primary" />
                      {site.name}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1 truncate max-w-[200px]">{site.url}</p>
                  </div>
                  {site.status === 'connected' ? (
                    <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Connected
                    </Badge>
                  ) : site.status === 'error' ? (
                    <Badge variant="destructive" className="bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Error
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Disconnected</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-muted-foreground">Username</span>
                  <span className="text-sm font-medium">{site.username || '-'}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-muted-foreground">Posts Published</span>
                  <span className="text-sm font-medium">{formatNumber(site.postsPublished)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-muted-foreground">Last Sync</span>
                  <span className="text-sm font-medium">{site.lastSyncAt ? formatDate(site.lastSyncAt) : '-'}</span>
                </div>
              </CardContent>
              <CardFooter className="pt-4 flex items-center justify-between gap-2 bg-muted/20 border-t">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleTest(site.id)}
                  disabled={testSite.isPending}
                  className="gap-2"
                >
                  <RefreshCw className={`w-3 h-3 ${testSite.isPending ? 'animate-spin' : ''}`} />
                  Test Connection
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleDelete(site.id)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
