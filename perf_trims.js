// ICR2 Modern - Phase 7.12 performance trims.
//
// Pure functions only (no DOM, no engine state) so that the browser engine and
// the Node test tools evaluate exactly the same maths.
//
//   CLASSIC     The Phase 4.1 / 7.11 reference car. app3d.js executes its own
//               original code path for this trim; the constants below are
//               documentation and test input only.
//   HIGHSPEED   "High-Speed Race Trim". Bit-identical to Classic at or below
//               100 mph. Above that: a low-drag aero map, the circuit's stock
//               DEFAULT.ST1 gearing with a soft rev limiter, and the same
//               speed-sensitive steering lock continued past Classic's top
//               speed, capped at the original ICR2 car's measured high-speed
//               lateral grip. See docs/PERFORMANCE_TRIMS.md.
(function (root) {
  'use strict';
  const MPH = 0.44704, G = 9.81;

  const CLASSIC = Object.freeze({
    rolling: 0.16,            // m/s^2, paved
    wheelbase: 3.1,           // m, yaw = v/wb * tan(steer)
    maxSteerHigh: 0.055,      // rad, Classic steering lock at >= 43 m/s
    road: Object.freeze({ engine: 12.4, drag: 0.0031, maxSpeed: 94 }),
    oval: Object.freeze({ engine: 13.0, drag: 0.00098, maxSpeed: 125 }), // Phase 7.5 superspeedway set
  });
  const classicTerminal = c => Math.sqrt((c.engine - CLASSIC.rolling) / c.drag);
  const V_CLASSIC_ROAD = classicTerminal(CLASSIC.road);          // 62.836 m/s = 140.56 mph
  const A_CLASSIC_REF = V_CLASSIC_ROAD * V_CLASSIC_ROAD * Math.tan(CLASSIC.maxSteerHigh) / CLASSIC.wheelbase; // 70.1 m/s^2

  const HS = Object.freeze({
    kneeMph: 100,             // identical longitudinal forces at or below this speed
    dragTopMph: 225,          // drag-limited top speed of the low-drag map (gearing normally limits first)
    limiterFade: 0.02,        // engine force fades to zero over the last 2% before 6th-gear redline
    steerBlendEndMph: 180,    // lateral envelope reaches the high-speed value here (smoothest R_min growth)
    highSpeedLatG: 4.4,       // max lateral g of the stock RACE.LP car above 141 mph (Milwaukee 4.36, Detroit 4.12)
    redlineRpm: 12600,        // display only; matches the Classic tachometer range
    idleRpm: 5700,
    gearSpeedK: 111700,       // mph x ratio6(x1000); overridden by window.ICR2_GEAR_SPEED_K
    fallbackGearTopMph: Object.freeze({ road: 190, short_oval: 200, superspeedway: 254 }),
  });

  const smooth = x => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

  function trackClass(T, stock) {
    if (T && T.oval) return 'superspeedway';            // Classic 7.5 oval aero applies
    if (stock && stock.track_class) return stock.track_class;
    const tt = T && Number(T.track_type);
    return tt === 1 ? 'short_oval' : tt === 3 ? 'superspeedway' : 'road';
  }

  /**
   * Build the performance profile for one trim on one circuit.
   * @param {'classic'|'highspeed'} trim
   * @param {object} T      window.ICR2_TRACK
   * @param {object} stock  window.ICR2_STOCK_SETUPS[T.id] (optional)
   * @param {number} gearK  window.ICR2_GEAR_SPEED_K (optional)
   */
  function buildProfile(trim, T, stock, gearK) {
    const cls = trackClass(T, stock);
    const ovalAero = !!(T && T.oval);
    const base = ovalAero ? CLASSIC.oval : CLASSIC.road;
    const K = Number(gearK) || HS.gearSpeedK;
    const ratios = (stock && stock.setup && Array.isArray(stock.setup.gear_ratios_x1000) && stock.setup.gear_ratios_x1000.length === 6)
      ? stock.setup.gear_ratios_x1000.map(Number) : null;
    const gearTopMph = ratios ? ratios.map(r => K / r) : null;
    const vGearMph = gearTopMph ? gearTopMph[5] : HS.fallbackGearTopMph[cls] || 190;
    const vGear = vGearMph * MPH;
    const vKnee = HS.kneeMph * MPH, vDrag = HS.dragTopMph * MPH;
    const netAtKnee = base.engine - CLASSIC.rolling - base.drag * vKnee * vKnee;
    const vClassicTop = classicTerminal(base);
    const hs = trim === 'highspeed';

    // Effective drag coefficient so that drag*v^2 reproduces the target curve.
    function drag(v) {
      if (!hs || ovalAero || v <= vKnee) return base.drag;
      const x = (v - vKnee) / (vDrag - vKnee);
      const D = base.drag * vKnee * vKnee + netAtKnee * x * x;   // continuous at the knee, = engine-rolling at vDrag
      return D / (v * v);
    }
    function engine(v) {
      if (!hs) return base.engine;
      const fadeStart = vGear * (1 - HS.limiterFade);
      if (v <= fadeStart) return base.engine;
      return base.engine * Math.max(0, (vGear - v) / (vGear - fadeStart));
    }
    const maxSpeed = hs ? Math.max(base.maxSpeed, vGear + 2) : base.maxSpeed;
    // Multiplier on the Classic steering lock (hp.steer). 1 at or below Classic top speed.
    function lateralCap(v) {
      if (!hs || v <= V_CLASSIC_ROAD) return Infinity;
      const t = smooth((v - V_CLASSIC_ROAD) / (HS.steerBlendEndMph * MPH - V_CLASSIC_ROAD));
      return A_CLASSIC_REF + (HS.highSpeedLatG * G - A_CLASSIC_REF) * t;
    }
    function steerScale(v) {
      if (!hs || v <= V_CLASSIC_ROAD) return 1;
      const ms = Math.atan(CLASSIC.wheelbase * lateralCap(v) / (v * v));
      return Math.min(1, ms / CLASSIC.maxSteerHigh);
    }
    // Clean-car top speed, used to scale the damage speed caps.
    const cleanTop = hs ? Math.min(vGear, vDrag) : vClassicTop;
    function gearRpm(mps, throttle) {
      const mph = Math.max(0, mps / MPH);
      if (mph < 1 && throttle < 0.05) return ['N', 900];
      const tops = gearTopMph || [0.5, 0.62, 0.71, 0.81, 0.91, 1].map(f => f * vGearMph);
      let g = 0;
      while (g < 5 && mph > tops[g] * 0.985) g++;
      return [g + 1, Math.round(Math.min(HS.redlineRpm, Math.max(HS.idleRpm, HS.redlineRpm * mph / tops[g])))];
    }
    return {
      trim: hs ? 'highspeed' : 'classic', trackClass: cls, ovalAero,
      vGear, vGearMph, gearTopMph, vKnee, vDrag, vClassicTop, cleanTop,
      damageCapScale: cleanTop / V_CLASSIC_ROAD,
      aiCapMph: hs ? Math.ceil(vGearMph) : null,
      drag, engine, maxSpeed, steerScale, lateralCap, gearRpm,
    };
  }

  const api = Object.freeze({ MPH, G, CLASSIC, HS, V_CLASSIC_ROAD, A_CLASSIC_REF, trackClass, buildProfile,
    TRIMS: Object.freeze([['classic', 'Classic handling'], ['highspeed', 'High-Speed race trim']]) });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ICR2_PERF = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
