import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import {
  SYSTEM_INSTRUCTION,
  GEMINI_FALLBACK_MODELS,
  AGENT_PLATFORM_FALLBACK_MODELS,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_AGENT_PLATFORM_MODEL,
  AiProvider
} from "../constants";
import { TitleAnalysisResult } from '../types';
import { apiKeyManager } from './apiKeyManager';

export const createGoogleAiClient = (apiKey: string, provider: AiProvider = 'gemini'): GoogleGenAI => {
  if (provider === 'agent-platform') {
    // Agent Platform (Vertex AI) express mode: chỉ cần API key, SDK tự dùng endpoint global
    return new GoogleGenAI({ vertexai: true, apiKey });
  }
  return new GoogleGenAI({ apiKey });
};

const isLegacyGemini2 = (model: string) => model.startsWith('gemini-2');

export { ThinkingLevel };

/**
 * Cấu hình sinh theo dòng model:
 * - Gemini 3+ (kể cả gemini-flash-latest): không gửi temperature/topP/topK (đã deprecated trên 3.x);
 *   mức suy luận dùng thinkingLevel — MEDIUM cho bước sinh chính, LOW cho bước phụ trợ.
 *   Không dùng HIGH mặc định (tốn token suy luận, dễ bị ngắt 503/504 khi viết tài liệu dài)
 *   và không dùng MINIMAL (gemini-3.7/3.8-flash trả 400).
 *   thinkingLevel chỉ gửi cho provider Gemini API.
 * - Gemini 2.x: temperature thấp cho văn bản khoa học + thinkingBudget kiểu cũ.
 */
export const getGeminiGenerationConfig = (
  model: string,
  extraConfig: any = {},
  options: { provider?: AiProvider; thinkingLevel?: ThinkingLevel } = {}
) => {
  const config = { ...extraConfig };

  if (isLegacyGemini2(model)) {
    config.temperature = 0.5;
    config.topK = 64;
    config.topP = 0.95;
  } else {
    delete config.thinkingConfig;
    if (options.thinkingLevel && (options.provider ?? 'gemini') === 'gemini') {
      config.thinkingConfig = { thinkingLevel: options.thinkingLevel };
    }
  }
  return config;
};

// Lấy mã HTTP từ lỗi của SDK (ApiError có .status), rồi mới dò trong message
const getErrorStatusCode = (error: any): number | undefined => {
  if (typeof error?.status === 'number') return error.status;
  if (typeof error?.code === 'number') return error.code;
  const msg = String(error?.message || '');
  const match = msg.match(/"code"\s*:\s*(\d{3})/) || msg.match(/got status:\s*(\d{3})/i) || msg.match(/^\s*\[?(\d{3})\b/);
  return match ? Number(match[1]) : undefined;
};

// Phân loại lỗi API. Kiểm tra lỗi key trước, vì Google trả key sai dưới dạng 400 INVALID_ARGUMENT.
export const parseApiError = (error: any): string => {
  const errorMessage = typeof error === 'string' ? error : String(error?.message || error || '');
  const status = getErrorStatusCode(error);

  if (/API_KEY_INVALID|API key not valid|API_KEY_EXPIRED|API key expired|invalid api key|API key not found/i.test(errorMessage)) {
    return 'INVALID_API_KEY';
  }
  if (status === 401 || /UNAUTHENTICATED/.test(errorMessage)) {
    return 'INVALID_API_KEY';
  }
  if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(errorMessage)) {
    return /per minute|rate limit|PerMinute/i.test(errorMessage) ? 'RATE_LIMIT' : 'QUOTA_EXCEEDED';
  }
  if (status === 403 || /PERMISSION_DENIED/.test(errorMessage)) {
    return 'PERMISSION_DENIED';
  }
  if (status === 404 || /NOT_FOUND|is not found|not supported for generateContent/i.test(errorMessage)) {
    return 'NOT_FOUND';
  }
  if ((status !== undefined && status >= 500) || /INTERNAL|UNAVAILABLE|DEADLINE_EXCEEDED|overloaded|high demand|temporarily unavailable/i.test(errorMessage)) {
    return 'SERVER_ERROR';
  }
  if (status === 400 || /INVALID_ARGUMENT/.test(errorMessage)) {
    return 'INVALID_ARGUMENT';
  }
  if (/Failed to fetch|NetworkError|network|ERR_|connection/i.test(errorMessage)) {
    return 'NETWORK_ERROR';
  }
  return 'UNKNOWN';
};

