import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';

const CYAN = '0, 240, 255';
const VIOLET = '139, 92, 246';
const LINK_DIST = 130;
const MOUSE_DIST = 170;

/**
 * Fixed full-screen backdrop: a slowly panning grid, soft colour blooms and
 * a canvas "particle network" that reacts to the pointer.
 *
 * Performance: DPR capped at 2, particle count scales with viewport area,
 * the loop pauses while the tab is hidden, and with prefers-reduced-motion
 * a single static frame is drawn.
 */
export default function Background() {
  const canvasRef = useRef(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let width = 0;
    let height = 0;
    let particles = [];
    let frameId = 0;
    const pointer = { x: -1e4, y: -1e4 };

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.min(85, Math.max(24, Math.floor((width * height) / 17000)));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.32,
        vy: (Math.random() - 0.5) * 0.32,
        r: 0.8 + Math.random() * 1.4,
        rgb: Math.random() < 0.6 ? CYAN : VIOLET,
      }));
    }

    function draw(step) {
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        if (step) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < -20) p.x = width + 20;
          else if (p.x > width + 20) p.x = -20;
          if (p.y < -20) p.y = height + 20;
          else if (p.y > height + 20) p.y = -20;
        }
      }

      // Links between nearby particles.
      ctx.lineWidth = 1;
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK_DIST * LINK_DIST) {
            const alpha = (1 - Math.sqrt(d2) / LINK_DIST) * 0.22;
            ctx.strokeStyle = `rgba(${a.rgb}, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
        // Links to the pointer.
        const mdx = a.x - pointer.x;
        const mdy = a.y - pointer.y;
        const md2 = mdx * mdx + mdy * mdy;
        if (md2 < MOUSE_DIST * MOUSE_DIST) {
          const alpha = (1 - Math.sqrt(md2) / MOUSE_DIST) * 0.5;
          ctx.strokeStyle = `rgba(${CYAN}, ${alpha})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(pointer.x, pointer.y);
          ctx.stroke();
        }
      }

      // Nodes with a cheap halo (no shadowBlur — it's expensive).
      for (const p of particles) {
        ctx.fillStyle = `rgba(${p.rgb}, 0.12)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(${p.rgb}, 0.85)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function loop() {
      draw(true);
      frameId = requestAnimationFrame(loop);
    }

    function start() {
      cancelAnimationFrame(frameId);
      if (reduceMotion) draw(false);
      else frameId = requestAnimationFrame(loop);
    }

    const onResize = () => {
      resize();
      if (reduceMotion) draw(false);
    };
    const onPointerMove = (e) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    };
    const onPointerLeave = () => {
      pointer.x = pointer.y = -1e4;
    };
    const onVisibility = () => (document.hidden ? cancelAnimationFrame(frameId) : start());

    resize();
    start();
    window.addEventListener('resize', onResize);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onPointerLeave);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointerMove);
      document.documentElement.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [reduceMotion]);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Colour blooms */}
      <div className="absolute -left-40 -top-40 size-[520px] rounded-full bg-neon-violet/20 blur-[120px]" />
      <div className="absolute -bottom-48 -right-32 size-[560px] rounded-full bg-neon-cyan/12 blur-[130px]" />
      <div className="grid-bg absolute inset-0" />
      <canvas ref={canvasRef} className="absolute inset-0" />
      {/* Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgb(5_7_14/0.85)_100%)]" />
    </div>
  );
}
