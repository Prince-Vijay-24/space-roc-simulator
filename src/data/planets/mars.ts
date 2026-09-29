import { CelestialBodySpec, LandSurfaceSpec } from './types';

export const marsLandSurface: LandSurfaceSpec = {
  bodyId: 'mars',
  bodyName: 'Mars (Ares)',
  baseColor: '#b45309',
  secondaryColor: '#9a3412',
  crustRockColor: '#78350f',
  soilDustColor: '#ea580c',
  highlightColor: '#fed7aa',
  shadowColor: '#431407',
  baseElevationM: 0,
  maxElevationM: 21287, // Olympus Mons summit
  minElevationM: -8200, // Hellas Planitia floor
  roughness: 0.85,
  craterDensity: 0.65,
  geologicalComposition: 'Iron(III) oxide (rust) regolith, basaltic volcanic crust, permafrost water ice sheets, dry ice (CO2) polar caps, ancient river valleys and lakebed clays',
  surfaceTemperatureK: { min: 130, avg: 210, max: 308 },
  radiationLevelRadHr: 28,
  surfaceFeatures: [
    {
      id: 'olympus_mons',
      name: 'Olympus Mons Caldera & Scarp',
      type: 'volcano',
      angleRad: 0.75,
      widthKm: 624,
      elevationMeters: 21287,
      description: 'The tallest volcano and mountain in the entire Solar System, rising 2.5x the height of Everest with a 6 km basal scarp and 80 km caldera',
      color: '#c2410c',
    },
    {
      id: 'valles_marineris',
      name: 'Valles Marineris (Grand Canyon of Mars)',
      type: 'chasm',
      angleRad: 1.85,
      widthKm: 4000,
      elevationMeters: -7000,
      description: 'Stupendous tectonic rift canyon system stretching over 4,000 km across Mars, up to 200 km wide and 7 km deep',
      color: '#7c2d12',
    },
    {
      id: 'jezero_crater',
      name: 'Jezero Crater & River Delta',
      type: 'landing_site',
      angleRad: 3.1,
      widthKm: 45,
      elevationMeters: -2500,
      description: 'Ancient paleolake basin explored by NASA’s Perseverance rover, preserving exquisite river delta mudstones and biosignature targets',
      color: '#f97316',
      hasStructure: true,
    },
    {
      id: 'hellas_planitia',
      name: 'Hellas Planitia Impact Basin',
      type: 'crater',
      angleRad: 4.6,
      widthKm: 2300,
      elevationMeters: -8200,
      description: 'One of the largest known impact craters in the Solar System, deep enough to sustain higher atmospheric pressures and morning dust hazes',
      color: '#9a3412',
    },
    {
      id: 'planum_boreum',
      name: 'Planum Boreum (North Polar Ice Cap)',
      type: 'ice_sheet',
      angleRad: Math.PI * 0.5,
      widthKm: 1000,
      elevationMeters: 2000,
      description: 'Spiral chasm-carved permanent water and dry ice dome surrounded by expansive circumpolar sand dune fields (Olympia Planitia)',
      color: '#fef3c7',
    },
  ],
  getHeightAtAngle: (angle: number) => {
    let h = Math.sin(angle * 5) * 1100 + Math.cos(angle * 11) * 900;
    // Olympus Mons towering peak at 0.75
    const dOlympus = Math.abs(angle - 0.75);
    if (dOlympus < 0.22) {
      h += (1 - dOlympus / 0.22) * 19500;
    }
    // Valles Marineris trench at 1.85
    const dValles = Math.abs(angle - 1.85);
    if (dValles < 0.3) {
      h -= (1 - dValles / 0.3) * 6500;
    }
    // Hellas basin at 4.6
    const dHellas = Math.abs(angle - 4.6);
    if (dHellas < 0.35) {
      h -= (1 - dHellas / 0.35) * 7500;
    }
    // Wind-blown dune ripple roughness
    h += Math.sin(angle * 60) * 280 + Math.cos(angle * 120) * 140;
    return h;
  },
  getTerrainSample: (angle: number) => {
    const dOlympus = Math.abs(angle - 0.75);
    if (dOlympus < 0.22) {
      const isCaldera = dOlympus < 0.04;
      return {
        elevation: isCaldera ? 18000 : 21287 * (1 - dOlympus / 0.22),
        slope: isCaldera ? 0.05 : 0.45,
        surfaceType: 'volcano',
        surfaceColor: '#c2410c',
        strataColors: ['#9a3412', '#7c2d12', '#431407', '#1c1917'],
        featureName: isCaldera ? 'Olympus Mons Caldera' : 'Olympus Mons Shield Flank',
      };
    }
    const dValles = Math.abs(angle - 1.85);
    if (dValles < 0.3) {
      return {
        elevation: -7000 * (1 - dValles / 0.3),
        slope: 0.52,
        surfaceType: 'chasm',
        surfaceColor: '#7c2d12',
        strataColors: ['#9a3412', '#78350f', '#451a03', '#1c1917'],
        featureName: 'Valles Marineris Chasma',
      };
    }
    const dJezero = Math.abs(angle - 3.1);
    if (dJezero < 0.05) {
      return {
        elevation: -2500,
        slope: 0.02,
        surfaceType: 'sand',
        surfaceColor: '#f97316',
        strataColors: ['#ea580c', '#c2410c', '#9a3412', '#431407'],
        featureName: 'Jezero Crater Delta (Perseverance Site)',
      };
    }
    return {
      elevation: Math.sin(angle * 5) * 1100 + Math.cos(angle * 11) * 900,
      slope: 0.12,
      surfaceType: 'regolith',
      surfaceColor: '#b45309',
      strataColors: ['#9a3412', '#7c2d12', '#431407', '#1c1917'],
      featureName: 'Martian Rust Regolith',
    };
  },
};

