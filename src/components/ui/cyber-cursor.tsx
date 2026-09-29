"use client";

import * as React from "react";

/**
 * CyberCursor
 *
 * High-performance, GPU-accelerated interactive cyberpunk cursor reticle.
 * - Smooth trailing physics (interpolated lerp).
 * - Instant precision center dot (zero lag).
 * - Interactive hover states (locks onto clickable buttons, links, inputs).
 * - Click ripples and tactical corner crosshair ticks.
 * - Auto-disabled on touch devices & respects prefers-reduced-motion.
 * - Theme-reactive (Neon Cyan in Dark Mode, Electric Royal Blue in Light Mode).
 */
export function CyberCursor() {
  const [enabled, setEnabled] = React.useState(false);
  const [isHovering, setIsHovering] = React.useState(false);
  const [isClicked, setIsClicked] = React.useState(false);
  const [isVisible, setIsVisible] = React.useState(false);

  const dotRef = React.useRef<HTMLDivElement | null>(null);
  const ringRef = React.useRef<HTMLDivElement | null>(null);

  const mousePos = React.useRef({ x: -100, y: -100 });
  const ringPos = React.useRef({ x: -100, y: -100 });
  const animFrameId = React.useRef<number>(0);

  React.useEffect(() => {
    // Only enable on desktop with fine pointer (mouse/trackpad)
    if (typeof window === "undefined") return;
    const hasFinePointer = window.matchMedia("(pointer: fine)").matches;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!hasFinePointer || prefersReducedMotion) {
      return;
    }

    setEnabled(true);

    const onMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
      setIsVisible(true);

      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      }

      // Check if hovering over interactive element
      const target = e.target as HTMLElement | null;
      if (target) {
        const isInteractive = Boolean(
          target.closest(
            'a, button, input, textarea, select, [role="button"], [tabindex="0"], label, summary, .cursor-pointer'
          )
        );
        setIsHovering(isInteractive);
      }
    };

    const onMouseDown = () => setIsClicked(true);
    const onMouseUp = () => setIsClicked(false);
    const onMouseLeave = () => setIsVisible(false);
    const onMouseEnter = () => setIsVisible(true);

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("mousedown", onMouseDown, { passive: true });
    window.addEventListener("mouseup", onMouseUp, { passive: true });
    document.addEventListener("mouseleave", onMouseLeave, { passive: true });
    document.addEventListener("mouseenter", onMouseEnter, { passive: true });

    // Smooth lerp loop for the outer reticle
    const render = () => {
      const lerp = 0.18;
      ringPos.current.x += (mousePos.current.x - ringPos.current.x) * lerp;
      ringPos.current.y += (mousePos.current.y - ringPos.current.y) * lerp;

      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ringPos.current.x}px, ${ringPos.current.y}px, 0)`;
      }

      animFrameId.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("mouseenter", onMouseEnter);
      cancelAnimationFrame(animFrameId.current);
    };
  }, []);

  if (!enabled) return null;

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-[9999] overflow-hidden transition-opacity duration-300 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden="true"
    >
      {/* 1. Instant Precision Center Dot */}
      <div
        ref={dotRef}
        className="fixed top-0 left-0 -ml-[3px] -mt-[3px] h-[6px] w-[6px] rounded-full bg-cyan-400 dark:bg-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.8)] transition-transform duration-75 ease-out"
        style={{
          transform: "translate3d(-100px, -100px, 0)",
          willChange: "transform",
        }}
      />

      {/* 2. Smooth Interpolated Reticle */}
      <div
        ref={ringRef}
        className="fixed top-0 left-0 -ml-5 -mt-5 h-10 w-10 will-change-transform"
        style={{
          transform: "translate3d(-100px, -100px, 0)",
        }}
      >
        <div
          className={`relative h-full w-full transition-all duration-200 ease-out ${
            isHovering
              ? "scale-125 rotate-45 text-amber-500 dark:text-amber-400"
              : isClicked
              ? "scale-75 text-rose-500 dark:text-rose-400"
              : "scale-100 text-sky-600 dark:text-cyan-400"
          }`}
        >
          {/* Outer circle */}
          <div
            className={`absolute inset-0 rounded-full border border-current transition-all duration-200 ${
              isHovering
                ? "border-amber-500/80 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.35)]"
                : isClicked
                ? "border-rose-500/90 bg-rose-500/20 shadow-[0_0_12px_rgba(244,63,94,0.45)]"
                : "border-sky-600/40 dark:border-cyan-400/40 shadow-[0_0_10px_rgba(6,182,212,0.2)]"
            }`}
          />

          {/* Tactical Crosshair Ticks */}
          {/* Top */}
          <div className="absolute top-0 left-1/2 -ml-[1px] -mt-1 h-1.5 w-[2px] bg-current" />
          {/* Bottom */}
          <div className="absolute bottom-0 left-1/2 -ml-[1px] -mb-1 h-1.5 w-[2px] bg-current" />
          {/* Left */}
          <div className="absolute top-1/2 left-0 -mt-[1px] -ml-1 h-[2px] w-1.5 bg-current" />
          {/* Right */}
          <div className="absolute top-1/2 right-0 -mt-[1px] -mr-1 h-[2px] w-1.5 bg-current" />
        </div>
      </div>
    </div>
  );
}
