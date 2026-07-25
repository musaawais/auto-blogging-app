import { useState } from "react";
import { useListSchedules, useDeleteSchedule, useCreateSchedule, useListProjects, useListWordPressSites } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CalendarClock, Plus, Trash2, Edit } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export default function Schedules() {
  const { data: schedules, isLoading, refetch } = useListSchedules({ query: { enabled: true, queryKey: ['schedules'] }});
  const { data: projects } = useListProjects({ query: { enabled: true, queryKey: ['projects'] }});
  const { data: sites } = useListWordPressSites({ query: { enabled: true, queryKey: ['wordpress-sites'] }});
  
  const createSchedule = useCreateSchedule();
  const deleteSchedule = useDeleteSchedule();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [postsPerDay, setPostsPerDay] = useState("1");
  const [publishTime, setPublishTime] = useState("09:00");
  const [siteId, setSiteId] = useState("");

  const handleCreate = () => {
    createSchedule.mutate({
      data: {
        name,
        projectId: Number(projectId),
        postsPerDay: Number(postsPerDay),
        publishTime,
        days: "mon,tue,wed,thu,fri,sat,sun", // Default all days for simplicity
        timezone: "UTC",
        wordPressSiteId: siteId ? Number(siteId) : undefined
      }
    }, {
      onSuccess: () => {
        toast({ title: "Schedule created" });
        setOpen(false);
        setName("");
        refetch();
      }
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this schedule?")) {
      deleteSchedule.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "Schedule deleted" });
          refetch();
        }
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Schedules</h1>
          <p className="text-muted-foreground mt-1">Automate the frequency and timing of article publication.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Create Schedule
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Schedule</DialogTitle>
              <DialogDescription>Define when and how often content gets published.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Schedule Name</label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Daily Morning Publishing" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Source Project</label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={projectId}
                  onChange={e => setProjectId(e.target.value)}
                >
                  <option value="" disabled>Select project</option>
                  {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Target Site</label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={siteId}
                  onChange={e => setSiteId(e.target.value)}
                >
                  <option value="">No site (manual review)</option>
                  {sites?.filter(s => s.status === 'connected').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Posts per Day</label>
                  <Input type="number" min="1" max="50" value={postsPerDay} onChange={e => setPostsPerDay(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Publish Time</label>
                  <Input type="time" value={publishTime} onChange={e => setPublishTime(e.target.value)} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!name || !projectId || createSchedule.isPending}>Create Schedule</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center">Loading schedules...</div>
      ) : schedules?.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg border">
          <CalendarClock className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium">No active schedules</h3>
          <p className="text-muted-foreground mt-1 mb-4">Create a schedule to automatically publish articles from a project.</p>
          <Button onClick={() => setOpen(true)}>Create Schedule</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {schedules?.map(schedule => (
            <Card key={schedule.id} className="flex flex-col border-t-4 border-t-secondary">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl">{schedule.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">Project #{schedule.projectId}</p>
                  </div>
                  <Badge variant={schedule.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                    {schedule.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted/30 p-3 rounded-md text-center">
                    <div className="text-2xl font-bold text-primary">{schedule.postsPerDay}</div>
                    <div className="text-xs text-muted-foreground uppercase mt-1">Posts / Day</div>
                  </div>
                  <div className="bg-muted/30 p-3 rounded-md text-center">
                    <div className="text-lg font-medium pt-1">{schedule.publishTime}</div>
                    <div className="text-xs text-muted-foreground uppercase mt-1">{schedule.timezone}</div>
                  </div>
                </div>
                
                <div className="mt-4">
                  <div className="text-sm text-muted-foreground mb-2">Active Days</div>
                  <div className="flex gap-1 flex-wrap">
                    {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(day => {
                      const isActive = schedule.days?.includes(day);
                      return (
                        <div key={day} className={`w-8 h-8 rounded flex items-center justify-center text-xs font-medium ${isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                          {day.charAt(0).toUpperCase()}
                        </div>
                      )
                    })}
                  </div>
                </div>
                
                {schedule.randomInterval && (
                  <Badge variant="outline" className="text-xs border-dashed">Randomized Intervals</Badge>
                )}
              </CardContent>
              <CardFooter className="pt-4 flex items-center justify-between gap-2 bg-muted/20 border-t">
                <div className="text-xs text-muted-foreground">
                  Next run: <span className="font-medium text-foreground">{schedule.nextRunAt ? formatDate(schedule.nextRunAt) : '-'}</span>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <Edit className="w-4 h-4 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(schedule.id)} className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10">
                    <Trash2 className="w-4 h-4" />
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
