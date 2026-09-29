/**
 * PLANETARY SURFACES & REALISTIC SOLAR SYSTEM CATALOG
 * Modular facade re-exporting individual planet, moon, and land surface definitions
 * from the modular /src/data/planets/ structure.
 */

import {
  CelestialBodySpec,
  LandSurfaceSpec,
  LandmarkFeature,
  SOLAR_SYSTEM_BODIES,
  PLANETARY_LAND_SURFACES,
  getCelestialBody,
  getLandSurface,
  getSurfaceElevation,
} from './planets';

export type PlanetarySurfaceSpec = CelestialBodySpec;
export type { CelestialBodySpec, LandSurfaceSpec, LandmarkFeature };

export {
  SOLAR_SYSTEM_BODIES,
  PLANETARY_LAND_SURFACES,
  getCelestialBody,
  getLandSurface,
  getSurfaceElevation,
};

export const PLANETARY_SURFACES: Record<string, CelestialBodySpec> = SOLAR_SYSTEM_BODIES;

export * from './planets';
