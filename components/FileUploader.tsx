
import React, { useState, useEffect } from 'react';

const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRlS-duUx6pPcdWZ4AHz_GCzbN9uSzr45InZX6A9C10GOYEXo6mD-p7oXuthIYufEXLWDlact2_n96e/pub?output=csv';
const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzMBk5VoABJJLXWkPO60NuzC9PMYBSpGSvaEChYrfMUMl3BAYaKK2KSRF0f5eWmbRg2kQ/exec';

interface FileUploaderProps {
  onDataLoaded: (data: any[], columns: string[], sourceUrl?: string) => void;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onDataLoaded }) => {
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState(DEFAULT_SHEET_URL);
  const [apiUrl, setApiUrl] = useState(DEFAULT_SCRIPT_URL);
  const [error, setError] = useState('');

  useEffect(() => {
    const savedApi = localStorage.getItem('anki_api_url');
    const savedSheet = localStorage.getItem('anki_source_url');
    
    if (savedApi) setApiUrl(savedApi);
    else localStorage.setItem('anki_api_url', DEFAULT_SCRIPT_URL);

    if (savedSheet) setUrl(savedSheet);
    else setUrl(DEFAULT_SHEET_URL);
  }, []);

  const handleApiChange = (val: string) => {
    setApiUrl(val);
    localStorage.setItem('anki_api_url', val);
  };

  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) return { rows: [], headers: [] };
    
    const splitCSVLine = (line: string) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = splitCSVLine(lines[0]);
    const rows = lines.slice(1).map((line, rowIdx) => {
      const values = splitCSVLine(line);
      return headers.reduce((obj: any, header, index) => {
        obj[header] = values[index] || '';
        return obj;
      }, { id: `row-${rowIdx}` });
    });
    return { rows, headers };
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError('');
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const { rows, headers } = parseCSV(text);
        onDataLoaded(rows, headers);
      } catch (err) {
        setError('Lỗi khi đọc file. Vui lòng kiểm tra định dạng CSV.');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  const handleUrlSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError('');
    try {
      // Sử dụng fetch với cache: no-store để tránh lấy dữ liệu cũ
      const response = await fetch(url, { 
        method: 'GET',
        headers: { 'Accept': 'text/csv' }
      });
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const text = await response.text();
      const { rows, headers } = parseCSV(text);
      onDataLoaded(rows, headers, url);
      localStorage.setItem('anki_source_url', url);
    } catch (err) {
      console.error("Fetch error:", err);
      setError('Lỗi "Fail to fetch" thường do chính sách bảo mật (CORS). Hãy đảm bảo Google Sheet đã được "Xuất bản lên web" dưới dạng CSV.');
    } finally {
      setLoading(false);
    }
  };

  const resetToDefault = () => {
    setUrl(DEFAULT_SHEET_URL);
    setApiUrl(DEFAULT_SCRIPT_URL);
    localStorage.setItem('anki_api_url', DEFAULT_SCRIPT_URL);
    localStorage.setItem('anki_source_url', DEFAULT_SHEET_URL);
  };

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-100 p-5 rounded-3xl shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <label className="text-[10px] font-black text-amber-600 uppercase tracking-widest ml-1 block">Cấu hình Backend (Apps Script)</label>
          <button onClick={resetToDefault} className="text-[9px] font-bold text-amber-700 underline decoration-amber-300">Khôi phục mặc định</button>
        </div>
        <input
          type="url"
          placeholder="Dán Script URL (exec) vào đây..."
          value={apiUrl}
          onChange={(e) => handleApiChange(e.target.value)}
          className="w-full px-4 py-3 rounded-2xl bg-white border border-amber-200 focus:ring-2 ring-amber-500 font-medium text-xs outline-none transition-all shadow-inner"
        />
      </div>

      <form onSubmit={handleUrlSubmit} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl space-y-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Link Google Sheets (CSV Output)</label>
          <input
            type="url"
            placeholder="https://docs.google.com/spreadsheets/d/.../pub?output=csv"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:ring-2 ring-indigo-500 font-bold text-xs outline-none transition-all"
          />
        </div>
        <button 
          type="submit"
          disabled={loading || !url}
          className="w-full bg-indigo-600 text-white font-black py-3.5 rounded-xl shadow-xl shadow-indigo-100 disabled:opacity-50 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2 text-xs tracking-widest"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              Đang kết nối...
            </>
          ) : 'KẾT NỐI & ĐỒNG BỘ NGAY'}
        </button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-slate-200"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-slate-50 text-slate-400 font-black uppercase tracking-widest text-[9px]">Hoặc tải file từ máy tính</span>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-3xl bg-white hover:border-indigo-400 transition-all cursor-pointer relative group">
        <input
          type="file"
          accept=".csv,.txt"
          onChange={handleFileUpload}
          className="absolute inset-0 opacity-0 cursor-pointer z-10"
        />
        <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
          <svg className="w-5 h-5 text-slate-400 group-hover:text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <p className="text-xs font-black text-slate-600">Chọn file CSV cục bộ</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 text-[11px] font-bold rounded-2xl border border-red-100 text-center leading-relaxed">
          {error}
        </div>
      )}
    </div>
  );
};

export default FileUploader;
