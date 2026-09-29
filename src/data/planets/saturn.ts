import { CelestialBodySpec, LandSurfaceSpec } from './types';

// SATURN
export const saturnLandSurface: LandSurfaceSpec = {
  bodyId: 'saturn',
  bodyName: 'Saturn (Cronus)',
  baseColor: '#f59e0b',
  secondaryColor: '#d97706',
  crustRockColor: '#b45309',
  soilDustColor: '#fef3c7',
  highlightColor: '#fed7aa',
  shadowColor: '#78350f',
  baseElevationM: 0,
  maxElevationM: 22000,
  minElevationM: -30000,
  roughness: 0.12,
  craterDensity: 0,
  geologicalComposition: 'Fluid gas giant: Gaseous hydrogen/helium atmosphere, ammonia and ammonium hydrosulfide ice haze decks, metallic hydrogen mantle',
  surfaceTemperatureK: { min: 82, avg: 134, max: 11700 },
  radiationLevelRadHr: 120,
  surfaceFeatures: [
    {
      id: 'polar_hexagon',
      name: 'North Polar Hexagonal Jet Stream',
      type: 'plain',
      angleRad: Math.PI * 0.5,
      widthKm: 29000,
      elevationMeters: 5000,
      description: 'Persistent 6-sided atmospheric jet stream wave spanning 29,000 km across Saturn’s north pole with a central cyclonic vortex',
      color: '#fef08a',
    },
    {
      id: 'great_white_spot',
      name: 'Great White Spot Storm System',
      type: 'plain',
      angleRad: 2.5,
      widthKm: 10000,
      elevationMeters: 8000,
      description: 'Periodic massive convective storm eruption occurring roughly once every Saturnian year (29.5 Earth years)',
      color: '#ffffff',
    },
  ],
  getHeightAtAngle: (angle: number) => {
    return Math.sin(angle * 14) * 3500 + Math.cos(angle * 28) * 1800;
  },
  getTerrainSample: (angle: number) => {
    return {
      elevation: Math.sin(angle * 14) * 3500 + Math.cos(angle * 28) * 1800,
      slope: 0.04,
      surfaceType: 'gas',
      surfaceColor: Math.sin(angle * 6) > 0 ? '#f59e0b' : '#d97706',
      strataColors: ['#d97706', '#b45309', '#92400e', '#78350f'],
      featureName: 'Saturnian Atmospheric Belt',
    };
  },
};

export const saturnSpec: CelestialBodySpec = {
  id: 'saturn',
  name: 'Saturn (Cronus)',
  category: 'planet',
  parent: 'sun',
  radius: 540000,
  realRadiusKm: 58232,
  realDistanceKm: 1433530000,
  realSemiMajorAxisAU: 9.5826,
  mass: 5.6834e26,
  realMassKg: 5.6834e26,
  mu: 3.7931187e16,
  surfaceGravity: 10.44,
  realSurfaceGravityMs2: 10.44,
  escapeVelocity: 35500,
  realEscapeVelocityKms: 35.5,
  realOrbitSpeedKms: 9.68,
  realOrbitPeriodDays: 10759.22,
  realDensityGcm3: 0.687, // Floats in water!
  realSurfacePressureBar: 140,
  realHillSphereKm: 65340000,
  realSurfaceTempRangeK: { min: 82, avg: 134, max: 11700 },
  axialTiltDeg: 26.73,
  rotationPeriodSec: 38360, // 10h 33m
  hasAtmosphere: true,
  atmosphereHeight: 70000,
  scaleHeight: 59500,
  surfacePressureAtm: 140,
  surfaceDensityKgM3: 0.687, // Less dense than liquid water!
  atmosphereComposition: '96.3% Hydrogen, 3.25% Helium, 0.45% Methane, 0.01% Ammonia',
  atmosphereColor: 'rgba(245, 158, 11, 0.65)',
  atmosphereGlowColor: 'rgba(217, 119, 6, 0.4)',
  atmosphereRimColor: 'rgba(254, 240, 138, 0.95)',
  hazeOpacity: 0.92,
  orbitRadius: 280000000,
  orbitPeriod: 10759 * 86400,
  orbitSpeed: 9690,
  soiRadius: 14000000,
  initialAngle: 5.5,
  semiMajorAxisAU: 9.582,
  hasRings: true,
  ringInnerRadius: 650000,
  ringOuterRadius: 1350000,
  ringColor: 'rgba(254, 240, 138, 0.75)',
  ringSecondaryColor: 'rgba(217, 119, 6, 0.45)',
  cassiniDivision: { inner: 980000, outer: 1040000 },
  primaryColor: '#f59e0b',
  secondaryColor: '#d97706',
  accentColor: '#fef08a',
  surfaceDetailType: 'saturn_bands',
  details: 'The Jewel of the Solar System, adorned with a glorious 282,000-km-wide ring system composed of pure water ice chunks, pebbles, and boulders.',
  geologySummary: 'Subtle golden ammonia clouds draped beneath hazy stratospheric smog, punctuated by the bizarre geometric North Polar Hexagon.',
  landSurface: saturnLandSurface,
};

