import { CelestialBodySpec, LandSurfaceSpec } from './types';

// JUPITER
export const jupiterLandSurface: LandSurfaceSpec = {
  bodyId: 'jupiter',
  bodyName: 'Jupiter (Jove)',
  baseColor: '#d97706',
  secondaryColor: '#b45309',
  crustRockColor: '#78350f',
  soilDustColor: '#fef3c7',
  highlightColor: '#fed7aa',
  shadowColor: '#451a03',
  baseElevationM: 0,
  maxElevationM: 25000,
  minElevationM: -35000,
  roughness: 0.1, // Gas giant atmospheric shear bands
  craterDensity: 0,
  geologicalComposition: 'Gas/Fluid giant: Molecular hydrogen/helium envelope transitioning into liquid metallic hydrogen ocean and dense rocky-iron-ice core (10-20 Earth masses)',
  surfaceTemperatureK: { min: 110, avg: 165, max: 24000 },
  radiationLevelRadHr: 50000, // Deadly trapped electron/proton radiation belts
  surfaceFeatures: [
    {
      id: 'great_red_spot',
      name: 'The Great Red Spot (Anticyclonic Storm)',
      type: 'plain',
      angleRad: 1.45,
      widthKm: 16500,
      elevationMeters: 8000,
      description: 'Persistent colossal anticyclonic storm larger than Earth, spinning counter-clockwise with 680 km/h perimeter wind speeds for over 350 years',
      color: '#ef4444',
    },
    {
      id: 'equatorial_zone',
      name: 'Bright White Equatorial Zone (Ammonia Ice Upwelling)',
      type: 'plain',
      angleRad: 0.0,
      widthKm: 18000,
      elevationMeters: 3000,
      description: 'Cold upwelling atmospheric convective zone rich in gleaming white ammonia ice crystals',
      color: '#fef3c7',
    },
  ],
  getHeightAtAngle: (angle: number) => {
    // Cloud deck altitude variations and Rossby waves
    return Math.sin(angle * 16) * 4500 + Math.cos(angle * 32) * 2200;
  },
  getTerrainSample: (angle: number) => {
    const dRedSpot = Math.abs(angle - 1.45);
    if (dRedSpot < 0.25) {
      return {
        elevation: 8000 * (1 - dRedSpot / 0.25),
        slope: 0.1,
        surfaceType: 'gas',
        surfaceColor: '#ef4444',
        strataColors: ['#dc2626', '#b91c1c', '#991b1b', '#7f1d1d'],
        featureName: 'The Great Red Spot Vortex',
      };
    }
    return {
      elevation: Math.sin(angle * 16) * 4500 + Math.cos(angle * 32) * 2200,
      slope: 0.05,
      surfaceType: 'gas',
      surfaceColor: Math.sin(angle * 8) > 0 ? '#d97706' : '#fef3c7',
      strataColors: ['#b45309', '#92400e', '#78350f', '#451a03'],
      featureName: 'Ammonia/Methane Cloud Deck',
    };
  },
};

export const jupiterSpec: CelestialBodySpec = {
  id: 'jupiter',
  name: 'Jupiter (Jove)',
  category: 'planet',
  parent: 'sun',
  radius: 650000,
  realRadiusKm: 69911,
  realDistanceKm: 778570000,
  realSemiMajorAxisAU: 5.2044,
  mass: 1.8982e27,
  realMassKg: 1.8982e27,
  mu: 1.26686534e17,
  surfaceGravity: 24.79,
  realSurfaceGravityMs2: 24.79,
  escapeVelocity: 59500,
  realEscapeVelocityKms: 59.5,
  realOrbitSpeedKms: 13.07,
  realOrbitPeriodDays: 4332.59,
  realDensityGcm3: 1.326,
  realSurfacePressureBar: 200,
  realHillSphereKm: 53150000,
  realSurfaceTempRangeK: { min: 110, avg: 165, max: 34000 },
  axialTiltDeg: 3.13,
  rotationPeriodSec: 35730, // 9h 55m 30s (fastest rotating planet!)
  hasAtmosphere: true,
  atmosphereHeight: 80000,
  scaleHeight: 27000,
  surfacePressureAtm: 200,
  surfaceDensityKgM3: 1.33,
  atmosphereComposition: '89.8% Hydrogen, 10.2% Helium, trace methane, ammonia, hydrogen deuteride, ethane, water',
  atmosphereColor: 'rgba(217, 119, 6, 0.65)',
  atmosphereGlowColor: 'rgba(180, 83, 9, 0.45)',
  atmosphereRimColor: 'rgba(254, 215, 170, 0.95)',
  hazeOpacity: 0.95,
  orbitRadius: 160000000,
  orbitPeriod: 4333 * 86400,
  orbitSpeed: 13070,
  soiRadius: 18000000,
  initialAngle: 4.2,
  semiMajorAxisAU: 5.204,
  hasRings: true,
  ringInnerRadius: 720000,
  ringOuterRadius: 920000,
  ringColor: 'rgba(217, 119, 6, 0.15)',
  primaryColor: '#d97706',
  secondaryColor: '#b45309',
  accentColor: '#ef4444',
  surfaceDetailType: 'jupiter_bands',
  details: 'King of the planets, holding more mass than all other planets combined, enveloped in turbulent counter-flowing jet streams and the Great Red Spot.',
  geologySummary: 'Zonally banded cloud architecture divided into alternating light Zones (upwelling) and dark Belts (subsiding) laced with lightning superbolts.',
  landSurface: jupiterLandSurface,
};

