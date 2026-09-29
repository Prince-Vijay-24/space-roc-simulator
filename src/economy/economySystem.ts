import { AstronetContract, AstronetEconomyState, ResourceEconomyType } from '../types';

export const COMMODITY_PRICES: Record<'raw_ore' | 'refined_ore' | 'ingot', { name: string; pricePerKg: number; unit: string; desc: string }> = {
  raw_ore: {
    name: 'Raw Planetary Ore',
    pricePerKg: 45,
    unit: '$/kg',
    desc: 'Unprocessed surface regolith and mineral chunks extracted from celestial bodies or asteroids.',
  },
  refined_ore: {
    name: 'Refined Chemical Feedstock',
    pricePerKg: 160,
    unit: '$/kg',
    desc: 'Purified mineral concentrates with slag and volatiles removed via chemical cracking.',
  },
  ingot: {
    name: 'Aerospace-Grade Metal Ingots',
    pricePerKg: 480,
    unit: '$/kg',
    desc: 'Forged Titanium, Steel, and Al-Li structural ingots. Lowers rocket construction costs by up to 50%!',
  },
};

export const INITIAL_CONTRACTS: AstronetContract[] = [
  {
    id: 'contract_lunar_ore',
    title: 'Lunar Surface Ore Extraction',
    description: 'Deploy a surface drill to extraction sites on the Moon and mine 250 kg of raw regolith.',
    targetLocation: 'Moon',
    resourceType: 'raw_ore',
    requiredAmountKg: 250,
    currentAmountKg: 0,
    rewardCredits: 125000,
    bonusCredits: 25000,
    completed: false,
    accepted: true,
    flavorQuote: '"The titanium-rich basalt in the lunar maria is essential for our next-gen lander hulls." — Astronet Heavy Industries',
  },
  {
    id: 'contract_refine_proof',
    title: 'In-Situ Refining Demonstration',
    description: 'Process raw mineral feedstocks into 150 kg of high-purity refined ore using an onboard ISRU refinery.',
    targetLocation: 'In-Flight / Station',
    resourceType: 'refined_ore',
    requiredAmountKg: 150,
    currentAmountKg: 0,
    rewardCredits: 180000,
    bonusCredits: 30000,
    completed: false,
    accepted: true,
    flavorQuote: '"Lifting raw rock into orbit is wasteful. Cracking and purifying it on-site changes the math entirely."',
  },
  {
    id: 'contract_orbital_ingots',
    title: 'Orbital Metal Ingot Fabrication',
    description: 'Smelt refined feedstock into 100 kg of aerospace-grade ingots in microgravity or at Gateway Station.',
    targetLocation: 'Gateway Station / Orbit',
    resourceType: 'ingot',
    requiredAmountKg: 100,
    currentAmountKg: 0,
    rewardCredits: 310000,
    bonusCredits: 50000,
    completed: false,
    accepted: false,
    flavorQuote: '"Microgravity arc smelting yields defect-free crystal lattices impossible to manufacture down in Earth\'s gravity well."',
  },
  {
    id: 'contract_asteroid_mining',
    title: 'Deep Space Asteroid Harvesting',
    description: 'Rendezvous with an asteroid or travel to Ceres to extract 500 kg of pristine extraterrestrial raw ore.',
    targetLocation: 'Asteroid Belt / Ceres',
    resourceType: 'raw_ore',
    requiredAmountKg: 500,
    currentAmountKg: 0,
    rewardCredits: 480000,
    bonusCredits: 80000,
    completed: false,
    accepted: false,
    flavorQuote: '"A single metallic asteroid holds more precious structural elements than humanity has mined in centuries."',
  },
  {
    id: 'contract_martian_hematite',
    title: 'Martian Hematite Survey',
    description: 'Touch down on the red planet and gather 300 kg of iron-rich Martian hematite ore.',
    targetLocation: 'Mars',
    resourceType: 'raw_ore',
    requiredAmountKg: 300,
    currentAmountKg: 0,
    rewardCredits: 620000,
    bonusCredits: 120000,
    completed: false,
    accepted: false,
    flavorQuote: '"Oxidized iron sands from Chryse Planitia will supply the first permanent human outpost on Mars."',
  },
];

export const INITIAL_ECONOMY_STATE: AstronetEconomyState = {
  credits: 250000, // Starting capital
  rawOreStockpileKg: 0,
  refinedOreStockpileKg: 0,
  ingotStockpileKg: 0,
  activeContracts: INITIAL_CONTRACTS,
  constructionDiscountPercent: 0,
  totalMinedLifetimeKg: 0,
  totalSmeltedLifetimeKg: 0,
  contractsCompletedCount: 0,
};

const STORAGE_KEY = 'space_sim_astronet_economy_v1';

export function loadEconomyState(): AstronetEconomyState {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...INITIAL_ECONOMY_STATE,
          ...parsed,
          activeContracts: parsed.activeContracts && parsed.activeContracts.length > 0
            ? parsed.activeContracts
            : INITIAL_CONTRACTS,
        };
      }
    }
  } catch {
    // Sandboxed iframe safe fallback
  }
  return INITIAL_ECONOMY_STATE;
}