export const marsSpec: CelestialBodySpec = {
  id: 'mars',
  name: 'Mars (Ares)',
  category: 'planet',
  parent: 'sun',
  radius: 175000,
  realRadiusKm: 3389.5,
  realDistanceKm: 227939200,
  realSemiMajorAxisAU: 1.523679,
  mass: 6.4171e23,
  realMassKg: 6.4171e23,
  mu: 4.282837e13,
  surfaceGravity: 3.72,
  realSurfaceGravityMs2: 3.721,
  escapeVelocity: 5030,
  realEscapeVelocityKms: 5.027,
  realOrbitSpeedKms: 24.07,
  realOrbitPeriodDays: 686.980,
  realDensityGcm3: 3.933,
  realSurfacePressureBar: 0.00636,
  realHillSphereKm: 982700,
  realSurfaceTempRangeK: { min: 130, avg: 210, max: 293 },
  axialTiltDeg: 25.19,
  rotationPeriodSec: 88642, // 24h 37m 22s (1 Sol)
  hasAtmosphere: true,
  atmosphereHeight: 25000,
  scaleHeight: 11100,
  surfacePressureAtm: 0.0063, // 610 Pa
  surfaceDensityKgM3: 0.02,
  atmosphereComposition: '95.32% Carbon Dioxide, 2.6% Nitrogen, 1.9% Argon, 0.13% Oxygen, suspended iron oxide dust',
  atmosphereColor: 'rgba(234, 88, 12, 0.45)',
  atmosphereGlowColor: 'rgba(194, 65, 12, 0.3)',
  atmosphereRimColor: 'rgba(254, 215, 170, 0.8)',
  hazeOpacity: 0.65,
  orbitRadius: 72000000,
  orbitPeriod: 687 * 86400,
  orbitSpeed: 24077,
  soiRadius: 2800000,
  initialAngle: 1.4,
  semiMajorAxisAU: 1.524,
  primaryColor: '#b45309',
  secondaryColor: '#78350f',
  accentColor: '#fed7aa',
  surfaceDetailType: 'mars_rusty_ridges',
  details: 'The Red Planet, home to the largest shield volcanoes and rift valleys in the solar system, with thin CO2 air and frozen polar ice caps.',
  geologySummary: 'Hemispheric dichotomy dividing smooth northern lowlands from rugged southern cratered highlands, sculpted by catastrophic ancient floods.',
  landSurface: marsLandSurface,
};

