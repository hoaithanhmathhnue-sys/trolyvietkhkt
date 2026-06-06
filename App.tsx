import React, { useState, useEffect, useCallback } from 'react';
import { UserInfo, GenerationStep, GenerationState } from './types';
import { STEPS_INFO, KHKT_CHAPTER_PROMPT, FALLBACK_MODELS, MODEL_DISPLAY_ORDER } from './constants';
import { initializeGeminiChat, sendMessageStream, sendSinglePromptStream, getFriendlyErrorMessage, parseApiError, getChatHistory, setChatHistory } from './services/geminiService';
import { apiKeyManager } from './services/apiKeyManager';
import { KHKT_FIELDS } from './data/khktKnowledge';
import { KHKTForm } from './components/KHKTForm';
import { DocumentPreview } from './components/DocumentPreview';
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

📋 PHẦN MỞ ĐẦU
   1. Lý do chọn đề tài
   2. Câu hỏi nghiên cứu
   3. Giả thuyết khoa học
   4. Mục đích nghiên cứu
   5. Đối tượng và phạm vi nghiên cứu
   6. Phương pháp nghiên cứu
   7. Ý nghĩa khoa học và thực tiễn

📋 CHƯƠNG 1: TỔNG QUAN TÀI LIỆU
   1.1. Cơ sở lý thuyết
   1.2. Tình hình nghiên cứu trong và ngoài nước
   1.3. Các khái niệm cơ bản

📋 CHƯƠNG 2: ĐỐI TƯỢNG VÀ PHƯƠNG PHÁP NGHIÊN CỨU
   2.1. Đối tượng nghiên cứu
   2.2. Phương pháp nghiên cứu cụ thể
   2.3. Thiết kế thí nghiệm / Quy trình
   2.4. Công cụ và phương tiện
   2.5. Phương pháp xử lý số liệu

📋 CHƯƠNG 3: KẾT QUẢ NGHIÊN CỨU VÀ THẢO LUẬN
   3.1. Kết quả nghiên cứu (bảng, biểu đồ)
   3.2. Phân tích và thảo luận
   3.3. Sản phẩm nghiên cứu (nếu có)

📋 CHƯƠNG 4: KẾT LUẬN VÀ KIẾN NGHỊ
   4.1. Kết luận
   4.2. Kiến nghị
   4.3. Hướng phát triển

📋 PHỤ LỤC: Tài liệu tham khảo, Phiếu khảo sát, Số liệu thô

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

NHIỆM VỤ: Viết chi tiết PHẦN MỞ ĐẦU gồm:
1. Lý do chọn đề tài (tại sao vấn đề này quan trọng?)
2. Câu hỏi nghiên cứu
3. Giả thuyết khoa học: "${userInfo.hypothesis}"
4. Mục đích nghiên cứu: "${userInfo.objectives}"
5. Đối tượng và phạm vi nghiên cứu
6. Phương pháp nghiên cứu: ${userInfo.methods}
7. Ý nghĩa khoa học và thực tiễn

⚠️ THÔNG TIN ĐỀ TÀI:
- Tên đề tài: ${userInfo.projectTitle}
- Lĩnh vực: ${userInfo.field}
- Trường: ${userInfo.school}, ${userInfo.location}
- Thành viên: ${userInfo.members}
- GVHD: ${userInfo.advisor}

${getPageLimitPrompt()}
${getSectionPagePrompt('Phần Mở đầu', 'intro')}

FORMAT: Xuống dòng sau mỗi câu. Tách đoạn rõ ràng. Ngôn ngữ khoa học.`;

      nextStepEnum = GenerationStep.PHAN_MO_DAU;
    } else {
      const nextStepMap: Record<number, { prompt: string, nextStep: GenerationStep, skipAppend?: boolean }> = {
        [GenerationStep.PHAN_MO_DAU]: {
          prompt: `
Tiếp tục viết CHƯƠNG 1: TỔNG QUAN TÀI LIỆU

