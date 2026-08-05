import React, { useState, useEffect, useCallback } from 'react';
import { UserInfo, GenerationStep, GenerationState } from './types';
import { STEPS_INFO, KHKT_CHAPTER_PROMPT, FALLBACK_MODELS, MODEL_DISPLAY_ORDER } from './constants';
import { initializeGeminiChat, sendMessageStream, sendSinglePromptStream, getFriendlyErrorMessage, parseApiError, getChatHistory, setChatHistory } from './services/geminiService';
import { apiKeyManager } from './services/apiKeyManager';
import { KHKT_FIELDS } from './data/khktKnowledge';
import { KHKTForm } from './components/KHKTForm';
import { DocumentPreview } from './components/DocumentPreview';
import { AIActionPanel } from './components/AIActionPanel';
import { Button } from './components/Button';
import { ApiKeyModal } from './components/ApiKeyModal';
import { Download, ChevronRight, Wand2, FileText, CheckCircle, RefreshCw, Settings, AlertTriangle, Save, Trash2 } from 'lucide-react';

import { LockScreen } from './components/LockScreen';

// Helper: Truncate text dài cho AI prompt - giữ phần đầu (nội dung chính) và thông báo lược bớt
const MAX_REF_DOCS_FOR_PROMPT = 80000; // ~80K ký tự tối đa cho tài liệu tham khảo trong prompt

const truncateForPrompt = (text: string, maxChars: number = MAX_REF_DOCS_FOR_PROMPT): string => {
  if (!text || text.length <= maxChars) return text;

  const truncated = text.substring(0, maxChars);
  const removedChars = text.length - maxChars;
  const estimatedPages = Math.round(removedChars / 2500); // ~2500 ký tự/trang A4

  return truncated + `\n\n[... ĐÃ LƯỢC BỚT ${removedChars.toLocaleString()} KÝ TỰ (~${estimatedPages} trang) DO QUÁ DÀI. Nội dung phía trên đã đủ để tham khảo các ý chính ...]`;
};

// SessionStorage key cho tài liệu tham khảo lớn
const SESSION_REF_DOCS_KEY = 'khkt_ref_docs';
const SESSION_REF_NAMES_KEY = 'khkt_ref_file_names';

// LocalStorage key cho lưu/khôi phục phiên làm việc
const SESSION_SAVE_KEY = 'khkt_session_data';

// Interface cho session data
// Session version để invalidate sessions cũ khi thay đổi cấu trúc step
const SESSION_VERSION = 'v2_no_review';

interface SessionData {
  sessionVersion?: string;
  userInfo: Omit<UserInfo, 'referenceDocuments'> & { hasReferenceDocuments: boolean };
  state: {
    step: GenerationStep;
    messages: Array<{ role: string; text: string }>;
    fullDocument: string;
  };
  appendixDocument: string;
  outlineFeedback: string;
  chatHistory: any[];
  savedAt: string;
}

