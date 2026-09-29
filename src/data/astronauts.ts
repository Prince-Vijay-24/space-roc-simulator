import { Astronaut } from '../types';

export const INITIAL_ASTRONAUTS: Astronaut[] = [
  {
    id: 'astro_neil',
    name: 'Neil Armstrong-Vance',
    role: 'Commander',
    status: 'assigned',
    missionsFlown: 5,
    morale: 98,
    suitColor: '#ffffff',
    avatarSeed: 'neil',
  },
  {
    id: 'astro_buzz',
    name: 'Buzz Sterling',
    role: 'Pilot',
    status: 'assigned',
    missionsFlown: 4,
    morale: 95,
    suitColor: '#ffffff',
    avatarSeed: 'buzz',
  },
  {
    id: 'astro_elena',
    name: 'Dr. Elena Rostova',
    role: 'Engineer',
    status: 'ready',
    missionsFlown: 3,
    morale: 92,
    suitColor: '#38bdf8',
    avatarSeed: 'elena',
  },
  {
    id: 'astro_marcus',
    name: 'Marcus Chen',
    role: 'Scientist',
    status: 'ready',
    missionsFlown: 2,
    morale: 88,
    suitColor: '#4ade80',
    avatarSeed: 'marcus',
  },
  {
    id: 'astro_sarah',
    name: 'Sarah Al-Mansoor',
    role: 'Pilot',
    status: 'ready',
    missionsFlown: 2,
    morale: 94,
    suitColor: '#fbbf24',
    avatarSeed: 'sarah',
  },
  {
    id: 'astro_valentina',
    name: 'Valentina Tereshkova-Cole',
    role: 'Commander',
    status: 'ready',
    missionsFlown: 6,
    morale: 99,
    suitColor: '#f43f5e',
    avatarSeed: 'val',
  },
];

const ROSTER_STORAGE_KEY = 'astronet_astronaut_roster';

export function loadAstronautRoster(): Astronaut[] {
  try {
    const saved = localStorage.getItem(ROSTER_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // Fallback if localStorage unavailable
  }
  return INITIAL_ASTRONAUTS;
}

export function saveAstronautRoster(roster: Astronaut[]): void {
  try {
    localStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(roster));
  } catch {
    // Fallback
  }
}

export function recruitNewAstronaut(name: string, role: Astronaut['role']): Astronaut {
  const newAstro: Astronaut = {
    id: 'astro_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    name,
    role,
    status: 'ready',
    missionsFlown: 0,
    morale: 100,
    avatarSeed: name.toLowerCase().replace(/\s+/g, '_'),
  };
  const roster = loadAstronautRoster();
  const updated = [...roster, newAstro];
  saveAstronautRoster(updated);
  return newAstro;
}