// Phobos Spec
export const phobosLandSurface: LandSurfaceSpec = {
  bodyId: 'phobos',
  bodyName: 'Phobos',
  baseColor: '#6b7280',
  secondaryColor: '#4b5563',
  crustRockColor: '#374151',
  soilDustColor: '#9ca3af',
  highlightColor: '#e5e7eb',
  shadowColor: '#1f2937',
  baseElevationM: 0,
  maxElevationM: 2200,
  minElevationM: -3500,
  roughness: 0.95,
  craterDensity: 0.95,
  geologicalComposition: 'Carbonaceous chondrite rubble pile, porous regolith, parallel stress grooves and fracture chains',
  surfaceTemperatureK: { min: 160, avg: 233, max: 270 },
  radiationLevelRadHr: 30,
  surfaceFeatures: [
    {
      id: 'stickney_crater',
      name: 'Stickney Impact Crater',
      type: 'crater',
      angleRad: 0.9,
      widthKm: 9,
      elevationMeters: -3500,
      description: 'Gigantic impact crater covering nearly half the diameter of Phobos, almost shattering the tiny moon',
      color: '#374151',
    },
  ],
  getHeightAtAngle: (angle: number) => {
    // Highly irregular potato shape
    return Math.sin(angle * 2) * 1800 + Math.sin(angle * 5) * 800;
  },
  getTerrainSample: (angle: number) => {
    const dStickney = Math.abs(angle - 0.9);
    if (dStickney < 0.3) {
      return {
        elevation: -3500 * (1 - dStickney / 0.3),
        slope: 0.6,
        surfaceType: 'rock',
        surfaceColor: '#374151',
        strataColors: ['#4b5563', '#374151', '#1f2937', '#111827'],
        featureName: 'Stickney Crater Rim & Grooves',
      };
    }
    return {
      elevation: Math.sin(angle * 2) * 1800 + Math.sin(angle * 5) * 800,
      slope: 0.25,
      surfaceType: 'regolith',
      surfaceColor: '#6b7280',
      strataColors: ['#4b5563', '#374151', '#1f2937', '#111827'],
      featureName: 'Phobos Regolith Grooves',
    };
  },
};

export const phobosSpec: CelestialBodySpec = {
  id: 'phobos',
  name: 'Phobos',
  category: 'moon',
  parent: 'mars',
  radius: 11000,
  realRadiusKm: 11.267,
  realDistanceKm: 9376,
  realSemiMajorAxisAU: 0.0000627,
  mass: 1.0659e16,
  realMassKg: 1.0659e16,
  mu: 7.112e5,
  surfaceGravity: 0.0057,
  realSurfaceGravityMs2: 0.0057,
  escapeVelocity: 11.4,
  realEscapeVelocityKms: 0.01139,
  realOrbitSpeedKms: 2.138,
  realOrbitPeriodDays: 0.3189,
  realDensityGcm3: 1.876,
  realSurfacePressureBar: 0,
  realHillSphereKm: 21.8,
  realSurfaceTempRangeK: { min: 161, avg: 233, max: 268 },
  axialTiltDeg: 0,
  rotationPeriodSec: 27554, // 7.65 hours (tidally locked, orbits faster than Mars rotates!)
  hasAtmosphere: false,
  atmosphereHeight: 0,
  scaleHeight: 0,
  surfacePressureAtm: 0,
  surfaceDensityKgM3: 0,
  atmosphereComposition: 'Vacuum',
  atmosphereColor: 'rgba(0,0,0,0)',
  atmosphereGlowColor: 'rgba(0,0,0,0)',
  atmosphereRimColor: 'rgba(209, 213, 219, 0.2)',
  hazeOpacity: 0,
  orbitRadius: 420000,
  orbitPeriod: 0.3189 * 86400,
  orbitSpeed: 2138,
  soiRadius: 18000,
  initialAngle: 0.3,
  primaryColor: '#6b7280',
  secondaryColor: '#374151',
  accentColor: '#9ca3af',
  surfaceDetailType: 'phobos_grooves',
  details: 'Doom-bound inner moon of Mars, spiraling inwards by 2 meters per century toward eventual tidal disruption into a ring system.',
  geologySummary: 'Severely battered rubble pile asteroid dominated by the colossal Stickney crater and hundreds of parallel tectonic stress troughs.',
  landSurface: phobosLandSurface,
};