// TITAN (Dense Atmosphere & Liquid Methane Seas)
export const titanLandSurface: LandSurfaceSpec = {
  bodyId: 'titan',
  bodyName: 'Titan',
  baseColor: '#d97706',
  secondaryColor: '#b45309',
  crustRockColor: '#78350f',
  soilDustColor: '#f59e0b',
  highlightColor: '#fef3c7',
  shadowColor: '#451a03',
  baseElevationM: 0,
  maxElevationM: 3300, // Mithrim Montes
  minElevationM: -1800, // Kraken Mare floor
  roughness: 0.45,
  craterDensity: 0.1,
  geologicalComposition: 'Water-ice bedrock, complex hydrocarbon and tholin organic sand dunes, liquid methane and ethane rivers, lakes, and seas',
  surfaceTemperatureK: { min: 90, avg: 94, max: 98 },
  radiationLevelRadHr: 0.05, // Heavy atmospheric shielding
  surfaceFeatures: [
    {
      id: 'kraken_mare',
      name: 'Kraken Mare (Liquid Hydrocarbon Sea)',
      type: 'lake',
      angleRad: 0.8,
      widthKm: 1170,
      elevationMeters: -1800,
      description: 'Largest liquid methane and ethane sea on Titan, spanning 400,000 km² with depths exceeding 300 meters',
      color: '#082f49',
    },
    {
      id: 'shangri_la_dunes',
      name: 'Shangri-La Hydrocarbon Sand Sea',
      type: 'plain',
      angleRad: 3.2,
      widthKm: 3500,
      elevationMeters: 250,
      description: 'Expansive dark sand sea formed of fine organic tholin grit blown into parallel longitudinal dunes by tidal winds',
      color: '#451a03',
    },
    {
      id: 'huygens_landing_site',
      name: 'ESA Huygens Probe Landing Site',
      type: 'landing_site',
      angleRad: 2.1,
      widthKm: 8,
      elevationMeters: -40,
      description: 'Historic touchdown site of ESA’s Huygens probe on a dark plain of water-ice cobblestones washed by liquid methane floods',
      color: '#f97316',
      hasStructure: true,
    },
  ],
  getHeightAtAngle: (angle: number) => {
    let h = Math.sin(angle * 5) * 600 + Math.cos(angle * 12) * 400;
    const dKraken = Math.abs(angle - 0.8);
    if (dKraken < 0.25) {
      h -= (1 - dKraken / 0.25) * 1800;
    }
    return h;
  },
  getTerrainSample: (angle: number) => {
    const dKraken = Math.abs(angle - 0.8);
    if (dKraken < 0.25) {
      return {
        elevation: -1800 * (1 - dKraken / 0.25),
        slope: 0.02,
        surfaceType: 'methane',
        surfaceColor: '#082f49',
        strataColors: ['#0c4a6e', '#075985', '#0369a1', '#0284c7'],
        featureName: 'Kraken Mare Liquid Hydrocarbon Sea',
      };
    }
    const dHuygens = Math.abs(angle - 2.1);
    if (dHuygens < 0.05) {
      return {
        elevation: -40,
        slope: 0.03,
        surfaceType: 'ice',
        surfaceColor: '#ea580c',
        strataColors: ['#c2410c', '#9a3412', '#7c2d12', '#431407'],
        featureName: 'ESA Huygens Landing Site (Pebble Plain)',
      };
    }
    return {
      elevation: Math.sin(angle * 5) * 600 + Math.cos(angle * 12) * 400,
      slope: 0.1,
      surfaceType: 'sand',
      surfaceColor: '#d97706',
      strataColors: ['#b45309', '#92400e', '#78350f', '#451a03'],
      featureName: 'Shangri-La Tholin Dunes',
    };
  },
};

