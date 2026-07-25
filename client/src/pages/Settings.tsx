import { useGetSettings, useUpdateSettings } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Save, FileText, Zap, Settings2 } from "lucide-react";
import { useState, useEffect } from "react";

const DEFAULT_WRITING_PROMPT = `# Expert SEO Blog Writing Prompt

Write a comprehensive, expert-level blog post targeting the primary keyword:

**Primary Keyword:** "[INSERT KEYWORD]"

Your objective is to create the single most valuable resource on this topic that can outperform every page currently ranking on Google's first page.

## Research Requirements

Before writing, perform a complete SERP analysis for the target keyword.

Analyze the top-ranking pages and identify:

* Search intent
* Content gaps
* Questions users are asking
* Common subtopics
* Missing information competitors fail to explain
* Opportunities to provide deeper expertise
* Semantic keywords and related entities
* People Also Ask questions
* Relevant long-tail keywords
* Supporting NLP terms

Create a significantly better article than every competitor in terms of:

* Content depth
* Topical authority
* Practical value
* Expert insights
* Readability
* User experience
* Trustworthiness

Do not copy competitor content. Use it only to understand the topic and produce a superior resource.

---

# Content Requirements

The article must be:

* 100 percent original
* Completely plagiarism free
* Written naturally by an experienced professional content writer
* Human sounding
* Formal and authoritative
* Free from robotic language
* Free from filler
* Free from keyword stuffing
* Free from repetitive wording
* Free from generic AI phrases
* Easy to read
* Rich in useful information
* Based on facts wherever possible

Every paragraph should provide genuine value.

Never write unnecessary introductory paragraphs.

Avoid writing obvious information simply to increase word count.

---

# Google SEO Requirements

Write according to Google's latest guidelines including:

* Helpful Content System
* E E A T
* Search Quality Evaluator Guidelines
* AI Overview optimization
* Semantic SEO
* Topical authority
* Entity optimization
* Natural keyword placement

The article should satisfy both traditional search rankings and Google's AI-generated search results.

---

# Writing Style

Use:

* Short sentences
* Short paragraphs
* Active voice
* Professional English
* Natural transitions
* Clear explanations
* Industry terminology explained in simple language

Write like an experienced subject matter expert.

Do not sound like AI.

Avoid overusing words such as: Additionally, Furthermore, Moreover, In today's world, In conclusion, Unlock, Elevate, Delve, Game changer, Cutting edge, Revolutionary, Seamless, Leverage, Whether you are, It is important to note, Without further ado.

---

# Formatting

Use a logical heading structure.

Include:

* One H1
* Optimized H2 sections
* H3 headings where needed

Use:

* Tables only where they improve understanding
* Bullet lists only when appropriate
* Numbered steps where applicable
* Comparison charts
* Checklists
* Examples
* Real world scenarios

Never force tables or lists.

---

# Semantic SEO

Naturally include:

* Primary keyword
* Secondary keywords
* Related entities
* Synonyms
* Contextual phrases
* Question based keywords

Do not keyword stuff. Maintain natural readability.

---

# FAQ Section

Create an FAQ based on:

* Google's People Also Ask
* Related Searches
* Real user intent
* Long-tail search queries

Provide concise yet complete answers.

---

# Final Quality Checklist

Before finalizing, ensure that:

* The article is more comprehensive than every top-ranking competitor.
* Every section adds unique value.
* No fluff exists.
* No repetitive information exists.
* The article is fully optimized for Google Search and AI Overview.
* The content demonstrates strong E E A T signals.
* The article reads as if written entirely by an experienced human writer.
* Grammar and spelling are perfect.
* Formatting is clean and highly readable.
* The content is fully unique.
* The article contains no AI-style filler or repetitive language.`;

