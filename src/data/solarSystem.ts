import { CelestialBody } from '../types';
import { PLANETARY_SURFACES, PlanetarySurfaceSpec } from './planetarySurfaces';

export interface SolarSystemBody extends CelestialBody {
  details: string;
  initialAngle: number;
  hasRings?: boolean;
  ringInner?: number;
  ringOuter?: number;
  ringColor?: string;
  cassiniDivision?: { inner: number; outer: number };
  texturePattern?: string;
  surfaceSpec: PlanetarySurfaceSpec;
}

// Convert PLANETARY_SURFACES into SOLAR_SYSTEM with full realistic parameters
export const SOLAR_SYSTEM: Record<string, SolarSystemBody> = Object.fromEntries(
  Object.entries(PLANETARY_SURFACES).map(([id, spec]) => {
    const body: SolarSystemBody = {
      id: spec.id,
      name: spec.name,
      category: spec.category,
      parent: spec.parent,
      radius: spec.radius,
      mass: spec.mass,
      mu: spec.surfaceGravity ? spec.surfaceGravity * spec.radius * spec.radius : spec.mu,
      surfaceGravity: spec.surfaceGravity,
      atmosphereHeight: spec.atmosphereHeight,
      scaleHeight: spec.scaleHeight,
      orbitRadius: spec.orbitRadius,
      orbitPeriod: spec.orbitPeriod,
      orbitSpeed: spec.orbitSpeed,
      soiRadius: spec.soiRadius,
      color: spec.primaryColor,
      atmosphereColor: spec.atmosphereColor,
      semiMajorAxisAU: spec.semiMajorAxisAU,
      initialAngle: spec.initialAngle,
      hasRings: spec.hasRings,
      ringInner: spec.ringInnerRadius,
      ringOuter: spec.ringOuterRadius,
      ringColor: spec.ringColor,
      cassiniDivision: spec.cassiniDivision,
      details: spec.details,
      surfaceSpec: spec,
    };
    return [id, body];
  })
);

/**
 * Computes the 2D Cartesian position (x, y) of any celestial body
 * in the Heliocentric Solar Frame at a given simulation time (seconds).
 * Recursively supports nested orbits (e.g. Moons -> Planets -> Sun).
 */
export function getBodyPositionAtTime(bodyId: string, missionTime: number): { x: number; y: number } {
  const body = SOLAR_SYSTEM[bodyId];
  if (!body) return { x: 0, y: 0 };

  // Sun is at center (0, 0)
  if (!body.parent || body.id === 'sun') {
    return { x: 0, y: 0 };
  }

  // Calculate orbital position relative to parent body
  const ang = body.orbitPeriod > 0
    ? body.initialAngle + (2 * Math.PI * (missionTime % body.orbitPeriod)) / body.orbitPeriod
    : body.initialAngle;

  const relX = Math.cos(ang) * body.orbitRadius;
  const relY = Math.sin(ang) * body.orbitRadius;

  // If parent is not Sun, add parent's heliocentric position (e.g. Moon around Earth, Io around Jupiter)
  const parentPos = getBodyPositionAtTime(body.parent, missionTime);
  return {
    x: parentPos.x + relX,
    y: parentPos.y + relY,
  };
}

/**
 * Returns all celestial bodies organized by categories for clean navigation and inspection
 */
export const SOLAR_SYSTEM_CATEGORIES = {
  inner: ['sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'phobos', 'deimos'],
  belt: ['ceres'],
  jovian: ['jupiter', 'thebe', 'io', 'europa', 'ganymede', 'callisto'],
  saturnian: ['saturn', 'mimas', 'enceladus', 'titan'],
  uranian: ['uranus', 'miranda', 'titania'],
  neptunian: ['neptune', 'triton'],
  kuiper: ['pluto', 'charon'],
  allMoons: ['moon', 'phobos', 'deimos', 'thebe', 'io', 'europa', 'ganymede', 'callisto', 'mimas', 'enceladus', 'titan', 'miranda', 'titania', 'triton', 'charon'],
  allPlanets: ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'],
};
