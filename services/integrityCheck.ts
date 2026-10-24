import { DATA_PLACEHOLDER_TAG } from '../constants';

export interface IntegrityReport {
  unfilledPlaceholders: number;
  numericClaims: string[];
}

// Các mẫu câu chứa số liệu cần có nguồn: tỉ lệ %, p-value, "khảo sát N học sinh", trung bình/độ lệch chuẩn
const NUMERIC_CLAIM_PATTERNS = [
  /[^\n.]{0,60}\d+(?:[.,]\d+)?\s*%[^\n.]{0,40}/g,
  /[^\n.]{0,60}\bp\s*[<>=≤≥]\s*0?[.,]\d+[^\n.]{0,40}/gi,
  /[^\n.]{0,40}(?:khảo sát|điều tra|phỏng vấn)\s+\d+\s+(?:học sinh|người|mẫu|hộ|phiếu)[^\n.]{0,40}/gi,
  /[^\n.]{0,60}(?:trung bình|độ lệch chuẩn)\s*(?:là|=|:)\s*\d+(?:[.,]\d+)?[^\n.]{0,40}/gi,
];

export const scanDataIntegrity = (markdown: string): IntegrityReport => {
  const text = markdown || '';
  const unfilledPlaceholders = text.split(DATA_PLACEHOLDER_TAG).length - 1;
  const claims = new Set<string>();
  for (const pattern of NUMERIC_CLAIM_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      // Bỏ qua dòng bảng chỉ chứa ô trống "…"
      const snippet = match[0].replace(/\s+/g, ' ').trim();
      if (snippet) claims.add(snippet);
    }
  }
  return { unfilledPlaceholders, numericClaims: [...claims] };
};

/**
 * Hỏi người dùng xác nhận trước khi xuất Word nếu tài liệu còn khung số liệu chưa điền
 * hoặc có các câu chứa số liệu (để họ tự kiểm tra nguồn). Trả về true nếu được phép xuất.
 */
export const confirmDataIntegrity = (markdown: string): boolean => {
  const report = scanDataIntegrity(markdown);
  if (report.unfilledPlaceholders === 0 && report.numericClaims.length === 0) return true;

  const lines: string[] = ['🛡️ KIỂM TRA LIÊM CHÍNH SỐ LIỆU TRƯỚC KHI XUẤT', ''];
  if (report.unfilledPlaceholders > 0) {
    lines.push(`• Còn ${report.unfilledPlaceholders} khung "[${DATA_PLACEHOLDER_TAG}: ...]" chưa điền số liệu thật.`);
  }
  if (report.numericClaims.length > 0) {
    lines.push(`• Có ${report.numericClaims.length} chỗ chứa số liệu (%, p-value, cỡ mẫu...). Ví dụ:`);
    report.numericClaims.slice(0, 5).forEach(c => lines.push(`   – "${c.length > 90 ? c.slice(0, 90) + '…' : c}"`));
  }
  lines.push('', 'Mọi số liệu trong đề tài dự thi phải đến từ thực nghiệm/khảo sát thật của nhóm hoặc có trích dẫn nguồn.',
    'Số liệu do AI tự tạo bị coi là gian lận số liệu (fabrication).', '', 'Bạn xác nhận đã kiểm tra và vẫn muốn xuất file?');
  return window.confirm(lines.join('\n'));
};
