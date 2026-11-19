"use client";

// Smooth scroll: Lenis driven by the GSAP ticker so ScrollTrigger and the
// 3D scene read the same scroll position on the same frame.
import { useEffect, useRef } from "react";
import { ReactLenis, type LenisRef } from "lenis/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "lenis/dist/lenis.css";

gsap.registerPlugin(ScrollTrigger);

export function SmoothScroll() {
  const ref = useRef<LenisRef>(null);

  useEffect(() => {
    let off: (() => void) | undefined;
    const tick = (t: number) => {
      const lenis = ref.current?.lenis;
      if (!lenis) return;
      if (!off) off = lenis.on("scroll", ScrollTrigger.update);
      lenis.raf(t * 1000);
    };
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => { gsap.ticker.remove(tick); off?.(); };
  }, []);

  return <ReactLenis root options={{ autoRaf: false, anchors: true, lerp: 0.1 }} ref={ref} />;
}