Nội dung bao gồm:
1.1. Cơ sở lý thuyết liên quan đến "${userInfo.projectTitle}"
     - Các khái niệm cơ bản, định nghĩa khoa học
     - Lý thuyết nền tảng (trích dẫn APA)
     
1.2. Tình hình nghiên cứu trong và ngoài nước
     - Ít nhất 3-5 nghiên cứu liên quan (trong nước)
     - Ít nhất 2-3 nghiên cứu quốc tế
     - Phân tích khoảng trống nghiên cứu
     
1.3. Các khái niệm cơ bản
     - Định nghĩa, thuật ngữ then chốt

⚠️ Lĩnh vực: ${userInfo.field}. Trích dẫn theo chuẩn APA.
${getPageLimitPrompt()}
${getSectionPagePrompt('Chương 1: Tổng quan tài liệu', 'chapter1')}
FORMAT: Xuống dòng sau mỗi câu. Bảng Markdown chuẩn. Ngôn ngữ khoa học.`,
          nextStep: GenerationStep.CHUONG_1
        },
        [GenerationStep.CHUONG_1]: {
          prompt: `
Tiếp tục viết CHƯƠNG 2: ĐỐI TƯỢNG VÀ PHƯƠNG PHÁP NGHIÊN CỨU

Nội dung bao gồm:
2.1. Đối tượng nghiên cứu
     - Mô tả chi tiết đối tượng: ${userInfo.researchSubjects || 'Chưa xác định'}
     - Phạm vi nghiên cứu (thời gian: ${userInfo.timeframe || 'Năm học hiện tại'})

2.2. Phương pháp nghiên cứu cụ thể
     - Phương pháp chính: ${userInfo.methods}
     - Mô tả chi tiết từng phương pháp
     
2.3. Thiết kế thí nghiệm / Quy trình nghiên cứu
     - Sơ đồ quy trình (mô tả dạng bước)
     - Nhóm thực nghiệm và nhóm đối chứng (nếu có)
     - Các biến số: biến độc lập, biến phụ thuộc, biến kiểm soát

2.4. Công cụ và phương tiện nghiên cứu

2.5. Phương pháp xử lý số liệu
     - Phần mềm thống kê sử dụng
     - Các chỉ số phân tích: trung bình, độ lệch chuẩn, p-value

${getPageLimitPrompt()}
${getSectionPagePrompt('Chương 2: Đối tượng & PP nghiên cứu', 'chapter2')}`,
          nextStep: GenerationStep.CHUONG_2
        },
        [GenerationStep.CHUONG_2]: {
          prompt: `
Tiếp tục viết CHƯƠNG 3: KẾT QUẢ NGHIÊN CỨU VÀ THẢO LUẬN

⚠️ ĐÂY LÀ CHƯƠNG QUAN TRỌNG NHẤT - cần bảng biểu, số liệu chi tiết.

Nội dung bao gồm:
3.1. Kết quả nghiên cứu
     - Trình bày kết quả bằng BẢNG SỐ LIỆU (Markdown)
     - Biểu đồ gợi ý (mô tả bằng text)
     - Số liệu dùng số lẻ tự nhiên (42.3%, 67.8%)
     - Có p-value, mean, SD khi cần

3.2. Phân tích và thảo luận kết quả
     - Giải thích các kết quả thu được
     - So sánh với giả thuyết: "${userInfo.hypothesis}"
     - Phân tích nguyên nhân

3.3. Sản phẩm nghiên cứu (nếu có)
     - Mô tả sản phẩm/mô hình/thiết bị đã tạo
     - Thông số kỹ thuật

3.4. So sánh với các nghiên cứu trước
     - Điểm tương đồng và khác biệt
     - Đóng góp mới của nghiên cứu

