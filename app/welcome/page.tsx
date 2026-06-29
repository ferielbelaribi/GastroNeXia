"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import LogoIcon from "@/components/ui/logo-icon";

/* ── counter hook (eases to target when `start` flips true) ── */
function useCountUp(target: number, duration = 1600, start = true) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!start) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, start]);
  return val;
}

export default function WelcomePage() {
  const router   = useRouter();
  const statsRef = useRef<HTMLDivElement>(null);
  const featRef  = useRef<HTMLDivElement>(null);
  const ctaRef   = useRef<HTMLDivElement>(null);
  const heroRef  = useRef<HTMLElement>(null);
  const navRef   = useRef<HTMLElement>(null);

  const [statsIn, setStatsIn] = useState(false);
  const [heroIn,  setHeroIn]  = useState(false);


  /* scroll reveal */
  useEffect(() => {
    const targets: Array<[HTMLElement | null, (v: boolean) => void]> = [
      [statsRef.current, setStatsIn],
      [featRef.current,  () => {}],
      [ctaRef.current,   () => {}],
    ];
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            (e.target as HTMLElement).classList.add("in-view");
            const pair = targets.find(([el]) => el === e.target);
            pair?.[1](true);
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.15 }
    );
    targets.forEach(([el]) => el && io.observe(el));
    // hero counter fires immediately
    const t = setTimeout(() => setHeroIn(true), 650);
    return () => { io.disconnect(); clearTimeout(t); };
  }, []);

  /* nav shadow on scroll */
  useEffect(() => {
    const onScroll = () => {
      if (!navRef.current) return;
      navRef.current.classList.toggle("is-scrolled", window.scrollY > 10);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* hero cursor-follow spotlight */
  const onHeroMove = (e: React.MouseEvent<HTMLElement>) => {
    const el = heroRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const mx = ((e.clientX - r.left) / r.width)  * 100;
    const my = ((e.clientY - r.top)  / r.height) * 100;
    el.style.setProperty("--mx", `${mx}%`);
    el.style.setProperty("--my", `${my}%`);
  };


  /* feature-card magnetic tilt */
  const onCardMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const r  = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top)  / r.height;
    const ry = (px - 0.5) *  6;   // rotateY
    const rx = (0.5 - py) *  6;   // rotateX
    el.style.setProperty("--rx", `${rx}deg`);
    el.style.setProperty("--ry", `${ry}deg`);
    el.style.setProperty("--cx", `${px * 100}%`);
    el.style.setProperty("--cy", `${py * 100}%`);
  };
  const onCardLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  };

  /* animated counters — model performance metrics */
  const metric1 = useCountUp(98.06, 1600, heroIn);
  const metric2 = useCountUp(96.71, 1800, heroIn);
  const metric3 = useCountUp(93.83, 2000, heroIn);
  const metric4 = useCountUp(97.36, 1700, heroIn);

  return (
    <div className="welcome-root">

      {/* inline SVG filter: chroma-key the video's black background to alpha */}
      <svg className="svg-defs" width="0" height="0" aria-hidden focusable="false">
        <defs>
          <filter id="organAlpha" colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values="
                1 0 0 0 0
                0 1 0 0 0
                0 0 1 0 0
                4 4 4 0 -0.15
              "
            />
          </filter>
        </defs>
      </svg>

      {/* ── NAVBAR ── */}
      <nav className="nav nav-animate" ref={navRef}>
        <div className="nav-logo" onClick={() => router.push("/welcome")}>
          <LogoIcon size={72} />
        </div>

        <div className="nav-actions">
          <button
            className="btn-nav-signin"
            onClick={() => router.push("/auth")}
          >
            <span className="btn-signin-text">Sign In</span>
            <span className="btn-signin-arrow">→</span>
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="hero" ref={heroRef} onMouseMove={onHeroMove}>
        <div className="hero-left">
          <div className="hero-tag fade-up" style={{ animationDelay: "0.1s" }}>
            <span className="pulse-dot" />
            AI Diagnostic System · Active
          </div>

          <h1 className="hero-h1 fade-up" style={{ animationDelay: "0.22s" }}>
            Endoscopy.<br />
            <em>Redefined</em><br />
            by AI.
          </h1>

          <p className="hero-sub fade-up" style={{ animationDelay: "0.36s" }}>
            GastroNeXia delivers real-time lesion detection, classification,
            and segmentation for gastrointestinal endoscopy — clinical-grade,
            frame by frame.
          </p>

          <div className="btn-group fade-up" style={{ animationDelay: "0.5s" }}>
            <button
              className="btn-primary"
              onClick={() => router.push("/live?guest=true")}
            >
              Try as a Guest
            </button>
          </div>
        </div>

        {/* anatomical digestive-system visual — image + CSS 3D tilt */}
        <div className="hero-right fade-in-right" style={{ animationDelay: "0.25s" }}>
          <div className="organ-stage">
            {/* soft radial glow behind the organ */}
            <div className="organ-halo" aria-hidden />

            {/* tilting organ visual with scan overlay + detection beacons */}
            <div className="organ-tilt">
              <div className="organ-float">
                {/* soft white platter to give the video weight on white bg */}
                <div className="organ-plate" aria-hidden />

                <video
                  className="organ-video"
                  src="/videos/digestive.mp4"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="auto"
                  aria-label="3D digestive system animation"
                />

                {/* vertical AI scan line sweeping across the organ */}
                <div className="organ-scan" aria-hidden />

                {/* pulsing detection beacons anchored to anatomy */}
                <div className="organ-beacon b1"><span /></div>
                <div className="organ-beacon b2"><span /></div>
                <div className="organ-beacon b3"><span /></div>
              </div>
            </div>

            {/* HUD — single analysis badge at bottom (top corners reserved for float-cards) */}
            <div className="organ-hud organ-hud-b">
              <span className="hud-dot" />
              <span>AI ANALYSIS</span>
              <span className="hud-sep" />
              <span>GASTROINTESTINAL</span>
            </div>
          </div>

          <div className="float-card fc-tl">
            <div className="fc-label">Detection Speed</div>
            <div className="fc-val accent2">{`< 48ms`}</div>
          </div>

          <div className="float-card fc-br">
            <div className="fc-label">Risk Level</div>
            <div className="fc-val">
              <span className="fc-dot" style={{ background: "#0D9488" }} />
              High — Polyp
            </div>
          </div>

          <div className="float-card fc-top">
            <div className="fc-label">Active Cases</div>
            <div className="fc-val">2,847</div>
          </div>
        </div>

      </section>

      {/* ── STATS STRIP ── */}
      <div id="stats" className="stats-strip reveal-section" ref={statsRef}>
        <div className="stat-item" style={{ transitionDelay: "0s" }}>
          <div className="stat-num">
            {metric1.toFixed(2)}
            <span className="stat-unit">%</span>
          </div>
          <div className="stat-label">Diagnostic Precision</div>
        </div>
        <div className="stat-item" style={{ transitionDelay: "0.08s" }}>
          <div className="stat-num">
            {metric2.toFixed(2)}
            <span className="stat-unit">%</span>
          </div>
          <div className="stat-label">Polyp Detection Rate</div>
        </div>
        <div className="stat-item" style={{ transitionDelay: "0.16s" }}>
          <div className="stat-num">
            {metric3.toFixed(2)}
            <span className="stat-unit">%</span>
          </div>
          <div className="stat-label">Clinical Sensitivity</div>
        </div>
        <div className="stat-item" style={{ transitionDelay: "0.24s" }}>
          <div className="stat-num">
            {metric4.toFixed(2)}
            <span className="stat-unit">%</span>
          </div>
          <div className="stat-label">Segmentation Accuracy</div>
        </div>
      </div>

      {/* ── FEATURES ── */}
      <section className="features reveal-section" ref={featRef}>
        <div className="section-tag">Core Capabilities</div>
        <h2 className="section-title">Everything a gastroenterologist needs.</h2>

        <div className="features-grid">
          <div
            className="feat-card c1"
            onMouseMove={onCardMove}
            onMouseLeave={onCardLeave}
          >
            <div className="feat-icon" style={{ background: "rgba(37,99,235,0.08)" }}>
              <DetectionIcon color="var(--accent)" />
            </div>
            <h3>Real-time Detection</h3>
            <p>Frame-by-frame lesion detection with zero interruption to the endoscopic procedure workflow.</p>
            {/* <span className="feat-link">Learn more <span className="arr">→</span></span> */}
          </div>

          <div
            className="feat-card c2"
            onMouseMove={onCardMove}
            onMouseLeave={onCardLeave}
          >
            <div className="feat-icon" style={{ background: "rgba(220,38,38,0.08)" }}>
              <AnnotationIcon color="#DC2626" />
            </div>
            <h3>Data Annotation &amp; Collection</h3>
            <p>Structured GI lesion labeling and dataset curation to continuously improve model performance.</p>
            {/* <span className="feat-link">Learn more <span className="arr">→</span></span> */}
          </div>

          <div
            className="feat-card c3"
            onMouseMove={onCardMove}
            onMouseLeave={onCardLeave}
          >
            <div className="feat-icon" style={{ background: "rgba(20,184,166,0.08)" }}>
              <EyeIcon color="var(--accent3)" />
            </div>
            <h3>Pixel Segmentation</h3>
            <p>Precise mask overlays with exact lesion boundary delineation for clinical documentation.</p>
            {/* <span className="feat-link">Learn more <span className="arr">→</span></span> */}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section id="cta" className="cta-section reveal-section" ref={ctaRef}>
        <div className="cta-card">
          <h2>
            Ready to elevate your{" "}
            <em>diagnostic precision?</em>
          </h2>
          <p>Join clinicians using AI-powered endoscopy analysis.</p>
          <div className="cta-buttons">
            <button
              className="btn-white"
              onClick={() => router.push("/auth")}
            >
              Create Your Account
            </button>
          </div>
        </div>
      </section>

    </div>
  );
}

/* ── SVG ICONS ── */
function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
      stroke="#fff" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12h8M12 8v8" />
    </svg>
  );
}
function DetectionIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="2" />
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
    </svg>
  );
}
function AnnotationIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
      <circle cx="9" cy="9" r="1" fill={color} stroke="none" />
    </svg>
  );
}
function EyeIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

