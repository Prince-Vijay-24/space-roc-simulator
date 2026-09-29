import { CelestialBodySpec, LandSurfaceSpec } from './types';

// PLUTO
export const plutoLandSurface: LandSurfaceSpec = {
  bodyId: 'pluto',
  bodyName: 'Pluto (134340 Pluto)',
  baseColor: '#d97706',
  secondaryColor: '#9a3412',
  crustRockColor: '#78350f',
  soilDustColor: '#fef3c7',
  highlightColor: '#f8fafc',
  shadowColor: '#451a03',
  baseElevationM: 0,
  maxElevationM: 6000, // Tenzing Montes
  minElevationM: -4500, // Sputnik Planitia
  roughness: 0.8,
  craterDensity: 0.35,
  geologicalComposition: 'Water-ice bedrock mountains, solid nitrogen-carbon monoxide-methane glacier plains undergoing thermal convection, reddish-brown tholin macromolecules',
  surfaceTemperatureK: { min: 33, avg: 44, max: 55 },
  radiationLevelRadHr: 1,
  surfaceFeatures: [
    {
      id: 'sputnik_planitia',
      name: 'Sputnik Planitia (The Nitrogen Heart)',
      type: 'ice_sheet',
      angleRad: 0.8,
      widthKm: 1050,
      elevationMeters: -3500,
      description: 'Luminous 1,000 km wide teardrop glacier basin of convective cellular nitrogen ice forming the western lobe of Tombaugh Regio ("The Heart of Pluto")',
      color: '#fef3c7',
    },
    {
      id: 'hillary_montes',
      name: 'Hillary & Tenzing Montes (Water Ice Peaks)',
      type: 'mountain',
      angleRad: 1.45,
      widthKm: 400,
      elevationMeters: 5500,
      description: 'Spectacular jagged ranges of pure water-ice bedrock rising 5-6 km above the nitrogen glacier floor, as hard as granite at 44 Kelvin',
      color: '#f8fafc',
    },
    {
      id: 'cthulhu_macula',
      name: 'Cthulhu Macula (The Whale)',
      type: 'plain',
      angleRad: 3.2,
      widthKm: 3000,
      elevationMeters: 400,
      description: 'Ancient, heavily cratered equatorial dark region coated in a thick tar-like layer of complex organic tholins',
      color: '#451a03',
    },
  ],
  getHeightAtAngle: (angle: number) => {
    let h = Math.sin(angle * 5) * 800 + Math.cos(angle * 13) * 600;
    // Sputnik Planitia depression
    const dSputnik = Math.abs(angle - 0.8);
    if (dSputnik < 0.25) {
      h -= (1 - dSputnik / 0.25) * 3500;
    }
    // Hillary Montes peak
    const dHillary = Math.abs(angle - 1.45);
    if (dHillary < 0.1) {
      h += (1 - dHillary / 0.1) * 5500;
    }
    return h;
  },
  getTerrainSample: (angle: number) => {
    const dSputnik = Math.abs(angle - 0.8);
    if (dSputnik < 0.25) {
      return {
        elevation: -3500 * (1 - dSputnik / 0.25),
        slope: 0.02,
        surfaceType: 'ice',
        surfaceColor: '#fef3c7',
        strataColors: ['#fed7aa', '#fde047', '#f8fafc', '#e2e8f0'],
        featureName: 'Sputnik Planitia Nitrogen Ice Sheet',
      };
    }
    const dHillary = Math.abs(angle - 1.45);
    if (dHillary < 0.1) {
      return {
        elevation: 5500 * (1 - dHillary / 0.1),
        slope: 0.65,
        surfaceType: 'mountain',
        surfaceColor: '#f8fafc',
        strataColors: ['#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b'],
        featureName: 'Hillary Montes Water-Ice Peaks',
      };
    }
    return {
      elevation: Math.sin(angle * 5) * 800 + Math.cos(angle * 13) * 600,
      slope: 0.15,
      surfaceType: 'regolith',
      surfaceColor: '#d97706',
      strataColors: ['#9a3412', '#7c2d12', '#451a03', '#1c1917'],
      featureName: 'Cthulhu Macula Tholin Regolith',
    };
  },
};

export const plutoSpec: CelestialBodySpec = {
  id: 'pluto',
  name: 'Pluto (134340 Pluto)',
  category: 'dwarf',
  parent: 'sun',
  radius: 32000,
  realRadiusKm: 1188.3,
  realDistanceKm: 5906380000,
  realSemiMajorAxisAU: 39.482,
  mass: 1.303e22,
  realMassKg: 1.303e22,
  mu: 8.71e11,
  surfaceGravity: 0.62,
  realSurfaceGravityMs2: 0.620,
  escapeVelocity: 1210,
  realEscapeVelocityKms: 1.212,
  realOrbitSpeedKms: 4.74,
  realOrbitPeriodDays: 90560,
  realDensityGcm3: 1.854,
  realSurfacePressureBar: 1e-5,
  realHillSphereKm: 6000000,
  realSurfaceTempRangeK: { min: 33, avg: 44, max: 55 },
  axialTiltDeg: 122.53, // Highly tilted retrograde
  rotationPeriodSec: 551854, // 6.387 days
  hasAtmosphere: true,
  atmosphereHeight: 18000,
  scaleHeight: 50000, // Extremely extended tenuous haze
  surfacePressureAtm: 1e-5, // 1 Pa
  surfaceDensityKgM3: 0.00008,
  atmosphereComposition: '99% Nitrogen, 0.5% Methane, 0.05% Carbon monoxide with layered blue photochemical haze',
  atmosphereColor: 'rgba(56, 189, 248, 0.35)',
  atmosphereGlowColor: 'rgba(2, 132, 199, 0.25)',
  atmosphereRimColor: 'rgba(186, 230, 253, 0.85)',
  hazeOpacity: 0.45,
  orbitRadius: 720000000,
  orbitPeriod: 90560 * 86400,
  orbitSpeed: 4740,
  soiRadius: 3200000,
  initialAngle: 1.9,
  semiMajorAxisAU: 39.48,
  primaryColor: '#d97706',
  secondaryColor: '#9a3412',
  accentColor: '#fef3c7',
  surfaceDetailType: 'pluto_tombaugh_heart',
  details: 'The iconic dwarf planet of the Kuiper Belt, decorated with the glorious white nitrogen-ice heart of Sputnik Planitia and soaring water-ice mountains.',
  geologySummary: 'Surprisingly active world with convecting nitrogen-ice glaciers, cryovolcanic mounds (Wright Mons), and blue atmospheric smog rings.',
  landSurface: plutoLandSurface,
};

