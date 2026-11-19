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

// Night falls as the console scrolls in: the overlay's opacity follows the
// scroll, and the page chrome switches to dark once the console takes over.
export function NightFall({ target }: { target: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const tween = gsap.to(el, {
      opacity: 1,
      ease: "none",
      scrollTrigger: {
        trigger: target,
        start: "top bottom",
        end: "top 55%",
        scrub: true,
        onUpdate: (st) => document.documentElement.classList.toggle("night", st.progress > 0.6),
      },
    });
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
      document.documentElement.classList.remove("night");
    };
  }, [target]);
  return <div ref={ref} className="nightfall" aria-hidden />;
}
