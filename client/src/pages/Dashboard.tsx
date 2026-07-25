import { useGetDashboardStats, useGetArticleAnalytics, useGetAgentUsage, useGetRecentActivity } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, FileText, CheckCircle, Target, TrendingUp, Cpu } from "lucide-react";
import { formatNumber } from "@/lib/utils";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats({ query: { enabled: true, queryKey: ['dashboard-stats'] }});
  const { data: recentActivity, isLoading: activityLoading } = useGetRecentActivity({ limit: 10 }, { query: { enabled: true, queryKey: ['recent-activity'] }});
  const { data: agentUsage, isLoading: agentLoading } = useGetAgentUsage({ query: { enabled: true, queryKey: ['agent-usage'] }});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Command Center</h1>
        <p className="text-muted-foreground mt-1">Your AI content generation at a glance.</p>
      </div>

      {statsLoading ? (
        <div className="h-64 flex items-center justify-center">Loading stats...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <StatsCard title="Total Articles" value={stats?.totalArticles} icon={FileText} />
            <StatsCard title="Published" value={stats?.publishedArticles} icon={CheckCircle} valueColor="text-emerald-500" />
            <StatsCard title="Pending Keywords" value={stats?.pendingKeywords} icon={Target} />
            <StatsCard title="Active Projects" value={stats?.activeProjects} icon={Activity} />
            <StatsCard title="Avg SEO Score" value={stats?.avgSeoScore} icon={TrendingUp} suffix="/ 100" />
            <StatsCard title="Jobs Failed" value={stats?.failedJobs} icon={Cpu} valueColor={stats?.failedJobs && stats.failedJobs > 0 ? "text-destructive" : "text-muted-foreground"} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="col-span-1 lg:col-span-2">
              <CardHeader>
                <CardTitle>Content Production</CardTitle>
                <CardDescription>Articles created and published over the last 30 days</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground bg-muted/10 rounded-md border border-dashed">
                {/* A real chart library would go here. For now, visual placeholder */}
                Chart Placeholder - Article Analytics
              </CardContent>
            </Card>

            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {activityLoading ? (
                    <div className="text-sm text-muted-foreground">Loading...</div>
                  ) : recentActivity?.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No recent activity.</div>
                  ) : (
                    recentActivity?.map((activity) => (
                      <div key={activity.id} className="flex items-start gap-3 text-sm">
                        <div className="w-2 h-2 mt-1.5 rounded-full bg-primary flex-shrink-0" />
                        <div>
                          <p className="text-foreground">{activity.message}</p>
                          <span className="text-xs text-muted-foreground">{new Date(activity.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Agent Performance</CardTitle>
              </CardHeader>
              <CardContent>
                 <div className="space-y-4">
                  {agentLoading ? (
                    <div className="text-sm text-muted-foreground">Loading...</div>
                  ) : (
                    agentUsage?.map(stat => (
                      <div key={stat.agent} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Cpu className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{stat.agent.replace('_', ' ')}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-emerald-500">{stat.runsSuccess} success</span>
                          <span className={stat.runsFailed > 0 ? "text-destructive" : "text-muted-foreground"}>{stat.runsFailed} failed</span>
                        </div>
                      </div>
                    ))
                  )}
                 </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Status Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats?.statusBreakdown?.map(sb => (
                    <div key={sb.status} className="flex items-center justify-between">
                      <span className="text-sm capitalize">{sb.status.replace('_', ' ')}</span>
                      <span className="text-sm font-bold">{formatNumber(sb.count)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function StatsCard({ title, value, icon: Icon, valueColor = "text-foreground", suffix = "" }: { title: string, value: any, icon: any, valueColor?: string, suffix?: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="w-4 h-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${valueColor}`}>
          {formatNumber(value)}{suffix}
        </div>
      </CardContent>
    </Card>
  );
}
