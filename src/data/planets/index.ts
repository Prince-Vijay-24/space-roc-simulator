import { CelestialBodySpec, LandSurfaceSpec } from './types';
import { sunSpec, sunLandSurface } from './sun';
import { mercurySpec, mercuryLandSurface } from './mercury';
import { venusSpec, venusLandSurface } from './venus';
import { earthSpec, earthLandSurface } from './earth';
import { moonSpec, moonLandSurface } from './moon';
import { marsSpec, marsLandSurface, phobosSpec, phobosLandSurface, deimosSpec, deimosLandSurface } from './mars';
import { ceresSpec, ceresLandSurface } from './ceres';
import { jupiterSpec, jupiterLandSurface, ioSpec, ioLandSurface, europaSpec, europaLandSurface, ganymedeSpec, ganymedeLandSurface, callistoSpec, callistoLandSurface } from './jupiter';
import { saturnSpec, saturnLandSurface, titanSpec, titanLandSurface, enceladusSpec, enceladusLandSurface, mimasSpec, mimasLandSurface } from './saturn';
import { uranusSpec, uranusLandSurface, mirandaSpec, mirandaLandSurface, titaniaSpec, titaniaLandSurface } from './uranus';
import { neptuneSpec, neptuneLandSurface, tritonSpec, tritonLandSurface } from './neptune';
import { plutoSpec, plutoLandSurface, charonSpec, charonLandSurface } from './pluto';

export * from './types';
export * from './surfaceRenderer';
export * from './sun';
export * from './mercury';
export * from './venus';
export * from './earth';
export * from './moon';
export * from './mars';
export * from './ceres';
export * from './jupiter';
export * from './saturn';
export * from './uranus';
export * from './neptune';
export * from './pluto';

/**
 * Complete registry of all celestial bodies in the Solar System
 */
export const SOLAR_SYSTEM_BODIES: Record<string, CelestialBodySpec> = {
  sun: sunSpec,
  mercury: mercurySpec,
  venus: venusSpec,
  earth: earthSpec,
  moon: moonSpec,
  mars: marsSpec,
  phobos: phobosSpec,
  deimos: deimosSpec,
  ceres: ceresSpec,
  jupiter: jupiterSpec,
  io: ioSpec,
  europa: europaSpec,
  ganymede: ganymedeSpec,
  callisto: callistoSpec,
  saturn: saturnSpec,
  titan: titanSpec,
  enceladus: enceladusSpec,
  mimas: mimasSpec,
  uranus: uranusSpec,
  miranda: mirandaSpec,
  titania: titaniaSpec,
  neptune: neptuneSpec,
  triton: tritonSpec,
  pluto: plutoSpec,
  charon: charonSpec,
};

/**
 * Complete land surfaces registry for every body
 */
export const PLANETARY_LAND_SURFACES: Record<string, LandSurfaceSpec> = {
  sun: sunLandSurface,
  mercury: mercuryLandSurface,
  venus: venusLandSurface,
  earth: earthLandSurface,
  moon: moonLandSurface,
  mars: marsLandSurface,
  phobos: phobosLandSurface,
  deimos: deimosLandSurface,
  ceres: ceresLandSurface,
  jupiter: jupiterLandSurface,
  io: ioLandSurface,
  europa: europaLandSurface,
  ganymede: ganymedeLandSurface,
  callisto: callistoLandSurface,
  saturn: saturnLandSurface,
  titan: titanLandSurface,
  enceladus: enceladusLandSurface,
  mimas: mimasLandSurface,
  uranus: uranusLandSurface,
  miranda: mirandaLandSurface,
  titania: titaniaLandSurface,
  neptune: neptuneLandSurface,
  triton: tritonLandSurface,
  pluto: plutoLandSurface,
  charon: charonLandSurface,
};

/**
 * Backward compatibility alias for PLANETARY_SURFACES
 */
export const PLANETARY_SURFACES = SOLAR_SYSTEM_BODIES;

/**
 * Get body specification by ID, with fallback to Earth
 */
export function getCelestialBody(id: string): CelestialBodySpec {
  return SOLAR_SYSTEM_BODIES[id] || SOLAR_SYSTEM_BODIES.earth;
}

/**
 * Get land surface spec by body ID
 */
export function getLandSurface(id: string): LandSurfaceSpec {
  return PLANETARY_LAND_SURFACES[id] || PLANETARY_LAND_SURFACES.earth;
}

/**
 * Calculate exact surface elevation above mean radius at a given equatorial angle
 */
export function getSurfaceElevation(bodyId: string, angleRad: number): number {
  const surface = PLANETARY_LAND_SURFACES[bodyId];
  if (!surface || !surface.getHeightAtAngle) return 0;
  return surface.getHeightAtAngle(angleRad);
}
