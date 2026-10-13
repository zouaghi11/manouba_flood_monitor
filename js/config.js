/* FloodWatch Manouba - settings. Edit here, not in the other files. */
window.FW = {
  // Point used for the rainfall series (centre of Manouba governorate area)
  lat: 36.81, lon: 10.09, tz: "Africa/Tunis",

  // Thresholds in mm of rain accumulated over 1, 3, 6 and 24 hours.
  // First calibration (Open-Meteo archive, 1991-2025, point 36.81 N 10.09 E): Watch = median of the yearly
  // maxima (about 1.5 episodes per year), Alert = 90th percentile of the yearly maxima (about 0.3 per year).
  // The archive is a coarse reanalysis that underestimates local storm rain: check them against rain gauge data.
  thresholds: {
    watch: { 1: 7.1, 3: 13.5, 6: 17.4, 24: 30.1 },
    alert: { 1: 9.8, 3: 19.8, 6: 28.4, 24: 47.3 }
  },

  // If any of the last N hours of live rainfall data is missing, the status becomes "unknown"
  maxDataAgeHours: 3,

  // Replay of the September 2020 storm (hourly reanalysis, coarse, for demonstration)
  replay: { start: "2020-09-08", end: "2020-09-12", from: "2020-09-09T00:00", to: "2020-09-11T23:00", peak: "2020-09-10" },

  // Emergency numbers shown on the citizen page: civil protection 198, ambulance (SAMU) 190, police 197
  emergencyNumber: "198 \u00b7 190 \u00b7 197",

  // Map
  center: [36.82, 10.0], zoom: 10,
  files: { meta: "data/meta.json", risk_eb: "data/risk_eb.png", risk_ahp: "data/risk_ahp.png", flood: "data/flood_s1_overlay.png", boundary: "data/boundary.geojson" }
};
