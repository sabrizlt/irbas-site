/* La sfera di Irbas, portata dal codice dell'app (HoloOrb.swift):
   particelle di luce su una sfera, addensate lungo i bordi di celle sparse (la «ragnatela»),
   azzurro ghiaccio da un lato e viola dall'altro. Stesso seme: è la stessa sfera dell'app. */
(function () {
  const ICE = [139, 233, 255], CYAN = [79, 195, 255], LILAC = [185, 174, 255], VIOLET = [138, 125, 255], WHITE = [230, 248, 255];
  const PALETTE = [ICE, CYAN, LILAC, VIOLET];

  // Numeri casuali ripetibili (SplitMix64 semplificato a 32 bit: mulberry32)
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function unit(r) {
    const z = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - z * z);
    return [s * Math.cos(a), s * Math.sin(a), z];
  }
  function gauss(r) {
    const u = Math.max(1e-9, r()), v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function buildModel(count, sparkCount, seed) {
    const r = rng(seed);
    const cells = Array.from({ length: 30 }, () => unit(r));
    const particles = [];
    let attempts = 0;
    while (particles.length < count && attempts < count * 80) {
      attempts++;
      const p = unit(r);
      let best = -2, second = -2;
      for (const c of cells) {
        const d = p[0] * c[0] + p[1] * c[1] + p[2] * c[2];
        if (d > best) { second = best; best = d; } else if (d > second) second = d;
      }
      const gap = Math.acos(Math.max(-1, Math.min(1, second))) - Math.acos(Math.max(-1, Math.min(1, best)));
      const wobble = 0.5 + Math.abs(Math.sin(p[0] * 3.1 + p[1] * 1.7 + p[2] * 2.3 + Math.sin(-p[0] * 2.6 + p[1] * 5.8 + p[2] * 1.4)));
      const width = 0.032 * wobble;
      const on = Math.exp(-(gap / width) * (gap / width));
      if (r() >= (on + 0.012) * 0.9) continue;
      const rad = 1 + gauss(r) * 0.03;
      particles.push({
        x: p[0] * rad, y: p[1] * rad, z: p[2] * rad,
        size: 0.7 + r() * 0.9 + on * 0.5,
        bright: 0.35 + 0.65 * on * (0.6 + 0.4 * r()),
        seed: r() * 6.283,
      });
    }
    const sparks = Array.from({ length: sparkCount }, () => ({ dir: unit(r), speed: 0.08 + r() * 0.22, offset: r(), size: 0.6 + r() * 1.1 }));
    return { particles, sparks };
  }

  const cache = {};
  function model(kind) {
    if (!cache[kind]) {
      cache[kind] = kind === "full" ? buildModel(6000, 220, 11) : kind === "light" ? buildModel(3000, 90, 11) : buildModel(1200, 30, 11);
    }
    return cache[kind];
  }

  /** Crea una sfera su un canvas. options: { detail: "full"|"light"|"compact", phase: () => "idle"|"listening"|"thinking" } */
  window.IrbasOrb = function (canvas, options = {}) {
    const ctx = canvas.getContext("2d");
    const m = model(options.detail || "full");
    const getPhase = options.phase || (() => "idle");
    let w = 0, h = 0, dpr = 1, visible = true, raf = 0;
    const start = performance.now();

    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      const rect = canvas.getBoundingClientRect();
      w = rect.width; h = rect.height;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    resize();
    new ResizeObserver(resize).observe(canvas);
    new IntersectionObserver((e) => {
      visible = e[0].isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(frame);
    }).observe(canvas);

    const buckets = Array.from({ length: 12 }, () => []);

    function frame(now) {
      raf = 0;
      if (!visible) return;
      const t = (now - start) / 1000;
      const phase = getPhase();
      const listening = phase === "listening", thinking = phase === "thinking";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;
      let scale = 1;
      if (listening) scale += 0.025 * Math.sin(t * 3.2);
      const radius = Math.min(w, h) * 0.34 * scale;
      const spin = thinking ? 0.42 : listening ? 0.16 : 0.09;
      const yaw = t * spin, pitch = 0.38 + 0.06 * Math.sin(t * 0.21);
      const cyaw = Math.cos(yaw), syaw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);

      // Alone
      const halo = radius * 1.7;
      const hc = thinking ? VIOLET : CYAN;
      const hs = 0.10 + (listening ? 0.06 : 0) + (thinking ? 0.05 : 0);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, halo);
      g.addColorStop(0, `rgba(${hc},${hs})`); g.addColorStop(0.5, `rgba(${hc},${hs * 0.35})`); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(cx - halo, cy - halo, halo * 2, halo * 2);

      for (const b of buckets) b.length = 0;
      const energy = phase === "idle" ? 0.78 : 1.0;
      const pointScale = options.detail === "compact" ? 0.6 : 1;
      const pts = m.particles;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const x1 = p.x * cyaw + p.z * syaw;
        const z1 = -p.x * syaw + p.z * cyaw;
        const y2 = p.y * cp - z1 * sp;
        const z2 = p.y * sp + z1 * cp;
        const f = 1 / (1 - 0.18 * z2);
        const qx = cx + x1 * radius * f, qy = cy - y2 * radius * f;
        const depth = (z2 + 1) / 2;
        let light = p.bright * (0.3 + 0.7 * depth) * energy;
        if (thinking) light *= 0.55 + 0.6 * Math.max(0, Math.sin(t * 4.2 - p.y * 7 + p.seed * 0.3));
        const li = Math.min(2, (light * 3) | 0);
        let tint = (qx - cx) / (radius * 2) + 0.5;
        if (thinking) tint = 0.55 + tint * 0.45;
        const ci = Math.min(3, Math.max(0, (tint * 4) | 0));
        const s = p.size * pointScale * (0.65 + 0.55 * depth) * (radius / 240 + 0.4);
        buckets[ci * 3 + li].push(qx - s / 2, qy - s / 2, s);
      }
      for (let c = 0; c < 4; c++) {
        for (let l = 0; l < 3; l++) {
          const arr = buckets[c * 3 + l];
          if (!arr.length) continue;
          const a = 0.28 + 0.72 * (l + 1) / 3;
          const base = l === 2 && c < 2 ? WHITE : PALETTE[c];
          ctx.fillStyle = `rgba(${base},${a})`;
          for (let k = 0; k < arr.length; k += 3) ctx.fillRect(arr[k], arr[k + 1], arr[k + 2], arr[k + 2]);
        }
      }

      // Scintille che si allontanano dalla sfera
      for (const sp2 of m.sparks) {
        const life = (t * sp2.speed + sp2.offset) % 1;
        const d = 1.05 + life * 0.6;
        const p = sp2.dir;
        const x1 = p[0] * cyaw + p[2] * syaw, z1 = -p[0] * syaw + p[2] * cyaw;
        const y2 = p[1] * cp - z1 * sp, z2 = p[1] * sp + z1 * cp;
        const qx = cx + x1 * radius * d, qy = cy - y2 * radius * d;
        const alpha = (1 - life) * 0.8 * ((z2 + 1) / 2 * 0.7 + 0.3);
        ctx.fillStyle = `rgba(${x1 > 0 ? LILAC : ICE},${alpha})`;
        const s = sp2.size * (radius / 240 + 0.4);
        ctx.fillRect(qx, qy, s, s);
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
  };
})();