${getPageLimitPrompt()}
${getSectionPagePrompt('Chương 3: Kết quả & Thảo luận', 'chapter3')}
FORMAT: BẮT BUỘC có ít nhất 2-3 bảng số liệu Markdown. Ngôn ngữ khoa học, khách quan.`,
          nextStep: GenerationStep.CHUONG_3
        },
        [GenerationStep.CHUONG_3]: {
          prompt: `
Tiếp tục viết CHƯƠNG 4: KẾT LUẬN VÀ KIẾN NGHỊ

Nội dung bao gồm:
4.1. Kết luận
     - Tóm tắt kết quả nghiên cứu chính
     - Kết luận về giả thuyết (chấp nhận/bác bỏ)
     - Đóng góp của nghiên cứu

4.2. Kiến nghị
     - Kiến nghị ứng dụng kết quả
     - Kiến nghị với nhà trường, địa phương

4.3. Hướng phát triển
     - Hạn chế của nghiên cứu hiện tại
     - Hướng nghiên cứu tiếp theo

TÀI LIỆU THAM KHẢO (chuẩn APA):
- Liệt kê 10-15 tài liệu (cả tiếng Việt và tiếng Anh)
- Sắp xếp theo thứ tự ABC tên tác giả

${getPageLimitPrompt()}
${getSectionPagePrompt('Chương 4: Kết luận & Kiến nghị', 'chapter4')}`,
          nextStep: GenerationStep.CHUONG_4
        },
        [GenerationStep.CHUONG_4]: {
          prompt: `
✅ ĐỀ TÀI KHKT ĐÃ HOÀN THÀNH NỘI DUNG CHÍNH!

📌 BÂY GIỜ BẠN CÓ THỂ:
1. Xuất file Word để chỉnh sửa chi tiết
2. Tạo PHỤ LỤC chi tiết bằng nút "TẠO PHỤ LỤC"
3. Kiểm tra lại nội dung và định dạng

Chúc mừng nhóm nghiên cứu đã hoàn thành bản thảo đề tài KHKT!`,
          nextStep: GenerationStep.COMPLETED,
          skipAppend: true
        }
      };
      const stepConfig = nextStepMap[state.step];
      if (!stepConfig) return;
      currentStepPrompt = stepConfig.prompt;
      nextStepEnum = stepConfig.nextStep;
      shouldAppend = !stepConfig.skipAppend;
    }
    if (!currentStepPrompt) return;

    setState(prev => ({ ...prev, isStreaming: true, error: null, step: nextStepEnum }));

    try {
      let sectionText = "\n\n---\n\n"; // Separator
      await sendMessageStream(currentStepPrompt, (chunk) => {
        sectionText += chunk;
        if (shouldAppend) {
          setState(prev => ({
            ...prev,
            fullDocument: prev.fullDocument + chunk
          }));
        }
      });

      // Just set streaming to false, step was already set
      setState(prev => ({ ...prev, isStreaming: false }));

    } catch (error: any) {
      // Thử xoay API key nếu lỗi quota/rate limit
      const errorType = parseApiError(error);
      if (errorType === 'QUOTA_EXCEEDED' || errorType === 'RATE_LIMIT') {
        const rotation = apiKeyManager.markKeyError(apiKey, errorType);
        if (rotation.success && rotation.newKey) {
          console.log(`🔄 Tự động xoay key: ${rotation.message}`);
          setApiKey(rotation.newKey);
          localStorage.setItem('gemini_api_key', rotation.newKey);
          initializeGeminiChat(rotation.newKey, selectedModel);
          // Tự động thử lại với key mới
          setState(prev => ({ ...prev, isStreaming: false, error: null }));
          setTimeout(() => generateNextSection(), 500);
          return;
        }
      }
      setState(prev => ({ ...prev, isStreaming: false, error: error.message }));
    }
  };

  // Export to Word
  const exportToWord = async () => {
    try {
      const { exportMarkdownToDocx } = await import('./services/docxExporter');
      const filename = `KHKT_${userInfo.projectTitle.substring(0, 30).replace(/[^a-zA-Z0-9\u00C0-\u1EF9]/g, '_')}.docx`;
      await exportMarkdownToDocx(state.fullDocument, filename);
    } catch (error: any) {
      console.error('Export error:', error);
      alert('Có lỗi khi xuất file. Vui lòng thử lại.');
    }
  };


  // Generate Appendix - Dùng sendSinglePromptStream (không chat) để tránh history tích lũy
  // Chia thành 3 batch, mỗi batch hoàn toàn độc lập
  const generateAppendix = async () => {
    if (!apiKey) {
      setShowApiModal(true);
      return;
    }

    if (!state.fullDocument || state.fullDocument.trim().length < 100) {
      alert('Chưa có nội dung đề tài KHKT đầy đủ. Vui lòng hoàn thành viết đề tài KHKT trước khi tạo phụ lục.');
      return;
    }

    setIsAppendixLoading(true);

    // Đảm bảo API key được set cho sendSinglePromptStream
    initializeGeminiChat(apiKey, selectedModel);

    // === Truncate đề tài KHKT: lấy đầu + cuối, bỏ phần giữa (giải pháp chi tiết) ===
    const fullDoc = state.fullDocument;
    const MAX_CONTEXT = 20000;
    let khktContext = fullDoc;
    if (fullDoc.length > MAX_CONTEXT) {
      const headSize = 12000;
      const tailSize = 8000;
      khktContext = fullDoc.substring(0, headSize)
        + '\n\n[...PHẦN GIẢI PHÁP CHI TIẾT ĐÃ LƯỢC BỎ ĐỂ TIẾT KIỆM...]\n\n'
        + fullDoc.substring(fullDoc.length - tailSize);
    }

    // === YÊU CẦU FORMAT DÙNG CHUNG ===
    const FORMAT_RULES = `