// CHARON (Binary Partner of Pluto)
export const charonLandSurface: LandSurfaceSpec = {
  bodyId: 'charon',
  bodyName: 'Charon',
  baseColor: '#94a3b8',
  secondaryColor: '#64748b',
  crustRockColor: '#475569',
  soilDustColor: '#cbd5e1',
  highlightColor: '#f1f5f9',
  shadowColor: '#1e293b',
  baseElevationM: 0,
  maxElevationM: 7000,
  minElevationM: -9000, // Serenity Chasma
  roughness: 0.85,
  craterDensity: 0.75,
  geologicalComposition: 'Water ice crust, ammonia hydrates, deep extensional canyon grabens, dark reddish tholins captured from Pluto at its north pole (Mordor Macula)',
  surfaceTemperatureK: { min: 40, avg: 53, max: 65 },
  radiationLevelRadHr: 1,
  surfaceFeatures: [
    {
      id: 'mordor_macula',
      name: 'Mordor Macula (Dark Red North Pole)',
      type: 'plain',
      angleRad: Math.PI * 0.5,
      widthKm: 475,
      elevationMeters: 500,
      description: 'Striking dark reddish-brown north polar cap formed by escaping methane from Pluto trapped and photolyzed into heavy tholins',
      color: '#7c2d12',
    },
    {
      id: 'serenity_chasma',
      name: 'Serenity Chasma (Equatorial Canyon Belt)',
      type: 'chasm',
      angleRad: 0.0,
      widthKm: 1000,
      elevationMeters: -9000,
      description: 'Enormous tectonic rift canyon four times deeper than the Grand Canyon, stretching across Charon’s equator',
      color: '#334155',
    },
  ],
  getHeightAtAngle: (angle: number) => {
    let h = Math.sin(angle * 4) * 600 + Math.cos(angle * 10) * 450;
    const dChasma = Math.abs(angle);
    if (dChasma < 0.2) {
      h -= (1 - dChasma / 0.2) * 8500;
    }
    return h;
  },
  getTerrainSample: (angle: number) => {
    const dMordor = Math.abs(angle - Math.PI * 0.5);
    if (dMordor < 0.25) {
      return {
        elevation: 500,
        slope: 0.1,
        surfaceType: 'regolith',
        surfaceColor: '#7c2d12',
        strataColors: ['#991b1b', '#7f1d1d', '#475569', '#334155'],
        featureName: 'Mordor Macula Reddish Polar Tholins',
      };
    }
    const dChasma = Math.abs(angle);
    if (dChasma < 0.2) {
      return {
        elevation: -8500 * (1 - dChasma / 0.2),
        slope: 0.7,
        surfaceType: 'chasm',
        surfaceColor: '#334155',
        strataColors: ['#475569', '#334155', '#1e293b', '#0f172a'],
        featureName: 'Serenity Chasma Canyon Abyss',
      };
    }
    return {
      elevation: Math.sin(angle * 4) * 600 + Math.cos(angle * 10) * 450,
      slope: 0.15,
      surfaceType: 'ice',
      surfaceColor: '#94a3b8',
      strataColors: ['#64748b', '#475569', '#334155', '#1e293b'],
      featureName: 'Heavily Cratered Water-Ice Crust',
    };
  },
};

export const charonSpec: CelestialBodySpec = {
  id: 'charon',
  name: 'Charon',
  category: 'moon',
  parent: 'pluto',
  radius: 16000,
  realRadiusKm: 606.0,
  realDistanceKm: 19596,
  realSemiMajorAxisAU: 0.000131,
  mass: 1.586e21,
  realMassKg: 1.586e21,
  mu: 1.059e11,
  surfaceGravity: 0.288,
  realSurfaceGravityMs2: 0.288,
  escapeVelocity: 590,
  realEscapeVelocityKms: 0.59,
  realOrbitSpeedKms: 0.21,
  realOrbitPeriodDays: 6.387,
  realDensityGcm3: 1.702,
  realSurfacePressureBar: 0,
  realHillSphereKm: 2700,
  realSurfaceTempRangeK: { min: 40, avg: 53, max: 65 },
  axialTiltDeg: 0,
  rotationPeriodSec: 551854, // 6.387 days (mutually tidally locked to Pluto!)
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
  orbitRadius: 450000,
  orbitPeriod: 6.387 * 86400,
  orbitSpeed: 210,
  soiRadius: 80000,
  initialAngle: 0.6,
  primaryColor: '#94a3b8',
  secondaryColor: '#475569',
  accentColor: '#7c2d12',
  surfaceDetailType: 'charon_chasm',
  details: 'Pluto’s mutually tidally locked twin, forming a true binary planet whose common barycenter lies outside of Pluto in empty space.',
  geologySummary: 'Bisected by the 9 km deep Serenity Chasma and capped by the mysterious reddish-brown stain of Mordor Macula.',
  landSurface: charonLandSurface,
};
