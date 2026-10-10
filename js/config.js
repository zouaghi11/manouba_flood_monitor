/* FloodWatch Manouba - settings. Edit here, not in the other files. */
window.FW = {
  // Point used for the rainfall series (centre of Manouba governorate area)
  lat: 36.81, lon: 10.09, tz: "Africa/Tunis",

  // PLACEHOLDER thresholds in mm of rain accumulated over 1, 3, 6 and 24 hours.
  // They are NOT calibrated yet: calibrate them on past events (see the roadmap) before any real use.
  thresholds: {
    watch: { 1: 10, 3: 25, 6: 40, 24: 60 },
    alert: { 1: 30, 3: 60, 6: 90, 24: 120 }
  },

  // If any of the last N hours of live rainfall data is missing, the status becomes "unknown"
  maxDataAgeHours: 3,

  // Replay of the September 2020 storm (hourly reanalysis, coarse, for demonstration)
  replay: { start: "2020-09-08", end: "2020-09-12", from: "2020-09-09T00:00", to: "2020-09-11T23:00", peak: "2020-09-10" },

  // Emergency number shown on the citizen page (check the correct national number before publishing)
  emergencyNumber: "198",

  // Map
  center: [36.82, 10.0], zoom: 10,
  files: { meta: "data/meta.json", risk: "data/risk_overlay.png", flood: "data/flood_s1_overlay.png", boundary: "data/boundary.geojson" }
};
