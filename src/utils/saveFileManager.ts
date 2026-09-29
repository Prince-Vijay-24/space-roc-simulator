import { PlacedPart, Astronaut, AstronetEconomyState } from '../types';
import { loadAstronautRoster, saveAstronautRoster } from '../data/astronauts';
import { loadEconomyState, saveEconomyState } from '../economy/economySystem';

export interface SavedCraft {
  id: string;
  name: string;
  description?: string;
  savedAt: string;
  parts: PlacedPart[];
}

export interface GameSaveData {
  version: string;
  timestamp: string;
  agencyName: string;
  activeRocket: PlacedPart[];
  savedCrafts: SavedCraft[];
  astronauts: Astronaut[];
  economy: AstronetEconomyState;
  missionCount?: number;
}

const STORAGE_SAVED_CRAFTS_KEY = 'space_agency_saved_crafts';
const STORAGE_ACTIVE_ROCKET_KEY = 'space_agency_active_rocket';

/**
 * Loads all user-saved rocket crafts from local storage.
 */
export function loadSavedCrafts(): SavedCraft[] {
  try {
    const raw = localStorage.getItem(STORAGE_SAVED_CRAFTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Failed to load saved crafts:', err);
    return [];
  }
}

/**
 * Saves a new craft or updates an existing one in local storage.
 */
export function saveCraft(name: string, parts: PlacedPart[], description?: string): SavedCraft {
  const crafts = loadSavedCrafts();
  const existingIdx = crafts.findIndex((c) => c.name.toLowerCase() === name.trim().toLowerCase());
  
  const craft: SavedCraft = {
    id: existingIdx >= 0 ? crafts[existingIdx].id : 'craft_' + Date.now(),
    name: name.trim() || 'Untitled Rocket',
    description: description || `Craft with ${parts.length} parts`,
    savedAt: new Date().toISOString(),
    parts: JSON.parse(JSON.stringify(parts)),
  };

  if (existingIdx >= 0) {
    crafts[existingIdx] = craft;
  } else {
    crafts.unshift(craft);
  }

  localStorage.setItem(STORAGE_SAVED_CRAFTS_KEY, JSON.stringify(crafts));
  return craft;
}

/**
 * Deletes a craft from local storage by ID.
 */
export function deleteCraft(id: string): void {
  const crafts = loadSavedCrafts().filter((c) => c.id !== id);
  localStorage.setItem(STORAGE_SAVED_CRAFTS_KEY, JSON.stringify(crafts));
}

/**
 * Exports a single craft to a downloadable .json file.
 */
export function exportCraftToFile(craft: SavedCraft): void {
  const dataStr = JSON.stringify(craft, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = craft.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  a.href = url;
  a.download = `${safeName || 'Rocket'}.craft.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exports full game save data (active rocket, saved crafts, astronauts, economy) to a .json file.
 */
export function exportGameSaveToFile(activeParts: PlacedPart[], agencyName: string = 'Astronet Space Program'): void {
  const saveData: GameSaveData = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    agencyName,
    activeRocket: activeParts,
    savedCrafts: loadSavedCrafts(),
    astronauts: loadAstronautRoster(),
    economy: loadEconomyState(),
  };

  const dataStr = JSON.stringify(saveData, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `SpaceProgram_Save_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Parses and validates an uploaded game save data file.
 */
export function parseGameSaveFile(jsonString: string): { success: boolean; data?: GameSaveData; craft?: SavedCraft; error?: string } {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object') {
      return { success: false, error: 'File content is not valid JSON.' };
    }

    // Check if it's a full game save
    if (Array.isArray(parsed.activeRocket) || parsed.economy || parsed.savedCrafts) {
      const fullSave: GameSaveData = {
        version: parsed.version || '1.0',
        timestamp: parsed.timestamp || new Date().toISOString(),
        agencyName: parsed.agencyName || 'Astronet Space Program',
        activeRocket: Array.isArray(parsed.activeRocket) ? parsed.activeRocket : [],
        savedCrafts: Array.isArray(parsed.savedCrafts) ? parsed.savedCrafts : [],
        astronauts: Array.isArray(parsed.astronauts) ? parsed.astronauts : [],
        economy: parsed.economy || loadEconomyState(),
      };
      return { success: true, data: fullSave };
    }

    // Check if it's a single craft file
    if (Array.isArray(parsed.parts) && parsed.parts.length > 0) {
      const craft: SavedCraft = {
        id: parsed.id || 'craft_' + Date.now(),
        name: parsed.name || 'Imported Craft',
        description: parsed.description || 'Imported rocket design',
        savedAt: parsed.savedAt || new Date().toISOString(),
        parts: parsed.parts,
      };
      return { success: true, craft };
    }

    return { success: false, error: 'Unrecognized file format. Expecting game save or craft file.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to parse JSON file.' };
  }
}

/**
 * Applies imported full game save data to localStorage and active state.
 */
export function applyGameSaveData(saveData: GameSaveData): void {
  if (saveData.activeRocket) {
    localStorage.setItem(STORAGE_ACTIVE_ROCKET_KEY, JSON.stringify(saveData.activeRocket));
  }
  if (saveData.savedCrafts) {
    localStorage.setItem(STORAGE_SAVED_CRAFTS_KEY, JSON.stringify(saveData.savedCrafts));
  }
  if (saveData.astronauts) {
    saveAstronautRoster(saveData.astronauts);
  }
  if (saveData.economy) {
    saveEconomyState(saveData.economy);
  }
}

export const STORAGE_AUTO_SAVE_KEY = 'space_agency_auto_save';
export const STORAGE_LAST_AUTOSAVE_TIME_KEY = 'space_agency_last_autosave_time';

/**
 * Performs an automatic background save of the full game state.
 */
export function performAutoSave(activeParts: PlacedPart[], agencyName: string = 'Astronet Space Program'): GameSaveData {
  const saveData: GameSaveData = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    agencyName,
    activeRocket: activeParts ? JSON.parse(JSON.stringify(activeParts)) : [],
    savedCrafts: loadSavedCrafts(),
    astronauts: loadAstronautRoster(),
    economy: loadEconomyState(),
  };

  try {
    localStorage.setItem(STORAGE_AUTO_SAVE_KEY, JSON.stringify(saveData));
    localStorage.setItem(STORAGE_ACTIVE_ROCKET_KEY, JSON.stringify(saveData.activeRocket));
    localStorage.setItem(STORAGE_LAST_AUTOSAVE_TIME_KEY, saveData.timestamp);
  } catch (err) {
    console.warn('Auto-save write failed:', err);
  }

  return saveData;
}

/**
 * Retrieves the most recent auto-save data if present.
 */
export function loadAutoSave(): GameSaveData | null {
  try {
    const raw = localStorage.getItem(STORAGE_AUTO_SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Returns the ISO timestamp string of the last auto-save.
 */
export function getLastAutoSaveTime(): string | null {
  return localStorage.getItem(STORAGE_LAST_AUTOSAVE_TIME_KEY);
}
