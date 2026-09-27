"use client";

import * as React from "react";
import { MessageSquare, Send, Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface SubmissionCommentsProps {
  eventId: string;
  submissionId: string;
}

interface CommentItem {
  id: string;
  content: string;
  moderationStatus: "PUBLISHED" | "HIDDEN" | "REMOVED";
  createdAt: string;
  user: {
    name: string;
  };
}

export function SubmissionComments({
  eventId,
  submissionId,
}: SubmissionCommentsProps) {
  const [comments, setComments] = React.useState<CommentItem[]>([]);
  const [totalCount, setTotalCount] = React.useState<number>(0);
  const [content, setContent] = React.useState<string>("");
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [moderatingId, setModeratingId] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const loadComments = React.useCallback(async () => {
    try {
      const res = await fetch(
        `/api/events/${eventId}/submissions/${submissionId}/comments`
      );
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
        setTotalCount(data.pagination?.totalCount || 0);
      }
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  }, [eventId, submissionId]);

  React.useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch(
        `/api/events/${eventId}/submissions/${submissionId}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to post comment.");
      }

      setContent("");
      await loadComments();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to post comment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleModerate = async (commentId: string, targetStatus: "PUBLISHED" | "HIDDEN") => {
    setModeratingId(commentId);
    try {
      const res = await fetch(
        `/api/events/${eventId}/comments/${commentId}/moderate`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: targetStatus }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "Moderation failed.");
      }

      await loadComments();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Moderation failed.");
    } finally {
      setModeratingId(null);
    }
  };

  return (
    <Card className="border-border bg-card/60 shadow-sm">
      <CardHeader className="pb-4 border-b border-border/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-bold text-foreground">
              Community Discussion
            </CardTitle>
          </div>
          <Badge variant="outline" className="text-xs border-border text-muted-foreground">
            {totalCount} {totalCount === 1 ? "comment" : "comments"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-5 space-y-6">
        {/* Comment Input Form */}
        <form onSubmit={handleSubmit} className="space-y-2.5">
          {errorMessage && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="relative">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Leave constructive feedback, kudos, or questions for the team..."
              rows={3}
              maxLength={1000}
              className="w-full rounded-md border border-input bg-background p-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-y"
            />
            <div className="absolute right-2 bottom-2 text-[10px] text-muted-foreground">
              {content.length}/1000
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              Plain text only. Comments are public and moderated.
            </span>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !content.trim()}
              className="text-xs font-semibold bg-primary gap-1.5"
            >
              {isSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              <span>Post Comment</span>
            </Button>
          </div>
        </form>

        {/* Comments Feed */}
        <div className="space-y-3 pt-2">
          {isLoading ? (
            <div className="py-6 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-4 text-center">
              No comments yet. Be the first to share your thoughts on this submission!
            </p>
          ) : (
            <div className="divide-y divide-border/60">
              {comments.map((comment) => (
                <div key={comment.id} className="py-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">
                        {comment.user.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(comment.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {comment.moderationStatus === "HIDDEN" && (
                        <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30">
                          Hidden
                        </Badge>
                      )}
                    </div>

                    {/* Organizer quick moderation buttons */}
                    <div className="flex items-center gap-1.5">
                      {comment.moderationStatus === "PUBLISHED" ? (
                        <button
                          type="button"
                          onClick={() => handleModerate(comment.id, "HIDDEN")}
                          disabled={moderatingId === comment.id}
                          className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
                          title="Hide this comment from public view"
                        >
                          <EyeOff className="h-3 w-3" />
                          <span>Hide</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleModerate(comment.id, "PUBLISHED")}
                          disabled={moderatingId === comment.id}
                          className="text-[10px] text-muted-foreground hover:text-emerald-400 flex items-center gap-1 transition-colors"
                          title="Restore comment to public view"
                        >
                          <Eye className="h-3 w-3" />
                          <span>Restore</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">
                    {comment.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
