import { CelestialBody, OrbitParameters, VesselState } from '../types';

export class OrbitalMath {
  public static calculateOrbit(
    vessel: { x: number; y: number; vx: number; vy: number; soi?: string },
    body: CelestialBody,
    moon?: { x: number; y: number; vx: number; vy: number; radius: number; soiRadius: number; orbitRadius: number; orbitSpeed: number }
  ): OrbitParameters {
    const isMoonSOI = vessel.soi === 'moon' && moon !== undefined;
    const rx = isMoonSOI ? vessel.x - moon.x : vessel.x;
    const ry = isMoonSOI ? vessel.y - moon.y : vessel.y;
    const vx = isMoonSOI ? vessel.vx - moon.vx : vessel.vx;
    const vy = isMoonSOI ? vessel.vy - moon.vy : vessel.vy;

    const r = Math.hypot(rx, ry);
    const v2 = vx * vx + vy * vy;
    const mu = body.mu;

    // 1. Specific Angular Momentum (hz) in 2D (r_x * v_y - r_y * v_x)
    const h = rx * vy - ry * vx;

    // 2. Specific Orbital Energy (eps = v^2/2 - mu/r)
    const eps = v2 / 2 - mu / r;

    // 3. Eccentricity Vector (e_vec)
    const ex = (vy * h) / mu - (r > 0 ? rx / r : 0);
    const ey = (-vx * h) / mu - (r > 0 ? ry / r : 0);
    let e = Math.hypot(ex, ey);

    // 4. Semi-Major Axis (a)
    let a = 0;
    if (Math.abs(eps) > 1e-8) {
      a = -mu / (2 * eps);
    } else {
      a = Infinity;
    }

    // 5. Energy Escape Condition: strictly when specific orbital energy is non-negative
    const isHyperbolic = eps >= 0;

    // Clamp eccentricity for degenerate radial launch cases to prevent singularity
    const isRadialAscent = Math.abs(h) < 1e-3;
    if (isRadialAscent && !isHyperbolic) {
      e = Math.min(0.9999, e);
    }

    const b = a > 0 && e < 1 ? a * Math.sqrt(Math.max(0, 1 - e * e)) : 0;

    // 6. Argument of Periapsis (omega)
    const omega = Math.atan2(ey, ex);

    // 7. True Anomaly (nu)
    const posAngle = Math.atan2(ry, rx);
    let nu = h >= 0 ? posAngle - omega : omega - posAngle;
    while (nu < 0) nu += Math.PI * 2;
    while (nu >= Math.PI * 2) nu -= Math.PI * 2;

    // 8. Apoapsis & Periapsis
    let apoapsis = 0;
    let periapsis = 0;
    let period = 0;

    if (!isHyperbolic && a > 0) {
      // For any bound orbit (even vertical launch with e ~ 1),
      // conservation of energy gives maximum ballistic height:
      // r_max = a * (1 + e)
      const ra = a * (1 + e);
      const rp = Math.max(0, a * (1 - e));
      apoapsis = Math.max(0, ra - body.radius);
      periapsis = rp - body.radius;
      period = 2 * Math.PI * Math.sqrt((a * a * a) / mu);
    } else {
      // Hyperbolic / Parabolic periapsis
      const rp = a < 0 ? Math.abs(a) * (e - 1) : (h * h) / (mu * (1 + e));
      periapsis = rp - body.radius;
      apoapsis = Infinity;
      period = Infinity;
    }

    // 9. Time to Apoapsis & Periapsis (Kepler's Equation)
    let timeToPeriapsis = 0;
    let timeToApoapsis = 0;

    if (!isHyperbolic && a > 0 && period > 0) {
      if (e < 0.999) {
        const cosE = (e + Math.cos(nu)) / (1 + e * Math.cos(nu));
        const sinE = (Math.sqrt(Math.max(0, 1 - e * e)) * Math.sin(nu)) / (1 + e * Math.cos(nu));
        let E = Math.atan2(sinE, cosE);
        if (E < 0) E += Math.PI * 2;

        const M = E - e * Math.sin(E);
        const n = (2 * Math.PI) / period;

        timeToPeriapsis = (2 * Math.PI - M) / n;
        let diffAp = Math.PI - M;
        if (diffAp < 0) diffAp += Math.PI * 2;
        timeToApoapsis = diffAp / n;
      } else {
        // Near-radial launch approximation
        const radialVel = (rx * vx + ry * vy) / Math.max(1, r);
        if (radialVel > 0) {
          const gAvg = (mu / (r * r) + mu / Math.pow(body.radius + apoapsis, 2)) * 0.5;
          timeToApoapsis = Math.max(0, radialVel / Math.max(0.1, gAvg));
        } else {
          timeToApoapsis = 0;
        }
      }
    }

    const isOrbiting = periapsis > body.atmosphereHeight && !isHyperbolic;
    const isSuborbital = !isOrbiting && !isHyperbolic;

    // 9. Moon Intercept Predictor (when in Earth SOI with high Ap reaching Moon orbit 3,000 km)
    let closestApproachMoon: OrbitParameters['closestApproachMoon'] = undefined;
    if (moon && body.id === 'earth' && apoapsis > 2000000) {
      let minMoonDist = Infinity;
      let timeToMin = 0;
      let intersects = false;
      let encounterPt: { x: number; y: number } | undefined = undefined;
      let moonAtEnc: { x: number; y: number } | undefined = undefined;

      const numSamples = 160;
      const totalSimTime = Math.min(period > 0 ? period : 40000, 35000);
      const dt = totalSimTime / numSamples;

      let simX = rx;
      let simY = ry;
      let simVx = vx;
      let simVy = vy;

      const moonStartAngle = Math.atan2(moon.y, moon.x);
      const moonAngVel = moon.orbitSpeed / moon.orbitRadius;

      for (let s = 1; s <= numSamples; s++) {
        const simR = Math.hypot(simX, simY);
        if (simR < body.radius * 0.95) break;

        const simAcc = -mu / (simR * simR * simR);
        simVx += simX * simAcc * dt;
        simVy += simY * simAcc * dt;
        simX += simVx * dt;
        simY += simVy * dt;

        const moonAngleNow = moonStartAngle + moonAngVel * (s * dt);
        const mX = Math.cos(moonAngleNow) * moon.orbitRadius;
        const mY = Math.sin(moonAngleNow) * moon.orbitRadius;

        const d = Math.hypot(simX - mX, simY - mY);
        if (d < minMoonDist) {
          minMoonDist = d;
          timeToMin = s * dt;
          if (d <= moon.soiRadius) {
            intersects = true;
            if (!encounterPt) {
              encounterPt = { x: simX, y: simY };
              moonAtEnc = { x: mX, y: mY };
            }
          }
        }
      }

      closestApproachMoon = {
        distance: Math.max(0, minMoonDist - moon.radius),
        timeToClosest: timeToMin,
        intersectsSOI: intersects,
        encounterPoint: encounterPt,
        moonAtEncounter: moonAtEnc,
      };
    }

    return {
      apoapsis,
      periapsis,
      semiMajorAxis: a,
      semiMinorAxis: b,
      eccentricity: e,
      period,
      inclination: 0,
      trueAnomaly: nu,
      argumentOfPeriapsis: omega,
      specificAngularMomentum: h,
      specificEnergy: eps,
      timeToApoapsis,
      timeToPeriapsis,
      isOrbiting,
      isSuborbital,
      isHyperbolic,
      closestApproachMoon,
    };
  }

