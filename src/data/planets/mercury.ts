import { CelestialBodySpec, LandSurfaceSpec } from './types';

export const mercuryLandSurface: LandSurfaceSpec = {
  bodyId: 'mercury',
  bodyName: 'Mercury',
  baseColor: '#9ca3af',
  secondaryColor: '#6b7280',
  crustRockColor: '#4b5563',
  soilDustColor: '#d1d5db',
  highlightColor: '#f3f4f6',
  shadowColor: '#1f2937',
  baseElevationM: 0,
  maxElevationM: 4500,
  minElevationM: -5200,
  roughness: 0.82,
  craterDensity: 0.94,
  geologicalComposition: 'Dense iron-rich core, silicate crust, anorthosite regolith, graphite-rich carbon deposits, volatiles and water ice in permanently shadowed polar craters',
  surfaceTemperatureK: { min: 100, avg: 440, max: 700 },
  radiationLevelRadHr: 350,
  surfaceFeatures: [
    {
      id: 'caloris_basin',
      name: 'Caloris Planitia (Caloris Basin)',
      type: 'crater',
      angleRad: 0.45,
      widthKm: 1550,
      elevationMeters: -3800,
      description: 'Colossal multi-ring impact basin formed by a 100km asteroid impact, surrounded by concentric mountain rings and lava volcanic plains',
      color: '#475569',
    },
    {
      id: 'pantheon_fossae',
      name: 'Pantheon Fossae (The Spider)',
      type: 'chasm',
      angleRad: 0.52,
      widthKm: 230,
      elevationMeters: -900,
      description: 'Radial extensional grabens and fractures radiating from Apollodorus crater in central Caloris',
      color: '#334155',
    },
    {
      id: 'rembrandt_crater',
      name: 'Rembrandt Impact Basin',
      type: 'crater',
      angleRad: 2.2,
      widthKm: 715,
      elevationMeters: -2400,
      description: 'Young well-preserved impact basin showing exposed ancient volcanic fill and compressional lobate scarps',
      color: '#64748b',
    },
    {
      id: 'discovery_rupes',
      name: 'Discovery Rupes (Lobate Scarp)',
      type: 'mountain',
      angleRad: 3.8,
      widthKm: 650,
      elevationMeters: 2200,
      description: 'Thrust fault scarp formed as Mercury’s massive iron core cooled and contracted, wrinkling the crust',
      color: '#94a3b8',
    },
  ],
  getHeightAtAngle: (angle: number) => {
    // Mercury ancient heavily cratered crust with multi-scale impact rims
    let h = Math.sin(angle * 6) * 900 + Math.cos(angle * 19) * 650;
    // Caloris Basin depression
    const dCaloris = Math.abs(angle - 0.45);
    if (dCaloris < 0.4) {
      h -= (1 - dCaloris / 0.4) * 3500;
    }
    // High-frequency regolith roughness
    h += Math.sin(angle * 64) * 220 + Math.cos(angle * 128) * 110;
    return h;
  },
  getTerrainSample: (angle: number) => {
    const dCaloris = Math.abs(angle - 0.45);
    if (dCaloris < 0.4) {
      return {
        elevation: -3500 * (1 - dCaloris / 0.4),
        slope: 0.15,
        surfaceType: 'basalt',
        surfaceColor: '#4b5563',
        strataColors: ['#374151', '#1f2937', '#111827', '#030712'],
        featureName: 'Caloris Planitia Impact Basin',
      };
    }
    const dRupes = Math.abs(angle - 3.8);
    if (dRupes < 0.12) {
      return {
        elevation: 2200 * (1 - dRupes / 0.12),
        slope: 0.48,
        surfaceType: 'rock',
        surfaceColor: '#9ca3af',
        strataColors: ['#6b7280', '#4b5563', '#374151', '#1f2937'],
        featureName: 'Discovery Rupes Fault Scarp',
      };
    }
    return {
      elevation: Math.sin(angle * 6) * 900 + Math.cos(angle * 19) * 650,
      slope: 0.22,
      surfaceType: 'regolith',
      surfaceColor: '#6b7280',
      strataColors: ['#4b5563', '#374151', '#1f2937', '#111827'],
      featureName: 'Mercurian Highlands Regolith',
    };
  },
};

export const mercurySpec: CelestialBodySpec = {
  id: 'mercury',
  name: 'Mercury',
  category: 'planet',
  parent: 'sun',
  radius: 120000,
  realRadiusKm: 2439.7,
  realDistanceKm: 57909050,
  realSemiMajorAxisAU: 0.387098,
  mass: 3.3011e23,
  realMassKg: 3.3011e23,
  mu: 2.2032e13,
  surfaceGravity: 3.7,
  realSurfaceGravityMs2: 3.70,
  escapeVelocity: 4250,
  realEscapeVelocityKms: 4.25,
  realOrbitSpeedKms: 47.36,
  realOrbitPeriodDays: 87.969,
  realDensityGcm3: 5.427,
  realSurfacePressureBar: 1e-15,
  realHillSphereKm: 220600,
  realSurfaceTempRangeK: { min: 100, avg: 440, max: 700 },
  axialTiltDeg: 0.034,
  rotationPeriodSec: 5067000, // 58.646 days (3:2 spin-orbit resonance)
  hasAtmosphere: false,
  atmosphereHeight: 0,
  scaleHeight: 0,
  surfacePressureAtm: 0,
  surfaceDensityKgM3: 0,
  atmosphereComposition: 'Trace exosphere: Oxygen, Sodium, Hydrogen, Helium, Potassium',
  atmosphereColor: 'rgba(0, 0, 0, 0)',
  atmosphereGlowColor: 'rgba(0, 0, 0, 0)',
  atmosphereRimColor: 'rgba(203, 213, 225, 0.2)',
  hazeOpacity: 0,
  orbitRadius: 18000000,
  orbitPeriod: 88 * 86400,
  orbitSpeed: 47360,
  soiRadius: 1200000,
  initialAngle: 0.8,
  semiMajorAxisAU: 0.387,
  primaryColor: '#9ca3af',
  secondaryColor: '#6b7280',
  accentColor: '#cbd5e1',
  surfaceDetailType: 'mercury_craters',
  details: 'Innermost terrestrial planet with a gigantic iron-nickel core making up 85% of its radius and an extreme 3:2 spin-orbit resonance.',
  geologySummary: 'Heavily bombarded primordial regolith scarred by lobate thrust scarps, ghost craters, volcanic plains, and the vast Caloris basin.',
  landSurface: mercuryLandSurface,
};
