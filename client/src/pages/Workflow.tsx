import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { XCircle, Cpu, CheckCircle2, Clock3, AlertCircle, Loader2, RefreshCw } from "lucide-react";

// 4-agent pipeline step display config
const STEP_LABELS: Record<string, string> = {
  writing:           "Writing Agent",
  image_generation:  "Humanizer & Image Generator",
  image_optimization: "PNG → WebP Converter",
  publishing:        "Publisher",
};

const STEP_ORDER = Object.keys(STEP_LABELS);

type JobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

interface JobStep {
  id: number;
  step: string;
  agentName: string | null;
  status: JobStatus;
  progress: number | null;
  message: string | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

interface Pipeline {
  article: {
    id: number;
    title: string;
    keyword: string;
    createdAt: string;
  };
  steps: JobStep[];
}

function StepIcon({ status }: { status: JobStatus }) {
  if (status === "completed") return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
  if (status === "running") return <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />;
  if (status === "failed") return <AlertCircle className="w-4 h-4 text-destructive shrink-0" />;
  if (status === "cancelled") return <XCircle className="w-4 h-4 text-muted-foreground shrink-0" />;
  return <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />;
}

function elapsedSince(isoDate: string | null): string {
  if (!isoDate) return "";
  const ms = Date.now() - new Date(isoDate).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function PipelineCard({ pipeline, onCancel }: { pipeline: Pipeline; onCancel: (ids: number[]) => void }) {
  const steps = STEP_ORDER.map((key) =>
    pipeline.steps.find((s) => s.step === key) ?? null
  );

  const completedCount = pipeline.steps.filter((s) => s.status === "completed").length;
  const runningStep = pipeline.steps.find((s) => s.status === "running");
  const totalSteps = STEP_ORDER.length;
  const overallProgress = Math.round((completedCount / totalSteps) * 100);

  const pendingOrRunningIds = pipeline.steps
    .filter((s) => s.status === "pending" || s.status === "running")
    .map((s) => s.id);

  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <Cpu className="w-4 h-4 text-primary shrink-0" />
            <h2 className="font-semibold text-sm truncate">{pipeline.article.title}</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Keyword: <span className="text-foreground/80">{pipeline.article.keyword}</span>
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className="text-sm font-semibold">{completedCount}/{totalSteps} steps</div>
            <div className="text-xs text-muted-foreground">
              {runningStep
                ? `Running: ${STEP_LABELS[runningStep.step] ?? runningStep.step}`
                : completedCount === totalSteps
                ? "All done"
                : "Queued"}
            </div>
          </div>
          {pendingOrRunningIds.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => onCancel(pendingOrRunningIds)}
              title="Cancel pipeline"
            >
              <XCircle className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Overall progress bar */}
      <div className="h-1.5 bg-muted w-full">
        <div
          className="h-full bg-primary transition-all duration-700"
          style={{ width: `${overallProgress}%` }}
        />
      </div>

      {/* Steps grid */}
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
        {steps.map((step, idx) => {
          if (!step) return (
            <div key={STEP_ORDER[idx]} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-muted/30 opacity-40">
              <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/20 shrink-0" />
              <span className="text-xs text-muted-foreground">{STEP_LABELS[STEP_ORDER[idx]] ?? STEP_ORDER[idx]}</span>
            </div>
          );

          return (
            <div
              key={step.id}
              className={`flex items-start gap-2.5 px-3 py-2 rounded-lg transition-colors ${
                step.status === "running"
                  ? "bg-primary/10 border border-primary/20"
                  : step.status === "completed"
                  ? "bg-emerald-500/5 border border-emerald-500/10"
                  : step.status === "failed"
                  ? "bg-destructive/10 border border-destructive/20"
                  : "bg-muted/30 border border-transparent"
              }`}
            >
              <div className="mt-0.5">
                <StepIcon status={step.status} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-xs font-medium ${step.status === "running" ? "text-primary" : step.status === "completed" ? "text-emerald-500" : "text-muted-foreground"}`}>
                    {STEP_LABELS[step.step] ?? step.step}
                  </span>
                  {step.status === "running" && step.startedAt && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 shrink-0">
                      <Clock3 className="w-2.5 h-2.5" />
                      <LiveElapsed startedAt={step.startedAt} />
                    </span>
                  )}
                </div>

                {/* Progress bar for running step */}
                {step.status === "running" && (
                  <div className="mt-1 h-1 bg-primary/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-700"
                      style={{ width: `${step.progress ?? 0}%` }}
                    />
                  </div>
                )}

                {/* Completion message */}
                {step.status === "completed" && step.message && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{step.message}</p>
                )}

                {/* Error */}
                {step.status === "failed" && step.error && (
                  <p className="text-[10px] text-destructive mt-0.5 line-clamp-1">{step.error}</p>
                )}

                {/* Agent name for pending */}
                {step.status === "pending" && (
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">{step.agentName ?? "Waiting..."}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Ticking elapsed timer component
function LiveElapsed({ startedAt }: { startedAt: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return <>{elapsedSince(startedAt)}</>;
}

export default function Workflow() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

  const fetchPipelines = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/workflow/active`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data: Pipeline[] = await res.json();
      setPipelines(data);
    } catch {
      // silently ignore polling errors
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }, [BASE]);

  // Initial load + polling every 2s
  useEffect(() => {
    fetchPipelines();
    const t = setInterval(fetchPipelines, 2000);
    return () => clearInterval(t);
  }, [fetchPipelines]);

  const handleCancel = async (ids: number[]) => {
    await Promise.all(
      ids.map((id) =>
        fetch(`${BASE}/api/workflow/jobs/${id}/cancel`, { method: "POST" })
      )
    );
    fetchPipelines();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workflow Engine</h1>
          <p className="text-muted-foreground mt-1">Live view of AI agents generating your content.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className="w-3 h-3" />
          <span>Auto-refresh · last {lastRefresh.toLocaleTimeString()}</span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading pipelines…</span>
        </div>
      ) : pipelines.length === 0 ? (
        <div className="bg-card border rounded-xl flex flex-col items-center justify-center py-20 text-center gap-3">
          <Cpu className="w-10 h-10 text-muted-foreground/40" />
          <div>
            <p className="font-semibold text-foreground">No active pipelines</p>
            <p className="text-sm text-muted-foreground mt-1">
              Go to <strong>Keywords</strong> and click <strong>Run</strong> on a keyword to start generating an article.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {pipelines.map((p) => (
            <PipelineCard key={p.article.id} pipeline={p} onCancel={handleCancel} />
          ))}
        </div>
      )}
    </div>
  );
}
