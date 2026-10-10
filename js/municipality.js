(function () {
  FWApp.mount("muni");
  var $ = FWApp.$, t = FWApp.t, esc = FWApp.esc, mode = "live", series = null, idx = -1, res = null, meta = null, mapApi = null, lastOk = 0, facs = [], facOpen = false;
  var fmt = function (n, d) { return Number(n).toLocaleString(FWApp.lang() === "fr" ? "fr-FR" : "en-GB", { maximumFractionDigits: d || 0 }); };

  function renderWhy() {
    if (!res) return;
    var h = res.reasons.length ? "<ul class='clean'>" + res.reasons.map(function (r) {
      return "<li><strong>" + FWApp.levelLabel(r.lvl) + "</strong>: " + r.w + " h " + t(r.dir === "past" ? "past" : "fcst") + " = " + r.mm + " " + t("mm") + " (" + t("thr") + " " + r.thr + ")</li>"; }).join("") + "</ul>" : "<p>" + t("why_none") + "</p>";
    $("why").innerHTML = h;
    $("thr").textContent = t("thr_note") + ": " + [1, 3, 6, 24].map(function (w) { return w + "h " + FW.thresholds.watch[w] + "/" + FW.thresholds.alert[w]; }).join(", ");
  }
  function renderLog() {
    var log = FWApp.store("fw_log") || [];
    $("log").innerHTML = log.length ? log.slice().reverse().slice(0, 15).map(function (l) { return "<li>" + esc(l.at.replace("T", " ").slice(0, 16)) + " &rarr; <strong>" + FWApp.levelLabel(l.level) + "</strong></li>"; }).join("") : "<li>" + t("log_none") + "</li>";
  }
  function renderReports() {
    var r = FWApp.getReports();
    $("reps").innerHTML = r.length ? r.slice().reverse().slice(0, 10).map(function (x) { return "<li>" + esc(x.at.slice(0, 16).replace("T", " ")) + " - " + esc(x.type) + ", " + esc(x.depth) + (x.note ? " - " + esc(x.note) : "") + "</li>"; }).join("") : "<li>" + t("rep_empty") + "</li>";
  }
  var FAC_TOP = 5;
  function renderFac() {                                          // top 5 by default, "Show more / Show less" for the rest
    var shown = facOpen ? facs : facs.slice(0, FAC_TOP), tg = $("fac-toggle");
    $("fac").innerHTML = shown.length ? shown.map(function (x) { return "<li><a href='#' data-ll='" + x.lat + "," + x.lon + "'>" + esc(x.name || x.type) + "</a> <span class='small'>(" + (x.type === "hospital" ? t("fac_hos") : t("fac_sch")) + ", " + t("risk_" + FWApp.RISKNAME[x.cls]) + ")</span></li>"; }).join("") : "<li>" + t("fac_none") + "</li>";
    $("fac").classList.toggle("scroll", facOpen);
    tg.hidden = facs.length <= FAC_TOP;
    tg.textContent = facOpen ? t("fac_less") : t("fac_more") + " (" + (facs.length - FAC_TOP) + ")";
    tg.setAttribute("aria-expanded", facOpen ? "true" : "false");
    document.querySelectorAll("#fac a").forEach(function (a) { a.addEventListener("click", function (ev) { ev.preventDefault(); if (mapApi) mapApi.map.setView(a.getAttribute("data-ll").split(",").map(Number), 16); }); });
  }
  function renderMeta() {
    if (!meta) return;
    var e = meta.exposure || {}, a = meta.areas_km2 || {};
    var k = [];
    if (a.high != null) k.push([fmt(a.high, 1) + " " + t("unit_km2"), "kpi_high_area"]);
    if (e.buildings) k.push([fmt(e.buildings.high), "kpi_bld"]);
    if (e.roads_km) k.push([fmt(e.roads_km.high) + " " + t("unit_km"), "kpi_road"]);
    if (e.hospitals && e.schools) k.push([fmt(e.hospitals.medium + e.hospitals.high + e.schools.medium + e.schools.high), "kpi_fac"]);
    $("kpis").innerHTML = k.map(function (x) { return "<div class='kpi'><b>" + x[0] + "</b><span>" + t(x[1]) + "</span></div>"; }).join("");
    var row = function (lab, o, d) { return "<tr><th scope='row'>" + t(lab) + "</th><td class='n'>" + fmt(o.total, d) + "</td><td class='n'>" + fmt(o.low, d) + "</td><td class='n'>" + fmt(o.medium, d) + "</td><td class='n'>" + fmt(o.high, d) + "</td></tr>"; };
    $("exp").innerHTML = "<table><thead><tr><th>" + t("col_el") + "</th><th class='n'>" + t("col_tot") + "</th><th class='n'>" + t("col_low") + "</th><th class='n'>" + t("col_med") + "</th><th class='n'>" + t("col_high") + "</th></tr></thead><tbody>" +
      (e.buildings ? row("el_bld", e.buildings) : "") + (e.hospitals ? row("el_hos", e.hospitals) : "") + (e.schools ? row("el_sch", e.schools) : "") + (e.roads_km ? row("el_road", e.roads_km) : "") + "</tbody></table>";
    facs = (meta.facilities || []).filter(function (x) { return x.cls >= 2; }).sort(function (a, b) { return b.cls - a.cls || (a.type < b.type ? -1 : 1); });
    renderFac();
    var v = meta.validation;
    $("val").innerHTML = v ? "<table><tbody><tr><th scope='row'>" + t("val_lift") + "</th><td class='n'>" + fmt(v.hi_flood_pct, 1) + "% (" + fmt(v.hi_area_pct, 1) + "%)</td></tr><tr><th scope='row'>" + t("val_auc") + "</th><td class='n'>" + fmt(v.auc_hand, 2) + " / " + fmt(v.auc_nohand, 2) + "</td></tr><tr><th scope='row'>" + t("val_stab") + "</th><td class='n'>" + fmt(v.stable_pct, 1) + "%</td></tr></tbody></table>" : "";
  }
  function renderLive() {
    if (!series) return;
    FWApp.renderBanner($("banner"), res, mode); renderWhy();
    FWApp.rainChart($("chart"), series, idx);
  }
  function renderReplayTimeline() {
    var f = series.times.indexOf(FW.replay.from), l = series.times.indexOf(FW.replay.to), w = null, a = null;
    for (var i = f; i <= l; i++) { var r = FWApp.evaluate(series, i, { forecast: false }); if (!w && (r.level === "watch" || r.level === "alert")) w = series.times[i]; if (!a && r.level === "alert") a = series.times[i]; }
    $("timeline").innerHTML = t("tl_first_watch") + ": <strong>" + (w ? esc(w.replace("T", " ")) : t("tl_none")) + "</strong> &middot; " + t("tl_first_alert") + ": <strong>" + (a ? esc(a.replace("T", " ")) : t("tl_none")) + "</strong>";
  }
  function evalHere() {
    res = FWApp.evaluate(series, idx, mode === "replay" ? { forecast: false } : {});
    if (mode === "live") { FWApp.logLevel(res); renderLog(); }
    renderLive();
    if (mode === "replay") $("slider-t").textContent = series.times[idx].replace("T", " ");
  }
  function setMode(m) {
    mode = m; series = null; res = null;
    $("m-live").setAttribute("aria-pressed", m === "live"); $("m-replay").setAttribute("aria-pressed", m === "replay"); $("replay-box").hidden = m !== "replay";
    FWApp.loadRain(m).then(function (s) {
      series = s; if (m === "live") lastOk = Date.now();
      if (m === "replay") {
        var f = s.times.indexOf(FW.replay.from), l = s.times.indexOf(FW.replay.to), p = s.times.indexOf(FW.replay.peak + "T12:00");
        $("slider").min = f; $("slider").max = l; $("slider").value = p >= 0 ? p : f; idx = Number($("slider").value); renderReplayTimeline();
      } else idx = FWApp.nowIndex(s);
      evalHere();
    }).catch(function () { res = { level: "unknown", reasons: [], time: null }; FWApp.renderBanner($("banner"), res, mode); $("why").innerHTML = "<p>" + t("error_rain") + "</p>"; $("chart").innerHTML = ""; });
  }
  function refreshLive() {                                        // re-read the forecast every 10 min so times and chart stay current
    if (mode !== "live") return;
    FWApp.loadRain("live").then(function (s) { lastOk = Date.now(); series = s; idx = FWApp.nowIndex(s); evalHere(); })
      .catch(function () {
        if (Date.now() - lastOk > FW.maxDataAgeHours * 3600000) { res = { level: "unknown", reasons: [], time: null }; FWApp.renderBanner($("banner"), res, mode); $("why").innerHTML = "<p>" + t("error_rain") + "</p>"; }
      });
  }
  FWApp.autoRefresh(refreshLive, 10);
  $("fac-toggle").addEventListener("click", function () { facOpen = !facOpen; renderFac(); });
  $("m-live").addEventListener("click", function () { setMode("live"); });
  $("m-replay").addEventListener("click", function () { setMode("replay"); });
  $("slider").addEventListener("input", function () { idx = Number(this.value); if (series) evalHere(); });
  $("log-clear").addEventListener("click", function () { FWApp.store("fw_log", []); renderLog(); });
  $("rep-csv").addEventListener("click", function () {
    var rows = [["time", "type", "depth", "note", "lat", "lon"]].concat(FWApp.getReports().map(function (r) { return [r.at, r.type, r.depth, r.note, r.lat, r.lon]; }));
    var csv = rows.map(function (r) { return r.map(function (c) { return '"' + String(c == null ? "" : c).replace(/"/g, '""') + '"'; }).join(","); }).join("\n");
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "reports.csv"; a.click();
  });
  FWApp.onLang(function () { if (series && res) { evalHere(); } renderMeta(); renderLog(); renderReports(); if (mode === "replay" && series) renderReplayTimeline(); });

  var api = FWApp.buildMap("map", { facilities: true });
  api.ready.then(function (a) {
    mapApi = a; meta = a.meta; renderMeta();
    a.map.on("click", function (e) { var r = a.sampler ? a.sampler(e.latlng.lat, e.latlng.lng) : { cls: null }; L.popup().setLatLng(e.latlng).setContent(FWApp.riskText(r)).openOn(a.map); });
  }).catch(function () { $("map-msg").textContent = t("data_missing"); });
  renderLog(); renderReports(); setMode("live");
})();