export const titanSpec: CelestialBodySpec = {
  id: 'titan',
  name: 'Titan',
  category: 'moon',
  parent: 'saturn',
  radius: 51000,
  realRadiusKm: 2574.73,
  realDistanceKm: 1221870,
  realSemiMajorAxisAU: 0.008168,
  mass: 1.3452e23,
  realMassKg: 1.3452e23,
  mu: 8.97813e12,
  surfaceGravity: 1.352,
  realSurfaceGravityMs2: 1.352,
  escapeVelocity: 2640,
  realEscapeVelocityKms: 2.64,
  realOrbitSpeedKms: 5.57,
  realOrbitPeriodDays: 15.945,
  realDensityGcm3: 1.880,
  realSurfacePressureBar: 1.45,
  realHillSphereKm: 51800,
  realSurfaceTempRangeK: { min: 90, avg: 94, max: 98 },
  axialTiltDeg: 0,
  rotationPeriodSec: 1377648, // 15.945 days
  hasAtmosphere: true,
  atmosphereHeight: 60000,
  scaleHeight: 21000,
  surfacePressureAtm: 1.45, // 1.5x Earth sea-level pressure!
  surfaceDensityKgM3: 5.3, // 4.4x denser than Earth air!
  atmosphereComposition: '95% Nitrogen, 4.9% Methane, trace ethane, diacetylene, hydrogen cyanide',
  atmosphereColor: 'rgba(217, 119, 6, 0.85)',
  atmosphereGlowColor: 'rgba(180, 83, 9, 0.55)',
  atmosphereRimColor: 'rgba(254, 215, 170, 0.95)',
  hazeOpacity: 0.96,
  orbitRadius: 4200000,
  orbitPeriod: 15.945 * 86400,
  orbitSpeed: 5570,
  soiRadius: 190000,
  initialAngle: 1.1,
  primaryColor: '#d97706',
  secondaryColor: '#9a3412',
  accentColor: '#082f49',
  surfaceDetailType: 'titan_methane_haze',
  details: 'The only moon known to possess a dense atmosphere and stable surface bodies of liquid, sustaining a full hydrological cycle based on methane.',
  geologySummary: 'Orange photochemical tholin haze enshrouding liquid methane lakes, braided river channels, water-ice pebble plains, and vast organic sand seas.',
  landSurface: titanLandSurface,
};