export function saveEconomyState(state: AstronetEconomyState): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch {
    // Sandbox fallback
  }
}

/**
 * Calculates part construction discount percentage based on metal ingot stockpile.
 * Each 100 kg of ingots provides 5% discount, capped at 50% discount at 1,000 kg ingots.
 */
export function calculateConstructionDiscount(ingotsKg: number): number {
  const discount = Math.min(50, Math.floor((ingotsKg / 100) * 5));
  return discount;
}

/**
 * Open Commodity Market transaction: sells resources for instant cash credits.
 */
export function sellCommodity(
  state: AstronetEconomyState,
  type: 'raw_ore' | 'refined_ore' | 'ingot',
  amountKg: number
): { newState: AstronetEconomyState; earnings: number } {
  const available = type === 'raw_ore'
    ? state.rawOreStockpileKg
    : type === 'refined_ore'
    ? state.refinedOreStockpileKg
    : state.ingotStockpileKg;

  const toSell = Math.min(available, Math.max(0, amountKg));
  const rate = COMMODITY_PRICES[type].pricePerKg;
  const earnings = Math.round(toSell * rate);

  const updated: AstronetEconomyState = {
    ...state,
    credits: state.credits + earnings,
    rawOreStockpileKg: type === 'raw_ore' ? state.rawOreStockpileKg - toSell : state.rawOreStockpileKg,
    refinedOreStockpileKg: type === 'refined_ore' ? state.refinedOreStockpileKg - toSell : state.refinedOreStockpileKg,
    ingotStockpileKg: type === 'ingot' ? state.ingotStockpileKg - toSell : state.ingotStockpileKg,
  };

  updated.constructionDiscountPercent = calculateConstructionDiscount(updated.ingotStockpileKg);
  saveEconomyState(updated);
  return { newState: updated, earnings };
}

/**
 * Updates contract progress based on in-flight or station activities.
 */
export function recordResourceProgress(
  state: AstronetEconomyState,
  resourceType: ResourceEconomyType,
  amountAddedKg: number
): { newState: AstronetEconomyState; contractsCompleted: AstronetContract[] } {
  const completedList: AstronetContract[] = [];

  const updatedContracts = (state?.activeContracts || []).map((c) => {
    if (c.accepted && !c.completed && c.resourceType === resourceType) {
      const newAmt = Math.min(c.requiredAmountKg, c.currentAmountKg + amountAddedKg);
      const isDone = newAmt >= c.requiredAmountKg;
      if (isDone) {
        completedList.push({ ...c, currentAmountKg: newAmt, completed: true });
      }
      return { ...c, currentAmountKg: newAmt, completed: isDone };
    }
    return c;
  });

  const newState: AstronetEconomyState = {
    ...state,
    activeContracts: updatedContracts,
    rawOreStockpileKg: resourceType === 'raw_ore' ? (state?.rawOreStockpileKg || 0) + amountAddedKg : (state?.rawOreStockpileKg || 0),
    refinedOreStockpileKg: resourceType === 'refined_ore' ? (state?.refinedOreStockpileKg || 0) + amountAddedKg : (state?.refinedOreStockpileKg || 0),
    ingotStockpileKg: resourceType === 'ingot' ? (state?.ingotStockpileKg || 0) + amountAddedKg : (state?.ingotStockpileKg || 0),
    totalMinedLifetimeKg: resourceType === 'raw_ore' ? (state?.totalMinedLifetimeKg || 0) + amountAddedKg : (state?.totalMinedLifetimeKg || 0),
    totalSmeltedLifetimeKg: resourceType === 'ingot' ? (state?.totalSmeltedLifetimeKg || 0) + amountAddedKg : (state?.totalSmeltedLifetimeKg || 0),
  };

  newState.constructionDiscountPercent = calculateConstructionDiscount(newState.ingotStockpileKg);
  saveEconomyState(newState);
  return { newState, contractsCompleted: completedList };
}

/**
 * Claim payout for a completed industry contract.
 */
export function claimContract(
  state: AstronetEconomyState,
  contractId: string
): { newState: AstronetEconomyState; rewardPaid: number } {
  const target = (state?.activeContracts || []).find((c) => c.id === contractId);
  if (!target || !target.completed) return { newState: state, rewardPaid: 0 };

  const totalReward = target.rewardCredits + (target.bonusCredits || 0);

  const updatedContracts = (state?.activeContracts || []).filter((c) => c.id !== contractId);

  const newState: AstronetEconomyState = {
    ...state,
    credits: (state?.credits || 0) + totalReward,
    activeContracts: updatedContracts,
    contractsCompletedCount: (state?.contractsCompletedCount || 0) + 1,
  };

  saveEconomyState(newState);
  return { newState, rewardPaid: totalReward };
}
