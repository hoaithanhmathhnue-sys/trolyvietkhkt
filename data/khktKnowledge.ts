// ═══════════════════════════════════════════════════════════
// KHKT Writer Pro - Knowledge Base
// Tổng hợp kiến thức KHKT từ tài liệu tham khảo
// ═══════════════════════════════════════════════════════════

// 22 Lĩnh vực KHKT theo quy định cuộc thi ISEF
export const KHKT_FIELDS = [
  { id: 'ANIM', name: 'Khoa học Động vật', group: 'Sinh học - Y tế', keywords: ['động vật', 'sinh thái', 'hành vi', 'bảo tồn'] },
  { id: 'BEHA', name: 'Khoa học Xã hội và Hành vi', group: 'KHXH - Hành vi', keywords: ['tâm lý', 'xã hội', 'hành vi', 'giáo dục', 'nhân học'] },
  { id: 'BCHM', name: 'Hóa sinh', group: 'Hóa - Sinh - MT', keywords: ['enzyme', 'protein', 'phản ứng sinh hóa', 'chất hữu cơ'] },
  { id: 'BMED', name: 'Y sinh và Khoa học Sức khỏe', group: 'Sinh học - Y tế', keywords: ['y tế', 'sức khỏe', 'bệnh', 'dược', 'dinh dưỡng'] },
  { id: 'ENBM', name: 'Kỹ thuật Y Sinh', group: 'Kỹ thuật', keywords: ['thiết bị y tế', 'công nghệ y sinh', 'cảm biến sinh học'] },
  { id: 'CELL', name: 'Sinh học Tế bào và Phân tử', group: 'Sinh học - Y tế', keywords: ['tế bào', 'DNA', 'gen', 'di truyền', 'phân tử'] },
  { id: 'CHEM', name: 'Hóa học', group: 'Hóa - Sinh - MT', keywords: ['hóa chất', 'phản ứng', 'phân tích', 'tổng hợp', 'vật liệu'] },
  { id: 'CBIO', name: 'Sinh học Tính toán và Sinh tin học', group: 'Tin học - Toán', keywords: ['tin sinh học', 'mô phỏng', 'dữ liệu sinh học', 'thuật toán'] },
  { id: 'EAEV', name: 'Khoa học Trái đất và Môi trường', group: 'Hóa - Sinh - MT', keywords: ['môi trường', 'đất', 'nước', 'khí hậu', 'ô nhiễm', 'sinh thái'] },
  { id: 'ELMC', name: 'Kỹ thuật Điện và Cơ khí', group: 'Kỹ thuật', keywords: ['mạch điện', 'cơ khí', 'tự động hóa', 'robot', 'IoT'] },
  { id: 'ENGP', name: 'Năng lượng: Vật lý', group: 'Vật lý - Năng lượng', keywords: ['năng lượng mặt trời', 'điện', 'nhiệt', 'gió', 'tái tạo'] },
  { id: 'ENGC', name: 'Năng lượng: Hóa học', group: 'Vật lý - Năng lượng', keywords: ['pin', 'nhiên liệu', 'năng lượng hóa học', 'hydro'] },
  { id: 'ENEV', name: 'Kỹ thuật Môi trường', group: 'Hóa - Sinh - MT', keywords: ['xử lý nước', 'tái chế', 'bảo vệ môi trường', 'chất thải'] },
  { id: 'MATS', name: 'Khoa học Vật liệu', group: 'Kỹ thuật', keywords: ['vật liệu mới', 'nano', 'composite', 'polymer', 'gốm'] },
  { id: 'MATH', name: 'Toán học', group: 'Tin học - Toán', keywords: ['thuật toán', 'thống kê', 'mô hình', 'tối ưu', 'xác suất'] },
  { id: 'MCRO', name: 'Vi sinh vật học', group: 'Sinh học - Y tế', keywords: ['vi khuẩn', 'nấm', 'virus', 'vi sinh vật', 'lên men'] },
  { id: 'PHYS', name: 'Vật lý và Thiên văn học', group: 'Vật lý - Năng lượng', keywords: ['cơ học', 'quang học', 'điện từ', 'thiên văn', 'sóng'] },
  { id: 'PLNT', name: 'Khoa học Thực vật', group: 'Sinh học - Y tế', keywords: ['cây trồng', 'nông nghiệp', 'sinh trưởng', 'phân bón', 'thực vật'] },
  { id: 'ROBO', name: 'Rô-bốt và Máy thông minh', group: 'Kỹ thuật', keywords: ['robot', 'AI', 'tự động', 'điều khiển', 'cảm biến'] },
  { id: 'SOFT', name: 'Kỹ thuật Phần mềm', group: 'Tin học - Toán', keywords: ['lập trình', 'ứng dụng', 'website', 'AI', 'machine learning'] },
  { id: 'TMED', name: 'Y học Chuyển dịch', group: 'Sinh học - Y tế', keywords: ['y học', 'chẩn đoán', 'điều trị', 'lâm sàng'] },
  { id: 'EMBED', name: 'Hệ thống Nhúng', group: 'Kỹ thuật', keywords: ['vi điều khiển', 'Arduino', 'ESP32', 'cảm biến', 'IoT'] },
];

