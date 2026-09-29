import { CelestialBodySpec, LandSurfaceSpec } from './types';

// NEPTUNE
export const neptuneLandSurface: LandSurfaceSpec = {
  bodyId: 'neptune',
  bodyName: 'Neptune (Poseidon)',
  baseColor: '#2563eb',
  secondaryColor: '#1d4ed8',
  crustRockColor: '#1e40af',
  soilDustColor: '#60a5fa',
  highlightColor: '#93c5fd',
  shadowColor: '#172554',
  baseElevationM: 0,
  maxElevationM: 16000,
  minElevationM: -20000,
  roughness: 0.12,
  craterDensity: 0,
  geologicalComposition: 'Deep azure ice giant: Hydrogen-helium atmosphere rich in methane and unknown chromophores, supersonic jet streams, supercritical water-ammonia mantle',
  surfaceTemperatureK: { min: 55, avg: 72, max: 7000 },
  radiationLevelRadHr: 12,
  surfaceFeatures: [
    {
      id: 'great_dark_spot',
      name: 'The Great Dark Spot (GDS-89)',
      type: 'plain',
      angleRad: 1.3,
      widthKm: 13000,
      elevationMeters: -4000,
      description: 'Colossal anticyclonic atmospheric hole in Neptune’s methane cloud deck, accompanied by high-altitude white companion cirrus clouds',
      color: '#1e3a8a',
    },
    {
      id: 'scooter_cloud',
      name: 'Scooter (High-Speed White Cirrus)',
      type: 'plain',
      angleRad: 3.8,
      widthKm: 4000,
      elevationMeters: 9000,
      description: 'Fast-moving, brilliant white methane ice cirrus cloud racing around the planet faster than the main dark spots',
      color: '#ffffff',
    },
  ],
  getHeightAtAngle: (angle: number) => {
    return Math.sin(angle * 12) * 2500 + Math.cos(angle * 24) * 1400;
  },
  getTerrainSample: (angle: number) => {
    return {
      elevation: Math.sin(angle * 12) * 2500 + Math.cos(angle * 24) * 1400,
      slope: 0.04,
      surfaceType: 'gas',
      surfaceColor: '#2563eb',
      strataColors: ['#1d4ed8', '#1e40af', '#1e3a8a', '#172554'],
      featureName: 'Deep Azure Methane Storm Deck',
    };
  },
};

export const neptuneSpec: CelestialBodySpec = {
  id: 'neptune',
  name: 'Neptune (Poseidon)',
  category: 'planet',
  parent: 'sun',
  radius: 350000,
  realRadiusKm: 24622,
  realDistanceKm: 4495060000,
  realSemiMajorAxisAU: 30.070,
  mass: 1.024e26,
  realMassKg: 1.024e26,
  mu: 6.836529e15,
  surfaceGravity: 11.15,
  realSurfaceGravityMs2: 11.15,
  escapeVelocity: 23500,
  realEscapeVelocityKms: 23.5,
  realOrbitSpeedKms: 5.43,
  realOrbitPeriodDays: 60190,
  realDensityGcm3: 1.638,
  realSurfacePressureBar: 100,
  realHillSphereKm: 116000000,
  realSurfaceTempRangeK: { min: 55, avg: 72, max: 7000 },
  axialTiltDeg: 28.32,
  rotationPeriodSec: 57996, // 16h 6m 36s
  hasAtmosphere: true,
  atmosphereHeight: 60000,
  scaleHeight: 20000,
  surfacePressureAtm: 100,
  surfaceDensityKgM3: 1.638,
  atmosphereComposition: '80% Hydrogen, 19% Helium, 1.5% Methane, trace ammonia, ethane, ethyne',
  atmosphereColor: 'rgba(37, 99, 235, 0.7)',
  atmosphereGlowColor: 'rgba(29, 78, 216, 0.45)',
  atmosphereRimColor: 'rgba(147, 197, 253, 0.95)',
  hazeOpacity: 0.92,
  orbitRadius: 560000000,
  orbitPeriod: 60190 * 86400,
  orbitSpeed: 5430,
  soiRadius: 13000000,
  initialAngle: 3.6,
  semiMajorAxisAU: 30.07,
  hasRings: true,
  ringInnerRadius: 400000,
  ringOuterRadius: 520000,
  ringColor: 'rgba(96, 165, 250, 0.25)',
  primaryColor: '#2563eb',
  secondaryColor: '#1d4ed8',
  accentColor: '#93c5fd',
  surfaceDetailType: 'neptune_storm_blue',
  details: 'The windiest world in the Solar System, with supersonic storms topping 2,100 km/h, deep azure methane skies, and five faint dusty rings.',
  geologySummary: 'Vibrant cobalt-blue cloud decks punctuated by transient Great Dark Spots and fleeting white methane ice cirrus plumes.',
  landSurface: neptuneLandSurface,
};

