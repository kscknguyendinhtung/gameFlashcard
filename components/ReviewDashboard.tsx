
import React, { useMemo, useState } from 'react';
import { Flashcard } from '../types';
import WordCatalog from './WordCatalog';

interface ReviewDashboardProps {
  flashcards: Flashcard[];
  history: Record<string, number>;
  sessionResults?: Record<string, number>;
  allTags?: string[];
  sourceUrl?: string;
  onBack: () => void;
  columns: string[];
  data: any[];
  onDelete?: (cardId: string) => void;
  currentUser?: string;
  onDataUpdate?: (newData: any[]) => void; 
}

const ReviewDashboard: React.FC<ReviewDashboardProps> = ({ 
  flashcards, 
  history, 
  sessionResults, 
  allTags, 
  sourceUrl, 
  onBack, 
  columns, 
  data, 
  onDelete,
  currentUser,
  onDataUpdate
}) => {
  // Nếu có sessionResults, mặc định tab đầu tiên là 'session'
  const [activeTab, setActiveTab] = useState<'session' | 'overall' | 'catalog'>(
    (sessionResults && Object.keys(sessionResults).length > 0) ? 'session' : 'overall'
  );
  const [filterTag, setFilterTag] = useState('all');
  const [filterScores, setFilterScores] = useState<number[]>([0, 1, 2, 3, 4, 5]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Danh sách hiển thị dựa trên tab active
  const displayList = useMemo(() => {
    let list = flashcards;
    if (activeTab === 'session') {
      const sessionIds = Object.keys(sessionResults || {});
      list = flashcards.filter(c => sessionIds.includes(c.id));
    }

    return list.filter(c => {
      const score = activeTab === 'session' ? (sessionResults?.[c.id] || 0) : (history[c.id] || 0);
      const matchesTag = filterTag === 'all' || c.tags.includes(filterTag);
      const matchesScore = filterScores.includes(score);
      return matchesTag && matchesScore;
    });
  }, [activeTab, sessionResults, flashcards, history, filterTag, filterScores]);

  // Tính toán thống kê cho hình Donut
  const stats = useMemo(() => {
    const counts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    
    const targetCards = activeTab === 'session' 
      ? flashcards.filter(c => Object.keys(sessionResults || {}).includes(c.id))
      : flashcards;

    targetCards.forEach(card => {
      const level = activeTab === 'session' ? (sessionResults?.[card.id] || 0) : (history[card.id] || 0);
      if (level in counts) counts[level as keyof typeof counts]++;
    });
    return counts;
  }, [activeTab, flashcards, history, sessionResults]);

  const totalCardsCount = useMemo(() => Object.values(stats).reduce((a: number, b: number) => a + b, 0), [stats]);

  const ringColors = ['#f1f5f9', '#ef4444', '#f97316', '#eab308', '#10b981', '#2563eb'];
  const levelColors: Record<number, string> = {
    0: 'bg-slate-100 text-slate-400', 1: 'bg-red-500 text-white', 2: 'bg-orange-500 text-white',
    3: 'bg-yellow-500 text-white', 4: 'bg-emerald-500 text-white', 5: 'bg-blue-600 text-white',
  };

  const donutSectors = useMemo(() => {
    let cumulativePercent = 0;
    return [0, 1, 2, 3, 4, 5].map((lvl, i) => {
      const count = stats[lvl as keyof typeof stats];
      const percent = totalCardsCount > 0 ? (count / totalCardsCount) * 100 : 0;
      const startAngle = (cumulativePercent * 360) / 100;
      cumulativePercent += percent;
      const endAngle = (cumulativePercent * 360) / 100;
      const x1 = 50 + 40 * Math.cos((Math.PI * (startAngle - 90)) / 180);
      const y1 = 50 + 40 * Math.sin((Math.PI * (startAngle - 90)) / 180);
      const x2 = 50 + 40 * Math.cos((Math.PI * (endAngle - 90)) / 180);
      const y2 = 50 + 40 * Math.sin((Math.PI * (endAngle - 90)) / 180);
      const largeArcFlag = percent > 50 ? 1 : 0;
      return { 
        path: percent >= 99.9 ? "M 50 10 A 40 40 0 1 1 49.99 10" : `M ${x1} ${y1} A 40 40 0 ${largeArcFlag} 1 ${x2} ${y2}`,
        color: ringColors[i],
        percent
      };
    });
  }, [stats, totalCardsCount]);

  const handleCloudSync = async () => {
    const apiUrl = localStorage.getItem('anki_api_url');
    if (!apiUrl) return alert("Vui lòng nhập Script URL trong Setup.");
    
    setIsSyncing(true);
    try {
      const finalDataForState: any[] = [];
      const rowsForCloud: any[][] = [columns];

      data.forEach((row, idx) => {
        const id = row.id || `card-${idx}`;
        const newRowForState = { ...row };
        
        let newScore = row[currentUser || ''] || '0';
        // Ưu tiên sessionResults trước, rồi mới đến history chung
        if (sessionResults && sessionResults[id] !== undefined) {
          newScore = sessionResults[id].toString();
        } else if (history[id] !== undefined) {
          newScore = history[id].toString();
        }

        if (currentUser) {
          newRowForState[currentUser] = newScore;
        }
        finalDataForState.push(newRowForState);

        const cloudRow = columns.map(col => String(newRowForState[col] ?? ''));
        rowsForCloud.push(cloudRow);
      });

      if (onDataUpdate) onDataUpdate(finalDataForState);

      const payload = {
        action: 'sync',
        user: currentUser,
        data: rowsForCloud
      };

      await fetch(apiUrl, { 
        method: 'POST', 
        mode: 'no-cors', 
        body: JSON.stringify(payload) 
      });
      
      alert(`Đã lưu dữ liệu cho ${currentUser}.`);
    } catch (err) { 
      alert("Lỗi đồng bộ: " + err); 
    } finally { 
      setIsSyncing(false); 
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-4">
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-100 p-6 text-center">
           <div className="flex bg-white p-1 rounded-xl shadow-inner border border-slate-100 mb-6 inline-flex">
              {['session', 'overall', 'catalog'].map(t => (
                <button key={t} onClick={() => setActiveTab(t as any)} className={`px-4 py-2 rounded-lg text-[9px] font-black transition-all ${activeTab === t ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>
                  {t === 'session' ? 'PHIÊN HỌC VỪA QUA' : t === 'overall' ? 'TỔNG QUAN' : 'DANH MỤC'}
                </button>
              ))}
           </div>
           
           {activeTab !== 'catalog' && (
             <div className="flex flex-col md:flex-row items-center justify-center gap-8">
                <div className="relative w-40 h-40 flex items-center justify-center">
                  <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="#f1f5f9" strokeWidth="12" />
                    {donutSectors.map((s, i) => (
                      <path key={i} d={s.path} fill="transparent" stroke={s.color} strokeWidth="12" strokeLinecap="round" />
                    ))}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black text-slate-800">{totalCardsCount}</span>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Thẻ</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-left">
                  {[0,1,2,3,4,5].map(lvl => (
                    <div key={lvl} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ringColors[lvl] }} />
                      <span className="text-[9px] font-black text-slate-500 uppercase w-10">{lvl === 0 ? 'Mới' : `Level ${lvl}`}</span>
                      <span className="text-xs font-black text-slate-800">{stats[lvl as keyof typeof stats]}</span>
                    </div>
                  ))}
                </div>
             </div>
           )}
           {activeTab === 'session' && totalCardsCount === 0 && (
             <p className="mt-2 text-slate-400 font-bold italic text-xs">Bạn chưa đánh giá thẻ nào trong phiên này.</p>
           )}
        </div>

        <div className="p-6 space-y-6">
           {activeTab === 'catalog' ? (
             <WordCatalog flashcards={flashcards} allTags={allTags || []} />
           ) : (
             <>
               <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-md">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    </div>
                    <div>
                      <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Người học hiện tại</p>
                      <p className="font-black text-indigo-800 text-sm">{currentUser || 'Chưa chọn'}</p>
                    </div>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-3">
                 <button onClick={onBack} className="bg-indigo-600 text-white px-4 py-3 rounded-xl font-black shadow-lg uppercase text-[10px] tracking-widest active:scale-95 transition-all">Quay lại Trang chủ</button>
                 <button onClick={handleCloudSync} disabled={isSyncing} className="bg-amber-600 text-white px-4 py-3 rounded-xl font-black shadow-lg uppercase text-[10px] tracking-widest disabled:opacity-50 active:scale-95 transition-all">{isSyncing ? 'Đang gửi...' : `Lưu kết quả lên Cloud`}</button>
               </div>

               <div className="pt-6 border-t border-slate-100">
                 <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-widest">Chi tiết thẻ</h3>
                    <div className="flex flex-wrap justify-center gap-2">
                      <div className="flex bg-white p-0.5 rounded-lg border border-slate-200 shadow-sm">
                        {[0, 1, 2, 3, 4, 5].map(s => {
                          const isSelected = filterScores.includes(s);
                          return (
                            <button key={s} onClick={() => setFilterScores(prev => prev.includes(s) ? (prev.length > 1 ? prev.filter(x => x !== s) : prev) : [...prev, s].sort())} className={`w-7 h-7 rounded-md flex items-center justify-center text-[9px] font-black transition-all ${isSelected ? levelColors[s] : 'text-slate-300'}`}>{s}</button>
                          );
                        })}
                      </div>
                      <select className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-[9px] font-black uppercase tracking-widest focus:ring-2 ring-indigo-500 outline-none" value={filterTag} onChange={e => setFilterTag(e.target.value)}>
                        <option value="all">TẤT CẢ TAGS</option>
                        {allTags?.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                    {displayList.length > 0 ? displayList.map(card => {
                      const level = activeTab === 'session' ? (sessionResults?.[card.id] || 0) : (history[card.id] || 0);
                      return (
                        <div key={card.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-100 shadow-sm hover:border-indigo-100 transition-all group">
                          <div className="truncate pr-3 flex-1">
                            <p className="font-black text-slate-800 truncate text-base leading-tight">{card.frontData[0]?.text}</p>
                            <p className="text-[10px] text-slate-400 font-bold truncate mt-0.5">{card.backData[0]?.text}</p>
                          </div>
                          <div className="flex items-center gap-2">
                             <button onClick={() => onDelete?.(card.id)} className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity active:scale-90 shadow-sm">
                               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                             </button>
                             <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center font-black text-lg shadow-inner ${levelColors[level]}`}>{level}</div>
                          </div>
                        </div>
                      );
                    }) : (
                      <p className="col-span-2 text-center py-8 text-slate-300 font-bold uppercase tracking-widest text-[9px]">Không có dữ liệu phù hợp bộ lọc</p>
                    )}
                 </div>
               </div>
             </>
           )}
        </div>
      </div>
    </div>
  );
};

export default ReviewDashboard;
