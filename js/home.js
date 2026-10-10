(function () {
  FWApp.mount("home");
  var $ = FWApp.$, last = null, mode = "live";
  var api = FWApp.buildMap("map", { facilities: false });
  function show() { var r = last || { level: "unknown", reasons: [], time: null }; FWApp.renderBanner($("banner"), r, mode); }
  FWApp.onLang(show); show();
  var lastOk = 0;
  function pull() {
    FWApp.loadRain("live").then(function (s) { lastOk = Date.now(); last = FWApp.evaluate(s, FWApp.nowIndex(s)); show(); })
      .catch(function () { if (!lastOk || Date.now() - lastOk > FW.maxDataAgeHours * 3600000) { last = { level: "unknown", reasons: [], time: null }; show(); } });
  }
  pull(); FWApp.autoRefresh(pull, 10);
  api.ready.then(function (a) {
    a.map.on("click", function (e) {
      var r = a.sampler ? a.sampler(e.latlng.lat, e.latlng.lng) : { cls: null };
      L.popup().setLatLng(e.latlng).setContent(FWApp.riskText(r)).openOn(a.map);
    });
  }).catch(function () { $("map-msg").textContent = FWApp.t("data_missing"); });
})();