// ENCELADUS (Cryovolcanic Geyser Moon)
export const enceladusLandSurface: LandSurfaceSpec = {
  bodyId: 'enceladus',
  bodyName: 'Enceladus',
  baseColor: '#f0f9ff',
  secondaryColor: '#e0f2fe',
  crustRockColor: '#bae6fd',
  soilDustColor: '#ffffff',
  highlightColor: '#ffffff',
  shadowColor: '#0369a1',
  baseElevationM: 0,
  maxElevationM: 1200,
  minElevationM: -1500,
  roughness: 0.4,
  craterDensity: 0.25,
  geologicalComposition: 'Nearly pure reflective water ice, porous snow, south polar thermal ocean venting supersonic cryovolcanic plumes of brine, water vapor, and simple organics',
  surfaceTemperatureK: { min: 33, avg: 75, max: 145 },
  radiationLevelRadHr: 25,
  surfaceFeatures: [
    {
      id: 'tiger_stripes',
      name: 'Tiger Stripe Fractures (Damascus & Baghdad Sulci)',
      type: 'chasm',
      angleRad: Math.PI * 1.5,
      widthKm: 130,
      elevationMeters: -1200,
      description: 'Four parallel 2 km wide, 500 m deep tectonic fissures over the south pole erupting 200 kg/s of oceanic spray into Saturn’s E ring',
      color: '#0284c7',
    },
  ],
  getHeightAtAngle: (angle: number) => {
    let h = Math.sin(angle * 8) * 300;
    const dSouth = Math.abs(angle - Math.PI * 1.5);
    if (dSouth < 0.2) {
      h -= (1 - dSouth / 0.2) * 1100;
    }
    return h;
  },
  getTerrainSample: (angle: number) => {
    const dSouth = Math.abs(angle - Math.PI * 1.5);
    if (dSouth < 0.2) {
      return {
        elevation: -1100 * (1 - dSouth / 0.2),
        slope: 0.45,
        surfaceType: 'ice',
        surfaceColor: '#38bdf8',
        strataColors: ['#0284c7', '#0369a1', '#e0f2fe', '#ffffff'],
        featureName: 'Tiger Stripe Cryo-Venting Rift',
      };
    }
    return {
      elevation: Math.sin(angle * 8) * 300,
      slope: 0.05,
      surfaceType: 'ice',
      surfaceColor: '#ffffff',
      strataColors: ['#f0f9ff', '#e0f2fe', '#bae6fd', '#7dd3fc'],
      featureName: 'Reflective Snow Plains',
    };
  },
};

export const enceladusSpec: CelestialBodySpec = {
  id: 'enceladus',
  name: 'Enceladus',
  category: 'moon',
  parent: 'saturn',
  radius: 12000,
  realRadiusKm: 252.1,
  realDistanceKm: 238040,
  realSemiMajorAxisAU: 0.001591,
  mass: 1.0802e20,
  realMassKg: 1.0802e20,
  mu: 7.21e9,
  surfaceGravity: 0.113,
  realSurfaceGravityMs2: 0.113,
  escapeVelocity: 239,
  realEscapeVelocityKms: 0.239,
  realOrbitSpeedKms: 12.635,
  realOrbitPeriodDays: 1.370,
  realDensityGcm3: 1.609,
  realSurfacePressureBar: 1e-10,
  realHillSphereKm: 950,
  realSurfaceTempRangeK: { min: 33, avg: 75, max: 145 },
  axialTiltDeg: 0,
  rotationPeriodSec: 118382, // 1.37 days
  hasAtmosphere: true,
  atmosphereHeight: 8000,
  scaleHeight: 1500,
  surfacePressureAtm: 1e-10,
  surfaceDensityKgM3: 1e-8,
  atmosphereComposition: '91% Water vapor, 4% Nitrogen, 3.2% Carbon dioxide, 1.7% Methane from geyser plumes',
  atmosphereColor: 'rgba(224, 242, 254, 0.3)',
  atmosphereGlowColor: 'rgba(186, 230, 253, 0.2)',
  atmosphereRimColor: 'rgba(255, 255, 255, 0.85)',
  hazeOpacity: 0.25,
  orbitRadius: 1200000,
  orbitPeriod: 1.37 * 86400,
  orbitSpeed: 12635,
  soiRadius: 35000,
  initialAngle: 2.3,
  primaryColor: '#f0f9ff',
  secondaryColor: '#bae6fd',
  accentColor: '#38bdf8',
  surfaceDetailType: 'enceladus_tiger_stripes',
  details: 'The brightest, most reflective body in the solar system (albedo 0.99), blasting salty oceanic plumes into space that feed Saturn’s expansive E ring.',
  geologySummary: 'Immaculate white snow plains cut by warm tectonic rifts ("Tiger Stripes") venting subsurface ocean hydrothermal spray.',
  landSurface: enceladusLandSurface,
};