// IO (Volcanic Moon)
export const ioLandSurface: LandSurfaceSpec = {
  bodyId: 'io',
  bodyName: 'Io',
  baseColor: '#eab308',
  secondaryColor: '#ca8a04',
  crustRockColor: '#b45309',
  soilDustColor: '#fef08a',
  highlightColor: '#fde047',
  shadowColor: '#451a03',
  baseElevationM: 0,
  maxElevationM: 17500, // South Boösaule Montes
  minElevationM: -3000,
  roughness: 0.88,
  craterDensity: 0.0, // 0 impact craters due to hyperactive volcanic resurfacing!
  geologicalComposition: 'Silicate magma ocean/crust, sulfur dioxide frost deposits, molten ultramafic magnesium-rich basalt lava lakes, sulfur allotrope plumes',
  surfaceTemperatureK: { min: 90, avg: 130, max: 1800 },
  radiationLevelRadHr: 3600, // Lethal radiation in Jovian plasma torus
  surfaceFeatures: [
    {
      id: 'pele_volcano',
      name: 'Pele Volcanic Caldera & Ring',
      type: 'volcano',
      angleRad: 0.85,
      widthKm: 1200,
      elevationMeters: 4500,
      description: 'Hyperactive volcanic center producing a 400 km tall continuous umbrella plume of sulfur dioxide gas and dust',
      color: '#ef4444',
    },
    {
      id: 'loki_patera',
      name: 'Loki Patera Lava Lake',
      type: 'lake',
      angleRad: 2.3,
      widthKm: 202,
      elevationMeters: -1500,
      description: 'Gigantic volcanic depression filled with a convecting ultramafic silicate lava lake undergoing cyclic crustal overturn',
      color: '#1c1917',
    },
    {
      id: 'boosaule_montes',
      name: 'South Boösaule Montes',
      type: 'mountain',
      angleRad: 4.1,
      widthKm: 540,
      elevationMeters: 17500,
      description: 'Towering non-volcanic tectonic mountain formed by crustal compression, higher than any mountain on Earth',
      color: '#f59e0b',
    },
  ],
  getHeightAtAngle: (angle: number) => {
    let h = Math.sin(angle * 8) * 800 + Math.cos(angle * 19) * 600;
    const dBoosaule = Math.abs(angle - 4.1);
    if (dBoosaule < 0.2) {
      h += (1 - dBoosaule / 0.2) * 16500;
    }
    return h;
  },
  getTerrainSample: (angle: number) => {
    const dPele = Math.abs(angle - 0.85);
    if (dPele < 0.15) {
      return {
        elevation: 4500 * (1 - dPele / 0.15),
        slope: 0.5,
        surfaceType: 'sulfur',
        surfaceColor: '#ef4444',
        strataColors: ['#dc2626', '#b91c1c', '#7f1d1d', '#450a0a'],
        featureName: 'Pele Caldera Active Plume',
      };
    }
    const dLoki = Math.abs(angle - 2.3);
    if (dLoki < 0.12) {
      return {
        elevation: -1500,
        slope: 0.02,
        surfaceType: 'lava',
        surfaceColor: '#1c1917',
        strataColors: ['#292524', '#44403c', '#78350f', '#451a03'],
        featureName: 'Loki Patera Convecting Lava Lake',
      };
    }
    const dBoosaule = Math.abs(angle - 4.1);
    if (dBoosaule < 0.2) {
      return {
        elevation: 17500 * (1 - dBoosaule / 0.2),
        slope: 0.58,
        surfaceType: 'mountain',
        surfaceColor: '#f59e0b',
        strataColors: ['#d97706', '#b45309', '#78350f', '#451a03'],
        featureName: 'South Boosaule Montes Peak',
      };
    }
    return {
      elevation: Math.sin(angle * 8) * 800 + Math.cos(angle * 19) * 600,
      slope: 0.15,
      surfaceType: 'sulfur',
      surfaceColor: '#eab308',
      strataColors: ['#ca8a04', '#a16207', '#854d0e', '#713f12'],
      featureName: 'Sulfur Frost Plains',
    };
  },
};

