import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { UserInfo, GenerationStep, GenerationState, DocumentSections } from './types';
import { STEPS_INFO, KHKT_CHAPTER_PROMPT, DATA_INTEGRITY_RULE, DATA_PLACEHOLDER_TAG, GEMINI_MODELS, AGENT_PLATFORM_MODELS, AiProvider, DEFAULT_GEMINI_MODEL, DEFAULT_AGENT_PLATFORM_MODEL } from './constants';
import { initializeGeminiChat, sendMessageStream, sendSinglePromptStream, getFriendlyErrorMessage, parseApiError, PartialStreamError, ThinkingLevel, setModelFallbackListener } from './services/geminiService';
import { apiKeyManager } from './services/apiKeyManager';
import { confirmDataIntegrity } from './services/integrityCheck';
import { PageSectionKey, parsePageLimit, allocatePages } from './services/pageAllocation';
import { KHKT_FIELDS } from './data/khktKnowledge';
import { KHKTForm } from './components/KHKTForm';
import { DocumentPreview } from './components/DocumentPreview';
import { AIActionPanel } from './components/AIActionPanel';
import { Button } from './components/Button';
import { ApiKeyModal } from './components/ApiKeyModal';
import { Download, ChevronRight, Wand2, FileText, CheckCircle, RefreshCw, Settings, AlertTriangle, Save, Trash2 } from 'lucide-react';

import { LockScreen } from './components/LockScreen';

// Helper: Truncate text dài cho AI prompt - giữ phần đầu (nội dung chính) và thông báo lược bớt
const MAX_REF_DOCS_FOR_PROMPT = 80000; // ~80K ký tự tối đa cho tài liệu tham khảo trong prompt dàn ý
const MAX_REF_DOCS_FOR_CHAPTER = 20000; // các chương chỉ cần phần chính của tài liệu tham khảo

const truncateForPrompt = (text: string, maxChars: number = MAX_REF_DOCS_FOR_PROMPT): string => {
  if (!text || text.length <= maxChars) return text;

  const truncated = text.substring(0, maxChars);
  const removedChars = text.length - maxChars;
  const estimatedPages = Math.round(removedChars / 2500); // ~2500 ký tự/trang A4

  return truncated + `\n\n[... ĐÃ LƯỢC BỚT ${removedChars.toLocaleString()} KÝ TỰ (~${estimatedPages} trang) DO QUÁ DÀI. Nội dung phía trên đã đủ để tham khảo các ý chính ...]`;
};

// Các bước tạo nên thân tài liệu (thứ tự xuất hiện trong file Word)
const BODY_STEPS: GenerationStep[] = [
  GenerationStep.PHAN_MO_DAU,
  GenerationStep.CHUONG_1,
  GenerationStep.CHUONG_2,
  GenerationStep.CHUONG_3,
  GenerationStep.CHUONG_4,
];

const isBodyStep = (step: GenerationStep) => BODY_STEPS.includes(step);

const joinSections = (sections: DocumentSections): string =>
  BODY_STEPS.map(step => sections[step]?.trim()).filter(Boolean).join('\n\n');

// Tóm lược các phần đã viết: chỉ giữ tiêu đề, bảng và khung số liệu — đủ để AI giữ mạch và khớp số liệu
const summarizeSections = (sections: DocumentSections, steps: GenerationStep[], maxChars = 10000): string => {
  const parts: string[] = [];
  for (const step of steps) {
    const text = sections[step];
    if (!text?.trim()) continue;
    const kept = text.split('\n').filter(line => {
      const t = line.trim();
      return t.startsWith('#') || t.startsWith('|') || t.includes(DATA_PLACEHOLDER_TAG);
    });
    if (kept.length > 0) parts.push(`[${STEPS_INFO[step]?.label}]\n${kept.join('\n')}`);
  }
  return truncateForPrompt(parts.join('\n\n'), maxChars);
};

// Lỗi gắn với API key => đánh dấu key và xoay sang key khác
const KEY_LEVEL_ERRORS = new Set(['QUOTA_EXCEEDED', 'RATE_LIMIT', 'INVALID_API_KEY', 'PERMISSION_DENIED']);
const KEY_ROTATION_REASON_TEXT: Record<string, string> = {
  QUOTA_EXCEEDED: 'đã hết lượt sử dụng',
  RATE_LIMIT: 'đang bị giới hạn tốc độ',
  INVALID_API_KEY: 'không hợp lệ',
  PERMISSION_DENIED: 'không có quyền',
};

const STEP_PAGE_KEY: Partial<Record<GenerationStep, PageSectionKey>> = {
  [GenerationStep.PHAN_MO_DAU]: 'intro',
  [GenerationStep.CHUONG_1]: 'chapter1',
  [GenerationStep.CHUONG_2]: 'chapter2',
  [GenerationStep.CHUONG_3]: 'chapter3',
  [GenerationStep.CHUONG_4]: 'chapter4',
};

// SessionStorage key cho tài liệu tham khảo lớn
const SESSION_REF_DOCS_KEY = 'khkt_ref_docs';

// LocalStorage key cho lưu/khôi phục phiên làm việc
const SESSION_SAVE_KEY = 'khkt_session_data';

// Session version để invalidate sessions cũ khi thay đổi cấu trúc dữ liệu
const SESSION_VERSION = 'v3_sections';
const LEGACY_SESSION_VERSION = 'v2_no_review';

interface SessionData {
  sessionVersion?: string;
  userInfo: Omit<UserInfo, 'referenceDocuments'> & { hasReferenceDocuments: boolean };
  step: GenerationStep;
  outline: string;
  sections: DocumentSections;
  appendixDocument: string;
  outlineFeedback: string;
  savedAt: string;
}

// Chuyển phiên v2 (một chuỗi fullDocument chứa cả dàn ý lẫn các chương) sang cấu trúc theo phần
const migrateLegacySession = (legacy: any): SessionData | null => {
  if (!legacy?.state) return null;
  const step: GenerationStep = Math.min(legacy.state.step, GenerationStep.COMPLETED);
  const fullDocument: string = legacy.state.fullDocument || '';
  const lastBodyStep = Math.min(step, GenerationStep.CHUONG_4) as GenerationStep;
  return {
    sessionVersion: SESSION_VERSION,
    userInfo: legacy.userInfo,
    step,
    outline: step <= GenerationStep.OUTLINE ? fullDocument : '',
    sections: step >= GenerationStep.PHAN_MO_DAU ? { [lastBodyStep]: fullDocument } : {},
    appendixDocument: legacy.appendixDocument || '',
    outlineFeedback: legacy.outlineFeedback || '',
    savedAt: legacy.savedAt,
  };
};

