/* SPDX-License-Identifier: MIT
 * Copyright (c) 2026 AC.
 * Source: https://github.com/annac777/xi4u @ 336d2a38ed8c170a4599493f1bc20c6c1ef7962c, app/scene-transition.ts
 * Reproducible typed-syntax removal and documented local integration edits: ../sync-vendor.mjs, ../README.md.
 */
function createSceneTransition({ host, canvas }) {
  const defaultDuration = 0.4;
  let duration = defaultDuration;
  let overlay = null, scratch = null;
  let context = null, scratchContext = null;
  let active = false, disposed = false, elapsed = 0, opacity = 0, liveOpacity = 1;
  const originalWillChange = canvas?.style?.willChange ?? "";
  const doc = host?.ownerDocument ?? canvas?.ownerDocument ?? (typeof document !== "undefined" ? document : null);
  let motion = null;
  try {
    const view = doc?.defaultView ?? (typeof window !== "undefined" ? window : null);
    motion = view?.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;
  } catch {
  }
  function context2D(surface) {
    try {
      const ctx = surface?.getContext?.("2d", { alpha: true });
      return ctx && typeof ctx.clearRect === "function" && typeof ctx.drawImage === "function" ? ctx : null;
    } catch {
      return null;
    }
  }
  function clear(ctx, w, h) {
    ctx.setTransform?.(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, w, h);
  }
  function ensure() {
    if (overlay && context) return true;
    if (!doc?.createElement || typeof host?.appendChild !== "function") return false;
    try {
      const layer = doc.createElement("canvas"), ctx = context2D(layer);
      if (!ctx || !layer.style) return false;
      layer.setAttribute?.("aria-hidden", "true");
      layer.setAttribute?.("data-scene-transition", "");
      Object.assign(layer.style, { position: "absolute", left: "0", top: "0", width: "100%", height: "100%", display: "none", opacity: "0", pointerEvents: "none", zIndex: "1", imageRendering: "pixelated", background: "transparent", transition: "none" });
      layer.width = layer.height = 1;
      host.appendChild(layer);
      overlay = layer;
      context = ctx;
      return true;
    } catch {
      return false;
    }
  }
  function cancel() {
    active = false;
    elapsed = 0;
    opacity = 0;
    liveOpacity = 1;
    if (canvas?.style) {
      canvas.style.opacity = "1";
      canvas.style.willChange = originalWillChange;
    }
    if (overlay) {
      overlay.style.display = "none";
      overlay.style.opacity = "0";
      overlay.style.willChange = "auto";
      if (overlay.width !== 1 || overlay.height !== 1) overlay.width = overlay.height = 1;
    }
    if (scratch && (scratch.width !== 1 || scratch.height !== 1)) scratch.width = scratch.height = 1;
  }
  function capture(seconds = defaultDuration) {
    duration = Number.isFinite(seconds) && seconds > 0 ? seconds : defaultDuration;
    if (disposed || motion?.matches) {
      cancel();
      return false;
    }
    const w = canvas?.width, h = canvas?.height;
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
      cancel();
      return false;
    }
    if (!canvas?.style || !ensure()) return false;
    try {
      const continuing = active && opacity > 0 && overlay.width === w && overlay.height === h;
      if (continuing) {
        if (!scratch) {
          scratch = doc.createElement("canvas");
          scratchContext = context2D(scratch);
        }
        if (!scratchContext) {
          cancel();
          return false;
        }
        if (scratch.width !== w) scratch.width = w;
        if (scratch.height !== h) scratch.height = h;
        clear(scratchContext, w, h);
        scratchContext.globalAlpha = liveOpacity;
        scratchContext.drawImage(canvas, 0, 0);
        scratchContext.globalAlpha = opacity;
        scratchContext.drawImage(overlay, 0, 0);
        scratchContext.globalAlpha = 1;
        clear(context, w, h);
        context.drawImage(scratch, 0, 0);
      } else {
        if (overlay.width !== w) overlay.width = w;
        if (overlay.height !== h) overlay.height = h;
        clear(context, w, h);
        context.drawImage(canvas, 0, 0);
      }
      const cssWidth = canvas.offsetWidth || canvas.clientWidth || host.clientWidth, cssHeight = canvas.offsetHeight || canvas.clientHeight || host.clientHeight;
      overlay.style.left = `${canvas.offsetLeft || 0}px`;
      overlay.style.top = `${canvas.offsetTop || 0}px`;
      overlay.style.width = cssWidth > 0 ? `${cssWidth}px` : "100%";
      overlay.style.height = cssHeight > 0 ? `${cssHeight}px` : "100%";
      overlay.style.imageRendering = canvas.style.imageRendering || "auto";
      active = true;
      elapsed = 0;
      opacity = 1;
      liveOpacity = 1;
      canvas.style.opacity = "1";
      overlay.style.opacity = "1";
      overlay.style.display = "block";
      overlay.style.willChange = "opacity";
      return true;
    } catch {
      cancel();
      return false;
    }
  }
  function update(dt) {
    if (disposed || !active) return;
    if (motion?.matches || canvas.width !== overlay.width || canvas.height !== overlay.height) {
      cancel();
      return;
    }
    if (!Number.isFinite(dt) || dt <= 0) return;
    elapsed = Math.min(duration, elapsed + dt);
    const t = elapsed / duration;
    liveOpacity = 1;
    opacity = 1 - t * t * (3 - 2 * t);
    canvas.style.opacity = "1";
    overlay.style.opacity = String(opacity);
    if (elapsed >= duration) cancel();
  }
  function dispose() {
    if (disposed) return;
    cancel();
    disposed = true;
    overlay?.remove?.();
    overlay = null;
    scratch = null;
    context = null;
    scratchContext = null;
  }
  return { capture, update, cancel, dispose };
}
export {
  createSceneTransition
};