// Hàm tạo thông báo lỗi thân thiện
export const getFriendlyErrorMessage = (error: any): { type: string; title: string; message: string; suggestions: string[] } => {
  const errorType = parseApiError(error);

  switch (errorType) {
    case 'QUOTA_EXCEEDED':
      return {
        type: 'quota',
        title: '⚠️ Đã vượt quá giới hạn sử dụng',
        message: 'API key đã dùng hết hạn mức (quota) cho các model đã thử. Đây là giới hạn từ phía Google, không phải lỗi của ứng dụng.',
        suggestions: [
          '🔑 Thêm API Key từ tài khoản khác hoặc chuyển đổi giữa Google Gemini API và Agent Platform API trong Cài đặt',
          '⏰ Hoặc đợi quota được reset (thường lúc 0h theo giờ PST, tức 14h–15h giờ Việt Nam)',
          '💡 Mỗi tài khoản có quota riêng, bạn có thể nhập API key riêng để có thêm lượt sử dụng'
        ]
      };

    case 'RATE_LIMIT':
      return {
        type: 'rate_limit',
        title: '🚦 Đang gửi yêu cầu quá nhanh',
        message: 'Vượt giới hạn số yêu cầu mỗi phút. Hãy chờ một chút rồi thử lại.',
        suggestions: [
          '⏳ Đợi 30-60 giây rồi thử lại',
          '🔄 Không bấm nút nhiều lần liên tiếp'
        ]
      };

    case 'INVALID_API_KEY':
      return {
        type: 'auth',
        title: '🔐 API Key không hợp lệ',
        message: 'Google từ chối API Key này (sai, đã bị xoá/thu hồi hoặc hết hạn).',
        suggestions: [
          '🔑 Mở Cài đặt, dán lại API Key và bấm "Kiểm tra key"',
          '🔄 Key AI Studio (AIza...) dùng cho "Google Gemini"; key Agent Platform (AQ...) dùng cho "Agent Platform"',
          '📋 Đảm bảo copy đầy đủ API Key (không thừa/thiếu ký tự, không có dấu cách)'
        ]
      };

    case 'PERMISSION_DENIED':
      return {
        type: 'permission',
        title: '🚫 API Key không có quyền dùng model/dịch vụ này',
        message: 'Key hợp lệ nhưng bị từ chối quyền truy cập (403). Thường do key bị giới hạn theo website/IP, dự án chưa bật Generative Language API, hoặc model không mở cho tài khoản này.',
        suggestions: [
          '🌐 Trong Google Cloud Console → Credentials, bỏ hoặc sửa "Application restrictions" để cho phép trang web này',
          '🧩 Bật "Generative Language API" (Gemini) hoặc "Vertex AI API" (Agent Platform) cho dự án của key',
          '🔄 Chọn model khác trong Cài đặt (dòng 2.5 đã bị Google giới hạn cho tài khoản mới)'
        ]
      };

    case 'NETWORK_ERROR':
      return {
        type: 'network',
        title: '🌐 Lỗi kết nối mạng',
        message: 'Không thể kết nối đến máy chủ AI. Hãy kiểm tra kết nối internet của bạn.',
        suggestions: [
          '📶 Kiểm tra kết nối WiFi/Internet',
          '🔄 Thử làm mới trang (F5)',
          '🌍 Thử sử dụng mạng khác (một số mạng trường học chặn googleapis.com)'
        ]
      };

    case 'INVALID_ARGUMENT':
      return {
        type: 'invalid_argument',
        title: '❌ Yêu cầu không hợp lệ (400)',
        message: 'Máy chủ AI từ chối tham số của yêu cầu (có thể do nội dung quá dài hoặc model không hỗ trợ cấu hình).',
        suggestions: ['🔄 Đổi sang model khác trong Cài đặt rồi thử lại', '✂️ Rút bớt tài liệu tham khảo nếu đã tải lên rất nhiều']
      };

    case 'NOT_FOUND':
      return {
        type: 'not_found',
        title: '❌ Không tìm thấy model (404)',
        message: 'Model AI đang được gọi không tồn tại hoặc không khả dụng trên Provider hiện tại.',
        suggestions: ['🔄 Đổi sang model khác trong phần Cài đặt và bấm "Kiểm tra key"']
      };

    case 'SERVER_ERROR':
      return {
        type: 'server_error',
        title: '🌐 Máy chủ AI đang quá tải (5xx)',
        message: 'Máy chủ AI đang gặp sự cố hoặc quá tải. Hệ thống đã thử các model dự phòng.',
        suggestions: ['⏰ Đợi 1-2 phút rồi bấm "Thử lại"']
      };

    default:
      return {
        type: 'unknown',
        title: '❌ Đã xảy ra lỗi',
        message: (typeof error === 'string' ? error : error?.message) || 'Có lỗi không xác định xảy ra khi gọi AI.',
        suggestions: [
          '🔄 Thử làm mới trang và thực hiện lại',
          '🔑 Kiểm tra API Key và Provider',
          '⏰ Đợi một lúc rồi thử lại'
        ]
      };
  }
};

