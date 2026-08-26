import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

/**
 * Horizontal day rail: scroll-snap panels, one per calendar day, centred on a
 * chosen index.
 *
 * Two things here are easy to get wrong and were both wrong once:
 *
 * 1. The ref MUST be attached to an element that generates a layout box. A
 *    wrapper styled `display: contents` measures as offsetLeft 0 / width 0,
 *    so every centring calculation silently works from garbage and the rail
 *    lands on day one instead of today.
 *
 * 2. One measurement is not enough. Panel widths shift as web fonts resolve
 *    and text metrics settle, so we centre after layout, again on the next
 *    frame, and once more when document.fonts.ready resolves. Without the
 *    later passes the rail lands a day or two off on a cold load.
 */
export function useDayRail(dates: string[], anchorIdx: number) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const panelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [focusIdx, setFocusIdx] = useState(anchorIdx);
  const focusRef = useRef(anchorIdx);
  useEffect(() => { focusRef.current = focusIdx; }, [focusIdx]);

  const centerOn = useCallback((idx: number, smooth: boolean) => {
    const rail = railRef.current;
    const el = panelRefs.current[dates[idx]];
    if (!rail || !el || !el.offsetParent) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    rail.scrollTo({
      left: el.offsetLeft - (rail.clientWidth - el.offsetWidth) / 2,
      behavior: smooth && !reduce ? "smooth" : "auto",
    });
  }, [dates]);

  useLayoutEffect(() => { centerOn(anchorIdx, false); }, [centerOn, anchorIdx]);

  useEffect(() => {
    const go = () => centerOn(anchorIdx, false);
    const raf = requestAnimationFrame(go);
    document.fonts?.ready?.then(go).catch(() => {});
    const onResize = () => centerOn(focusRef.current, false);
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, [centerOn, anchorIdx]);

  const onScroll = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const mid = rail.scrollLeft + rail.clientWidth / 2;
    let best = 0, dist = Infinity;
    dates.forEach((dk, i) => {
      const el = panelRefs.current[dk];
      if (!el) return;
      const c = el.offsetLeft + el.offsetWidth / 2;
      if (Math.abs(c - mid) < dist) { dist = Math.abs(c - mid); best = i; }
    });
    setFocusIdx((prev) => (best === prev ? prev : best));
  }, [dates]);

  const onKeyDown = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") { e.preventDefault(); centerOn(Math.min(dates.length - 1, focusRef.current + 1), true); }
    if (e.key === "ArrowLeft") { e.preventDefault(); centerOn(Math.max(0, focusRef.current - 1), true); }
  }, [centerOn, dates.length]);

  return { railRef, panelRefs, focusIdx, centerOn, onScroll, onKeyDown };
}
