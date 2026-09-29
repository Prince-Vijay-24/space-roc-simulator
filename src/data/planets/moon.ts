import { CelestialBodySpec, LandSurfaceSpec } from './types';

export const moonLandSurface: LandSurfaceSpec = {
  bodyId: 'moon',
  bodyName: 'Moon (Luna)',
  baseColor: '#94a3b8',
  secondaryColor: '#64748b',
  crustRockColor: '#475569',
  soilDustColor: '#cbd5e1',
  highlightColor: '#f8fafc',
  shadowColor: '#1e293b',
  baseElevationM: 0,
  maxElevationM: 10786, // Selenean summit near Engel'gardt crater
  minElevationM: -9130, // Antoniadi crater floor in South Pole-Aitken basin
  roughness: 0.88,
  craterDensity: 0.98,
  geologicalComposition: 'Anorthositic lunar highland crust, basaltic mare lava plains, pulverized abrasive titanium-iron silicate regolith, permanently shadowed water ice traps at lunar poles',
  surfaceTemperatureK: { min: 40, avg: 250, max: 390 },
  radiationLevelRadHr: 120,
  surfaceFeatures: [
    {
      id: 'apollo_11_tranquility',
      name: 'Apollo 11 Landing Site (Statio Tranquillitatis)',
      type: 'landing_site',
      angleRad: 0.35,
      widthKm: 12,
      elevationMeters: -1300,
      description: 'First crewed lunar landing site in southern Mare Tranquillitatis ("The Eagle has landed")',
      color: '#38bdf8',
      hasStructure: true,
    },
    {
      id: 'mare_imbrium',
      name: 'Mare Imbrium (Sea of Rains)',
      type: 'plain',
      angleRad: 1.8,
      widthKm: 1145,
      elevationMeters: -2500,
      description: 'Vast circular impact basin filled with flood basalts, ringed by Montes Apenninus and Montes Caucasus',
      color: '#334155',
    },
    {
      id: 'tycho_crater',
      name: 'Tycho Impact Crater & Ray System',
      type: 'crater',
      angleRad: 3.95,
      widthKm: 85,
      elevationMeters: -4800,
      description: 'Prominent 108-million-year-old impact crater featuring a 1.6 km central peak and bright ray ejecta spanning 1,500 km across the lunar disk',
      color: '#f1f5f9',
    },
    {
      id: 'oceanus_procellarum',
      name: 'Oceanus Procellarum (Ocean of Storms)',
      type: 'plain',
      angleRad: 5.1,
      widthKm: 2500,
      elevationMeters: -2000,
      description: 'Largest lunar mare covering over 4 million square kilometers of dark basaltic volcanic plains',
      color: '#1e293b',
    },
    {
      id: 'shackleton_crater',
      name: 'Shackleton Crater (Lunar South Pole)',
      type: 'crater',
      angleRad: Math.PI * 1.5,
      widthKm: 21,
      elevationMeters: -4200,
      description: 'Deep impact crater whose rim receives nearly continuous sunlight while interior floor harbors billions of tons of water-ice frost',
      color: '#38bdf8',
    },
  ],
  getHeightAtAngle: (angle: number) => {
    // Highlands vs Maria depressions
    let h = Math.sin(angle * 7) * 1200 + Math.cos(angle * 13) * 850;
    // Mare Imbrium depression
    const dImbrium = Math.abs(angle - 1.8);
    if (dImbrium < 0.35) {
      h -= (1 - dImbrium / 0.35) * 2800;
    }
    // Tycho crater rim and bowl
    const dTycho = Math.abs(angle - 3.95);
    if (dTycho < 0.1) {
      if (dTycho < 0.03) {
        h += 1200; // Central peak
      } else {
        h -= 4000; // Deep bowl
      }
    }
    // Regolith impact roughness
    h += Math.sin(angle * 50) * 350 + Math.cos(angle * 110) * 180;
    return h;
  },
  getTerrainSample: (angle: number) => {
    const dApollo = Math.abs(angle - 0.35);
    if (dApollo < 0.02) {
      return {
        elevation: -1300 + Math.sin(angle * 60) * 20,
        slope: 0.01,
        surfaceType: 'regolith',
        surfaceColor: '#64748b',
        strataColors: ['#475569', '#334155', '#1e293b', '#0f172a'],
        featureName: 'Apollo 11 Tranquility Base',
      };
    }
    const dTycho = Math.abs(angle - 3.95);
    if (dTycho < 0.1) {
      const isPeak = dTycho < 0.03;
      return {
        elevation: isPeak ? 1200 : -4000,
        slope: 0.45,
        surfaceType: 'rock',
        surfaceColor: '#f1f5f9',
        strataColors: ['#cbd5e1', '#94a3b8', '#475569', '#1e293b'],
        featureName: isPeak ? 'Tycho Central Peak' : 'Tycho Crater Basin',
      };
    }
    const dImbrium = Math.abs(angle - 1.8);
    if (dImbrium < 0.35) {
      return {
        elevation: -2500 + Math.sin(angle * 40) * 80,
        slope: 0.03,
        surfaceType: 'basalt',
        surfaceColor: '#334155',
        strataColors: ['#1e293b', '#0f172a', '#020617', '#000000'],
        featureName: 'Mare Imbrium Lava Plain',
      };
    }
    // Highland cratered regolith
    return {
      elevation: Math.sin(angle * 7) * 1200 + Math.cos(angle * 13) * 850,
      slope: 0.15,
      surfaceType: 'regolith',
      surfaceColor: '#94a3b8',
      strataColors: ['#64748b', '#475569', '#334155', '#1e293b'],
      featureName: 'Lunar Highlands',
    };
  },
};

