import React, { useState } from 'react';
import { AstronetEconomyState } from '../../types';
import {
  COMMODITY_PRICES,
  sellCommodity,
  claimContract,
  calculateConstructionDiscount,
  loadEconomyState,
} from '../../economy/economySystem';
import {
  Pickaxe,
  Briefcase,
  DollarSign,
  TrendingUp,
  Award,
  CheckCircle2,
  Clock,
  ArrowRight,
  X,
  Sparkles,
  Info,
  ShieldCheck,
  Factory,
  Orbit,
} from 'lucide-react';

interface AstronetHQModalProps {
  isOpen?: boolean;
  economyState?: AstronetEconomyState;
  economy?: AstronetEconomyState;
  onUpdateEconomy?: (newState: AstronetEconomyState) => void;
  onClose: () => void;
}

export const AstronetHQModal: React.FC<AstronetHQModalProps> = ({
  isOpen = true,
  economyState: economyStateProp,
  economy: economyProp,
  onUpdateEconomy,
  onClose,
}) => {
  if (!isOpen) return null;

  const economyState = economyStateProp || economyProp || loadEconomyState();
  const activeContractsList = economyState?.activeContracts || [];

  const [activeTab, setActiveTab] = useState<'contracts' | 'market' | 'guide'>('contracts');
  const [contractFilter, setContractFilter] = useState<'all' | 'accepted' | 'available'>('all');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3500);
  };

  const handleSell = (type: 'raw_ore' | 'refined_ore' | 'ingot', amountKg: number) => {
    const { newState, earnings } = sellCommodity(economyState, type, amountKg);
    onUpdateEconomy?.(newState);
    if (earnings > 0) {
      showToast(`Sold ${amountKg} kg of ${COMMODITY_PRICES[type].name} for +$${earnings.toLocaleString()} credits!`);
    }
  };

  const handleAcceptContract = (contractId: string) => {
    const updatedContracts = activeContractsList.map((c) =>
      c.id === contractId ? { ...c, accepted: true } : c
    );
    const newState = { ...economyState, activeContracts: updatedContracts };
    onUpdateEconomy?.(newState);
    showToast('Contract accepted! Track resource extraction during flight.');
  };

  const handleClaimReward = (contractId: string) => {
    const { newState, rewardPaid } = claimContract(economyState, contractId);
    onUpdateEconomy?.(newState);
    showToast(`Claimed payout: +$${rewardPaid.toLocaleString()} credits deposited to Astronet account!`);
  };

  const filteredContracts = activeContractsList.filter((c) => {
    if (contractFilter === 'accepted') return c.accepted && !c.completed;
    if (contractFilter === 'available') return !c.accepted && !c.completed;
    return true;
  });

  const discount = calculateConstructionDiscount(economyState?.ingotStockpileKg || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-slate-950 border border-sky-500/30 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Factory className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-wide">Astronet HQ Industry Hub</h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/60">
                  Resource Logistics
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Secondary industrial loop: Mining, refining, contracts & ingot discounts
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Financial & Stockpile Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-6 py-3 bg-slate-900/50 border-b border-slate-800 text-xs font-mono">
          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
            <span className="text-slate-500 block text-[10px]">ASTRONET CREDITS</span>
            <span className="text-emerald-400 font-bold text-sm">
              ${(economyState?.credits ?? 0).toLocaleString()}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
            <span className="text-slate-500 block text-[10px]">RAW ORE STOCKPILE</span>
            <span className="text-amber-400 font-bold text-sm">
              {(economyState?.rawOreStockpileKg ?? 0).toLocaleString()} kg
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
            <span className="text-slate-500 block text-[10px]">REFINED FEEDSTOCK</span>
            <span className="text-teal-400 font-bold text-sm">
              {(economyState?.refinedOreStockpileKg ?? 0).toLocaleString()} kg
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 text-[10px]">METAL INGOTS</span>
              <span className="text-[10px] text-sky-400 font-bold">-{discount}% Cost</span>
            </div>
            <span className="text-sky-300 font-bold text-sm">
              {(economyState?.ingotStockpileKg ?? 0).toLocaleString()} kg
            </span>
          </div>
        </div>

        {/* Action Toast Notice */}
        {actionNotice && (
          <div className="mx-6 mt-3 px-4 py-2 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionNotice}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-800">
          <button
            onClick={() => setActiveTab('contracts')}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 transition border-b-2 cursor-pointer ${
              activeTab === 'contracts'
                ? 'border-amber-400 text-amber-300 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Industry Contracts ({activeContractsList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('market')}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 transition border-b-2 cursor-pointer ${
              activeTab === 'market'
                ? 'border-emerald-400 text-emerald-300 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Commodity Exchange</span>
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 transition border-b-2 cursor-pointer ${
              activeTab === 'guide'
                ? 'border-sky-400 text-sky-300 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>Industrial Chain Guide</span>
          </button>
        </div>

        {/* Tab 1: Industry Contracts */}
        {activeTab === 'contracts' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Filter Pills */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {(['all', 'accepted', 'available'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setContractFilter(filter)}
                    className={`px-3 py-1 rounded-full text-xs font-mono capitalize transition cursor-pointer border ${
                      contractFilter === filter
                        ? 'bg-amber-950 text-amber-200 border-amber-700'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-800'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              <div className="text-xs text-slate-400 font-mono">
                Completed: <span className="text-emerald-400 font-bold">{economyState?.contractsCompletedCount ?? 0}</span>
              </div>
            </div>

            {/* Contract Cards */}
            <div className="space-y-3">
              {filteredContracts.map((contract) => {
                const progressPct = Math.min(100, Math.round((contract.currentAmountKg / contract.requiredAmountKg) * 100));
                return (
                  <div
                    key={contract.id}
                    className={`p-4 rounded-xl border transition ${
                      contract.completed
                        ? 'bg-emerald-950/20 border-emerald-500/40'
                        : contract.accepted
                        ? 'bg-slate-900/80 border-amber-500/30'
                        : 'bg-slate-900/40 border-slate-800'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-100">{contract.title}</h3>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-sky-300 border border-slate-700">
                            {contract.targetLocation}
                          </span>
                          {contract.completed && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Complete
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed">
                          {contract.description}
                        </p>

                        {contract.flavorQuote && (
                          <p className="text-[11px] italic text-slate-400 pt-0.5">
                            {contract.flavorQuote}
                          </p>
                        )}
                      </div>

                      {/* Reward Badge & Action Button */}
                      <div className="flex flex-row sm:flex-col items-end justify-between sm:justify-center gap-2 shrink-0">
                        <div className="text-right">
                          <span className="text-[10px] font-mono text-slate-500 block">PAYOUT</span>
                          <span className="text-sm font-bold font-mono text-emerald-400">
                            +${contract.rewardCredits.toLocaleString()}
                          </span>
                        </div>

                        {contract.completed ? (
                          <button
                            onClick={() => handleClaimReward(contract.id)}
                            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition cursor-pointer"
                          >
                            Claim Reward
                          </button>
                        ) : contract.accepted ? (
                          <div className="text-[10px] font-mono text-amber-400 px-2 py-1 rounded bg-amber-950/60 border border-amber-800/40">
                            In Progress ({progressPct}%)
                          </div>
                        ) : (
                          <button
                            onClick={() => handleAcceptContract(contract.id)}
                            className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow transition cursor-pointer"
                          >
                            Accept Contract
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar for Accepted Contracts */}
                    {contract.accepted && (
                      <div className="mt-3 pt-3 border-t border-slate-800 space-y-1.5">
                        <div className="flex justify-between text-[11px] font-mono">
                          <span className="text-slate-400">Resource Gathered:</span>
                          <span className="text-slate-200">
                            {contract.currentAmountKg} / {contract.requiredAmountKg} kg ({progressPct}%)
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-400 rounded-full transition-all duration-300"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Open Commodity Market */}
        {activeTab === 'market' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>
                Sell mined resources to Astronet HQ for instant funds. Metal ingots also lower vehicle launch costs by up to 50%!
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {(['raw_ore', 'refined_ore', 'ingot'] as const).map((type) => {
                const spec = COMMODITY_PRICES[type];
                const available =
                  type === 'raw_ore'
                    ? (economyState?.rawOreStockpileKg ?? 0)
                    : type === 'refined_ore'
                    ? (economyState?.refinedOreStockpileKg ?? 0)
                    : (economyState?.ingotStockpileKg ?? 0);

                return (
                  <div
                    key={type}
                    className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between space-y-4"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-200">{spec.name}</span>
                        <span className="text-xs font-mono font-bold text-emerald-400">
                          ${spec.pricePerKg}/kg
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        {spec.desc}
                      </p>

                      <div className="mt-3 p-2 rounded bg-slate-950 border border-slate-800/80 font-mono text-xs flex justify-between">
                        <span className="text-slate-500">In Stockpile:</span>
                        <span className="font-bold text-slate-200">{available} kg</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-slate-800">
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          disabled={available < 50}
                          onClick={() => handleSell(type, 50)}
                          className="py-1 px-2 rounded text-[11px] font-mono bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 transition cursor-pointer"
                        >
                          Sell 50 kg
                        </button>
                        <button
                          disabled={available < 250}
                          onClick={() => handleSell(type, 250)}
                          className="py-1 px-2 rounded text-[11px] font-mono bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 transition cursor-pointer"
                        >
                          Sell 250 kg
                        </button>
                      </div>

                      <button
                        disabled={available <= 0}
                        onClick={() => handleSell(type, available)}
                        className="w-full py-1.5 rounded text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed text-white shadow transition cursor-pointer"
                      >
                        Sell All ({available} kg) → +${Math.round(available * spec.pricePerKg).toLocaleString()}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 3: Industrial Chain Guide */}
        {activeTab === 'guide' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs text-slate-300">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <Pickaxe className="w-4 h-4 text-amber-400" />
                The Complete Extraterrestrial Industrial Chain
              </h3>
              <p className="leading-relaxed">
                Astronet HQ rewards spaceflight pioneers who establish in-situ industrial supply lines. This secondary system is not a progression wall — it teaches authentic orbital mechanics and manufacturing loops:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="font-bold text-amber-400 flex items-center gap-1.5">
                    <span>1. Drill & Extraction</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Land on celestial surfaces (Moon, Mars, asteroids). Mount an <strong className="text-slate-200">ISRU Surface Harvester Drill</strong> and <strong className="text-slate-200">Ore Hopper Tank</strong>. Activate drill to extract raw ore into the hopper.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="font-bold text-teal-400 flex items-center gap-1.5">
                    <span>2. Chemical Refining</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Run the raw ore through an <strong className="text-slate-200">ISRU Chemical Refinery</strong> onboard your lander or at an orbital Space Station. This purifies feedstocks and strips volatile rock.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="font-bold text-sky-400 flex items-center gap-1.5">
                    <span>3. Ingot Arc Smelting</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    A <strong className="text-slate-200">Vacuum Arc Smelter</strong> converts refined feedstocks into structural titanium/alloy ingots. Keeping ingots stockpiled grants up to a <strong className="text-emerald-400">50% discount</strong> on rocket construction!
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
