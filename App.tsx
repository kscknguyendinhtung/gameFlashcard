
import React, { useState, useMemo, useEffect } from 'react';
import FileUploader from './components/FileUploader';
import FlashcardView from './components/FlashcardView';
import ReviewDashboard from './components/ReviewDashboard';
import TempleRunGame from './components/TempleRunGame';
import { Flashcard, CardConfig, CardOrder, CardSide, StudyMode } from './types';
import { Gamepad2 } from 'lucide-react';

const LANGUAGES = [
  { code: 'vi-VN', name: 'Tiếng Việt' },
  { code: 'en-US', name: 'Tiếng Anh' },
  { code: 'ja-JP', name: 'Tiếng Nhật' },
  { code: 'zh-CN', name: 'Tiếng Trung (Phổ thông)' },
  { code: 'zh-TW', name: 'Tiếng Trung (Đài Loan)' },
  { code: 'ko-KR', name: 'Tiếng Hàn' },
];

type AppState = 'setup' | 'home' | 'studying' | 'result' | 'review' | 'game';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('setup');
  const [data, setData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [sourceUrl, setSourceUrl] = useState<string | undefined>(undefined);
  const [users, setUsers] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<string>('');
  
  const [config, setConfig] = useState<CardConfig & { voiceFront?: string; voiceBack?: string; isAutoFlip?: boolean }>({
    frontColumns: [],
    backColumns: [],
    tagColumn: '',
    tag2Column: '',
    frontPosition: 'center',
    backPosition: 'center',
    flipSpeed: 2,
    voiceFront: '',
    voiceBack: '',
    isAutoFlip: true
  });
  
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [cardOrder, setCardOrder] = useState<CardOrder>(CardOrder.SEQUENTIAL);
  const [cardSide, setCardSide] = useState<CardSide>(CardSide.FRONT_FIRST);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedTag1, setSelectedTag1] = useState<string>('all');
  const [selectedTag2, setSelectedTag2] = useState<string>('all');
  const [selectedScores, setSelectedScores] = useState<number[]>([0, 1, 2, 3, 4, 5]);
  const [cardHistory, setCardHistory] = useState<Record<string, number>>({});
  const [sessionResults, setSessionResults] = useState<Record<string, number>>({});

  useEffect(() => {
    const synth = window.speechSynthesis;
    const loadVoices = () => {
      const voices = synth.getVoices();
      if (voices.length > 0) {
        setAvailableVoices(voices.filter(v => 
          v.lang.startsWith('vi') || v.lang.startsWith('en') || 
          v.lang.startsWith('ja') || v.lang.startsWith('zh') || 
          v.lang.startsWith('ko')
        ));
      }
    };
    loadVoices();
    if (synth.onvoiceschanged !== undefined) synth.onvoiceschanged = loadVoices;
  }, []);

  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('anki_history');
      const savedConfig = localStorage.getItem('anki_config');
      const savedUrl = localStorage.getItem('anki_source_url');
      const savedCols = localStorage.getItem('anki_columns');
      const savedUser = localStorage.getItem('anki_current_user');
      const savedLocalData = localStorage.getItem('anki_data');

      if (savedHistory) setCardHistory(JSON.parse(savedHistory));
      if (savedConfig) setConfig(JSON.parse(savedConfig));
      if (savedUrl) setSourceUrl(savedUrl);
      if (savedCols) {
        const parsedCols = JSON.parse(savedCols);
        setColumns(parsedCols);
        const userCols = parsedCols.slice(8, 16).filter((c: string) => c && c.trim() !== '');
        setUsers(userCols);
        if (savedUser && userCols.includes(savedUser)) setCurrentUser(savedUser);
        else if (userCols.length > 0) setCurrentUser(userCols[0]);
      }
      
      if (savedLocalData) {
        setData(JSON.parse(savedLocalData));
        setAppState('home');
      }
    } catch (e) {
      console.error("Restore error:", e);
    }
  }, []);

  const saveAll = (newData?: any[], newConfig?: any, newCols?: string[], url?: string) => {
    if (newData) {
      setData(newData);
      localStorage.setItem('anki_data', JSON.stringify(newData));
    }
    if (newConfig) {
      setConfig(newConfig);
      localStorage.setItem('anki_config', JSON.stringify(newConfig));
    }
    if (newCols) {
      setColumns(newCols);
      localStorage.setItem('anki_columns', JSON.stringify(newCols));
    }
    if (url !== undefined) {
      setSourceUrl(url);
      if (url) localStorage.setItem('anki_source_url', url);
    }
  };

  const flashcards: Flashcard[] = useMemo(() => {
    if (config.frontColumns.length === 0 || config.backColumns.length === 0) return [];
    const tag1ColName = columns[5]; // Cột F
    const tag2ColName = columns[6]; // Cột G
    const userColIndex = columns.indexOf(currentUser);
    const effectiveLevelCol = userColIndex !== -1 ? currentUser : null; 

    return data.map((row, idx) => {
      const frontText = row[config.frontColumns[0]?.columnName] || '';
      const id = row.id || frontText || `idx-${idx}`;
      const tags1 = String(row[tag1ColName] || '').split(/[;,]/).map(t => t.trim()).filter(t => t.length > 0);
      const tags2 = String(row[tag2ColName] || '').split(/[;,]/).map(t => t.trim()).filter(t => t.length > 0);
      const valFromData = effectiveLevelCol ? parseInt(row[effectiveLevelCol]) : 0;
      return {
        id,
        frontData: config.frontColumns.map(col => ({ text: row[col.columnName] || '', lang: col.language, isImage: col.isImage, columnName: col.columnName })),
        backData: config.backColumns.map(col => ({ text: row[col.columnName] || '', lang: col.language, isImage: col.isImage, columnName: col.columnName })),
        tags: tags1,
        tags2: tags2,
        level: cardHistory[id] !== undefined ? cardHistory[id] : (isNaN(valFromData) ? 0 : valFromData),
      };
    });
  }, [data, config, cardHistory, columns, currentUser]);

  const allTags1 = useMemo(() => {
    const tags = new Set<string>();
    flashcards.forEach(card => card.tags.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [flashcards]);

  const allTags2 = useMemo(() => {
    const tags = new Set<string>();
    const filteredByTag1 = selectedTag1 === 'all' 
      ? flashcards 
      : flashcards.filter(c => c.tags.includes(selectedTag1));
      
    filteredByTag1.forEach(card => card.tags2.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [flashcards, selectedTag1]);

  useEffect(() => {
    if (selectedTag2 !== 'all' && !allTags2.includes(selectedTag2)) {
      setSelectedTag2('all');
    }
  }, [allTags2, selectedTag2]);

  const studyList = useMemo(() => {
    let result = flashcards.filter(card => {
      const matchesTag1 = selectedTag1 === 'all' || card.tags.includes(selectedTag1);
      const matchesTag2 = selectedTag2 === 'all' || card.tags2.includes(selectedTag2);
      const matchesScore = selectedScores.includes(card.level);
      return matchesTag1 && matchesTag2 && matchesScore;
    });
    if (cardOrder === CardOrder.RANDOM) result = [...result].sort(() => Math.random() - 0.5);
    return result;
  }, [flashcards, selectedTag1, selectedTag2, selectedScores, cardOrder, appState === 'studying']);

  const handleDataLoaded = (loadedData: any[], loadedColumns: string[], url?: string) => {
    setData(loadedData);
    setColumns(loadedColumns);
    if (url) setSourceUrl(url);

    const userCols = loadedColumns.slice(8, 16).filter(c => c && c.trim() !== '');
    setUsers(userCols);
    if (userCols.length > 0 && !currentUser) {
      setCurrentUser(userCols[0]);
    }

    if (config.frontColumns.length === 0) {
      let newConfig = { ...config, tagColumn: loadedColumns[5] || '', tag2Column: loadedColumns[6] || '', frontColumns: [], backColumns: [] };
      if (loadedColumns.length >= 2) {
        newConfig.frontColumns = [{ columnName: loadedColumns[0], language: 'zh-CN' }];
        newConfig.backColumns = [{ columnName: loadedColumns[1], language: 'vi-VN' }];
        for (let i = 2; i < 5 && i < loadedColumns.length; i++) {
          newConfig.backColumns.push({ columnName: loadedColumns[i], language: 'vi-VN' });
        }
        if (loadedColumns[7]) {
           newConfig.backColumns.push({ columnName: loadedColumns[7], language: 'vi-VN' });
        }
      }
      setConfig(newConfig);
      saveAll(loadedData, newConfig, loadedColumns, url);
    } else {
      saveAll(loadedData, config, loadedColumns, url);
    }
    setAppState('home');
  };

  const handleRate = (difficulty: number) => {
    const card = studyList[currentIndex];
    const newHistory = { ...cardHistory, [card.id]: difficulty };
    setCardHistory(newHistory);
    localStorage.setItem('anki_history', JSON.stringify(newHistory));
    setSessionResults(prev => ({ ...prev, [card.id]: difficulty }));
    if (currentIndex < studyList.length - 1) setCurrentIndex(currentIndex + 1);
    else setAppState('result');
  };

  const handleStartStudy = () => {
    setSessionResults({}); // Reset kết quả phiên học mới
    setCurrentIndex(0);
    setAppState('studying');
  };

  const currentStudyCard = useMemo(() => {
    const card = studyList[currentIndex];
    if (!card) return null;
    let finalCard = { ...card };
    let finalVoiceFront = config.voiceFront;
    let finalVoiceBack = config.voiceBack;

    const shouldSwap = cardSide === CardSide.BACK_FIRST || (cardSide === CardSide.RANDOM && Math.random() > 0.5);
    if (shouldSwap) {
      finalCard.frontData = card.backData;
      finalCard.backData = card.frontData;
      finalVoiceFront = config.voiceBack;
      finalVoiceBack = config.voiceFront;
    }
    return { ...finalCard, _voiceFront: finalVoiceFront, _voiceBack: finalVoiceBack };
  }, [studyList, currentIndex, cardSide, appState === 'studying', config.voiceFront, config.voiceBack]);

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans text-slate-900">
      <header className="bg-white border-b border-slate-200 h-14 flex items-center px-4 sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto w-full flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setAppState('home')}>
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-100">
              <span className="text-white font-black text-lg italic">N</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-extrabold text-slate-800 tracking-tight leading-none">NTGR LANGUAGE</h1>
              <span className="text-[8px] font-black text-indigo-600 uppercase tracking-widest">Flashcard System</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setAppState('setup')} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors" title="Cài đặt nguồn">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
            {(appState === 'review' || appState === 'result' || (appState === 'setup' && data.length > 0)) && (
              <button onClick={() => setAppState('home')} className="text-sm font-bold text-slate-400 hover:text-indigo-600 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>Quay lại
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {appState === 'setup' && (
          <div className="max-w-xl mx-auto py-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-black text-slate-800 mb-2 tracking-tight">Cài đặt nguồn dữ liệu</h2>
              <p className="text-slate-400 font-medium text-sm">Link Google Sheet của bạn sẽ được đồng bộ ngay lập tức.</p>
            </div>
            <FileUploader onDataLoaded={handleDataLoaded} />
          </div>
        )}

        {appState === 'home' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Người Học</p>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {users.length > 0 ? users.map(u => (
                    <button key={u} onClick={() => {setCurrentUser(u); localStorage.setItem('anki_current_user', u);}} className={`px-4 py-2 rounded-xl font-black text-[10px] transition-all border-2 ${currentUser === u ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'}`}>{u}</button>
                  )) : <p className="text-xs text-slate-300">Không tìm thấy cột User</p>}
                </div>
              </div>
              
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Lọc Phân Loại (Tag Thông Minh)</p>
                <div className="grid grid-cols-2 gap-2 w-full">
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-slate-400 uppercase block ml-1">TAG 1 (Cột F)</label>
                    <select value={selectedTag1} onChange={(e) => setSelectedTag1(e.target.value)} className="w-full py-3 bg-slate-50 border border-slate-100 rounded-xl font-black text-[10px] px-3 outline-none focus:ring-2 ring-indigo-500 transition-all">
                      <option value="all">TẤT CẢ TAG 1</option>
                      {allTags1.map(tag => <option key={tag} value={tag}>{tag.toUpperCase()}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-slate-400 uppercase block ml-1">TAG 2 (Cột G)</label>
                    <select value={selectedTag2} onChange={(e) => setSelectedTag2(e.target.value)} className="w-full py-3 bg-slate-50 border border-slate-100 rounded-xl font-black text-[10px] px-3 outline-none focus:ring-2 ring-indigo-500 transition-all">
                      <option value="all">TẤT CẢ TAG 2</option>
                      {allTags2.map(tag => <option key={tag} value={tag}>{tag.toUpperCase()}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-black text-slate-800 tracking-tight">Nội dung thẻ</h2>
                    {data.length > 0 && (
                      <div className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase">
                        Xem dòng đầu tiên
                      </div>
                    )}
                  </div>
                  
                  {data.length > 0 && (
                    <div className="mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100 overflow-x-auto">
                      <p className="text-[8px] font-black text-slate-400 uppercase mb-2">Dữ liệu mẫu (Dòng 1):</p>
                      <div className="flex gap-4 min-w-max">
                        {columns.map((col, idx) => (
                          <div key={idx} className="flex flex-col">
                            <span className="text-[9px] font-bold text-slate-400">{col}</span>
                            <span className="text-[11px] font-black text-slate-700">{String(data[0][col] || '-')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-6">
                    {['front', 'back'].map(side => (
                      <div key={side} className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Mặt {side === 'front' ? 'Trước' : 'Sau'}</p>
                        <div className="grid grid-cols-1 gap-2">
                          {columns.map((col, idx) => {
                            const mapping = (side === 'front' ? config.frontColumns : config.backColumns).find(c => c.columnName === col);
                            if (idx === 5 || idx === 6 || (idx >= 8 && idx <= 15)) return null;
                            return (
                              <div key={col} className={`flex items-center gap-3 bg-white p-3 rounded-xl border ${mapping ? 'border-indigo-200 shadow-sm' : 'border-slate-100 opacity-60'}`}>
                                <input type="checkbox" checked={!!mapping} onChange={(e) => {
                                  const key = side === 'front' ? 'frontColumns' : 'backColumns';
                                  let newMappings = [...config[key]];
                                  if (e.target.checked) newMappings.push({ columnName: col, language: 'vi-VN' });
                                  else newMappings = newMappings.filter(m => m.columnName !== col);
                                  const nc = { ...config, [key]: newMappings };
                                  setConfig(nc); saveAll(undefined, nc);
                                }} className="w-4 h-4 rounded text-indigo-600" />
                                <span className="flex-1 text-xs font-bold text-slate-700">{col} {idx === 7 ? '(Hán Việt)' : ''}</span>
                                {mapping && (
                                  <select value={mapping.language} onChange={(e) => {
                                    const key = side === 'front' ? 'frontColumns' : 'backColumns';
                                    const newMappings = config[key].map(m => m.columnName === col ? { ...m, language: e.target.value } : m);
                                    const nc = { ...config, [key]: newMappings };
                                    setConfig(nc); saveAll(undefined, nc);
                                  }} className="text-[9px] font-black bg-slate-100 border-none rounded-lg px-2 py-1 outline-none">
                                    {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                                  </select>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6">
                  <h2 className="text-lg font-black text-slate-800 mb-5 tracking-tight">Cấu hình học</h2>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase mb-2 tracking-widest">Chế độ lật</label>
                      <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button onClick={() => {const nc = {...config, isAutoFlip: true}; setConfig(nc); saveAll(undefined, nc);}} className={`flex-1 py-2 rounded-lg text-[9px] font-black transition-all ${config.isAutoFlip ? 'bg-white shadow-md text-indigo-600' : 'text-slate-400'}`}>TỰ ĐỘNG</button>
                        <button onClick={() => {const nc = {...config, isAutoFlip: false}; setConfig(nc); saveAll(undefined, nc);}} className={`flex-1 py-2 rounded-lg text-[9px] font-black transition-all ${!config.isAutoFlip ? 'bg-white shadow-md text-indigo-600' : 'text-slate-400'}`}>THỦ CÔNG</button>
                      </div>
                    </div>

                    {config.isAutoFlip && (
                      <div>
                        <label className="block text-[9px] font-black text-slate-400 uppercase mb-2 tracking-widest">Thời gian chờ: {config.flipSpeed}s</label>
                        <input type="range" min="1" max="10" value={config.flipSpeed || 2} onChange={(e) => {const nc = {...config, flipSpeed: parseInt(e.target.value)}; setConfig(nc); saveAll(undefined, nc);}} className="w-full accent-indigo-600" />
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 tracking-widest">Giọng Mặt Trước</label>
                        <select className="w-full bg-slate-50 border rounded-lg px-3 py-1.5 font-bold text-[10px] outline-none" value={config.voiceFront} onChange={(e) => {const nc = {...config, voiceFront: e.target.value}; setConfig(nc); saveAll(undefined, nc);}}>
                          <option value="">Mặc định</option>
                          {availableVoices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 tracking-widest">Giọng Mặt Sau</label>
                        <select className="w-full bg-slate-50 border rounded-lg px-3 py-1.5 font-bold text-[10px] outline-none" value={config.voiceBack} onChange={(e) => {const nc = {...config, voiceBack: e.target.value}; setConfig(nc); saveAll(undefined, nc);}}>
                          <option value="">Mặc định</option>
                          {availableVoices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>)}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase mb-2 tracking-widest">Mặt bắt đầu</label>
                      <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button onClick={() => setCardSide(CardSide.FRONT_FIRST)} className={`flex-1 py-2 rounded-lg text-[9px] font-black transition-all ${cardSide === CardSide.FRONT_FIRST ? 'bg-white shadow-md text-indigo-600' : 'text-slate-400'}`}>TRƯỚC</button>
                        <button onClick={() => setCardSide(CardSide.BACK_FIRST)} className={`flex-1 py-2 rounded-lg text-[9px] font-black transition-all ${cardSide === CardSide.BACK_FIRST ? 'bg-white shadow-md text-indigo-600' : 'text-slate-400'}`}>SAU</button>
                        <button onClick={() => setCardSide(CardSide.RANDOM)} className={`flex-1 py-2 rounded-lg text-[9px] font-black transition-all ${cardSide === CardSide.RANDOM ? 'bg-white shadow-md text-indigo-600' : 'text-slate-400'}`}>HỖN HỢP</button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase mb-2 tracking-widest">Thứ tự thẻ</label>
                      <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button onClick={() => setCardOrder(CardOrder.SEQUENTIAL)} className={`flex-1 py-2 rounded-lg text-[9px] font-black transition-all ${cardOrder === CardOrder.SEQUENTIAL ? 'bg-white shadow-md text-indigo-600' : 'text-slate-400'}`}>TUẦN TỰ</button>
                        <button onClick={() => setCardOrder(CardOrder.RANDOM)} className={`flex-1 py-2 rounded-lg text-[9px] font-black transition-all ${cardOrder === CardOrder.RANDOM ? 'bg-white shadow-md text-indigo-600' : 'text-slate-400'}`}>NGẪU NHIÊN</button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase mb-2 tracking-widest">Lọc Level</label>
                      <div className="grid grid-cols-3 gap-1">
                        {[0, 1, 2, 3, 4, 5].map(s => (
                          <button key={s} onClick={() => setSelectedScores(prev => prev.includes(s) ? (prev.length > 1 ? prev.filter(x => x !== s) : prev) : [...prev, s].sort())} className={`py-1.5 rounded-lg text-[9px] font-black border transition-all ${selectedScores.includes(s) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-100 text-slate-400'}`}>{s === 0 ? 'MỚI' : `LVL ${s}`}</button>
                        ))}
                      </div>
                    </div>

                    <button onClick={handleStartStudy} className="w-full bg-indigo-600 text-white font-black py-4 rounded-xl shadow-xl active:scale-95 transition-all text-xs tracking-widest disabled:opacity-50" disabled={studyList.length === 0}>BẮT ĐẦU HỌC ({studyList.length})</button>
                    <button onClick={() => setAppState('game')} className="w-full bg-emerald-600 text-white font-black py-4 rounded-xl shadow-xl active:scale-95 transition-all text-xs tracking-widest flex items-center justify-center gap-2 disabled:opacity-50" disabled={studyList.length === 0}>
                      <Gamepad2 className="w-4 h-4" />
                      CHƠI GAME ({studyList.length})
                    </button>
                    <button onClick={() => setAppState('review')} className="w-full bg-white border border-slate-200 text-slate-600 font-black text-[10px] uppercase tracking-widest py-4 rounded-xl hover:bg-slate-50 shadow-sm transition-all">Xem Dashboard</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {appState === 'studying' && currentStudyCard && (
          <div className="max-w-2xl mx-auto pt-4">
            <div className="mb-10 flex items-center justify-between">
              <div className="flex-1 h-3.5 bg-slate-200 rounded-full overflow-hidden mr-6 shadow-inner">
                <div className="h-full bg-indigo-600 transition-all duration-700" style={{ width: `${((currentIndex + 1) / studyList.length) * 100}%` }} />
              </div>
              <span className="font-black text-slate-500 text-sm tracking-widest">{currentIndex + 1} / {studyList.length}</span>
            </div>
            <FlashcardView 
              key={currentStudyCard.id} 
              card={currentStudyCard as Flashcard} 
              config={{...config, voiceFront: (currentStudyCard as any)._voiceFront, voiceBack: (currentStudyCard as any)._voiceBack}} 
              mode={StudyMode.FRONT_FIRST} 
              onRate={handleRate} 
              onPrev={() => currentIndex > 0 && setCurrentIndex(currentIndex - 1)}
              onNext={() => currentIndex < studyList.length - 1 && setCurrentIndex(currentIndex + 1)}
              onStop={() => setAppState('result')}
              currentIndex={currentIndex}
              totalCards={studyList.length}
            />
          </div>
        )}

        {appState === 'game' && (
          <div className="max-w-4xl mx-auto">
            <TempleRunGame 
              flashcards={studyList} 
              onBack={() => setAppState('home')} 
              voiceName={config.voiceFront}
              lang={config.frontColumns[0]?.language || 'zh-CN'}
            />
          </div>
        )}

        {(appState === 'result' || appState === 'review') && (
          <ReviewDashboard 
            flashcards={flashcards} history={cardHistory} sessionResults={sessionResults} 
            allTags={allTags1} sourceUrl={sourceUrl} onBack={() => setAppState('home')} columns={columns} data={data}
            currentUser={currentUser} onDataUpdate={(newData) => saveAll(newData)}
          />
        )}
      </main>
    </div>
  );
};

export default App;