export const ioSpec: CelestialBodySpec = {
  id: 'io',
  name: 'Io',
  category: 'moon',
  parent: 'jupiter',
  radius: 36000,
  realRadiusKm: 1821.6,
  realDistanceKm: 421700,
  realSemiMajorAxisAU: 0.002819,
  mass: 8.9319e22,
  realMassKg: 8.9319e22,
  mu: 5.9599e12,
  surfaceGravity: 1.796,
  realSurfaceGravityMs2: 1.796,
  escapeVelocity: 2560,
  realEscapeVelocityKms: 2.56,
  realOrbitSpeedKms: 17.334,
  realOrbitPeriodDays: 1.769,
  realDensityGcm3: 3.528,
  realSurfacePressureBar: 1e-9,
  realHillSphereKm: 5800,
  realSurfaceTempRangeK: { min: 90, avg: 130, max: 1800 },
  axialTiltDeg: 0,
  rotationPeriodSec: 152853, // 1.769 days
  hasAtmosphere: true,
  atmosphereHeight: 6000,
  scaleHeight: 1200,
  surfacePressureAtm: 1e-9,
  surfaceDensityKgM3: 1e-7,
  atmosphereComposition: '90% Sulfur Dioxide, trace sulfur monoxide, sodium chloride, atomic sulfur and oxygen',
  atmosphereColor: 'rgba(234, 179, 8, 0.2)',
  atmosphereGlowColor: 'rgba(202, 138, 4, 0.15)',
  atmosphereRimColor: 'rgba(254, 240, 138, 0.5)',
  hazeOpacity: 0.3,
  orbitRadius: 1800000,
  orbitPeriod: 1.769 * 86400,
  orbitSpeed: 17334,
  soiRadius: 90000,
  initialAngle: 0.7,
  primaryColor: '#eab308',
  secondaryColor: '#b45309',
  accentColor: '#ef4444',
  surfaceDetailType: 'io_volcanoes',
  details: 'The most volcanically active body in the Solar System, kneaded relentlessly by tidal friction between Jupiter, Europa, and Ganymede.',
  geologySummary: 'Vivid sulfur-stained landscape painted in yellow, orange, red, and black by hundreds of active calderas and silicate lava seas.',
  landSurface: ioLandSurface,
};

