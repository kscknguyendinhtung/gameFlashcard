
import React, { useState, useMemo } from 'react';
import { Flashcard } from '../types';

interface WordCatalogProps {
  flashcards: Flashcard[];
  allTags: string[];
}

const WordCatalog: React.FC<WordCatalogProps> = ({ flashcards, allTags }) => {
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set(['all']));
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const levelColors: Record<number, string> = {
    0: 'bg-slate-100 text-slate-400 border-slate-200',
    1: 'bg-red-500 text-white border-red-400',
    2: 'bg-orange-500 text-white border-orange-400',
    3: 'bg-yellow-500 text-white border-yellow-400',
    4: 'bg-emerald-500 text-white border-emerald-400',
    5: 'bg-blue-600 text-white border-blue-500',
  };

  const groupedCards = useMemo(() => {
    const groups: Record<string, Flashcard[]> = { 'Khác': [] };
    allTags.forEach(tag => groups[tag] = []);
    
    flashcards.forEach(card => {
      if (card.tags.length === 0) {
        groups['Khác'].push(card);
      } else {
        card.tags.forEach(tag => {
          if (groups[tag]) groups[tag].push(card);
        });
      }
    });
    return groups;
  }, [flashcards, allTags]);

  const toggleTag = (tag: string) => {
    const newSet = new Set(expandedTags);
    if (newSet.has(tag)) newSet.delete(tag);
    else newSet.add(tag);
    setExpandedTags(newSet);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest ml-2">Cấu trúc thư mục</h3>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button 
            onClick={() => setViewMode('grid')} 
            className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}
          >
            LƯỚI (4 CỘT)
          </button>
          <button 
            onClick={() => setViewMode('list')} 
            className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}
          >
            DANH SÁCH (1 CỘT)
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Cast Object.entries to ensure 'cards' is recognized as Flashcard[] */}
        {(Object.entries(groupedCards) as [string, Flashcard[]][]).map(([tag, cards]) => {
          if (cards.length === 0) return null;
          const isExpanded = expandedTags.has(tag);
          
          return (
            <div key={tag} className="space-y-4">
              <button 
                onClick={() => toggleTag(tag)}
                className="w-full flex items-center justify-between p-4 bg-slate-100/50 rounded-2xl hover:bg-slate-100 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-[10px] font-black`}>
                    {cards.length}
                  </div>
                  <span className="font-black text-slate-800 uppercase tracking-widest text-xs">{tag}</span>
                </div>
                <svg className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isExpanded && (
                <div className={`animate-in slide-in-from-top-2 duration-300 grid gap-4 ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' : 'grid-cols-1'}`}>
                  {cards.map(card => (
                    <div 
                      key={card.id}
                      className="group flex items-center justify-between p-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover:border-indigo-200 transition-all hover:shadow-md"
                    >
                      <div className="flex-1 flex flex-col gap-1 overflow-hidden pr-4 text-left">
                        <span className="font-black text-slate-800 truncate text-lg leading-tight">
                          {card.frontData.map(d => d.text).join(' ')}
                        </span>
                        <div className="flex flex-col text-[11px] text-slate-400 font-bold leading-relaxed truncate">
                          {card.backData.map((d, i) => (
                            <span key={i} className={i === 0 ? "text-slate-500" : "opacity-70"}>{d.text}</span>
                          ))}
                        </div>
                      </div>
                      <div className={`flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-sm ${levelColors[card.level] || levelColors[0]}`}>
                        {card.level}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WordCatalog;
