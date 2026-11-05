/* Irbas · effetti di scroll e parallax, senza librerie.
   Un solo ciclo requestAnimationFrame legge lo scroll (con un po' di morbidezza) e aggiorna tutto. */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const smooth = (a, b, v) => { const k = clamp((v - a) / (b - a)); return k * k * (3 - 2 * k); };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobile = innerWidth < 700;

  requestAnimationFrame(() => document.body.classList.add("is-loaded"));

  /* ---------- Stato dello scroll ---------- */
  let y = scrollY, sy = scrollY, vel = 0, svel = 0;

  /* ---------- Hero: titolo diviso in lettere ---------- */
  const heroTitle = $("[data-hero-title]");
  const chars = [];
  const GRAD = [[139, 233, 255], [255, 255, 255], [138, 125, 255]];
  function gradAt(k) {
    const [a, b, t] = k < 0.45 ? [GRAD[0], GRAD[1], k / 0.45] : [GRAD[1], GRAD[2], (k - 0.45) / 0.55];
    return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], t))).join(",")})`;
  }
  $$(".word", heroTitle).forEach((word) => {
    const isGrad = word.classList.contains("grad");
    const text = word.textContent;
    word.classList.remove("grad");
    word.textContent = "";
    [...text].forEach((c, i) => {
      const s = document.createElement("span");
      s.className = "ch";
      s.textContent = c === " " ? " " : c;
      if (isGrad) s.style.color = gradAt(i / Math.max(1, text.length - 1));
      word.appendChild(s);
      chars.push({ el: s, r1: Math.random() * 2 - 1, r2: Math.random(), r3: Math.random() * 2 - 1 });
    });
  });

  /* ---------- Sfere ---------- */
  let heroSpread = 0, heroBoost = 0;
  const heroCanvas = $("#orb");
  if (heroCanvas) IrbasOrb(heroCanvas, { detail: mobile ? "light" : "full", phase: () => "idle", spread: () => heroSpread, boost: () => heroBoost });
  $$("[data-mini-orb]").forEach((c) => IrbasOrb(c, { detail: "compact", phase: () => "listening" }));

  /* ---------- Stelle ---------- */
  const stars = $("#stars"), sctx = stars.getContext("2d");
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
  function drawStars(scroll, t, v) {
    sctx.clearRect(0, 0, innerWidth, innerHeight);
    const H = innerHeight * 3, stretch = clamp(Math.abs(v) * 0.6, 0, 40);
    for (const s of starList) {
      let yy = (s.y - scroll * s.z) % H; if (yy < 0) yy += H;
      if (yy > innerHeight) continue;
      const a = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(t * 1.2 + s.tw)) * s.z * 1.6;
      sctx.fillStyle = `rgba(${s.c},${a})`;
      if (stretch > 2) {
        // con lo scroll veloce le stelle diventano scie
        sctx.fillRect(s.x - s.r / 2, yy, s.r, stretch * s.z * Math.sign(v || 1));
      } else {
        sctx.beginPath(); sctx.arc(s.x, yy, s.r, 0, 6.283); sctx.fill();
      }
    }
  }
  makeStars();
  addEventListener("resize", makeStars);

  /* ---------- Titoli che si compongono ---------- */
  const splits = $$("[data-split]").map((h) => {
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const s = document.createElement("span"); s.className = "sw"; s.textContent = part; frag.appendChild(s);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== "BR") {
          if (n.classList.contains("grad")) { n.classList.add("sw"); return; } // la parte colorata si muove intera
          walk(n);
        }
      });
    };
    walk(h);
    return { h, words: $$(".sw", h) };
  });

  /* ---------- Manifesto ---------- */
  const manifesto = $("[data-words]");
  const keys = ["agisce", "Mac,", "lo", "fa:", "l'ok"];
  if (manifesto) {
    manifesto.innerHTML = manifesto.textContent.trim().split(/\s+/)
      .map((w) => `<span class="w${keys.includes(w) ? " is-key" : ""}">${w}</span>`).join(" ");
  }
  const words = $$(".manifesto__text .w");

  /* ---------- Comparse e contatori ---------- */
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

  /* ---------- Grafo del cervello (si monta con lo scroll) ---------- */
  function makeGraph(canvas, n, seed) {
    const ctx = canvas.getContext("2d");
    let a = seed;
    const r = () => ((a = (a * 16807) % 2147483647) / 2147483647);
    const nodes = Array.from({ length: n }, (_, i) => ({
      x: r(), y: r(), vx: (r() - 0.5) * 0.0004, vy: (r() - 0.5) * 0.0004,
      fx: r() * 3 - 1, fy: r() * 3 - 1, // da dove arriva quando il grafo si monta
      s: i === 0 ? 7 : 1.5 + r() * 3, c: r() < 0.6 ? "139,233,255" : "138,125,255",
    }));
    nodes[0].x = 0.5; nodes[0].y = 0.5; nodes[0].vx = nodes[0].vy = 0;
    const links = [];
    nodes.forEach((_, i) => {
      if (i === 0) return;
      links.push([i, r() < 0.35 ? 0 : (r() * i) | 0]);
      if (r() < 0.5) links.push([i, (r() * n) | 0]);
    });
    let w = 0, h = 0, d = 1, visible = false;
    const size = () => { d = Math.min(2, devicePixelRatio || 1); const b = canvas.getBoundingClientRect(); w = b.width; h = b.height; canvas.width = w * d; canvas.height = h * d; };
    size(); new ResizeObserver(size).observe(canvas);
    new IntersectionObserver((e) => (visible = e[0].isIntersecting)).observe(canvas);
    return function draw(t, build = 1) {
      if (!visible) return;
      ctx.setTransform(d, 0, 0, d, 0, 0); ctx.clearRect(0, 0, w, h);
      const pos = nodes.map((p, i) => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0.04 || p.x > 0.96) p.vx *= -1;
        if (p.y < 0.06 || p.y > 0.94) p.vy *= -1;
        const k = smooth(i / n * 0.5, i / n * 0.5 + 0.5, build);
        return [lerp(p.fx, p.x, k) * w, lerp(p.fy, p.y, k) * h, k];
      });
      ctx.lineWidth = 1;
      for (const [i, j] of links) {
        const A = pos[i], B = pos[j], k = Math.min(A[2], B[2]);
        if (k < 0.05) continue;
        const pulse = 0.5 + 0.5 * Math.sin(t * 1.5 + i * 0.7);
        ctx.strokeStyle = `rgba(139,233,255,${(0.05 + 0.12 * pulse) * k})`;
        ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke();
      }
      nodes.forEach((p, i) => {
        const [x, yy, k] = pos[i];
        ctx.fillStyle = `rgba(${p.c},${0.25 + 0.6 * k})`;
        ctx.shadowColor = `rgba(${p.c},.9)`; ctx.shadowBlur = p.s * 3;
        ctx.beginPath(); ctx.arc(x, yy, p.s, 0, 6.283); ctx.fill();
      });
      ctx.shadowBlur = 0;
    };
  }
  const bigGraph = $("#graph") ? makeGraph($("#graph"), mobile ? 60 : 120, 7) : null;
  const miniGraph = $("[data-mini-graph]") ? makeGraph($("[data-mini-graph]"), 46, 3) : null;

  /* ---------- Inclinazione delle tessere col mouse ---------- */
  const tilt = new WeakMap();
  $$("[data-tilt]").forEach((el) => {
    tilt.set(el, "");
    el.addEventListener("pointermove", (e) => {
      const b = el.getBoundingClientRect();
      const x = (e.clientX - b.left) / b.width, yy = (e.clientY - b.top) / b.height;
      el.style.setProperty("--mx", `${x * 100}%`); el.style.setProperty("--my", `${yy * 100}%`);
      tilt.set(el, `perspective(900px) rotateY(${(x - 0.5) * 6}deg) rotateX(${(0.5 - yy) * 6}deg)`);
    });
    el.addEventListener("pointerleave", () => tilt.set(el, ""));
  });

  /* ---------- Elementi ---------- */
  const nav = $("#nav"), bar = $("#progress");
  const heroOrb = $("[data-hero-orb]"), heroContent = $(".hero__content");
  const heroBits = $$(".hero__lead, .hero__actions, .hero__hint, .hero .kicker");
  const speedEls = $$("[data-speed]");
  const ribbon = $("[data-ribbon]");
  const voice = $("#voce"), pill = $("[data-pill]"), pillLabel = $("[data-pill-label]");
  const phrases = $$("[data-phrase]"), steps = $$("[data-steps] li");
  const team = $("#squadra"), track = $("[data-track]"), agents = $$(".agent");
  const home = $("#app"), mac = $("[data-mac]"), macImg = $("[data-mac-screen] img"), spot = $("[data-spot]");
  const homeHead = $(".realhome__head"), callouts = $$("[data-callout]"), stage = $(".realhome__stage");
  const apps = $("#microapp"), sidePan = $("[data-side-pan]"), sideHl = $("[data-side-hl]"), sideVp = $(".side__viewport");
  const appTitles = $$(".app-t"), previews = $$(".pv"), appN = $("[data-app-n]"), preview = $("[data-preview]");
  const brain = $("#cervello");
  const tiles = $$(".tile");
  const plans = $$(".plan");
  const ctaLogo = $("[data-cta-logo]"), cta = $("#contatti");
  const navLinks = $$(".nav__links a");
  const sections = navLinks.map((a) => $(a.getAttribute("href")));

  // Centri delle voci nella sidebar vera (in % dell'altezza dell'immagine)
  const SIDE_Y = [9.14, 16.3, 20.5, 24.6, 31.9, 39.1, 46.4, 53.6, 60.9, 65.1, 69.3, 73.5];

  // Callout: a destra del punto se il punto è a sinistra, e viceversa
  callouts.forEach((c) => {
    const x = +c.dataset.x, yy = +c.dataset.y;
    if (x > 60) c.style.right = `${100 - x + 7}%`;
    else if (x > 20) c.style.left = "66%";
    else c.style.left = `${x + 10}%`;
    c.style.top = `clamp(0px, calc(${yy}% - 70px), calc(100% - 200px))`;
  });

  const sceneProgress = (el) => { const b = el.getBoundingClientRect(); return clamp(-b.top / (b.height - innerHeight)); };
  const enterProgress = (el, a = 0.95, span = 0.6) => { const b = el.getBoundingClientRect(); return clamp((innerHeight * a - b.top) / (innerHeight * span)); };

  let lastStep = -1, lastApp = -1;

  function loop(now) {
    const t = now / 1000;
    y = scrollY;
    const prev = sy;
    sy = reduced ? y : lerp(sy, y, 0.14); // scroll morbido per gli effetti
    vel = sy - prev; svel = lerp(svel, vel, 0.2);
    const max = document.documentElement.scrollHeight - innerHeight;

    bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    nav.classList.toggle("is-solid", y > 40);
    drawStars(sy, t, svel);

    /* Hero: le lettere si disperdono, la sfera si apre e accelera */
    const hp = clamp(sy / (innerHeight * 0.9));
    heroSpread = hp * 1.4;
    heroBoost = clamp(Math.abs(svel) * 0.03, 0, 2.5);
    if (!reduced) {
      heroOrb.style.transform = `translate(-50%, calc(-50% + ${sy * 0.3}px)) scale(${1 + hp * 0.5})`;
      heroOrb.style.opacity = 1 - smooth(0.5, 1, hp);
      chars.forEach((c, i) => {
        const k = smooth(0, 0.8, hp - c.r2 * 0.15);
        c.el.style.transform = `translate3d(${c.r1 * k * 260}px, ${-k * (160 + c.r2 * 260)}px, ${k * 200}px) rotate(${c.r3 * k * 70}deg)`;
        c.el.style.opacity = 1 - k;
        c.el.style.filter = k > 0.01 ? `blur(${k * 10}px)` : "";
      });
      heroBits.forEach((b, i) => { const k = smooth(0.05 + i * 0.04, 0.45 + i * 0.04, hp); b.style.transform = `translateY(${-k * 80}px)`; b.style.opacity = 1 - k; });
      heroContent.style.pointerEvents = hp > 0.4 ? "none" : "";

      speedEls.forEach((el) => {
        const b = el.parentElement.getBoundingClientRect();
        el.style.transform = `translate3d(0, ${(b.top + b.height / 2 - innerHeight / 2) * +el.dataset.speed}px, 0)`;
      });
      ribbon.style.transform = `translateX(${-(sy * 0.5) % (ribbon.scrollWidth / 2)}px) skewX(${clamp(-svel * 0.25, -14, 14)}deg)`;
    }

    /* Titoli che si compongono parola per parola */
    splits.forEach(({ h, words: ws }) => {
      const p = enterProgress(h, 0.92, 0.5);
      ws.forEach((w, i) => w.style.setProperty("--k", smooth(0, 1, p * 1.6 - (i / ws.length) * 0.6)));
    });

    /* Manifesto */
    if (words.length) {
      const b = manifesto.getBoundingClientRect();
      const p = clamp((innerHeight * 0.85 - b.top) / (b.height + innerHeight * 0.35));
      const lit = Math.floor(p * words.length * 1.05);
      words.forEach((w, i) => w.classList.toggle("is-lit", i < lit));
    }

    /* La home vera: entra in 3D, poi zoom e luce sulle sue parti */
    const rp = sceneProgress(home);
    const enter = smooth(0, 0.16, rp);
    mac.style.transform = `translateY(${(1 - enter) * 22}vh) rotateX(${(1 - enter) * 58}deg) scale(${0.62 + enter * 0.38})`;
    mac.style.opacity = 0.3 + enter * 0.7;
    homeHead.style.opacity = 1 - smooth(0.16, 0.24, rp);
    homeHead.style.transform = `translateY(${-smooth(0.16, 0.24, rp) * 40}px)`;
    const seg = clamp((rp - 0.2) / 0.76) * callouts.length;
    const idx = Math.min(callouts.length - 1, Math.floor(seg));
    const local = seg - idx;
    const inSeg = rp > 0.2 && rp < 0.96;
    const zf = inSeg ? smooth(0.1, 0.4, local) * (1 - smooth(0.82, 1, local)) : 0;
    // il punto di zoom scivola dal punto precedente al nuovo mentre l'immagine è quasi intera
    const cur = callouts[idx], prv = callouts[Math.max(0, idx - 1)];
    const mv = idx === 0 ? 1 : smooth(0, 0.25, local);
    const fx = lerp(+prv.dataset.x, +cur.dataset.x, mv), fy = lerp(+prv.dataset.y, +cur.dataset.y, mv);
    const sc = 1 + (+cur.dataset.z - 1) * zf;
    macImg.style.transformOrigin = "0 0";
    macImg.style.transform = `translate(${fx * (1 - sc)}%, ${fy * (1 - sc)}%) scale(${sc})`;
    spot.style.setProperty("--sx", `${fx}%`); spot.style.setProperty("--sy", `${fy}%`);
    spot.style.setProperty("--so", zf);
    spot.style.setProperty("--sr", `${lerp(500, 110, zf)}px`);
    callouts.forEach((el, i) => el.classList.toggle("is-on", inSeg && i === idx && zf > 0.5));
    stage.style.transform = `translateY(${(1 - enter) * 0}px)`;

    /* Voce */
    const vp = sceneProgress(voice);
    pill.style.setProperty("--p", vp);
    const step = Math.min(phrases.length - 1, Math.floor(vp * phrases.length));
    if (step !== lastStep) {
      phrases.forEach((p, i) => { p.classList.toggle("is-on", i === step); p.classList.toggle("is-past", i < step); });
      lastStep = step;
    }
    const within = (vp * phrases.length) % 1;
    const vstage = within < 0.3 ? 0 : within < 0.55 ? 1 : 2;
    steps.forEach((s, i) => s.classList.toggle("is-on", i <= vstage));
    pill.classList.toggle("is-thinking", vstage === 1);
    pillLabel.textContent = ["In ascolto…", "Ci penso…", "Fatto ✓"][vstage];

    /* Squadra: scorrimento orizzontale + carte in 3D */
    const tp = sceneProgress(team);
    const dist = track.scrollWidth - innerWidth + 48;
    track.style.transform = `translate3d(${-tp * Math.max(0, dist)}px,0,0) skewX(${clamp(-svel * 0.08, -6, 6)}deg)`;
    if (!reduced) {
      agents.forEach((a) => {
        const b = a.getBoundingClientRect();
        const d = clamp((b.left + b.width / 2 - innerWidth / 2) / (innerWidth / 2), -1.4, 1.4);
        a.style.transform = `perspective(1200px) rotateY(${-d * 28}deg) translateZ(${-Math.abs(d) * 140}px) scale(${1 - Math.abs(d) * 0.06})`;
        a.style.opacity = 1 - Math.abs(d) * 0.3;
      });
    }

    /* Le micro app: la sidebar vera scorre, l'evidenziatore si ferma su ogni voce */
    const ap = sceneProgress(apps);
    const f = clamp(ap * SIDE_Y.length - 0.5, 0, SIDE_Y.length - 1);
    const fi = Math.floor(f), fr = f - fi;
    const snap = fi + smooth(0.35, 0.75, fr);
    const a0 = SIDE_Y[Math.min(SIDE_Y.length - 1, Math.floor(snap))], a1 = SIDE_Y[Math.min(SIDE_Y.length - 1, Math.floor(snap) + 1)];
    const hlY = lerp(a0, a1, snap - Math.floor(snap));
    const imgH = sidePan.offsetHeight, vpH = sideVp.offsetHeight;
    const pan = clamp((hlY / 100) * imgH - vpH / 2, 0, Math.max(0, imgH - vpH));
    sidePan.style.transform = `translate3d(0, ${-pan}px, 0)`;
    sideHl.style.top = `${hlY - 2.3}%`;
    const ai = Math.min(SIDE_Y.length - 1, Math.round(snap));
    if (ai !== lastApp) {
      appTitles.forEach((el, i) => { el.classList.toggle("is-on", i === ai); el.classList.toggle("is-past", i < ai); });
      previews.forEach((el, i) => el.classList.toggle("is-on", i === ai));
      appN.textContent = String(ai + 1).padStart(2, "0");
      lastApp = ai;
    }
    const wob = Math.sin(fr * Math.PI);
    preview.style.transform = `perspective(1400px) rotateX(${wob * 6}deg) rotateY(${-wob * 8}deg) translateZ(${-wob * 40}px)`;

    /* Cervello: il grafo si monta entrando */
    const build = enterProgress(brain, 1, 0.9);
    if (bigGraph) bigGraph(t, build);
    if (miniGraph) miniGraph(t, 1);

    /* Tessere: parallax a colonne */
    tiles.forEach((el, i) => {
      const b = el.getBoundingClientRect();
      const sp = [0.06, -0.04, 0.1][i % 3];
      const off = reduced ? 0 : (b.top + b.height / 2 - innerHeight / 2) * sp;
      el.style.transform = `translateY(${off}px) ${tilt.get(el) || ""}`;
    });
    plans.forEach((el, i) => {
      const k = enterProgress(el, 1, 0.7);
      el.style.transform = `translateY(${(1 - k) * (80 + i * 60)}px) rotateX(${(1 - k) * 20}deg)`;
      el.style.opacity = 0.2 + k * 0.8;
    });

    /* Logo del CTA: gli archi si chiudono intorno alla barra */
    if (ctaLogo) {
      const k = smooth(0, 1, enterProgress(cta, 0.9, 0.7));
      ctaLogo.querySelector(".arc--r").style.transform = `translateX(${(1 - k) * 60}px) rotate(${(1 - k) * 120}deg)`;
      ctaLogo.querySelector(".arc--l").style.transform = `translateX(${-(1 - k) * 60}px) rotate(${(1 - k) * 120}deg)`;
      ctaLogo.querySelector(".bar").style.transform = `scaleY(${0.2 + k * 0.8})`;
      ctaLogo.style.opacity = k;
    }

    /* Voce del menu attiva */
    let active = -1;
    sections.forEach((s, i) => { if (s && s.getBoundingClientRect().top < innerHeight * 0.4) active = i; });
    navLinks.forEach((a, i) => a.classList.toggle("is-active", i === active));

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
