import React, { useState, useRef, useEffect } from 'react';
import { UserInfo } from '../types';
import { Button } from './Button';
import { InputWithHistory, TextareaWithHistory } from './InputWithHistory';
import { saveFormToHistory } from '../services/inputHistory';
import { KHKT_FIELDS, FIELD_GROUPS, KHKT_LEVELS, RESEARCH_METHODS } from '../data/khktKnowledge';
import { BookOpen, School, GraduationCap, PenTool, MapPin, Calendar, Users, Target, FileUp, Sparkles, Loader2, FileText, Search, X, ChevronDown, Beaker, FlaskConical, Lightbulb, AlertTriangle, Check } from 'lucide-react';
import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import { getFriendlyErrorMessage, initializeGeminiChat, sendSinglePromptStream } from '../services/geminiService';

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

const InputGroup: React.FC<{ label: string; icon: any; required?: boolean; action?: React.ReactNode; children: React.ReactNode }> = ({ label, icon: Icon, required, action, children }) => (
  <div className="w-full">
    <div className="flex justify-between items-center mb-1">
      <label className="block text-sm font-semibold text-gray-900">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {action}
    </div>
    <div className="relative rounded-md shadow-sm">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Icon className="h-5 w-5 text-gray-400" />
      </div>
      {children}
    </div>
  </div>
);

const MAX_FILE_SIZE = 100 * 1024 * 1024;

type ResearchSuggestionField = 'problem' | 'objectives' | 'hypothesis' | 'methods';

const RESEARCH_SUGGESTION_CONFIG: Record<ResearchSuggestionField, { label: string; instruction: string }> = {
  problem: {
    label: 'Vấn đề nghiên cứu / Lý do chọn đề tài',
    instruction: `Viết 1-2 đoạn khoảng 120-180 từ. Làm rõ vấn đề thực tiễn, tính cấp thiết, khoảng trống cần nghiên cứu và lý do nhóm học sinh chọn đề tài. Không bịa số liệu, kết quả khảo sát hoặc nguồn trích dẫn.`,
  },
  objectives: {
    label: 'Mục tiêu nghiên cứu',
    instruction: `Nêu 1 mục tiêu chung và 3-5 mục tiêu cụ thể. Mỗi mục tiêu cụ thể bắt đầu bằng động từ có thể đánh giá như xác định, thiết kế, chế tạo, khảo sát, đo lường, so sánh hoặc đánh giá. Trình bày bằng danh sách gạch đầu dòng.`,
  },
  hypothesis: {
    label: 'Giả thuyết khoa học',
    instruction: `Viết một giả thuyết ngắn gọn, có thể kiểm chứng, ưu tiên cấu trúc "Nếu... thì...". Chỉ rõ yếu tố tác động, kết quả kỳ vọng và hướng thay đổi; không tự đặt ngưỡng số liệu khi tên đề tài không cung cấp căn cứ.`,
  },
  methods: {
    label: 'Phương pháp nghiên cứu',
    instruction: `Đề xuất 4-6 phương pháp phù hợp trực tiếp với đề tài. Với mỗi phương pháp, nêu ngắn gọn mục đích sử dụng; nếu có thực nghiệm thì đề cập biến, đối chứng, cách đo và xử lý dữ liệu phù hợp. Không liệt kê phương pháp không liên quan.`,
  },
};