YÊU CẦU FORMAT VÀ NỘI DUNG (BẮT BUỘC):
- VIẾT ĐẦY ĐỦ NỘI DUNG thực tế, KHÔNG viết tắt, KHÔNG ghi "...", "[nội dung]", "[điền vào]"
- Phiếu khảo sát: 10-15 câu hỏi cụ thể. Giáo án: chi tiết từng hoạt động
- Rubric: đầy đủ tiêu chí. Bài tập: đề bài + đáp án. Số liệu: khớp đề tài KHKT
- Markdown chuẩn, bảng đầy đủ cột, bắt đầu từ đầu dòng
- KHÔNG tạo phụ lục hình ảnh, video (không hiển thị được)`;

    // === THÔNG TIN ĐỀ TÀI ===
    const TOPIC_INFO = `
- Tên đề tài: ${userInfo.projectTitle}
- Lĩnh vực: ${userInfo.field} | Cấp: ${userInfo.level}
- Trường: ${userInfo.school} | Địa điểm: ${userInfo.location}
- Thành viên: ${userInfo.members} | GVHD: ${userInfo.advisor}`;

    let generatedAppendix = "";

    try {

      // =============================================
      // BATCH 1: Gửi đề tài KHKT context + viết 2 phụ lục đầu
      // Dùng sendSinglePromptStream (KHÔNG chat, KHÔNG history)
      // =============================================
      const batch1Prompt = `TẠO TÀI LIỆU PHỤ LỤC CHO ĐỀ TÀI KHKT (PHẦN 1/3)

Dựa vào NỘI DUNG ĐỀ TÀI KHKT bên dưới, tạo phụ lục KHỚP với nội dung, số liệu, giải pháp đã đề cập.

NỘI DUNG ĐỀ TÀI KHKT:
${khktContext}

THÔNG TIN ĐỀ TÀI:${TOPIC_INFO}

Xác định các phụ lục cần tạo (3-7 phụ lục tùy dàn ý). Liệt kê ngắn gọn danh sách (2-3 dòng), rồi VIẾT CHI TIẾT 2 PHỤ LỤC ĐẦU TIÊN.

