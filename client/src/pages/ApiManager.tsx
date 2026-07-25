import { useState } from "react";
import {
  useListApiKeys,
  useTestApiKey,
  useDeleteApiKey,
  useCreateApiKey,
  useSetActiveApiKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Network,
  Plus,
  Trash2,
  RefreshCw,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Star,
  Zap,
  ImageIcon,
  Type,
  ChevronDown,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";

// ── Model presets per provider ─────────────────────────────────────────────────

const MODEL_PRESETS: Record<string, { text: string[]; image: string[] }> = {
  openai: {
    text: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
    image: ["dall-e-3", "dall-e-2"],
  },
  groq: {
    text: [
      "llama-3.3-70b-versatile",
      "llama-3.1-70b-versatile",
      "llama-3.1-8b-instant",
      "mixtral-8x7b-32768",
      "gemma2-9b-it",
    ],
    image: [],
  },
  anthropic: {
    text: ["claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-3-5"],
    image: [],
  },
  gemini: {
    text: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
    image: ["imagen-3.0-generate-002"],
  },
  openai_compatible: {
    text: [],
    image: [],
  },
};

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  groq: "Groq",
  anthropic: "Anthropic (Claude)",
  gemini: "Google Gemini",
  openai_compatible: "Custom / OpenAI-Compatible",
};

const DEFAULT_ENDPOINTS: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  groq: "https://api.groq.com/openai/v1",
  anthropic: "https://api.anthropic.com/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
  openai_compatible: "",
};

