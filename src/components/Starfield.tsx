import { useEffect, useRef } from "react";

/** Parallax starfield drifting towards the viewer — the space between dimensions. */
export default function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let raf = 0;
    const stars = Array.from({ length: 260 }, () => ({
      x: Math.random() * 2 - 1,
      y: Math.random() * 2 - 1,
      z: Math.random(),
    }));

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      w = canvas.width = window.innerWidth * dpr;
      h = canvas.height = window.innerHeight * dpr;
    };
    resize();
    window.addEventListener("resize", resize);

    const accent = () => getComputedStyle(document.documentElement).getPropertyValue("--star").trim() || "#b6ff4a";

    const frame = () => {
      ctx.clearRect(0, 0, w, h);
      const color = accent();
      for (const s of stars) {
        if (!reduced) {
          s.z -= 0.0022;
          if (s.z <= 0.02) {
            s.x = Math.random() * 2 - 1;
            s.y = Math.random() * 2 - 1;
            s.z = 1;
          }
        }
        const px = w / 2 + (s.x / s.z) * (w / 2) * 0.6;
        const py = h / 2 + (s.y / s.z) * (h / 2) * 0.6;
        if (px < 0 || px > w || py < 0 || py > h) continue;
        const r = (1 - s.z) * 2.6;
        ctx.globalAlpha = 1 - s.z;
        ctx.fillStyle = s.z < 0.3 ? color : "#ffffff";
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    };
    frame();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} className="starfield" aria-hidden="true" />;
}
