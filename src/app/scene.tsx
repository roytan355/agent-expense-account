"use client";

// One fixed WebGL canvas behind the page: the agent's card on a leash.
// Its pose comes from keyframes tied to section positions, so as you scroll
// the card glides between sections instead of each section animating alone.
// The same interpolation drives the background colour field (--f1..--f3).
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import type { Ledger } from "./console";

type Pose = { fx: number; fy: number; rx: number; ry: number; rz: number; s: number; o: number };
type RGBA = [number, number, number, number];
const SKY: [number, number, number] = [47, 147, 255];
const VIOLET: [number, number, number] = [122, 60, 255];
const MINT: [number, number, number] = [20, 241, 149];
const c = (rgb: [number, number, number], a: number): RGBA => [...rgb, a];

// Card pose and background field for each stop, desktop and mobile.
const STOPS: { id: string; desk: Pose; mob: Pose; field: [RGBA, RGBA, RGBA] }[] = [
  { id: "hero", desk: { fx: 0.42, fy: 0.02, rx: -0.2, ry: -0.45, rz: 0.15, s: 1.15, o: 1 }, mob: { fx: 0.1, fy: -0.68, rx: -0.2, ry: -0.35, rz: 0.12, s: 0.5, o: 1 }, field: [c(SKY, 0.45), c(VIOLET, 0.38), c(MINT, 0.3)] },
  { id: "problem", desk: { fx: -0.45, fy: -0.05, rx: -0.1, ry: 0.5, rz: -0.12, s: 0.95, o: 1 }, mob: { fx: 0, fy: -0.58, rx: -0.1, ry: 0.4, rz: -0.1, s: 0.55, o: 1 }, field: [c(VIOLET, 0.4), c(SKY, 0.25), c(VIOLET, 0.3)] },
  { id: "flow", desk: { fx: 0.62, fy: 0.55, rx: -0.15, ry: -0.3, rz: 0.1, s: 0.5, o: 1 }, mob: { fx: 0.3, fy: -1.4, rx: -0.15, ry: -0.3, rz: 0.1, s: 0.4, o: 0 }, field: [c(MINT, 0.35), c(SKY, 0.35), c(VIOLET, 0.2)] },
  { id: "flow2", desk: { fx: 0.62, fy: 0.5, rx: -0.1, ry: -0.6, rz: 0.05, s: 0.5, o: 1 }, mob: { fx: 0.3, fy: -1.4, rx: -0.1, ry: -0.6, rz: 0.05, s: 0.4, o: 0 }, field: [c(MINT, 0.35), c(SKY, 0.35), c(VIOLET, 0.2)] },
  { id: "rules", desk: { fx: -0.5, fy: 0, rx: -0.15, ry: 0.45, rz: -0.1, s: 1.0, o: 1 }, mob: { fx: 0, fy: -1.4, rx: -0.15, ry: 0.35, rz: -0.1, s: 0.5, o: 0 }, field: [c(SKY, 0.4), c(MINT, 0.3), c(VIOLET, 0.3)] },
  { id: "console", desk: { fx: -0.5, fy: 1.5, rx: -0.15, ry: 0.45, rz: -0.1, s: 0.8, o: 0 }, mob: { fx: 0, fy: 1.6, rx: -0.15, ry: 0.35, rz: -0.1, s: 0.6, o: 0 }, field: [c(SKY, 0.25), c(VIOLET, 0.18), c(MINT, 0.2)] },
];

const smooth = (t: number) => t * t * (3 - 2 * t);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