const PURPOSE_LABELS = {
  text: { label: "Text Generation", icon: Type, color: "text-blue-500", bg: "bg-blue-500/10 border-blue-500/20" },
  image: { label: "Image Generation", icon: ImageIcon, color: "text-purple-500", bg: "bg-purple-500/10 border-purple-500/20" },
  both: { label: "Text & Images", icon: Zap, color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/20" },
};

type Purpose = "text" | "image" | "both";

// ── Component ──────────────────────────────────────────────────────────────────

export default function ApiManager() {
  const { data: keys = [], isLoading, refetch } = useListApiKeys({
    query: { enabled: true, queryKey: ["api-keys"] },
  });
  const createKey = useCreateApiKey();
  const testKey = useTestApiKey();
  const deleteKey = useDeleteApiKey();
  const setActive = useSetActiveApiKey();
  const { toast } = useToast();

  // Dialog state
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState("openai");
  const [purpose, setPurpose] = useState<Purpose>("text");
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [modelName, setModelName] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [showEndpoint, setShowEndpoint] = useState(false);

  // When provider changes, reset model and endpoint
  const handleProviderChange = (p: string) => {
    setProvider(p);
    const presets = MODEL_PRESETS[p] ?? { text: [], image: [] };
    const list = purpose === "image" ? presets.image : presets.text;
    setModelName(list[0] ?? "");
    setCustomModel("");
    setEndpointUrl(DEFAULT_ENDPOINTS[p] ?? "");
    setShowEndpoint(p === "openai_compatible");
  };

  const handlePurposeChange = (p: Purpose) => {
    setPurpose(p);
    const presets = MODEL_PRESETS[provider] ?? { text: [], image: [] };
    const list = p === "image" ? presets.image : presets.text;
    setModelName(list[0] ?? "");
    setCustomModel("");
  };

  const effectiveModel = customModel || modelName;
  const modelPresets =
    purpose === "image"
      ? MODEL_PRESETS[provider]?.image ?? []
      : MODEL_PRESETS[provider]?.text ?? [];

  const handleCreate = () => {
    createKey.mutate(
      {
        data: {
          provider,
          purpose,
          label,
          apiKey,
          modelName: effectiveModel || undefined,
          endpointUrl: endpointUrl || DEFAULT_ENDPOINTS[provider] || undefined,
          isDefault: false,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "API key added", description: `${PROVIDER_LABELS[provider] ?? provider} key saved.` });
          setOpen(false);
          setLabel(""); setApiKey(""); setModelName(""); setCustomModel(""); setEndpointUrl("");
          refetch();
        },
        onError: () => toast({ title: "Failed to add key", variant: "destructive" }),
      }
    );
  };

  const handleTest = (id: number) => {
    testKey.mutate(
      { id },
      {
        onSuccess: (data: any) => {
          toast({
            title: data.success ? "✓ Key is valid" : "✗ Key failed",
            description: data.message,
            variant: data.success ? "default" : "destructive",
          });
          refetch();
        },
      }
    );
  };

  const handleSetActive = (id: number, label: string) => {
    setActive.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Active key updated", description: `"${label}" is now the active key for generation.` });
          refetch();
        },
        onError: () => toast({ title: "Failed to set active key", variant: "destructive" }),
      }
    );
  };

  const handleDelete = (id: number) => {
    if (!confirm("Remove this API key? Any pipeline using it will fall back to the next available key.")) return;
    deleteKey.mutate(
      { id },
      {
        onSuccess: () => { toast({ title: "API key removed" }); refetch(); },
      }
    );
  };

  // Active keys for the summary banner
  const activeText = (keys as any[]).find((k) => k.isDefault && (k.purpose === "text" || k.purpose === "both"));
  const activeImage = (keys as any[]).find((k) => k.isDefault && (k.purpose === "image" || k.purpose === "both"));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">API Manager</h1>
          <p className="text-muted-foreground mt-1">
            Choose which AI provider and model powers your content and image pipeline.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add API Key
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add API Key</DialogTitle>
              <DialogDescription>
                Configure a provider, pick a model, and set what the key is used for.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Purpose */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Used for</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["text", "image", "both"] as Purpose[]).map((p) => {
                    const meta = PURPOSE_LABELS[p];
                    const Icon = meta.icon;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => handlePurposeChange(p)}
                        className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs font-medium transition-colors ${
                          purpose === p
                            ? `${meta.bg} ${meta.color} border-current`
                            : "border-border text-muted-foreground hover:border-foreground/30"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Provider */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Provider</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={provider}
                  onChange={(e) => handleProviderChange(e.target.value)}
                >
                  {Object.entries(PROVIDER_LABELS).map(([val, lbl]) => (
                    <option key={val} value={val}>{lbl}</option>
                  ))}
                </select>
              </div>

              {/* Model */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Model</label>
                {modelPresets.length > 0 ? (
                  <div className="space-y-2">
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={modelName}
                      onChange={(e) => { setModelName(e.target.value); setCustomModel(""); }}
                    >
                      {modelPresets.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                      <option value="">— enter custom model —</option>
                    </select>
                    {modelName === "" && (
                      <Input
                        value={customModel}
                        onChange={(e) => setCustomModel(e.target.value)}
                        placeholder="e.g. gpt-4o-2024-08-06"
                      />
                    )}
                  </div>
                ) : (
                  <Input
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    placeholder="e.g. gpt-4o"
                  />
                )}
                {provider === "groq" && purpose === "image" && (
                  <p className="text-xs text-amber-500">⚠ Groq doesn't support image generation. Use OpenAI for images.</p>
                )}
              </div>

              {/* Label */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Label</label>
                <Input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder={`e.g. OpenAI Production`}
                />
              </div>

              {/* API Key */}
              <div className="space-y-2">
                <label className="text-sm font-medium">API Key</label>
                <Input
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  type="password"
                  placeholder="sk-..."
                />
              </div>

              {/* Custom Endpoint (collapsible) */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowEndpoint(!showEndpoint)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronDown className={`w-3 h-3 transition-transform ${showEndpoint ? "rotate-180" : ""}`} />
                  {showEndpoint ? "Hide" : "Custom endpoint URL"}
                </button>
                {showEndpoint && (
                  <Input
                    className="mt-2"
                    value={endpointUrl}
                    onChange={(e) => setEndpointUrl(e.target.value)}
                    placeholder="https://api.openai.com/v1"
                  />
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                onClick={handleCreate}
                disabled={!label || !apiKey || createKey.isPending}
              >
                {createKey.isPending ? "Adding…" : "Add Key"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Active pipeline banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ActiveBanner
          label="Text Generation"
          icon={Type}
          color="text-blue-500"
          bg="bg-blue-500/5 border-blue-500/20"
          activeKey={activeText}
        />
        <ActiveBanner
          label="Image Generation"
          icon={ImageIcon}
          color="text-purple-500"
          bg="bg-purple-500/5 border-purple-500/20"
          activeKey={activeImage}
        />
      </div>

      {/* Keys list */}
      {isLoading ? (
        <div className="h-48 flex items-center justify-center text-muted-foreground">Loading keys…</div>
      ) : (keys as any[]).length === 0 ? (
        <div className="text-center py-16 bg-card rounded-xl border border-dashed">
          <KeyRound className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
          <h3 className="text-lg font-semibold">No API keys yet</h3>
          <p className="text-muted-foreground mt-1 mb-4 text-sm max-w-xs mx-auto">
            Add an OpenAI, Groq, or Anthropic key and select which step of the pipeline it powers.
          </p>
          <Button onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add First Key
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {(keys as any[]).map((key) => {
            const purposeMeta = PURPOSE_LABELS[key.purpose as Purpose] ?? PURPOSE_LABELS.text;
            const PurposeIcon = purposeMeta.icon;
            return (
              <Card
                key={key.id}
                className={`flex flex-col ${key.isDefault ? "ring-2 ring-primary/40 border-primary/60" : ""}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center border shrink-0">
                        <Network className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-base truncate">
                          {PROVIDER_LABELS[key.provider] ?? key.provider}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{key.label}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {key.isDefault && (
                        <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] px-1.5 gap-1">
                          <Star className="w-2.5 h-2.5" /> Active
                        </Badge>
                      )}
                      {key.status === "active" ? (
                        <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px]">Valid</Badge>
                      ) : key.status === "error" ? (
                        <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20 text-[10px]">Error</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">Untested</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 space-y-3">
                  {/* Purpose badge */}
                  <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${purposeMeta.bg} ${purposeMeta.color}`}>
                    <PurposeIcon className="w-3 h-3" />
                    {purposeMeta.label}
                  </div>

                  {/* Key preview */}
                  <div className="bg-muted/40 p-2.5 rounded-md font-mono text-xs flex items-center gap-2">
                    <KeyRound className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">{key.keyPreview ?? "••••••••••••••••"}</span>
                  </div>

                  {/* Model */}
                  {key.modelName && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Model</span>
                      <span className="text-xs font-mono font-medium bg-muted px-2 py-0.5 rounded">{key.modelName}</span>
                    </div>
                  )}

                  {/* Endpoint */}
                  {key.endpointUrl && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground shrink-0">Endpoint</span>
                      <span className="text-[10px] font-medium truncate max-w-[160px] text-right">{key.endpointUrl}</span>
                    </div>
                  )}
                </CardContent>

                <CardFooter className="pt-3 flex items-center justify-between gap-2 border-t bg-muted/10">
                  <span className="text-[10px] text-muted-foreground">
                    Tested: {key.lastTestedAt ? formatDate(key.lastTestedAt) : "Never"}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {/* Set active */}
                    {!key.isDefault && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1 px-2"
                        onClick={() => handleSetActive(key.id, key.label)}
                        disabled={setActive.isPending}
                      >
                        <Star className="w-3 h-3" />
                        Use
                      </Button>
                    )}
                    {/* Test */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTest(key.id)}
                      className="h-7 w-7 p-0"
                      title="Test connection"
                      disabled={testKey.isPending}
                    >
                      <RefreshCw className={`w-3 h-3 ${testKey.isPending ? "animate-spin" : ""}`} />
                    </Button>
                    {/* Delete */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(key.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 w-7 p-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Active pipeline banner ─────────────────────────────────────────────────────

function ActiveBanner({
  label,
  icon: Icon,
  color,
  bg,
  activeKey,
}: {
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  activeKey: any;
}) {
  return (
    <div className={`rounded-xl border p-4 flex items-center gap-4 ${bg}`}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-background border ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        {activeKey ? (
          <>
            <p className="text-sm font-semibold truncate">
              {PROVIDER_LABELS[activeKey.provider] ?? activeKey.provider}
            </p>
            <p className="text-xs text-muted-foreground font-mono">{activeKey.modelName ?? "default model"}</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground italic">No active key — set one below</p>
        )}
      </div>
      {activeKey && (
        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
      )}
      {!activeKey && (
        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
      )}
    </div>
  );
}
