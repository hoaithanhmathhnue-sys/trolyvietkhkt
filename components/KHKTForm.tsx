import React, { useState, useRef, useEffect } from 'react';
import { UserInfo } from '../types';
import { Button } from './Button';
import { InputWithHistory, TextareaWithHistory } from './InputWithHistory';
import { saveFormToHistory } from '../services/inputHistory';
import { KHKT_FIELDS, FIELD_GROUPS, KHKT_LEVELS, RESEARCH_METHODS } from '../data/khktKnowledge';
import { BookOpen, School, GraduationCap, PenTool, MapPin, Calendar, Users, Target, FileUp, Sparkles, Loader2, FileText, Search, X, ChevronDown, Beaker, FlaskConical, Lightbulb } from 'lucide-react';
import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

interface Props {
  userInfo: UserInfo;
  onChange: (field: keyof UserInfo, value: string) => void;
  onSubmit: () => void;
  onManualSubmit: (content: string) => void;
  isSubmitting: boolean;
  apiKey?: string;
  selectedModel?: string;
}

const InputGroup: React.FC<{ label: string; icon: any; required?: boolean; children: React.ReactNode }> = ({ label, icon: Icon, required, children }) => (
  <div className="w-full">
    <label className="block text-sm font-semibold text-gray-900 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <div className="relative rounded-md shadow-sm">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Icon className="h-5 w-5 text-gray-400" />
      </div>
      {children}
    </div>
  </div>
);

const MAX_FILE_SIZE = 100 * 1024 * 1024;

