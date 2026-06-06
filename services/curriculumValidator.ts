/**
 * Curriculum Validator Service - Kiểm tra nội dung SKKN theo GDPT 2018
 * Đảm bảo nội dung phù hợp với cấp lớp, môn học
 * Re-export từ KIEN THUC CAC MON/curriculum-validator.ts, điều chỉnh path import
 */

import curriculumDB from '../KIEN THUC CAC MON/curriculum-database.json';

export interface ValidationResult {
  isValid: boolean;
  grade: string;
  subject: string;
  issues: string[];
  suggestions: string[];
}

class CurriculumValidator {
  private db: typeof curriculumDB;

  constructor() {
    this.db = curriculumDB;
  }

  /**
   * Validate outline/dàn ý SKKN
   */
  validateOutline(
    subject: string,
    grade: string | number,
    outline: string
  ): ValidationResult {
    const gradeStr = grade.toString();
    const result: ValidationResult = {
      isValid: true,
      grade: gradeStr,
      subject,
      issues: [],
      suggestions: [],
    };

    if (!this.isValidSubject(subject)) {
      // Môn học không nằm trong DB curriculum → bỏ qua validation (có thể là môn đặc thù)
      return result;
    }

    if (!this.isValidGrade(gradeStr)) {
      return result;
    }

    // Kiểm tra forbidden keywords
    const forbiddenKeywords = this.getForbiddenKeywords(subject, gradeStr);
    const foundForbidden = this.findForbiddenContent(outline, forbiddenKeywords);

    if (foundForbidden.length > 0) {
      result.isValid = false;
      result.issues.push(
        `Nội dung chứa kiến thức VƯỢT CẤP (không thuộc lớp ${gradeStr}): ${foundForbidden.join(', ')}`
      );
      result.suggestions.push(
        `Các từ khóa trên thuộc chương trình lớp cao hơn. Hãy thay thế bằng nội dung phù hợp lớp ${gradeStr}.`
      );
    }

    return result;
  }

  /**
   * Lấy danh sách keywords cấm cho một lớp, môn
   */
  getForbiddenKeywords(subject: string, grade: string): string[] {
    const subjectKey = this.mapSubjectName(subject);
    const subjectData = (this.db.subjects as any)[subjectKey];

    if (!subjectData || !subjectData.grades[grade]) {
      return [];
    }

    return subjectData.grades[grade].forbiddenKeywords || [];
  }

  /**
   * Lấy danh sách topics hợp lệ cho lớp, môn
   */
  getValidTopics(subject: string, grade: string): string[] {
    const subjectKey = this.mapSubjectName(subject);
    const subjectData = (this.db.subjects as any)[subjectKey];

    if (!subjectData || !subjectData.grades[grade]) {
      return [];
    }

    return subjectData.grades[grade].topics || [];
  }

  /**
   * Tìm forbidden keywords trong nội dung
   */
  private findForbiddenContent(
    content: string,
    forbiddenKeywords: string[]
  ): string[] {
    const found: string[] = [];
    const lowerContent = content.toLowerCase();

    forbiddenKeywords.forEach((keyword) => {
      if (lowerContent.includes(keyword.toLowerCase())) {
        found.push(keyword);
      }
    });

    return found;
  }

  /**
   * Kiểm tra môn học có hợp lệ (có trong DB)
   */
  private isValidSubject(subject: string): boolean {
    const subjects = Object.keys(this.db.subjects);
    return subjects.some(
      (s) =>
        this.mapSubjectName(subject).toLowerCase() === s.toLowerCase()
    );
  }

  /**
   * Kiểm tra lớp có hợp lệ
   */
  private isValidGrade(grade: string): boolean {
    const gradeNum = parseInt(grade);
    return gradeNum >= 1 && gradeNum <= 12;
  }

