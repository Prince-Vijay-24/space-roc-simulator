import React, { useState, useRef } from 'react';
import {
  Save,
  Upload,
  Download,
  FileText,
  Trash2,
  Check,
  AlertCircle,
  X,
  HardDrive,
  Rocket,
  Clock,
  Sparkles,
} from 'lucide-react';
import { PlacedPart } from '../types';
import {
  SavedCraft,
  loadSavedCrafts,
  saveCraft,
  deleteCraft,
  exportCraftToFile,
  exportGameSaveToFile,
  parseGameSaveFile,
  applyGameSaveData,
  performAutoSave,
  loadAutoSave,
  getLastAutoSaveTime,
} from '../utils/saveFileManager';
import { soundEngine } from '../audio/soundEngine';

interface SaveDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeRocketParts: PlacedPart[];
  onLoadRocket: (parts: PlacedPart[]) => void;
  onFullSaveRestored?: () => void;
}

export const SaveDataModal: React.FC<SaveDataModalProps> = ({
  isOpen,
  onClose,
  activeRocketParts,
  onLoadRocket,
  onFullSaveRestored,
}) => {
  const [activeTab, setActiveTab] = useState<'SAVE_GAME' | 'LOAD_GAME' | 'SAVED_CRAFTS'>('SAVE_GAME');
  const [craftNameInput, setCraftNameInput] = useState('');
  const [craftDescInput, setCraftDescInput] = useState('');
  const [savedCrafts, setSavedCrafts] = useState<SavedCraft[]>(() => loadSavedCrafts());
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lastAutoSave, setLastAutoSave] = useState<string | null>(() => getLastAutoSaveTime());
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => {
      setStatusMessage(null);
    }, 4000);
  };

  const handleQuickSave = () => {
    performAutoSave(activeRocketParts);
    const nowStr = new Date().toISOString();
    setLastAutoSave(nowStr);
    soundEngine.playLegoAttachSound();
    showStatus('success', 'Game and active rocket quick-saved successfully! (Auto-saves every 10 min)');
  };

  const handleRestoreAutoSave = () => {
    const autoData = loadAutoSave();
    if (!autoData) {
      showStatus('error', 'No auto-save backup found in storage.');
      return;
    }
    applyGameSaveData(autoData);
    if (autoData.activeRocket && autoData.activeRocket.length > 0) {
      onLoadRocket(autoData.activeRocket);
    }
    if (onFullSaveRestored) {
      onFullSaveRestored();
    }
    soundEngine.playStageSound();
    showStatus('success', `Restored auto-save from ${new Date(autoData.timestamp).toLocaleString()}!`);
  };

  const handleSaveCurrentCraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (!craftNameInput.trim()) {
      showStatus('error', 'Please enter a craft name.');
      return;
    }
    if (!activeRocketParts || activeRocketParts.length === 0) {
      showStatus('error', 'Current rocket is empty. Add parts before saving.');
      return;
    }

    const saved = saveCraft(craftNameInput.trim(), activeRocketParts, craftDescInput.trim());
    setSavedCrafts(loadSavedCrafts());
    setCraftNameInput('');
    setCraftDescInput('');
    soundEngine.playLegoAttachSound();
    showStatus('success', `Saved "${saved.name}" (${saved.parts.length} parts) to your fleet.`);
  };

  const handleDeleteCraft = (id: string, name: string) => {
    deleteCraft(id);
    setSavedCrafts(loadSavedCrafts());
    soundEngine.playLegoDetachSound();
    showStatus('success', `Deleted craft "${name}".`);
  };

  const handleExportFullGame = () => {
    exportGameSaveToFile(activeRocketParts);
    soundEngine.playStageSound();
    showStatus('success', 'Game save data file downloaded successfully!');
  };

  const handleProcessFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) {
        showStatus('error', 'Empty file provided.');
        return;
      }

      const result = parseGameSaveFile(content);
      if (!result.success) {
        showStatus('error', result.error || 'Failed to read save file.');
        return;
      }

      if (result.data) {
        // Full Game Save
        applyGameSaveData(result.data);
        if (result.data.activeRocket && result.data.activeRocket.length > 0) {
          onLoadRocket(result.data.activeRocket);
        }
        setSavedCrafts(loadSavedCrafts());
        soundEngine.playStageSound();
        showStatus('success', `Loaded full game save from ${new Date(result.data.timestamp).toLocaleDateString()}!`);
        if (onFullSaveRestored) onFullSaveRestored();
      } else if (result.craft) {
        // Single Craft File
        const saved = saveCraft(result.craft.name, result.craft.parts, result.craft.description);
        onLoadRocket(result.craft.parts);
        setSavedCrafts(loadSavedCrafts());
        soundEngine.playLegoAttachSound();
        showStatus('success', `Imported & loaded craft "${saved.name}" (${saved.parts.length} parts)!`);
      }
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 pointer-events-auto">
      <div className="max-w-2xl w-full bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Mission Save & File Manager</h2>
              <p className="text-xs text-slate-400">Save progress, export backups, or load saved crafts</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-5 pt-2 gap-2">
          <button
            onClick={() => setActiveTab('SAVE_GAME')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'SAVE_GAME'
                ? 'border-sky-400 text-sky-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save & Export</span>
          </button>
          <button
            onClick={() => setActiveTab('LOAD_GAME')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'LOAD_GAME'
                ? 'border-sky-400 text-sky-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Load Save File</span>
          </button>
          <button
            onClick={() => setActiveTab('SAVED_CRAFTS')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'SAVED_CRAFTS'
                ? 'border-sky-400 text-sky-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Rocket className="w-3.5 h-3.5" />
            <span>Saved Fleet ({savedCrafts.length})</span>
          </button>
        </div>

        {/* Status Notification */}
        {statusMessage && (
          <div
            className={`px-5 py-2.5 text-xs font-medium flex items-center gap-2 border-b ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/70 border-emerald-800 text-emerald-300'
                : 'bg-rose-950/70 border-rose-800 text-rose-300'
            }`}
          >
            {statusMessage.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {activeTab === 'SAVE_GAME' && (
            <div className="space-y-5">
              {/* Quick Save & Auto-Save Status Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/60 to-slate-900/80 border border-emerald-700/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-sm font-bold text-white">Auto-Save Active (Every 10 Minutes)</span>
                  </div>
                  <p className="text-xs text-slate-300 max-w-md leading-relaxed">
                    The simulator automatically saves your active rocket, astronaut roster, and economy state every 10 minutes in the background.
                    {lastAutoSave && (
                      <span className="block text-[11px] text-emerald-400 font-mono mt-0.5">
                        Last saved: {new Date(lastAutoSave).toLocaleTimeString()}
                      </span>
                    )}
                  </p>
                </div>
                <button
                  id="modal-quick-save-btn"
                  onClick={handleQuickSave}
                  className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs transition flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/60 shrink-0"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Now (Quick Save)</span>
                </button>
              </div>

              {/* Export Full Game File */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-sky-400" />
                    <span className="text-sm font-semibold text-white">Export Full Game Save (.json)</span>
                  </div>
                  <p className="text-xs text-slate-400 max-w-md leading-relaxed">
                    Downloads a complete backup file of your entire space program including active rocket, saved crafts, economy balance, ore stockpiles, and astronaut roster.
                  </p>
                </div>
                <button
                  onClick={handleExportFullGame}
                  className="px-4 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-semibold text-xs transition flex items-center gap-2 cursor-pointer shadow-sm shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Save File</span>
                </button>
              </div>

              {/* Save Active Craft to Fleet */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Rocket className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-semibold text-white">Save Current Rocket Design</span>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    {activeRocketParts?.length || 0} parts active
                  </span>
                </div>

                <form onSubmit={handleSaveCurrentCraft} className="space-y-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Craft Name
                    </label>
                    <input
                      type="text"
                      value={craftNameInput}
                      onChange={(e) => setCraftNameInput(e.target.value)}
                      placeholder="e.g. Gaganyaan Mark-III, Lunar Surveyor 1"
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Mission Description / Notes (Optional)
                    </label>
                    <input
                      type="text"
                      value={craftDescInput}
                      onChange={(e) => setCraftDescInput(e.target.value)}
                      placeholder="e.g. Two-stage heavy lifter with side boosters for trans-lunar injection"
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={!activeRocketParts || activeRocketParts.length === 0}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs transition flex items-center gap-2 cursor-pointer shadow-sm"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save Craft to Fleet</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'LOAD_GAME' && (
            <div className="space-y-4">
              {/* Restore Auto-Save Card if available */}
              {lastAutoSave && (
                <div className="p-4 rounded-xl bg-slate-950/80 border border-emerald-800/60 flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold text-white">Auto-Save Backup Available</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Saved {new Date(lastAutoSave).toLocaleString()} (Every 10 min auto-save)
                    </p>
                  </div>
                  <button
                    onClick={handleRestoreAutoSave}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    <HardDrive className="w-3.5 h-3.5" />
                    <span>Restore Auto-Save</span>
                  </button>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
              />

              {/* Drag and Drop Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-8 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center gap-3 transition cursor-pointer ${
                  isDragging
                    ? 'border-sky-400 bg-sky-950/20'
                    : 'border-slate-700 hover:border-slate-500 bg-slate-950/50 hover:bg-slate-950/80'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    Click to browse or drag & drop save file here
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Supports full game save (.json) and individual rocket craft files (.craft.json)
                  </p>
                </div>
                <button
                  type="button"
                  className="mt-1 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700"
                >
                  Select .JSON File
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p>
                  Save files are standard JSON formatted and can be shared between devices or restored anytime without losing your active rockets, roster, or agency progress.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'SAVED_CRAFTS' && (
            <div className="space-y-3">
              {savedCrafts.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-slate-950/50 border border-slate-800 space-y-2">
                  <Rocket className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-sm font-semibold text-slate-300">No Saved Crafts Yet</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Design a rocket in the VAB Builder and use the &quot;Save & Export&quot; tab to save your craft here.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {savedCrafts.map((craft) => (
                    <div
                      key={craft.id}
                      className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition flex items-center justify-between gap-3 group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white truncate">{craft.name}</span>
                          <span className="text-[10px] font-mono text-sky-400 bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-800/40">
                            {craft.parts.length} parts
                          </span>
                        </div>
                        {craft.description && (
                          <p className="text-xs text-slate-400 truncate mt-0.5">{craft.description}</p>
                        )}
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-1 font-mono">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(craft.savedAt).toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => {
                            onLoadRocket(craft.parts);
                            soundEngine.playLegoAttachSound();
                            showStatus('success', `Loaded "${craft.name}" into workspace!`);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white text-xs font-semibold transition cursor-pointer"
                        >
                          Load
                        </button>
                        <button
                          onClick={() => exportCraftToFile(craft)}
                          title="Export craft to .craft.json file"
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteCraft(craft.id, craft.name)}
                          title="Delete craft from fleet"
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 text-slate-400 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>Space Program Local Storage &amp; JSON File Synchronization</span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