function drawFace(g: CanvasRenderingContext2D, spent: number, max: number, paused: boolean) {
  const W = 1360, H = 860;
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#1b1f3b"); bg.addColorStop(0.55, "#3a1f7a"); bg.addColorStop(1, "#0f6b5a");
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const sheen = g.createRadialGradient(300, 120, 10, 300, 120, 700);
  sheen.addColorStop(0, "rgba(255,255,255,.22)"); sheen.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = sheen; g.fillRect(0, 0, W, H);
  // chip
  g.fillStyle = "#d9b25c"; g.beginPath(); g.roundRect(96, 250, 170, 128, 22); g.fill();
  g.strokeStyle = "rgba(80,55,10,.45)"; g.lineWidth = 4;
  for (const y of [292, 336]) { g.beginPath(); g.moveTo(96, y); g.lineTo(266, y); g.stroke(); }
  g.beginPath(); g.moveTo(181, 250); g.lineTo(181, 378); g.stroke();
  const font = "-apple-system, system-ui, sans-serif";
  g.fillStyle = "#fff"; g.font = `600 54px ${font}`; g.fillText("Research agent", 96, 150);
  g.fillStyle = "rgba(255,255,255,.85)"; g.font = `700 44px ${font}`; g.fillText("USDC", 1110, 150);
  if (paused) {
    g.fillStyle = "rgba(255,69,58,.9)"; g.beginPath(); g.roundRect(1010, 250, 254, 76, 38); g.fill();
    g.fillStyle = "#fff"; g.font = `700 38px ${font}`; g.fillText("Paused", 1070, 302);
  }
  g.fillStyle = "rgba(255,255,255,.6)"; g.font = `500 36px ${font}`; g.fillText("Spent today", 96, 520);
  const amt = `$${spent.toFixed(2)}`;
  g.fillStyle = "#fff"; g.font = `800 132px ${font}`; g.fillText(amt, 96, 650);
  const w = g.measureText(amt).width;
  g.fillStyle = "rgba(255,255,255,.65)"; g.font = `500 40px ${font}`; g.fillText(`of $${max.toFixed(2)}`, 96 + w + 22, 650);
  g.fillStyle = "rgba(255,255,255,.18)"; g.beginPath(); g.roundRect(96, 706, 1168, 26, 13); g.fill();
  const pct = Math.max(0.02, Math.min(1, max > 0 ? spent / max : 0));
  const bar = g.createLinearGradient(96, 0, 96 + 1168 * pct, 0);
  bar.addColorStop(0, paused ? "#ff6b6b" : "#14f195"); bar.addColorStop(1, paused ? "#ff9f6b" : "#5ac8fa");
  g.fillStyle = bar; g.beginPath(); g.roundRect(96, 706, Math.max(26, 1168 * pct), 26, 13); g.fill();
}