// Nhóm lĩnh vực chính
export const FIELD_GROUPS = [
  'Sinh học - Y tế',
  'Hóa - Sinh - MT',
  'Kỹ thuật',
  'Vật lý - Năng lượng',
  'Tin học - Toán',
  'KHXH - Hành vi',
];

// Cấp độ thi KHKT
export const KHKT_LEVELS = [
  'Cấp trường',
  'Cấp huyện/quận',
  'Cấp tỉnh/thành phố',
  'Cấp quốc gia',
  'Cấp quốc tế (ISEF)',
];

// Cấu trúc hồ sơ đề tài KHKT chuẩn
export const KHKT_STRUCTURE = {
  coverPage: {
    title: 'Trang bìa',
    items: ['Tên cuộc thi', 'Tên đề tài', 'Lĩnh vực', 'Tên học sinh', 'Lớp', 'Trường', 'Giáo viên hướng dẫn', 'Năm']
  },
  introduction: {
    title: 'PHẦN I. MỞ ĐẦU (TỔNG QUAN)',
    items: [
      '1. Lý do chọn đề tài',
      '2. Mục tiêu nghiên cứu',
      '3. Đối tượng nghiên cứu',
      '4. Phạm vi nghiên cứu (không gian, thời gian, đối tượng)',
      '5. Câu hỏi nghiên cứu',
      '6. Giả thuyết khoa học',
      '7. Ý nghĩa khoa học và thực tiễn',
      '8. Phương pháp nghiên cứu',
      '9. Tính mới (tính sáng tạo) của đề tài',
    ]
  },
  chapter1: {
    title: 'PHẦN II. NỘI DUNG NGHIÊN CỨU — CHƯƠNG 1: CƠ SỞ LÝ LUẬN',
    items: [
      '1.1. Khái niệm',
      '1.2. Kiến thức nền',
      '1.3. Các nghiên cứu liên quan',
      '1.4. Cơ sở khoa học',
    ]
  },
  chapter2: {
    title: 'CHƯƠNG 2: THỰC TRẠNG',
    items: [
      '2.1. Khảo sát',
      '2.2. Thu thập dữ liệu',
      '2.3. Phân tích số liệu',
      '2.4. Đánh giá hiện trạng',
    ]
  },
  chapter3: {
    title: 'CHƯƠNG 3: THIẾT KẾ GIẢI PHÁP / SẢN PHẨM',
    items: [
      '3.1. Ý tưởng',
      '3.2. Thiết kế',
      '3.3. Quy trình',
      '3.4. Nguyên lý hoạt động',
      '3.5. Công nghệ sử dụng',
      '3.6. Hình ảnh mô hình',
    ]
  },
  chapter4: {
    title: 'CHƯƠNG 4: THỰC NGHIỆM VÀ ĐÁNH GIÁ',
    items: [
      '4.1. Cách triển khai',
      '4.2. Đối tượng thử nghiệm',
      '4.3. Kết quả trước - sau',
      '4.4. Biểu đồ và phân tích',
      '4.5. Đánh giá hiệu quả',
    ]
  },
  conclusion: {
    title: 'PHẦN III. KẾT LUẬN',
    items: [
      '1. Kết luận',
      '2. Đóng góp của đề tài',
      '3. Hạn chế',
      '4. Hướng phát triển',
      '5. Kiến nghị',
    ]
  },
  appendix: {
    title: 'PHỤ LỤC',
    items: [
      'Phiếu khảo sát',
      'Bảng số liệu',
      'Hình ảnh',
      'Nhật ký nghiên cứu',
      'Mã nguồn (nếu có)',
      'Link website và QR code',
      'Tài liệu minh chứng',
    ]
  },
  references: {
    title: 'TÀI LIỆU THAM KHẢO',
    items: [
      'Trình bày thống nhất theo chuẩn APA hoặc IEEE',
    ]
  }
};

