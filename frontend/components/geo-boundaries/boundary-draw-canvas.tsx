"use client";

import { lassoScreenToGeoPolygon } from "@/lib/boundary-lasso-geo";
import { hexToRgba } from "@/lib/geo-boundary-colors";
import type { GeoBoundaryPoint } from "@/lib/geo-boundaries-types";
import type { VisitMapControls } from "@/components/clients/visit-planner/visit-planner-yandex-map";
import { useCallback, useEffect, useRef, type RefObject } from "react";

type Props = {
  active: boolean;
  strokeColor: string;
  containerRef: RefObject<HTMLElement | null>;
  controlsRef: RefObject<VisitMapControls | null>;
  onComplete: (points: GeoBoundaryPoint[]) => void;
  onDrawProgress?: (pointCount: number) => void;
};

export function BoundaryDrawCanvas({
  active,
  strokeColor,
  containerRef,
  controlsRef,
  onComplete,
  onDrawProgress
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const pointsRef = useRef<{ x: number; y: number }[]>([]);

  const getCtx = useCallback(() => canvasRef.current?.getContext("2d") ?? null, []);

  const clearCanvas = useCallback(() => {
    const ctx = getCtx();
    const cv = canvasRef.current;
    if (ctx && cv) ctx.clearRect(0, 0, cv.width, cv.height);
  }, [getCtx]);

  const resizeCanvas = useCallback(() => {
    const cv = canvasRef.current;
    const root = containerRef.current;
    if (!cv || !root) return;
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth || root.clientWidth;
    const h = cv.clientHeight || root.clientHeight;
    if (w === 0 || h === 0) return;
    cv.width = w * dpr;
    cv.height = h * dpr;
    cv.style.width = `${w}px`;
    cv.style.height = `${h}px`;
    const ctx = cv.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, [containerRef]);

  const drawShape = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    clearCanvas();
    const pts = pointsRef.current;
    if (pts.length < 2) return;
    ctx.save();
    ctx.lineWidth = 3;
    ctx.strokeStyle = strokeColor;
    ctx.fillStyle = hexToRgba(strokeColor, 0.18);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(pts[0]!.x, pts[0]!.y);
    for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
    if (pts.length >= 3) ctx.closePath();
    if (pts.length >= 3) ctx.fill();
    ctx.stroke();
    ctx.restore();
  }, [getCtx, clearCanvas, strokeColor]);

  const canvasPoint = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) };
  }, []);

  const finishDraw = useCallback(() => {
    const pts = pointsRef.current;
    drawingRef.current = false;
    clearCanvas();
    if (pts.length < 3) return;

    const unproject = controlsRef.current?.unproject;
    if (!unproject) return;

    const geo = lassoScreenToGeoPolygon(pts, unproject);
    if (geo.length >= 3) {
      onComplete(geo);
    }
    pointsRef.current = [];
    onDrawProgress?.(0);
  }, [clearCanvas, controlsRef, onComplete, onDrawProgress]);

  useEffect(() => {
    if (!active) {
      drawingRef.current = false;
      pointsRef.current = [];
      clearCanvas();
      return;
    }
    controlsRef.current?.setLassoActive(true);
    return () => {
      controlsRef.current?.setLassoActive(false);
    };
  }, [active, clearCanvas, controlsRef]);

  useEffect(() => {
    resizeCanvas();
    const raf = requestAnimationFrame(resizeCanvas);
    const root = containerRef.current;
    const ro = root && typeof ResizeObserver !== "undefined" ? new ResizeObserver(resizeCanvas) : null;
    if (ro && root) ro.observe(root);
    window.addEventListener("resize", resizeCanvas);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [resizeCanvas, containerRef, active]);

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.code === "Escape") {
        drawingRef.current = false;
        pointsRef.current = [];
        clearCanvas();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [active, clearCanvas]);

  return (
    <canvas
      ref={canvasRef}
      className={`vp-canvas${active ? " vp-active" : ""}`}
      aria-hidden={!active}
      onMouseDown={(e) => {
        if (!active) return;
        resizeCanvas();
        drawingRef.current = true;
        pointsRef.current = [canvasPoint(e.clientX, e.clientY)];
        onDrawProgress?.(1);
        drawShape();
      }}
      onMouseMove={(e) => {
        if (!active || !drawingRef.current) return;
        pointsRef.current.push(canvasPoint(e.clientX, e.clientY));
        onDrawProgress?.(pointsRef.current.length);
        drawShape();
      }}
      onMouseUp={() => {
        if (!active || !drawingRef.current) return;
        finishDraw();
      }}
      onMouseLeave={() => {
        if (active && drawingRef.current) finishDraw();
      }}
    />
  );
}