// EUROPA (Icy Ocean Moon)
export const europaLandSurface: LandSurfaceSpec = {
  bodyId: 'europa',
  bodyName: 'Europa',
  baseColor: '#e0f2fe',
  secondaryColor: '#93c5fd',
  crustRockColor: '#7dd3fc',
  soilDustColor: '#f0f9ff',
  highlightColor: '#ffffff',
  shadowColor: '#1e3a8a',
  baseElevationM: 0,
  maxElevationM: 850,
  minElevationM: -750,
  roughness: 0.35, // One of the smoothest solid surfaces in the solar system!
  craterDensity: 0.05,
  geologicalComposition: 'Water-ice lithosphere (15-25 km thick) floating atop a 100 km deep global saltwater ocean containing more liquid water than all Earth oceans combined',
  surfaceTemperatureK: { min: 50, avg: 102, max: 125 },
  radiationLevelRadHr: 540,
  surfaceFeatures: [
    {
      id: 'conamara_chaos',
      name: 'Conamara Chaos (Disrupted Ice Rafts)',
      type: 'ice_sheet',
      angleRad: 1.1,
      widthKm: 180,
      elevationMeters: 400,
      description: 'Chaotic jigsaw terrain of tilted iceberg slabs that broke apart and refroze in a matrix of slushy marine brine',
      color: '#b91c1c',
    },
    {
      id: 'lineae_astypalaea',
      name: 'Astypalaea Linea (Tectonic Double Ridge)',
      type: 'chasm',
      angleRad: 2.8,
      widthKm: 810,
      elevationMeters: 300,
      description: 'Extensive strike-slip fault ridge system stained with red magnesium sulfate and hydrated sulfuric acid salts',
      color: '#991b1b',
    },
  ],
  getHeightAtAngle: (angle: number) => {
    // Subtle fractures and double ridges
    return Math.sin(angle * 12) * 200 + Math.sin(angle * 35) * 120;
  },
  getTerrainSample: (angle: number) => {
    const dChaos = Math.abs(angle - 1.1);
    if (dChaos < 0.12) {
      return {
        elevation: 400 * (1 - dChaos / 0.12),
        slope: 0.35,
        surfaceType: 'ice',
        surfaceColor: '#b91c1c',
        strataColors: ['#991b1b', '#7f1d1d', '#93c5fd', '#3b82f6'],
        featureName: 'Conamara Chaos Disrupted Ice',
      };
    }
    const dLinea = Math.abs(angle - 2.8);
    if (dLinea < 0.08) {
      return {
        elevation: 300,
        slope: 0.4,
        surfaceType: 'ice',
        surfaceColor: '#991b1b',
        strataColors: ['#7f1d1d', '#bfdbfe', '#60a5fa', '#1d4ed8'],
        featureName: 'Astypalaea Linea Double Ridge',
      };
    }
    return {
      elevation: Math.sin(angle * 12) * 200 + Math.sin(angle * 35) * 120,
      slope: 0.08,
      surfaceType: 'ice',
      surfaceColor: '#e0f2fe',
      strataColors: ['#bae6fd', '#7dd3fc', '#38bdf8', '#0284c7'],
      featureName: 'Europa Water-Ice Shell',
    };
  },
};

export const europaSpec: CelestialBodySpec = {
  id: 'europa',
  name: 'Europa',
  category: 'moon',
  parent: 'jupiter',
  radius: 31000,
  realRadiusKm: 1560.8,
  realDistanceKm: 670900,
  realSemiMajorAxisAU: 0.004485,
  mass: 4.7998e22,
  realMassKg: 4.7998e22,
  mu: 3.2033e12,
  surfaceGravity: 1.315,
  realSurfaceGravityMs2: 1.315,
  escapeVelocity: 2025,
  realEscapeVelocityKms: 2.025,
  realOrbitSpeedKms: 13.743,
  realOrbitPeriodDays: 3.551,
  realDensityGcm3: 3.013,
  realSurfacePressureBar: 1e-12,
  realHillSphereKm: 13600,
  realSurfaceTempRangeK: { min: 50, avg: 102, max: 125 },
  axialTiltDeg: 0.1,
  rotationPeriodSec: 306822, // 3.551 days
  hasAtmosphere: true,
  atmosphereHeight: 4000,
  scaleHeight: 800,
  surfacePressureAtm: 1e-12,
  surfaceDensityKgM3: 1e-9,
  atmosphereComposition: 'Tenous radiolytic molecular oxygen (O2)',
  atmosphereColor: 'rgba(186, 230, 253, 0.15)',
  atmosphereGlowColor: 'rgba(56, 189, 248, 0.1)',
  atmosphereRimColor: 'rgba(255, 255, 255, 0.6)',
  hazeOpacity: 0.15,
  orbitRadius: 2800000,
  orbitPeriod: 3.551 * 86400,
  orbitSpeed: 13743,
  soiRadius: 85000,
  initialAngle: 1.8,
  primaryColor: '#e0f2fe',
  secondaryColor: '#93c5fd',
  accentColor: '#991b1b',
  surfaceDetailType: 'europa_cracked_ice',
  details: 'Prime astrobiological candidate in the Solar System, concealing a warm, salty subterranean ocean beneath a striated ice shell.',
  geologySummary: 'Gleaming, nearly crater-free ice crust crisscrossed by reddish lineae, cycloids, lenticulae, and chaos terrain.',
  landSurface: europaLandSurface,
};