// Phương pháp nghiên cứu phổ biến trong KHKT
export const RESEARCH_METHODS = [
  {
    name: 'Phương pháp thực nghiệm',
    description: 'Tiến hành thí nghiệm có kiểm soát để kiểm chứng giả thuyết',
    suitable: ['Hóa học', 'Vật lý', 'Sinh học', 'Kỹ thuật'],
  },
  {
    name: 'Phương pháp điều tra, khảo sát',
    description: 'Thu thập dữ liệu qua bảng hỏi, phỏng vấn',
    suitable: ['KHXH', 'Y sinh', 'Môi trường'],
  },
  {
    name: 'Phương pháp quan sát',
    description: 'Quan sát có hệ thống để ghi nhận hiện tượng',
    suitable: ['Động vật', 'Thực vật', 'Thiên văn', 'Sinh thái'],
  },
  {
    name: 'Phương pháp phân tích số liệu',
    description: 'Xử lý dữ liệu thống kê, phân tích định lượng',
    suitable: ['Toán học', 'Tin học', 'Tất cả lĩnh vực'],
  },
  {
    name: 'Phương pháp mô hình hóa',
    description: 'Xây dựng mô hình mô phỏng/toán học để nghiên cứu',
    suitable: ['Toán', 'Vật lý', 'Tin học', 'Kỹ thuật'],
  },
  {
    name: 'Phương pháp thiết kế chế tạo',
    description: 'Thiết kế, chế tạo và thử nghiệm sản phẩm',
    suitable: ['Kỹ thuật', 'Robot', 'Phần mềm', 'Điện tử'],
  },
  {
    name: 'Phương pháp nghiên cứu tài liệu',
    description: 'Tổng hợp, phân tích tài liệu khoa học liên quan',
    suitable: ['Tất cả lĩnh vực'],
  },
];

// Mẫu câu khoa học cho từng phần
export const SCIENTIFIC_PHRASES = {
  introduction: [
    'Nghiên cứu này được thực hiện nhằm...',
    'Xuất phát từ thực tiễn... chúng tôi nhận thấy...',
    'Vấn đề... đang là mối quan tâm lớn trong...',
    'Trên cơ sở phân tích... nhóm nghiên cứu đề xuất...',
  ],
  hypothesis: [
    'Giả thuyết đặt ra: Nếu... thì...',
    'Chúng tôi giả định rằng... sẽ có tác động... đến...',
    'Dựa trên cơ sở lý thuyết, giả thuyết nghiên cứu là...',
  ],
  methodology: [
    'Nghiên cứu sử dụng phương pháp... kết hợp...',
    'Thí nghiệm được thiết kế theo mô hình...',
    'Dữ liệu được thu thập thông qua...',
    'Các biến số được kiểm soát bao gồm...',
  ],
  results: [
    'Kết quả cho thấy... với p < 0.05 (có ý nghĩa thống kê)',
    'Quan sát ghi nhận... tăng/giảm X% so với nhóm đối chứng',
    'Phân tích số liệu cho thấy mối tương quan... giữa...',
    'Sản phẩm đạt được các thông số kỹ thuật sau...',
  ],
  conclusion: [
    'Nghiên cứu đã chứng minh được giả thuyết rằng...',
    'Kết quả nghiên cứu có thể ứng dụng trong...',
    'Hạn chế của nghiên cứu bao gồm...',
    'Hướng phát triển tiếp theo là...',
  ],
};