${FORMAT_RULES}`;

      const batch1Response = await sendSinglePromptStream(batch1Prompt, (chunk) => {
        generatedAppendix += chunk;
        setAppendixDocument(generatedAppendix);
      });

      // =============================================
      // BATCH 2: Viết phụ lục 3 và 4 (độc lập, không history)
      // =============================================
      generatedAppendix += "\n\n";
      const batch2Prompt = `TIẾP TỤC TẠO PHỤ LỤC CHO ĐỀ TÀI KHKT (PHẦN 2/3)

Bạn đang tạo PHỤ LỤC CHO ĐỀ TÀI KHKT. Ở phần 1, bạn đã viết:
${batch1Response.substring(0, 3000)}

THÔNG TIN ĐỀ TÀI:${TOPIC_INFO}

Tiếp tục viết CHI TIẾT 2 PHỤ LỤC TIẾP THEO (phụ lục thứ 3 và 4 trong danh sách).
Nếu danh sách chỉ có 3 phụ lục → chỉ viết phụ lục 3 rồi kết thúc.

Đối với GIÁO ÁN MINH HỌA (nếu có): Theo Công văn 5512/BGDĐT, viết chi tiết 4 hoạt động (Khởi động, Hình thành kiến thức mới, Luyện tập, Vận dụng), mỗi hoạt động có Mục tiêu/Nội dung/Sản phẩm/Tổ chức thực hiện.

${FORMAT_RULES}`;

      const batch2Response = await sendSinglePromptStream(batch2Prompt, (chunk) => {
        generatedAppendix += chunk;
        setAppendixDocument(generatedAppendix);
      });

      // Kiểm tra xem đã hoàn thành chưa (nếu chỉ có 3-4 phụ lục)
      const allContent = batch1Response + batch2Response;
      const isAlreadyComplete = allContent.includes("HOÀN THÀNH TẠO TÀI LIỆU PHỤ LỤC");

      // =============================================
      // BATCH 3: Viết TẤT CẢ phụ lục còn lại (nếu có)
      // =============================================
      if (!isAlreadyComplete) {
        generatedAppendix += "\n\n";
        const batch3Prompt = `TIẾP TỤC TẠO PHỤ LỤC CHO ĐỀ TÀI KHKT (PHẦN 3/3 - CUỐI CÙNG)

Bạn đang tạo PHỤ LỤC CHO ĐỀ TÀI KHKT. Ở phần 1 và 2, bạn đã viết các phụ lục trước.
Phần 2 kết thúc với:
${batch2Response.substring(Math.max(0, batch2Response.length - 2000))}

THÔNG TIN ĐỀ TÀI:${TOPIC_INFO}

Tiếp tục viết CHI TIẾT TẤT CẢ PHỤ LỤC CÒN LẠI chưa viết.

Đối với BÀI TẬP MẪU (nếu có): Phù hợp môn ${userInfo.field} lớp ${userInfo.level}, có đề bài + đáp án chi tiết.
Đối với BẢNG TỔNG HỢP (nếu có): Bảng trước/sau thực nghiệm + so sánh, số liệu lẻ tự nhiên.

