import { CelestialBodySpec, LandSurfaceSpec } from './types';

export const venusLandSurface: LandSurfaceSpec = {
  bodyId: 'venus',
  bodyName: 'Venus',
  baseColor: '#eab308',
  secondaryColor: '#ca8a04',
  crustRockColor: '#78350f',
  soilDustColor: '#fde047',
  highlightColor: '#fef08a',
  shadowColor: '#451a03',
  baseElevationM: 0,
  maxElevationM: 11000,
  minElevationM: -3000,
  roughness: 0.75,
  craterDensity: 0.12, // Low crater density due to young surface (~500 Myr) and runaway volcanic resurfacing
  geologicalComposition: 'Basaltic volcanic slab plains, shield volcanoes, coronae, tessera terrains, supercritical CO2 and sulfuric acid rock weathering',
  surfaceTemperatureK: { min: 710, avg: 737, max: 770 },
  radiationLevelRadHr: 15,
  surfaceFeatures: [
    {
      id: 'maxwell_montes',
      name: 'Maxwell Montes & Cleopatra Patera',
      type: 'mountain',
      angleRad: 1.1,
      widthKm: 853,
      elevationMeters: 11000,
      description: 'The highest mountain range on Venus, towering 11 km above planetary datum, coated in metallic semiconductor frost (lead sulfide/bismuth)',
      color: '#fef08a',
    },
    {
      id: 'maat_mons',
      name: 'Maat Mons Shield Volcano',
      type: 'volcano',
      angleRad: 2.8,
      widthKm: 395,
      elevationMeters: 8000,
      description: 'Highest shield volcano on Venus with recent evidence of active effusive basaltic volcanism and fresh lava flows',
      color: '#d97706',
    },
    {
      id: 'aphrodite_terra',
      name: 'Aphrodite Terra Continental Plateau',
      type: 'mountain',
      angleRad: 4.4,
      widthKm: 10000,
      elevationMeters: 4500,
      description: 'Continent-sized highland plateau marked by intricate tessera compressional folding and extensional rift valleys',
      color: '#b45309',
    },
    {
      id: 'venera_13_site',
      name: 'Venera 13 Landing Site',
      type: 'landing_site',
      angleRad: 5.6,
      widthKm: 10,
      elevationMeters: -120,
      description: 'Historic Soviet probe touchdown site in Phoebe Regio, captured color panoramic photos of golden volcanic plateaus',
      color: '#ef4444',
      hasStructure: true,
    },
  ],
  getHeightAtAngle: (angle: number) => {
    let h = Math.sin(angle * 4) * 800 + Math.cos(angle * 9) * 1100;
    // Maxwell Montes massif
    const dMaxwell = Math.abs(angle - 1.1);
    if (dMaxwell < 0.25) {
      h += (1 - dMaxwell / 0.25) * 8500;
    }
    // High-altitude tessera wrinkles
    h += Math.sin(angle * 45) * 350 + Math.cos(angle * 90) * 180;
    return h;
  },
  getTerrainSample: (angle: number) => {
    const dMaxwell = Math.abs(angle - 1.1);
    if (dMaxwell < 0.25) {
      return {
        elevation: 2500 + (1 - dMaxwell / 0.25) * 8500,
        slope: 0.42,
        surfaceType: 'metallic',
        surfaceColor: '#fef08a',
        strataColors: ['#fde047', '#eab308', '#ca8a04', '#78350f'],
        featureName: 'Maxwell Montes Metallic Frost',
      };
    }
    const dVenera = Math.abs(angle - 5.6);
    if (dVenera < 0.05) {
      return {
        elevation: -120,
        slope: 0.03,
        surfaceType: 'basalt',
        surfaceColor: '#eab308',
        strataColors: ['#ca8a04', '#a16207', '#78350f', '#451a03'],
        featureName: 'Venera 13 Touchdown Site',
      };
    }
    return {
      elevation: Math.sin(angle * 4) * 800 + Math.cos(angle * 9) * 1100,
      slope: 0.12,
      surfaceType: 'basalt',
      surfaceColor: '#ca8a04',
      strataColors: ['#a16207', '#854d0e', '#713f12', '#451a03'],
      featureName: 'Volcanic Tessera Plain',
    };
  },
};

export const venusSpec: CelestialBodySpec = {
  id: 'venus',
  name: 'Venus',
  category: 'planet',
  parent: 'sun',
  radius: 295000,
  realRadiusKm: 6051.8,
  realDistanceKm: 108208000,
  realSemiMajorAxisAU: 0.723332,
  mass: 4.8675e24,
  realMassKg: 4.8675e24,
  mu: 3.24859e14,
  surfaceGravity: 8.87,
  realSurfaceGravityMs2: 8.87,
  escapeVelocity: 10360,
  realEscapeVelocityKms: 10.36,
  realOrbitSpeedKms: 35.02,
  realOrbitPeriodDays: 224.701,
  realDensityGcm3: 5.243,
  realSurfacePressureBar: 92.0,
  realHillSphereKm: 1011000,
  realSurfaceTempRangeK: { min: 710, avg: 737, max: 770 },
  axialTiltDeg: 177.36, // Retrograde rotation
  rotationPeriodSec: 20996800, // 243 Earth days retrograde
  hasAtmosphere: true,
  atmosphereHeight: 45000,
  scaleHeight: 15900,
  surfacePressureAtm: 92.0, // 9.3 MPa crushing pressure
  surfaceDensityKgM3: 67.0, // 55x denser than Earth sea level
  atmosphereComposition: '96.5% Carbon Dioxide, 3.5% Nitrogen, 150 ppm Sulfur Dioxide, Sulfuric Acid aerosol decks',
  atmosphereColor: 'rgba(234, 179, 8, 0.75)',
  atmosphereGlowColor: 'rgba(202, 138, 4, 0.45)',
  atmosphereRimColor: 'rgba(254, 240, 138, 0.95)',
  hazeOpacity: 0.98,
  orbitRadius: 32000000,
  orbitPeriod: 224.7 * 86400,
  orbitSpeed: 35020,
  soiRadius: 3600000,
  initialAngle: 2.1,
  semiMajorAxisAU: 0.723,
  primaryColor: '#eab308',
  secondaryColor: '#ca8a04',
  accentColor: '#fef08a',
  surfaceDetailType: 'venus_clouds',
  details: 'Earth’s toxic twin enveloped in opaque reflective sulfuric acid cloud decks driven by super-rotating 360 km/h zonal winds and extreme runaway greenhouse heating.',
  geologySummary: 'Crushing 92-bar supercritical CO2 atmosphere blanketing immense volcanic lava basalt plains, towering shield volcanoes, and unique arachnoid coronae.',
  landSurface: venusLandSurface,
};
