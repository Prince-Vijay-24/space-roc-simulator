import { CelestialBodySpec, LandSurfaceSpec } from './types';

export const earthLandSurface: LandSurfaceSpec = {
  bodyId: 'earth',
  bodyName: 'Earth (Terra)',
  baseColor: '#0284c7',
  secondaryColor: '#15803d',
  crustRockColor: '#334155',
  soilDustColor: '#d97706',
  highlightColor: '#f8fafc',
  shadowColor: '#0f172a',
  baseElevationM: 0,
  maxElevationM: 8848, // Mt Everest
  minElevationM: -10994, // Challenger Deep
  roughness: 0.65,
  craterDensity: 0.04, // Very low due to active plate tectonics, water/wind erosion
  geologicalComposition: 'Granitic continental crust, basaltic oceanic crust, liquid water oceans (71%), nitrogen-oxygen atmosphere, active mantle convection and magnetic geodynamo',
  surfaceTemperatureK: { min: 184, avg: 288, max: 330 },
  radiationLevelRadHr: 0.03, // Shielded by Van Allen magnetosphere
  surfaceFeatures: [
    {
      id: 'ksc_launchpad_39a',
      name: 'Kennedy Space Center Launch Complex 39A',
      type: 'landing_site',
      angleRad: Math.PI * 0.5, // At launchpad coordinate (0, R)
      widthKm: 8,
      elevationMeters: 4,
      description: 'Historic space launch facility for Apollo 11, the Space Shuttle, Falcon Heavy, and lunar exploration rockets',
      color: '#10b981',
      hasStructure: true,
    },
    {
      id: 'himalayas_everest',
      name: 'Himalayas & Mount Everest (Sagarmāthā)',
      type: 'mountain',
      angleRad: 2.25,
      widthKm: 2400,
      elevationMeters: 8848,
      description: 'Towering continental collision zone where the Indian plate pushes into Eurasia, forming the highest peaks on Earth',
      color: '#f8fafc',
    },
    {
      id: 'mariana_trench',
      name: 'Mariana Trench (Challenger Deep)',
      type: 'chasm',
      angleRad: 2.85,
      widthKm: 2500,
      elevationMeters: -10994,
      description: 'Deepest oceanic subduction trench on Earth located in the western Pacific Ocean',
      color: '#082f49',
    },
    {
      id: 'sahara_desert',
      name: 'Sahara Desert & Ahaggar Mountains',
      type: 'plain',
      angleRad: 1.4,
      widthKm: 4800,
      elevationMeters: 450,
      description: 'Vast subtropical sand erg, gravel reg, and rocky plateaus across Northern Africa',
      color: '#f59e0b',
    },
    {
      id: 'antarctic_ice_sheet',
      name: 'Antarctic Polar Ice Cap',
      type: 'ice_sheet',
      angleRad: Math.PI * 1.5,
      widthKm: 4500,
      elevationMeters: 2800,
      description: 'Massive continental glacial ice sheet locking up 70% of the freshwater on Earth',
      color: '#f8fafc',
    },
  ],
  getHeightAtAngle: (angle: number) => {
    // Continental crust distribution: Americas (~0.6-1.3), Eurasia/Africa (~1.8-3.1), East Asia/Pacific (~3.5-4.8)
    let h = 0;
    // Launchpad at PI/2 is precisely at sea level + 4m
    const dPad = Math.abs(angle - Math.PI * 0.5);
    if (dPad < 0.008) {
      return 4; // Flat concrete apron
    } else if (dPad < 0.035) {
      const blend = (dPad - 0.008) / 0.027;
      return 4 + Math.sin(blend * Math.PI) * 8; // Gentle coastal sand dune
    }

    // Base oceans vs continents
    const isLand = (angle > 0.4 && angle < 1.35) || (angle > 1.7 && angle < 3.2) || (angle > 3.6 && angle < 4.8);
    if (isLand) {
      h = 350 + Math.sin(angle * 12) * 450 + Math.cos(angle * 28) * 280 + Math.sin(angle * 64) * 90;
      // Himalayas spike near 2.25
      const dHim = Math.abs(angle - 2.25);
      if (dHim < 0.2) {
        h += (1 - dHim / 0.2) * 7500;
      }
      // Andes / Rockies near 0.8
      const dAndes = Math.abs(angle - 0.8);
      if (dAndes < 0.15) {
        h += (1 - dAndes / 0.15) * 4200;
      }
    } else {
      // Ocean abyss
      h = -3800 + Math.sin(angle * 8) * 800;
      // Mariana Trench near 2.85
      const dMar = Math.abs(angle - 2.85);
      if (dMar < 0.08) {
        h -= (1 - dMar / 0.08) * 6000;
      }
    }
    return h;
  },
  getTerrainSample: (angle: number) => {
    const dPad = Math.abs(angle - Math.PI * 0.5);
    if (dPad < 0.008) {
      return {
        elevation: 4,
        slope: 0,
        surfaceType: 'sand',
        surfaceColor: '#16a34a',
        strataColors: ['#15803d', '#ca8a04', '#475569', '#1e293b'],
        featureName: 'LC-39A Spaceport',
      };
    }
    const isLand = (angle > 0.4 && angle < 1.35) || (angle > 1.7 && angle < 3.2) || (angle > 3.6 && angle < 4.8);
    const dHim = Math.abs(angle - 2.25);
    if (dHim < 0.12) {
      return {
        elevation: 6000 + (1 - dHim / 0.12) * 2848,
        slope: 0.35,
        surfaceType: 'ice',
        surfaceColor: '#f8fafc',
        strataColors: ['#cbd5e1', '#64748b', '#334155', '#0f172a'],
        featureName: 'Himalayan Ridge',
      };
    }
    if (isLand) {
      const isDesert = angle > 1.35 && angle < 1.65;
      return {
        elevation: 350 + Math.sin(angle * 12) * 450 + Math.cos(angle * 28) * 280,
        slope: 0.08,
        surfaceType: isDesert ? 'sand' : 'grass',
        surfaceColor: isDesert ? '#d97706' : '#15803d',
        strataColors: [isDesert ? '#b45309' : '#166534', '#ca8a04', '#475569', '#1e293b'],
        featureName: isDesert ? 'Sahara Basin' : 'Continental Plains',
      };
    }
    return {
      elevation: -3800 + Math.sin(angle * 8) * 800,
      slope: 0.02,
      surfaceType: 'ocean',
      surfaceColor: '#0284c7',
      strataColors: ['#0369a1', '#075985', '#0c4a6e', '#082f49'],
      featureName: 'Ocean Basin',
    };
  },
};