// GANYMEDE (Largest Moon in Solar System)
export const ganymedeLandSurface: LandSurfaceSpec = {
  bodyId: 'ganymede',
  bodyName: 'Ganymede',
  baseColor: '#94a3b8',
  secondaryColor: '#64748b',
  crustRockColor: '#475569',
  soilDustColor: '#cbd5e1',
  highlightColor: '#f8fafc',
  shadowColor: '#1e293b',
  baseElevationM: 0,
  maxElevationM: 4000,
  minElevationM: -3000,
  roughness: 0.72,
  craterDensity: 0.6,
  geologicalComposition: 'Differentiated silicate core, liquid iron dynamo generating an intrinsic magnetic field, high-pressure ice phases sandwiching a salty ocean',
  surfaceTemperatureK: { min: 70, avg: 110, max: 152 },
  radiationLevelRadHr: 80,
  surfaceFeatures: [
    {
      id: 'sulcus_uruk',
      name: 'Uruk Sulcus (Grooved Tectonic Terrain)',
      type: 'chasm',
      angleRad: 0.9,
      widthKm: 1200,
      elevationMeters: -1800,
      description: 'Light-toned bands of parallel extensional grooves, fractures, and cryovolcanic flooding cutting across older dark terrain',
      color: '#cbd5e1',
    },
    {
      id: 'galileo_regio',
      name: 'Galileo Regio (Ancient Dark Polygon)',
      type: 'plain',
      angleRad: 3.4,
      widthKm: 3200,
      elevationMeters: 600,
      description: 'Heavily cratered, clay- and organic-rich ancient primordial terrain riddled with concentric furrows from a giant impact',
      color: '#334155',
    },
  ],
  getHeightAtAngle: (angle: number) => {
    return Math.sin(angle * 6) * 1100 + Math.cos(angle * 18) * 600;
  },
  getTerrainSample: (angle: number) => {
    const dGroove = Math.sin(angle * 30);
    return {
      elevation: Math.sin(angle * 6) * 1100 + Math.cos(angle * 18) * 600,
      slope: 0.18,
      surfaceType: 'ice',
      surfaceColor: dGroove > 0 ? '#cbd5e1' : '#64748b',
      strataColors: ['#94a3b8', '#64748b', '#475569', '#334155'],
      featureName: dGroove > 0 ? 'Grooved Tectonic Sulcus' : 'Ancient Cratered Dark Terrain',
    };
  },
};

export const ganymedeSpec: CelestialBodySpec = {
  id: 'ganymede',
  name: 'Ganymede',
  category: 'moon',
  parent: 'jupiter',
  radius: 52000,
  realRadiusKm: 2634.1,
  realDistanceKm: 1070400,
  realSemiMajorAxisAU: 0.007155,
  mass: 1.4819e23,
  realMassKg: 1.4819e23,
  mu: 9.8878e12,
  surfaceGravity: 1.428,
  realSurfaceGravityMs2: 1.428,
  escapeVelocity: 2741,
  realEscapeVelocityKms: 2.741,
  realOrbitSpeedKms: 10.880,
  realOrbitPeriodDays: 7.155,
  realDensityGcm3: 1.936,
  realSurfacePressureBar: 1e-11,
  realHillSphereKm: 31700,
  realSurfaceTempRangeK: { min: 70, avg: 110, max: 152 },
  axialTiltDeg: 0.2,
  rotationPeriodSec: 618153, // 7.155 days
  hasAtmosphere: false,
  atmosphereHeight: 0,
  scaleHeight: 0,
  surfacePressureAtm: 0,
  surfaceDensityKgM3: 0,
  atmosphereComposition: 'Trace radiolytic oxygen exosphere',
  atmosphereColor: 'rgba(0,0,0,0)',
  atmosphereGlowColor: 'rgba(0,0,0,0)',
  atmosphereRimColor: 'rgba(203, 213, 225, 0.3)',
  hazeOpacity: 0,
  orbitRadius: 4400000,
  orbitPeriod: 7.155 * 86400,
  orbitSpeed: 10880,
  soiRadius: 180000,
  initialAngle: 3.1,
  primaryColor: '#94a3b8',
  secondaryColor: '#475569',
  accentColor: '#cbd5e1',
  surfaceDetailType: 'ganymede_grooves',
  details: 'The largest moon in the Solar System—exceeding Mercury and Pluto in size—and the only moon possessing an intrinsic magnetic geodynamo.',
  geologySummary: 'Striking mosaic of dark, ancient, heavily cratered terrains juxtaposed against younger, bright, grooved tectonic sulci.',
  landSurface: ganymedeLandSurface,
};

