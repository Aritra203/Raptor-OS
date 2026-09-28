"use client";

import * as React from "react";
import {
  Scale,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Criterion {
  id?: string;
  name: string;
  description?: string | null;
  weight: number;
  maxScore: number;
  order: number;
}

interface RubricVersion {
  id: string;
  version: number;
  isActive: boolean;
  createdAt: string;
  criteria: Criterion[];
}

interface Rubric {
  id: string;
  name: string;
  description?: string | null;
  trackId?: string | null;
  track?: { id: string; name: string } | null;
  versions: RubricVersion[];
}

interface RubricManagerProps {
  eventId: string;
  tracks?: Array<{ id: string; name: string }>;
  isJudgingOpen?: boolean;
}

export function RubricManager({ eventId, tracks = [], isJudgingOpen: _isJudgingOpen = false }: RubricManagerProps) {
  const [rubrics, setRubrics] = React.useState<Rubric[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  // New Rubric state
  const [isCreatingRubric, setIsCreatingRubric] = React.useState(false);
  const [rubricName, setRubricName] = React.useState("");
  const [rubricDescription, setRubricDescription] = React.useState("");
  const [selectedTrackId, setSelectedTrackId] = React.useState<string>("");
  const [criteria, setCriteria] = React.useState<Criterion[]>([
    { name: "Technical Execution", description: "Architecture, code quality, stability", weight: 40, maxScore: 10, order: 0 },
    { name: "Innovation & Originality", description: "Novel approach and creativity", weight: 30, maxScore: 10, order: 1 },
    { name: "User Experience & Design", description: "UI/UX polish and usability", weight: 30, maxScore: 10, order: 2 },
  ]);

  // Version creation state for existing rubric
  const [activeRubricForVersion, setActiveRubricForVersion] = React.useState<string | null>(null);
  const [newVersionCriteria, setNewVersionCriteria] = React.useState<Criterion[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const fetchRubrics = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`/api/events/${eventId}/rubrics`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to load rubrics.");
      setRubrics(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load rubrics.");
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  React.useEffect(() => {
    fetchRubrics();
  }, [fetchRubrics]);

  // Calculate sum of weights
  const calculateWeightSum = (critList: Criterion[]): number => {
    const sum = critList.reduce((acc, c) => acc + (Number(c.weight) || 0), 0);
    return Math.round(sum * 100) / 100;
  };

  const isWeightValid = (critList: Criterion[]): boolean => {
    const sum = calculateWeightSum(critList);
    return Math.abs(sum - 100) < 0.01 || Math.abs(sum - 1.0) < 0.001;
  };

  const handleAddCriterion = (isForVersion = false) => {
    const newCrit: Criterion = {
      name: "",
      description: "",
      weight: 10,
      maxScore: 10,
      order: isForVersion ? newVersionCriteria.length : criteria.length,
    };
    if (isForVersion) {
      setNewVersionCriteria([...newVersionCriteria, newCrit]);
    } else {
      setCriteria([...criteria, newCrit]);
    }
  };

  const handleRemoveCriterion = (index: number, isForVersion = false) => {
    if (isForVersion) {
      setNewVersionCriteria(newVersionCriteria.filter((_, i) => i !== index));
    } else {
      setCriteria(criteria.filter((_, i) => i !== index));
    }
  };

  const handleCriterionChange = (
    index: number,
    field: keyof Criterion,
    val: string | number,
    isForVersion = false
  ) => {
    const updater = (list: Criterion[]) =>
      list.map((c, i) => (i === index ? { ...c, [field]: val } : c));
    if (isForVersion) {
      setNewVersionCriteria(updater(newVersionCriteria));
    } else {
      setCriteria(updater(criteria));
    }
  };

  const handleCreateRubric = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isWeightValid(criteria)) {
      setError("Criteria weights must sum to exactly 100% (or 1.00). Current sum: " + calculateWeightSum(criteria));
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      setSuccessMsg(null);

      const res = await fetch(`/api/events/${eventId}/rubrics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: rubricName,
          description: rubricDescription || undefined,
          trackId: selectedTrackId || undefined,
          criteria: criteria.map((c) => ({
            name: c.name,
            description: c.description || undefined,
            weight: Number(c.weight),
            maxScore: Number(c.maxScore),
            order: c.order,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to create rubric.");

      setSuccessMsg(`Rubric "${rubricName}" created successfully with initial version!`);
      setIsCreatingRubric(false);
      setRubricName("");
      setRubricDescription("");
      await fetchRubrics();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create rubric.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublishVersion = async (rubricId: string, versionId: string) => {
    try {
      setIsSubmitting(true);
      setError(null);
      setSuccessMsg(null);

      const res = await fetch(`/api/events/${eventId}/rubrics/${rubricId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to publish rubric version.");

      setSuccessMsg("Rubric version published successfully as active!");
      await fetchRubrics();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish version.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateVersion = async (rubricId: string) => {
    if (!isWeightValid(newVersionCriteria)) {
      setError("Version criteria weights must sum to exactly 100% (or 1.00). Current sum: " + calculateWeightSum(newVersionCriteria));
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      setSuccessMsg(null);

      const res = await fetch(`/api/events/${eventId}/rubrics/${rubricId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          criteria: newVersionCriteria.map((c) => ({
            name: c.name,
            description: c.description || undefined,
            weight: Number(c.weight),
            maxScore: Number(c.maxScore),
            order: c.order,
          })),
          activate: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to create new version.");

      setSuccessMsg("New rubric version created and activated successfully!");
      setActiveRubricForVersion(null);
      setNewVersionCriteria([]);
      await fetchRubrics();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create new version.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-400 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Scale className="h-4 w-4 text-primary" />
            Evaluation Rubrics & Criteria
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure weighted scoring criteria used by judges to evaluate hackathon submissions.
          </p>
        </div>

        {!isCreatingRubric && (
          <Button
            size="sm"
            onClick={() => {
              setIsCreatingRubric(true);
              setCriteria([
                { name: "Technical Execution", description: "Architecture, code quality, stability", weight: 40, maxScore: 10, order: 0 },
                { name: "Innovation & Originality", description: "Novel approach and creativity", weight: 30, maxScore: 10, order: 1 },
                { name: "User Experience & Design", description: "UI/UX polish and usability", weight: 30, maxScore: 10, order: 2 },
              ]);
            }}
            className="gap-1.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            New Rubric Template
          </Button>
        )}
      </div>

      {/* Rubric Creation Form */}
      {isCreatingRubric && (
        <Card className="border-primary/20 bg-card/60">
          <CardHeader>
            <CardTitle className="text-sm">Create New Rubric</CardTitle>
            <CardDescription className="text-xs">
              Define the rubric criteria and percentage weights. Total weights must sum to 100%.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateRubric} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Rubric Name *</label>
                  <Input
                    required
                    value={rubricName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRubricName(e.target.value)}
                    placeholder="e.g. Standard Hackathon Rubric"
                    className="h-8 text-xs"
                  />
                </div>

                {tracks.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Specific Track (Optional)</label>
                    <select
                      value={selectedTrackId}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedTrackId(e.target.value)}
                      className="w-full h-8 px-2 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">Global (All Tracks)</option>
                      {tracks.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Description (Optional)</label>
                <Textarea
                  value={rubricDescription}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRubricDescription(e.target.value)}
                  placeholder="Evaluation guidelines for judges..."
                  className="text-xs min-h-[60px]"
                />
              </div>

              {/* Criteria List */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <span className="text-xs font-semibold text-foreground">Evaluation Criteria</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded ${
                        isWeightValid(criteria)
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-destructive/10 text-destructive border border-destructive/20"
                      }`}
                    >
                      Total Weight: {calculateWeightSum(criteria)}% {isWeightValid(criteria) ? "✓" : "(Must be 100%)"}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleAddCriterion(false)}
                      className="h-7 text-xs gap-1"
                    >
                      <Plus className="h-3 w-3" /> Add Criterion
                    </Button>
                  </div>
                </div>

                {criteria.map((c, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-center gap-2 p-2.5 rounded-md border border-border bg-background/50">
                    <div className="flex-1 w-full sm:w-auto space-y-1">
                      <Input
                        required
                        placeholder="Criterion Name (e.g. Technical Execution)"
                        value={c.name}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          handleCriterionChange(idx, "name", e.target.value, false)
                        }
                        className="h-7 text-xs"
                      />
                      <Input
                        placeholder="Description / Guide (optional)"
                        value={c.description || ""}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          handleCriterionChange(idx, "description", e.target.value, false)
                        }
                        className="h-6 text-[11px] text-muted-foreground"
                      />
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <div className="w-20">
                        <label className="text-[10px] text-muted-foreground block">Weight (%)</label>
                        <Input
                          type="number"
                          step="any"
                          required
                          value={c.weight}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            handleCriterionChange(idx, "weight", parseFloat(e.target.value) || 0, false)
                          }
                          className="h-7 text-xs"
                        />
                      </div>

                      <div className="w-20">
                        <label className="text-[10px] text-muted-foreground block">Max Score</label>
                        <Input
                          type="number"
                          step="any"
                          required
                          value={c.maxScore}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            handleCriterionChange(idx, "maxScore", parseFloat(e.target.value) || 10, false)
                          }
                          className="h-7 text-xs"
                        />
                      </div>

                      {criteria.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveCriterion(idx, false)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive mt-3"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreatingRubric(false)}
                  disabled={isSubmitting}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting || !isWeightValid(criteria)}
                  className="text-xs gap-1.5"
                >
                  {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Save Rubric
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Existing Rubrics List */}
      {isLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rubrics.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center bg-card/30">
          <Scale className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <h4 className="text-xs font-semibold text-foreground">No Rubrics Defined</h4>
          <p className="text-[11px] text-muted-foreground max-w-sm mx-auto mt-1">
            Create an evaluation rubric with scoring criteria so judges can objectively evaluate projects.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {rubrics.map((rubric) => {
            const activeVersion = rubric.versions.find((v) => v.isActive) || rubric.versions[0];

            return (
              <Card key={rubric.id} className="border-border bg-card/60">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-sm font-bold text-foreground">{rubric.name}</CardTitle>
                        {rubric.track ? (
                          <Badge variant="outline" className="text-[10px]">
                            Track: {rubric.track.name}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">
                            Global Event Rubric
                          </Badge>
                        )}
                        {activeVersion && (
                          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">
                            Active v{activeVersion.version}
                          </Badge>
                        )}
                      </div>
                      {rubric.description && (
                        <CardDescription className="text-xs mt-1">{rubric.description}</CardDescription>
                      )}
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setActiveRubricForVersion(
                          activeRubricForVersion === rubric.id ? null : rubric.id
                        );
                        if (activeVersion) {
                          setNewVersionCriteria(
                            activeVersion.criteria.map((c) => ({
                              name: c.name,
                              description: c.description,
                              weight: Number(c.weight),
                              maxScore: Number(c.maxScore),
                              order: c.order,
                            }))
                          );
                        }
                      }}
                      className="text-xs h-7"
                    >
                      {activeRubricForVersion === rubric.id ? "Close Versioning" : "New Version"}
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 text-xs">
                  {/* Active Criteria Display */}
                  {activeVersion && (
                    <div className="rounded-md border border-border bg-background/40 overflow-hidden">
                      <div className="bg-muted/40 px-3 py-2 border-b border-border flex justify-between items-center text-[11px] font-semibold text-muted-foreground">
                        <span>Active Version {activeVersion.version} Criteria ({activeVersion.criteria.length})</span>
                        <span>Total Weight: {calculateWeightSum(activeVersion.criteria)}%</span>
                      </div>
                      <div className="divide-y divide-border">
                        {activeVersion.criteria.map((c, i) => (
                          <div key={i} className="px-3 py-2 flex items-center justify-between">
                            <div>
                              <span className="font-medium text-foreground block">{c.name}</span>
                              {c.description && (
                                <span className="text-[11px] text-muted-foreground block">{c.description}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-[11px]">
                              <span className="text-muted-foreground">Max Score: <strong className="text-foreground">{c.maxScore}</strong></span>
                              <Badge variant="outline" className="font-mono text-[10px]">
                                Weight: {c.weight}%
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Version History List */}
                  {rubric.versions.length > 1 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-medium text-muted-foreground block">
                        Version History ({rubric.versions.length} versions)
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {rubric.versions.map((v) => (
                          <div
                            key={v.id}
                            className={`flex items-center gap-2 px-2.5 py-1 rounded border text-[11px] ${
                              v.isActive
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                : "bg-muted/40 text-muted-foreground border-border"
                            }`}
                          >
                            <span>Version {v.version}</span>
                            {v.isActive ? (
                              <Badge className="bg-emerald-500/20 text-emerald-400 text-[9px] px-1 py-0 h-3.5">
                                Active
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handlePublishVersion(rubric.id, v.id)}
                                disabled={isSubmitting}
                                className="h-4 px-1 text-[10px] text-primary hover:text-primary underline"
                              >
                                Make Active
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Inline Form to create new Version for this Rubric */}
                  {activeRubricForVersion === rubric.id && (
                    <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-3 mt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">
                          Create Rubric Version {rubric.versions.length + 1}
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[11px] font-medium px-2 py-0.5 rounded ${
                              isWeightValid(newVersionCriteria)
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "bg-destructive/10 text-destructive"
                            }`}
                          >
                            Total: {calculateWeightSum(newVersionCriteria)}% {isWeightValid(newVersionCriteria) ? "✓" : "(Need 100%)"}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleAddCriterion(true)}
                            className="h-6 text-[11px] gap-1"
                          >
                            <Plus className="h-3 w-3" /> Add
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {newVersionCriteria.map((c, idx) => (
                          <div key={idx} className="flex items-center gap-2 bg-background/80 p-2 rounded border border-border">
                            <Input
                              placeholder="Criterion name"
                              value={c.name}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                handleCriterionChange(idx, "name", e.target.value, true)
                              }
                              className="h-6 text-xs flex-1"
                            />
                            <div className="w-16">
                              <Input
                                type="number"
                                placeholder="Weight"
                                value={c.weight}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                  handleCriterionChange(idx, "weight", parseFloat(e.target.value) || 0, true)
                                }
                                className="h-6 text-xs"
                              />
                            </div>
                            <div className="w-16">
                              <Input
                                type="number"
                                placeholder="Max"
                                value={c.maxScore}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                  handleCriterionChange(idx, "maxScore", parseFloat(e.target.value) || 10, true)
                                }
                                className="h-6 text-xs"
                              />
                            </div>
                            {newVersionCriteria.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveCriterion(idx, true)}
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setActiveRubricForVersion(null)}
                          className="h-7 text-xs"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleCreateVersion(rubric.id)}
                          disabled={isSubmitting || !isWeightValid(newVersionCriteria)}
                          className="h-7 text-xs"
                        >
                          {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Publish New Version"}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
