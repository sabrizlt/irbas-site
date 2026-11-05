/* Irbas · effetti di scroll e parallax, senza librerie.
   Un solo ciclo requestAnimationFrame legge lo scroll e aggiorna tutto. */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  requestAnimationFrame(() => document.body.classList.add("is-loaded"));

  /* ---------- Sfere ---------- */
  let voicePhase = "idle";
  const heroCanvas = $("#orb");
  const mobile = innerWidth < 700;
  if (heroCanvas) IrbasOrb(heroCanvas, { detail: mobile ? "light" : "full", phase: () => "idle" });
  $$("[data-mini-orb]").forEach((c) => IrbasOrb(c, { detail: "compact", phase: () => "listening" }));

  /* ---------- Stelle (parallax sul fondo) ---------- */
  const stars = $("#stars");
  const sctx = stars.getContext("2d");
  let starList = [];
  function makeStars() {
    const d = Math.min(2, devicePixelRatio || 1);
    stars.width = innerWidth * d; stars.height = innerHeight * d;
    sctx.setTransform(d, 0, 0, d, 0, 0);
    const n = Math.round((innerWidth * innerHeight) / 5200);
    starList = Array.from({ length: n }, () => ({
      x: Math.random() * innerWidth, y: Math.random() * innerHeight * 3,
      r: Math.random() * 1.2 + 0.2, z: Math.random() * 0.6 + 0.1, tw: Math.random() * 6.28,
      c: Math.random() < 0.7 ? "139,233,255" : "185,174,255",
    }));
  }
  function drawStars(scroll, t) {
    sctx.clearRect(0, 0, innerWidth, innerHeight);
    const H = innerHeight * 3;
    for (const s of starList) {
      let y = (s.y - scroll * s.z) % H; if (y < 0) y += H;
      if (y > innerHeight) continue;
      const a = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(t * 1.2 + s.tw)) * s.z * 1.6;
      sctx.fillStyle = `rgba(${s.c},${a})`;
      sctx.beginPath(); sctx.arc(s.x, y, s.r, 0, 6.283); sctx.fill();
    }
  }
  makeStars();
  addEventListener("resize", makeStars);

  /* ---------- Manifesto: una parola alla volta ---------- */
  const manifesto = $("[data-words]");
  const keys = ["agisce", "Mac,", "lo", "fa:", "l'ok"];
  if (manifesto) {
    manifesto.innerHTML = manifesto.textContent.trim().split(/\s+/)
      .map((w) => `<span class="w${keys.includes(w) ? " is-key" : ""}">${w}</span>`).join(" ");
  }
  const words = $$(".manifesto__text .w");

  /* ---------- Comparse ---------- */
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add("is-visible");
    io.unobserve(e.target);
    const n = e.target.querySelector("[data-count]");
    if (n) countUp(n);
  }), { threshold: 0.18 });
  $$(".reveal").forEach((el, i) => { el.style.transitionDelay = `${(i % 3) * 0.08}s`; io.observe(el); });

  function countUp(el) {
    const end = +el.dataset.count, suffix = el.dataset.suffix || "", t0 = performance.now();
    const tick = (now) => {
      const k = clamp((now - t0) / 1600);
      el.textContent = Math.round(end * (1 - Math.pow(1 - k, 3))) + suffix;
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ---------- Grafo del cervello ---------- */
  function makeGraph(canvas, n, opts = {}) {
    const ctx = canvas.getContext("2d");
    const r = (() => { let a = opts.seed || 7; return () => ((a = (a * 16807) % 2147483647) / 2147483647); })();
    const nodes = Array.from({ length: n }, (_, i) => ({
      x: r(), y: r(), vx: (r() - 0.5) * 0.0004, vy: (r() - 0.5) * 0.0004,
      s: i === 0 ? 7 : 1.5 + r() * 3, c: r() < 0.6 ? "139,233,255" : "138,125,255",
    }));
    nodes[0].x = 0.5; nodes[0].y = 0.5; nodes[0].vx = nodes[0].vy = 0;
    const links = [];
    nodes.forEach((a, i) => {
      if (i === 0) return;
      links.push([i, r() < 0.35 ? 0 : (r() * i) | 0]);
      if (r() < 0.5) links.push([i, (r() * n) | 0]);
    });
    let w = 0, h = 0, d = 1;
    const size = () => { d = Math.min(2, devicePixelRatio || 1); const b = canvas.getBoundingClientRect(); w = b.width; h = b.height; canvas.width = w * d; canvas.height = h * d; };
    size(); new ResizeObserver(size).observe(canvas);
    let visible = false;
    new IntersectionObserver((e) => (visible = e[0].isIntersecting)).observe(canvas);
    return function draw(t, focus = 1) {
      if (!visible) return;
      ctx.setTransform(d, 0, 0, d, 0, 0); ctx.clearRect(0, 0, w, h);
      for (const p of nodes) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0.04 || p.x > 0.96) p.vx *= -1;
        if (p.y < 0.06 || p.y > 0.94) p.vy *= -1;
      }
      ctx.lineWidth = 1;
      for (const [a, b] of links) {
        const A = nodes[a], B = nodes[b];
        const pulse = 0.5 + 0.5 * Math.sin(t * 1.5 + a * 0.7);
        ctx.strokeStyle = `rgba(139,233,255,${(0.05 + 0.12 * pulse) * focus})`;
        ctx.beginPath(); ctx.moveTo(A.x * w, A.y * h); ctx.lineTo(B.x * w, B.y * h); ctx.stroke();
      }
      for (const p of nodes) {
        ctx.fillStyle = `rgba(${p.c},${0.85 * focus})`;
        ctx.shadowColor = `rgba(${p.c},.9)`; ctx.shadowBlur = p.s * 3;
        ctx.beginPath(); ctx.arc(p.x * w, p.y * h, p.s, 0, 6.283); ctx.fill();
      }
      ctx.shadowBlur = 0;
    };
  }
  const bigGraph = $("#graph") ? makeGraph($("#graph"), mobile ? 60 : 120, { seed: 7 }) : null;
  const miniGraph = $("[data-mini-graph]") ? makeGraph($("[data-mini-graph]"), 46, { seed: 3 }) : null;

  /* ---------- Effetto inclinazione sulle tessere ---------- */
  $$("[data-tilt]").forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      const b = el.getBoundingClientRect();
      const x = (e.clientX - b.left) / b.width, y = (e.clientY - b.top) / b.height;
      el.style.setProperty("--mx", `${x * 100}%`); el.style.setProperty("--my", `${y * 100}%`);
      el.style.transform = `perspective(900px) rotateY(${(x - 0.5) * 6}deg) rotateX(${(0.5 - y) * 6}deg)`;
    });
    el.addEventListener("pointerleave", () => (el.style.transform = ""));
  });

  /* ---------- Elementi del ciclo di scroll ---------- */
  const nav = $("#nav"), bar = $("#progress");
  const heroOrb = $("[data-hero-orb]"), heroContent = $(".hero__content");
  const speedEls = $$("[data-speed]");
  const ribbon = $("[data-ribbon]");
  const voice = $("#voce"), pill = $("[data-pill]"), pillLabel = $("[data-pill-label]");
  const phrases = $$("[data-phrase]"), steps = $$("[data-steps] li");
  const team = $("#squadra"), track = $("[data-track]");
  const show = $("#app"), win = $("[data-window]");
  const screens = $$("[data-screen]"), tabs = $$("[data-tab]"), captions = $$(".screen-captions p");
  const navLinks = $$(".nav__links a");
  const sections = navLinks.map((a) => $(a.getAttribute("href")));

  // Progresso 0→1 di una scena fissa (sezione alta più dello schermo)
  const sceneProgress = (el) => {
    const b = el.getBoundingClientRect();
    return clamp(-b.top / (b.height - innerHeight));
  };

  let lastStep = -1, lastScreen = -1;
  function loop(now) {
    const t = now / 1000;
    const y = scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;

    bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    nav.classList.toggle("is-solid", y > 40);
    drawStars(y, t);

    if (!reduced) {
      // Hero: la sfera si allontana e il testo sale più veloce
      const hp = clamp(y / innerHeight);
      heroOrb.style.transform = `translate(-50%, calc(-50% + ${y * 0.35}px)) scale(${1 + hp * 0.35})`;
      heroOrb.style.opacity = 1 - hp * 0.9;
      heroContent.style.transform = `translateY(${y * -0.25}px)`;
      heroContent.style.opacity = 1 - hp * 1.3;

      speedEls.forEach((el) => {
        const b = el.parentElement.getBoundingClientRect();
        el.style.transform = `translate3d(0, ${(b.top + b.height / 2 - innerHeight / 2) * +el.dataset.speed}px, 0)`;
      });
      ribbon.style.transform = `translateX(${-(y * 0.4) % (ribbon.scrollWidth / 2)}px)`;
    }

    // Manifesto
    if (words.length) {
      const b = manifesto.getBoundingClientRect();
      const p = clamp((innerHeight * 0.85 - b.top) / (b.height + innerHeight * 0.35));
      const lit = Math.floor(p * words.length * 1.05);
      words.forEach((w, i) => w.classList.toggle("is-lit", i < lit));
    }

    // Voce: quattro frasi, una dopo l'altra
    const vp = sceneProgress(voice);
    pill.style.setProperty("--p", vp);
    const step = Math.min(phrases.length - 1, Math.floor(vp * phrases.length));
    if (step !== lastStep) {
      phrases.forEach((p, i) => { p.classList.toggle("is-on", i === step); p.classList.toggle("is-past", i < step); });
      lastStep = step;
    }
    const within = (vp * phrases.length) % 1;
    const stage = within < 0.3 ? 0 : within < 0.55 ? 1 : 2;
    steps.forEach((s, i) => s.classList.toggle("is-on", i <= stage));
    pill.classList.toggle("is-thinking", stage === 1);
    pillLabel.textContent = ["In ascolto…", "Ci penso…", "Fatto ✓"][stage];
    voicePhase = stage === 1 ? "thinking" : "listening";

    // Squadra: scorrimento orizzontale
    const tp = sceneProgress(team);
    const dist = track.scrollWidth - innerWidth + 48;
    track.style.transform = `translate3d(${-tp * Math.max(0, dist)}px,0,0)`;

    // L'app: la finestra si raddrizza entrando, poi cambia schermata
    const sb = show.getBoundingClientRect();
    win.style.setProperty("--enter", clamp(1 - (sb.top - innerHeight * 0.1) / innerHeight));
    const sp = sceneProgress(show);
    const si = Math.min(screens.length - 1, Math.floor(sp * screens.length * 0.999));
    if (si !== lastScreen) {
      screens.forEach((s, i) => s.classList.toggle("is-on", i === si));
      tabs.forEach((s) => s.classList.toggle("is-on", +s.dataset.tab === si));
      captions.forEach((c, i) => c.classList.toggle("is-on", i === si));
      lastScreen = si;
    }

    // Grafi
    if (bigGraph) bigGraph(t, 1);
    if (miniGraph) miniGraph(t, 1);

    // Voce del menu attiva
    let active = -1;
    sections.forEach((s, i) => { if (s && s.getBoundingClientRect().top < innerHeight * 0.4) active = i; });
    navLinks.forEach((a, i) => a.classList.toggle("is-active", i === active));

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
