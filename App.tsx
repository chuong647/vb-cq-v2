
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { extractDataFromPdf } from './services/geminiService';
import { DataTable } from './components/DataTable';
import { exportToExcel } from './utils/excelExport';
import { ExtractedDocument, ProcessingStatus, ExcelExportConfig, ThemeConfig } from './types';
import { 
  FileUp, FileSpreadsheet, Loader2, AlertCircle, Check, Copy, Settings, X, 
  UploadCloud, Cpu, Palette, Monitor, Printer, Info, RotateCcw
} from 'lucide-react';

const THEMES: ThemeConfig[] = [
  { id: 'blue', name: 'Xanh dương', primary: 'blue', gray: 'slate' },
  { id: 'emerald', name: 'Thiên nhiên', primary: 'emerald', gray: 'zinc' },
  { id: 'violet', name: 'Sáng tạo', primary: 'violet', gray: 'slate' },
  { id: 'rose', name: 'Nổi bật', primary: 'rose', gray: 'stone' },
  { id: 'amber', name: 'Mặc định', primary: 'amber', gray: 'neutral' },
];

const DEFAULT_BG_COLOR = '#F5FFFA';

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedDocument[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [showNotification, setShowNotification] = useState<{message: string, type: 'success' | 'info' | 'error'} | null>(null);
  
  const [showConfigPanel, setShowConfigPanel] = useState<boolean>(false);
  
  const [backgroundColor] = useState<string>(() => localStorage.getItem('app_bg_color') || DEFAULT_BG_COLOR);
  const [currentTheme, setCurrentTheme] = useState<ThemeConfig>(() => {
    const savedThemeId = localStorage.getItem('app_theme_id');
    if (savedThemeId) {
      const found = THEMES.find(t => t.id === savedThemeId);
      if (found) return found;
    }
    return THEMES[0];
  });

  const [excelConfig] = useState<ExcelExportConfig>({ fontName: 'Times New Roman', fontSize: 13, wrapText: true, allBorders: true });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const configPanelRef = useRef<HTMLDivElement>(null);
  
  const p = currentTheme.primary;
  const g = currentTheme.gray;

  useEffect(() => { localStorage.setItem('app_theme_id', currentTheme.id); }, [currentTheme]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (configPanelRef.current && !configPanelRef.current.contains(event.target as Node)) {
        setShowConfigPanel(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    let interval: any;
    if (status === ProcessingStatus.PROCESSING) {
      setProgress(0);
      interval = setInterval(() => {
        setProgress(prev => {
          if (file && file.size > 20 * 1024 * 1024) {
             return prev >= 95 ? 95 : prev + 0.15;
          }
          return prev >= 98 ? 98 : prev + (prev > 80 ? 0.3 : 1.5);
        });
      }, 500);
    } else if (status === ProcessingStatus.SUCCESS) {
      setProgress(100);
      notify("Bóc tách thành công!", "success");
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 500);
    }
    return () => clearInterval(interval);
  }, [status, file]);

  const notify = (message: string, type: 'success' | 'info' | 'error' = 'info') => {
    setShowNotification({ message, type });
    setTimeout(() => setShowNotification(null), 4000);
  };

  const handleExtract = async (pdfFile: File) => {
    setFile(pdfFile);
    setStatus(ProcessingStatus.PROCESSING);
    setErrorMessage('');
    setExtractedData([]);
    
    try {
      const data = await extractDataFromPdf(pdfFile);
      setExtractedData(data);
      setStatus(ProcessingStatus.SUCCESS);
    } catch (err: any) {
      console.error(err);
      setStatus(ProcessingStatus.ERROR);
      const msg = err.message || "Đã xảy ra lỗi trong quá trình xử lý.";
      setErrorMessage(msg);
      notify(msg, "error");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      handleExtract(selectedFile);
    } else if (selectedFile) {
      notify("Hệ thống chỉ hỗ trợ định dạng PDF.", "error");
    }
  };

  const handleExport = () => {
    if (extractedData.length === 0) return;
    exportToExcel(extractedData, `muc_luc_${file?.name.split('.')[0] || 'van_ban'}`, excelConfig);
    notify("Đã xuất file Excel thành công", "success");
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopy = async () => {
    if (extractedData.length === 0) return;
    const rows = extractedData.map(d => 
      `${d.symbol || ''}\t${d.date || ''}\t${d.docType} ${d.summary}\t${d.authority || ''}\t${d.pageRange || ''}`
    ).join('\n');
    
    try {
      await navigator.clipboard.writeText(rows);
      setCopySuccess(true);
      notify("Đã sao chép vào bộ nhớ tạm", "success");
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      notify("Lỗi khi sao chép", "error");
    }
  };

  const handleReset = () => {
    setExtractedData([]);
    setFile(null);
    setStatus(ProcessingStatus.IDLE);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    notify("Đã làm mới ứng dụng", "info");
  };

  return (
    <div 
      className="min-h-screen transition-all duration-700 ease-in-out pb-20"
      style={{ backgroundColor }}
    >
      <nav className="bg-white/80 backdrop-blur-lg sticky top-0 z-40 border-b border-slate-200/50 shadow-sm no-print">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 bg-${p}-500 text-white rounded-2xl shadow-lg shadow-${p}-500/20`}>
              <Cpu size={24} />
            </div>
            <div className="flex flex-col">
              <span className={`text-xl font-black text-${g}-900 tracking-tight leading-none`}>DocuExtract AI Pro</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Lưu trữ chuyên nghiệp v3.0</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleReset}
              className="group flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-slate-600 hover:bg-white hover:shadow-md transition-all active:scale-95"
            >
              <RotateCcw size={18} className="group-hover:rotate-[-45deg] transition-transform" /> 
              <span className="hidden sm:inline">Làm mới</span>
            </button>
            <div className="w-px h-6 bg-slate-200 hidden sm:block"></div>
            <button 
              onClick={() => setShowConfigPanel(!showConfigPanel)}
              className={`p-2.5 rounded-2xl transition-all active:scale-90 relative ${showConfigPanel ? `bg-${p}-100 text-${p}-600` : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >
              <Settings size={22} className={showConfigPanel ? 'animate-spin-slow' : ''} />
            </button>
          </div>
        </div>
      </nav>

      <motion.main 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="max-w-7xl mx-auto px-6 py-10 no-print"
      >
        <div className="space-y-12">
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-4 text-blue-800">
            <Info className="flex-shrink-0 mt-1" size={20} />
            <div className="text-sm">
              <p className="font-bold">Chế độ trích xuất an toàn:</p>
              <p>Hệ thống đang hoạt động với cấu hình <strong>"Không đảo văn bản"</strong>. AI sẽ giữ đúng thứ tự vật lý và văn phong hành chính gốc từ file PDF của bạn.</p>
            </div>
          </div>

          <div className="space-y-12">
            <div className="bg-white rounded-[3rem] shadow-2xl shadow-slate-200/50 border border-slate-100 p-8 sm:p-14 overflow-hidden relative group">
              <div className={`absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none text-${p}-500 transition-transform duration-1000 group-hover:scale-110`}>
                <UploadCloud size={400} strokeWidth={1} />
              </div>
              
              <div className="relative z-10">
                <div className="flex items-center gap-5 mb-12">
                  <div className={`p-5 bg-${p}-50 text-${p}-500 rounded-[2rem] shadow-inner`}>
                    <UploadCloud size={32} />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-slate-900 leading-tight">Trung tâm bóc tách</h3>
                    <p className="text-slate-500 font-medium text-lg">Giữ nguyên thứ tự và văn phong gốc</p>
                  </div>
                </div>

                <div 
                  className={`relative border-2 border-dashed rounded-[3rem] p-12 sm:p-24 transition-all cursor-pointer group/upload flex flex-col items-center justify-center ${
                    isDragging ? `border-${p}-500 bg-${p}-50/50 scale-[1.01] shadow-2xl` : `border-slate-200 hover:border-${p}-300 hover:bg-slate-50/20`
                  } ${status === ProcessingStatus.PROCESSING ? 'pointer-events-none opacity-60' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const droppedFile = e.dataTransfer.files[0];
                    if (droppedFile?.type === 'application/pdf') handleExtract(droppedFile);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input type="file" ref={fileInputRef} className="hidden" accept=".pdf" onChange={handleFileUpload} />
                  
                  <div className={`w-32 h-32 bg-${p}-50 text-${p}-500 rounded-full flex items-center justify-center mb-10 group-hover/upload:scale-110 transition-transform duration-700 shadow-xl shadow-${p}-500/10`}>
                    {status === ProcessingStatus.PROCESSING ? (
                      <Loader2 className="animate-spin" size={56} />
                    ) : (
                      <FileUp size={56} />
                    )}
                  </div>

                  <div className="text-center max-w-lg">
                    <p className="text-2xl font-black text-slate-800 mb-3">
                      {file && status !== ProcessingStatus.IDLE ? file.name : "Tải tệp PDF hồ sơ cần trích xuất"}
                    </p>
                    <p className="text-slate-400 font-medium text-lg leading-relaxed">
                      AI sẽ tự động nhận diện theo trình tự từ đầu đến cuối file.
                    </p>
                  </div>

                  {status === ProcessingStatus.PROCESSING && (
                    <div className="mt-16 w-full max-w-xl">
                      <div className="flex justify-between items-end mb-4">
                        <div className="flex flex-col">
                          <span className={`text-xs font-black text-${p}-600 uppercase tracking-[0.2em] mb-1`}>
                            Đang kết nối Gemini AI
                          </span>
                          <span className="text-slate-500 font-bold text-sm">
                            Đang bóc tách từng trang văn bản...
                          </span>
                        </div>
                        <span className={`text-3xl font-black text-${p}-600 tabular-nums`}>{Math.round(progress)}%</span>
                      </div>
                      <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner p-1">
                        <div 
                          className={`h-full bg-${p}-500 rounded-full transition-all duration-300 ease-out shadow-lg shadow-${p}-500/30`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div ref={resultsRef} className="space-y-12">
              {status === ProcessingStatus.ERROR && (
                <div className="bg-rose-50 rounded-[3rem] border border-rose-100 p-12 text-center animate-in zoom-in duration-500 relative overflow-hidden">
                  <div className="relative z-10">
                      <div className="w-20 h-20 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                        <AlertCircle size={40} />
                      </div>
                      <h4 className="text-2xl font-black text-rose-900">Có lỗi xảy ra</h4>
                      <p className="text-rose-600 mt-3 text-lg font-medium max-w-md mx-auto">{errorMessage}</p>
                      <button 
                        onClick={() => file && handleExtract(file)}
                        className="mt-8 px-10 py-4 bg-rose-500 text-white rounded-2xl font-black shadow-xl shadow-rose-500/20 hover:bg-rose-600 transition-all active:scale-95"
                      >
                        Thử lại ngay
                      </button>
                  </div>
                </div>
              )}

              {(status === ProcessingStatus.SUCCESS || extractedData.length > 0) && (
                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-10 duration-1000">
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8 px-4">
                    <div className="flex items-center gap-5">
                      <div className={`p-4 bg-${p}-100 text-${p}-600 rounded-[1.5rem]`}>
                        <Monitor size={28} />
                      </div>
                      <div>
                        <h3 className="text-3xl font-black text-slate-900 tracking-tight">Kết quả trích xuất</h3>
                        <p className="text-slate-500 font-bold mt-1 uppercase text-xs tracking-widest">
                          Tìm thấy {extractedData.length} văn bản hành chính
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
                      <button
                        onClick={handleCopy}
                        className={`flex-1 lg:flex-none flex items-center justify-center gap-3 px-6 py-4 rounded-[1.5rem] font-black transition-all shadow-xl active:scale-95 ${
                          copySuccess 
                            ? 'bg-green-500 text-white shadow-green-500/20' 
                            : `bg-white text-slate-600 border border-slate-100 hover:bg-slate-50 shadow-slate-200/50`
                        }`}
                      >
                        {copySuccess ? <Check size={20} strokeWidth={3} /> : <Copy size={20} />}
                        <span className="hidden sm:inline">{copySuccess ? 'Đã sao chép' : 'Sao chép'}</span>
                      </button>
                      <button
                        onClick={handlePrint}
                        className="flex-1 lg:flex-none flex items-center justify-center gap-3 px-6 py-4 bg-slate-800 text-white rounded-[1.5rem] font-black shadow-xl shadow-slate-900/10 hover:bg-black transition-all active:scale-95"
                      >
                        <Printer size={20} /> <span className="hidden sm:inline">In mục lục</span>
                      </button>
                      <button
                        onClick={handleExport}
                        className="flex-1 lg:flex-none flex items-center justify-center gap-3 px-8 py-4 bg-emerald-500 text-white rounded-[1.5rem] font-black shadow-xl shadow-emerald-500/20 hover:bg-emerald-600 hover:-translate-y-1 transition-all active:scale-95"
                      >
                        <FileSpreadsheet size={20} /> Xuất Excel
                      </button>
                    </div>
                  </div>
                  <DataTable data={extractedData} theme={currentTheme} />
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.main>

      <footer className="max-w-7xl mx-auto px-6 py-10 border-t border-slate-200/50 text-center no-print">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 opacity-50">
            <Cpu size={16} />
            <span className="text-xs font-black uppercase tracking-widest">DocuExtract AI Pro</span>
          </div>
          <p className="text-slate-400 text-sm font-medium">
            © 2026 DocuExtract AI Pro. Hệ thống bóc tách văn bản hành chính thông minh.
          </p>
        </div>
      </footer>

      {/* Printable Area - Only visible when printing */}
      <div className="hidden print:block p-10 bg-white min-h-screen">
        <h1 className="text-2xl font-bold text-center mb-8 uppercase">Mục lục văn bản hồ sơ</h1>
        <DataTable data={extractedData} theme={currentTheme} />
      </div>

      <div className={`fixed inset-y-0 right-0 w-80 bg-white/95 backdrop-blur-2xl shadow-2xl z-[55] transform transition-transform duration-500 ease-out border-l border-slate-100 no-print ${showConfigPanel ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="h-full flex flex-col p-8">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-3">
              <div className={`p-2 bg-${p}-100 text-${p}-600 rounded-xl`}>
                <Palette size={20} />
              </div>
              <h4 className="text-xl font-black text-slate-900 tracking-tight">Giao diện</h4>
            </div>
            <button onClick={() => setShowConfigPanel(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20} /></button>
          </div>

          <div className="flex-1 space-y-10 overflow-y-auto pr-2 custom-scrollbar">
            <section>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-5">Chủ đề màu sắc</p>
              <div className="grid grid-cols-5 gap-3">
                {THEMES.map(t => (
                  <button key={t.id} onClick={() => setCurrentTheme(t)} className={`aspect-square rounded-2xl border-2 transition-all ${currentTheme.id === t.id ? 'border-slate-900 ring-4 ring-slate-100' : 'border-transparent shadow-sm'}`} style={{ backgroundColor: t.primary === 'blue' ? '#3B82F6' : t.primary === 'emerald' ? '#10B981' : t.primary === 'violet' ? '#8B5CF6' : t.primary === 'rose' ? '#F43F5E' : '#F59E0B' }} />
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>

      {showNotification && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-10 no-print">
          <div className={`px-10 py-4 rounded-[2rem] shadow-2xl font-black text-white flex items-center gap-4 ${showNotification.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
            {showNotification.type === 'success' ? <Check size={20} /> : <AlertCircle size={20} />}
            <span>{showNotification.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