  /**
   * Generates continuous coordinates along the flight trajectory for rendering.
   * Seamlessly handles launchpad ascent, suborbital ballistic arcs, full closed orbits, and escape paths.
   */
  public static getConicTrajectoryPoints(
    vessel: VesselState,
    orbit: OrbitParameters,
    body: CelestialBody,
    pointsCount: number = 240,
    bodyOffset: { x: number; y: number; vx: number; vy: number } = { x: 0, y: 0, vx: 0, vy: 0 }
  ): { x: number; y: number; isUnderground: boolean; inAtmosphere: boolean }[] {
    const points: { x: number; y: number; isUnderground: boolean; inAtmosphere: boolean }[] = [];
    const { eccentricity: e, semiMajorAxis: a, argumentOfPeriapsis: omega, specificAngularMomentum: h } = orbit;

    // 1. CLOSED STABLE ORBIT: Draw full 360-degree closed orbital ellipse
    if (orbit.isOrbiting && e < 0.95 && a > 0) {
      const p = a * (1 - e * e);
      const s = h >= 0 ? 1 : -1;

      for (let i = 0; i <= pointsCount; i++) {
        const nu = (i / pointsCount) * (Math.PI * 2);
        const denom = 1 + e * Math.cos(nu);
        if (denom <= 0.001) continue;

        const r = p / denom;
        if (r <= 0 || !isFinite(r)) continue;

        const theta = omega + s * nu;
        const px = r * Math.cos(theta);
        const py = r * Math.sin(theta);
        const dist = Math.hypot(px, py);

        points.push({
          x: px,
          y: py,
          isUnderground: dist < body.radius,
          inAtmosphere: dist < body.radius + body.atmosphereHeight,
        });
      }
      return points;
    }

    // 2. LAUNCHPAD / ASCENT / SUBORBITAL / ESCAPE: High-precision Forward Ballistic Propagation
    // Relative coordinates to the active celestial body
    let currX = vessel.x - bodyOffset.x;
    let currY = vessel.y - bodyOffset.y;
    let currVx = vessel.vx - bodyOffset.vx;
    let currVy = vessel.vy - bodyOffset.vy;

    // Push initial vessel position
    const initDist = Math.hypot(currX, currY);
    points.push({
      x: currX,
      y: currY,
      isUnderground: initDist < body.radius,
      inAtmosphere: initDist < body.radius + body.atmosphereHeight,
    });

    // If standing completely still on the launchpad with no speed, return start position
    const speed = Math.hypot(currVx, currVy);
    if (vessel.altitude < 15 && speed < 1.0) {
      return points;
    }

    // Determine total simulation horizon
    let simHorizon = 1200; // seconds
    if (orbit.isHyperbolic) {
      simHorizon = 15000;
    } else if (orbit.timeToApoapsis > 0) {
      simHorizon = Math.max(60, Math.min(7200, orbit.timeToApoapsis * 2.2));
    } else if (orbit.period > 0 && isFinite(orbit.period)) {
      simHorizon = Math.min(10000, orbit.period);
    }

    const dt = Math.max(0.2, simHorizon / pointsCount);
    const maxSteps = pointsCount;

    for (let step = 1; step <= maxSteps; step++) {
      const r = Math.hypot(currX, currY);
      if (r <= body.radius) {
        // Surface impact point reached!
        points.push({
          x: currX,
          y: currY,
          isUnderground: true,
          inAtmosphere: true,
        });
        break;
      }

      if (r > 30000000) {
        // Escaped solar region
        break;
      }

      // Gravitational acceleration towards body center (0,0)
      const invR3 = 1 / (r * r * r);
      const ax = -body.mu * currX * invR3;
      const ay = -body.mu * currY * invR3;

      // Leapfrog integration
      currVx += ax * dt;
      currVy += ay * dt;
      currX += currVx * dt;
      currY += currVy * dt;

      const newDist = Math.hypot(currX, currY);
      points.push({
        x: currX,
        y: currY,
        isUnderground: newDist < body.radius,
        inAtmosphere: newDist < body.radius + body.atmosphereHeight,
      });

      // Stop if entered surface
      if (newDist <= body.radius) {
        break;
      }
    }

    return points;
  }
}