// ═══════════════════════════════════════════════════════════
// Cấu hình phiên gọi AI
// Mỗi lần gọi là một prompt TỰ CHỨA (không gửi kèm lịch sử chat):
// prompt luôn mang theo dàn ý đã chốt, nên đổi key/model/khôi phục phiên không làm AI "mất trí nhớ",
// và request không phình to theo số chương.
// ═══════════════════════════════════════════════════════════
let currentApiKey: string | null = null;
let currentSelectedModel: string | null = null;
let currentProvider: AiProvider | null = null;

export const initializeGeminiChat = (apiKey: string, selectedModel?: string, provider?: AiProvider) => {
  const activeProvider = provider || apiKeyManager.getProvider();
  currentApiKey = apiKey;
  currentProvider = activeProvider;
  currentSelectedModel = selectedModel || (activeProvider === 'agent-platform' ? DEFAULT_AGENT_PLATFORM_MODEL : DEFAULT_GEMINI_MODEL);
};

const resolveCallConfig = (model?: string, provider?: AiProvider) => {
  const activeProvider = provider || currentProvider || apiKeyManager.getProvider();
  const apiKey = (activeProvider === currentProvider && currentApiKey) || apiKeyManager.getActiveKey(activeProvider);
  if (!apiKey) {
    throw new Error("Không có API Key. Vui lòng nhập API key trong phần Cài đặt.");
  }
  const selectedModel = model || currentSelectedModel || (activeProvider === 'agent-platform' ? DEFAULT_AGENT_PLATFORM_MODEL : DEFAULT_GEMINI_MODEL);
  return { apiKey, provider: activeProvider, selectedModel };
};

// Sắp xếp models với model được chọn đầu tiên
const getOrderedModels = (selectedModel: string, provider: AiProvider): string[] => {
  const fallbackList = provider === 'agent-platform' ? AGENT_PLATFORM_FALLBACK_MODELS : GEMINI_FALLBACK_MODELS;
  const orderedModels: string[] = [selectedModel];
  for (const model of fallbackList) {
    if (!orderedModels.includes(model)) {
      orderedModels.push(model);
    }
  }
  return orderedModels;
};

// Lỗi gắn với model (không phải với key/mạng) => thử model kế tiếp
const FALLBACK_ERROR_TYPES = new Set(['QUOTA_EXCEEDED', 'RATE_LIMIT', 'NOT_FOUND', 'SERVER_ERROR', 'PERMISSION_DENIED', 'INVALID_ARGUMENT']);

/** Loại bỏ HTML tags không mong muốn từ AI output, chuyển <br> thành newlines */
const sanitizeAIOutput = (text: string): string => {
  let clean = text;
  clean = clean.replace(/<br\s*\/?>/gi, '\n');
  clean = clean.replace(/<\/?(p|div|span|b|i|em|strong|u|s|del|ins|mark|sub|sup|small|big|center)(\s[^>]*)?>/gi, '');
  return clean;
};

/** Lỗi xảy ra khi model đã trả về một phần nội dung — không thể chuyển model mà không lặp nội dung */
export class PartialStreamError extends Error {
  partialText: string;
  cause: any;
  constructor(cause: any, partialText: string) {
    super(cause?.message || String(cause));
    this.name = 'PartialStreamError';
    this.partialText = partialText;
    this.cause = cause;
    (this as any).status = cause?.status;
  }
}

// ═══════════════════════════════════════════════════════════
// Thông báo chuyển model cho giao diện (fallbackNotice)
// ═══════════════════════════════════════════════════════════
export type ModelFallbackEvent =
  | { type: 'switch'; label: string; from: string; to: string; reason: string }
  | { type: 'done'; label: string };

