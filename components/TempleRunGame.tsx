
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Timer, ArrowLeft, Trophy, XCircle, CheckCircle2, Volume2 } from 'lucide-react';
import { Flashcard } from '../types';

interface TempleRunGameProps {
  flashcards: Flashcard[];
  onBack: () => void;
  voiceName?: string;
  lang?: string;
}

interface GameQuestion {
  card: Flashcard;
  options: { text: string; isCorrect: boolean }[];
  startTime: number;
}

const TempleRunGame: React.FC<TempleRunGameProps> = ({ flashcards, onBack, voiceName, lang = 'zh-CN' }) => {
  const [gameState, setGameState] = useState<'countdown' | 'playing' | 'gameover' | 'victory'>('countdown');
  const [countdown, setCountdown] = useState(3);
  const [hearts, setHearts] = useState(10);
  const [score, setScore] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<GameQuestion | null>(null);
  const [timeLeft, setTimeLeft] = useState(7);
  const [playerLane, setPlayerLane] = useState<'left' | 'right' | 'center'>('center');
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  // Initialize voices
  useEffect(() => {
    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  const speak = useCallback((text: string) => {
    if (!text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    if (voiceName) {
      const voice = voicesRef.current.find(v => v.voiceURI === voiceName);
      if (voice) utterance.voice = voice;
    }
    
    if (!utterance.voice) {
       utterance.lang = lang;
    }
    window.speechSynthesis.speak(utterance);
  }, [voiceName, lang]);

  // Countdown logic
  useEffect(() => {
    if (gameState !== 'countdown') return;
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setGameState('playing');
      generateQuestion(0);
    }
  }, [gameState, countdown]);

  const generateQuestion = useCallback((index: number) => {
    if (index >= flashcards.length) {
      setGameState('victory');
      return;
    }

    const card = flashcards[index];
    const correctText = card.backData.map(d => d.text).filter(Boolean).join('\n');
    
    let wrongCardIndex = Math.floor(Math.random() * flashcards.length);
    while (wrongCardIndex === index && flashcards.length > 1) {
      wrongCardIndex = Math.floor(Math.random() * flashcards.length);
    }
    const wrongText = flashcards[wrongCardIndex].backData.map(d => d.text).filter(Boolean).join('\n');

    const options = [
      { text: correctText, isCorrect: true },
      { text: wrongText, isCorrect: false }
    ].sort(() => Math.random() - 0.5);

    setCurrentQuestion({
      card,
      options,
      startTime: Date.now()
    });
    setTimeLeft(7);
    setPlayerLane('center');
    setFeedback(null);
    
    const frontText = card.frontData[0]?.text || '';
    speak(frontText);
  }, [flashcards, speak]);

  const handleAnswer = useCallback((isCorrect: boolean) => {
    if (feedback || gameState !== 'playing') return;

    if (isCorrect) {
      setScore(s => s + 1);
      setFeedback('correct');
    } else {
      setHearts(h => h - 1);
      setFeedback('wrong');
      if (hearts <= 1) {
        setGameState('gameover');
      }
    }

    setTimeout(() => {
      if (gameState === 'playing' || gameState === 'countdown') {
        setCurrentIndex(i => {
          const next = i + 1;
          generateQuestion(next);
          return next;
        });
      }
    }, 500);
  }, [feedback, hearts, generateQuestion, gameState]);

  // Timer loop
  useEffect(() => {
    if (gameState !== 'playing' || !currentQuestion || feedback) return;

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 0.1) {
          handleAnswer(false);
          return 0;
        }
        return prev - 0.1;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [gameState, currentQuestion, feedback, handleAnswer]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'playing' || feedback) return;
      if (e.key === 'ArrowLeft') {
        setPlayerLane('left');
        const leftOption = currentQuestion?.options[0];
        if (leftOption) handleAnswer(leftOption.isCorrect);
      } else if (e.key === 'ArrowRight') {
        setPlayerLane('right');
        const rightOption = currentQuestion?.options[1];
        if (rightOption) handleAnswer(rightOption.isCorrect);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, feedback, currentQuestion, handleAnswer]);

  if (gameState === 'countdown') {
    return (
      <div className="relative w-full h-[80vh] flex items-center justify-center bg-slate-900 rounded-[3rem] overflow-hidden">
        <motion.div 
          key={countdown}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1.5, opacity: 1 }}
          exit={{ scale: 3, opacity: 0 }}
          className="text-9xl font-black text-white italic tracking-tighter"
        >
          {countdown > 0 ? countdown : 'GO!'}
        </motion.div>
      </div>
    );
  }

  if (gameState === 'gameover') {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-center p-6">
        <XCircle className="w-24 h-24 text-red-500 mb-4" />
        <h2 className="text-4xl font-black text-slate-800 mb-2 uppercase tracking-tighter">Game Over</h2>
        <p className="text-slate-500 mb-8 font-medium">Bạn đã hết trái tim! Đừng bỏ cuộc nhé.</p>
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-200 mb-8 w-full max-w-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Điểm số của bạn</p>
          <p className="text-6xl font-black text-indigo-600">{score}</p>
        </div>
        <button 
          onClick={onBack}
          className="bg-indigo-600 text-white font-black py-4 px-12 rounded-2xl shadow-lg hover:scale-105 transition-transform uppercase tracking-widest text-sm"
        >
          Quay lại
        </button>
      </div>
    );
  }

  if (gameState === 'victory') {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-center p-6">
        <Trophy className="w-24 h-24 text-yellow-500 mb-4 animate-bounce" />
        <h2 className="text-4xl font-black text-slate-800 mb-2 uppercase tracking-tighter">Chiến Thắng!</h2>
        <p className="text-slate-500 mb-8 font-medium">Bạn đã hoàn thành tất cả từ vựng.</p>
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-200 mb-8 w-full max-w-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Điểm số cuối cùng</p>
          <p className="text-6xl font-black text-indigo-600">{score}</p>
        </div>
        <button 
          onClick={onBack}
          className="bg-indigo-600 text-white font-black py-4 px-12 rounded-2xl shadow-lg hover:scale-105 transition-transform uppercase tracking-widest text-sm"
        >
          Quay lại
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[75vh] min-h-[500px] max-h-[850px] overflow-hidden bg-gradient-to-b from-sky-900 via-indigo-900 to-slate-900 rounded-3xl md:rounded-[3rem] shadow-2xl border-4 md:border-8 border-slate-800">
      {/* Background Scenery */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Distant Mountains */}
        <div className="absolute bottom-1/2 left-0 right-0 h-32 flex items-end justify-around opacity-20">
          {[1, 2, 3].map(i => (
            <div key={i} className="w-64 h-64 bg-slate-700 rounded-full blur-3xl transform translate-y-32" />
          ))}
        </div>
        
        {/* Moving Trees/Objects on sides - Simplified for performance */}
        <div className="absolute inset-0 flex justify-between px-2">
          <div className="w-20 h-full relative overflow-hidden">
            {[1, 2].map(i => (
              <motion.div 
                key={i}
                animate={{ y: [1000, -200] }}
                transition={{ repeat: Infinity, duration: 2.5, delay: i * 1, ease: "linear" }}
                className="absolute w-8 h-8 bg-emerald-800/30 rounded-full blur-lg will-change-transform"
                style={{ left: '20%' }}
              />
            ))}
          </div>
          <div className="w-20 h-full relative overflow-hidden">
            {[1, 2].map(i => (
              <motion.div 
                key={i}
                animate={{ y: [1000, -200] }}
                transition={{ repeat: Infinity, duration: 2.5, delay: i * 1, ease: "linear" }}
                className="absolute w-8 h-8 bg-emerald-800/30 rounded-full blur-lg will-change-transform"
                style={{ right: '20%' }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Background/Road Perspective */}
      <div className="absolute inset-0 perspective-1000 overflow-hidden">
        <div className="absolute inset-0 flex justify-center">
          {/* The Road */}
          <div 
            className="w-[1000px] h-[3000px] bg-slate-800 origin-bottom transform rotateX-75 -translate-y-[1800px] relative will-change-transform"
            style={{
              backgroundImage: `
                linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.05) 50%, transparent 100%), 
                repeating-linear-gradient(0deg, transparent, transparent 95px, rgba(255,255,255,0.1) 100%),
                linear-gradient(90deg, transparent 33%, rgba(255,255,255,0.05) 33.5%, rgba(255,255,255,0.05) 34%, transparent 34.5%, transparent 66%, rgba(255,255,255,0.05) 66.5%, rgba(255,255,255,0.05) 67%, transparent 67.5%)
              `,
              backgroundSize: '100% 100px, 100% 100px, 100% 100%',
              animation: 'roadScroll 0.8s linear infinite'
            }}
          >
            {/* Lane Dividers (Glowing) */}
            <div className="absolute left-1/3 top-0 bottom-0 w-1 bg-indigo-500/10 blur-[1px]" />
            <div className="absolute right-1/3 top-0 bottom-0 w-1 bg-indigo-500/10 blur-[1px]" />
            
            {/* Speed Lines - Reduced for performance */}
            <div className="absolute inset-0 overflow-hidden">
               {[1,2,3].map(i => (
                 <motion.div 
                   key={i}
                   animate={{ y: [0, 3000] }}
                   transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.2, ease: "linear" }}
                   className="absolute w-1 h-20 bg-white/5 will-change-transform"
                   style={{ left: `${20 + i * 20}%` }}
                 />
               ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes roadScroll {
          from { background-position: 0 0, 0 0, 0 0; }
          to { background-position: 0 100px, 0 100px, 0 0; }
        }
        .rotateX-75 { transform: rotateX(75deg); }
      `}</style>

      {/* UI Overlay */}
      <div className="absolute inset-0 z-10 flex flex-col pointer-events-none">
        {/* Top Bar */}
        <div className="p-4 md:p-6 flex justify-between items-start w-full">
          <div className="flex flex-wrap gap-1 max-w-[150px] md:max-w-[200px]">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i}>
                <Heart 
                  className={`w-4 h-4 md:w-5 md:h-5 ${i < hearts ? 'text-red-500 fill-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'text-slate-700 opacity-30'}`} 
                />
              </div>
            ))}
          </div>
          <div className="flex flex-col items-end gap-2 md:gap-3">
            <div className="flex items-center gap-2 md:gap-3 bg-black/60 backdrop-blur-xl px-3 md:px-5 py-1.5 md:py-2.5 rounded-full border border-white/20 shadow-2xl">
              <Timer className="w-4 h-4 md:w-5 md:h-5 text-indigo-400" />
              <div className="w-24 md:w-40 h-2 md:h-2.5 bg-slate-800 rounded-full overflow-hidden border border-white/5">
                <motion.div 
                  className="h-full bg-gradient-to-r from-indigo-500 to-violet-500"
                  animate={{ width: `${(timeLeft / 7) * 100}%` }}
                  transition={{ duration: 0.1 }}
                />
              </div>
            </div>
            <div className="bg-black/60 backdrop-blur-xl px-4 md:px-6 py-1.5 md:py-2.5 rounded-full border border-white/20 shadow-2xl">
              <span className="text-white font-black text-xs md:text-base tracking-[0.2em] italic">SCORE: {score}</span>
            </div>
          </div>
        </div>

        {/* Question Area */}
        <div className="flex-1 flex flex-col items-center justify-start pt-4 md:pt-8 px-4">
          <AnimatePresence mode="wait">
            {currentQuestion && (
              <motion.div 
                key={currentQuestion.card.id}
                initial={{ y: -50, opacity: 0, scale: 0.8 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 50, opacity: 0, scale: 1.2 }}
                className="bg-white/10 backdrop-blur-2xl p-6 md:p-10 rounded-3xl md:rounded-[3rem] shadow-[0_0_50px_rgba(99,102,241,0.3)] border-2 border-white/20 flex flex-col items-center gap-4 md:gap-6 w-full max-w-[350px] md:min-w-[350px]"
              >
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="p-2 md:p-3 bg-indigo-500 rounded-xl md:rounded-2xl shadow-lg shadow-indigo-500/50">
                    <Volume2 className="w-6 h-6 md:w-8 md:h-8 text-white" />
                  </div>
                  <div className="flex flex-col items-center">
                    {currentQuestion.card.frontData.map((d, idx) => (
                      <h3 key={idx} className={`${idx === 0 ? 'text-3xl md:text-6xl' : 'text-xl md:text-3xl opacity-70'} font-black text-white tracking-tighter drop-shadow-lg text-center break-words`}>
                        {d.text}
                      </h3>
                    ))}
                  </div>
                </div>
                <div className="px-4 py-1.5 bg-white/10 rounded-full border border-white/10">
                  <p className="text-[8px] md:text-[10px] font-black text-indigo-300 uppercase tracking-[0.3em] md:tracking-[0.5em]">CHỌN NGHĨA ĐÚNG</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Gates / Options */}
        <div className="h-48 md:h-72 flex justify-between items-end p-4 md:p-12 gap-4 md:gap-12">
          {currentQuestion?.options.map((option, i) => (
            <motion.button
              key={i}
              onClick={() => {
                setPlayerLane(i === 0 ? 'left' : 'right');
                handleAnswer(option.isCorrect);
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              className={`pointer-events-auto flex-1 h-32 md:h-40 rounded-2xl md:rounded-[2.5rem] border-2 md:border-4 flex items-center justify-center p-4 md:p-8 text-center transition-all shadow-xl relative overflow-hidden group ${
                i === 0 
                ? 'bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 border-indigo-400/50' 
                : 'bg-gradient-to-br from-violet-600 via-violet-700 to-violet-900 border-violet-400/50'
              }`}
            >
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex flex-col items-center gap-1 relative z-10">
                {option.text.split('\n').map((line, idx) => (
                  <span key={idx} className={`text-white font-black leading-tight drop-shadow-md ${idx === 0 ? 'text-lg md:text-2xl' : 'text-[10px] md:text-[12px] opacity-70'}`}>
                    {line}
                  </span>
                ))}
              </div>
              
              {/* Lane Indicator */}
              <div className={`absolute bottom-2 md:bottom-4 ${i === 0 ? 'left-3 md:left-6' : 'right-3 md:right-6'} opacity-30`}>
                <ArrowLeft className={`w-4 h-4 md:w-6 md:h-6 text-white ${i === 1 ? 'rotate-180' : ''}`} />
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Player Character */}
      <div className="absolute bottom-24 md:bottom-32 left-1/2 -translate-x-1/2 z-20 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] will-change-transform"
           style={{ transform: `translateX(${playerLane === 'left' ? '-150%' : playerLane === 'right' ? '50%' : '-50%'})` }}>
        <motion.div 
          animate={{ 
            y: [0, -10, 0],
          }}
          transition={{ repeat: Infinity, duration: 0.4 }}
          className="w-12 h-16 md:w-20 md:h-28 bg-gradient-to-b from-indigo-400 to-indigo-600 rounded-2xl md:rounded-3xl shadow-2xl border-2 md:border-4 border-white/30 relative"
        >
          {/* Head */}
          <div className="absolute -top-4 md:-top-6 left-1/2 -translate-x-1/2 w-6 h-6 md:w-10 md:h-10 bg-indigo-300 rounded-full border-2 md:border-4 border-white/30 shadow-inner" />
          
          {/* Shadow below */}
          <div className="absolute -bottom-8 md:-bottom-12 left-1/2 -translate-x-1/2 w-10 md:w-16 h-2 md:h-4 bg-black/40 blur-md rounded-full" />
        </motion.div>
        
        {/* Feedback Icons */}
        <AnimatePresence>
          {feedback && (
            <motion.div 
              initial={{ scale: 0, opacity: 0, y: 0 }}
              animate={{ scale: 1.5, opacity: 1, y: -100 }}
              exit={{ opacity: 0 }}
              className="absolute -top-16 md:-top-24 left-1/2 -translate-x-1/2"
            >
              {feedback === 'correct' ? (
                <CheckCircle2 className="w-12 h-12 md:w-16 md:h-16 text-emerald-400 fill-emerald-400/20 drop-shadow-[0_0_15px_rgba(52,211,153,0.8)]" />
              ) : (
                <XCircle className="w-12 h-12 md:w-16 md:h-16 text-red-500 fill-red-500/20 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]" />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controls Help */}
      <div className="absolute bottom-4 md:bottom-8 left-1/2 -translate-x-1/2 text-white/30 text-[8px] md:text-[11px] font-black uppercase tracking-[0.3em] md:tracking-[0.4em] flex items-center gap-2 md:gap-4">
        <div className="px-1.5 py-0.5 border border-white/20 rounded">←</div>
        <span>DI CHUYỂN</span>
        <div className="px-1.5 py-0.5 border border-white/20 rounded">→</div>
      </div>
    </div>
  );
};

export default TempleRunGame;
