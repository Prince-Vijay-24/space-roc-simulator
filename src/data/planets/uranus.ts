import { CelestialBodySpec, LandSurfaceSpec } from './types';

// URANUS
export const uranusLandSurface: LandSurfaceSpec = {
  bodyId: 'uranus',
  bodyName: 'Uranus (Caelus)',
  baseColor: '#22d3ee',
  secondaryColor: '#06b6d4',
  crustRockColor: '#0891b2',
  soilDustColor: '#a5f3fc',
  highlightColor: '#cffafe',
  shadowColor: '#164e63',
  baseElevationM: 0,
  maxElevationM: 14000,
  minElevationM: -18000,
  roughness: 0.1,
  craterDensity: 0,
  geologicalComposition: 'Ice giant: Hydrogen and helium atmosphere with 2.3% methane absorbing red light to yield an aquamarine color, over a deep slushy mantle of water, ammonia, and methane ices',
  surfaceTemperatureK: { min: 49, avg: 76, max: 5000 },
  radiationLevelRadHr: 10,
  surfaceFeatures: [
    {
      id: 'polar_methane_hood',
      name: 'Bright Methane Polar Hood',
      type: 'plain',
      angleRad: Math.PI * 0.5,
      widthKm: 12000,
      elevationMeters: 3000,
      description: 'Persistent reflective polar cap of photochemically produced methane and hydrocarbon aerosol smog',
      color: '#cffafe',
    },
  ],
  getHeightAtAngle: (angle: number) => {
    return Math.sin(angle * 10) * 2000 + Math.cos(angle * 22) * 1100;
  },
  getTerrainSample: (angle: number) => {
    return {
      elevation: Math.sin(angle * 10) * 2000 + Math.cos(angle * 22) * 1100,
      slope: 0.03,
      surfaceType: 'gas',
      surfaceColor: '#22d3ee',
      strataColors: ['#06b6d4', '#0891b2', '#0e7490', '#155e75'],
      featureName: 'Cyan Methane Cloud Layer',
    };
  },
};

export const uranusSpec: CelestialBodySpec = {
  id: 'uranus',
  name: 'Uranus (Caelus)',
  category: 'planet',
  parent: 'sun',
  radius: 360000,
  realRadiusKm: 25362,
  realDistanceKm: 2872460000,
  realSemiMajorAxisAU: 19.1912,
  mass: 8.681e25,
  realMassKg: 8.681e25,
  mu: 5.793939e15,
  surfaceGravity: 8.69,
  realSurfaceGravityMs2: 8.69,
  escapeVelocity: 21300,
  realEscapeVelocityKms: 21.3,
  realOrbitSpeedKms: 6.80,
  realOrbitPeriodDays: 30685.4,
  realDensityGcm3: 1.270,
  realSurfacePressureBar: 100,
  realHillSphereKm: 70000000,
  realSurfaceTempRangeK: { min: 49, avg: 76, max: 5000 },
  axialTiltDeg: 97.77, // Extreme sideways roll!
  rotationPeriodSec: 61920, // 17h 12m retrograde
  hasAtmosphere: true,
  atmosphereHeight: 60000,
  scaleHeight: 27700,
  surfacePressureAtm: 100,
  surfaceDensityKgM3: 1.27,
  atmosphereComposition: '82.5% Hydrogen, 15.2% Helium, 2.3% Methane, trace hydrogen deuteride',
  atmosphereColor: 'rgba(34, 211, 238, 0.65)',
  atmosphereGlowColor: 'rgba(6, 182, 212, 0.4)',
  atmosphereRimColor: 'rgba(207, 250, 254, 0.95)',
  hazeOpacity: 0.9,
  orbitRadius: 420000000,
  orbitPeriod: 30687 * 86400,
  orbitSpeed: 6810,
  soiRadius: 11000000,
  initialAngle: 0.2,
  semiMajorAxisAU: 19.191,
  hasRings: true,
  ringInnerRadius: 420000,
  ringOuterRadius: 580000,
  ringColor: 'rgba(165, 243, 252, 0.35)',
  ringSecondaryColor: 'rgba(8, 145, 178, 0.2)',
  primaryColor: '#22d3ee',
  secondaryColor: '#06b6d4',
  accentColor: '#cffafe',
  surfaceDetailType: 'uranus_ice_cyan',
  details: 'The tilted ice giant of the Solar System, rotating nearly on its side with an axial tilt of 97.8 degrees, surrounded by 13 faint charcoal-dark rings.',
  geologySummary: 'Serene cyan-aquamarine methane cloud deck veiling a superionic water-ammonia slush ocean under extreme planetary pressure.',
  landSurface: uranusLandSurface,
};

