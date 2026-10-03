/* Horizon's Bar · interactions */
(() => {
  const LAT = 1.3481365;
  const LNG = 172.9500475;
  const TZ_OFFSET_H = 12; // Pacific/Tarawa, UTC+12 all year (no DST)
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── Stars ── */
  const stars = document.getElementById("stars");
  if (stars) {
    const count = window.innerWidth < 640 ? 60 : 130;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const s = document.createElement("span");
      s.className = "star";
      const size = Math.random() < 0.85 ? 1 + Math.random() * 1.5 : 2.5 + Math.random();
      s.style.cssText =
        `left:${Math.random() * 100}%;top:${Math.pow(Math.random(), 1.6) * 100}%;` +
        `width:${size}px;height:${size}px;opacity:${0.3 + Math.random() * 0.7};` +
        `--t:${2 + Math.random() * 4}s;--dl:${-Math.random() * 5}s`;
      frag.appendChild(s);
    }
    stars.appendChild(frag);
  }

  /* ── Nav + hero scroll progress ── */
  const nav = document.getElementById("nav");
  const hero = document.getElementById("hero");
  let ticking = false;
  const onScroll = () => {
    const y = window.scrollY;
    nav.classList.toggle("scrolled", y > 40);
    if (!reduceMotion && hero) {
      const p = Math.min(1, Math.max(0, y / (hero.offsetHeight * 0.9)));
      hero.style.setProperty("--p", p.toFixed(3));
    }
    ticking = false;
  };
  window.addEventListener("scroll", () => {
    if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
  onScroll();

  /* ── Scroll reveal ── */
  const items = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
    items.forEach((el) => io.observe(el));
  } else {
    items.forEach((el) => el.classList.add("in"));
  }

  /* ── Sun position (adapted from the SunCalc algorithm) ── */
  const rad = Math.PI / 180, dayMs = 864e5, J1970 = 2440588, J2000 = 2451545, J0 = 0.0009;
  const e = rad * 23.4397;
  const toDays = (d) => d.valueOf() / dayMs - 0.5 + J1970 - J2000;
  const fromJulian = (j) => new Date((j + 0.5 - J1970) * dayMs);
  const meanAnomaly = (d) => rad * (357.5291 + 0.98560028 * d);
  const eclipticLng = (M) =>
    M + rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) + rad * 102.9372 + Math.PI;
  const declination = (L) => Math.asin(Math.sin(e) * Math.sin(L));
  const approxTransit = (Ht, lw, n) => J0 + (Ht + lw) / (2 * Math.PI) + n;
  const transitJ = (ds, M, L) => J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);

  function sunTimes(date) {
    const lw = rad * -LNG, phi = rad * LAT;
    const d = toDays(date);
    const n = Math.round(d - J0 - lw / (2 * Math.PI));
    const ds = approxTransit(0, lw, n);
    const M = meanAnomaly(ds);
    const L = eclipticLng(M);
    const dec = declination(L);
    const noon = transitJ(ds, M, L);
    const h0 = -0.833 * rad;
    const w = Math.acos((Math.sin(h0) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)));
    const set = transitJ(approxTransit(w, lw, n), M, L);
    return { sunrise: fromJulian(noon - (set - noon)), sunset: fromJulian(set) };
  }

  const fmt = (d, withSeconds = false) => {
    const t = new Date(d.valueOf() + TZ_OFFSET_H * 36e5);
    const pad = (x) => String(x).padStart(2, "0");
    return `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}` + (withSeconds ? `:${pad(t.getUTCSeconds())}` : "");
  };
  const duration = (ms) => {
    const m = Math.max(0, Math.round(ms / 6e4));
    const h = Math.floor(m / 60);
    return h ? `${h}h ${m % 60}m` : `${m}m`;
  };

  const $ = (id) => document.getElementById(id);
  const arcFill = $("arcFill"), arcSun = $("arcSun");
  const arcLen = arcFill ? arcFill.getTotalLength() : 0;
  if (arcFill) arcFill.style.strokeDasharray = `${arcLen} ${arcLen}`;

  function tick() {
    const now = new Date();
    const today = sunTimes(now);
    const afterSunset = now > today.sunset;
    const next = afterSunset ? sunTimes(new Date(now.valueOf() + dayMs)).sunset : today.sunset;
    const untilNext = next - now;

    $("localTime").textContent = fmt(now);
    $("sunsetLabel").textContent = afterSunset ? "Tomorrow's sunset" : "Sunset in";
    $("sunsetCountdown").textContent = afterSunset ? fmt(next) : duration(untilNext);

    $("sunsetBig").textContent = fmt(next);
    $("sunriseLbl").textContent = `Sunrise ${fmt(today.sunrise)}`;
    $("sunsetLbl").textContent = `Sunset ${fmt(today.sunset)}`;

    const goldenHour = new Date(next.valueOf() - 30 * 6e4);
    $("sunsetSub").textContent = afterSunset
      ? `Tonight's sunset is over. The next one is in ${duration(untilNext)}.`
      : now > goldenHour
        ? `Golden hour has started. Sunset is in ${duration(untilNext)}.`
        : `That's ${duration(untilNext)} from now. Get here by ${fmt(goldenHour)} for golden hour.`;

    // Sun along the arc: 0 = sunrise, 1 = sunset
    const f = Math.min(1, Math.max(0, (now - today.sunrise) / (today.sunset - today.sunrise)));
    const theta = Math.PI * (1 - f);
    if (arcSun) {
      arcSun.setAttribute("cx", (200 + 180 * Math.cos(theta)).toFixed(1));
      arcSun.setAttribute("cy", (130 - 120 * Math.sin(theta)).toFixed(1));
      arcSun.style.opacity = now < today.sunrise || afterSunset ? 0.35 : 1;
    }
    if (arcFill) arcFill.style.strokeDashoffset = (arcLen * (1 - f)).toFixed(1);
  }
  tick();
  setInterval(tick, 15000);

  $("year").textContent = new Date().getFullYear();
})();