  /**
   * Ánh xạ tên môn học từ các dạng khác nhau
   */
  private mapSubjectName(subject: string): string {
    const mapping: { [key: string]: string } = {
      'toán': 'toan',
      'math': 'toan',
      'ngữ văn': 'nguVan',
      'tiếng việt': 'nguVan',
      'vietnamese': 'nguVan',
      'tiếng anh': 'tiengAnh',
      'english': 'tiengAnh',
      'địa lí': 'diaLi',
      'địa lý': 'diaLi',
      'geography': 'diaLi',
      'lịch sử': 'lichSu',
      'history': 'lichSu',
      'khoa học tự nhiên': 'khoaHocTuNhien',
      'vật lí': 'khoaHocTuNhien',
      'vật lý': 'khoaHocTuNhien',
      'hoá học': 'khoaHocTuNhien',
      'hóa học': 'khoaHocTuNhien',
      'sinh học': 'khoaHocTuNhien',
      'giáo dục công dân': 'giaoDucCongDan',
      'civics': 'giaoDucCongDan',
    };

    const key = subject.toLowerCase().trim();
    return mapping[key] || key;
  }

  /**
   * Lấy thông tin cấp học
   */
  getGradeInfo(grade: string | number) {
    const gradeNum = parseInt(grade.toString());

    if (gradeNum >= 1 && gradeNum <= 5) {
      return { stage: 'Tiểu học', level: 'elementary' };
    } else if (gradeNum >= 6 && gradeNum <= 9) {
      return { stage: 'THCS', level: 'secondary' };
    } else if (gradeNum >= 10 && gradeNum <= 12) {
      return { stage: 'THPT', level: 'highSchool' };
    }
    return { stage: 'Unknown', level: 'unknown' };
  }

  /**
   * Tạo đoạn system prompt ràng buộc phạm vi kiến thức cho Gemini
   */
  generateCurriculumPrompt(subject: string, grade: string | number): string {
    const gradeStr = grade.toString();
    const validTopics = this.getValidTopics(subject, gradeStr);
    const forbiddenKeywords = this.getForbiddenKeywords(subject, gradeStr);
    const gradeInfo = this.getGradeInfo(gradeStr);

    // Không có dữ liệu curriculum → trả rỗng (không inject)
    if (validTopics.length === 0 && forbiddenKeywords.length === 0) {
      return '';
    }

    let prompt = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 RÀNG BUỘC PHẠM VI KIẾN THỨC (GDPT 2018) - BẮT BUỘC TUÂN THỦ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Đề tài này thuộc môn ${subject}, lớp ${gradeStr} (${gradeInfo.stage}).
Nội dung SKKN PHẢI nằm trong phạm vi kiến thức GDPT 2018 cho lớp ${gradeStr}.`;

    if (validTopics.length > 0) {
      prompt += `

✅ PHẠM VI KIẾN THỨC ĐƯỢC PHÉP (lớp ${gradeStr}):
${validTopics.map((t) => `  - ${t}`).join('\n')}`;
    }

    if (forbiddenKeywords.length > 0) {
      prompt += `

🚫 TUYỆT ĐỐI KHÔNG ĐƯỢC CHỨA (kiến thức vượt cấp, thuộc lớp cao hơn):
${forbiddenKeywords.map((k) => `  - "${k}" ← VƯỢT CẤP, CẤM SỬ DỤNG`).join('\n')}`;
    }

    prompt += `

⚠️ QUY TẮC NGHIÊM NGẶT:
1. Dàn ý, ví dụ, bài tập minh họa PHẢI nằm trong phạm vi kiến thức lớp ${gradeStr}
2. KHÔNG được sử dụng kiến thức của lớp cao hơn dù chỉ để "mở rộng" hay "nâng cao"
3. Các ví dụ toán học, bài tập phải PHÙ HỢP trình độ học sinh lớp ${gradeStr} (${gradeInfo.stage})
4. Nếu đề tài liên quan đến kiến thức nâng cao → chỉ sử dụng kiến thức TRONG PHẠM VI lớp ${gradeStr}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    return prompt;
  }
}

export const curriculumValidator = new CurriculumValidator();
export default CurriculumValidator;