let modelFallbackListener: ((event: ModelFallbackEvent) => void) | null = null;

/** Đăng ký nhận sự kiện chuyển model; 'done' phát ra khi một lần gọi kết thúc (thành công hay lỗi). */
export const setModelFallbackListener = (listener: ((event: ModelFallbackEvent) => void) | null) => {
  modelFallbackListener = listener;
};

const emitFallbackEvent = (event: ModelFallbackEvent) => {
  try {
    modelFallbackListener?.(event);
  } catch (e) {
    console.warn('Lỗi trong listener fallback:', e);
  }
};

const FALLBACK_REASON_TEXT: Record<string, string> = {
  QUOTA_EXCEEDED: 'đã hết lượt sử dụng',
  RATE_LIMIT: 'đang bị giới hạn tốc độ',
  SERVER_ERROR: 'đang bận',
  NOT_FOUND: 'không khả dụng',
  PERMISSION_DENIED: 'không mở cho API key này',
  INVALID_ARGUMENT: 'không nhận cấu hình yêu cầu',
};

const streamWithFallback = async (
  message: string,
  onChunk: (text: string) => void,
  options: { useSearch: boolean; thinkingLevel: ThinkingLevel; model?: string; provider?: AiProvider; label: string }
): Promise<string> => {
  const { apiKey, provider, selectedModel } = resolveCallConfig(options.model, options.provider);
  const modelsToTry = getOrderedModels(selectedModel, provider);
  // Google Search grounding chỉ bật với Gemini API; Agent Platform chưa xác nhận hỗ trợ ở chế độ API key
  const useSearch = options.useSearch && provider === 'gemini';
  let lastError: any = null;

  console.log(`🚀 [${options.label}] (${provider}, thinking ${options.thinkingLevel}${useSearch ? ', search' : ''}) thử ${modelsToTry.length} model: ${modelsToTry.join(' → ')}`);

  try {
    for (let i = 0; i < modelsToTry.length; i++) {
      const model = modelsToTry[i];
      let fullResponse = "";
      try {
        const ai = createGoogleAiClient(apiKey, provider);
        const response = await ai.models.generateContentStream({
          model,
          contents: [{ role: 'user', parts: [{ text: message }] }],
          config: getGeminiGenerationConfig(model, {
            systemInstruction: SYSTEM_INSTRUCTION,
            maxOutputTokens: 65536,
            thinkingConfig: { thinkingBudget: 2048 },
            ...(useSearch ? { tools: [{ googleSearch: {} }] } : {})
          }, { provider, thinkingLevel: options.thinkingLevel })
        });

        for await (const chunk of response) {
          if (chunk.text) {
            const cleanText = sanitizeAIOutput(chunk.text);
            onChunk(cleanText);
            fullResponse += cleanText;
          }
        }

        console.log(`✅ [${options.label}] Thành công với model ${model}, ${fullResponse.length} ký tự`);
        return fullResponse;
      } catch (error: any) {
        console.error(`❌ [${options.label}] Model ${model} thất bại:`, error?.message || error);
        lastError = error;

        // Đã stream ra một phần: chuyển model sẽ viết lại từ đầu và nhân đôi nội dung => dừng, giữ phần đã có
        if (fullResponse.length > 0) {
          throw new PartialStreamError(error, fullResponse);
        }

        const errorType = parseApiError(error);
        if (!FALLBACK_ERROR_TYPES.has(errorType)) {
          console.error(`🛑 [${options.label}] Lỗi ${errorType}, không thử model khác.`);
          throw error;
        }
        const nextModel = modelsToTry[i + 1];
        if (nextModel) {
          console.log(`⏭️ [${options.label}] Lỗi ${errorType}, chuyển sang ${nextModel}...`);
          emitFallbackEvent({ type: 'switch', label: options.label, from: model, to: nextModel, reason: FALLBACK_REASON_TEXT[errorType] || 'gặp lỗi' });
        }
      }
    }

    console.error(`💀 [${options.label}] Tất cả ${modelsToTry.length} model đều thất bại.`);
    throw lastError || new Error("Tất cả models đều thất bại. Vui lòng kiểm tra API key hoặc thử lại sau.");
  } finally {
    // Kết thúc (thành công hoặc lỗi) => giao diện xoá thông báo chuyển model
    emitFallbackEvent({ type: 'done', label: options.label });
  }
};