// TRITON (Captured Kuiper Belt Moon)
export const tritonLandSurface: LandSurfaceSpec = {
  bodyId: 'triton',
  bodyName: 'Triton',
  baseColor: '#a5f3fc',
  secondaryColor: '#67e8f9',
  crustRockColor: '#0891b2',
  soilDustColor: '#cffafe',
  highlightColor: '#f0fdfa',
  shadowColor: '#155e75',
  baseElevationM: 0,
  maxElevationM: 2500,
  minElevationM: -3000,
  roughness: 0.65,
  craterDensity: 0.2, // Very young surface (~50 Myr) actively resurfaced by nitrogen cryovolcanism
  geologicalComposition: 'Frozen nitrogen, methane, and dry ice crust over a water-ice mantle, subterranean liquid ocean, and active subsurface nitrogen geysers',
  surfaceTemperatureK: { min: 34, avg: 38, max: 44 }, // One of the coldest places in the Solar System!
  radiationLevelRadHr: 2,
  surfaceFeatures: [
    {
      id: 'cantaloupe_terrain',
      name: 'Bubembe Regio (Cantaloupe Terrain)',
      type: 'plain',
      angleRad: 1.2,
      widthKm: 1800,
      elevationMeters: 400,
      description: 'Dimpled texture resembling the skin of a cantaloupe melon, formed by diapiric upwelling of light ice through heavier crust',
      color: '#06b6d4',
    },
    {
      id: 'nitrogen_geysers',
      name: 'South Polar Nitrogen Geysers (Hili & Mahilani)',
      type: 'volcano',
      angleRad: Math.PI * 1.5,
      widthKm: 300,
      elevationMeters: 1200,
      description: 'Active solar-heated liquid nitrogen geysers erupting 8 km into the sky, depositing long black carbonaceous tholin streaks across the ice',
      color: '#1e293b',
    },
  ],
  getHeightAtAngle: (angle: number) => {
    let h = Math.sin(angle * 6) * 500 + Math.cos(angle * 16) * 350;
    const dSouth = Math.abs(angle - Math.PI * 1.5);
    if (dSouth < 0.2) {
      h += (1 - dSouth / 0.2) * 1100;
    }
    return h;
  },
  getTerrainSample: (angle: number) => {
    const dSouth = Math.abs(angle - Math.PI * 1.5);
    if (dSouth < 0.2) {
      return {
        elevation: 1100 * (1 - dSouth / 0.2),
        slope: 0.35,
        surfaceType: 'volcano',
        surfaceColor: '#1e293b',
        strataColors: ['#0f172a', '#0891b2', '#a5f3fc', '#ffffff'],
        featureName: 'South Polar Nitrogen Cryo-Geyser Plume',
      };
    }
    const dCantaloupe = Math.abs(angle - 1.2);
    if (dCantaloupe < 0.2) {
      return {
        elevation: 400 + Math.sin(angle * 40) * 80,
        slope: 0.15,
        surfaceType: 'ice',
        surfaceColor: '#06b6d4',
        strataColors: ['#0891b2', '#155e75', '#a5f3fc', '#ffffff'],
        featureName: 'Bubembe Regio Cantaloupe Terrain',
      };
    }
    return {
      elevation: Math.sin(angle * 6) * 500 + Math.cos(angle * 16) * 350,
      slope: 0.12,
      surfaceType: 'ice',
      surfaceColor: '#a5f3fc',
      strataColors: ['#67e8f9', '#0891b2', '#155e75', '#0e7490'],
      featureName: 'Nitrogen/Methane Frost Plain',
    };
  },
};

export const tritonSpec: CelestialBodySpec = {
  id: 'triton',
  name: 'Triton',
  category: 'moon',
  parent: 'neptune',
  radius: 35000,
  realRadiusKm: 1353.4,
  realDistanceKm: 354759,
  realSemiMajorAxisAU: 0.002371,
  mass: 2.14e22,
  realMassKg: 2.14e22,
  mu: 1.428e12,
  surfaceGravity: 0.779,
  realSurfaceGravityMs2: 0.779,
  escapeVelocity: 1455,
  realEscapeVelocityKms: 1.455,
  realOrbitSpeedKms: 4.39,
  realOrbitPeriodDays: 5.877,
  realDensityGcm3: 2.061,
  realSurfacePressureBar: 1.4e-5,
  realHillSphereKm: 9500,
  realSurfaceTempRangeK: { min: 34, avg: 38, max: 44 },
  axialTiltDeg: 129.6, // Retrograde orbit!
  rotationPeriodSec: 507764, // 5.877 days retrograde (tidally locked)
  hasAtmosphere: true,
  atmosphereHeight: 12000,
  scaleHeight: 4000,
  surfacePressureAtm: 1.4e-5, // 1.4 Pa nitrogen atmosphere
  surfaceDensityKgM3: 0.0001,
  atmosphereComposition: '99% Nitrogen, trace methane and carbon monoxide',
  atmosphereColor: 'rgba(165, 243, 252, 0.3)',
  atmosphereGlowColor: 'rgba(6, 182, 212, 0.2)',
  atmosphereRimColor: 'rgba(240, 253, 250, 0.8)',
  hazeOpacity: 0.35,
  orbitRadius: 1800000,
  orbitPeriod: 5.877 * 86400,
  orbitSpeed: 4390,
  soiRadius: 95000,
  initialAngle: 2.1,
  primaryColor: '#a5f3fc',
  secondaryColor: '#0891b2',
  accentColor: '#1e293b',
  surfaceDetailType: 'triton_cantaloupe',
  details: 'Captured Kuiper Belt dwarf planet orbiting Neptune backward (retrograde), venting towering geysers of liquid nitrogen onto its frozen surface.',
  geologySummary: 'Glistening pinkish-blue cantaloupe terrain of nitrogen-methane snow and dark plumes trailing across the south polar cap.',
  landSurface: tritonLandSurface,
};