const App: React.FC = () => {
  // Lock Screen State
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Session Restore State
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [pendingSessionData, setPendingSessionData] = useState<SessionData | null>(null);
  const [sessionSavedAt, setSessionSavedAt] = useState<string | null>(null);

  // API Key State
  const [apiKey, setApiKey] = useState('');
  const [showApiModal, setShowApiModal] = useState(false);
  const [selectedModel, setSelectedModel] = useState(FALLBACK_MODELS[0]);

  // Check LocalStorage on Mount
  useEffect(() => {
    const authState = localStorage.getItem('khkt_app_unlocked');
    if (authState === 'true') {
      setIsUnlocked(true);
    }

    // Load API key từ localStorage hoặc .env
    const savedKey = localStorage.getItem('gemini_api_key');
    const savedModel = localStorage.getItem('selected_model');

    if (savedKey) {
      setApiKey(savedKey);
    } else {
      // Thử lấy key từ biến môi trường (.env)
      const envKeys = (import.meta.env.VITE_GEMINI_API_KEYS || '').split(',').map((k: string) => k.trim()).filter((k: string) => k.length > 0);
      if (envKeys.length > 0) {
        const firstEnvKey = envKeys[0];
        setApiKey(firstEnvKey);
        localStorage.setItem('gemini_api_key', firstEnvKey);
        console.log('🔑 Tự động sử dụng API key từ biến môi trường');
      } else {
        // Không có key nào → hiển thị modal bắt buộc nhập
        setShowApiModal(true);
      }
    }

    if (savedModel && (FALLBACK_MODELS.includes(savedModel) || MODEL_DISPLAY_ORDER.includes(savedModel))) {
      setSelectedModel(savedModel);
    }

    // Kiểm tra phiên làm việc đã lưu
    try {
      const savedSession = localStorage.getItem(SESSION_SAVE_KEY);
      if (savedSession) {
        const sessionData: SessionData = JSON.parse(savedSession);
        // Invalidate sessions cũ (trước khi xóa review steps) để tránh step number sai
        if (sessionData.sessionVersion !== SESSION_VERSION) {
          console.warn('⚠️ Session cũ không tương thích (thiếu version hoặc version khác). Xóa session.');
          localStorage.removeItem(SESSION_SAVE_KEY);
        }
        // Chỉ hiện modal khôi phục nếu phiên có tiến trình (step > INPUT_FORM)
        else if (sessionData.state && sessionData.state.step > GenerationStep.INPUT_FORM) {
          setPendingSessionData(sessionData);
          setShowRestoreModal(true);
        }
      }
    } catch (e) {
      console.warn('Không thể đọc phiên đã lưu:', e);
      localStorage.removeItem(SESSION_SAVE_KEY);
    }

    setCheckingAuth(false);
  }, []);

  const handleSaveApiKey = (key: string, model: string) => {
    localStorage.setItem('gemini_api_key', key);
    localStorage.setItem('selected_model', model);
    setApiKey(key);
    setSelectedModel(model);
    setShowApiModal(false);

    // 🆕 Nếu đang có lỗi (ví dụ: hết quota), clear error và reinitialize chat với key mới
    if (state.error) {
      setState(prev => ({ ...prev, error: null }));
      // Reinitialize chat session với key mới
      initializeGeminiChat(key, model);
    }
  };

  const handleLogin = (username: string) => {
    localStorage.setItem('khkt_app_unlocked', 'true');
    localStorage.setItem('khkt_logged_user', username);
    setIsUnlocked(true);
  };

  const [userInfo, setUserInfo] = useState<UserInfo>({
    projectTitle: '',
    field: '',
    level: '',
    members: '',
    advisor: '',
    school: '',
    location: '',
    problem: '',
    objectives: '',
    hypothesis: '',
    methods: '',
    researchSubjects: '',
    timeframe: '',
    referenceDocuments: '',
    specialRequirements: '',
    pageLimit: '',
    includeStatistics: false,
    includeSurvey: false,
    requirementsConfirmed: false,
  });

  // Khôi phục referenceDocuments từ sessionStorage khi mount
  useEffect(() => {
    try {
      const savedRefDocs = sessionStorage.getItem(SESSION_REF_DOCS_KEY);
      if (savedRefDocs && !userInfo.referenceDocuments) {
        setUserInfo(prev => ({ ...prev, referenceDocuments: savedRefDocs }));
        console.log(`📄 Đã khôi phục tài liệu tham khảo từ session (${(savedRefDocs.length / 1024).toFixed(1)}KB)`);
      }
    } catch (e) {
      console.warn('Không thể khôi phục tài liệu tham khảo:', e);
    }
  }, []);

  // Lưu referenceDocuments vào sessionStorage khi thay đổi
  useEffect(() => {
    try {
      if (userInfo.referenceDocuments) {
        sessionStorage.setItem(SESSION_REF_DOCS_KEY, userInfo.referenceDocuments);
      } else {
        sessionStorage.removeItem(SESSION_REF_DOCS_KEY);
      }
    } catch (e) {
      console.warn('Text quá lớn cho sessionStorage, bỏ qua persistence:', e);
    }
  }, [userInfo.referenceDocuments]);

  const [state, setState] = useState<GenerationState>({
    step: GenerationStep.INPUT_FORM,
    messages: [],
    fullDocument: '',
    isStreaming: false,
    error: null
  });

  const [outlineFeedback, setOutlineFeedback] = useState("");

  // Phụ lục riêng biệt
  const [appendixDocument, setAppendixDocument] = useState('');
  const [isAppendixLoading, setIsAppendixLoading] = useState(false);


  // ═══════════════════════════════════════════════════════════
  // SESSION PERSISTENCE: Tự động lưu phiên vào localStorage
  // ═══════════════════════════════════════════════════════════

  // Hàm lưu phiên
  const saveSession = useCallback(() => {
    // Chỉ lưu khi đã bắt đầu làm việc (không lưu khi đang ở form nhập)
    if (state.step <= GenerationStep.INPUT_FORM || state.isStreaming) return;

    try {
      const sessionData: SessionData = {
        sessionVersion: SESSION_VERSION,
        userInfo: {
          ...userInfo,
          referenceDocuments: '', // Không lưu ref docs (quá lớn, đã có sessionStorage)
          hasReferenceDocuments: !!userInfo.referenceDocuments,
        } as any,
        state: {
          step: state.step,
          messages: state.messages,
          fullDocument: state.fullDocument,
        },
        appendixDocument,
        outlineFeedback,
        chatHistory: getChatHistory(),
        savedAt: new Date().toISOString(),
      };

      localStorage.setItem(SESSION_SAVE_KEY, JSON.stringify(sessionData));
      setSessionSavedAt(new Date().toLocaleTimeString('vi-VN'));
      console.log('💾 Đã lưu phiên làm việc:', sessionData.state.step);
    } catch (e) {
      console.warn('Không thể lưu phiên (có thể do dữ liệu quá lớn):', e);
    }
  }, [state.step, state.messages, state.fullDocument, state.isStreaming, userInfo, appendixDocument, outlineFeedback]);

  // Tự động lưu khi state thay đổi (debounce 2 giây)
  useEffect(() => {
    if (state.step <= GenerationStep.INPUT_FORM || state.isStreaming) return;

    const timer = setTimeout(() => {
      saveSession();
    }, 2000);

    return () => clearTimeout(timer);
  }, [state.step, state.fullDocument, appendixDocument, saveSession]);

  // Hàm khôi phục phiên
  const restoreSession = useCallback((sessionData: SessionData) => {
    try {
      // Khôi phục userInfo (trừ referenceDocuments)
      const { hasReferenceDocuments, ...savedUserInfo } = sessionData.userInfo as any;
      setUserInfo(prev => ({
        ...prev,
        ...savedUserInfo,
        referenceDocuments: prev.referenceDocuments || '', // Giữ ref docs từ sessionStorage
      }));

      // Khôi phục GenerationState
      setState({
        step: sessionData.state.step,
        messages: (sessionData.state.messages || []) as any,
        fullDocument: sessionData.state.fullDocument || '',
        isStreaming: false,
        error: null,
      });

      // Khôi phục phụ lục
      if (sessionData.appendixDocument) {
        setAppendixDocument(sessionData.appendixDocument);
      }

      // Khôi phục outline feedback
      if (sessionData.outlineFeedback) {
        setOutlineFeedback(sessionData.outlineFeedback);
      }

      // Khôi phục chat history cho Gemini
      if (sessionData.chatHistory && sessionData.chatHistory.length > 0) {
        setChatHistory(sessionData.chatHistory);
      }

      // Initialize Gemini chat với API key
      const savedKey = localStorage.getItem('gemini_api_key');
      const savedModel = localStorage.getItem('selected_model');
      if (savedKey) {
        initializeGeminiChat(savedKey, savedModel || undefined);
        // Khôi phục history SAU khi init (vì init reset history)
        if (sessionData.chatHistory && sessionData.chatHistory.length > 0) {
          setChatHistory(sessionData.chatHistory);
        }
      }

      console.log('✅ Đã khôi phục phiên làm việc thành công!');
    } catch (e) {
      console.error('Lỗi khôi phục phiên:', e);
      setState(prev => ({ ...prev, error: 'Không thể khôi phục phiên làm việc. Vui lòng bắt đầu lại.' }));
    }
  }, []);

  // Hàm xóa phiên đã lưu
  const clearSavedSession = useCallback(() => {
    localStorage.removeItem(SESSION_SAVE_KEY);
    setSessionSavedAt(null);
    console.log('🗑 Đã xóa phiên làm việc đã lưu');
  }, []);

  // Helper: Tính toán phân bổ trang cho từng phần KHKT
  const getPageAllocation = useCallback(() => {
    if (!userInfo.pageLimit || typeof userInfo.pageLimit !== 'number') return null;

    const pages = userInfo.pageLimit;
    const wordsPerPage = 350;
    const charsPerPage = 2500;

    // Phân bổ: Mở đầu (10%), C1 (20%), C2 (15%), C3 (40%), C4 (15%)
    const intro_pages = Math.max(1, Math.round(pages * 0.10));
    const ch1_pages = Math.max(2, Math.round(pages * 0.20));
    const ch2_pages = Math.max(2, Math.round(pages * 0.15));
    const ch3_pages = Math.max(3, Math.round(pages * 0.40));
    const ch4_pages = Math.max(1, pages - intro_pages - ch1_pages - ch2_pages - ch3_pages);

    return {
      totalPages: pages,
      wordsPerPage,
      charsPerPage,
      totalWords: pages * wordsPerPage,
      totalChars: pages * charsPerPage,
      intro: { pages: intro_pages, words: intro_pages * wordsPerPage, chars: intro_pages * charsPerPage },
      chapter1: { pages: ch1_pages, words: ch1_pages * wordsPerPage, chars: ch1_pages * charsPerPage },
      chapter2: { pages: ch2_pages, words: ch2_pages * wordsPerPage, chars: ch2_pages * charsPerPage },
      chapter3: { pages: ch3_pages, words: ch3_pages * wordsPerPage, chars: ch3_pages * charsPerPage },
      chapter4: { pages: ch4_pages, words: ch4_pages * wordsPerPage, chars: ch4_pages * charsPerPage },
    };
  }, [userInfo.pageLimit]);

  // Helper: Tạo prompt giới hạn trang cho một phần cụ thể
  const getSectionPagePrompt = useCallback((sectionName: string, sectionKey: 'intro' | 'chapter1' | 'chapter2' | 'chapter3' | 'chapter4') => {
    const alloc = getPageAllocation();
    if (!alloc) return '';

    const section = alloc[sectionKey];
    return `
🚨 GIỚI HẠN SỐ TRANG CHO PHẦN NÀY (BẮT BUỘC):
📌 ${sectionName}: PHẢI viết khoảng ${section.pages} TRANG (≈ ${section.words.toLocaleString()} từ)
⚠️ Trong tổng ${alloc.totalPages} trang, phần này chiếm ${section.pages} trang.
✅ Viết CÔ ĐỌNG, SÚC TÍCH nhưng ĐẦY ĐỦ NỘI DUNG.
`;
  }, [getPageAllocation]);

  // Helper: Tạo prompt nhắc lại các yêu cầu đặc biệt
  const getPageLimitPrompt = useCallback(() => {
    if (!userInfo.requirementsConfirmed) return '';

    const requirements: string[] = [];

    const alloc = getPageAllocation();
    if (alloc) {
      requirements.push(`
🚨 GIỚI HẠN SỐ TRANG: ${alloc.totalPages} TRANG
📊 PHÂN BỔ:
│ Phần Mở đầu    │ ${alloc.intro.pages} trang │
│ Chương 1        │ ${alloc.chapter1.pages} trang │
│ Chương 2        │ ${alloc.chapter2.pages} trang │
│ Chương 3        │ ${alloc.chapter3.pages} trang │
│ Chương 4        │ ${alloc.chapter4.pages} trang │`);
    }

    if (userInfo.includeStatistics) {
      requirements.push(`
📈 YÊU CẦU BỔ SUNG BẢNG BIỂU, SỐ LIỆU THỐNG KÊ:
- Mỗi chương có bảng biểu hoặc số liệu minh họa
- Số liệu lẻ tự nhiên, format Markdown chuẩn`);
    }

    if (userInfo.specialRequirements?.trim()) {
      requirements.push(`
✏️ YÊU CẦU BỔ SUNG TỪ NGƯỜI DÙNG:
${userInfo.specialRequirements}`);
    }

    if (requirements.length === 0) return '';
    return `\n⚠️ YÊU CẦU ĐẶC BIỆT:\n${requirements.join('\n')}`;
  }, [userInfo.requirementsConfirmed, userInfo.pageLimit, userInfo.includeStatistics, userInfo.specialRequirements, getPageAllocation]);

  // Handle Input Changes
  const handleUserChange = (field: keyof UserInfo, value: string) => {
    setUserInfo(prev => ({ ...prev, [field]: value }));
  };

  // Handle Manual Document Edit
  const handleDocumentUpdate = (newContent: string) => {
    setState(prev => ({ ...prev, fullDocument: newContent }));
  };

  // Handle Manual Outline Submission (Skip Generation)
  const handleManualOutlineSubmit = (content: string) => {
    if (!apiKey) {
      setShowApiModal(true);
      return;
    }

    // Initialize chat session silently so it's ready for next steps
    initializeGeminiChat(apiKey, selectedModel);

    setState(prev => ({
      ...prev,
      fullDocument: content,
      step: GenerationStep.OUTLINE, // Go to Outline step so user can Review/Confirm
      isStreaming: false,
      error: null
    }));
  };

  // Start the Generation Process - KHKT
  const startGeneration = async () => {
    if (!apiKey) {
      setShowApiModal(true);
      return;
    }

    try {
      setState(prev => ({ ...prev, step: GenerationStep.OUTLINE, isStreaming: true, error: null }));

      initializeGeminiChat(apiKey, selectedModel);

      // Tìm thông tin lĩnh vực KHKT
      const fieldInfo = KHKT_FIELDS.find(f => f.name === userInfo.field);

      const initMessage = `
Bạn là chuyên gia hướng dẫn nghiên cứu Khoa học Kỹ thuật (KHKT) hàng đầu Việt Nam, với 20+ năm kinh nghiệm hướng dẫn học sinh THPT tham gia các cuộc thi KHKT cấp tỉnh, quốc gia và quốc tế (ISEF).

NHIỆM VỤ: Lập DÀN Ý CHI TIẾT cho đề tài KHKT dựa trên thông tin được cung cấp.
Dàn ý phải đầy đủ, khoa học, đảm bảo: Tính MỚI, Tính KHOA HỌC, Tính KHẢ THI, Tính ỨNG DỤNG.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔬 NGUYÊN TẮC VIẾT ĐỀ TÀI KHKT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣ NGÔN NGỮ KHOA HỌC: Khách quan, chính xác, logic. Tránh từ cảm tính.
2️⃣ CÓ CÂU HỎI NGHIÊN CỨU: Rõ ràng, có thể kiểm chứng được.
3️⃣ GIẢ THUYẾT KHOA HỌC: Cụ thể, có thể đo lường.
4️⃣ PHƯƠNG PHÁP PHÙ HỢP: Thực nghiệm, khảo sát, mô hình... có nhóm đối chứng.
5️⃣ SỐ LIỆU THỰC TẾ: Xử lý thống kê, có p-value khi cần.
6️⃣ TRÍCH DẪN APA: (Tác giả, năm) cho mọi nguồn tham khảo.
7️⃣ CHỐNG ĐẠO VĂN: Viết lại bằng ngôn ngữ riêng, không copy.
8️⃣ PHÙ HỢP TRÌNH ĐỘ THPT: Nội dung khoa học nhưng phù hợp học sinh.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THÔNG TIN ĐỀ TÀI KHKT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• Tên đề tài: ${userInfo.projectTitle}
• Lĩnh vực: ${userInfo.field}${fieldInfo ? ` (Nhóm: ${fieldInfo.group})` : ''}
• Cấp độ thi: ${userInfo.level}
• Thành viên: ${userInfo.members}
• Giáo viên hướng dẫn: ${userInfo.advisor}
• Trường: ${userInfo.school}
• Địa phương: ${userInfo.location}
• Vấn đề nghiên cứu: ${userInfo.problem}
• Mục tiêu: ${userInfo.objectives}
• Giả thuyết: ${userInfo.hypothesis}
• Phương pháp: ${userInfo.methods}
• Đối tượng NC: ${userInfo.researchSubjects || "Chưa xác định"}
• Thời gian: ${userInfo.timeframe || "Năm học hiện tại"}

${userInfo.referenceDocuments ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TÀI LIỆU THAM KHẢO (DO HỌC SINH CUNG CẤP):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${truncateForPrompt(userInfo.referenceDocuments)}
[HẾT TÀI LIỆU THAM KHẢO]
` : ''}

${userInfo.specialRequirements ? `📝 YÊU CẦU ĐẶC BIỆT: ${userInfo.specialRequirements}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CẤU TRÚC DÀN Ý ĐỀ TÀI KHKT (BẮT BUỘC):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 PHẦN I. MỞ ĐẦU (TỔNG QUAN)
   1. Lý do chọn đề tài
   2. Mục tiêu nghiên cứu
   3. Đối tượng nghiên cứu
   4. Phạm vi nghiên cứu (không gian, thời gian, đối tượng)
   5. Câu hỏi nghiên cứu
   6. Giả thuyết khoa học
   7. Ý nghĩa khoa học và thực tiễn
   8. Phương pháp nghiên cứu
   9. Tính mới (tính sáng tạo) của đề tài

📋 PHẦN II. NỘI DUNG NGHIÊN CỨU

📋 CHƯƠNG 1: CƠ SỞ LÝ LUẬN
   1.1. Khái niệm
   1.2. Kiến thức nền
   1.3. Các nghiên cứu liên quan
   1.4. Cơ sở khoa học

📋 CHƯƠNG 2: THỰC TRẠNG
   2.1. Khảo sát
   2.2. Thu thập dữ liệu
   2.3. Phân tích số liệu
   2.4. Đánh giá hiện trạng

📋 CHƯƠNG 3: THIẾT KẾ GIẢI PHÁP / SẢN PHẨM
   3.1. Ý tưởng
   3.2. Thiết kế
   3.3. Quy trình
   3.4. Nguyên lý hoạt động
   3.5. Công nghệ sử dụng
   3.6. Hình ảnh mô hình

📋 CHƯƠNG 4: THỰC NGHIỆM VÀ ĐÁNH GIÁ
   4.1. Cách triển khai
   4.2. Đối tượng thử nghiệm
   4.3. Kết quả trước - sau
   4.4. Biểu đồ và phân tích
   4.5. Đánh giá hiệu quả

📋 PHẦN III. KẾT LUẬN
   1. Kết luận
   2. Đóng góp của đề tài
   3. Hạn chế
   4. Hướng phát triển
   5. Kiến nghị

📋 PHỤ LỤC: Phiếu khảo sát, bảng số liệu, hình ảnh, nhật ký nghiên cứu, mã nguồn/link/QR và tài liệu minh chứng

📋 TÀI LIỆU THAM KHẢO: Thống nhất theo chuẩn APA hoặc IEEE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YÊU CẦU DÀN Ý:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ DÀN Ý NGẮN GỌN - chỉ liệt kê ĐẦU MỤC CHÍNH
✓ Mỗi phần chỉ ghi tiêu đề và các ý chính (1-2 dòng mỗi ý)
✓ KHÔNG viết đoạn văn dài
✓ Gợi ý danh sách phụ lục cần tạo
✓ Phù hợp với lĩnh vực ${userInfo.field}

${getPageLimitPrompt()}

Cuối dàn ý, hiển thị:
┌─────────────────────────────────┐
│ ✅ Đồng ý dàn ý này?            │
│ ✏️ Bạn có thể CHỈNH SỬA trực   │
│    tiếp bằng nút "Chỉnh sửa"    │
└─────────────────────────────────┘
`;

      let generatedText = "";
      await sendMessageStream(initMessage, (chunk) => {
        generatedText += chunk;
        setState(prev => ({
          ...prev,
          fullDocument: generatedText
        }));
      });

      setState(prev => ({ ...prev, isStreaming: false }));


    } catch (error: any) {
      const errorType = parseApiError(error);
      if (errorType === 'QUOTA_EXCEEDED' || errorType === 'RATE_LIMIT') {
        const rotation = apiKeyManager.markKeyError(apiKey, errorType);
        if (rotation.success && rotation.newKey) {
          console.log(`🔄 Tự động xoay key: ${rotation.message}`);
          setApiKey(rotation.newKey);
          localStorage.setItem('gemini_api_key', rotation.newKey);
          initializeGeminiChat(rotation.newKey, selectedModel);
          setState(prev => ({ ...prev, isStreaming: false, error: null }));
          setTimeout(() => startGeneration(), 500);
          return;
        }
      }
      setState(prev => ({ ...prev, isStreaming: false, error: error.message || "Đã xảy ra lỗi." }));
    }
  };
  // Regenerate Outline based on feedback
  const regenerateOutline = async () => {
    if (!outlineFeedback.trim()) return;

    try {
      setState(prev => ({ ...prev, isStreaming: true, error: null, fullDocument: '' }));

      const feedbackMessage = `
      BẮT ĐẦU phản hồi bằng MENU NAVIGATION trạng thái Bước 2(Lập Dàn Ý - Đang thực hiện).

      Dựa trên dàn ý đã lập, người dùng có yêu cầu chỉnh sửa sau:
"${outlineFeedback}"
      
      Hãy viết lại TOÀN BỘ Dàn ý chi tiết mới đã được cập nhật theo yêu cầu trên. 
      Vẫn đảm bảo cấu trúc chuẩn đề tài KHKT (4 chương).
      
      Lưu ý các quy tắc định dạng:
- Xuống dòng sau mỗi câu.
      - Tách đoạn rõ ràng.
      
      Kết thúc phần dàn ý, hãy xuống dòng và hiển thị hộp thoại:
      ┌─────────────────────────────────┐
      │ ✅ Đồng ý dàn ý này ?            │
      │ ✏️ Bạn có thể CHỈNH SỬA trực   │
      │    tiếp bằng nút "Chỉnh sửa"    │
      └─────────────────────────────────┘
`;

      let generatedText = "";
      await sendMessageStream(feedbackMessage, (chunk) => {
        generatedText += chunk;
        setState(prev => ({
          ...prev,
          fullDocument: generatedText
        }));
      });

      setState(prev => ({ ...prev, isStreaming: false }));
      setOutlineFeedback(""); // Clear feedback after sending

    } catch (error: any) {
      setState(prev => ({ ...prev, isStreaming: false, error: error.message }));
    }
  };

  // Generate Next Section
  const generateNextSection = async () => {
    let currentStepPrompt = "";
    let nextStepEnum = GenerationStep.PHAN_MO_DAU;
    let shouldAppend = true;

    if (state.step === GenerationStep.OUTLINE) {
      currentStepPrompt = `
Đây là bản DÀN Ý CHÍNH THỨC mà tôi đã chốt (có thể đã chỉnh sửa trực tiếp).
Hãy DÙNG CHÍNH XÁC NỘI DUNG NÀY:

--- BẮT ĐẦU DÀN Ý CHÍNH THỨC ---
${state.fullDocument}
--- KẾT THÚC DÀN Ý CHÍNH THỨC ---

NHIỆM VỤ: Viết chi tiết PHẦN I. MỞ ĐẦU (Tổng quan) gồm:
1. Lý do chọn đề tài
2. Mục tiêu nghiên cứu: "${userInfo.objectives}"
3. Đối tượng nghiên cứu: ${userInfo.researchSubjects || 'Chưa xác định'}
4. Phạm vi nghiên cứu (Thời gian: ${userInfo.timeframe || 'Năm học hiện tại'}, Không gian, Đối tượng)
5. Câu hỏi nghiên cứu
6. Giả thuyết khoa học: "${userInfo.hypothesis}"
7. Ý nghĩa khoa học và thực tiễn
8. Phương pháp nghiên cứu: ${userInfo.methods}
9. Tính mới (tính sáng tạo) của đề tài

⚠️ THÔNG TIN ĐỀ TÀI:
- Tên đề tài: ${userInfo.projectTitle}
- KHÔNG tạo phụ lục hình ảnh, video (không hiển thị được)`;

      nextStepEnum = GenerationStep.PHAN_MO_DAU;
      shouldAppend = true;
    } else if (state.step === GenerationStep.PHAN_MO_DAU) {
      currentStepPrompt = `
Dựa vào DÀN Ý CHÍNH THỨC, hãy viết chi tiết CHƯƠNG 1: CƠ SỞ LÝ LUẬN
- 1.1. Khái niệm
- 1.2. Kiến thức nền
- 1.3. Các nghiên cứu liên quan
- 1.4. Cơ sở khoa học

LƯU Ý: Không nhắc lại Phần Mở đầu, chỉ viết tiếp Chương 1.`;
      nextStepEnum = GenerationStep.CHUONG_1;
    } else if (state.step === GenerationStep.CHUONG_1) {
      currentStepPrompt = `
Dựa vào DÀN Ý CHÍNH THỨC, hãy viết chi tiết CHƯƠNG 2: THỰC TRẠNG
- 2.1. Khảo sát
- 2.2. Thu thập dữ liệu
- 2.3. Phân tích số liệu
- 2.4. Đánh giá hiện trạng

LƯU Ý: Nếu đề tài yêu cầu có số liệu, hãy tự sinh số liệu giả lập logic, sử dụng định dạng bảng Markdown.`;
      nextStepEnum = GenerationStep.CHUONG_2;
    } else if (state.step === GenerationStep.CHUONG_2) {
      currentStepPrompt = `
Dựa vào DÀN Ý CHÍNH THỨC, hãy viết chi tiết CHƯƠNG 3: THIẾT KẾ GIẢI PHÁP / SẢN PHẨM
- 3.1. Ý tưởng
- 3.2. Thiết kế
- 3.3. Quy trình
- 3.4. Nguyên lý hoạt động
- 3.5. Công nghệ sử dụng
- 3.6. Hình ảnh mô hình

LƯU Ý: Trình bày chi tiết, chuyên sâu, bám sát các phương pháp khoa học đã nêu.`;
      nextStepEnum = GenerationStep.CHUONG_3;
    } else if (state.step === GenerationStep.CHUONG_3) {
      currentStepPrompt = `
Dựa vào DÀN Ý CHÍNH THỨC, hãy viết chi tiết CHƯƠNG 4: THỰC NGHIỆM VÀ ĐÁNH GIÁ & PHẦN III: KẾT LUẬN
Chương 4:
- 4.1. Cách triển khai
- 4.2. Đối tượng thử nghiệm
- 4.3. Kết quả trước - sau
- 4.4. Biểu đồ và phân tích
- 4.5. Đánh giá hiệu quả

Phần III:
- 1. Kết luận
- 2. Đóng góp của đề tài
- 3. Hạn chế
- 4. Hướng phát triển
- 5. Kiến nghị

Và cuối cùng là TÀI LIỆU THAM KHẢO chuẩn APA.`;
      nextStepEnum = GenerationStep.CHUONG_4;
    } else if (state.step === GenerationStep.CHUONG_4) {
      nextStepEnum = GenerationStep.COMPLETED;
    }

    if (state.step === GenerationStep.CHUONG_4) {
      setState(prev => ({ ...prev, step: GenerationStep.COMPLETED }));
      return;
    }

    try {
      setState(prev => ({ ...prev, step: nextStepEnum, isStreaming: true, error: null }));
      
      const fullPrompt = `${KHKT_CHAPTER_PROMPT}\n\n${currentStepPrompt}`;

      let generatedText = shouldAppend ? state.fullDocument + "\n\n" : "";
      
      await sendMessageStream(fullPrompt, (chunk) => {
        generatedText += chunk;
        setState(prev => ({
          ...prev,
          fullDocument: generatedText
        }));
      });

      setState(prev => ({ ...prev, isStreaming: false }));
    } catch (error: any) {
      const errorType = parseApiError(error);
      if (errorType === 'QUOTA_EXCEEDED' || errorType === 'RATE_LIMIT') {
        const rotation = apiKeyManager.markKeyError(apiKey, errorType);
        if (rotation.success && rotation.newKey) {
          console.log(`🔄 Tự động xoay key: ${rotation.message}`);
          setApiKey(rotation.newKey);
          localStorage.setItem('gemini_api_key', rotation.newKey);
          initializeGeminiChat(rotation.newKey, selectedModel);
          setState(prev => ({ ...prev, isStreaming: false, error: null }));
          
          setState(prev => ({ ...prev, step: state.step }));
          setTimeout(() => generateNextSection(), 500);
          return;
        }
      }
      setState(prev => ({ ...prev, isStreaming: false, error: error.message || "Đã xảy ra lỗi." }));
    }
  };

  // Export Main Document to Word
  const exportToWord = async () => {
    try {
      const { exportMarkdownToDocx } = await import('./services/docxExporter');
      const filename = `KHKT_DeTai_${userInfo.projectTitle.substring(0, 30).replace(/[^a-zA-Z0-9\u00C0-\u1EF9]/g, '_')}.docx`;
      await exportMarkdownToDocx(state.fullDocument, filename);
    } catch (error: any) {
      console.error('Export error:', error);
      alert('Có lỗi khi xuất file Word. Vui lòng thử lại.');
    }
  };

  // Generate Appendix
  const generateAppendix = async () => {
    if (!apiKey) {
      setShowApiModal(true);
      return;
    }

    setIsAppendixLoading(true);

    const khktContext = truncateForPrompt(state.fullDocument, 15000);

    const FORMAT_RULES = `
QUY TẮC ĐỊNH DẠNG:
- KHÔNG tạo bất kỳ hình ảnh nào (tuyệt đối KHÔNG DÙNG cú pháp ![image]).
- Trình bày toàn bộ dưới dạng markdown rõ ràng, xuống dòng sau mỗi câu.
- Có bảng biểu minh họa đầy đủ với số liệu logic.
- Đảm bảo sinh ra ĐẦY ĐỦ VÀ CHI TIẾT toàn bộ các phụ lục liên quan (3-7 phụ lục) TRONG MỘT LẦN TRẢ LỜI, không được ngắt quãng hay yêu cầu xem phần tiếp theo.
- Hãy viết ngay nội dung phụ lục, KHÔNG CẦN CÂU CHÀO HAY XÁC NHẬN.`;

    const TOPIC_INFO = `
- Tên đề tài: ${userInfo.projectTitle}
- Lĩnh vực: ${userInfo.field} | Cấp: ${userInfo.level}
- Trường: ${userInfo.school} | Địa điểm: ${userInfo.location}
- Thành viên: ${userInfo.members} | GVHD: ${userInfo.advisor}`;

    let generatedAppendix = "";

    try {
      const prompt = `TẠO TÀI LIỆU PHỤ LỤC CHO ĐỀ TÀI KHKT

Dựa vào NỘI DUNG ĐỀ TÀI KHKT bên dưới, tạo phụ lục KHỚP với nội dung, số liệu, giải pháp đã đề cập.

NỘI DUNG ĐỀ TÀI KHKT:
${khktContext}

THÔNG TIN ĐỀ TÀI:${TOPIC_INFO}

YÊU CẦU:
Viết chi tiết, đầy đủ toàn bộ các phụ lục cần thiết (như Phiếu khảo sát, Bảng số liệu, Giáo án minh họa, Bài tập mẫu...) cho đề tài trên.
- Bạn phải hoàn thành tất cả phụ lục trong lần này, tuyệt đối KHÔNG ngắt giữa chừng, không báo "Xem phần sau".
- Đối với Giáo án (nếu có): Viết 4 hoạt động đầy đủ.
- Đối với Bài tập (nếu có): Có đề và đáp án.

${FORMAT_RULES}`;

      await sendSinglePromptStream(prompt, (chunk) => {
        generatedAppendix += chunk;
        setAppendixDocument(generatedAppendix);
      });

      setIsAppendixLoading(false);
    } catch (error: any) {
      console.error('Generate Appendix error:', error);
      const errorInfo = getFriendlyErrorMessage(error);
      if (generatedAppendix.trim().length > 0) {
        alert(`Đã tạo được một phần phụ lục.\n\nLỗi: ${errorInfo.title}\n${errorInfo.message}\n\nBạn có thể xuất Word với phần đã tạo hoặc thử lại.`);
      } else {
        alert(`${errorInfo.title}\n\n${errorInfo.message}\n\nGợi ý:\n${errorInfo.suggestions.join('\n')}`);
      }
      setIsAppendixLoading(false);
    }
  };

  // Export Appendix to Word - Xuất phụ lục thành file Word riêng
  const exportAppendixToWord = async () => {
    try {
      const { exportMarkdownToDocx } = await import('./services/docxExporter');
      const filename = `KHKT_Phuluc_${userInfo.projectTitle.substring(0, 30).replace(/[^a-zA-Z0-9\u00C0-\u1EF9]/g, '_')}.docx`;
      await exportMarkdownToDocx(appendixDocument, filename);
    } catch (error: any) {
      console.error('Export Appendix error:', error);
      alert('Có lỗi khi xuất file phụ lục. Vui lòng thử lại.');
    }
  };

  // Render Logic
  // Tính thống kê từ fullDocument
  const docWords = state.fullDocument ? state.fullDocument.split(/\s+/).filter(w => w).length : 0;
  const docPages = Math.max(1, Math.ceil(docWords / 250));
  const overallProgress = state.step >= GenerationStep.COMPLETED ? 100 : Math.round((state.step / GenerationStep.COMPLETED) * 100);

  // Cấu trúc cây sidebar theo blueprint
  const sidebarTree = [
    { step: 0, icon: '📋', label: 'Thông tin dự án', desc: 'Nhập thông tin đề tài' },
    { step: 1, icon: '📝', label: 'Dàn ý tổng quan', desc: 'Lập kế hoạch 4 chương' },
    { step: 2, icon: '📖', label: 'PHẦN I. MỞ ĐẦU', desc: 'Lý do, Mục tiêu, Câu hỏi NC', group: 'intro', children: [
      'Lý do chọn đề tài', 'Mục tiêu nghiên cứu', 'Đối tượng nghiên cứu',
      'Phạm vi nghiên cứu', 'Câu hỏi nghiên cứu', 'Giả thuyết khoa học',
      'Ý nghĩa KH & thực tiễn', 'Phương pháp nghiên cứu', 'Tính mới (sáng tạo)'
    ]},
    { step: -1, icon: '📖', label: 'PHẦN II & III', desc: 'Nội dung và Kết luận', group: 'body', children: [
      { step: 3, label: 'Chương 1. Cơ sở lý luận', subs: ['Khái niệm', 'Kiến thức nền', 'NC liên quan'] },
      { step: 4, label: 'Chương 2. Thực trạng', subs: ['Khảo sát', 'Thu thập dữ liệu', 'Phân tích số liệu'] },
      { step: 5, label: 'Chương 3. Giải pháp', subs: ['Ý tưởng', 'Thiết kế', 'Quy trình', 'Mô hình'] },
      { step: 6, label: 'Chương 4 & Kết luận', subs: ['Thực nghiệm', 'Đánh giá', 'Kết luận', 'Kiến nghị'] },
    ]},
    { step: 7, icon: '📎', label: 'PHỤ LỤC', desc: 'Phiếu KS, Số liệu, Minh chứng' },
  ];

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const toggleSection = (key: string) => setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));

  const getStepStatus = (stepNum: number) => {
    if (state.error && state.step === stepNum) return 'error';
    if (state.step === stepNum && state.isStreaming) return 'streaming';
    if (state.step > stepNum) return 'done';
    if (state.step === stepNum) return 'active';
    return 'pending';
  };

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === 'error') return <AlertTriangle className="w-3.5 h-3.5 text-red-500" />;
    if (status === 'streaming') return <div className="w-2 h-2 rounded-full bg-teal-500 animate-ping" />;
    if (status === 'done') return <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />;
    if (status === 'active') return <div className="w-2.5 h-2.5 rounded-full bg-teal-500 ring-4 ring-teal-100" />;
    return <div className="w-2 h-2 rounded-full bg-gray-300" />;
  };

  const renderSidebar = () => {
    return (
      <div className="w-full lg:w-80 bg-gradient-to-b from-white to-teal-50/50 border-r border-teal-100 flex-shrink-0 flex flex-col h-full overflow-y-auto shadow-[4px_0_24px_rgba(20,184,166,0.06)]">
        {/* Header */}
        <div className="p-5 pb-3">
          <h1 className="text-lg font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-emerald-500 flex items-center gap-2" style={{ fontFamily: 'Nunito, sans-serif' }}>
            <Wand2 className="h-5 w-5 text-teal-500" />
            KHKT WRITER PRO 2026
          </h1>
          {/* Stats bar */}
          {state.step > GenerationStep.INPUT_FORM && (
            <div className="mt-3 p-2.5 bg-teal-50 rounded-lg border border-teal-100">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-semibold text-teal-700 uppercase tracking-wider">Tiến độ</span>
                <span className="text-xs font-bold text-teal-600">{overallProgress}%</span>
              </div>
              <div className="w-full h-2 bg-teal-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full transition-all duration-500" style={{ width: `${overallProgress}%` }} />
              </div>
              <div className="flex justify-between mt-2 text-[10px] text-teal-600">
                <span>📝 {docWords.toLocaleString()} từ</span>
                <span>📄 ~{docPages} trang</span>
                <span>📊 {state.step}/{GenerationStep.COMPLETED} phần</span>
              </div>
            </div>
          )}
        </div>

        {/* Tree Navigation */}
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          <div className="space-y-0.5">
            {sidebarTree.map((item, idx) => {
              // Mục đơn (không phải group B. NỘI DUNG)
              if (item.step >= 0 && !item.children) {
                const status = getStepStatus(item.step);
                const isClickable = state.step > item.step && !state.isStreaming;
                return (
                  <div key={idx}
                    onClick={() => isClickable && setState(prev => ({ ...prev, step: item.step }))}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                      status === 'active' ? 'bg-teal-100 text-teal-900 font-semibold' :
                      status === 'done' ? 'text-gray-700 hover:bg-gray-50' :
                      status === 'error' ? 'bg-red-50 text-red-700' :
                      status === 'streaming' ? 'bg-teal-50 text-teal-700' :
                      'text-gray-400'
                    } ${isClickable ? 'cursor-pointer' : ''}`}
                  >
                    <span className="text-base">{item.icon}</span>
                    <span className="flex-1 truncate">{item.label}</span>
                    <StatusIcon status={status} />
                  </div>
                );
              }

              // Mục A. MỞ ĐẦU (có children là string[])
              if (item.group === 'intro') {
                const status = getStepStatus(item.step);
                const isOpen = !collapsedSections['intro'];
                const isClickable = state.step > item.step && !state.isStreaming;
                return (
                  <div key={idx}>
                    <div
                      onClick={() => { toggleSection('intro'); if (isClickable) setState(prev => ({ ...prev, step: item.step })); }}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all cursor-pointer ${
                        status === 'active' ? 'bg-teal-100 text-teal-900 font-semibold' :
                        status === 'done' ? 'text-gray-700 hover:bg-gray-50' :
                        status === 'streaming' ? 'bg-teal-50 text-teal-700' :
                        'text-gray-400'
                      }`}
                    >
                      <span className="text-base">{item.icon}</span>
                      <span className="flex-1">{item.label}</span>
                      <StatusIcon status={status} />
                      <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                    </div>
                    {isOpen && (
                      <div className="ml-7 mt-0.5 space-y-0 border-l-2 border-teal-100 pl-3">
                        {(item.children as string[]).map((child, ci) => (
                          <div key={ci} className="flex items-center gap-2 py-1 text-xs text-gray-500">
                            <span className="w-1 h-1 rounded-full bg-gray-300 flex-shrink-0" />
                            <span className="truncate">{ci + 1}. {child}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              // Mục B. NỘI DUNG (children là chapters)
              if (item.group === 'body') {
                const isOpen = !collapsedSections['body'];
                const bodyChildren = item.children as Array<{ step: number; label: string; subs: string[] }>;
                // Progress = bao nhiêu chương đã viết
                const chaptersDone = bodyChildren.filter(ch => state.step > ch.step).length;
                const bodyProgress = Math.round((chaptersDone / bodyChildren.length) * 100);
                return (
                  <div key={idx}>
                    <div onClick={() => toggleSection('body')}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer text-gray-700 hover:bg-gray-50 transition-all"
                    >
                      <span className="text-base">{item.icon}</span>
                      <span className="flex-1 font-medium">{item.label}</span>
                      {bodyProgress > 0 && <span className="text-[10px] font-bold text-emerald-600">{bodyProgress}%</span>}
                      <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                    </div>
                    {isOpen && (
                      <div className="ml-4 mt-0.5 space-y-0.5">
                        {bodyChildren.map((ch, ci) => {
                          const chStatus = getStepStatus(ch.step);
                          const chClickable = state.step > ch.step && !state.isStreaming;
                          const chKey = `ch${ci}`;
                          const chOpen = !collapsedSections[chKey];
                          return (
                            <div key={ci}>
                              <div
                                onClick={() => { toggleSection(chKey); if (chClickable) setState(prev => ({ ...prev, step: ch.step })); }}
                                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-all ${
                                  chStatus === 'active' ? 'bg-teal-50 text-teal-800 font-semibold' :
                                  chStatus === 'done' ? 'text-gray-600' :
                                  chStatus === 'streaming' ? 'bg-teal-50 text-teal-700' :
                                  'text-gray-400'
                                } ${chClickable ? 'cursor-pointer hover:bg-gray-50' : 'cursor-pointer'}`}
                              >
                                <StatusIcon status={chStatus} />
                                <span className="flex-1 truncate">{ch.label}</span>
                                <ChevronRight className={`w-3 h-3 transition-transform ${chOpen ? 'rotate-90' : ''}`} />
                              </div>
                              {chOpen && (
                                <div className="ml-6 border-l border-gray-100 pl-2.5 space-y-0">
                                  {ch.subs.map((sub, si) => (
                                    <div key={si} className="flex items-center gap-1.5 py-0.5 text-[11px] text-gray-400">
                                      <span className="w-1 h-1 rounded-full bg-gray-200 flex-shrink-0" />
                                      <span className="truncate">{sub}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              return null;
            })}
          </div>
        </div>

        {/* Bottom Controls */}
        <div className="p-4 border-t border-teal-100 bg-white/80 backdrop-blur-sm">
          {state.step > GenerationStep.INPUT_FORM && (
            <div className="space-y-2.5">
              <div className="p-2.5 bg-gray-50 rounded-lg text-xs text-gray-500 border border-gray-100">
                <span className="font-bold block text-gray-800 truncate">📌 {userInfo.projectTitle}</span>
                {userInfo.field && <span className="text-[10px] text-teal-600">🔬 {userInfo.field}</span>}
              </div>

              {/* Session buttons */}
              <div className="flex gap-1.5">
                <button onClick={saveSession}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[11px] font-medium transition-colors border border-emerald-200"
                >
                  <Save size={12} /> Lưu phiên
                </button>
                <button onClick={() => { if (confirm('Xóa phiên đã lưu?')) clearSavedSession(); }}
                  className="flex items-center justify-center px-2 py-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg text-[11px] transition-colors border border-red-200"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              {sessionSavedAt && <p className="text-[9px] text-gray-400 text-center">💾 {sessionSavedAt}</p>}

              {/* Controls */}
              {state.isStreaming ? (
                <Button disabled className="w-full text-sm" isLoading>Đang viết...</Button>
              ) : (
                state.step < GenerationStep.COMPLETED && (
                  <>
                    {state.step === GenerationStep.OUTLINE && (
                      <div className="space-y-2 border-t border-gray-100 pt-2">
                        <div className="text-[11px] text-gray-500 italic">💡 Sửa trực tiếp dàn ý bên phải hoặc nhập yêu cầu:</div>
                        <textarea value={outlineFeedback} onChange={(e) => setOutlineFeedback(e.target.value)}
                          placeholder="Nhập yêu cầu để AI viết lại..."
                          className="w-full p-2 text-xs border border-gray-200 rounded-lg focus:ring-teal-500 focus:border-teal-500" rows={2}
                        />
                        <Button variant="secondary" onClick={regenerateOutline} disabled={!outlineFeedback.trim()} className="w-full text-xs" icon={<RefreshCw size={12} />}>
                          AI viết lại dàn ý
                        </Button>
                      </div>
                    )}
                    <Button onClick={generateNextSection} className="w-full text-sm" icon={<ChevronRight size={14} />}>
                      {state.step === GenerationStep.OUTLINE ? 'Chốt & Viết tiếp' : 'Viết phần tiếp theo'}
                    </Button>
                  </>
                )
              )}

              {state.step >= GenerationStep.OUTLINE && (
                <Button variant="secondary" onClick={exportToWord} className="w-full text-sm" icon={<Download size={14} />}>
                  📥 Xuất Word KHKT
                </Button>
              )}

              {state.step >= GenerationStep.COMPLETED && (
                !appendixDocument ? (
                  <Button onClick={generateAppendix} isLoading={isAppendixLoading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-sm" icon={<FileText size={14} />}>
                    {isAppendixLoading ? 'Đang tạo phụ lục...' : 'TẠO PHỤ LỤC'}
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={exportAppendixToWord} className="w-full border-emerald-500 text-emerald-700 text-sm" icon={<Download size={14} />}>
                    Xuất Word Phụ lục
                  </Button>
                )
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (checkingAuth) {
    return <div className="h-screen w-screen bg-white flex items-center justify-center"></div>;
  }

  if (!isUnlocked) {
    return <LockScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50 flex flex-col lg:flex-row font-sans text-gray-900">
      <ApiKeyModal
        isOpen={showApiModal}
        onSave={handleSaveApiKey}
        onClose={() => setShowApiModal(false)}
        isDismissible={!!apiKey}
      />

      {/* Session Restore Modal */}
      {showRestoreModal && pendingSessionData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-sky-500 p-6 text-white">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Save className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Khôi phục phiên làm việc</h3>
                  <p className="text-sm text-blue-100">Bạn có phiên làm việc chưa hoàn thành</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-700">
                  <span className="font-semibold text-sky-800">Đề tài:</span>{' '}
                  {(pendingSessionData.userInfo as any).projectTitle || (pendingSessionData.userInfo as any).topic || 'Không rõ'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Đã lưu lúc: {new Date(pendingSessionData.savedAt).toLocaleString('vi-VN')}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Tiến độ: Bước {pendingSessionData.state.step} / {GenerationStep.COMPLETED}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowRestoreModal(false);
                    clearSavedSession();
                    setPendingSessionData(null);
                  }}
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors text-sm"
                >
                  ✖ Bắt đầu mới
                </button>
                <button
                  onClick={() => {
                    restoreSession(pendingSessionData);
                    setShowRestoreModal(false);
                    setPendingSessionData(null);
                  }}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-sky-500 hover:from-blue-600 hover:to-sky-600 text-white rounded-xl font-bold transition-colors text-sm shadow-lg"
                >
                  ✔ Tiếp tục làm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header Button for Settings + dòng chữ đỏ theo LỆNH.md */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-3">
        <span className="text-red-600 font-bold text-xs sm:text-sm animate-pulse hidden sm:inline">Lấy API key để sử dụng app</span>
        <button
          onClick={() => setShowApiModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-blue-100 hover:bg-blue-50 hover:border-blue-200 hover:shadow-xl transition-all duration-200"
          title="Cấu hình API Key"
        >
          <Settings size={18} className="text-blue-600" />
          <span className="text-blue-700 font-semibold text-sm hidden sm:inline">Cài đặt API Key</span>
        </button>
      </div>

      {/* Sidebar (Desktop) */}
      <div className="hidden lg:block h-screen sticky top-0 z-20">
        {renderSidebar()}
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 lg:p-8 flex flex-col h-screen overflow-hidden relative">

        {/* Mobile Header */}
        <div className="lg:hidden mb-4 bg-gradient-to-r from-white to-teal-50 p-4 rounded-xl shadow-lg border border-teal-100 flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <h1 className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-emerald-500 text-lg" style={{ fontFamily: 'Nunito, sans-serif' }}>TRỢ LÝ VIẾT KHKT 2026</h1>
            <span className="text-xs bg-teal-100 text-teal-700 px-3 py-1 rounded-full font-medium">
              {STEPS_INFO[Math.min(state.step, GenerationStep.COMPLETED)]?.label || ''}
            </span>
          </div>
          <p className="text-xs text-teal-700 font-medium">🔬 Trợ lý viết đề tài Khoa học Kỹ thuật thông minh</p>
        </div>

        {state.error && (() => {
          const errorInfo = getFriendlyErrorMessage({ message: state.error });
          return (
            <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl p-5 mb-4 shadow-sm">
              {/* Header */}
              <div className="flex items-start gap-3 mb-3">
                <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-red-800 text-lg">{errorInfo.title}</h3>
                  <p className="text-red-700 text-sm mt-1">{errorInfo.message}</p>
                </div>
              </div>

              {/* Suggestions */}
              <div className="bg-white/70 rounded-lg p-4 mt-3 border border-red-100">
                <p className="text-sm font-semibold text-gray-700 mb-2">💡 Gợi ý khắc phục:</p>
                <ul className="space-y-2">
                  {errorInfo.suggestions.map((suggestion, index) => (
                    <li key={index} className="text-sm text-gray-600 flex items-start gap-2">
                      <span className="text-gray-400">•</span>
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Hướng dẫn thao tác cho người dùng */}
              {state.step > GenerationStep.INPUT_FORM && (
                <div className="bg-gradient-to-r from-blue-50 to-emerald-50 rounded-lg p-4 mt-3 border border-blue-200">
                  <p className="text-sm font-bold text-blue-800 mb-2">📋 Bạn có 2 lựa chọn:</p>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="text-emerald-600 font-bold text-sm mt-0.5">1.</span>
                      <p className="text-sm text-gray-700">
                        <span className="font-semibold text-emerald-700">Bấm "🔄 Thử lại (đổi key)"</span> - App sẽ tự động chuyển sang API key dự phòng và tiếp tục chạy ngay, không mất dữ liệu.
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-sky-600 font-bold text-sm mt-0.5">2.</span>
                      <p className="text-sm text-gray-700">
                        <span className="font-semibold text-sky-700">Bấm "💾 Lưu phiên" ở thanh bên trái</span> rồi tắt app. Hôm sau mở lại, API key sẽ được reset và bạn tiếp tục từ chỗ đã dừng.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 mt-4">
                <button
                  onClick={() => setState(prev => ({ ...prev, error: null }))}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  ✕ Đóng thông báo
                </button>
                <button
                  onClick={() => setShowApiModal(true)}
                  className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 transition-colors"
                >
                  🔑 Đổi API Key
                </button>
                {/* 🆕 Nút Thử lại - xoay sang API key dự phòng và retry */}
                {state.step > GenerationStep.INPUT_FORM && (
                  <button
                    onClick={() => {
                      // Xoay sang API key tiếp theo trước khi thử lại
                      const rotation = apiKeyManager.rotateToNextKey('manual_retry');
                      let keyToUse = apiKey;
                      if (rotation.success && rotation.newKey) {
                        keyToUse = rotation.newKey;
                        setApiKey(keyToUse);
                        localStorage.setItem('gemini_api_key', keyToUse);
                        console.log(`🔑 Đã xoay sang key mới: ${rotation.message}`);
                      } else {
                        // Nếu không có key khác, reset tất cả key và thử lại
                        apiKeyManager.resetAllKeys();
                        const freshKey = apiKeyManager.getActiveKey();
                        if (freshKey) {
                          keyToUse = freshKey;
                          setApiKey(keyToUse);
                          localStorage.setItem('gemini_api_key', keyToUse);
                          console.log('🔄 Đã reset tất cả key và thử lại');
                        }
                      }
                      setState(prev => ({ ...prev, error: null }));
                      initializeGeminiChat(keyToUse, selectedModel);
                      // Khôi phục chat history trước khi retry
                      const savedHistory = getChatHistory();
                      if (savedHistory.length > 0) {
                        setChatHistory(savedHistory);
                      }
                      setTimeout(() => {
                        generateNextSection();
                      }, 300);
                    }}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2"
                  >
                    <RefreshCw size={16} />
                    🔄 Thử lại (đổi key)
                  </button>
                )}
                <a
                  href="https://ai.google.dev/gemini-api/docs/api-key"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
                >
                  📖 Hướng dẫn lấy API Key
                </a>
              </div>
            </div>
          );
        })()}

        {state.step === GenerationStep.INPUT_FORM ? (
          <div className="flex-1 flex items-start justify-center overflow-y-auto">
            <KHKTForm
              userInfo={userInfo}
              onChange={handleUserChange}
              onSubmit={startGeneration}
              onManualSubmit={handleManualOutlineSubmit}
              isSubmitting={state.isStreaming}
              apiKey={apiKey}
              selectedModel={selectedModel}
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0 relative">
            <div className="flex-1 flex flex-col min-h-0 relative">
              <DocumentPreview
                content={state.fullDocument}
                onUpdate={handleDocumentUpdate}
                isEditable={!state.isStreaming}
              />

              {/* Mobile Controls Floating */}
              <div className="lg:hidden absolute bottom-4 left-4 right-4 flex gap-2 shadow-lg z-20">
                {!state.isStreaming && state.step < GenerationStep.COMPLETED && (
                  <Button onClick={generateNextSection} className="flex-1 shadow-xl">
                    {state.step === GenerationStep.OUTLINE ? 'Chốt & Tiếp tục' : 'Viết tiếp'}
                  </Button>
                )}
                <Button onClick={exportToWord} variant="secondary" className="bg-white shadow-xl text-sky-700">
                  <Download size={20} />
                </Button>
              </div>
            </div>

            <div className="w-full lg:w-[400px] flex-shrink-0 flex flex-col min-h-0 bg-white shadow-xl rounded-xl border border-gray-200 overflow-hidden">
              <AIActionPanel
                apiKey={apiKey}
                selectedModel={selectedModel}
                currentStep={state.step}
                documentContent={state.fullDocument}
                projectInfo={userInfo}
                onUpdateDocument={handleDocumentUpdate}
                onInsertText={(text) => {
                  setState(prev => ({
                    ...prev,
                    fullDocument: prev.fullDocument + "\n\n" + text
                  }));
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
