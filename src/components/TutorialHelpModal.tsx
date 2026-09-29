import React, { useState, useEffect } from 'react';
import Markdown from 'react-markdown';
import {
  BookOpen,
  X,
  Search,
  Rocket,
  Compass,
  Layers,
  Keyboard,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import { TUTORIAL_MARKDOWN } from '../data/tutorialContent';
import { soundEngine } from '../audio/soundEngine';

interface TutorialHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TutorialHelpModal: React.FC<TutorialHelpModalProps> = ({ isOpen, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState<'ALL' | 'QUICK' | 'VAB' | 'STAGING' | 'ORBIT' | 'KEYS'>('ALL');

  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Filter content based on active section or search query
  let contentToRender = TUTORIAL_MARKDOWN;
  if (activeSection === 'QUICK') {
    const m = TUTORIAL_MARKDOWN.match(/## 1\. Quick Start:[\s\S]*?(?=## 2\.|$)/);
    if (m) contentToRender = `# Quick Start: Your First Orbital Launch\n\n` + m[0];
  } else if (activeSection === 'VAB') {
    const m = TUTORIAL_MARKDOWN.match(/## 2\. Vehicle Assembly Building[\s\S]*?(?=## 3\.|$)/);
    if (m) contentToRender = `# Rocket Design Principles\n\n` + m[0];
  } else if (activeSection === 'STAGING') {
    const m = TUTORIAL_MARKDOWN.match(/## 3\. Staging Architecture[\s\S]*?(?=## 4\.|$)/);
    if (m) contentToRender = `# Staging & Propellant Guide\n\n` + m[0];
  } else if (activeSection === 'ORBIT') {
    const m = TUTORIAL_MARKDOWN.match(/## 4\. The Gravity Turn[\s\S]*?(?=## 6\.|$)/);
    if (m) contentToRender = `# Orbital Mechanics & Flight Profile\n\n` + m[0];
  } else if (activeSection === 'KEYS') {
    const m = TUTORIAL_MARKDOWN.match(/## 6\. Keybindings[\s\S]*$/);
    if (m) contentToRender = `# Keybindings & Controls Reference\n\n` + m[0];
  }

  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    const lines = TUTORIAL_MARKDOWN.split('\n');
    const matchedLines: string[] = [];
    let inRelevantBlock = false;
    for (const line of lines) {
      if (line.startsWith('#')) {
        inRelevantBlock = line.toLowerCase().includes(query);
      }
      if (inRelevantBlock || line.toLowerCase().includes(query)) {
        matchedLines.push(line);
      }
    }
    contentToRender = matchedLines.length > 0
      ? `# Search Results for "${searchQuery}"\n\n` + matchedLines.join('\n')
      : `# No Results\n\nNo sections found matching "${searchQuery}". Please try another keyword like *fuel*, *staging*, *orbit*, or *engine*.`;
  }

  return (
    <div
      id="tutorial-help-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-slate-950/80 backdrop-blur-md animate-fade-in select-text"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl h-[88vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER BAR */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-500/20 text-sky-400 rounded-xl border border-sky-500/30">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-wide text-slate-100 flex items-center gap-2">
                Flight Operations Training Manual
                <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 font-mono">
                  v2.4
                </span>
              </h2>
              <p className="text-xs text-slate-400">Complete Guide to Rocket Construction, Staging & Orbital Navigation</p>
            </div>
          </div>

          <button
            id="close-tutorial-modal-btn"
            onClick={() => {
              soundEngine.playRotateClickSound();
              onClose();
            }}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Close Manual (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SEARCH & SECTION TABS */}
        <div className="px-6 py-3 border-b border-slate-800/80 bg-slate-900/40 flex flex-wrap items-center justify-between gap-3">
          {/* Section Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-medium">
            <button
              onClick={() => { setActiveSection('ALL'); setSearchQuery(''); }}
              className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                activeSection === 'ALL' && !searchQuery
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                  : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:text-slate-200'
              }`}
            >
              All Topics
            </button>
            <button
              onClick={() => { setActiveSection('QUICK'); setSearchQuery(''); }}
              className={`px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSection === 'QUICK'
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                  : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:text-slate-200'
              }`}
            >
              <Rocket className="w-3.5 h-3.5" />
              Quick Start
            </button>
            <button
              onClick={() => { setActiveSection('VAB'); setSearchQuery(''); }}
              className={`px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSection === 'VAB'
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                  : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Rocket Design
            </button>
            <button
              onClick={() => { setActiveSection('STAGING'); setSearchQuery(''); }}
              className={`px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSection === 'STAGING'
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                  : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:text-slate-200'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              Staging & Fuel
            </button>
            <button
              onClick={() => { setActiveSection('ORBIT'); setSearchQuery(''); }}
              className={`px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSection === 'ORBIT'
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                  : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:text-slate-200'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              Gravity Turn & Orbit
            </button>
            <button
              onClick={() => { setActiveSection('KEYS'); setSearchQuery(''); }}
              className={`px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSection === 'KEYS'
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                  : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:text-slate-200'
              }`}
            >
              <Keyboard className="w-3.5 h-3.5" />
              Keybindings
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative flex items-center min-w-[220px]">
            <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search guide (e.g. staging, fuel, orbit)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500/60 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 text-slate-400 hover:text-slate-200 text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* MARKDOWN CONTENT CONTAINER */}
        <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          <div className="markdown-body prose prose-invert prose-slate max-w-none text-slate-300 text-sm leading-relaxed">
            <Markdown>{contentToRender}</Markdown>
          </div>
        </div>

        {/* FOOTER BAR */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span>Tip: Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] text-slate-200">H</kbd> or <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] text-slate-200">F1</kbd> anywhere to toggle this guide</span>
          </div>
          <button
            onClick={() => {
              soundEngine.playRotateClickSound();
              onClose();
            }}
            className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-medium rounded-xl transition-colors cursor-pointer"
          >
            Got It, Commander
          </button>
        </div>
      </div>
    </div>
  );
};