// CALLISTO (Heavily Cratered Ice World)
export const callistoLandSurface: LandSurfaceSpec = {
  bodyId: 'callisto',
  bodyName: 'Callisto',
  baseColor: '#64748b',
  secondaryColor: '#475569',
  crustRockColor: '#334155',
  soilDustColor: '#94a3b8',
  highlightColor: '#e2e8f0',
  shadowColor: '#0f172a',
  baseElevationM: 0,
  maxElevationM: 3200,
  minElevationM: -4000,
  roughness: 0.9,
  craterDensity: 1.0, // Most heavily cratered object in the Solar System
  geologicalComposition: 'Undifferentiated homogeneous mixture of 50% water ice and 50% rocky silicate materials, carbon dioxide frost, dark lag deposit',
  surfaceTemperatureK: { min: 80, avg: 134, max: 165 },
  radiationLevelRadHr: 0.1, // Out of Jupiter’s deadly radiation belt—safest site for a crewed Jovian base!
  surfaceFeatures: [
    {
      id: 'valhalla_crater',
      name: 'Valhalla Multi-Ring Impact Structure',
      type: 'crater',
      angleRad: 1.2,
      widthKm: 3800,
      elevationMeters: -2500,
      description: 'Gigantic impact structure featuring a 360 km bright central crater surrounded by concentric shockwave ridges spreading 1,900 km outward',
      color: '#e2e8f0',
    },
    {
      id: 'asgard_basin',
      name: 'Asgard Impact Basin',
      type: 'crater',
      angleRad: 3.6,
      widthKm: 1600,
      elevationMeters: -1800,
      description: 'Multi-ring impact structure deformed by slow plastic viscous relaxation of ancient ice',
      color: '#94a3b8',
    },
  ],
  getHeightAtAngle: (angle: number) => {
    return Math.sin(angle * 7) * 900 + Math.cos(angle * 15) * 650;
  },
  getTerrainSample: (angle: number) => {
    const dValhalla = Math.abs(angle - 1.2);
    if (dValhalla < 0.25) {
      return {
        elevation: -2500 * (1 - dValhalla / 0.25),
        slope: 0.35,
        surfaceType: 'ice',
        surfaceColor: '#e2e8f0',
        strataColors: ['#cbd5e1', '#94a3b8', '#64748b', '#334155'],
        featureName: 'Valhalla Concentric Ring Basin',
      };
    }
    return {
      elevation: Math.sin(angle * 7) * 900 + Math.cos(angle * 15) * 650,
      slope: 0.2,
      surfaceType: 'regolith',
      surfaceColor: '#64748b',
      strataColors: ['#475569', '#334155', '#1e293b', '#0f172a'],
      featureName: 'Heavily Cratered Saturated Regolith',
    };
  },
};

export const callistoSpec: CelestialBodySpec = {
  id: 'callisto',
  name: 'Callisto',
  category: 'moon',
  parent: 'jupiter',
  radius: 48000,
  realRadiusKm: 2410.3,
  realDistanceKm: 1882700,
  realSemiMajorAxisAU: 0.012585,
  mass: 1.0759e23,
  realMassKg: 1.0759e23,
  mu: 7.1793e12,
  surfaceGravity: 1.235,
  realSurfaceGravityMs2: 1.235,
  escapeVelocity: 2440,
  realEscapeVelocityKms: 2.44,
  realOrbitSpeedKms: 8.204,
  realOrbitPeriodDays: 16.689,
  realDensityGcm3: 1.834,
  realSurfacePressureBar: 1e-12,
  realHillSphereKm: 50400,
  realSurfaceTempRangeK: { min: 80, avg: 134, max: 165 },
  axialTiltDeg: 0,
  rotationPeriodSec: 1441930, // 16.689 days
  hasAtmosphere: false,
  atmosphereHeight: 0,
  scaleHeight: 0,
  surfacePressureAtm: 0,
  surfaceDensityKgM3: 0,
  atmosphereComposition: 'Trace carbon dioxide exosphere',
  atmosphereColor: 'rgba(0,0,0,0)',
  atmosphereGlowColor: 'rgba(0,0,0,0)',
  atmosphereRimColor: 'rgba(148, 163, 184, 0.25)',
  hazeOpacity: 0,
  orbitRadius: 7800000,
  orbitPeriod: 16.689 * 86400,
  orbitSpeed: 8204,
  soiRadius: 210000,
  initialAngle: 4.8,
  primaryColor: '#64748b',
  secondaryColor: '#334155',
  accentColor: '#e2e8f0',
  surfaceDetailType: 'callisto_multi_ring',
  details: 'Ancient, dead world bearing the highest crater density in the solar system, bathed in gentle radiation and offering prime staging for Jovian colonization.',
  geologySummary: 'Geologically inert 4-billion-year-old crust of ice and rock dominated by the concentric shockwave rings of the Valhalla impact.',
  landSurface: callistoLandSurface,
};