export const KHKTForm: React.FC<Props> = ({ userInfo, onChange, onSubmit, onManualSubmit, isSubmitting, apiKey, selectedModel }) => {
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

  // States cho tính năng AI Gợi ý tên đề tài
  const [isOpenTitleModal, setIsOpenTitleModal] = useState(false);
  const [titleKeywords, setTitleKeywords] = useState('');
  const [selectedTitleField, setSelectedTitleField] = useState(userInfo.field || '');
  const [isGeneratingTitles, setIsGeneratingTitles] = useState(false);
  const [suggestedTitles, setSuggestedTitles] = useState<{ title: string; novelty: string; explanation: string }[]>([]);
  const [generationError, setGenerationError] = useState('');
  const [showModalFieldDropdown, setShowModalFieldDropdown] = useState(false);
  const [modalSelectedGroup, setModalSelectedGroup] = useState<string | null>(null);
  const modalFieldDropdownRef = useRef<HTMLDivElement>(null);

  // AI gợi ý riêng cho 4 nội dung nghiên cứu bắt buộc
  const [suggestingField, setSuggestingField] = useState<ResearchSuggestionField | null>(null);
  const [researchSuggestionError, setResearchSuggestionError] = useState('');

  useEffect(() => {
    if (userInfo.projectTitle.trim()) {
      setResearchSuggestionError('');
    }
  }, [userInfo.projectTitle]);

  useEffect(() => {
    if (isOpenTitleModal) {
      setSelectedTitleField(userInfo.field || '');
      setGenerationError('');
    }
  }, [isOpenTitleModal, userInfo.field]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (modalFieldDropdownRef.current && !modalFieldDropdownRef.current.contains(e.target as Node)) {
        setShowModalFieldDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const generateTitles = async () => {
    if (!apiKey) {
      setGenerationError('Vui lòng nhập Gemini API Key trong phần Cài đặt ở góc trên bên phải trang trước khi sử dụng tính năng này.');
      return;
    }
    if (!titleKeywords.trim()) {
      setGenerationError('Vui lòng nhập một vài từ khóa hoặc mô tả ý tưởng ban đầu của bạn.');
      return;
    }
    if (!selectedTitleField) {
      setGenerationError('Vui lòng chọn một lĩnh vực nghiên cứu.');
      return;
    }

    setIsGeneratingTitles(true);
    setGenerationError('');
    setSuggestedTitles([]);

    try {
      initializeGeminiChat(apiKey, selectedModel);

      const prompt = `Bạn là một chuyên gia Thẩm định khoa học thuộc Hội đồng Khoa học Kỹ thuật cấp Quốc gia, có tri thức sâu rộng về các lĩnh vực nghiên cứu và xu hướng khoa học mới nhất dành cho học sinh trung học.

Hãy gợi ý 5 tên đề tài nghiên cứu Khoa học Kỹ thuật (KHKT) sáng tạo, mới mẻ, độc đáo và hoàn toàn KHÔNG trùng lặp, KHÔNG đạo văn từ các nghiên cứu phổ biến.

Yêu cầu về đề tài gợi ý:
1. ĐÚNG CẤU TRÚC KHKT: Tên đề tài bắt đầu bằng các động từ khoa học như "Nghiên cứu...", "Thiết kế...", "Xây dựng...", "Chế tạo...", "Đánh giá...", "Phân tích...", v.v. và chỉ rõ đối tượng, phạm vi nghiên cứu rõ ràng.
2. LĨNH VỰC NGHIÊN CỨU: ${selectedTitleField}
3. Ý TƯỞNG / TỪ KHÓA BAN ĐẦU CỦA HỌC SINH: "${titleKeywords}"
4. TÍNH MỚI & SÁNG TẠO: Mỗi đề tài cần chỉ ra rõ ràng "tính mới" đột phá hoặc hướng giải quyết sáng tạo hơn so với các phương pháp/thiết bị hiện tại để đảm bảo không bị trùng lắp hay đạo văn.
5. PHÙ HỢP NĂNG LỰC: Phù hợp với năng lực học sinh THPT nhưng vẫn mang tính học thuật cao.

Bạn BẮT BUỘC phải trả về kết quả dưới dạng một mảng JSON hợp lệ nằm trong một block code markdown \`\`\`json ... \`\`\`. Ngoài block code JSON này, không viết thêm bất kỳ lời thoại nào khác.

Mỗi phần tử trong mảng JSON phải tuân thủ chính xác cấu trúc sau:
{
  "title": string,       // Tên đề tài gợi ý đúng chuẩn khoa học (VD: "Nghiên cứu chế tạo thiết bị lọc nước...")
  "novelty": string,     // Phân tích tính mới và tính sáng tạo của đề tài (tại sao nó không trùng lặp, giải quyết vấn đề gì mới)
  "explanation": string  // Giải thích ngắn gọn về hướng nghiên cứu cốt lõi và phương pháp đề xuất
}

Hãy sinh 5 đề tài xuất sắc nhất cho học sinh.`;

      let fullText = '';
      await sendSinglePromptStream(prompt, (chunk) => {
        fullText += chunk;
      });

      // Trích xuất JSON từ markdown block code
      const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
      const match = fullText.match(jsonRegex);
      const jsonStr = match ? match[1] : fullText;

      try {
        const parsed = JSON.parse(jsonStr.trim());
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSuggestedTitles(parsed);
        } else {
          throw new Error('Dữ liệu trả về không phải là mảng hợp lệ');
        }
      } catch (parseErr) {
        console.error('Lỗi parse JSON gợi ý tiêu đề:', parseErr, 'Văn bản nhận được:', fullText);
        // Trình phân tích dự phòng thô sơ nếu AI không trả về đúng định dạng
        const fallbackTitles: { title: string; novelty: string; explanation: string }[] = [];
        const lines = fullText.split('\n');
        let currentTitle: any = {};
        
        for (const line of lines) {
          const cleanLine = line.replace(/^\s*[-*•]\s*/, '').trim();
          if (cleanLine.toLowerCase().includes('tiêu đề') || cleanLine.toLowerCase().includes('tên đề tài') || cleanLine.startsWith('1.') || cleanLine.startsWith('2.') || cleanLine.startsWith('3.') || cleanLine.startsWith('4.') || cleanLine.startsWith('5.')) {
            if (currentTitle.title) {
              fallbackTitles.push(currentTitle);
              currentTitle = {};
            }
            currentTitle.title = cleanLine.substring(cleanLine.indexOf(':') + 1).replace(/^["'\s]+|["'\s]+$/g, '').trim();
          } else if (cleanLine.toLowerCase().includes('tính mới') || cleanLine.toLowerCase().includes('sáng tạo')) {
            currentTitle.novelty = cleanLine.substring(cleanLine.indexOf(':') + 1).trim();
          } else if (cleanLine.toLowerCase().includes('giải thích') || cleanLine.toLowerCase().includes('hướng đi') || cleanLine.toLowerCase().includes('phương pháp')) {
            currentTitle.explanation = cleanLine.substring(cleanLine.indexOf(':') + 1).trim();
          }
        }
        if (currentTitle.title) {
          fallbackTitles.push(currentTitle);
        }

        if (fallbackTitles.length > 0) {
          setSuggestedTitles(fallbackTitles);
        } else {
          setGenerationError('Không thể phân tích kết quả gợi ý từ AI dưới dạng JSON. Vui lòng thử bấm nút tạo lại.');
        }
      }
    } catch (err: any) {
      console.error(err);
      setGenerationError(err.message || 'Đã xảy ra lỗi kết nối với Gemini API. Vui lòng kiểm tra API key.');
    } finally {
      setIsGeneratingTitles(false);
    }
  };

  const generateResearchSuggestion = async (field: ResearchSuggestionField) => {
    const projectTitle = userInfo.projectTitle.trim();
    if (!projectTitle) {
      setResearchSuggestionError('Vui lòng nhập hoặc chọn Tên đề tài KHKT trước khi dùng AI gợi ý.');
      return;
    }
    if (!apiKey) {
      setResearchSuggestionError('Vui lòng nhập Gemini API Key trong phần Cài đặt trước khi dùng AI gợi ý.');
      return;
    }

    const config = RESEARCH_SUGGESTION_CONFIG[field];
    setSuggestingField(field);
    setResearchSuggestionError('');

    try {
      initializeGeminiChat(apiKey, selectedModel);

      const prompt = `Bạn là chuyên gia hướng dẫn học sinh THPT thực hiện đề tài Khoa học Kỹ thuật.

Hãy gợi ý nội dung cho mục "${config.label}" dựa trước hết vào TÊN ĐỀ TÀI sau:
"${projectTitle}"

Thông tin bổ trợ để hiểu đúng ngữ cảnh (nếu đã có):
- Lĩnh vực: ${userInfo.field || 'Chưa xác định'}
- Đối tượng/phạm vi: ${userInfo.researchSubjects || 'Chưa xác định'}
- Thời gian: ${userInfo.timeframe || 'Chưa xác định'}

Yêu cầu riêng:
${config.instruction}

Yêu cầu chung:
- Phù hợp năng lực nghiên cứu của học sinh THPT và đúng cấu trúc đề tài KHKT.
- Bám sát tên đề tài, dùng tiếng Việt khoa học, rõ ràng, có thể dán trực tiếp vào biểu mẫu.
- Không bịa số liệu, kết quả, trích dẫn, địa điểm hoặc thông tin chưa được cung cấp.
- Chỉ trả về nội dung cần điền; không viết tiêu đề mục, lời chào, lời giải thích hay khối mã Markdown.`;

      let suggestion = '';
      await sendSinglePromptStream(prompt, chunk => {
        suggestion += chunk;
      });

      const cleanedSuggestion = suggestion
        .replace(/^```(?:markdown|text)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      if (!cleanedSuggestion) {
        throw new Error('AI chưa trả về nội dung gợi ý. Vui lòng thử lại.');
      }

      onChange(field, cleanedSuggestion);
    } catch (err: any) {
      console.error(`Lỗi AI gợi ý cho ${field}:`, err);
      const errorInfo = getFriendlyErrorMessage(err);
      setResearchSuggestionError(`${errorInfo.title}: ${errorInfo.message}`);
    } finally {
      setSuggestingField(null);
    }
  };

  const renderResearchSuggestionAction = (field: ResearchSuggestionField) => {
    const isCurrentFieldLoading = suggestingField === field;

    return (
      <button
        type="button"
        onClick={() => generateResearchSuggestion(field)}
        disabled={suggestingField !== null}
        aria-label={`AI gợi ý ${RESEARCH_SUGGESTION_CONFIG[field].label}`}
        className="text-xs font-semibold text-teal-600 hover:text-teal-800 flex items-center gap-1 bg-teal-50 hover:bg-teal-100 px-2.5 py-1 rounded-md transition-all border border-teal-200 hover:border-teal-300 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isCurrentFieldLoading ? (
          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang gợi ý...</>
        ) : (
          <><Sparkles className="w-3.5 h-3.5" /> AI gợi ý</>
        )}
      </button>
    );
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    onChange(e.target.name as keyof UserInfo, e.target.value);
  };

  const handleSubmitWithHistory = () => {
    saveFormToHistory(userInfo as unknown as Record<string, unknown>);
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
                <InputGroup 
                  label="Tên đề tài KHKT" 
                  icon={PenTool} 
                  required
                  action={
                    <button
                      type="button"
                      onClick={() => setIsOpenTitleModal(true)}
                      className="text-xs font-semibold text-teal-600 hover:text-teal-800 flex items-center gap-1 bg-teal-50 hover:bg-teal-100 px-2.5 py-1 rounded-md transition-all border border-teal-200 hover:border-teal-300 shadow-sm"
                    >
                      <Sparkles className="w-3.5 h-3.5 animate-pulse" /> AI Gợi ý tên
                    </button>
                  }
                >
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
              {researchSuggestionError && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm flex items-start gap-2" role="alert">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{researchSuggestionError}</span>
                </div>
              )}
              <div className="space-y-5">
                <InputGroup label="Vấn đề nghiên cứu / Lý do chọn đề tài" icon={Lightbulb} required action={renderResearchSuggestionAction('problem')}>
                  <TextareaWithHistory name="problem" value={userInfo.problem} onChange={handleChange}
                    className="bg-gray-50 focus:bg-white focus:ring-teal-500 focus:border-teal-500 block w-full pl-10 text-sm border-gray-300 rounded-md p-3 border text-gray-900 placeholder-gray-500"
                    placeholder="Mô tả vấn đề thực tiễn mà đề tài muốn giải quyết..." rows={3} />
                </InputGroup>

                <InputGroup label="Mục tiêu nghiên cứu" icon={Target} required action={renderResearchSuggestionAction('objectives')}>
                  <TextareaWithHistory name="objectives" value={userInfo.objectives} onChange={handleChange}
                    className="bg-gray-50 focus:bg-white focus:ring-teal-500 focus:border-teal-500 block w-full pl-10 text-sm border-gray-300 rounded-md p-3 border text-gray-900 placeholder-gray-500"
                    placeholder="VD: Chế tạo vật liệu..., Đánh giá hiệu quả..., So sánh..." rows={2} />
                </InputGroup>

                <InputGroup label="Giả thuyết khoa học" icon={FlaskConical} required action={renderResearchSuggestionAction('hypothesis')}>
                  <TextareaWithHistory name="hypothesis" value={userInfo.hypothesis} onChange={handleChange}
                    className="bg-gray-50 focus:bg-white focus:ring-teal-500 focus:border-teal-500 block w-full pl-10 text-sm border-gray-300 rounded-md p-3 border text-gray-900 placeholder-gray-500"
                    placeholder='VD: "Nếu sử dụng than hoạt tính từ vỏ trấu thì hiệu quả xử lý nước thải đạt trên 80%"' rows={2} />
                </InputGroup>

                <InputGroup label="Phương pháp nghiên cứu" icon={Beaker} required action={renderResearchSuggestionAction('methods')}>
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
                  <InputWithHistory type="text" name="researchSubjects" value={userInfo.researchSubjects} onChange={handleChange}
                    className="bg-white focus:ring-teal-500 focus:border-teal-500 block w-full pl-10 text-sm border-gray-300 rounded-md p-3 border text-gray-900 placeholder-gray-500"
                    placeholder="VD: Mẫu nước sông X, Học sinh lớp 11..." />
                </InputGroup>
                <InputGroup label="Thời gian thực hiện" icon={Calendar}>
                  <InputWithHistory type="text" name="timeframe" value={userInfo.timeframe} onChange={handleChange}
                    className="bg-white focus:ring-teal-500 focus:border-teal-500 block w-full pl-10 text-sm border-gray-300 rounded-md p-3 border text-gray-900 placeholder-gray-500"
                    placeholder="VD: Tháng 9/2024 - 3/2025" />
                </InputGroup>
                <InputGroup label="Yêu cầu đặc biệt" icon={Target}>
                  <InputWithHistory type="text" name="specialRequirements" value={userInfo.specialRequirements} onChange={handleChange}
                    className="bg-white focus:ring-teal-500 focus:border-teal-500 block w-full pl-10 text-sm border-gray-300 rounded-md p-3 border text-gray-900 placeholder-gray-500"
                    placeholder="VD: Tập trung vào tính ứng dụng, Có sản phẩm thực tế..." />
                </InputGroup>
                <InputGroup label="Giới hạn trang" icon={FileText}>
                  <InputWithHistory type="number" name="pageLimit" value={userInfo.pageLimit} onChange={handleChange} min={15} max={100}
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
      {/* AI SUGGESTION MODAL */}
      {isOpenTitleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-teal-100 max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col transform transition-all duration-300">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-teal-600 to-emerald-600 px-6 py-4 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-6 h-6 animate-pulse text-amber-300" />
                <div>
                  <h3 className="text-xl font-bold">Trợ Lý AI Gợi Ý Tên Đề Tài</h3>
                  <p className="text-xs text-teal-100 opacity-90">Sáng tạo, Độc bản, Chuẩn cấu trúc KHKT</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsOpenTitleModal(false)}
                className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto p-6 space-y-5 flex-1">
              {/* Field Selector */}
              <div className="space-y-1">
                <label className="block text-sm font-semibold text-gray-900">
                  Lĩnh vực nghiên cứu <span className="text-red-500">*</span>
                </label>
                <div className="relative" ref={modalFieldDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setShowModalFieldDropdown(!showModalFieldDropdown)}
                    className="w-full text-left bg-gray-50 hover:bg-gray-100 border border-gray-300 focus:ring-teal-500 focus:border-teal-500 rounded-lg p-3 text-sm flex justify-between items-center text-gray-900"
                  >
                    <span>{selectedTitleField || "Chọn lĩnh vực nghiên cứu..."}</span>
                    <ChevronDown size={16} className={`text-gray-500 transition-transform ${showModalFieldDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showModalFieldDropdown && (
                    <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                      {/* Filter tabs */}
                      <div className="sticky top-0 bg-white border-b p-2 flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => setModalSelectedGroup(null)}
                          className={`px-2 py-0.5 text-xs rounded-full ${!modalSelectedGroup ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                          Tất cả
                        </button>
                        {FIELD_GROUPS.map(g => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setModalSelectedGroup(g)}
                            className={`px-2 py-0.5 text-xs rounded-full ${modalSelectedGroup === g ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                          >
                            {g}
                          </button>
                        ))}
                      </div>

                      {/* Dropdown Options */}
                      {(modalSelectedGroup ? KHKT_FIELDS.filter(f => f.group === modalSelectedGroup) : KHKT_FIELDS).map(f => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => { setSelectedTitleField(f.name); setShowModalFieldDropdown(false); }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-teal-50 transition-colors ${selectedTitleField === f.name ? 'bg-teal-50 text-teal-700 font-medium' : 'text-gray-700'}`}
                        >
                          {f.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Idea input */}
              <div className="space-y-1">
                <label className="block text-sm font-semibold text-gray-900">
                  Ý tưởng ban đầu / Từ khóa chính <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={titleKeywords}
                  onChange={e => setTitleKeywords(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg p-3 text-sm focus:ring-teal-500 focus:border-teal-500 text-gray-900"
                  placeholder="Nhập ý tưởng sơ khai hoặc các từ khóa, ví dụ: chế tạo robot dọn rác, lọc kim loại nặng trong giếng khoan bằng vỏ dừa..."
                  rows={3}
                />
              </div>

              {generationError && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-lg text-sm flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
                  <p className="font-medium">{generationError}</p>
                </div>
              )}

              {/* Generate Button */}
              <button
                type="button"
                onClick={generateTitles}
                disabled={isGeneratingTitles || !titleKeywords.trim() || !selectedTitleField}
                className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold py-3 rounded-lg shadow transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isGeneratingTitles ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    <span>Đang phân tích xu hướng và sáng tạo đề tài...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    <span>Tạo 5 Gợi Ý Tên Đề Tài Độc Bản</span>
                  </>
                )}
              </button>

              {/* Suggested Titles List */}
              {suggestedTitles.length > 0 && (
                <div className="space-y-4 pt-3 border-t">
                  <p className="text-sm font-semibold text-teal-800 flex items-center gap-1 uppercase tracking-wider">
                    💡 Đề xuất từ AI (Nhấp để chọn đề tài):
                  </p>
                  <div className="space-y-3.5">
                    {suggestedTitles.map((item, idx) => (
                      <div 
                        key={idx}
                        className="bg-teal-50/30 hover:bg-teal-50/70 border border-teal-100 hover:border-teal-200 rounded-xl p-4 transition-all duration-200 text-left relative group shadow-sm flex flex-col justify-between"
                      >
                        <div className="space-y-2 mb-3">
                          <h4 className="text-base font-bold text-gray-900 line-clamp-2">
                            {idx + 1}. {item.title}
                          </h4>
                          <div className="text-xs space-y-1 mt-2">
                            <p className="text-emerald-700 font-medium bg-emerald-50 p-2 rounded border border-emerald-100">
                              <span className="font-bold text-emerald-800">✨ Tính mới:</span> {item.novelty}
                            </p>
                            <p className="text-gray-650 bg-gray-50 p-2 rounded border border-gray-100 mt-1">
                              <span className="font-semibold text-gray-700">🔬 Phương pháp:</span> {item.explanation}
                            </p>
                          </div>
                        </div>
                        <div className="flex justify-end shrink-0 mt-2">
                          <button
                            type="button"
                            onClick={() => {
                              onChange('projectTitle', item.title);
                              if (selectedTitleField) {
                                onChange('field', selectedTitleField);
                              }
                              setIsOpenTitleModal(false);
                            }}
                            className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold py-1.5 px-3 rounded flex items-center gap-1 transition-all"
                          >
                            <Check size={14} /> Áp dụng đề tài
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 px-6 py-3 border-t flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsOpenTitleModal(false)}
                className="bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 font-semibold py-2 px-4 rounded-lg text-sm transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KHKTForm;
