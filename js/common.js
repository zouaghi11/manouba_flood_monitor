/* FloodWatch Manouba - shared code: language, rainfall, alert rules, map. No build step, no dependencies except Leaflet. */
(function () {
  "use strict";
  var FWApp = (window.FWApp = {});
  var C = window.FW;

  /* ---------- small helpers ---------- */
  function store(key, val) {                       // localStorage that never throws
    try { if (val === undefined) { var v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } localStorage.setItem(key, JSON.stringify(val)); } catch (e) { return null; }
    return val;
  }
  FWApp.store = store;
  var $ = function (id) { return document.getElementById(id); };
  FWApp.$ = $;
  function el(tag, attrs, html) { var n = document.createElement(tag); for (var k in (attrs || {})) n.setAttribute(k, attrs[k]); if (html != null) n.innerHTML = html; return n; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  FWApp.esc = esc;
  function fetchJSON(url) { return fetch(url, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(url + " " + r.status); return r.json(); }); }

  /* ---------- language ---------- */
  var lang = store("fw_lang") || ((navigator.language || "en").slice(0, 2) === "fr" ? "fr" : "en");
  var langHooks = [];
  function t(k) { return (I18N[lang] && I18N[lang][k]) || I18N.en[k] || k; }
  FWApp.t = t; FWApp.lang = function () { return lang; };
  FWApp.onLang = function (fn) { langHooks.push(fn); };
  function applyLang() {
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach(function (n) { n.textContent = t(n.getAttribute("data-i18n")); });
    document.querySelectorAll("[data-i18n-ph]").forEach(function (n) { n.setAttribute("placeholder", t(n.getAttribute("data-i18n-ph"))); });
    langHooks.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
  }
  function setLang(l) { lang = l; store("fw_lang", l); applyLang(); markLang(); }
  function markLang() { document.querySelectorAll(".langbtn").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-l") === lang ? "true" : "false"); }); }

  FWApp.mount = function (page) {                  // builds the shared header and footer
    var h = el("header", { "class": "top" });
    h.innerHTML = '<a class="brand" href="index.html">FloodWatch <span>Manouba</span></a><nav aria-label="Main">' +
      '<a href="index.html"' + (page === "home" ? ' aria-current="page"' : "") + ' data-i18n="nav_home"></a>' +
      '<a href="citizen.html"' + (page === "citizen" ? ' aria-current="page"' : "") + ' data-i18n="nav_citizen"></a>' +
      '<a href="municipality.html"' + (page === "muni" ? ' aria-current="page"' : "") + ' data-i18n="nav_muni"></a></nav>' +
      '<div class="langs" role="group" aria-label="Language"><button class="langbtn" data-l="en" type="button">EN</button><button class="langbtn" data-l="fr" type="button">FR</button></div>';
    document.body.insertBefore(h, document.body.firstChild);
    h.querySelectorAll(".langbtn").forEach(function (b) { b.addEventListener("click", function () { setLang(b.getAttribute("data-l")); }); });
    var f = el("footer", { "class": "foot" }, '<p data-i18n="footer"></p><p class="small"><a href="https://open-meteo.com/" target="_blank" rel="noopener">Weather data by Open-Meteo.com</a> (<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>) · Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors · Land cover © ESA WorldCover</p>');
    document.body.appendChild(f);
    applyLang(); markLang();
  };

  /* ---------- rainfall data (Open-Meteo, hourly precipitation) ---------- */
  function localHour() { var s = new Date().toLocaleString("sv-SE", { timeZone: C.tz, hour12: false }); return s.slice(0, 13).replace(" ", "T") + ":00"; }
  FWApp.loadRain = function (mode) {
    var url;
    if (mode === "replay") {
      url = "https://archive-api.open-meteo.com/v1/archive?latitude=" + C.lat + "&longitude=" + C.lon + "&start_date=" + C.replay.start + "&end_date=" + C.replay.end + "&hourly=precipitation&timezone=" + encodeURIComponent(C.tz);
    } else {
      url = "https://api.open-meteo.com/v1/forecast?latitude=" + C.lat + "&longitude=" + C.lon + "&hourly=precipitation&past_days=2&forecast_days=2&timezone=" + encodeURIComponent(C.tz);
    }
    return fetchJSON(url).then(function (d) {
      if (!d.hourly || !d.hourly.time) throw new Error("bad rainfall response");
      return { times: d.hourly.time, values: d.hourly.precipitation, mode: mode };
    });
  };
  FWApp.nowIndex = function (s) {
    var h = localHour(), i = s.times.indexOf(h);
    if (i >= 0) return i;
    for (var k = s.times.length - 1; k >= 0; k--) if (s.times[k] <= h) return k;
    return -1;
  };

  /* ---------- alert rules (see Table 6 of the report) ---------- */
  var WINDOWS = [1, 3, 6, 24], ORDER = { unknown: -1, standby: 0, watch: 1, alert: 2 };
  function sum(v, a, b) { var s = 0; for (var i = a; i <= b; i++) { if (v[i] == null) return null; s += v[i]; } return Math.round(s * 10) / 10; }
  FWApp.evaluate = function (s, idx, opts) {
    opts = opts || {};
    var out = { level: "standby", reasons: [], past: {}, fcst: {}, time: idx >= 0 ? s.times[idx] : null };
    if (idx < 0) { out.level = "unknown"; return out; }
    var need = Math.min(C.maxDataAgeHours, idx + 1);                        // recent hours must exist
    for (var k = 0; k < need; k++) if (s.values[idx - k] == null) { out.level = "unknown"; return out; }
    WINDOWS.forEach(function (w) {
      var dirs = opts.forecast === false ? ["past"] : ["past", "fcst"];
      dirs.forEach(function (d) {
        var v = d === "past" ? (idx - w + 1 >= 0 ? sum(s.values, idx - w + 1, idx) : null) : (idx + w < s.values.length ? sum(s.values, idx + 1, idx + w) : null);
        out[d][w] = v;
        if (v == null) return;
        var lvl = v >= C.thresholds.alert[w] ? "alert" : v >= C.thresholds.watch[w] ? "watch" : null;
        if (lvl) { out.reasons.push({ dir: d, w: w, mm: v, thr: C.thresholds[lvl][w], lvl: lvl }); if (ORDER[lvl] > ORDER[out.level]) out.level = lvl; }
      });
    });
    return out;
  };
  FWApp.renderBanner = function (node, res, mode) {
    var sym = { standby: "●", watch: "▲", alert: "■", unknown: "?" }[res.level];
    node.className = "banner lvl-" + res.level;
    node.innerHTML = '<div class="b-head"><span class="b-sym" aria-hidden="true">' + sym + '</span><strong>' + t("lvl_" + res.level) + '</strong></div>' +
      '<p>' + t("lvl_" + res.level + "_msg") + '</p><p class="small">' + t("advisory_note") + (res.time ? ' &middot; ' + t("updated") + ": " + esc(res.time.replace("T", " ")) : "") +
      ' &middot; ' + t(mode === "replay" ? "mode_replay" : "mode_live") + '</p>';
  };
  FWApp.levelLabel = function (l) { return t("lvl_" + l); };

  /* ---------- event log (this browser) ---------- */
  FWApp.logLevel = function (res) {
    var log = store("fw_log") || [];
    var last = log.length ? log[log.length - 1].level : null;
    if (last !== res.level) { log.push({ at: new Date().toISOString(), level: res.level, time: res.time }); store("fw_log", log.slice(-100)); }
    return store("fw_log") || log;
  };

  /* ---------- hourly rain chart (inline SVG) ---------- */
  FWApp.rainChart = function (node, s, idx, from, to) {
    var v = s.values.slice(from, to + 1), n = v.length, W = 720, H = 200, pl = 34, pb = 22, pt = 8;
    var max = Math.max(10, Math.ceil(Math.max.apply(null, v.map(function (x) { return x || 0; })) / 5) * 5);
    var bw = (W - pl - 6) / n, g = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(t("rain_h")) + '">';
    for (var y = 0; y <= 4; y++) { var yy = pt + (H - pt - pb) * y / 4; g += '<line x1="' + pl + '" x2="' + W + '" y1="' + yy + '" y2="' + yy + '" class="grid"/><text x="' + (pl - 4) + '" y="' + (yy + 3) + '" text-anchor="end">' + Math.round(max * (1 - y / 4)) + "</text>"; }
    v.forEach(function (x, i) {
      var h = x == null ? 0 : (H - pt - pb) * x / max, xx = pl + i * bw, isF = from + i > idx;
      g += '<rect x="' + (xx + 0.5) + '" y="' + (H - pb - h) + '" width="' + Math.max(1, bw - 1) + '" height="' + h + '" class="' + (isF ? "bar fc" : "bar") + '"><title>' + esc(s.times[from + i].replace("T", " ")) + ": " + (x == null ? "-" : x) + " mm</title></rect>";
      if (i % Math.ceil(n / 8) === 0) g += '<text x="' + (xx + bw / 2) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(s.times[from + i].slice(5, 13).replace("T", " ") + "h") + "</text>";
    });
    if (idx >= from && idx <= to) { var nx = pl + (idx - from + 1) * bw; g += '<line x1="' + nx + '" x2="' + nx + '" y1="' + pt + '" y2="' + (H - pb) + '" class="now"/>'; }
    node.innerHTML = g + "</svg>";
  };

  /* ---------- reports (this browser only) ---------- */
  FWApp.getReports = function () { return store("fw_reports") || []; };
  FWApp.addReport = function (r) { var a = FWApp.getReports(); a.push(r); store("fw_reports", a.slice(-200)); };

  /* ---------- map ---------- */
  var RISKNAME = { 0: "water", 1: "low", 2: "medium", 3: "high" };
  FWApp.RISKNAME = RISKNAME;
  FWApp.buildMap = function (id, opts) {
    opts = opts || {};
    var map = L.map(id, { center: C.center, zoom: C.zoom, minZoom: 8, maxZoom: 17 });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }).addTo(map);
    var api = { map: map, layers: {}, meta: null, sampler: null, ready: null };
    var overlays = {}, ctl = null;

    function rebuildControl() {
      if (ctl) ctl.remove();
      var o = {}; Object.keys(overlays).forEach(function (k) { o[t(overlays[k].label)] = overlays[k].layer; });
      ctl = L.control.layers(null, o, { collapsed: window.innerWidth < 700 }).addTo(map);
    }
    function add(key, layer, label, on) { api.layers[key] = layer; overlays[key] = { layer: layer, label: label }; if (on) layer.addTo(map); }

    api.ready = fetchJSON(C.files.meta).then(function (meta) {
      api.meta = meta;
      var b = meta.bounds;                                   // [[south, west], [north, east]]
      var risk = L.imageOverlay(C.files.risk, b, { opacity: 0.65, interactive: false });
      risk.on("error", function () { var m = $("map-msg"); if (m) m.textContent = "data/risk_overlay.png not found"; });
      add("risk", risk, "layer_risk", true);
      if (opts.flood !== false) add("flood", L.imageOverlay(C.files.flood, b, { opacity: 0.9, interactive: false }), "layer_flood", false);
      fetchJSON(C.files.boundary).then(function (g) {
        add("bound", L.geoJSON(g, { style: { color: "#222", weight: 2, fill: false }, interactive: false }), "layer_bound", true); rebuildControl();
        try { if (!opts.noFit) map.fitBounds(api.layers.bound.getBounds(), { padding: [10, 10] }); } catch (e) {}
      }).catch(function () { try { map.fitBounds(b); } catch (e) {} });
      if (opts.facilities && meta.facilities) {
        var fg = L.layerGroup(); var col = { 1: "#2e7d32", 2: "#ef6c00", 3: "#c62828" };
        meta.facilities.forEach(function (f) {
          L.circleMarker([f.lat, f.lon], { radius: 6, color: "#000", weight: 1, fillColor: col[f.cls] || "#888", fillOpacity: 0.95 })
            .bindTooltip(esc((f.type === "hospital" ? "+ " : "") + (f.name || f.type)) + " (" + t("risk_" + RISKNAME[f.cls]) + ")").addTo(fg);
        });
        add("fac", fg, "layer_fac", true);
      }
      if (opts.reports) { var rg = L.layerGroup(); api.layers.reports = rg; add("reports", rg, "layer_reports", true); api.refreshReports = function () { rg.clearLayers(); FWApp.getReports().forEach(function (r) { L.marker([r.lat, r.lon], { title: r.type }).bindPopup(esc(r.type) + "<br>" + esc(r.depth) + "<br>" + esc(r.note || "") + "<br><small>" + esc(r.at) + "</small>").addTo(rg); }); }; api.refreshReports(); }
      rebuildControl();
      addLegend(meta);
      return loadSampler(meta).then(function (s) { api.sampler = s; return api; });
    });

    function addLegend(meta) {
      var lg = L.control({ position: "bottomright" });
      lg.onAdd = function () {
        var d = L.DomUtil.create("div", "legend"); d.setAttribute("role", "group");
        var draw = function () { d.innerHTML = "<strong>" + t("risk_title") + "</strong>" + ["high", "medium", "low", "water"].map(function (k) { var c = meta.palette[k]; return '<div><i style="background:rgb(' + c.join(",") + ')"></i>' + t("risk_" + k) + "</div>"; }).join(""); };
        draw(); FWApp.onLang(draw); return d;
      };
      lg.addTo(map);
    }
    FWApp.onLang(rebuildControl);

    function loadSampler(meta) {                           // reads the colour of the overlay pixel under a point
      return new Promise(function (resolve) {
        var img = new Image();
        img.onload = function () {
          try {
            var cv = document.createElement("canvas"); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
            var cx = cv.getContext("2d", { willReadFrequently: true }); cx.drawImage(img, 0, 0); cx.getImageData(0, 0, 1, 1);
            var m = meta.mercator;
            resolve(function (lat, lon) {
              var p = L.CRS.EPSG3857.project(L.latLng(lat, lon));
              var px = Math.floor((p.x - m[0]) / (m[2] - m[0]) * cv.width), py = Math.floor((m[3] - p.y) / (m[3] - m[1]) * cv.height);
              if (px < 0 || py < 0 || px >= cv.width || py >= cv.height) return { cls: null };
              var d = cx.getImageData(px, py, 1, 1).data; if (d[3] < 128) return { cls: null };
              var best = null, bd = 1e9;
              [0, 1, 2, 3].forEach(function (k) { var c = meta.palette[RISKNAME[k]], dd = Math.abs(c[0] - d[0]) + Math.abs(c[1] - d[1]) + Math.abs(c[2] - d[2]); if (dd < bd) { bd = dd; best = k; } });
              return { cls: bd < 40 ? best : null };
            });
          } catch (e) { resolve(function () { return { cls: null, error: "canvas" }; }); }
        };
        img.onerror = function () { resolve(function () { return { cls: null, error: "missing" }; }); };
        img.src = C.files.risk;
      });
    }
    return api;
  };

  FWApp.riskText = function (r) {
    if (r.error === "canvas") return t("canvas_fail");
    if (r.cls == null) return t("risk_outside");
    var k = RISKNAME[r.cls];
    return "<strong>" + t("risk_" + k) + "</strong><br>" + t("risk_" + k + "_adv");
  };
})();
