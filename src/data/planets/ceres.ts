import { CelestialBodySpec, LandSurfaceSpec } from './types';

export const ceresLandSurface: LandSurfaceSpec = {
  bodyId: 'ceres',
  bodyName: 'Ceres',
  baseColor: '#71717a',
  secondaryColor: '#52525b',
  crustRockColor: '#3f3f46',
  soilDustColor: '#a1a1aa',
  highlightColor: '#f4f4f5',
  shadowColor: '#18181b',
  baseElevationM: 0,
  maxElevationM: 4000, // Ahuna Mons
  minElevationM: -4500, // Occator Crater floor
  roughness: 0.78,
  craterDensity: 0.85,
  geologicalComposition: 'Water-ice mantle, clay minerals, hydrated carbonates (sodium carbonate), ammonium-bearing phyllosilicates, subsurface muddy brine reservoir',
  surfaceTemperatureK: { min: 130, avg: 168, max: 235 },
  radiationLevelRadHr: 15,
  surfaceFeatures: [
    {
      id: 'occator_crater',
      name: 'Occator Crater & Cerealia Facula',
      type: 'crater',
      angleRad: 1.15,
      widthKm: 92,
      elevationMeters: -4000,
      description: 'Striking 4 km deep impact crater with brilliant white central sodium carbonate salt domes deposited by cryovolcanic brines',
      color: '#f4f4f5',
    },
    {
      id: 'ahuna_mons',
      name: 'Ahuna Mons Cryovolcano',
      type: 'volcano',
      angleRad: 3.4,
      widthKm: 20,
      elevationMeters: 4000,
      description: 'Solitary volcanic dome formed by cryovolcanic extrusion of viscous mud and sodium chloride/carbonate brines',
      color: '#e4e4e7',
    },
  ],
  getHeightAtAngle: (angle: number) => {
    let h = Math.sin(angle * 6) * 600 + Math.cos(angle * 14) * 400;
    const dOcc = Math.abs(angle - 1.15);
    if (dOcc < 0.15) {
      h -= (1 - dOcc / 0.15) * 3800;
    }
    const dAhuna = Math.abs(angle - 3.4);
    if (dAhuna < 0.08) {
      h += (1 - dAhuna / 0.08) * 3800;
    }
    h += Math.sin(angle * 40) * 150;
    return h;
  },
  getTerrainSample: (angle: number) => {
    const dOcc = Math.abs(angle - 1.15);
    if (dOcc < 0.15) {
      const isSalt = dOcc < 0.04;
      return {
        elevation: isSalt ? -3400 : -4000,
        slope: isSalt ? 0.05 : 0.45,
        surfaceType: isSalt ? 'ice' : 'regolith',
        surfaceColor: isSalt ? '#ffffff' : '#52525b',
        strataColors: ['#f4f4f5', '#71717a', '#3f3f46', '#18181b'],
        featureName: isSalt ? 'Cerealia Facula Salt Dome' : 'Occator Impact Crater',
      };
    }
    const dAhuna = Math.abs(angle - 3.4);
    if (dAhuna < 0.08) {
      return {
        elevation: 4000 * (1 - dAhuna / 0.08),
        slope: 0.55,
        surfaceType: 'ice',
        surfaceColor: '#e4e4e7',
        strataColors: ['#d4d4d8', '#a1a1aa', '#52525b', '#27272a'],
        featureName: 'Ahuna Mons Cryovolcano',
      };
    }
    return {
      elevation: Math.sin(angle * 6) * 600 + Math.cos(angle * 14) * 400,
      slope: 0.18,
      surfaceType: 'regolith',
      surfaceColor: '#71717a',
      strataColors: ['#52525b', '#3f3f46', '#27272a', '#18181b'],
      featureName: 'Carbonaceous Chondrite Terrain',
    };
  },
};

export const ceresSpec: CelestialBodySpec = {
  id: 'ceres',
  name: 'Ceres (1 Ceres)',
  category: 'dwarf',
  parent: 'sun',
  radius: 47000,
  realRadiusKm: 469.73,
  realDistanceKm: 413700000,
  realSemiMajorAxisAU: 2.7675,
  mass: 9.3835e20,
  realMassKg: 9.3835e20,
  mu: 6.26325e10,
  surfaceGravity: 0.28,
  realSurfaceGravityMs2: 0.28,
  escapeVelocity: 510,
  realEscapeVelocityKms: 0.51,
  realOrbitSpeedKms: 17.905,
  realOrbitPeriodDays: 1682,
  realDensityGcm3: 2.162,
  realSurfacePressureBar: 1e-12,
  realHillSphereKm: 21600,
  realSurfaceTempRangeK: { min: 130, avg: 168, max: 235 },
  axialTiltDeg: 4.0,
  rotationPeriodSec: 32667, // 9.074 hours
  hasAtmosphere: false,
  atmosphereHeight: 0,
  scaleHeight: 0,
  surfacePressureAtm: 0,
  surfaceDensityKgM3: 0,
  atmosphereComposition: 'Transient trace water vapor from cryovolcanic sublimation',
  atmosphereColor: 'rgba(0,0,0,0)',
  atmosphereGlowColor: 'rgba(0,0,0,0)',
  atmosphereRimColor: 'rgba(212, 212, 216, 0.2)',
  hazeOpacity: 0,
  orbitRadius: 95000000,
  orbitPeriod: 1682 * 86400,
  orbitSpeed: 17905,
  soiRadius: 1100000,
  initialAngle: 3.8,
  semiMajorAxisAU: 2.767,
  primaryColor: '#71717a',
  secondaryColor: '#3f3f46',
  accentColor: '#f4f4f5',
  surfaceDetailType: 'ceres_carbonate',
  details: 'Queen of the Main Asteroid Belt, a differentiated dwarf planet containing a vast subterranean reservoir of salty brine and active cryovolcanoes.',
  geologySummary: 'Dull carbonaceous outer shell punctuated by the luminous Cerealia and Vinalia Faculae salt deposits inside Occator Crater.',
  landSurface: ceresLandSurface,
};
