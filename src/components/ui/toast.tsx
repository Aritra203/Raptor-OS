"use client";

import * as React from "react";
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant?: "success" | "warning" | "error" | "info";
  durationMs?: number;
}

interface ToastContextValue {
  toast: (options: Omit<ToastMessage, "id">) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);

  const toast = React.useCallback(
    ({
      title,
      description,
      variant = "info",
      durationMs = 4000,
    }: Omit<ToastMessage, "id">) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: ToastMessage = { id, title, description, variant, durationMs };

      setToasts((prev) => [...prev, newToast]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, durationMs);
    },
    []
  );

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast viewport */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((t) => {
          const icons = {
            success: <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />,
            warning: <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />,
            error: <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />,
            info: <Info className="h-4 w-4 text-sky-400 shrink-0" />,
          };

          const borders = {
            success: "border-emerald-500/30 bg-surface-1",
            warning: "border-amber-500/30 bg-surface-1",
            error: "border-rose-500/30 bg-surface-1",
            info: "border-sky-500/30 bg-surface-1",
          };

          return (
            <div
              key={t.id}
              role="alert"
              className={cn(
                "pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-xl backdrop-blur-md animate-fade-in-up transition-all",
                borders[t.variant || "info"]
              )}
            >
              {icons[t.variant || "info"]}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-foreground">
                  {t.title}
                </div>
                {t.description && (
                  <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                    {t.description}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
                aria-label="Close notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    // Fallback if rendered outside provider
    return {
      toast: ({ title }: { title: string }) => console.log(`[Toast]: ${title}`),
    };
  }
  return context;
}