export const moonSpec: CelestialBodySpec = {
  id: 'moon',
  name: 'Moon (Luna)',
  category: 'moon',
  parent: 'earth',
  radius: 73000,
  realRadiusKm: 1737.4,
  realDistanceKm: 384400,
  realSemiMajorAxisAU: 0.00257,
  mass: 7.342e22,
  realMassKg: 7.342e22,
  mu: 4.9048695e12,
  surfaceGravity: 1.62,
  realSurfaceGravityMs2: 1.622,
  escapeVelocity: 2380,
  realEscapeVelocityKms: 2.38,
  realOrbitSpeedKms: 1.022,
  realOrbitPeriodDays: 27.322,
  realDensityGcm3: 3.344,
  realSurfacePressureBar: 3e-15,
  realHillSphereKm: 66100,
  realSurfaceTempRangeK: { min: 40, avg: 220, max: 390 },
  axialTiltDeg: 6.68,
  rotationPeriodSec: 2360591, // 27.32 days (tidally locked to Earth)
  hasAtmosphere: false,
  atmosphereHeight: 0,
  scaleHeight: 0,
  surfacePressureAtm: 0,
  surfaceDensityKgM3: 0,
  atmosphereComposition: 'Vacuum (trace argon, helium, sodium)',
  atmosphereColor: 'rgba(0, 0, 0, 0)',
  atmosphereGlowColor: 'rgba(0, 0, 0, 0)',
  atmosphereRimColor: 'rgba(203, 213, 225, 0.25)',
  hazeOpacity: 0,
  orbitRadius: 3000000,
  orbitPeriod: 27.3 * 86400,
  orbitSpeed: 1022,
  soiRadius: 150000,
  initialAngle: 0.5,
  primaryColor: '#94a3b8',
  secondaryColor: '#475569',
  accentColor: '#f1f5f9',
  surfaceDetailType: 'moon_maria',
  details: 'Earth’s only natural satellite, tidally locked and scarred by primordial heavy bombardment and massive basaltic mare floods.',
  geologySummary: 'Dichotomy between light anorthositic highlands and dark volcanic maria, punctuated by rayed impact craters like Tycho and Copernicus.',
  landSurface: moonLandSurface,
};