export interface StreamOptions {
  /** Mặc định: MEDIUM cho sendMessageStream (sinh chính), LOW cho sendSinglePromptStream (phụ trợ) */
  thinkingLevel?: ThinkingLevel;
}

/** Sinh nội dung chính của đề tài (dàn ý, chương); bật Google Search grounding với Gemini API. Trả về toàn văn. */
export const sendMessageStream = (message: string, onChunk: (text: string) => void, model?: string, provider?: AiProvider, options: StreamOptions = {}): Promise<string> =>
  streamWithFallback(message, onChunk, { useSearch: true, thinkingLevel: options.thinkingLevel ?? ThinkingLevel.MEDIUM, model, provider, label: 'Chat' });

/**
 * Gửi prompt đơn lẻ với streaming, không dùng công cụ tìm kiếm.
 * Mặc định thinkingLevel LOW cho tác vụ phụ trợ (gợi ý, sửa văn, chấm điểm, JSON);
 * tác vụ sinh nội dung dài (phụ lục, viết đoạn) truyền ThinkingLevel.MEDIUM.
 */
export const sendSinglePromptStream = (message: string, onChunk: (text: string) => void, model?: string, provider?: AiProvider, options: StreamOptions = {}): Promise<string> =>
  streamWithFallback(message, onChunk, { useSearch: false, thinkingLevel: options.thinkingLevel ?? ThinkingLevel.LOW, model, provider, label: 'SinglePrompt' });

export interface ApiKeyCheckResult {
  ok: boolean;
  workingModel?: string;
  errorType?: string;
  message: string;
}

/**
 * Kiểm tra key bằng một request rất nhỏ, thử lần lượt model đã chọn rồi các model dự phòng.
 * Trả về model đầu tiên gọi được để người dùng biết key thực sự dùng được với model nào.
 */
export const validateApiKey = async (apiKey: string, provider: AiProvider, preferredModel: string): Promise<ApiKeyCheckResult> => {
  const ai = createGoogleAiClient(apiKey.trim(), provider);
  let lastError: any = null;

  for (const model of getOrderedModels(preferredModel, provider)) {
    try {
      await ai.models.generateContent({
        model,
        contents: 'Trả lời đúng một từ: OK',
        // Dùng cùng kiểu cấu hình với lúc chạy thật để phát hiện sớm model không nhận thinkingLevel
        config: getGeminiGenerationConfig(model, { maxOutputTokens: 64 }, { provider, thinkingLevel: ThinkingLevel.LOW })
      });
      return {
        ok: true,
        workingModel: model,
        message: model === preferredModel
          ? `Key hoạt động tốt với model ${model}.`
          : `Key hoạt động, nhưng model ${preferredModel} không gọi được; dùng được ${model}.`
      };
    } catch (error: any) {
      lastError = error;
      const errorType = parseApiError(error);
      if (!FALLBACK_ERROR_TYPES.has(errorType)) {
        const info = getFriendlyErrorMessage(error);
        return { ok: false, errorType, message: `${info.title}: ${info.message}` };
      }
    }
  }

  const info = getFriendlyErrorMessage(lastError);
  return { ok: false, errorType: parseApiError(lastError), message: `${info.title}: ${info.message}` };
};