// MIRANDA (Frankenstein Moon)
export const mirandaLandSurface: LandSurfaceSpec = {
  bodyId: 'miranda',
  bodyName: 'Miranda',
  baseColor: '#94a3b8',
  secondaryColor: '#64748b',
  crustRockColor: '#475569',
  soilDustColor: '#cbd5e1',
  highlightColor: '#f1f5f9',
  shadowColor: '#1e293b',
  baseElevationM: 0,
  maxElevationM: 20000, // Verona Rupes
  minElevationM: -8000,
  roughness: 1.0, // Most extreme, rugged topography in the solar system
  craterDensity: 0.5,
  geologicalComposition: 'Water ice, carbonaceous organics, ammonium-hydrate salts, pieced together from chaotic tectonic resurfacing or catastrophic disruption and reassembly',
  surfaceTemperatureK: { min: 60, avg: 70, max: 84 },
  radiationLevelRadHr: 5,
  surfaceFeatures: [
    {
      id: 'verona_rupes',
      name: 'Verona Rupes (Highest Cliff in Solar System)',
      type: 'mountain',
      angleRad: 0.65,
      widthKm: 20,
      elevationMeters: 20000,
      description: 'The tallest known cliff face in the Solar System, plunging 20 km straight down into an icy chasm (a human falling would take 12 minutes to reach bottom!)',
      color: '#f8fafc',
    },
    {
      id: 'chevron_corona',
      name: 'Elsinore Corona (Grooved Chevron Ovoid)',
      type: 'chasm',
      angleRad: 2.7,
      widthKm: 300,
      elevationMeters: -5000,
      description: 'Bizarre racetrack-shaped corona of parallel tectonic faults and cryovolcanic diapir upwellings',
      color: '#475569',
    },
  ],
  getHeightAtAngle: (angle: number) => {
    let h = Math.sin(angle * 4) * 1200 + Math.cos(angle * 11) * 900;
    const dVerona = Math.abs(angle - 0.65);
    if (dVerona < 0.15) {
      h += (1 - dVerona / 0.15) * 18000;
    }
    return h;
  },
  getTerrainSample: (angle: number) => {
    const dVerona = Math.abs(angle - 0.65);
    if (dVerona < 0.15) {
      return {
        elevation: 18000 * (1 - dVerona / 0.15),
        slope: 0.85,
        surfaceType: 'ice',
        surfaceColor: '#f1f5f9',
        strataColors: ['#cbd5e1', '#94a3b8', '#64748b', '#334155'],
        featureName: 'Verona Rupes 20km Sheer Cliff',
      };
    }
    return {
      elevation: Math.sin(angle * 4) * 1200 + Math.cos(angle * 11) * 900,
      slope: 0.3,
      surfaceType: 'ice',
      surfaceColor: '#94a3b8',
      strataColors: ['#64748b', '#475569', '#334155', '#1e293b'],
      featureName: 'Patchwork Corona Terrain',
    };
  },
};

export const mirandaSpec: CelestialBodySpec = {
  id: 'miranda',
  name: 'Miranda',
  category: 'moon',
  parent: 'uranus',
  radius: 11500,
  realRadiusKm: 235.8,
  realDistanceKm: 129390,
  realSemiMajorAxisAU: 0.000865,
  mass: 6.59e19,
  realMassKg: 6.59e19,
  mu: 4.4e9,
  surfaceGravity: 0.079,
  realSurfaceGravityMs2: 0.079,
  escapeVelocity: 193,
  realEscapeVelocityKms: 0.193,
  realOrbitSpeedKms: 6.68,
  realOrbitPeriodDays: 1.413,
  realDensityGcm3: 1.20,
  realSurfacePressureBar: 0,
  realHillSphereKm: 420,
  realSurfaceTempRangeK: { min: 60, avg: 70, max: 84 },
  axialTiltDeg: 0,
  rotationPeriodSec: 122170, // 1.413 days
  hasAtmosphere: false,
  atmosphereHeight: 0,
  scaleHeight: 0,
  surfacePressureAtm: 0,
  surfaceDensityKgM3: 0,
  atmosphereComposition: 'Vacuum',
  atmosphereColor: 'rgba(0,0,0,0)',
  atmosphereGlowColor: 'rgba(0,0,0,0)',
  atmosphereRimColor: 'rgba(203, 213, 225, 0.25)',
  hazeOpacity: 0,
  orbitRadius: 900000,
  orbitPeriod: 1.413 * 86400,
  orbitSpeed: 6680,
  soiRadius: 30000,
  initialAngle: 1.4,
  primaryColor: '#94a3b8',
  secondaryColor: '#475569',
  accentColor: '#f1f5f9',
  surfaceDetailType: 'miranda_cliffs',
  details: 'The Frankenstein moon of Uranus, featuring a surreal patchwork of mismatched geological terrains and the towering 20 km cliff face of Verona Rupes.',
  geologySummary: 'Three massive ovoid coronae (Arden, Elsinore, Inverness) bordered by scarps 10 times deeper than the Grand Canyon.',
  landSurface: mirandaLandSurface,
};

