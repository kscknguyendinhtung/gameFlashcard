
import React, { useState, useRef, useEffect } from 'react';
import { Flashcard, CardConfig, StudyMode } from '../types';

interface FlashcardViewProps {
  card: Flashcard;
  config: CardConfig & { voiceFront?: string; voiceBack?: string; isAutoFlip?: boolean };
  mode: StudyMode;
  onRate: (difficulty: number) => void;
  onPrev?: () => void;
  onNext?: () => void;
  onDelete?: (cardId: string) => void;
  onStop?: () => void;
  onUpdateData?: (cardId: string, fields: Record<string, string>) => void;
  currentIndex: number;
  totalCards: number;
}

const FlashcardView: React.FC<FlashcardViewProps> = ({ 
  card, 
  config, 
  onRate, 
  onPrev, 
  onNext,
  onDelete,
  onStop,
  onUpdateData,
  currentIndex,
  totalCards 
}) => {
  const [flipped, setFlipped] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [statusText, setStatusText] = useState<string>('Bắt đầu...');
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  const timerRef = useRef<number | null>(null);
  const isTransitioningRef = useRef<boolean>(false);
  const synth = window.speechSynthesis;

  const waitTime = (config.flipSpeed || 2) * 1000;

  useEffect(() => {
    const initialFields: Record<string, string> = {};
    [...card.frontData, ...card.backData].forEach(d => {
      if (d.columnName) initialFields[d.columnName] = d.text;
    });
    setEditValues(initialFields);
  }, [card]);

  const speakWithBrowser = (text: string, langCode: string, voiceURI?: string): Promise<void> => {
    return new Promise((resolve) => {
      synth.cancel(); 
      if (!text || isPaused || isEditing) {
        resolve();
        return;
      }

      setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(text);
        const voices = synth.getVoices();
        
        let voice = voices.find(v => v.voiceURI === voiceURI);
        if (!voice) {
          voice = voices.find(v => v.lang === langCode);
        }
        if (!voice) {
          const langPrefix = langCode.split('-')[0];
          voice = voices.find(v => v.lang.startsWith(langPrefix));
        }
        
        if (voice) {
          utterance.voice = voice;
        } else {
          utterance.lang = langCode;
        }

        utterance.rate = 1.0;
        utterance.onend = () => resolve();
        utterance.onerror = (e) => {
          console.error("TTS Error:", e);
          resolve();
        };
        
        synth.speak(utterance);
      }, 50);
    });
  };

  const handleManualSpeak = (e: React.MouseEvent, text: string, lang: string, side: 'front' | 'back') => {
    e.stopPropagation();
    const voiceToUse = side === 'front' ? config.voiceFront : config.voiceBack;
    speakWithBrowser(text, lang, voiceToUse);
  };

  const handleManualRate = (lvl: number) => {
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;
    setIsTransitioning(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    synth.cancel();
    onRate(lvl);
  };

  const startBackSideSequence = async () => {
    if (isPaused || isEditing || isTransitioningRef.current) return;
    
    const firstLine = card.backData[0];
    if (firstLine) {
      setStatusText(`Đọc mặt sau...`);
      await speakWithBrowser(firstLine.text, firstLine.lang, config.voiceBack);
    }
    
    if (isTransitioningRef.current || isPaused || isEditing) return;
    
    if (config.isAutoFlip) {
      setStatusText(`Chờ chuyển (${waitTime/1000}s)...`);
      timerRef.current = window.setTimeout(() => {
        if (!isTransitioningRef.current && !isPaused && !isEditing) {
          handleManualRate(0); 
        }
      }, waitTime);
    } else {
      setStatusText('Bấm lật hoặc chọn Level');
    }
  };

  const runAutoCycle = async () => {
    if (isPaused || isEditing || isTransitioningRef.current) return;
    
    const firstLine = card.frontData[0];
    if (firstLine) {
      setStatusText(`Đọc mặt trước...`);
      await speakWithBrowser(firstLine.text, firstLine.lang, config.voiceFront);
    }
    
    if (isTransitioningRef.current || isPaused || isEditing) return;
    
    if (config.isAutoFlip) {
      setStatusText(`Chờ lật (${waitTime/1000}s)...`);
      timerRef.current = window.setTimeout(() => {
        if (isTransitioningRef.current || isPaused || isEditing) return;
        setFlipped(true);
        startBackSideSequence();
      }, waitTime); 
    } else {
      setStatusText('Bấm lật để xem đáp án');
    }
  };

  const handleFlipManual = () => {
    if (isPaused || isEditing || isTransitioning) return;
    
    // Hủy bỏ mọi tiến trình tự động đang chạy khi lật thủ công
    if (timerRef.current) clearTimeout(timerRef.current);
    synth.cancel();
    
    const newFlipped = !flipped;
    setFlipped(newFlipped);
    
    // Nếu lật thủ công, chúng ta dừng luôn tiến trình auto-flip để người dùng tự điều khiển
    if (newFlipped) {
      setStatusText('Mặt sau (Thủ công)');
      const firstLine = card.backData[0];
      if (firstLine) speakWithBrowser(firstLine.text, firstLine.lang, config.voiceBack);
    } else {
      setStatusText('Mặt trước (Thủ công)');
      const firstLine = card.frontData[0];
      if (firstLine) speakWithBrowser(firstLine.text, firstLine.lang, config.voiceFront);
    }
  };

  const togglePause = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const nextPause = !isPaused;
    setIsPaused(nextPause);

    if (nextPause) {
      if (timerRef.current) clearTimeout(timerRef.current);
      synth.cancel();
      setStatusText('ĐÃ TẠM DỪNG');
    } else {
      if (!flipped) runAutoCycle(); else startBackSideSequence();
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) onDelete(card.id);
  };

  useEffect(() => {
    isTransitioningRef.current = false;
    setIsTransitioning(false);
    setFlipped(false);
    setIsPaused(false);
    setIsEditing(false);
    runAutoCycle();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      synth.cancel();
    };
  }, [card.id]);

  const renderCardData = (dataArray: any[]) => {
    return dataArray.map((d, i) => {
      let textClass = "";
      if (i === 0) {
        textClass = "text-4xl text-slate-800 font-black";
      } else if (i === 1) {
        textClass = "text-3xl text-slate-700 font-bold mt-1"; 
      } else {
        textClass = "text-xs text-slate-400 font-medium mt-0.5"; 
      }
      return (
        <p key={i} className={`break-words w-full px-2 ${textClass}`}>
          {d.text}
        </p>
      );
    });
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-6">
      <div className="flex justify-between items-center px-1">
        <button onClick={onPrev} disabled={currentIndex === 0 || isTransitioning} className="p-4 bg-white border border-slate-200 rounded-2xl text-slate-400 disabled:opacity-20 active:scale-90 shadow-sm"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg></button>
        <div className="flex items-center gap-3">
          <button onClick={handleDelete} title="Xóa thẻ" className="w-12 h-12 rounded-xl bg-white text-red-400 border-2 border-slate-100 flex items-center justify-center shadow-md active:scale-90 hover:text-red-600 transition-colors"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
          <button onClick={() => { setIsEditing(true); synth.cancel(); if (timerRef.current) clearTimeout(timerRef.current); setStatusText('ĐANG CHỈNH SỬA'); }} title="Sửa nội dung" className="w-12 h-12 rounded-xl bg-white text-slate-400 border-2 border-slate-100 flex items-center justify-center shadow-md active:scale-90"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg></button>
          <button onClick={togglePause} title={isPaused ? "Tiếp tục" : "Tạm dừng"} className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all shadow-md active:scale-90 ${isPaused ? 'bg-amber-500 text-white ring-4 ring-amber-100' : 'bg-white text-slate-400 border-2 border-slate-100'}`}>{isPaused ? <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg> : <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>}</button>
          <button onClick={onStop} title="Dừng học" className="w-12 h-12 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-100 active:scale-90 transition-all">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <button onClick={onNext} disabled={currentIndex === totalCards - 1 || isTransitioning} className="p-4 bg-white border border-slate-200 rounded-2xl text-slate-400 disabled:opacity-20 active:scale-90 shadow-sm"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg></button>
      </div>

      <div className="flex justify-center"><div className={`px-6 py-1.5 rounded-full text-[10px] font-black uppercase transition-all shadow-md ${isPaused || isEditing ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-white text-indigo-600 border-indigo-100'}`}>{statusText}</div></div>

      <div className="relative w-full h-[380px] perspective-1000 cursor-pointer" onClick={handleFlipManual}>
        <div className={`relative w-full h-full transition-all duration-700 preserve-3d ${flipped ? 'rotate-y-180' : ''}`}>
          {(isPaused || isEditing) && <div className="absolute inset-0 z-50 bg-white/40 backdrop-blur-[2px] rounded-3xl flex items-center justify-center"></div>}
          
          <div className="absolute inset-0 backface-hidden bg-white rounded-3xl border border-slate-100 p-8 flex flex-col items-center justify-center shadow-2xl text-center">
            <button onClick={(e) => handleManualSpeak(e, card.frontData[0]?.text, card.frontData[0]?.lang, 'front')} className="absolute top-6 right-6 p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/></svg></button>
            <span className="text-[9px] font-black uppercase text-slate-300 mb-6 tracking-widest text-center">Mặt Trước</span>
            {renderCardData(card.frontData)}
            {!config.isAutoFlip && !flipped && <div className="mt-6 px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[9px] font-black animate-pulse uppercase tracking-widest">Bấm để lật</div>}
          </div>
          
          <div className="absolute inset-0 backface-hidden bg-white rounded-3xl border border-slate-100 p-8 flex flex-col items-center justify-center shadow-2xl rotate-y-180 text-center">
            <button onClick={(e) => handleManualSpeak(e, card.backData[0]?.text, card.backData[0]?.lang, 'back')} className="absolute top-6 left-6 p-3 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/></svg></button>
            <span className="text-[9px] font-black uppercase text-indigo-300 mb-6 tracking-widest text-center">Mặt Sau</span>
            {renderCardData(card.backData)}
            {!config.isAutoFlip && flipped && <div className="mt-6 px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black animate-pulse uppercase tracking-widest">Chọn mức độ để qua thẻ</div>}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
        <div className="flex gap-2">
          {[0, 1, 2, 3, 4, 5].map((lvl) => (
            <button key={lvl} disabled={isTransitioning || isPaused || isEditing} onClick={() => handleManualRate(lvl)} className={`flex-1 py-4 rounded-2xl font-black text-xl transition-all active:scale-90 shadow-sm ${lvl === 0 ? 'bg-slate-50 text-slate-400' : lvl === 1 ? 'bg-red-50 text-red-500' : lvl === 5 ? 'bg-blue-50 text-blue-500' : 'bg-indigo-50 text-indigo-600'}`}>{lvl}</button>
          ))}
        </div>
      </div>

      {isEditing && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
          <div className="bg-white w-full max-w-lg rounded-[3rem] p-8 shadow-2xl">
            <h3 className="text-xl font-black mb-6 uppercase tracking-tight">Sửa nội dung thẻ</h3>
            <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
              {Object.keys(editValues).map(col => (
                <div key={col} className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{col}</label>
                  <textarea value={editValues[col]} onChange={e => setEditValues({...editValues, [col]: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold text-slate-700 outline-none" rows={2} />
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-8">
              <button onClick={() => { setIsEditing(false); if (!flipped) runAutoCycle(); else startBackSideSequence(); }} className="flex-1 py-4 bg-slate-100 text-slate-400 rounded-2xl font-black uppercase text-xs tracking-widest">Đóng</button>
              <button onClick={() => { onUpdateData?.(card.id, editValues); setIsEditing(false); if (!flipped) runAutoCycle(); else startBackSideSequence(); }} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl">Cập Nhật</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FlashcardView;
