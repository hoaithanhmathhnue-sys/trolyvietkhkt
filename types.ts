// ═══════════════════════════════════════════════════════════
// KHKT Writer Pro - Types & Interfaces
// Đề tài Khoa học Kỹ thuật cho học sinh THPT
// ═══════════════════════════════════════════════════════════

// Thông tin dự án KHKT
export interface KHKTProjectInfo {
  // === Thông tin cơ bản ===
  projectTitle: string;        // Tên đề tài KHKT
  field: string;               // Lĩnh vực KHKT (22 lĩnh vực)
  level: string;               // Cấp độ thi: Trường/Tỉnh/Quốc gia/Quốc tế

  // === Thành viên & Trường ===
  members: string;             // Thành viên nhóm (tên, lớp)
  advisor: string;             // Giáo viên hướng dẫn
  school: string;              // Trường THPT
  location: string;            // Địa phương (huyện/tỉnh)

  // === Nội dung nghiên cứu ===
  problem: string;             // Vấn đề nghiên cứu / Lý do chọn đề tài
  objectives: string;          // Mục tiêu nghiên cứu
  hypothesis: string;          // Giả thuyết khoa học
  methods: string;             // Phương pháp nghiên cứu chính
  researchSubjects: string;    // Đối tượng / phạm vi nghiên cứu
  timeframe: string;           // Thời gian thực hiện

  // === Tùy chọn nâng cao ===
  referenceDocuments: string;  // Tài liệu tham khảo đã upload (nội dung text)
  specialRequirements: string; // Yêu cầu đặc biệt từ người dùng
  pageLimit: number | '';      // Giới hạn số trang ('' = không giới hạn)
  includeStatistics: boolean;  // Bổ sung bảng biểu thống kê chi tiết
  includeSurvey: boolean;      // Tạo mẫu phiếu khảo sát
  requirementsConfirmed: boolean; // Đã xác nhận các yêu cầu chưa
}

// Alias cho backward compatibility
export type UserInfo = KHKTProjectInfo;

// Các bước viết đề tài KHKT (9 bước)
export enum GenerationStep {
  INPUT_FORM = 0,      // Form nhập thông tin dự án
  OUTLINE = 1,         // Lập dàn ý tổng quan 4 chương
  PHAN_MO_DAU = 2,     // Phần Mở đầu (Lý do, Mục đích, Câu hỏi NC, Giả thuyết, PP)
  CHUONG_1 = 3,        // Chương 1: Cơ sở lý luận
  CHUONG_2 = 4,        // Chương 2: Thực trạng
  CHUONG_3 = 5,        // Chương 3: Thiết kế giải pháp / Sản phẩm
  CHUONG_4 = 6,        // Chương 4: Thực nghiệm & Đánh giá + Phần III. Kết luận
  PHU_LUC = 7,         // Phụ lục (Phiếu KS, Bảng số liệu, Hình ảnh, Minh chứng)
  COMPLETED = 8        // Hoàn thành
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

// Nội dung tài liệu tách theo từng bước: sinh lại một bước chỉ thay đúng phần đó, không nối trùng
export type DocumentSections = Partial<Record<GenerationStep, string>>;

export interface GenerationState {
  step: GenerationStep;               // Bước cuối cùng đã hoàn thành (chỉ cập nhật khi AI trả lời xong)
  streamingStep: GenerationStep | null; // Bước đang được AI viết
  isStreaming: boolean;
  error: string | null;
}

// ═══════════════════════════════════════════════════════════
// Kết quả phân tích tên đề tài KHKT
// ═══════════════════════════════════════════════════════════
export interface TitleAnalysisResult {
  // Cấu trúc tên đề tài
  structure: {
    researchType: string;   // Loại NC (Nghiên cứu, Chế tạo, Thiết kế, Ứng dụng...)
    subject: string;        // Đối tượng nghiên cứu
    field: string;          // Lĩnh vực KHKT
    scope: string;          // Phạm vi
    innovation: string;     // Điểm mới/sáng tạo
  };

  // Mức độ trùng lặp
  duplicateLevel: 'Cao' | 'Trung bình' | 'Thấp';
  duplicateDetails: string;

  // Điểm số (tổng 100)
  scores: {
    specificity: number;    // Độ cụ thể (max 25)
    novelty: number;        // Tính mới/sáng tạo (max 30)
    feasibility: number;    // Tính khả thi (max 25)
    clarity: number;        // Độ rõ ràng (max 20)
    total: number;          // Tổng điểm
  };

  // Chi tiết từng tiêu chí
  scoreDetails: Array<{
    category: string;
    score: number;
    maxScore: number;
    reason: string;
  }>;

  // Vấn đề cần khắc phục
  problems: string[];

  // Gợi ý 5 tên đề tài thay thế
  suggestions: Array<{
    title: string;
    strength: string;
    predictedScore: number;
  }>;

  // Đề tài liên quan / xu hướng mới
  relatedTopics: string[];

  // Kết luận tổng quan
  overallVerdict: string;
}
