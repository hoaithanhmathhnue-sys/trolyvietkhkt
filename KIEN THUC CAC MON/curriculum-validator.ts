/**
 * Curriculum Validator - Kiểm tra nội dung SKKN theo GDPT 2018
 * Đảm bảo nội dung phù hợp với cấp lớp, môn học
 */

import curriculumDB from './curriculum-database.json';

interface ValidationResult {
  isValid: boolean;
  grade: string;
  subject: string;
  issues: string[];
  suggestions: string[];
}

/**
 * Kiểm tra nội dung SKKN có phù hợp với cấp lớp, môn học
 */
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

    // 1. Kiểm tra môn học có tồn tại không
    if (!this.isValidSubject(subject)) {
      result.isValid = false;
      result.issues.push(`Môn học "${subject}" không được tìm thấy trong GDPT 2018`);
      return result;
    }

    // 2. Kiểm tra lớp có hợp lệ không
    if (!this.isValidGrade(gradeStr)) {
      result.isValid = false;
      result.issues.push(`Lớp ${gradeStr} không hợp lệ. Phải từ 6-12 (THCS/THPT) hoặc 1-5 (Tiểu học)`);
      return result;
    }

    // 3. Kiểm tra forbidden keywords
    const forbiddenKeywords = this.getForbiddenKeywords(subject, gradeStr);
    const foundForbidden = this.findForbiddenContent(outline, forbiddenKeywords);

    if (foundForbidden.length > 0) {
      result.isValid = false;
      result.issues.push(
        `Dàn ý chứa nội dung vượt cấp: ${foundForbidden.join(', ')}`
      );
      result.suggestions.push(
        `Nội dung này thuộc lớp cao hơn. Hãy chọn lớp phù hợp hoặc thay đổi đề tài.`
      );
    }

    // 4. Kiểm tra keywords bắt buộc có nằm trong phạm vi không
    const validTopics = this.getValidTopics(subject, gradeStr);
    const topicMatch = this.checkTopicRelevance(outline, validTopics);

    if (!topicMatch) {
      result.issues.push(
        `Đề tài có vẻ nằm ngoài phạm vi kiến thức chuẩn của ${subject} lớp ${gradeStr}`
      );
      result.suggestions.push(
        `Các chủ đề thích hợp: ${validTopics.slice(0, 5).join(', ')}`
      );
    }

    return result;
  }

  /**
   * Kiểm tra nội dung full SKKN (outline + content)
   */
  validateFullContent(
    subject: string,
    grade: string | number,
    content: string
  ): ValidationResult {
    return this.validateOutline(subject, grade, content);
  }

  /**
   * Lấy danh sách keywords cấm cho một lớp, môn
   */
  private getForbiddenKeywords(subject: string, grade: string): string[] {
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
  private getValidTopics(subject: string, grade: string): string[] {
    const subjectKey = this.mapSubjectName(subject);
    const subjectData = (this.db.subjects as any)[subjectKey];

    if (!subjectData || !subjectData.grades[grade]) {
      return [];
    }

    return subjectData.grades[grade].topics || [];
  }

  /**
   * Tìm forbidden keywords trong outline
   */
  private findForbiddenContent(
    outline: string,
    forbiddenKeywords: string[]
  ): string[] {
    const found: string[] = [];
    const lowerOutline = outline.toLowerCase();

    forbiddenKeywords.forEach((keyword) => {
      if (lowerOutline.includes(keyword.toLowerCase())) {
        found.push(keyword);
      }
    });

    return found;
  }

  /**
   * Kiểm tra đề tài có liên quan tới phạm vi không
   */
  private checkTopicRelevance(outline: string, validTopics: string[]): boolean {
    if (validTopics.length === 0) return true;

    const lowerOutline = outline.toLowerCase();
    const matches = validTopics.filter((topic) =>
      lowerOutline.includes(topic.toLowerCase())
    );

    return matches.length > 0 || validTopics.length === 0;
  }

  /**
   * Kiểm tra môn học có hợp lệ
   */
  private isValidSubject(subject: string): boolean {
    const subjects = Object.keys(this.db.subjects);
    return subjects.some(
      (s) =>
        this.mapSubjectName(subject).toLowerCase() ===
        s.toLowerCase()
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
      toán: 'toan',
      math: 'toan',
      'ngữ văn': 'nguVan',
      'tiếng việt': 'nguVan',
      vietnamese: 'nguVan',
      'tiếng anh': 'tiengAnh',
      english: 'tiengAnh',
      'địa lí': 'diaLi',
      geography: 'diaLi',
      'lịch sử': 'lichSu',
      history: 'lichSu',
      'khoa học tự nhiên': 'khoanHocTuNhien',
      'vật lí': 'khoanHocTuNhien',
      'hoá học': 'khoanHocTuNhien',
      'sinh học': 'khoanHocTuNhien',
      'giáo dục công dân': 'giaoDucCongDan',
      civics: 'giaoDucCongDan',
    };

    const key = subject.toLowerCase().trim();
    return mapping[key] || key;
  }

  /**
   * Lấy gợi ý đề tài phù hợp cho lớp, môn
   */
  getSuggestedTopics(subject: string, grade: string | number): string[] {
    const gradeStr = grade.toString();
    const topics = this.getValidTopics(subject, gradeStr);
    return topics.slice(0, 10);
  }

  /**
   * Lấy thông tin lớp (stage: THCS hay THPT)
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
   * Validate prompt cho Gemini API
   * Tạo system prompt phù hợp với lớp, môn
   */
  generateSystemPrompt(subject: string, grade: string | number): string {
    const gradeStr = grade.toString();
    const validTopics = this.getValidTopics(subject, gradeStr);
    const forbiddenKeywords = this.getForbiddenKeywords(subject, gradeStr);
    const gradeInfo = this.getGradeInfo(gradeStr);

    let prompt = `Bạn là một chuyên gia trong lĩnh vực SKKN (Sáng kiến kinh nghiệm) giáo dục Việt Nam.
Đang tạo nội dung SKKN cho môn ${subject}, lớp ${gradeStr} (${gradeInfo.stage}).

PHẠM VI KIẾN THỨC ĐƯỢC PHÉP:
${validTopics.slice(0, 8).map((t) => `- ${t}`).join('\n')}

TUYỆT ĐỐI CẤMER CHỨA:
${forbiddenKeywords.slice(0, 5).map((k) => `- ${k} (vượt cấp, thuộc lớp cao hơn)`).join('\n')}

HƯỚNG DẪN:
1. Nội dung SKKN PHẢI nằm trong phạm vi kiến thức GDPT 2018 cho lớp ${gradeStr}
2. KHÔNG được sử dụng kiến thức của lớp cao hơn
3. Dàn ý và nội dung phải phù hợp với trình độ học sinh lớp ${gradeStr}
4. Tập trung vào các chủ đề thích hợp theo chương trình chuẩn

Hãy tạo SKKN phù hợp với yêu cầu trên.`;

    return prompt;
  }
}

// Export singleton instance
export const curriculumValidator = new CurriculumValidator();

// Export class để có thể extend nếu cần
export default CurriculumValidator;