// MIMAS (Death Star Moon)
export const mimasLandSurface: LandSurfaceSpec = {
  bodyId: 'mimas',
  bodyName: 'Mimas',
  baseColor: '#cbd5e1',
  secondaryColor: '#94a3b8',
  crustRockColor: '#64748b',
  soilDustColor: '#e2e8f0',
  highlightColor: '#f8fafc',
  shadowColor: '#334155',
  baseElevationM: 0,
  maxElevationM: 6000,
  minElevationM: -10000,
  roughness: 0.95,
  craterDensity: 0.95,
  geologicalComposition: 'Nearly pure low-density water ice (density 1.15 g/cm³) with tiny silicate rock core',
  surfaceTemperatureK: { min: 45, avg: 64, max: 90 },
  radiationLevelRadHr: 35,
  surfaceFeatures: [
    {
      id: 'herschel_crater',
      name: 'Herschel Impact Crater',
      type: 'crater',
      angleRad: 0.8,
      widthKm: 139,
      elevationMeters: -10000,
      description: 'Colossal impact crater spanning 1/3 the diameter of Mimas, with 5 km high outer rim walls and a 6 km high central peak',
      color: '#475569',
    },
  ],
  getHeightAtAngle: (angle: number) => {
    let h = Math.sin(angle * 6) * 500;
    const dHerschel = Math.abs(angle - 0.8);
    if (dHerschel < 0.2) {
      if (dHerschel < 0.05) {
        h += 5000; // Central peak
      } else {
        h -= 9000; // Deep bowl
      }
    }
    return h;
  },
  getTerrainSample: (angle: number) => {
    const dHerschel = Math.abs(angle - 0.8);
    if (dHerschel < 0.2) {
      const isPeak = dHerschel < 0.05;
      return {
        elevation: isPeak ? 5000 : -9000,
        slope: isPeak ? 0.2 : 0.65,
        surfaceType: 'ice',
        surfaceColor: isPeak ? '#f8fafc' : '#475569',
        strataColors: ['#64748b', '#475569', '#334155', '#1e293b'],
        featureName: isPeak ? 'Herschel Central Peak' : 'Herschel Crater Basin',
      };
    }
    return {
      elevation: Math.sin(angle * 6) * 500,
      slope: 0.25,
      surfaceType: 'ice',
      surfaceColor: '#cbd5e1',
      strataColors: ['#94a3b8', '#64748b', '#475569', '#334155'],
      featureName: 'Saturated Ice Crater Rim',
    };
  },
};

export const mimasSpec: CelestialBodySpec = {
  id: 'mimas',
  name: 'Mimas',
  category: 'moon',
  parent: 'saturn',
  radius: 9500,
  realRadiusKm: 198.2,
  realDistanceKm: 185540,
  realSemiMajorAxisAU: 0.00124,
  mass: 3.7493e19,
  realMassKg: 3.7493e19,
  mu: 2.5026e9,
  surfaceGravity: 0.064,
  realSurfaceGravityMs2: 0.064,
  escapeVelocity: 159,
  realEscapeVelocityKms: 0.159,
  realOrbitSpeedKms: 14.280,
  realOrbitPeriodDays: 0.942,
  realDensityGcm3: 1.150,
  realSurfacePressureBar: 0,
  realHillSphereKm: 420,
  realSurfaceTempRangeK: { min: 45, avg: 64, max: 90 },
  axialTiltDeg: 0,
  rotationPeriodSec: 81423, // 0.942 days
  hasAtmosphere: false,
  atmosphereHeight: 0,
  scaleHeight: 0,
  surfacePressureAtm: 0,
  surfaceDensityKgM3: 0,
  atmosphereComposition: 'Vacuum',
  atmosphereColor: 'rgba(0,0,0,0)',
  atmosphereGlowColor: 'rgba(0,0,0,0)',
  atmosphereRimColor: 'rgba(203, 213, 225, 0.2)',
  hazeOpacity: 0,
  orbitRadius: 850000,
  orbitPeriod: 0.942 * 86400,
  orbitSpeed: 14280,
  soiRadius: 28000,
  initialAngle: 4.1,
  primaryColor: '#cbd5e1',
  secondaryColor: '#64748b',
  accentColor: '#f1f5f9',
  surfaceDetailType: 'mimas_herschel',
  details: 'The "Death Star" moon of Saturn, bearing the giant Herschel impact crater that nearly shattered the diminutive icy satellite.',
  geologySummary: 'Heavily pockmarked icy sphere dominated by the 139 km wide Herschel crater and its towering 6 km central mountain.',
  landSurface: mimasLandSurface,
};