export default function Settings() {
  const { data: settings, isLoading } = useGetSettings({ query: { enabled: true, queryKey: ['settings'] }});
  const updateSettings = useUpdateSettings();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    writingTone: 'professional',
    defaultLanguage: 'en',
    defaultWordCount: 1500,
    autoHumanize: true,
    autoSeo: true,
    autoPublish: false,
    writingPrompt: DEFAULT_WRITING_PROMPT,
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        writingTone: settings.writingTone || 'professional',
        defaultLanguage: settings.defaultLanguage || 'en',
        defaultWordCount: settings.defaultWordCount || 1500,
        autoHumanize: settings.autoHumanize ?? true,
        autoSeo: settings.autoSeo ?? true,
        autoPublish: settings.autoPublish ?? false,
        writingPrompt: settings.writingPrompt || DEFAULT_WRITING_PROMPT,
      });
    }
  }, [settings]);

  const handleSave = () => {
    updateSettings.mutate({ 
      data: {
        writingTone: formData.writingTone,
        defaultLanguage: formData.defaultLanguage,
        defaultWordCount: Number(formData.defaultWordCount),
        autoHumanize: formData.autoHumanize,
        autoSeo: formData.autoSeo,
        autoPublish: formData.autoPublish,
        writingPrompt: formData.writingPrompt,
      }
    }, {
      onSuccess: () => {
        toast({ title: "Settings saved successfully" });
      }
    });
  };

  const handleResetPrompt = () => {
    setFormData(prev => ({ ...prev, writingPrompt: DEFAULT_WRITING_PROMPT }));
    toast({ title: "Writing prompt reset to default" });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">Global workspace configuration for content generation and publishing.</p>
        </div>
        <Button onClick={handleSave} disabled={updateSettings.isPending || isLoading} className="gap-2">
          <Save className="w-4 h-4" />
          Save Changes
        </Button>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Loading settings...</div>
      ) : (
        <div className="grid gap-6">
          {/* Content Generation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="w-4 h-4" />
                Content Generation
              </CardTitle>
              <CardDescription>Default parameters applied to every writing job.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Default Tone</label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={formData.writingTone}
                    onChange={(e) => setFormData({...formData, writingTone: e.target.value})}
                  >
                    <option value="formal">Formal</option>
                    <option value="professional">Professional</option>
                    <option value="conversational">Conversational</option>
                    <option value="academic">Academic</option>
                    <option value="journalistic">Journalistic</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Language</label>
                  <Input 
                    value={formData.defaultLanguage} 
                    onChange={e => setFormData({...formData, defaultLanguage: e.target.value})}
                    placeholder="en"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Target Word Count</label>
                  <Input 
                    type="number" 
                    value={formData.defaultWordCount}
                    onChange={e => setFormData({...formData, defaultWordCount: Number(e.target.value)})}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Writing Agent Prompt */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Writing Agent System Prompt
                  </CardTitle>
                  <CardDescription className="mt-1">
                    This prompt is sent to the AI writing agent with every article generation request. 
                    It defines quality standards, SEO requirements, and writing style for all content.
                    When an LLM API key is connected, this prompt is used verbatim.
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={handleResetPrompt} className="ml-4 shrink-0">
                  Reset to Default
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <textarea
                className="w-full h-96 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
                value={formData.writingPrompt}
                onChange={e => setFormData({...formData, writingPrompt: e.target.value})}
                placeholder="Enter your writing agent system prompt..."
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground mt-2">
                Use <code className="bg-muted px-1 rounded">[INSERT KEYWORD]</code> as a placeholder — it will be replaced with the actual keyword before sending to the AI model.
              </p>
            </CardContent>
          </Card>

          {/* Automation Toggles */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Automation
              </CardTitle>
              <CardDescription>Control which pipeline steps run automatically.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { key: 'autoHumanize' as const, label: 'Auto-Humanize', desc: 'Run content through humanization after writing' },
                  { key: 'autoSeo' as const, label: 'Auto-SEO Optimize', desc: 'Automatically inject NLP keywords and schema markup' },
                  { key: 'autoPublish' as const, label: 'Auto-Publish', desc: 'Send completed articles to publishing queue instantly' },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between p-3 border rounded-md">
                    <div>
                      <div className="font-medium text-sm">{label}</div>
                      <div className="text-xs text-muted-foreground">{desc}</div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={formData[key]}
                      onClick={() => setFormData(prev => ({ ...prev, [key]: !prev[key] }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${formData[key] ? 'bg-primary' : 'bg-muted'}`}
                    >
                      <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${formData[key] ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