export function Scene({ ledger }: { ledger: Ledger | null }) {
  const host = useRef<HTMLDivElement>(null);
  const faceRef = useRef<{ draw: (s: number, m: number, p: boolean) => void } | null>(null);

  useEffect(() => {
    const el = host.current!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    cam.position.set(0, 0, 14);
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-2, 6, 12);
    scene.add(key, new THREE.AmbientLight(0xffffff, 0.25));

    // card
    const fc = document.createElement("canvas"); fc.width = 1360; fc.height = 860;
    const g = fc.getContext("2d")!;
    const tex = new THREE.CanvasTexture(fc);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    faceRef.current = { draw: (s, m, p) => { drawFace(g, s, m, p); tex.needsUpdate = true; } };
    drawFace(g, 0, 1, false);

    const cw = 3.4, ch = 2.15;
    const card = new THREE.Group();
    const bodyGeo = new RoundedBoxGeometry(cw, ch, 0.07, 6, 0.16);
    const bodyMat = new THREE.MeshPhysicalMaterial({ color: 0x22244a, metalness: 0.3, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.15 });
    card.add(new THREE.Mesh(bodyGeo, bodyMat));
    const faceGeo = new THREE.PlaneGeometry(cw - 0.06, ch - 0.06);
    const faceMat = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.3, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.08 });
    const face = new THREE.Mesh(faceGeo, faceMat);
    face.position.z = 0.0365; card.add(face);
    const chrome = new THREE.MeshStandardMaterial({ color: 0xe8ecf2, metalness: 1, roughness: 0.18 });
    const ringGeo = new THREE.TorusGeometry(0.26, 0.045, 24, 64);
    const ring = new THREE.Mesh(ringGeo, chrome);
    ring.position.set(cw / 2 - 0.28, ch / 2 + 0.08, 0); ring.rotation.y = Math.PI / 2;
    card.add(ring);
    scene.add(card);

    const clipGeo = new THREE.CapsuleGeometry(0.11, 0.34, 8, 24);
    const clip = new THREE.Mesh(clipGeo, chrome);
    scene.add(clip);

    // braided rope texture
    const sc = document.createElement("canvas"); sc.width = 64; sc.height = 256;
    const sg = sc.getContext("2d")!;
    sg.fillStyle = "#0a6fe8"; sg.fillRect(0, 0, 64, 256);
    for (let i = 0; i < 16; i++) {
      sg.fillStyle = i % 2 ? "#3d9bff" : "#004fb3";
      sg.save(); sg.translate(0, i * 16); sg.transform(1, 0, -1, 1, 0, 0); sg.fillRect(0, 0, 128, 8); sg.restore();
    }
    const stex = new THREE.CanvasTexture(sc);
    stex.wrapS = stex.wrapT = THREE.RepeatWrapping; stex.repeat.set(1, 30); stex.colorSpace = THREE.SRGBColorSpace;
    const ropeMat = new THREE.MeshStandardMaterial({ map: stex, roughness: 0.75, metalness: 0, envMapIntensity: 0.6 });
    const rope = new THREE.Mesh(new THREE.BufferGeometry(), ropeMat);
    scene.add(rope);

    // layout
    const halfH = 14 * Math.tan((15 * Math.PI) / 180);
    let halfW = halfH, mobile = false;
    let keys: { y: number; i: number }[] = [];
    const resize = () => {
      const w = window.innerWidth, h = window.innerHeight;
      renderer.setSize(w, h);
      cam.aspect = w / h; cam.updateProjectionMatrix();
      halfW = halfH * cam.aspect;
      mobile = cam.aspect < 0.9;
      const vh = h;
      const top = (id: string) => document.getElementById(id);
      const k: { y: number; i: number }[] = [{ y: 0, i: 0 }];
      const sec = (id: string) => { const e = top(id); return e ? { t: e.offsetTop, h: e.offsetHeight } : null; };
      const p = sec("problem"), f = sec("flow"), r = sec("rules"), co = sec("console");
      if (p) k.push({ y: p.t, i: 1 }, { y: p.t + p.h - vh, i: 1 });
      if (f) k.push({ y: f.t, i: 2 }, { y: f.t + f.h - vh, i: 3 });
      if (r) k.push({ y: r.t, i: 4 }, { y: r.t + Math.max(0, r.h - vh), i: 4 });
      if (co) k.push({ y: co.t, i: 5 });
      for (let j = 1; j < k.length; j++) if (k[j].y <= k[j - 1].y) k[j].y = k[j - 1].y + 1;
      keys = k;
    };
    resize();
    window.addEventListener("resize", resize);
    const ro = new ResizeObserver(resize);
    ro.observe(document.body);

    const poseAt = (y: number) => {
      const P = (i: number) => (mobile ? STOPS[i].mob : STOPS[i].desk);
      if (y <= keys[0].y) return { pose: P(keys[0].i), field: STOPS[keys[0].i].field };
      for (let j = 1; j < keys.length; j++) {
        const a = keys[j - 1], b = keys[j];
        if (y <= b.y) {
          const t = smooth((y - a.y) / (b.y - a.y));
          const pa = P(a.i), pb = P(b.i);
          const pose = Object.fromEntries(Object.keys(pa).map((n) => [n, mix(pa[n as keyof Pose], pb[n as keyof Pose], t)])) as Pose;
          const fa = STOPS[a.i].field, fb = STOPS[b.i].field;
          const field = fa.map((ca, ci) => ca.map((v, vi) => mix(v, fb[ci][vi], t))) as [RGBA, RGBA, RGBA];
          return { pose, field };
        }
      }
      const last = keys[keys.length - 1];
      return { pose: P(last.i), field: STOPS[last.i].field };
    };

    // state
    const cur: Pose = { ...STOPS[0].desk };
    let first = true;
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMove = (e: PointerEvent) => { mouse.tx = e.clientX / window.innerWidth - 0.5; mouse.ty = e.clientY / window.innerHeight - 0.5; };
    if (!reduced) window.addEventListener("pointermove", onMove);
    const intro = { v: reduced ? 1 : 0 };
    const t0 = performance.now();
    const root = document.documentElement;
    let lastField = "";
    const tmp = new THREE.Vector3();
    const ropeLen = 7;
    let raf = 0;

    const frame = () => {
      raf = requestAnimationFrame(frame);
      const now = (performance.now() - t0) / 1000;
      if (!reduced && intro.v < 1) intro.v = Math.min(1, now / 1.6);
      const { pose, field } = poseAt(window.scrollY);
      const k = first ? 1 : 0.12;
      first = false;
      (Object.keys(cur) as (keyof Pose)[]).forEach((n) => { cur[n] = mix(cur[n], pose[n], k); });

      const fs = field.map((f) => `rgba(${f[0] | 0},${f[1] | 0},${f[2] | 0},${f[3].toFixed(3)})`).join("|");
      if (fs !== lastField) {
        const [a, b, cc] = fs.split("|");
        root.style.setProperty("--f1", a); root.style.setProperty("--f2", b); root.style.setProperty("--f3", cc);
        lastField = fs;
      }

      renderer.domElement.style.opacity = String(cur.o);
      if (cur.o < 0.01) return;

      mouse.x = mix(mouse.x, mouse.tx, 0.05); mouse.y = mix(mouse.y, mouse.ty, 0.05);
      const ei = 1 - Math.pow(1 - intro.v, 3);
      const bob = reduced ? 0 : Math.sin(now * 0.9) * 0.06;
      card.position.set(cur.fx * halfW, cur.fy * halfH + bob - (1 - ei) * 2.5, 0);
      card.rotation.set(cur.rx + mouse.y * 0.18, cur.ry + mouse.x * 0.3 + (1 - ei) * 0.6, cur.rz + (reduced ? 0 : Math.sin(now * 0.7) * 0.02));
      card.scale.setScalar(cur.s);
      card.updateMatrixWorld(true);

      // clip sits on the ring
      ring.getWorldPosition(tmp);
      const clipPos = tmp.clone().add(new THREE.Vector3(0, 0.3 * cur.s, 0));
      clip.position.copy(clipPos);
      clip.scale.setScalar(cur.s);
      clip.rotation.set(0, 0, 0.5);

      // rope from the clip up to a hand above the screen, so it never crosses the card face
      const start = clipPos.clone().add(new THREE.Vector3(0, 0.22 * cur.s, 0));
      const anchorX = start.x + (cur.fx > 0 ? 0.9 : -0.9) * cur.s;
      // on narrow screens the text spans the full width, so the rope comes in from the right edge instead of the top
      const end = mobile
        ? new THREE.Vector3(halfW + 0.8, start.y + 2.2, -0.6)
        : new THREE.Vector3(anchorX, halfH + 1.2, -0.6);
      const d = start.distanceTo(end);
      const slack = Math.max(0, ropeLen - d);
      const wig = reduced ? 0 : Math.sin(now * 1.3) * 0.12;
      const sway = (cur.fx > 0 ? 1 : -1) * (0.35 + wig) * (slack * 0.25 + 0.4);
      const c1 = start.clone().lerp(end, 0.3).add(new THREE.Vector3(sway, -0.2, 0));
      const c2 = start.clone().lerp(end, 0.7).add(new THREE.Vector3(sway * 0.5, 0, 0));
      const curve = new THREE.CubicBezierCurve3(start, c1, c2, end);
      const old = rope.geometry;
      rope.geometry = new THREE.TubeGeometry(curve, 120, 0.085 * Math.max(0.6, cur.s), 12, false);
      old.dispose();

      renderer.render(scene, cam);
    };
    frame();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      ro.disconnect();
      rope.geometry.dispose();
      [bodyGeo, faceGeo, ringGeo, clipGeo].forEach((x) => x.dispose());
      [bodyMat, faceMat, chrome, ropeMat].forEach((x) => x.dispose());
      tex.dispose(); stex.dispose(); pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      faceRef.current = null;
    };
  }, []);

  const spent = ledger?.spent_today ?? 0;
  const max = ledger?.policy.per_day_max_usdc ?? 1;
  const paused = ledger?.policy.paused ?? false;
  useEffect(() => { faceRef.current?.draw(spent, max, paused); }, [spent, max, paused]);

  return <div ref={host} className="scene" aria-hidden />;
}