// Deimos Spec
export const deimosLandSurface: LandSurfaceSpec = {
  bodyId: 'deimos',
  bodyName: 'Deimos',
  baseColor: '#78716c',
  secondaryColor: '#57534e',
  crustRockColor: '#44403c',
  soilDustColor: '#a8a29e',
  highlightColor: '#f5f5f4',
  shadowColor: '#1c1917',
  baseElevationM: 0,
  maxElevationM: 1200,
  minElevationM: -1800,
  roughness: 0.7,
  craterDensity: 0.7,
  geologicalComposition: 'Carbonaceous chondrite rich in carbonaceous material and silicates, blanketed in a thick 100m layer of fine powdery regolith',
  surfaceTemperatureK: { min: 160, avg: 233, max: 270 },
  radiationLevelRadHr: 30,
  surfaceFeatures: [
    {
      id: 'swift_crater',
      name: 'Swift Crater',
      type: 'crater',
      angleRad: 1.2,
      widthKm: 3,
      elevationMeters: -1200,
      description: 'Smooth regolith-cushioned impact crater named after Jonathan Swift who predicted Martian moons',
      color: '#44403c',
    },
  ],
  getHeightAtAngle: (angle: number) => {
    return Math.sin(angle * 2) * 1100 + Math.cos(angle * 4) * 450;
  },
  getTerrainSample: (angle: number) => {
    return {
      elevation: Math.sin(angle * 2) * 1100 + Math.cos(angle * 4) * 450,
      slope: 0.15,
      surfaceType: 'sand',
      surfaceColor: '#78716c',
      strataColors: ['#57534e', '#44403c', '#292524', '#1c1917'],
      featureName: 'Deimos Dust Sheet',
    };
  },
};

export const deimosSpec: CelestialBodySpec = {
  id: 'deimos',
  name: 'Deimos',
  category: 'moon',
  parent: 'mars',
  radius: 6500,
  realRadiusKm: 6.2,
  realDistanceKm: 23463,
  realSemiMajorAxisAU: 0.0001568,
  mass: 1.4762e15,
  realMassKg: 1.4762e15,
  mu: 9.615e4,
  surfaceGravity: 0.003,
  realSurfaceGravityMs2: 0.003,
  escapeVelocity: 5.6,
  realEscapeVelocityKms: 0.00556,
  realOrbitSpeedKms: 1.351,
  realOrbitPeriodDays: 1.263,
  realDensityGcm3: 1.471,
  realSurfacePressureBar: 0,
  realHillSphereKm: 12.9,
  realSurfaceTempRangeK: { min: 160, avg: 233, max: 270 },
  axialTiltDeg: 0,
  rotationPeriodSec: 109080, // 30.3 hours
  hasAtmosphere: false,
  atmosphereHeight: 0,
  scaleHeight: 0,
  surfacePressureAtm: 0,
  surfaceDensityKgM3: 0,
  atmosphereComposition: 'Vacuum',
  atmosphereColor: 'rgba(0,0,0,0)',
  atmosphereGlowColor: 'rgba(0,0,0,0)',
  atmosphereRimColor: 'rgba(214, 211, 209, 0.2)',
  hazeOpacity: 0,
  orbitRadius: 950000,
  orbitPeriod: 1.263 * 86400,
  orbitSpeed: 1351,
  soiRadius: 15000,
  initialAngle: 2.7,
  primaryColor: '#78716c',
  secondaryColor: '#44403c',
  accentColor: '#a8a29e',
  surfaceDetailType: 'phobos_grooves',
  details: 'Smaller outer moon of Mars with escape velocity under 20 km/h, smoothed over by a deep blanket of electrostatic impact dust.',
  geologySummary: 'Subtle rolling terrain softened by extensive regolith fill that partially buries impact craters and boulders.',
  landSurface: deimosLandSurface,
};
