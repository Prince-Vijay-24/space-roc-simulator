/**
 * PLANETARY SYSTEM DATA TYPES
 * Comprehensive specifications for celestial bodies, atmospheres, orbital mechanics,
 * and high-fidelity land surface geology.
 */

export interface LandmarkFeature {
  id: string;
  name: string;
  type: 'crater' | 'mountain' | 'volcano' | 'chasm' | 'plain' | 'lake' | 'ice_sheet' | 'landing_site' | 'base';
  angleRad: number; // Angle around the planet equator (0 to 2*PI)
  widthKm: number; // Size/diameter of the geological formation
  elevationMeters: number; // Relative elevation (+ for mountains, - for trenches/craters)
  description: string;
  color?: string;
  hasStructure?: boolean; // Human/robotic outpost or launchpad
}

export interface TerrainSample {
  elevation: number;       // Altitude above mean radius in meters
  slope: number;           // Terrain slope/gradient angle (radians)
  surfaceType: string;     // 'grass' | 'regolith' | 'rock' | 'sand' | 'ice' | 'basalt' | 'ocean' | 'sulfur' | 'methane'
  surfaceColor: string;    // Exact hex or rgba color
  strataColors: string[];  // Subsurface geological strata layers (bedrock, mantle crust, sub-regolith)
  featureName?: string;    // Landmark name if inside one
}

export interface LandSurfaceSpec {
  bodyId: string;
  bodyName: string;
  baseColor: string;
  secondaryColor: string;
  crustRockColor: string;
  soilDustColor: string;
  highlightColor: string;
  shadowColor: string;
  
  // Terrain elevation parameters
  baseElevationM: number;
  maxElevationM: number;
  minElevationM: number;
  roughness: number; // 0 (smooth gas giant/ice plain) to 1 (extreme jagged cliffs)
  craterDensity: number; // 0 to 1
  
  // Surface composition & geology
  geologicalComposition: string; // e.g. "Silicate regolith, basaltic lava plains, iron-titanium minerals"
  surfaceTemperatureK: { min: number; avg: number; max: number };
  radiationLevelRadHr: number;
  surfaceFeatures: LandmarkFeature[];
  
  // Procedural elevation profile function
  getHeightAtAngle: (angle: number) => number; // Returns elevation in meters above mean radius

  // High-fidelity terrain sample with geology, slope, and strata
  getTerrainSample?: (angle: number) => TerrainSample;
}

export interface CelestialBodySpec {
  id: string;
  name: string;
  category: 'star' | 'planet' | 'moon' | 'dwarf';
  parent?: string;
  
  // Real Physics Properties
  radius: number; // Scaled simulation radius (m)
  realRadiusKm: number; // Actual astronomical radius in km
  realDistanceKm?: number; // Real astronomical semi-major axis distance (km)
  realSemiMajorAxisAU?: number; // Distance in Astronomical Units (AU)
  mass: number; // kg
  realMassKg?: number; // Actual planetary mass (kg)
  mu: number; // Standard gravitational parameter G*M (m³/s²)
  surfaceGravity: number; // m/s²
  realSurfaceGravityMs2?: number; // Exact real surface gravity (m/s²)
  escapeVelocity: number; // m/s
  realEscapeVelocityKms?: number; // Exact real escape velocity (km/s)
  realOrbitSpeedKms?: number; // Real orbital velocity (km/s)
  realOrbitPeriodDays?: number; // Real orbital period in Earth days
  realDensityGcm3?: number; // Bulk planetary density in g/cm³
  realSurfacePressureBar?: number; // Exact surface pressure in bar
  realHillSphereKm?: number; // Real Hill Sphere / Sphere of Influence radius (km)
  realSurfaceTempRangeK?: { min: number; avg: number; max: number };
  axialTiltDeg: number;
  rotationPeriodSec: number;
  
  // Asteroid Belts Data (Main Belt & Kuiper Belt)
  isAsteroidBelt?: boolean;
  beltInnerAU?: number;
  beltOuterAU?: number;
  beltEstimatedAsteroidCount?: number;
  beltMajorAsteroids?: string[];
  
  // Atmosphere & Aerodynamics
  hasAtmosphere: boolean;
  atmosphereHeight: number; // meters
  scaleHeight: number; // meters
  surfacePressureAtm: number;
  surfaceDensityKgM3: number;
  atmosphereComposition: string;
  atmosphereColor: string;
  atmosphereGlowColor: string;
  atmosphereRimColor: string;
  hazeOpacity: number;
  
  // Orbital Elements
  orbitRadius: number; // Semi-major axis in simulation units (m)
  orbitPeriod: number; // Orbital period in seconds
  orbitSpeed: number; // Average orbital speed in m/s
  soiRadius: number; // Sphere of Influence radius (m)
  initialAngle: number; // True anomaly (radians)
  semiMajorAxisAU?: number;
  
  // Rings
  hasRings?: boolean;
  ringInnerRadius?: number;
  ringOuterRadius?: number;
  ringColor?: string;
  ringSecondaryColor?: string;
  cassiniDivision?: { inner: number; outer: number };
  
  // Visual Surface Specification
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  surfaceDetailType: string;
  details: string;
  geologySummary: string;
  
  // Complete Land Surface Data
  landSurface: LandSurfaceSpec;
}