export const KHKTForm: React.FC<Props> = ({ userInfo, onChange, onSubmit, onManualSubmit, isSubmitting }) => {
  const [mode, setMode] = useState<'ai' | 'manual'>('ai');
  const [manualContent, setManualContent] = useState('');
  const [isProcessingRefFiles, setIsProcessingRefFiles] = useState(false);
  const [refFileNames, setRefFileNames] = useState<string[]>(() => {
    try { const s = sessionStorage.getItem('khkt_ref_file_names'); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [fileProgress, setFileProgress] = useState('');
  const [showFieldDropdown, setShowFieldDropdown] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const fieldDropdownRef = useRef<HTMLDivElement>(null);
  const refFileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    onChange(e.target.name as keyof UserInfo, e.target.value);
  };

  const handleSubmitWithHistory = () => {
    saveFormToHistory(userInfo as unknown as Record<string, string>);
    onSubmit();
  };

  useEffect(() => {
    try { sessionStorage.setItem('khkt_ref_file_names', JSON.stringify(refFileNames)); } catch {}
  }, [refFileNames]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (fieldDropdownRef.current && !fieldDropdownRef.current.contains(e.target as Node)) setShowFieldDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // PDF extraction
  const extractTextFromPdf = async (buf: ArrayBuffer, onProgress?: (m: string) => void): Promise<string> => {
    const data = new Uint8Array(buf);
    onProgress?.('Đang tải PDF...');
    const task = pdfjsLib.getDocument({ data, disableAutoFetch: true, disableStream: true });
    const pdf = await Promise.race([task.promise, new Promise<never>((_, rej) => setTimeout(() => { task.destroy(); rej(new Error('Timeout')); }, 30000))]);
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      try { const p = await pdf.getPage(i); const tc = await p.getTextContent(); text += tc.items.map((it: any) => it.str).join(' ') + '\n\n'; p.cleanup(); } catch {}
      if (i % 10 === 0) onProgress?.(`Đang đọc: ${i}/${pdf.numPages} trang...`);
    }
    try { pdf.destroy(); } catch {}
    return text || '[PDF không chứa text]';
  };

  // Ref file upload
  const handleRefFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setIsProcessingRefFiles(true);
    try {
      let allText = userInfo.referenceDocuments || '';
      const names: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > MAX_FILE_SIZE) { alert(`File "${file.name}" quá lớn`); continue; }
        setFileProgress(`Đọc ${i+1}/${files.length}: ${file.name}...`);
        try {
          const buf = await file.arrayBuffer();
          let txt = '';
          if (file.name.toLowerCase().endsWith('.pdf')) txt = await extractTextFromPdf(buf, setFileProgress);
          else if (file.name.endsWith('.docx')) { const r = await mammoth.extractRawText({ arrayBuffer: buf }); txt = r.value; }
          else txt = await new Promise<string>(r => { const fr = new FileReader(); fr.onload = e => r(e.target?.result as string); fr.readAsText(file); });
          if (txt.trim()) { allText += `\n\n=== TÀI LIỆU: ${file.name} ===\n${txt}`; names.push(file.name); }
          else names.push(`${file.name} (trống)`);
        } catch { alert(`Lỗi đọc ${file.name}`); }
      }
      onChange('referenceDocuments', allText);
      setRefFileNames(p => [...p, ...names]);
    } finally { setIsProcessingRefFiles(false); setFileProgress(''); if (refFileInputRef.current) refFileInputRef.current.value = ''; }
  };

  const clearRefDocuments = () => { onChange('referenceDocuments', ''); setRefFileNames([]); try { sessionStorage.removeItem('khkt_ref_file_names'); } catch {} };

  const requiredFields: (keyof UserInfo)[] = ['projectTitle', 'field', 'school', 'location', 'problem', 'objectives', 'hypothesis', 'methods'];
  const isInfoValid = requiredFields.every(k => { const v = userInfo[k]; return typeof v === 'string' && v.trim() !== ''; });
  const isManualValid = manualContent.trim().length > 50;

  // Filtered fields
  const displayFields = selectedGroup ? KHKT_FIELDS.filter(f => f.group === selectedGroup) : KHKT_FIELDS;

  return (
    <div className="w-full max-w-4xl mx-auto bg-white rounded-xl shadow-xl border border-teal-100 overflow-hidden my-8">
      <div className="bg-gradient-to-r from-teal-600 to-emerald-600 p-6 text-white text-center">
        <h2 className="text-3xl font-bold mb-2">🔬 Thiết lập Đề tài KHKT</h2>
        <p className="text-teal-100 opacity-90">Cung cấp thông tin dự án để AI tạo bản thảo đề tài khoa học kỹ thuật</p>
      </div>

      <div className="p-8 space-y-8">
        {/* MODE TOGGLE */}
        <div className="flex gap-2 p-1 bg-gray-100 rounded-lg w-fit mx-auto">
          <button onClick={() => setMode('ai')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === 'ai' ? 'bg-teal-600 text-white shadow' : 'text-gray-600 hover:text-teal-700'}`}>
            <Sparkles className="inline w-4 h-4 mr-1" /> AI Viết tự động
          </button>
          <button onClick={() => setMode('manual')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === 'manual' ? 'bg-teal-600 text-white shadow' : 'text-gray-600 hover:text-teal-700'}`}>
            <FileText className="inline w-4 h-4 mr-1" /> Dán nội dung có sẵn
          </button>
        </div>

        {mode === 'ai' ? (
          <>
            {/* SECTION 1: THÔNG TIN CƠ BẢN */}
            <div>
              <h3 className="text-lg font-bold text-teal-800 border-b border-teal-100 pb-2 mb-4 uppercase tracking-wide">
                1. Thông tin đề tài (Bắt buộc)
              </h3>
              <div className="space-y-5">
                <InputGroup label="Tên đề tài KHKT" icon={PenTool} required>
                  <InputWithHistory name="projectTitle" value={userInfo.projectTitle} onChange={handleChange}
                    className="bg-gray-50 focus:bg-white focus:ring-teal-500 focus:border-teal-500 block w-full pl-10 text-sm border-gray-300 rounded-md p-3 border text-gray-900 placeholder-gray-500"
                    placeholder='VD: "Nghiên cứu khả năng xử lý nước thải bằng than hoạt tính từ vỏ trấu"' required />
                </InputGroup>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Field Selector */}
                  <InputGroup label="Lĩnh vực KHKT" icon={Beaker} required>
                    <div className="relative" ref={fieldDropdownRef}>
                      <input type="text" value={userInfo.field} readOnly onClick={() => setShowFieldDropdown(!showFieldDropdown)}
                        className="bg-gray-50 focus:bg-white focus:ring-teal-500 focus:border-teal-500 block w-full pl-10 pr-8 text-sm border-gray-300 rounded-md p-3 border text-gray-900 placeholder-gray-500 cursor-pointer"
                        placeholder="Chọn lĩnh vực..." required />
                      <ChevronDown size={16} className={`absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-transform ${showFieldDropdown ? 'rotate-180' : ''}`} />

                      {showFieldDropdown && (
                        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-80 overflow-y-auto">
                          {/* Group filter tabs */}
                          <div className="sticky top-0 bg-white border-b p-2 flex flex-wrap gap-1">
                            <button onClick={() => setSelectedGroup(null)}
                              className={`px-2 py-1 text-xs rounded-full ${!selectedGroup ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                              Tất cả
                            </button>
                            {FIELD_GROUPS.map(g => (
                              <button key={g} onClick={() => setSelectedGroup(g)}
                                className={`px-2 py-1 text-xs rounded-full ${selectedGroup === g ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                {g}
                              </button>
                            ))}
                          </div>
                          {displayFields.map(f => (
                            <button key={f.id} type="button"
                              onClick={() => { onChange('field', f.name); setShowFieldDropdown(false); }}
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-teal-50 transition-colors ${userInfo.field === f.name ? 'bg-teal-50 text-teal-700 font-medium' : 'text-gray-700'}`}>
                              <span className="font-medium">{f.name}</span>
                              <span className="text-[11px] text-gray-400 ml-2">({f.group})</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </InputGroup>

                  {/* Level */}
                  <InputGroup label="Cấp độ thi" icon={GraduationCap} required>
                    <select name="level" value={userInfo.level} onChange={handleChange}
                      className="bg-gray-50 focus:bg-white focus:ring-teal-500 focus:border-teal-500 block w-full pl-10 text-sm border-gray-300 rounded-md p-3 border appearance-none text-gray-900">
                      <option value="">Chọn cấp...</option>
                      {KHKT_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </InputGroup>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <InputGroup label="Thành viên nhóm" icon={Users} required>
                    <InputWithHistory name="members" value={userInfo.members} onChange={handleChange}
                      className="bg-gray-50 focus:bg-white focus:ring-teal-500 focus:border-teal-500 block w-full pl-10 text-sm border-gray-300 rounded-md p-3 border text-gray-900 placeholder-gray-500"
                      placeholder='VD: Nguyễn Văn A (12A1), Trần Thị B (12A2)' required />
                  </InputGroup>
                  <InputGroup label="Giáo viên hướng dẫn" icon={GraduationCap} required>
                    <InputWithHistory name="advisor" value={userInfo.advisor} onChange={handleChange}
                      className="bg-gray-50 focus:bg-white focus:ring-teal-500 focus:border-teal-500 block w-full pl-10 text-sm border-gray-300 rounded-md p-3 border text-gray-900 placeholder-gray-500"
                      placeholder='VD: ThS. Nguyễn Văn C - GV Sinh học' required />
                  </InputGroup>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <InputGroup label="Trường THPT" icon={School} required>
                    <InputWithHistory name="school" value={userInfo.school} onChange={handleChange}
                      className="bg-gray-50 focus:bg-white focus:ring-teal-500 focus:border-teal-500 block w-full pl-10 text-sm border-gray-300 rounded-md p-3 border text-gray-900 placeholder-gray-500"
                      placeholder="VD: THPT Nguyễn Du" required />
                  </InputGroup>
                  <InputGroup label="Địa phương" icon={MapPin} required>
                    <InputWithHistory name="location" value={userInfo.location} onChange={handleChange}
                      className="bg-gray-50 focus:bg-white focus:ring-teal-500 focus:border-teal-500 block w-full pl-10 text-sm border-gray-300 rounded-md p-3 border text-gray-900 placeholder-gray-500"
                      placeholder="VD: Quận 1, TP.HCM" required />
                  </InputGroup>
                </div>
              </div>
            </div>

            {/* SECTION 2: NỘI DUNG NGHIÊN CỨU */}
            <div>
              <h3 className="text-lg font-bold text-teal-800 border-b border-teal-100 pb-2 mb-4 uppercase tracking-wide">
                2. Nội dung nghiên cứu (Bắt buộc)
              </h3>
              <div className="space-y-5">
                <InputGroup label="Vấn đề nghiên cứu / Lý do chọn đề tài" icon={Lightbulb} required>
                  <TextareaWithHistory name="problem" value={userInfo.problem} onChange={handleChange}
                    className="bg-gray-50 focus:bg-white focus:ring-teal-500 focus:border-teal-500 block w-full pl-10 text-sm border-gray-300 rounded-md p-3 border text-gray-900 placeholder-gray-500"
                    placeholder="Mô tả vấn đề thực tiễn mà đề tài muốn giải quyết..." rows={3} />
                </InputGroup>

                <InputGroup label="Mục tiêu nghiên cứu" icon={Target} required>
                  <TextareaWithHistory name="objectives" value={userInfo.objectives} onChange={handleChange}
                    className="bg-gray-50 focus:bg-white focus:ring-teal-500 focus:border-teal-500 block w-full pl-10 text-sm border-gray-300 rounded-md p-3 border text-gray-900 placeholder-gray-500"
                    placeholder="VD: Chế tạo vật liệu..., Đánh giá hiệu quả..., So sánh..." rows={2} />
                </InputGroup>

                <InputGroup label="Giả thuyết khoa học" icon={FlaskConical} required>
                  <TextareaWithHistory name="hypothesis" value={userInfo.hypothesis} onChange={handleChange}
                    className="bg-gray-50 focus:bg-white focus:ring-teal-500 focus:border-teal-500 block w-full pl-10 text-sm border-gray-300 rounded-md p-3 border text-gray-900 placeholder-gray-500"
                    placeholder='VD: "Nếu sử dụng than hoạt tính từ vỏ trấu thì hiệu quả xử lý nước thải đạt trên 80%"' rows={2} />
                </InputGroup>

                <InputGroup label="Phương pháp nghiên cứu" icon={Beaker} required>
                  <div>
                    <TextareaWithHistory name="methods" value={userInfo.methods} onChange={handleChange}
                      className="bg-gray-50 focus:bg-white focus:ring-teal-500 focus:border-teal-500 block w-full pl-10 text-sm border-gray-300 rounded-md p-3 border text-gray-900 placeholder-gray-500"
                      placeholder="VD: Phương pháp thực nghiệm, khảo sát, phân tích thống kê..." rows={2} />
                    <div className="mt-2 flex flex-wrap gap-1">
                      {RESEARCH_METHODS.map(m => (
                        <button key={m.name} type="button"
                          onClick={() => { const cur = userInfo.methods; onChange('methods', cur ? `${cur}, ${m.name}` : m.name); }}
                          className="px-2 py-1 text-xs bg-teal-50 text-teal-700 rounded-full hover:bg-teal-100 border border-teal-200"
                          title={m.description}>
                          + {m.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </InputGroup>
              </div>
            </div>

            {/* SECTION 3: TÙY CHỌN */}
            <div>
              <h3 className="text-lg font-bold text-teal-800 border-b border-teal-100 pb-2 mb-4 uppercase tracking-wide flex items-center">
                3. Thông tin bổ sung
                <span className="ml-2 text-xs bg-teal-100 text-teal-800 py-1 px-2 rounded-full font-normal normal-case">(Tùy chọn)</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <InputGroup label="Đối tượng / Phạm vi NC" icon={Users}>
                  <input type="text" name="researchSubjects" value={userInfo.researchSubjects} onChange={handleChange}
                    className="bg-white focus:ring-teal-500 focus:border-teal-500 block w-full pl-10 text-sm border-gray-300 rounded-md p-3 border text-gray-900 placeholder-gray-500"
                    placeholder="VD: Mẫu nước sông X, Học sinh lớp 11..." />
                </InputGroup>
                <InputGroup label="Thời gian thực hiện" icon={Calendar}>
                  <input type="text" name="timeframe" value={userInfo.timeframe} onChange={handleChange}
                    className="bg-white focus:ring-teal-500 focus:border-teal-500 block w-full pl-10 text-sm border-gray-300 rounded-md p-3 border text-gray-900 placeholder-gray-500"
                    placeholder="VD: Tháng 9/2024 - 3/2025" />
                </InputGroup>
                <InputGroup label="Yêu cầu đặc biệt" icon={Target}>
                  <input type="text" name="specialRequirements" value={userInfo.specialRequirements} onChange={handleChange}
                    className="bg-white focus:ring-teal-500 focus:border-teal-500 block w-full pl-10 text-sm border-gray-300 rounded-md p-3 border text-gray-900 placeholder-gray-500"
                    placeholder="VD: Tập trung vào tính ứng dụng, Có sản phẩm thực tế..." />
                </InputGroup>
                <InputGroup label="Giới hạn trang" icon={FileText}>
                  <input type="number" name="pageLimit" value={userInfo.pageLimit} onChange={handleChange} min={15} max={100}
                    className="bg-white focus:ring-teal-500 focus:border-teal-500 block w-full pl-10 text-sm border-gray-300 rounded-md p-3 border text-gray-900 placeholder-gray-500"
                    placeholder="VD: 30 (để trống = không giới hạn)" />
                </InputGroup>
              </div>
            </div>

            {/* SECTION 4: TÀI LIỆU THAM KHẢO */}
            <div>
              <h3 className="text-lg font-bold text-teal-800 border-b border-teal-100 pb-2 mb-4 uppercase tracking-wide flex items-center">
                4. Tài liệu tham khảo
                <span className="ml-2 text-xs bg-teal-100 text-teal-800 py-1 px-2 rounded-full font-normal normal-case">(Tùy chọn)</span>
              </h3>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 relative">
                {isProcessingRefFiles && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10 backdrop-blur-sm rounded-lg">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
                      <p className="text-sm font-medium text-teal-700">{fileProgress || 'Đang đọc...'}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-gray-700">📎 Upload tài liệu (PDF, DOCX, TXT)</p>
                  {refFileNames.length > 0 && (
                    <button onClick={clearRefDocuments} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                      <X size={14} /> Xóa tất cả
                    </button>
                  )}
                </div>
                <input ref={refFileInputRef} type="file" accept=".pdf,.docx,.txt" multiple onChange={handleRefFileUpload} className="hidden" />
                <button onClick={() => refFileInputRef.current?.click()} disabled={isProcessingRefFiles}
                  className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-teal-400 hover:text-teal-600 hover:bg-teal-50 transition-all flex items-center justify-center gap-2">
                  <FileUp size={18} /> Chọn file tài liệu tham khảo
                </button>
                {refFileNames.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {refFileNames.map((n, i) => (
                      <div key={i} className="text-xs text-gray-600 bg-white px-3 py-1.5 rounded border flex items-center gap-2">
                        <FileText size={12} className="text-teal-500" /> {n}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* SUBMIT */}
            <div className="pt-4">
              <Button onClick={handleSubmitWithHistory} disabled={isSubmitting || !isInfoValid}
                className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold py-4 text-lg rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3">
                {isSubmitting ? <><Loader2 className="animate-spin" size={24} /> Đang khởi tạo...</> : <><Sparkles size={24} /> 🚀 BẮT ĐẦU VIẾT ĐỀ TÀI KHKT</>}
              </Button>
              {!isInfoValid && (
                <p className="text-center text-sm text-red-500 mt-2">⚠️ Vui lòng điền đầy đủ thông tin bắt buộc (*)</p>
              )}
            </div>
          </>
        ) : (
          /* MANUAL MODE */
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Dán nội dung đề tài KHKT đã viết sẵn để AI xử lý và định dạng:</p>
            <textarea value={manualContent} onChange={e => setManualContent(e.target.value)} rows={15}
              className="w-full border border-gray-300 rounded-lg p-4 text-sm focus:ring-teal-500 focus:border-teal-500"
              placeholder="Dán toàn bộ nội dung đề tài KHKT vào đây..." />
            <Button onClick={() => onManualSubmit(manualContent)} disabled={isSubmitting || !isManualValid}
              className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-bold py-4 text-lg rounded-xl disabled:opacity-50">
              {isSubmitting ? 'Đang xử lý...' : '📄 Gửi nội dung để xử lý'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default KHKTForm;
