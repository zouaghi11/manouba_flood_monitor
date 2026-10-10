(function () {
  FWApp.mount("citizen");
  var $ = FWApp.$, t = FWApp.t, last = null, picked = null, mapApi = null;
  $("emg").textContent = FW.emergencyNumber;
  function banner() { FWApp.renderBanner($("banner"), last || { level: "unknown", reasons: [], time: null }, "live"); }
  function fillSelects() {
    document.querySelectorAll("#r-type option, #r-depth option").forEach(function (o) { o.textContent = t("rep_" + o.value); });
    if (picked) $("r-loc").textContent = t("sel_place") + ": " + picked.lat.toFixed(5) + ", " + picked.lng.toFixed(5); else $("r-loc").textContent = t("rep_loc");
  }
  FWApp.onLang(function () { banner(); fillSelects(); });
  banner(); fillSelects();
  var lastOk = 0;
  function pull() {
    FWApp.loadRain("live").then(function (s) { lastOk = Date.now(); last = FWApp.evaluate(s, FWApp.nowIndex(s)); banner(); })
      .catch(function () { if (!lastOk || Date.now() - lastOk > FW.maxDataAgeHours * 3600000) { last = { level: "unknown", reasons: [], time: null }; banner(); } });
  }
  pull(); FWApp.autoRefresh(pull, 10);

  var api = FWApp.buildMap("map", { reports: true, facilities: false });
  var marker = null;
  function choose(latlng, showRisk) {
    picked = latlng; fillSelects();
    if (marker) marker.setLatLng(latlng); else marker = L.circleMarker(latlng, { radius: 8, color: "#0b5394", fillOpacity: .3 }).addTo(mapApi.map);
    var r = mapApi.sampler ? mapApi.sampler(latlng.lat, latlng.lng) : { cls: null };
    var box = $("place"); box.hidden = false; box.innerHTML = FWApp.riskText(r);
  }
  api.ready.then(function (a) {
    mapApi = a;
    a.map.on("click", function (e) { choose(e.latlng); });
    $("locate").addEventListener("click", function () {
      if (!navigator.geolocation) { alert(t("locate_fail")); return; }
      navigator.geolocation.getCurrentPosition(function (p) { var ll = L.latLng(p.coords.latitude, p.coords.longitude); a.map.setView(ll, 15); choose(ll); }, function () { alert(t("locate_fail")); });
    });
  }).catch(function () { $("map-msg").textContent = t("data_missing"); });

  $("report").addEventListener("submit", function (e) {
    e.preventDefault();
    if (!picked) { $("r-msg").textContent = t("rep_none"); return; }
    FWApp.addReport({ type: t("rep_" + $("r-type").value), depth: t("rep_" + $("r-depth").value), note: $("r-note").value.trim(), lat: picked.lat, lon: picked.lng, at: new Date().toISOString() });
    $("r-note").value = ""; $("r-msg").textContent = t("rep_saved");
    if (mapApi && mapApi.refreshReports) mapApi.refreshReports();
  });
})();
