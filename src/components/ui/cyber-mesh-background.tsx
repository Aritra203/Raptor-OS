"use client";

import * as React from "react";

interface CyberMeshBackgroundProps {
  className?: string;
}

/**
 * CyberMeshBackground
 *
 * High-performance, GPU-friendly 3D wireframe wave mesh.
 * - In Dark Mode: Deep cybernetic aesthetic with vibrant cyan/pink vectors,
 *   CRT scanlines, and periodic radar sweep beam (dogfood style).
 * - In Light Mode: Vibrant Technical Blueprint Mesh with high-contrast electric blue
 *   wireframe lines, glowing cyber-amber nodes, and radiant ambient illumination.
 */
export function CyberMeshBackground({ className = "" }: CyberMeshBackgroundProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [isDark, setIsDark] = React.useState(true);

  // Monitor document class changes to react instantly to theme toggling
  React.useEffect(() => {
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };
    checkDark();

    const observer = new MutationObserver(() => {
      checkDark();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;
    let mouseX = 0;
    let mouseY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;
    let time = 0;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const handleResize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.scale(dpr, dpr);
    };

    handleResize();
    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(container);

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      targetMouseX = (e.clientX - rect.left - width / 2) / (width / 2);
      targetMouseY = (e.clientY - rect.top - height / 2) / (height / 2);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    // Grid resolution
    const COLS = 26;
    const ROWS = 16;

    // Theme-tailored color tokens:
    // Dark mode: neon cyan + hot pink
    // Light mode: high-contrast electric blue + cyber amber (bold blueprint)
    const wireColor = isDark ? "rgba(6, 182, 212, 0.45)" : "rgba(37, 99, 235, 0.42)";
    const accentColor = isDark ? "rgba(244, 63, 94, 0.55)" : "rgba(217, 119, 6, 0.65)";
    const nodeColor1 = isDark ? "rgba(0, 229, 208, 0.95)" : "rgba(29, 78, 216, 0.90)";
    const nodeColor2 = isDark ? "rgba(255, 61, 110, 0.95)" : "rgba(245, 158, 11, 0.95)";

    const render = () => {
      time += 0.014;

      mouseX += (targetMouseX - mouseX) * 0.05;
      mouseY += (targetMouseY - mouseY) * 0.05;

      ctx.clearRect(0, 0, width, height);

      const fov = 340;
      const cameraY = 165 + mouseY * 35;
      const cameraZ = -190;
      const rotationX = 0.52 + mouseY * 0.07;
      const rotationY = mouseX * 0.12;

      const cosX = Math.cos(rotationX);
      const sinX = Math.sin(rotationX);
      const cosY = Math.cos(rotationY);
      const sinY = Math.sin(rotationY);

      const cellW = (width * 1.5) / COLS;
      const cellH = (height * 1.8) / ROWS;
      const startX = -((COLS * cellW) / 2);
      const startZ = 40;

      const points: Array<Array<{ x: number; y: number; z: number; visible: boolean }>> = [];

      for (let r = 0; r <= ROWS; r++) {
        points[r] = [];
        for (let c = 0; c <= COLS; c++) {
          const worldX = startX + c * cellW;
          const worldZ = startZ + r * cellH;

          const distFromCenter = Math.sqrt(worldX * worldX + worldZ * worldZ) * 0.004;
          const wave1 = Math.sin(c * 0.35 + time * 1.2) * 22;
          const wave2 = Math.cos(r * 0.45 + time * 0.9) * 18;
          const ripple = Math.sin(distFromCenter * 5 - time * 1.5) * 14;
          const worldY = wave1 + wave2 + ripple;

          const relX = worldX;
          const relY = worldY - cameraY;
          const relZ = worldZ - cameraZ;

          const x1 = relX * cosY - relZ * sinY;
          const z1 = relX * sinY + relZ * cosY;

          const y2 = relY * cosX - z1 * sinX;
          const z2 = relY * sinX + z1 * cosX;

          const rowPoints = points[r];
          if (rowPoints) {
            if (z2 <= 20) {
              rowPoints[c] = { x: 0, y: 0, z: z2, visible: false };
            } else {
              const scale = fov / z2;
              const projX = width / 2 + x1 * scale;
              const projY = height / 2 + y2 * scale;
              // Keep points inside visible frame with slight padding
              const visible = projY >= -10 && projY <= height + 30;
              rowPoints[c] = { x: projX, y: projY, z: z2, visible };
            }
          }
        }
      }

      ctx.lineWidth = isDark ? 1.0 : 1.2;

      for (let r = 0; r <= ROWS; r++) {
        const row = points[r];
        if (!row) continue;
        const nextRow = points[r + 1];

        for (let c = 0; c <= COLS; c++) {
          const p = row[c];
          if (!p || !p.visible) continue;

          // Horizontal segment
          if (c < COLS) {
            const pRight = row[c + 1];
            if (pRight && pRight.visible) {
              const alphaMultiplier = isDark ? 0.48 : 0.65;
              const alpha = Math.max(0.04, Math.min(alphaMultiplier, 1 - p.z / 950));
              ctx.strokeStyle = r % 4 === 0 ? accentColor : wireColor;
              ctx.globalAlpha = alpha;
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(pRight.x, pRight.y);
              ctx.stroke();
            }
          }

          // Vertical segment
          if (r < ROWS && nextRow) {
            const pDown = nextRow[c];
            if (pDown && pDown.visible) {
              const alphaMultiplier = isDark ? 0.48 : 0.65;
              const alpha = Math.max(0.04, Math.min(alphaMultiplier, 1 - p.z / 950));
              ctx.strokeStyle = c % 4 === 0 ? accentColor : wireColor;
              ctx.globalAlpha = alpha;
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(pDown.x, pDown.y);
              ctx.stroke();
            }
          }

          // Intersection point dots — only render when within visible canvas
          if (r % 2 === 0 && c % 2 === 0 && p.z < 650 && p.y > 5 && p.y < height - 5) {
            const nodeAlpha = Math.max(0.15, Math.min(isDark ? 0.85 : 0.90, 1 - p.z / 720));
            ctx.fillStyle = c % 4 === 0 ? nodeColor2 : nodeColor1;
            ctx.globalAlpha = nodeAlpha;
            ctx.beginPath();
            ctx.arc(p.x, p.y, isDark ? 1.5 : 1.7, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      ctx.globalAlpha = 1.0;

      if (!prefersReducedMotion) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [isDark]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 overflow-hidden pointer-events-none select-none z-0 ${className}`}
      aria-hidden="true"
    >
      {/* Radiant Ambient Aura in Light Mode / Cyber Glow in Dark Mode */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_55%_at_60%_30%,rgba(37,99,235,0.08),rgba(245,158,11,0.06),transparent_75%)] dark:bg-[radial-gradient(ellipse_75%_55%_at_60%_30%,rgba(0,229,208,0.12),rgba(255,42,133,0.08),transparent_75%)]" />

      {/* 3D Wave Wireframe Canvas: High opacity for both light and dark mode */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block w-full h-full opacity-85 dark:opacity-90 transition-opacity duration-300"
      />

      {/* Blueprint Grid Overlay: High-contrast technical cyan/blue in light mode, cyan in dark mode */}
      <div
        className="absolute inset-0 opacity-20 dark:opacity-25"
        style={{
          backgroundImage: isDark
            ? `linear-gradient(to right, rgba(0, 229, 208, 0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(0, 229, 208, 0.18) 1px, transparent 1px)`
            : `linear-gradient(to right, rgba(37, 99, 235, 0.14) 1px, transparent 1px), linear-gradient(to bottom, rgba(37, 99, 235, 0.14) 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />

      {/* Retro CRT Scanlines — STRICTLY DARK MODE ONLY */}
      <div
        className="absolute inset-0 hidden dark:block opacity-25"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 0, 0, 0.5) 3px, rgba(0, 0, 0, 0.5) 4px)",
        }}
      />

      {/* Radar CRT Sweep Beam Animation — DARK MODE ONLY */}
      <div className="absolute left-0 right-0 top-0 h-28 pointer-events-none hidden dark:block opacity-45 bg-gradient-to-b from-transparent via-cyan-500/10 to-rose-500/15 animate-radar-sweep" />

      {/* Vignette Edge Falloff: Fades smoothly into card background around the terminal */}
      <div className="absolute inset-0 bg-gradient-to-t from-card via-card/25 to-transparent opacity-80 dark:opacity-85" />
    </div>
  );
}