// Checklist hoàn thiện đề tài KHKT
export const COMPLETION_CHECKLIST = {
  content: [
    'Tên đề tài rõ ràng, phản ánh đúng nội dung nghiên cứu',
    'Giả thuyết khoa học được phát biểu rõ ràng, có thể kiểm chứng',
    'Phương pháp nghiên cứu phù hợp với mục tiêu',
    'Có nhóm đối chứng (nếu thực nghiệm)',
    'Số liệu được xử lý thống kê đúng cách',
    'Kết luận dựa trên dữ liệu, không suy diễn chủ quan',
    'Trích dẫn tài liệu theo chuẩn APA',
  ],
  format: [
    'Bố cục đúng quy định cuộc thi',
    'Bảng biểu, biểu đồ rõ ràng, có chú thích',
    'Hình ảnh minh họa chất lượng tốt',
    'Danh mục tài liệu tham khảo đầy đủ',
    'Không vượt quá số trang quy định',
  ],
  presentation: [
    'Poster/slide trình bày hấp dẫn',
    'Chuẩn bị câu hỏi phản biện từ ban giám khảo',
    'Nắm vững nội dung nghiên cứu',
    'Có thể giải thích phương pháp và kết quả một cách rõ ràng',
  ],
};

// Câu hỏi thường gặp từ Ban Giám Khảo
export const JURY_FAQ = [
  {
    category: 'Ý tưởng & Mục tiêu',
    questions: [
      'Tại sao em chọn đề tài này? Điều gì khiến em quan tâm?',
      'Mục tiêu nghiên cứu của em là gì? Em muốn giải quyết vấn đề gì?',
      'Đề tài này có ý nghĩa thực tiễn như thế nào?',
    ]
  },
  {
    category: 'Phương pháp',
    questions: [
      'Em đã sử dụng phương pháp nghiên cứu nào? Tại sao chọn phương pháp đó?',
      'Thí nghiệm được thiết kế như thế nào? Có nhóm đối chứng không?',
      'Em xử lý số liệu bằng phương pháp thống kê nào?',
      'Các biến số trong thí nghiệm là gì?',
    ]
  },
  {
    category: 'Kết quả & Kết luận',
    questions: [
      'Kết quả chính của nghiên cứu là gì?',
      'Kết quả có đúng như giả thuyết ban đầu không? Tại sao?',
      'Hạn chế của nghiên cứu là gì? Nếu làm lại, em sẽ thay đổi gì?',
      'Nghiên cứu có thể ứng dụng/phát triển thêm như thế nào?',
    ]
  },
  {
    category: 'Đạo đức & An toàn',
    questions: [
      'Nghiên cứu có liên quan đến con người/động vật không? Đã xin phép chưa?',
      'Em đã tuân thủ các quy tắc an toàn nào trong quá trình nghiên cứu?',
      'Nghiên cứu có ảnh hưởng đến môi trường không?',
    ]
  },
];

// Tips thành công cho đề tài KHKT
export const SUCCESS_TIPS = [
  'Chọn đề tài xuất phát từ vấn đề thực tế trong cuộc sống',
  'Giả thuyết phải rõ ràng, cụ thể và có thể kiểm chứng được',
  'Thiết kế thí nghiệm đơn giản nhưng khoa học, có nhóm đối chứng',
  'Ghi chép nhật ký nghiên cứu đầy đủ từ ngày đầu tiên',
  'Lặp lại thí nghiệm ít nhất 3 lần để đảm bảo độ tin cậy',
  'Sử dụng phần mềm thống kê để xử lý số liệu (Excel, SPSS)',
  'Viết bài theo cấu trúc IMRAD: Introduction, Methods, Results, And Discussion',
  'Trích dẫn tài liệu tham khảo theo chuẩn APA',
  'Chuẩn bị phần thuyết trình và trả lời câu hỏi BGK kỹ lưỡng',
  'Tập trung vào tính mới, tính sáng tạo và khả năng ứng dụng',
];

// Export tổng hợp cho dễ import
export const KHKT_KNOWLEDGE = {
  fields: KHKT_FIELDS,
  fieldGroups: FIELD_GROUPS,
  levels: KHKT_LEVELS,
  structure: KHKT_STRUCTURE,
  methods: RESEARCH_METHODS,
  phrases: SCIENTIFIC_PHRASES,
  checklist: COMPLETION_CHECKLIST,
  juryFAQ: JURY_FAQ,
  tips: SUCCESS_TIPS,
};
