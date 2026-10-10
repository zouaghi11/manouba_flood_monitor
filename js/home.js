(function () {
  FWApp.mount("home");
  var $ = FWApp.$, last = null, mode = "live";
  var api = FWApp.buildMap("map", { facilities: false });
  function show() { var r = last || { level: "unknown", reasons: [], time: null }; FWApp.renderBanner($("banner"), r, mode); }
  FWApp.onLang(show); show();
  FWApp.loadRain("live").then(function (s) { last = FWApp.evaluate(s, FWApp.nowIndex(s)); show(); })
    .catch(function () { last = { level: "unknown", reasons: [], time: null }; show(); });
  api.ready.then(function (a) {
    a.map.on("click", function (e) {
      var r = a.sampler ? a.sampler(e.latlng.lat, e.latlng.lng) : { cls: null };
      L.popup().setLatLng(e.latlng).setContent(FWApp.riskText(r)).openOn(a.map);
    });
  }).catch(function () { $("map-msg").textContent = FWApp.t("data_missing"); });
})();