export const analyzeDocumentForSKKN = async (
  apiKey: string,
  documentContent: string,
  documentType: 'reference' | 'template',
  selectedModel?: string,
  provider: AiProvider = 'gemini'
): Promise<string> => {
  const ai = createGoogleAiClient(apiKey, provider);

  // Giới hạn nội dung để tránh vượt token limit
  const truncatedContent = documentContent.substring(0, 20000);

  const prompt = documentType === 'reference'
    ? `Bạn là chuyên gia phân tích tài liệu giáo dục. Hãy phân tích TÀI LIỆU THAM KHẢO sau và trích xuất thông tin hữu ích cho việc viết SKKN (Sáng kiến Kinh nghiệm):

📚 **TÀI LIỆU THAM KHẢO:**
${truncatedContent}

---

Hãy phân tích và trả về kết quả theo format sau:

## 📖 1. NỘI DUNG CHÍNH
- Liệt kê các chủ đề, khái niệm, kiến thức quan trọng
- Tóm tắt ý chính của tài liệu

## 🔧 2. PHƯƠNG PHÁP / KỸ THUẬT (nếu có)
- Các phương pháp dạy học được đề cập
- Kỹ thuật, chiến lược giảng dạy

## 📊 3. SỐ LIỆU / DỮ LIỆU QUAN TRỌNG (nếu có)
- Thống kê, bảng biểu
- Kết quả nghiên cứu, khảo sát

## 💡 4. GỢI Ý ÁP DỤNG CHO SKKN
- Cách tận dụng tài liệu này vào đề tài SKKN
- Các điểm có thể tham khảo, trích dẫn
- Ý tưởng phát triển giải pháp

⚠️ Lưu ý: Trả lời ngắn gọn, súc tích, tập trung vào thông tin hữu ích nhất.`
    : `Bạn là chuyên gia về quy trình viết SKKN. Hãy phân tích MẪU YÊU CẦU SKKN sau và trích xuất thông tin quan trọng:

📋 **MẪU YÊU CẦU SKKN:**
${truncatedContent}

---

Hãy phân tích và trả về kết quả theo format sau:

## 📝 1. CẤU TRÚC YÊU CẦU
- Các phần bắt buộc phải có
- Thứ tự các mục
- Quy định về format

## ⭐ 2. TIÊU CHÍ ĐÁNH GIÁ (nếu có)
- Các tiêu chí chấm điểm
- Thang điểm
- Trọng số các phần

## 📏 3. YÊU CẦU ĐẶC BIỆT
- Độ dài tối thiểu/tối đa
- Font chữ, cỡ chữ, căn lề
- Quy định về trích dẫn, tài liệu tham khảo

## ⚠️ 4. LƯU Ý QUAN TRỌNG
- Các điểm cần tuân thủ nghiêm ngặt
- Lỗi thường gặp cần tránh
- Điểm khác biệt so với mẫu chuẩn (nếu có)

⚠️ Lưu ý: Trả lời ngắn gọn, súc tích, tập trung vào thông tin cần thiết nhất.`;

  const model = selectedModel || (provider === 'agent-platform' ? DEFAULT_AGENT_PLATFORM_MODEL : DEFAULT_GEMINI_MODEL);

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt
    });

    return response.text || 'Không thể phân tích tài liệu. Vui lòng thử lại.';
  } catch (error: any) {
    console.error('Lỗi phân tích tài liệu:', error);
    throw new Error(getFriendlyErrorMessage(error).message);
  }
};

// Interface cho cấu trúc mục SKKN (import từ types.ts nếu cần)
interface SKKNSection {
  id: string;
  level: number;
  title: string;
  suggestedContent?: string;
}

// Trích xuất cấu trúc mục từ mẫu SKKN
export const extractSKKNStructure = async (
  apiKey: string,
  templateContent: string,
  selectedModel?: string,
  provider: AiProvider = 'gemini'
): Promise<SKKNSection[]> => {
  const ai = createGoogleAiClient(apiKey, provider);

  // Giới hạn nội dung để tránh vượt token limit
  const truncatedContent = templateContent.substring(0, 25000);

  const prompt = `Bạn là chuyên gia phân tích cấu trúc tài liệu SKKN (Sáng kiến Kinh nghiệm).

NHIỆM VỤ: Phân tích MẪU YÊU CẦU SKKN sau và TRÍCH XUẤT CHÍNH XÁC cấu trúc các mục/phần.

═══════════════════════════════════════════════════════════════
MẪU SKKN CẦN PHÂN TÍCH:
═══════════════════════════════════════════════════════════════
${truncatedContent}
═══════════════════════════════════════════════════════════════

TRẢ VỀ JSON ARRAY với format CHÍNH XÁC sau (KHÔNG có text khác, CHỈ JSON):

[
  {"id": "1", "level": 1, "title": "PHẦN I: ĐẶT VẤN ĐỀ"},
  {"id": "1.1", "level": 2, "title": "1. Lý do chọn đề tài"},
  {"id": "1.2", "level": 2, "title": "2. Mục đích nghiên cứu"},
  {"id": "2", "level": 1, "title": "PHẦN II: NỘI DUNG"},
  {"id": "2.1", "level": 2, "title": "1. Cơ sở lý luận"},
  {"id": "2.1.1", "level": 3, "title": "1.1. Khái niệm"},
  ...
]

QUY TẮC QUAN TRỌNG:
1. level 1: Phần lớn nhất (PHẦN I, PHẦN II, CHƯƠNG 1, MỤC A...)
2. level 2: Mục con (1., 2., I.1., 1.1...)  
3. level 3: Mục nhỏ hơn (a., b., 1.1.1., 1.1.2...)
4. Giữ NGUYÊN tiêu đề gốc trong mẫu (không dịch, không sửa)
5. Trích xuất TẤT CẢ các mục có trong mẫu
6. CHỈ TRẢ VỀ JSON ARRAY, KHÔNG giải thích, KHÔNG markdown code block

BẮT ĐẦU JSON NGAY:`;

  const model = selectedModel || (provider === 'agent-platform' ? DEFAULT_AGENT_PLATFORM_MODEL : DEFAULT_GEMINI_MODEL);

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt
    });

    const responseText = response.text || '[]';

    let jsonText = responseText.trim();

    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }

    const sections: SKKNSection[] = JSON.parse(jsonText);

    return sections.filter(s => s.id && s.title && typeof s.level === 'number');

  } catch (error: any) {
    console.error('Lỗi trích xuất cấu trúc SKKN:', error);
    return [];
  }
};

