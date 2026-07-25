import { useGetArticleAnalytics, useGetDashboardStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";

export default function Analytics() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats({ query: { enabled: true, queryKey: ['dashboard-stats'] }});
  const { data: analytics, isLoading: analyticsLoading } = useGetArticleAnalytics({ days: 30 }, { query: { enabled: true, queryKey: ['analytics', 30] }});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground mt-1">Performance metrics for your SEO operations.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Content Velocity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatNumber(stats?.articlesThisWeek)}</div>
            <p className="text-xs text-muted-foreground mt-1">Articles produced this week</p>
          </CardContent>
        </Card>
        
        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Publishing Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-500">{stats?.publishingSuccess}%</div>
            <p className="text-xs text-muted-foreground mt-1">Successfully published to WordPress</p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Readability Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{stats?.avgReadabilityScore}</div>
            <p className="text-xs text-muted-foreground mt-1">Flesch reading ease metric</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Production Volume Over Time</CardTitle>
            <CardDescription>Articles generated vs. published across the last 30 days</CardDescription>
          </CardHeader>
          <CardContent className="h-[400px] flex items-center justify-center text-muted-foreground bg-muted/10 rounded-md border border-dashed m-6 mt-0">
             {analyticsLoading ? "Loading chart..." : "Chart Placeholder - Bar/Line Chart"}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Word Count Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {statsLoading ? "Loading..." : stats?.wordCountDistribution?.map((dist, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{dist.range} words</span>
                    <span className="font-bold">{dist.count}</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary opacity-80" 
                      style={{ width: `${Math.max(5, (dist.count / (stats.totalArticles || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quality Metrics</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground bg-muted/10 rounded-md border border-dashed m-6 mt-0">
             Scatter Plot Placeholder: SEO vs Readability Score
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