// TITANIA (Largest Moon of Uranus)
export const titaniaLandSurface: LandSurfaceSpec = {
  bodyId: 'titania',
  bodyName: 'Titania',
  baseColor: '#cbd5e1',
  secondaryColor: '#94a3b8',
  crustRockColor: '#64748b',
  soilDustColor: '#e2e8f0',
  highlightColor: '#f8fafc',
  shadowColor: '#334155',
  baseElevationM: 0,
  maxElevationM: 4500,
  minElevationM: -6000,
  roughness: 0.75,
  craterDensity: 0.7,
  geologicalComposition: 'Water ice (50%), rocky silicate core (50%), organic tholin deposits, carbon dioxide frost',
  surfaceTemperatureK: { min: 60, avg: 70, max: 89 },
  radiationLevelRadHr: 3,
  surfaceFeatures: [
    {
      id: 'messina_chasma',
      name: 'Messina Chasma (Grand Rift Valley)',
      type: 'chasm',
      angleRad: 1.8,
      widthKm: 1492,
      elevationMeters: -6000,
      description: 'Gigantic extensional normal fault canyon cutting across the southern hemisphere of Titania',
      color: '#334155',
    },
  ],
  getHeightAtAngle: (angle: number) => {
    let h = Math.sin(angle * 5) * 800 + Math.cos(angle * 13) * 600;
    const dMessina = Math.abs(angle - 1.8);
    if (dMessina < 0.2) {
      h -= (1 - dMessina / 0.2) * 5500;
    }
    return h;
  },
  getTerrainSample: (angle: number) => {
    const dMessina = Math.abs(angle - 1.8);
    if (dMessina < 0.2) {
      return {
        elevation: -5500 * (1 - dMessina / 0.2),
        slope: 0.6,
        surfaceType: 'chasm',
        surfaceColor: '#334155',
        strataColors: ['#475569', '#334155', '#1e293b', '#0f172a'],
        featureName: 'Messina Chasma Grand Rift',
      };
    }
    return {
      elevation: Math.sin(angle * 5) * 800 + Math.cos(angle * 13) * 600,
      slope: 0.18,
      surfaceType: 'ice',
      surfaceColor: '#cbd5e1',
      strataColors: ['#94a3b8', '#64748b', '#475569', '#334155'],
      featureName: 'Cratered Icy Mantle',
    };
  },
};

export const titaniaSpec: CelestialBodySpec = {
  id: 'titania',
  name: 'Titania',
  category: 'moon',
  parent: 'uranus',
  radius: 38000,
  realRadiusKm: 788.4,
  realDistanceKm: 435910,
  realSemiMajorAxisAU: 0.002914,
  mass: 3.527e21,
  realMassKg: 3.527e21,
  mu: 2.353e11,
  surfaceGravity: 0.378,
  realSurfaceGravityMs2: 0.378,
  escapeVelocity: 772,
  realEscapeVelocityKms: 0.772,
  realOrbitSpeedKms: 3.64,
  realOrbitPeriodDays: 8.706,
  realDensityGcm3: 1.711,
  realSurfacePressureBar: 0,
  realHillSphereKm: 5800,
  realSurfaceTempRangeK: { min: 60, avg: 70, max: 89 },
  axialTiltDeg: 0,
  rotationPeriodSec: 752256, // 8.706 days
  hasAtmosphere: false,
  atmosphereHeight: 0,
  scaleHeight: 0,
  surfacePressureAtm: 0,
  surfaceDensityKgM3: 0,
  atmosphereComposition: 'Trace CO2 exosphere',
  atmosphereColor: 'rgba(0,0,0,0)',
  atmosphereGlowColor: 'rgba(0,0,0,0)',
  atmosphereRimColor: 'rgba(203, 213, 225, 0.2)',
  hazeOpacity: 0,
  orbitRadius: 2800000,
  orbitPeriod: 8.706 * 86400,
  orbitSpeed: 3640,
  soiRadius: 110000,
  initialAngle: 4.3,
  primaryColor: '#cbd5e1',
  secondaryColor: '#64748b',
  accentColor: '#e2e8f0',
  surfaceDetailType: 'titania_canyons',
  details: 'The largest moon of Uranus, carved by massive extensional grabens and rift valleys formed as its interior ocean froze and expanded.',
  geologySummary: 'Heavily cratered icy crust bisected by the 1,500-km-long Messina Chasma and extensive fault scarps.',
  landSurface: titaniaLandSurface,
};