/**
 * Phân tích tên đề tài SKKN
 * Theo quy trình kiểm tra 3 lớp từ quy trinh kiem tra.txt
 */
export const analyzeTitleSKKN = async (
  apiKey: string,
  title: string,
  subject?: string,
  level?: string,
  selectedModel?: string,
  provider: AiProvider = 'gemini'
): Promise<TitleAnalysisResult> => {
  const ai = createGoogleAiClient(apiKey, provider);

  const prompt = `Bạn là chuyên gia phân tích tên đề tài Sáng kiến kinh nghiệm (SKKN) với 20 năm kinh nghiệm.

## THÔNG TIN ĐỀ TÀI CẦN PHÂN TÍCH:
- Tên đề tài: "${title}"
${subject ? `- Môn học/Lĩnh vực: ${subject}` : ''}
${level ? `- Cấp học: ${level}` : ''}

## QUY TRÌNH KIỂM TRA 3 LỚP:

### LỚP 1: DATABASE NỘI BỘ (Đề tài phổ biến)
So sánh với database đề tài tích hợp:

🔴 TRÙNG LẶP CAO (80-90%):
- "Ứng dụng AI trong dạy học môn [X]"
- "Sử dụng ChatGPT hỗ trợ [công việc Y]"
- "Ứng dụng Canva thiết kế bài giảng"
- "Sử dụng Kahoot/Quizizz tăng tính tương tác"
- "Dạy học trực tuyến qua Google Meet/Zoom"
- "Ứng dụng Google Classroom quản lý lớp học"

🟡 TRÙNG LẶP TRUNG BÌNH (60-70%):
- "Dạy học theo dự án (PBL) môn [X]"
- "Phương pháp dạy học tích cực môn [X]"
- "Dạy học theo nhóm hiệu quả"
- "Phát triển năng lực tự học của học sinh"

🟢 TRÙNG LẶP THẤP (20-40%):
- "Kết hợp AI và PBL trong dạy STEM lớp 8"
- Các đề tài kết hợp nhiều phương pháp
- Đề tài có đối tượng đặc biệt (HS khuyết tật, vùng cao)

### LỚP 2: TÌM KIẾM ONLINE (Mô phỏng)
Ước tính số lượng đề tài tương tự trên:
- Cổng SKKN Bộ GD&ĐT
- Sở GD&ĐT các tỉnh
- Tạp chí Giáo dục
- Google Scholar

### LỚP 3: WEBSITE CHUYÊN NGÀNH
- violet.vn, tailieu.vn, 123doc.net
- thuvienvatly.com, giaoducthoidai.vn

## CHẤM ĐIỂM (TỔNG 100 ĐIỂM):

1. **Độ cụ thể (max 25đ)**:
   - 25: Có đầy đủ: môn học, cấp học, công cụ, phạm vi cụ thể
   - 20: Có 3/4 yếu tố
   - 15: Có 2/4 yếu tố
   - 10: Chỉ có 1 yếu tố cụ thể
   - 5: Quá chung chung

2. **Tính mới (max 30đ)**:
   - 30: Chưa ai làm, hoàn toàn mới
   - 25: Kết hợp 2-3 yếu tố mới
   - 20: Có 1 điểm mới rõ ràng
   - 15: Cải tiến từ đề tài cũ
   - 10: Đã có nhiều người làm
   - 5: Trùng lặp hoàn toàn

3. **Tính khả thi (max 25đ)**:
   - 25: Rất dễ thực hiện, nguồn lực sẵn có
   - 20: Khả thi, cần chuẩn bị ít
   - 15: Khả thi nhưng cần thời gian/chi phí
   - 10: Khó khăn, cần nhiều nguồn lực
   - 5: Không khả thi

4. **Độ rõ ràng (max 20đ)**:
   - 20: Tên ngắn gọn, dễ hiểu, có từ khóa rõ
   - 15: Rõ ràng nhưng hơi dài
   - 10: Có thể hiểu nhưng chưa tối ưu
   - 5: Khó hiểu, rườm rà

## PHÁT HIỆN VẤN ĐỀ:
- Từ ngữ chung chung: "ứng dụng công nghệ", "nâng cao chất lượng", "một số biện pháp"
- Từ quá tham vọng: "toàn diện", "cách mạng hóa", "đột phá"
- Công cụ lỗi thời: "băng hình", "đĩa CD", "máy chiếu overhead"
- Công cụ quá phổ biến: "ChatGPT", "Kahoot", "Google Classroom"

## ĐỀ XUẤT 5 TÊN THAY THẾ (Công thức):
1. Cụ thể hóa: Thêm [Cấp học] + [Bối cảnh đặc biệt]
2. Kết hợp: [Công nghệ A] + [Phương pháp B] + [Môn học C]
3. Đối tượng đặc biệt: [Phương pháp] + [HS đặc thù] + [Mục tiêu]
4. Bài học cụ thể: [Phương pháp] + [Bài/Chương cụ thể] + [Công cụ]
5. Tạo công cụ mới: Thiết kế [Công cụ tự tạo] + [Mục đích]

TRẢ VỀ JSON (KHÔNG có markdown code block, CHỈ JSON thuần):
{
  "structure": {
    "action": "Từ khóa hành động (hoặc rỗng)",
    "tool": "Công cụ/Phương tiện (hoặc rỗng)",
    "subject": "Môn học/Lĩnh vực",
    "scope": "Phạm vi (lớp, cấp học)",
    "purpose": "Mục đích"
  },
  "duplicateLevel": "Cao|Trung bình|Thấp",
  "duplicateDetails": "Giải thích chi tiết về mức độ trùng lặp",
  "scores": {
    "specificity": <điểm>,
    "novelty": <điểm>,
    "feasibility": <điểm>,
    "clarity": <điểm>,
    "total": <tổng điểm>
  },
  "scoreDetails": [
    { "category": "Độ cụ thể", "score": <điểm>, "maxScore": 25, "reason": "lý do" },
    { "category": "Tính mới", "score": <điểm>, "maxScore": 30, "reason": "lý do" },
    { "category": "Tính khả thi", "score": <điểm>, "maxScore": 25, "reason": "lý do" },
    { "category": "Độ rõ ràng", "score": <điểm>, "maxScore": 20, "reason": "lý do" }
  ],
  "problems": ["Vấn đề 1", "Vấn đề 2"],
  "suggestions": [
    { "title": "Tên đề tài thay thế 1", "strength": "Điểm mạnh", "predictedScore": <điểm dự kiến> },
    { "title": "Tên đề tài thay thế 2", "strength": "Điểm mạnh", "predictedScore": <điểm dự kiến> },
    { "title": "Tên đề tài thay thế 3", "strength": "Điểm mạnh", "predictedScore": <điểm dự kiến> },
    { "title": "Tên đề tài thay thế 4", "strength": "Điểm mạnh", "predictedScore": <điểm dự kiến> },
    { "title": "Tên đề tài thay thế 5", "strength": "Điểm mạnh", "predictedScore": <điểm dự kiến> }
  ],
  "relatedTopics": ["Đề tài mới nổi 1", "Đề tài mới nổi 2", "Đề tài mới nổi 3"],
  "overallVerdict": "Kết luận tổng quan và lời khuyên"
}

BẮT ĐẦU JSON NGAY:`;

  const model = selectedModel || (provider === 'agent-platform' ? DEFAULT_AGENT_PLATFORM_MODEL : DEFAULT_GEMINI_MODEL);

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt
    });

    const responseText = response.text || '{}';

    let jsonText = responseText.trim();

    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }

    const result: TitleAnalysisResult = JSON.parse(jsonText);
    return result;

  } catch (error: any) {
    console.error('Lỗi phân tích đề tài:', error);
    throw new Error(getFriendlyErrorMessage(error).message);
  }
};