type PendingAction =
  | { kind: 'outline' }
  | { kind: 'regenerate-outline'; feedback: string }
  | { kind: 'section'; step: GenerationStep };

const App: React.FC = () => {
  // Lock Screen State
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Session Restore State
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [pendingSessionData, setPendingSessionData] = useState<SessionData | null>(null);
  const [sessionSavedAt, setSessionSavedAt] = useState<string | null>(null);
  const [sessionSaveError, setSessionSaveError] = useState<string | null>(null);

  // API Key State
  const [provider, setProvider] = useState<AiProvider>(() => apiKeyManager.getProvider());
  const [apiKey, setApiKey] = useState('');
  const [showApiModal, setShowApiModal] = useState(false);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_GEMINI_MODEL);

  // Check LocalStorage on Mount
  useEffect(() => {
    const authState = localStorage.getItem('khkt_app_unlocked');
    if (authState === 'true') {
      setIsUnlocked(true);
    }

    const currentProv = apiKeyManager.getProvider();
    setProvider(currentProv);

    const activeKey = apiKeyManager.getActiveKey(currentProv);
    const savedModel = localStorage.getItem('selected_model');
    const validModels = currentProv === 'agent-platform' ? AGENT_PLATFORM_MODELS : GEMINI_MODELS;
    const defaultModel = currentProv === 'agent-platform' ? DEFAULT_AGENT_PLATFORM_MODEL : DEFAULT_GEMINI_MODEL;

    if (activeKey) {
      setApiKey(activeKey);
    } else {
      setShowApiModal(true);
    }

    if (savedModel && (validModels as readonly string[]).includes(savedModel)) {
      setSelectedModel(savedModel);
    } else {
      setSelectedModel(defaultModel);
    }

    // Kiểm tra phiên làm việc đã lưu
    try {
      const savedSession = localStorage.getItem(SESSION_SAVE_KEY);
      if (savedSession) {
        let sessionData: SessionData | null = JSON.parse(savedSession);
        if (sessionData?.sessionVersion === LEGACY_SESSION_VERSION) {
          sessionData = migrateLegacySession(sessionData);
        }
        if (!sessionData || sessionData.sessionVersion !== SESSION_VERSION) {
          console.warn('⚠️ Session cũ không tương thích (thiếu version hoặc version khác). Xóa session.');
          localStorage.removeItem(SESSION_SAVE_KEY);
        } else if (sessionData.step > GenerationStep.INPUT_FORM) {
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

  const handleSaveApiKey = (_key: string | null, model: string, newProvider: AiProvider) => {
    // ApiKeyModal đã ghi key vào apiKeyManager; key null = dùng kho key hệ thống
    apiKeyManager.setProvider(newProvider);
    setProvider(newProvider);

    const activeKey = apiKeyManager.getActiveKey(newProvider) || '';
    localStorage.setItem('selected_model', model);

    setApiKey(activeKey);
    setSelectedModel(model);
    setShowApiModal(false);

    // Luôn khởi tạo lại để các lần gọi sau dùng đúng key/model/provider vừa chọn
    if (activeKey) {
      initializeGeminiChat(activeKey, model, newProvider);
    }
    if (state.error) {
      setState(prev => ({ ...prev, error: null }));
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
    streamingStep: null,
    isStreaming: false,
    error: null
  });

  // Dàn ý đã chốt được lưu riêng và gửi kèm MỌI prompt chương
  const [outline, setOutline] = useState('');
  // Nội dung từng phần; tài liệu hoàn chỉnh = ghép các phần theo thứ tự
  const [sections, setSections] = useState<DocumentSections>({});
  const fullDocument = useMemo(() => joinSections(sections), [sections]);

  const [outlineFeedback, setOutlineFeedback] = useState("");

  // Phụ lục riêng biệt
  const [appendixDocument, setAppendixDocument] = useState('');
  const [isAppendixLoading, setIsAppendixLoading] = useState(false);

  // Thông báo nhẹ khi đang tự chuyển model/key; tự xoá ngay khi lần gọi AI kết thúc
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  useEffect(() => {
    setModelFallbackListener(event => {
      if (event.type === 'switch') {
        setFallbackNotice(`Đang tự động chuyển từ ${event.from} sang ${event.to} (do ${event.from} ${event.reason})...`);
      } else {
        setFallbackNotice(null);
      }
    });
    return () => setModelFallbackListener(null);
  }, []);

  // Refs luôn giữ giá trị mới nhất để các hàm async/retry không đọc state cũ trong closure
  const latest = useRef({ apiKey, provider, selectedModel, userInfo, outline, sections, state });
  latest.current = { apiKey, provider, selectedModel, userInfo, outline, sections, state };
  const lastActionRef = useRef<PendingAction | null>(null);

  // ═══════════════════════════════════════════════════════════
  // SESSION PERSISTENCE: Tự động lưu phiên vào localStorage
  // ═══════════════════════════════════════════════════════════

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
        step: state.step,
        outline,
        sections,
        appendixDocument,
        outlineFeedback,
        savedAt: new Date().toISOString(),
      };

      localStorage.setItem(SESSION_SAVE_KEY, JSON.stringify(sessionData));
      setSessionSavedAt(new Date().toLocaleTimeString('vi-VN'));
      setSessionSaveError(null);
    } catch (e) {
      console.warn('Không thể lưu phiên (có thể do dữ liệu quá lớn):', e);
      setSessionSaveError('Không lưu được phiên: bộ nhớ trình duyệt đã đầy. Hãy xuất Word để giữ bản thảo.');
    }
  }, [state.step, state.isStreaming, userInfo, outline, sections, appendixDocument, outlineFeedback]);

  // Tự động lưu khi nội dung thay đổi (debounce 2 giây)
  useEffect(() => {
    if (state.step <= GenerationStep.INPUT_FORM || state.isStreaming) return;

    const timer = setTimeout(() => {
      saveSession();
    }, 2000);

    return () => clearTimeout(timer);
  }, [state.step, outline, sections, appendixDocument, saveSession]);

  // Hàm khôi phục phiên
  const restoreSession = useCallback((sessionData: SessionData) => {
    try {
      const { hasReferenceDocuments, ...savedUserInfo } = sessionData.userInfo as any;
      setUserInfo(prev => ({
        ...prev,
        ...savedUserInfo,
        referenceDocuments: prev.referenceDocuments || '', // Giữ ref docs từ sessionStorage
      }));

      setOutline(sessionData.outline || '');
      setSections(sessionData.sections || {});
      setState({
        step: sessionData.step,
        streamingStep: null,
        isStreaming: false,
        error: null,
      });

      if (sessionData.appendixDocument) {
        setAppendixDocument(sessionData.appendixDocument);
      }
      if (sessionData.outlineFeedback) {
        setOutlineFeedback(sessionData.outlineFeedback);
      }

      // Khởi tạo AI theo đúng provider/key đang chọn (không mặc định 'gemini')
      const currentProv = apiKeyManager.getProvider();
      const activeKey = apiKeyManager.getActiveKey(currentProv);
      const savedModel = localStorage.getItem('selected_model');
      if (activeKey) {
        initializeGeminiChat(activeKey, savedModel || undefined, currentProv);
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
    setSessionSaveError(null);
    console.log('🗑 Đã xóa phiên làm việc đã lưu');
  }, []);

  // ═══════════════════════════════════════════════════════════
  // PROMPT HELPERS
  // ═══════════════════════════════════════════════════════════

  const getPageAllocation = (info: UserInfo) => {
    const pages = parsePageLimit(info.pageLimit);
    if (!pages) return null;
    return { totalPages: pages, wordsPerPage: 350, sections: allocatePages(pages) };
  };

  // Giới hạn trang cho một phần cụ thể
  const getSectionPagePrompt = (info: UserInfo, step: GenerationStep) => {
    const alloc = getPageAllocation(info);
    const key = STEP_PAGE_KEY[step];
    if (!alloc || !key) return '';
    const pages = alloc.sections[key];
    return `
🚨 GIỚI HẠN SỐ TRANG CHO PHẦN NÀY (BẮT BUỘC):
📌 ${STEPS_INFO[step].label}: viết khoảng ${pages} TRANG (≈ ${(pages * alloc.wordsPerPage).toLocaleString()} từ)
⚠️ Toàn bộ đề tài ${alloc.totalPages} trang; phần này chiếm ${pages} trang. Viết cô đọng nhưng đủ ý.
`;
  };

  // Yêu cầu đặc biệt (giới hạn trang tổng, bảng biểu, yêu cầu riêng) — dùng cho dàn ý
  const getRequirementsPrompt = (info: UserInfo) => {
    const requirements: string[] = [];

    const alloc = getPageAllocation(info);
    if (alloc) {
      requirements.push(`
🚨 GIỚI HẠN SỐ TRANG: ${alloc.totalPages} TRANG
📊 PHÂN BỔ:
- Phần Mở đầu: ${alloc.sections.intro} trang
- Chương 1: ${alloc.sections.chapter1} trang
- Chương 2: ${alloc.sections.chapter2} trang
- Chương 3: ${alloc.sections.chapter3} trang
- Chương 4 & Kết luận: ${alloc.sections.chapter4} trang`);
    }

    if (info.includeStatistics) {
      requirements.push(`
📈 YÊU CẦU BẢNG BIỂU:
- Mỗi chương có bảng biểu; bảng chưa có số liệu thật thì để khung trống theo luật liêm chính số liệu`);
    }

    if (info.specialRequirements?.trim()) {
      requirements.push(`
✏️ YÊU CẦU BỔ SUNG TỪ NGƯỜI DÙNG:
${info.specialRequirements}`);
    }

    if (requirements.length === 0) return '';
    return `\n⚠️ YÊU CẦU ĐẶC BIỆT:\n${requirements.join('\n')}`;
  };

  const getProjectInfoBlock = (info: UserInfo) => {
    const fieldInfo = KHKT_FIELDS.find(f => f.name === info.field);
    return `• Tên đề tài: ${info.projectTitle}
• Lĩnh vực: ${info.field}${fieldInfo ? ` (Nhóm: ${fieldInfo.group})` : ''}
• Cấp độ thi: ${info.level || 'Chưa xác định'}
• Thành viên: ${info.members || 'Chưa cung cấp'}
• Giáo viên hướng dẫn: ${info.advisor || 'Chưa cung cấp'}
• Trường: ${info.school}
• Địa phương: ${info.location}
• Vấn đề nghiên cứu: ${info.problem}
• Mục tiêu: ${info.objectives}
• Giả thuyết: ${info.hypothesis}
• Phương pháp: ${info.methods}
• Đối tượng NC: ${info.researchSubjects || "Chưa xác định"}
• Thời gian: ${info.timeframe || "Năm học hiện tại"}`;
  };

  const getOutlinePrompt = (info: UserInfo) => `
NHIỆM VỤ: Lập DÀN Ý CHI TIẾT cho đề tài KHKT dựa trên thông tin được cung cấp.
Dàn ý phải đầy đủ, khoa học, đảm bảo: Tính MỚI, Tính KHOA HỌC, Tính KHẢ THI, Tính ỨNG DỤNG.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔬 NGUYÊN TẮC VIẾT ĐỀ TÀI KHKT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣ NGÔN NGỮ KHOA HỌC: Khách quan, chính xác, logic. Tránh từ cảm tính.
2️⃣ CÓ CÂU HỎI NGHIÊN CỨU: Rõ ràng, có thể kiểm chứng được.
3️⃣ GIẢ THUYẾT KHOA HỌC: Cụ thể, có thể đo lường.
4️⃣ PHƯƠNG PHÁP PHÙ HỢP: Thực nghiệm, khảo sát, mô hình... có nhóm đối chứng.
5️⃣ SỐ LIỆU: Chỉ nêu loại dữ liệu cần thu thập và cách xử lý thống kê; KHÔNG đưa số liệu cụ thể.
6️⃣ TRÍCH DẪN APA: (Tác giả, năm) cho mọi nguồn tham khảo.
7️⃣ CHỐNG ĐẠO VĂN: Viết lại bằng ngôn ngữ riêng, không copy.
8️⃣ PHÙ HỢP TRÌNH ĐỘ THPT: Nội dung khoa học nhưng phù hợp học sinh.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THÔNG TIN ĐỀ TÀI KHKT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${getProjectInfoBlock(info)}

${info.referenceDocuments ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TÀI LIỆU THAM KHẢO (DO HỌC SINH CUNG CẤP):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${truncateForPrompt(info.referenceDocuments)}
[HẾT TÀI LIỆU THAM KHẢO]
` : ''}

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
✓ Phù hợp với lĩnh vực ${info.field}
✓ Chỉ trả về dàn ý (Markdown), không thêm câu hỏi xác nhận hay hộp thoại

${DATA_INTEGRITY_RULE}

${getRequirementsPrompt(info)}
`;

  const SECTION_TASKS: Partial<Record<GenerationStep, (info: UserInfo) => string>> = {
    [GenerationStep.PHAN_MO_DAU]: info => `Viết chi tiết PHẦN I. MỞ ĐẦU (Tổng quan), bắt đầu bằng tiêu đề "## PHẦN I. MỞ ĐẦU", gồm:
1. Lý do chọn đề tài
2. Mục tiêu nghiên cứu: "${info.objectives}"
3. Đối tượng nghiên cứu: ${info.researchSubjects || 'Chưa xác định'}
4. Phạm vi nghiên cứu (Thời gian: ${info.timeframe || 'Năm học hiện tại'}, Không gian, Đối tượng)
5. Câu hỏi nghiên cứu
6. Giả thuyết khoa học: "${info.hypothesis}"
7. Ý nghĩa khoa học và thực tiễn
8. Phương pháp nghiên cứu: ${info.methods}
9. Tính mới (tính sáng tạo) của đề tài
- KHÔNG tạo phụ lục hình ảnh, video (không hiển thị được).`,
    [GenerationStep.CHUONG_1]: () => `Viết chi tiết CHƯƠNG 1: CƠ SỞ LÝ LUẬN, bắt đầu bằng tiêu đề "## PHẦN II. NỘI DUNG NGHIÊN CỨU" rồi "## CHƯƠNG 1: CƠ SỞ LÝ LUẬN":
- 1.1. Khái niệm
- 1.2. Kiến thức nền
- 1.3. Các nghiên cứu liên quan (chỉ trích dẫn nguồn có thật, ghi (Tác giả, năm); không chắc chắn thì không trích)
- 1.4. Cơ sở khoa học`,
    [GenerationStep.CHUONG_2]: () => `Viết chi tiết CHƯƠNG 2: THỰC TRẠNG, bắt đầu bằng tiêu đề "## CHƯƠNG 2: THỰC TRẠNG":
- 2.1. Khảo sát: mục đích, đối tượng, cách chọn mẫu, công cụ (phiếu khảo sát/thiết bị đo), thời gian.
- 2.2. Thu thập dữ liệu: quy trình thu thập, biểu mẫu ghi chép.
- 2.3. Phân tích số liệu: phương pháp xử lý thống kê sẽ dùng; bảng kết quả dùng số liệu học sinh cung cấp, nếu chưa có thì để khung bảng trống.
- 2.4. Đánh giá hiện trạng: lập luận dựa trên dữ liệu đã có hoặc nguồn công bố có trích dẫn; phần phụ thuộc số liệu chưa có thì viết dạng hướng dẫn nhận xét.`,
    [GenerationStep.CHUONG_3]: () => `Viết chi tiết CHƯƠNG 3: THIẾT KẾ GIẢI PHÁP / SẢN PHẨM, bắt đầu bằng tiêu đề "## CHƯƠNG 3: THIẾT KẾ GIẢI PHÁP / SẢN PHẨM":
- 3.1. Ý tưởng
- 3.2. Thiết kế
- 3.3. Quy trình
- 3.4. Nguyên lý hoạt động
- 3.5. Công nghệ sử dụng
- 3.6. Hình ảnh mô hình (mô tả hình cần chụp/vẽ, đánh số Hình 3.x)
Trình bày chi tiết, chuyên sâu, bám sát các phương pháp khoa học đã nêu.`,
    [GenerationStep.CHUONG_4]: () => `Viết chi tiết CHƯƠNG 4: THỰC NGHIỆM VÀ ĐÁNH GIÁ & PHẦN III: KẾT LUẬN.
Bắt đầu bằng tiêu đề "## CHƯƠNG 4: THỰC NGHIỆM VÀ ĐÁNH GIÁ":
- 4.1. Cách triển khai
- 4.2. Đối tượng thử nghiệm
- 4.3. Kết quả trước - sau (bảng kết quả: dùng số liệu thật học sinh cung cấp; chưa có thì để khung trống)
- 4.4. Biểu đồ và phân tích (mô tả biểu đồ cần vẽ từ số liệu thật và cách đọc kết quả)
- 4.5. Đánh giá hiệu quả (tiêu chí và cách kết luận; không khẳng định kết quả chưa có)

Sau đó tiêu đề "## PHẦN III. KẾT LUẬN":
- 1. Kết luận
- 2. Đóng góp của đề tài
- 3. Hạn chế
- 4. Hướng phát triển
- 5. Kiến nghị

Cuối cùng là "## TÀI LIỆU THAM KHẢO" chuẩn APA (chỉ liệt kê nguồn có thật đã trích dẫn trong bài).`,
  };

  const buildSectionPrompt = (target: GenerationStep, info: UserInfo, currentOutline: string, currentSections: DocumentSections) => {
    const previousSteps = BODY_STEPS.filter(s => s < target);
    const previousSummary = summarizeSections(currentSections, previousSteps);

    return `${KHKT_CHAPTER_PROMPT}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THÔNG TIN ĐỀ TÀI:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${getProjectInfoBlock(info)}

--- BẮT ĐẦU DÀN Ý CHÍNH THỨC (đã được chốt, PHẢI bám sát) ---
${currentOutline}
--- KẾT THÚC DÀN Ý CHÍNH THỨC ---
${previousSummary ? `
--- CÁC PHẦN ĐÃ VIẾT (tiêu đề và bảng; chỉ để giữ mạch và thống nhất số liệu, KHÔNG viết lại) ---
${previousSummary}
--- HẾT ---
` : ''}${info.referenceDocuments ? `
--- TÀI LIỆU THAM KHẢO DO HỌC SINH CUNG CẤP (trích) ---
${truncateForPrompt(info.referenceDocuments, MAX_REF_DOCS_FOR_CHAPTER)}
--- HẾT TÀI LIỆU ---
` : ''}
NHIỆM VỤ:
${SECTION_TASKS[target]?.(info) || ''}
${getSectionPagePrompt(info, target)}${info.specialRequirements?.trim() ? `\n✏️ YÊU CẦU BỔ SUNG TỪ NGƯỜI DÙNG: ${info.specialRequirements}\n` : ''}
${DATA_INTEGRITY_RULE}

CHỈ viết phần được giao ở trên. Không nhắc lại các phần khác, không chào hỏi, không hỏi xác nhận.`;
  };

  // ═══════════════════════════════════════════════════════════
  // GỌI AI + TỰ XOAY KEY
  // ═══════════════════════════════════════════════════════════

  const ensureApiKey = (): boolean => {
    const { apiKey: key, provider: prov } = latest.current;
    const activeKey = key || apiKeyManager.getActiveKey(prov);
    if (!activeKey) {
      setShowApiModal(true);
      return false;
    }
    return true;
  };

  /**
   * Gửi prompt; nếu lỗi do key (hết quota, key sai, bị từ chối quyền) thì đánh dấu key đó
   * và thử lại ngay với key kế tiếp CỦA CÙNG PROVIDER. onText nhận toàn văn tích luỹ.
   */
  const streamWithKeyRotation = async (prompt: string, onText: (fullText: string) => void, useSearch: boolean): Promise<string> => {
    const { provider: prov, selectedModel: model } = latest.current;
    let key: string | null = latest.current.apiKey || apiKeyManager.getActiveKey(prov);
    const triedKeys = new Set<string>();

    while (key) {
      triedKeys.add(key);
      initializeGeminiChat(key, model, prov);
      let text = '';
      try {
        const send = useSearch ? sendMessageStream : sendSinglePromptStream;
        // Mọi tác vụ đi qua đây đều là sinh nội dung chính (dàn ý, chương, phụ lục) => MEDIUM
        return await send(prompt, chunk => { text += chunk; onText(text); }, model, prov, { thinkingLevel: ThinkingLevel.MEDIUM });
      } catch (error: any) {
        if (error instanceof PartialStreamError) throw error;
        const errorType = parseApiError(error);
        if (!KEY_LEVEL_ERRORS.has(errorType)) throw error;

        const rotation = apiKeyManager.markKeyError(key, errorType, prov);
        if (!rotation.success || !rotation.newKey || triedKeys.has(rotation.newKey)) throw error;

        console.log(`🔄 Tự động xoay key (${errorType}): ${rotation.message}`);
        setFallbackNotice(`Đang tự động chuyển sang API key dự phòng (key ${apiKeyManager.maskKey(key)} ${KEY_ROTATION_REASON_TEXT[errorType] || 'gặp lỗi'})...`);
        key = rotation.newKey;
        latest.current.apiKey = key;
        setApiKey(key);
        onText('');
      }
    }
    throw new Error('Không có API Key khả dụng. Vui lòng nhập API key trong phần Cài đặt.');
  };

  const errorMessageOf = (error: any) => error?.message || String(error) || "Đã xảy ra lỗi.";

  // Lập dàn ý từ form
  const startGeneration = async () => {
    if (!ensureApiKey()) return;
    const { userInfo: info, sections: currentSections } = latest.current;
    if (joinSections(currentSections) && !window.confirm('Tạo dàn ý mới sẽ xoá các chương đã viết của đề tài hiện tại. Tiếp tục?')) {
      return;
    }

    lastActionRef.current = { kind: 'outline' };
    setOutline('');
    setSections({});
    setAppendixDocument('');
    setState(prev => ({ ...prev, isStreaming: true, streamingStep: GenerationStep.OUTLINE, error: null }));

    try {
      const text = await streamWithKeyRotation(getOutlinePrompt(info), full => setOutline(full), true);
      if (!text.trim()) throw new Error('AI không trả về nội dung (phản hồi rỗng). Vui lòng thử lại.');
      setOutline(text.trim());
      setState(prev => ({ ...prev, step: GenerationStep.OUTLINE, isStreaming: false, streamingStep: null }));
    } catch (error: any) {
      const partial = error instanceof PartialStreamError && error.partialText.trim();
      // Có dàn ý dở dang thì vẫn mở bước Dàn ý để người dùng sửa/viết lại; không có gì thì ở lại form
      setState(prev => ({
        ...prev,
        step: partial ? GenerationStep.OUTLINE : prev.step,
        isStreaming: false,
        streamingStep: null,
        error: errorMessageOf(error),
      }));
    }
  };

  // Viết lại dàn ý theo góp ý (prompt tự chứa dàn ý hiện tại, không dựa vào lịch sử chat)
  const regenerateOutline = async (feedbackOverride?: string) => {
    const feedback = (feedbackOverride ?? outlineFeedback).trim();
    if (!feedback || !ensureApiKey()) return;

    const { userInfo: info, outline: previousOutline } = latest.current;
    lastActionRef.current = { kind: 'regenerate-outline', feedback };
    setState(prev => ({ ...prev, isStreaming: true, streamingStep: GenerationStep.OUTLINE, error: null }));

    const prompt = `${getOutlinePrompt(info)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DÀN Ý HIỆN TẠI:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${previousOutline}

YÊU CẦU CHỈNH SỬA CỦA NGƯỜI DÙNG:
"${feedback}"

Hãy viết lại TOÀN BỘ dàn ý theo yêu cầu trên, vẫn đúng cấu trúc đề tài KHKT (3 phần, 4 chương).`;

    try {
      const text = await streamWithKeyRotation(prompt, full => setOutline(full), true);
      if (!text.trim()) throw new Error('AI không trả về nội dung (phản hồi rỗng). Vui lòng thử lại.');
      setOutline(text.trim());
      setOutlineFeedback("");
      setState(prev => ({ ...prev, step: GenerationStep.OUTLINE, isStreaming: false, streamingStep: null }));
    } catch (error: any) {
      setOutline(previousOutline); // không làm mất dàn ý cũ khi viết lại thất bại
      setState(prev => ({ ...prev, isStreaming: false, streamingStep: null, error: errorMessageOf(error) }));
    }
  };

  // Viết (hoặc viết lại) đúng một phần; bước chỉ được ghi nhận khi AI trả lời xong
  const generateSection = async (target: GenerationStep) => {
    if (!ensureApiKey()) return;
    const { userInfo: info, outline: currentOutline, sections: currentSections } = latest.current;
    const previousContent = currentSections[target] || '';

    lastActionRef.current = { kind: 'section', step: target };
    setState(prev => ({ ...prev, isStreaming: true, streamingStep: target, error: null }));

    try {
      const prompt = buildSectionPrompt(target, info, currentOutline, currentSections);
      const text = await streamWithKeyRotation(prompt, full => setSections(prev => ({ ...prev, [target]: full })), true);
      if (!text.trim()) throw new Error('AI không trả về nội dung (phản hồi rỗng). Vui lòng thử lại.');
      setSections(prev => ({ ...prev, [target]: text.trim() }));
      setState(prev => ({ ...prev, step: target, isStreaming: false, streamingStep: null }));
    } catch (error: any) {
      const partial = error instanceof PartialStreamError ? error.partialText.trim() : '';
      // Giữ bản cũ nếu có; chỉ giữ phần dở dang khi trước đó phần này còn trống
      setSections(prev => ({ ...prev, [target]: previousContent || partial }));
      setState(prev => ({ ...prev, isStreaming: false, streamingStep: null, error: errorMessageOf(error) }));
    }
  };

  // Nút "Viết phần tiếp theo"
  const generateNextSection = () => {
    const { state: current, outline: currentOutline, sections: currentSections } = latest.current;
    if (current.isStreaming) return;

    if (current.step >= GenerationStep.CHUONG_4) {
      setState(prev => ({ ...prev, step: GenerationStep.COMPLETED }));
      return;
    }
    if (current.step === GenerationStep.OUTLINE && !currentOutline.trim()) {
      setState(prev => ({ ...prev, error: 'Dàn ý đang trống. Hãy lập hoặc nhập dàn ý trước khi viết tiếp.' }));
      return;
    }

    const target = (current.step + 1) as GenerationStep;
    if (currentSections[target]?.trim() &&
      !window.confirm(`"${STEPS_INFO[target].label}" đã có nội dung. Viết lại sẽ thay thế riêng phần này. Tiếp tục?`)) {
      return;
    }
    generateSection(target);
  };

  // Nút "Thử lại": chạy lại đúng thao tác vừa lỗi, với key còn hoạt động
  const retryLastAction = () => {
    const { provider: prov, selectedModel: model } = latest.current;
    let key = apiKeyManager.getActiveKey(prov);
    if (!key) {
      apiKeyManager.resetAllKeys(prov);
      key = apiKeyManager.getActiveKey(prov);
    }
    if (!key) {
      setShowApiModal(true);
      return;
    }
    latest.current.apiKey = key;
    setApiKey(key);
    initializeGeminiChat(key, model, prov);
    setState(prev => ({ ...prev, error: null }));

    const action = lastActionRef.current;
    if (!action) return;
    if (action.kind === 'outline') startGeneration();
    else if (action.kind === 'regenerate-outline') regenerateOutline(action.feedback);
    else generateSection(action.step);
  };

  // Handle Input Changes
  const handleUserChange = (field: keyof UserInfo, value: string) => {
    setUserInfo(prev => ({ ...prev, [field]: value }));
  };

  // Handle Manual Outline Submission (Skip Generation)
  const handleManualOutlineSubmit = (content: string) => {
    if (!ensureApiKey()) return;
    if (joinSections(latest.current.sections) && !window.confirm('Dùng dàn ý mới sẽ xoá các chương đã viết. Tiếp tục?')) {
      return;
    }

    setOutline(content.trim());
    setSections({});
    setAppendixDocument('');
    setState(prev => ({
      ...prev,
      step: GenerationStep.OUTLINE, // Go to Outline step so user can Review/Confirm
      streamingStep: null,
      isStreaming: false,
      error: null
    }));
  };

  const makeFilename = (prefix: string) =>
    `${prefix}_${userInfo.projectTitle.substring(0, 30).replace(/[^a-zA-Z0-9\u00C0-\u1EF9]/g, '_') || 'DeTai'}.docx`;

  // Export Main Document to Word
  const exportToWord = async () => {
    const content = fullDocument.trim() ? fullDocument : outline;
    if (!content.trim()) {
      alert('Chưa có nội dung để xuất.');
      return;
    }
    if (!confirmDataIntegrity(content)) return;
    try {
      const { exportMarkdownToDocx } = await import('./services/docxExporter');
      await exportMarkdownToDocx(content, makeFilename(fullDocument.trim() ? 'KHKT_DeTai' : 'KHKT_DanY'));
    } catch (error: any) {
      console.error('Export error:', error);
      alert('Có lỗi khi xuất file Word. Vui lòng thử lại.');
    }
  };

  // Generate Appendix
  const generateAppendix = async () => {
    if (!ensureApiKey()) return;

    setIsAppendixLoading(true);

    const { userInfo: info, outline: currentOutline, sections: currentSections } = latest.current;
    // Phụ lục dựa trên dàn ý chốt + tiêu đề/bảng của TẤT CẢ các chương (không cắt 15.000 ký tự đầu)
    const sectionSummary = summarizeSections(currentSections, BODY_STEPS, 30000);

    const TOPIC_INFO = `
- Tên đề tài: ${info.projectTitle}
- Lĩnh vực: ${info.field} | Cấp: ${info.level}
- Trường: ${info.school} | Địa điểm: ${info.location}
- Thành viên: ${info.members} | GVHD: ${info.advisor}
- Phương pháp: ${info.methods}`;

    let generatedAppendix = "";

    try {
      const prompt = `TẠO TÀI LIỆU PHỤ LỤC CHO ĐỀ TÀI KHKT

Tạo phụ lục KHỚP với dàn ý, các bảng và khung số liệu đã có trong đề tài (cùng tên bảng, cùng tiêu đề cột, cùng đối tượng).

THÔNG TIN ĐỀ TÀI:${TOPIC_INFO}

--- DÀN Ý CHÍNH THỨC ---
${currentOutline}
--- HẾT DÀN Ý ---

--- TIÊU ĐỀ VÀ BẢNG CỦA CÁC CHƯƠNG ĐÃ VIẾT ---
${sectionSummary}
--- HẾT ---

YÊU CẦU:
Viết đầy đủ 3-7 phụ lục cần thiết cho đề tài KHKT, ví dụ:
- Phiếu khảo sát / bảng hỏi phỏng vấn (câu hỏi đầy đủ, để TRỐNG phần trả lời)
- Biểu mẫu bảng số liệu thô (đúng cột như các bảng trong chương, ô dữ liệu để "…")
- Mẫu nhật ký nghiên cứu / nhật ký thực nghiệm (ngày, hoạt động, quan sát — để trống)
- Quy trình thí nghiệm / quy trình chế tạo chi tiết
- Danh mục hình ảnh, video, mã nguồn/link/QR cần đính kèm làm minh chứng
- Bạn phải hoàn thành tất cả phụ lục trong lần này, không ngắt giữa chừng, không báo "Xem phần sau".

${DATA_INTEGRITY_RULE}

QUY TẮC ĐỊNH DẠNG:
- KHÔNG tạo bất kỳ hình ảnh nào (tuyệt đối KHÔNG DÙNG cú pháp ![image]).
- Trình bày toàn bộ dưới dạng Markdown rõ ràng; mỗi phụ lục bắt đầu bằng "## PHỤ LỤC n: <tên>".
- Viết ngay nội dung phụ lục, KHÔNG CẦN CÂU CHÀO HAY XÁC NHẬN.`;

      await streamWithKeyRotation(prompt, full => {
        generatedAppendix = full;
        setAppendixDocument(full);
      }, false);

      setIsAppendixLoading(false);
    } catch (error: any) {
      console.error('Generate Appendix error:', error);
      const partialText = error instanceof PartialStreamError ? error.partialText : generatedAppendix;
      const errorInfo = getFriendlyErrorMessage(error);
      if (partialText.trim().length > 0) {
        setAppendixDocument(partialText);
        alert(`Đã tạo được một phần phụ lục.\n\nLỗi: ${errorInfo.title}\n${errorInfo.message}\n\nBạn có thể xuất Word với phần đã tạo hoặc thử lại.`);
      } else {
        setAppendixDocument('');
        alert(`${errorInfo.title}\n\n${errorInfo.message}\n\nGợi ý:\n${errorInfo.suggestions.join('\n')}`);
      }
      setIsAppendixLoading(false);
    }
  };

  // Export Appendix to Word - Xuất phụ lục thành file Word riêng
  const exportAppendixToWord = async () => {
    if (!confirmDataIntegrity(appendixDocument)) return;
    try {
      const { exportMarkdownToDocx } = await import('./services/docxExporter');
      await exportMarkdownToDocx(appendixDocument, makeFilename('KHKT_Phuluc'));
    } catch (error: any) {
      console.error('Export Appendix error:', error);
      alert('Có lỗi khi xuất file phụ lục. Vui lòng thử lại.');
    }
  };

  // ═══════════════════════════════════════════════════════════
  // VIEW: dàn ý hay thân tài liệu, và phần nào đang được chỉnh sửa
  // ═══════════════════════════════════════════════════════════
  const isOutlineView = state.streamingStep === GenerationStep.OUTLINE ||
    (state.streamingStep === null && state.step === GenerationStep.OUTLINE);
  const previewContent = isOutlineView ? outline : fullDocument;
  const showWorkspace = state.step > GenerationStep.INPUT_FORM || state.streamingStep !== null;

  const editableSections = isOutlineView
    ? [{ key: String(GenerationStep.OUTLINE), label: STEPS_INFO[GenerationStep.OUTLINE].label, content: outline }]
    : BODY_STEPS.filter(s => sections[s] !== undefined).map(s => ({ key: String(s), label: STEPS_INFO[s].label, content: sections[s] || '' }));
  const lastWrittenStep = [...BODY_STEPS].reverse().find(s => sections[s]?.trim());
  const defaultEditStep = isBodyStep(state.step) ? state.step : (lastWrittenStep ?? GenerationStep.OUTLINE);

  const handleSectionUpdate = (key: string, newContent: string) => {
    const step = Number(key) as GenerationStep;
    if (step === GenerationStep.OUTLINE) setOutline(newContent);
    else setSections(prev => ({ ...prev, [step]: newContent }));
  };

  // Chèn văn bản từ Trợ lý AI vào cuối phần đang làm (không nối vào cuối cả tài liệu)
  const handleInsertText = (text: string) => {
    if (isOutlineView) {
      setOutline(prev => `${prev}\n\n${text}`);
      return;
    }
    const target = defaultEditStep;
    if (target === GenerationStep.OUTLINE) {
      setOutline(prev => `${prev}\n\n${text}`);
    } else {
      setSections(prev => ({ ...prev, [target]: `${prev[target] || ''}\n\n${text}`.trim() }));
    }
  };

  // Render Logic
  // Tính thống kê từ fullDocument
  const docWords = fullDocument ? fullDocument.split(/\s+/).filter(w => w).length : 0;
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

  // Bước xa nhất đã có nội dung (người dùng có thể quay lại bước trước để viết lại một phần)
  const furthestStep = Math.max(state.step, ...BODY_STEPS.filter(s => sections[s]?.trim()));
  const failedStep = state.error && lastActionRef.current
    ? (lastActionRef.current.kind === 'section' ? lastActionRef.current.step : GenerationStep.OUTLINE)
    : null;

  const getStepStatus = (stepNum: number) => {
    if (stepNum === GenerationStep.PHU_LUC) {
      if (isAppendixLoading) return 'streaming';
      if (appendixDocument.trim()) return 'done';
      return state.step >= GenerationStep.COMPLETED ? 'active' : 'pending';
    }
    if (state.streamingStep === stepNum) return 'streaming';
    if (failedStep === stepNum && !state.isStreaming) return 'error';
    if (state.step === stepNum) return 'active';
    if (state.step > stepNum) return 'done';
    if (isBodyStep(stepNum as GenerationStep) && sections[stepNum as GenerationStep]?.trim()) return 'done';
    return 'pending';
  };

  // Quay lại một bước đã có: bấm "Viết phần tiếp theo" sẽ viết lại riêng phần ngay sau nó
  const canJumpTo = (stepNum: number) =>
    !state.isStreaming && stepNum !== GenerationStep.PHU_LUC && stepNum !== state.step && stepNum <= furthestStep &&
    (stepNum !== GenerationStep.OUTLINE || !!outline.trim());

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
                const isClickable = canJumpTo(item.step);
                return (
                  <div key={idx}
                    onClick={() => isClickable && setState(prev => ({ ...prev, step: item.step, error: null }))}
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
                const isClickable = canJumpTo(item.step);
                return (
                  <div key={idx}>
                    <div
                      onClick={() => { toggleSection('intro'); if (isClickable) setState(prev => ({ ...prev, step: item.step, error: null })); }}
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
                const chaptersDone = bodyChildren.filter(ch => getStepStatus(ch.step) === 'done' || (state.step === ch.step && !!sections[ch.step as GenerationStep]?.trim())).length;
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
                          const chClickable = canJumpTo(ch.step);
                          const chKey = `ch${ci}`;
                          const chOpen = !collapsedSections[chKey];
                          return (
                            <div key={ci}>
                              <div
                                onClick={() => { toggleSection(chKey); if (chClickable) setState(prev => ({ ...prev, step: ch.step, error: null })); }}
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
              {sessionSaveError
                ? <p className="text-[10px] text-red-600 text-center">⚠️ {sessionSaveError}</p>
                : sessionSavedAt && <p className="text-[9px] text-gray-400 text-center">💾 {sessionSavedAt}</p>}

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
                        <Button variant="secondary" onClick={() => regenerateOutline()} disabled={!outlineFeedback.trim()} className="w-full text-xs" icon={<RefreshCw size={12} />}>
                          AI viết lại dàn ý
                        </Button>
                      </div>
                    )}
                    <Button onClick={generateNextSection} className="w-full text-sm" icon={<ChevronRight size={14} />}>
                      {state.step === GenerationStep.OUTLINE
                        ? 'Chốt & Viết tiếp'
                        : state.step === GenerationStep.CHUONG_4
                          ? 'Hoàn thành bản thảo'
                          : sections[(state.step + 1) as GenerationStep]?.trim()
                            ? `Viết lại: ${STEPS_INFO[state.step + 1]?.label}`
                            : 'Viết phần tiếp theo'}
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
        currentProvider={provider}
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
                  Tiến độ: Bước {pendingSessionData.step} / {GenerationStep.COMPLETED}
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

      {/* Thông báo đang chuyển model/key (tự ẩn khi AI trả lời xong) */}
      {fallbackNotice && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-16 sm:top-4 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-xl flex items-start gap-2 px-4 py-2.5 bg-amber-50 border border-amber-300 text-amber-900 text-sm rounded-xl shadow-lg"
        >
          <RefreshCw size={16} className="animate-spin mt-0.5 flex-shrink-0 text-amber-600" />
          <span>{fallbackNotice}</span>
        </div>
      )}

      {/* Header Button for Settings */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-3">
        <button
          onClick={() => setShowApiModal(true)}
          className="flex items-center gap-2 px-3.5 py-2 bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-sky-200 hover:bg-sky-50 transition-all duration-200"
          title="Cấu hình Provider & API Key"
        >
          <Settings size={18} className="text-sky-600" />
          <div className="text-left hidden sm:block">
            <div className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
              <span>{provider === 'agent-platform' ? '🤖 Agent Platform' : '🌐 Gemini AI'}</span>
              <span className={`px-1.5 py-0.5 text-[10px] rounded ${provider === 'agent-platform' ? 'bg-emerald-100 text-emerald-800 font-semibold' : 'bg-sky-100 text-sky-800 font-semibold'}`}>
                {provider === 'agent-platform' ? 'Agent API' : 'Gemini'}
              </span>
            </div>
            <div className="text-[10px] text-gray-500 font-mono">{selectedModel}</div>
          </div>
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
                        <span className="font-semibold text-emerald-700">Bấm "🔄 Thử lại"</span> - App viết lại đúng phần vừa lỗi bằng API key còn hoạt động; các phần đã viết được giữ nguyên.
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
                {/* Nút Thử lại - chạy lại đúng thao tác vừa lỗi (dàn ý hoặc chương), với key còn hoạt động */}
                {lastActionRef.current && (
                  <button
                    onClick={retryLastAction}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2"
                  >
                    <RefreshCw size={16} />
                    🔄 Thử lại
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

        {!showWorkspace ? (
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
                content={previewContent}
                title={isOutlineView ? 'Dàn ý đề tài KHKT' : 'Bản thảo đề tài KHKT'}
                sections={editableSections}
                defaultSectionKey={String(isOutlineView ? GenerationStep.OUTLINE : defaultEditStep)}
                onUpdateSection={handleSectionUpdate}
                isEditable={!state.isStreaming}
              />

              {/* Mobile Controls Floating */}
              <div className="lg:hidden absolute bottom-4 left-4 right-4 flex gap-2 shadow-lg z-20">
                {!state.isStreaming && state.step < GenerationStep.COMPLETED && (
                  <Button onClick={generateNextSection} className="flex-1 shadow-xl">
                    {state.step === GenerationStep.OUTLINE ? 'Chốt & Tiếp tục' : state.step === GenerationStep.CHUONG_4 ? 'Hoàn thành' : 'Viết tiếp'}
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
                provider={provider}
                currentStep={state.step}
                documentContent={previewContent}
                projectInfo={userInfo}
                onInsertText={handleInsertText}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