${FORMAT_RULES}`;

        await sendSinglePromptStream(batch3Prompt, (chunk) => {
          generatedAppendix += chunk;
          setAppendixDocument(generatedAppendix);
        });
      }

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
  const renderSidebar = () => {
    return (
      <div className="w-full lg:w-80 bg-gradient-to-b from-white to-sky-50 border-r border-sky-100 p-6 flex-shrink-0 flex flex-col h-full overflow-y-auto shadow-[4px_0_24px_rgba(56,189,248,0.08)]">
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-emerald-500 flex items-center gap-2" style={{ fontFamily: 'Nunito, sans-serif' }}>
            <Wand2 className="h-6 w-6 text-blue-500" />
            KHKT Writer Pro
          </h1>
          <p className="text-xs text-blue-800 font-medium mt-1.5 tracking-wide">✨ Trợ lý viết đề tài KHKT thông minh</p>
        </div>

        {/* Progress Stepper */}
        <div className="space-y-6">
          {Object.entries(STEPS_INFO).map(([key, info]) => {
            const stepNum = parseInt(key);

            // Ẩn step Phụ lục và Hoàn tất trên sidebar
            if (stepNum >= GenerationStep.PHU_LUC) return null;

            let statusColor = "text-gray-400 border-gray-200";
            let icon = <div className="w-2 h-2 rounded-full bg-gray-300" />;

            // ERROR STATE HANDLING
            if (state.error && state.step === stepNum) {
              statusColor = "text-red-600 border-red-600 bg-red-50";
              icon = <AlertTriangle className="w-4 h-4 text-red-600" />;
            }
            else if (state.step === stepNum && state.isStreaming) {
              statusColor = "text-sky-600 border-sky-600 bg-sky-50";
              icon = <div className="w-2 h-2 rounded-full bg-sky-500 animate-ping" />;
            } else if (state.step > stepNum) {
              statusColor = "text-sky-800 border-sky-200";
              icon = <CheckCircle className="w-4 h-4 text-sky-600" />;
            } else if (state.step === stepNum) {
              statusColor = "text-sky-600 border-sky-600 font-bold";
              icon = <div className="w-2 h-2 rounded-full bg-sky-600" />;
            }

            // Cho phép click vào các step đã hoàn thành để quay lại sửa
            const isClickable = state.step > stepNum && !state.isStreaming;
            const handleStepClick = () => {
              if (isClickable) {
                setState(prev => ({ ...prev, step: stepNum }));
              }
            };

            return (
              <div
                key={key}
                onClick={handleStepClick}
                className={`flex items - start pl - 4 border - l - 2 ${statusColor.includes('border-sky') ? 'border-sky-500' : statusColor.includes('border-red') ? 'border-red-500' : 'border-gray-200'} py - 1 transition - all ${isClickable ? 'cursor-pointer hover:bg-sky-50 rounded-r-lg' : ''} `}
              >
                <div className="flex-1">
                  <h4 className={`text - sm ${statusColor.includes('text-sky') ? 'text-sky-900' : statusColor.includes('text-red') ? 'text-red-700' : 'text-gray-500'} font - medium`}>
                    {state.error && state.step === stepNum ? "Đã dừng do lỗi" : info.label}
                  </h4>
                  <p className="text-xs text-gray-400">{info.description}</p>
                </div>
                <div className="ml-2 mt-1">
                  {icon}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-auto pt-6 border-t border-gray-100">
          {state.step > GenerationStep.INPUT_FORM && (
            <div className="space-y-3">
              <div className="p-3 bg-gray-50 rounded text-xs text-gray-500 border border-gray-100">
                <span className="font-bold block text-gray-900">Đề tài:</span>
                {userInfo.projectTitle}
              </div>

              {/* Session persistence buttons */}
              <div className="flex gap-2">
                <button
                  onClick={saveSession}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium transition-colors border border-emerald-200"
                  title="Lưu phiên làm việc"
                >
                  <Save size={13} />
                  Lưu phiên
                </button>
                <button
                  onClick={() => {
                    if (confirm('Xóa phiên đã lưu? Bạn sẽ không thể khôi phục lại.')) {
                      clearSavedSession();
                    }
                  }}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-medium transition-colors border border-red-200"
                  title="Xóa phiên đã lưu"
                >
                  <Trash2 size={13} />
                </button>
              </div>
              {sessionSavedAt && (
                <p className="text-[10px] text-gray-400 text-center">
                  💾 Lưu lúc {sessionSavedAt}
                </p>
              )}

              {/* Controls */}
              {state.isStreaming ? (
                <Button disabled className="w-full" isLoading>Đang viết...</Button>
              ) : (
                state.step < GenerationStep.COMPLETED && (
                  <>
                    {/* Feedback / Review Section only for OUTLINE Step */}
                    {state.step === GenerationStep.OUTLINE && (
                      <div className="mb-2 space-y-2 border-t border-gray-100 pt-2">
                        <p className="text-sm font-semibold text-sky-700">Điều chỉnh:</p>

                        <div className="text-xs text-gray-500 italic mb-2">
                          💡 Mẹo: Bạn có thể sửa trực tiếp Dàn ý ở màn hình bên phải trước khi bấm "Chốt & Viết tiếp".
                        </div>

                        <textarea
                          value={outlineFeedback}
                          onChange={(e) => setOutlineFeedback(e.target.value)}
                          placeholder="Hoặc nhập yêu cầu để AI viết lại..."
                          className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-sky-500 focus:border-sky-500"
                          rows={3}
                        />
                        <Button
                          variant="secondary"
                          onClick={regenerateOutline}
                          disabled={!outlineFeedback.trim()}
                          className="w-full text-sm"
                          icon={<RefreshCw size={14} />}
                        >
                          Yêu cầu AI viết lại
                        </Button>
                      </div>
                    )}

                    <Button onClick={generateNextSection} className="w-full" icon={<ChevronRight size={16} />}>
                      {state.step === GenerationStep.OUTLINE ? 'Chốt Dàn ý & Viết tiếp' : 'Viết phần tiếp theo'}
                    </Button>
                  </>
                )
              )}

              {/* Nút xuất Word đề tài KHKT (luôn hiển thị khi đã có nội dung) */}
              {(state.step >= GenerationStep.OUTLINE) && (
                <Button variant="secondary" onClick={exportToWord} className="w-full" icon={<Download size={16} />}>
                  Xuất file Word KHKT
                </Button>
              )}

              {/* Sau khi hoàn thành đề tài KHKT: hiển thị các nút phụ lục */}
              {state.step >= GenerationStep.COMPLETED && (
                <>
                  {!appendixDocument ? (
                    <Button
                      onClick={generateAppendix}
                      isLoading={isAppendixLoading}
                      className="w-full bg-emerald-600 hover:bg-emerald-700"
                      icon={<FileText size={16} />}
                    >
                      {isAppendixLoading ? 'Đang tạo phụ lục...' : 'TẠO PHỤ LỤC'}
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      onClick={exportAppendixToWord}
                      className="w-full border-emerald-500 text-emerald-700 hover:bg-emerald-50"
                      icon={<Download size={16} />}
                    >
                      Xuất Word Phụ lục
                    </Button>
                  )}
                </>
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
        <div className="lg:hidden mb-4 bg-gradient-to-r from-white to-sky-50 p-4 rounded-xl shadow-lg border border-sky-100 flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <h1 className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-emerald-500 text-xl" style={{ fontFamily: 'Nunito, sans-serif' }}>đề tài KHKT 2025</h1>
            <span className="text-xs bg-teal-100 text-teal-700 px-3 py-1 rounded-full font-medium">
              {STEPS_INFO[Math.min(state.step, GenerationStep.COMPLETED)]?.label || ''}
            </span>
          </div>
          <p className="text-xs text-blue-700 font-medium">✨ Trợ lý viết đề tài KHKT thông minh</p>
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
          <div className="flex-1 flex flex-col min-h-0 relative">
            <DocumentPreview
              content={state.fullDocument}
              onUpdate={handleDocumentUpdate}
              // Only allow direct editing in the OUTLINE step and when not streaming
              isEditable={state.step === GenerationStep.OUTLINE && !state.isStreaming}
            />

            {/* Mobile Controls Floating */}
            <div className="lg:hidden absolute bottom-4 left-4 right-4 flex gap-2 shadow-lg">
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
        )}
      </div>
    </div>
  );
};

export default App;