export const earthSpec: CelestialBodySpec = {
  id: 'earth',
  name: 'Earth (Terra)',
  category: 'planet',
  parent: 'sun',
  radius: 315000,
  realRadiusKm: 6371.0,
  realDistanceKm: 149597870.7,
  realSemiMajorAxisAU: 1.0,
  mass: 5.972e24,
  realMassKg: 5.97217e24,
  mu: 3.986004418e14,
  surfaceGravity: 9.807,
  realSurfaceGravityMs2: 9.80665,
  escapeVelocity: 11186,
  realEscapeVelocityKms: 11.186,
  realOrbitSpeedKms: 29.78,
  realOrbitPeriodDays: 365.256,
  realDensityGcm3: 5.514,
  realSurfacePressureBar: 1.01325,
  realHillSphereKm: 1496535,
  realSurfaceTempRangeK: { min: 184, avg: 288, max: 330 },
  axialTiltDeg: 23.44,
  rotationPeriodSec: 86164, // 23h 56m 4s sidereal
  hasAtmosphere: true,
  atmosphereHeight: 30000,
  scaleHeight: 5000,
  surfacePressureAtm: 1.0,
  surfaceDensityKgM3: 1.225,
  atmosphereComposition: '78.08% Nitrogen, 20.95% Oxygen, 0.93% Argon, 0.04% Carbon Dioxide, trace water vapor',
  atmosphereColor: 'rgba(56, 189, 248, 0.55)',
  atmosphereGlowColor: 'rgba(2, 132, 199, 0.35)',
  atmosphereRimColor: 'rgba(186, 230, 253, 0.9)',
  hazeOpacity: 0.85,
  orbitRadius: 48000000,
  orbitPeriod: 365.25 * 86400,
  orbitSpeed: 29780,
  soiRadius: 4800000,
  initialAngle: 0,
  semiMajorAxisAU: 1.0,
  primaryColor: '#0284c7',
  secondaryColor: '#16a34a',
  accentColor: '#f8fafc',
  surfaceDetailType: 'earth_terrestrial',
  details: 'The cradle of humanity and only known oasis of life, boasting liquid oceans, an oxygen-rich atmosphere, dynamic weather, and an active magnetosphere.',
  geologySummary: 'Dynamic crust driven by active plate tectonics, subduction zones, mid-ocean ridges, continental shields, and extensive oceanic basins.',
  landSurface: earthLandSurface,
};
