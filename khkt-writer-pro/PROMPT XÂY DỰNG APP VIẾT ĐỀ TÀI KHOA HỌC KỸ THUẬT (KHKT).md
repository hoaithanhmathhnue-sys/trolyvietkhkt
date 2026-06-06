# PROMPT XÂY DỰNG APP VIẾT ĐỀ TÀI KHOA HỌC KỸ THUẬT (KHKT)

## 1. TỔNG QUAN ỨNG DỤNG

### Tên ứng dụng

**KHKT Writer Pro** - Trợ lý viết đề tài Khoa học Kỹ thuật thông minh

### Mục tiêu

Xây dựng ứng dụng web hỗ trợ học sinh THPT viết đề tài KHKT hoàn chỉnh, chuyên nghiệp thông qua hướng dẫn từng bước, gợi ý nội dung thông minh và kiểm tra chất lượng tự động.

### Đối tượng sử dụng

- Học sinh THPT (lớp 10, 11, 12)

- Giáo viên hướng dẫn

- Nhóm nghiên cứu khoa học học sinh

---

## 2. KIẾN TRÚC ỨNG DỤNG

### 2.1. Công nghệ yêu cầu

- **Frontend:** React.js hoặc Next.js

- **UI Framework:** Tailwind CSS + Shadcn/ui

- **State Management:** Zustand hoặc Redux

- **Rich Text Editor:** TipTap hoặc Quill

- **AI Integration:** OpenAI API hoặc Gemini API

- **Export:** jsPDF, docx.js

- **Storage:** LocalStorage + Cloud (optional)

### 2.2. Cấu trúc thư mục

```plaintext
src/
├── components/
│   ├── layout/
│   ├── editor/
│   ├── wizard/
│   ├── templates/
│   └── ui/
├── pages/
│   ├── dashboard/
│   ├── project/
│   ├── editor/
│   └── export/
├── hooks/
├── utils/
├── data/
│   ├── knowledge-base.json
│   ├── templates.json
│   └── examples.json
└── services/
    ├── ai-service.js
    ├── export-service.js
    └── validation-service.js
```

---

## 3. TÍNH NĂNG CHI TIẾT

### 3.1. Module 1: Trang chủ & Dashboard

#### Giao diện Dashboard

**Layout:**

- Header : Logo, Menu, Tài khoản

- Sidebar: Danh sách dự án, Tạo mới, Thư viện mẫu

- Main Content : Cards hiển thị các dự án đang làm

- Footer : Hướng dẫn nhanh, Liên hệ

**Thành phần Card Dự án :**

```plaintext
┌─────────────────────────────────┐
│ 📊 [Tên đề tài]                 │
│ Lĩnh vực: [...]                 │
│ Tiến độ: ████░░░░ 60%          │
│ Cập nhật: [Ngày/giờ]           │
│ [Tiếp tục] [Xuất file] [Xóa]  │
└─────────────────────────────────┘
```

**Chức năng:**

- Tạo dự án mới (button nổi bật)

- Xem danh sách dự án (grid/list view)

- Tìm kiếm, lọc theo lĩnh vực

- Sao chép dự án mẫu

- Xóa/Lưu trữ dự án

---

### 3.2. Module 2: Wizard Tạo Dự Án Mới

#### Quy trình 5 bước (Step-by-step)

**BƯỚC 1 : Thông tin cơ bản**

*Giao diện:*

```plaintext
┌─────────────────────────────────────────┐
│  Bước 1/5: Thông tin cơ bản            │
│  ○─●─○─○─○                             │
│                                         │
│  Tên đề tài: [________________]        │
│  Lĩnh vực:   [Dropdown ▼]              │
│    □ Vật lý - Kỹ thuật                 │
│    □ Tin học - Phần mềm                │
│    □ Hóa - Sinh                        │
│    □ Vật liệu - Môi trường             │
│    □ Khoa học xã hội và hành vi        │
│                                         │
│  Cấp độ:     [Dropdown ▼]              │
│    □ Cấp trường                        │
│    □ Cấp tỉnh/thành phố                │
│    □ Cấp quốc gia                      │
│                                         │
│  Thành viên:                           │
│  1. [Tên] - [Lớp]                      │
│  2. [Tên] - [Lớp]                      │
│  [+ Thêm thành viên]                   │
│                                         │
│  Giáo viên HD: [________________]      │
│                                         │
│         [Quay lại]  [Tiếp tục →]       │
└─────────────────────────────────────────┘
```

**BƯỚC 2: Xác định vấn đề**

*Giao diện:*

```plaintext
┌─────────────────────────────────────────┐
│  Bước 2/5: Xác định vấn đề nghiên cứu  │
│  ○─○─●─○─○                             │
│                                         │
│  💡 Gợi ý AI: [Bật/Tắt toggle]         │
│                                         │
│  Vấn đề bạn muốn giải quyết là gì?     │
│  ┌─────────────────────────────────┐   │
│  │ [Textarea - 200 ký tự]          │   │
│  │                                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Tại sao vấn đề này quan trọng?        │
│  ┌─────────────────────────────────┐   │
│  │ [Textarea - 200 ký tự]          │   │
│  │                                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│  📚 Gợi ý từ AI:                       │
│  ┌─────────────────────────────────┐   │
│  │ • Đề tài tương tự: [...]        │   │
│  │ • Xu hướng nghiên cứu: [...]    │   │
│  │ • Từ khóa liên quan: [...]      │   │
│  └─────────────────────────────────┘   │
│                                         │
│      [← Quay lại]  [Tiếp tục →]        │
└─────────────────────────────────────────┘
```

**BƯỚC 3 : Mục tiêu & Phương pháp**

*Giao diện:*

```plaintext
┌─────────────────────────────────────────┐
│  Bước 3/5: Mục tiêu & Phương pháp      │
│  ○─○─○─●─○                             │
│                                         │
│  Mục tiêu nghiên cứu:                  │
│  1. [________________] [+ Thêm]        │
│  2. [________________] [x]             │
│  3. [________________] [x]             │
│                                         │
│  💡 AI gợi ý: "Đề xuất thêm 2 mục tiêu"│
│                                         │
│  Phương pháp sử dụng:                  │
│  ☑ Khảo sát bảng hỏi                   │
│  ☑ Phỏng vấn sâu                       │
│  ☐ Thực nghiệm                         │
│  ☐ Quan sát                            │
│  ☐ Phân tích tài liệu                  │
│                                         │
│  Đối tượng khảo sát:                   │
│  [________________] (VD: 100 HS lớp 10)│
│                                         │
│  Thời gian thực hiện:                  │
│  Từ: [📅 Chọn ngày] Đến: [📅 Chọn ngày]│
│                                         │
│      [← Quay lại]  [Tiếp tục →]        │
└─────────────────────────────────────────┘
```

**BƯỚC 4: Giả thuyết & Kết quả dự kiến**

*Giao diện:*

```plaintext
┌─────────────────────────────────────────┐
│  Bước 4/5: Giả thuyết & Kết quả        │
│  ○─○─○─○─●                             │
│                                         │
│  Giả thuyết khoa học:                  │
│  ┌─────────────────────────────────┐   │
│  │ Giả thuyết 1:                   │   │
│  │ [Textarea]                      │   │
│  │                                 │   │
│  │ [+ Thêm giả thuyết]             │   │
│  └─────────────────────────────────┘   │
│                                         │
│  🤖 AI kiểm tra:                       │
│  ✓ Giả thuyết có thể kiểm chứng        │
│  ⚠ Nên cụ thể hóa thêm về số liệu      │
│                                         │
│  Kết quả dự kiến:                      │
│  ┌─────────────────────────────────┐   │
│  │ [Textarea - Mô tả sản phẩm/     │   │
│  │  giải pháp dự kiến đạt được]    │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Ý nghĩa thực tiễn:                    │
│  ┌─────────────────────────────────┐   │
│  │ [Textarea]                      │   │
│  └─────────────────────────────────┘   │
│                                         │
│      [← Quay lại]  [Tiếp tục →]        │
└─────────────────────────────────────────┘
```

**BƯỚC 5: Xác nhận & Tạo dự án**

*Giao diện:*

```plaintext
┌─────────────────────────────────────────┐
│  Bước 5/5: Xác nhận thông tin          │
│  ○─○─○─○─●                             │
│                                         │
│  📋 Tóm tắt dự án:                     │
│  ┌─────────────────────────────────┐   │
│  │ Tên: [...]                      │   │
│  │ Lĩnh vực: [...]                 │   │
│  │ Thành viên: [...]               │   │
│  │ Mục tiêu: [...]                 │   │
│  │ Phương pháp: [...]              │   │
│  └─────────────────────────────────┘   │
│                                         │
│  🎯 Chọn template khởi đầu:            │
│  ○ Template trống (tự viết từ đầu)     │
│  ● Template chuẩn (có gợi ý nội dung)  │
│  ○ Template mẫu (dựa trên đề tài mẫu)  │
│                                         │
│  ✨ AI sẽ tạo:                         │
│  ✓ Cấu trúc đề tài hoàn chỉnh          │
│  ✓ Gợi ý nội dung cho từng phần        │
│  ✓ Mẫu câu và cụm từ phù hợp           │
│  ✓ Checklist theo dõi tiến độ          │
│                                         │
│      [← Quay lại]  [🚀 Tạo dự án]      │
└─────────────────────────────────────────┘
```

---

### 3.3. Module 3: Trình soạn thảo (Editor)

#### Layout Editor

```plaintext
┌───────────────────────────────────────────────────────────┐
│ [Logo] KHKT Writer Pro    [Lưu] [Xuất] [Trợ giúp] [👤]  │
├───────────┬───────────────────────────────┬───────────────┤
│           │                               │               │
│ 📂 CẤU    │   EDITOR CHÍNH               │  🤖 TRỢ LÝ AI │
│   TRÚC    │                               │               │
│           │   # Tên đề tài               │  💡 Gợi ý     │
│ ▼ MỞ ĐẦU  │                               │  [________]   │
│   • Lý do │   ## A. MỞ ĐẦU               │  [Tạo nội dung│
│   • Mục   │                               │               │
│   • Câu   │   ### 1. Lý do chọn đề tài   │  📝 Mẫu câu   │
│   • Giả   │   [Nội dung...]              │  • Trong bối  │
│   ...     │                               │    cảnh...    │
│           │   [Cursor đang nhập]         │  • Xuất phát  │
│ ▶ NỘI     │                               │    từ...      │
│   DUNG    │                               │               │
│           │   🔍 Kiểm tra:               │  ✏️ Chỉnh sửa │
│ ▶ KẾT     │   ✓ Không lỗi chính tả       │  [Văn phong]  │
│   LUẬN    │   ⚠ Nên thêm số liệu         │  [Rút gọn]    │
│           │   ⚠ Câu hơi dài (45 từ)     │  [Mở rộng]    │
│ ▶ PHỤ     │                               │               │
│   LỤC     │                               │  📊 Thống kê  │
│           │                               │  Từ: 1,234    │
│ 📊 Tiến   │                               │  Trang: 15    │
│    độ     │                               │  Tiến độ: 60% │
│   ████░   │                               │               │
│   60%     │                               │               │
│           │                               │               │
└───────────┴───────────────────────────────┴───────────────┘
```

#### Thanh công cụ Editor

```plaintext
┌─────────────────────────────────────────────────────────┐
│ [B] [I] [U] │ H1 H2 H3 │ • ≡ │ 🔗 📷 📊 │ ↶ ↷ │ 💾 │
└─────────────────────────────────────────────────────────┘
```

**Chức năng:**

- **Bold, Italic, Underline:** Định dạng văn bản

- **Heading 1-3:** Tiêu đề các cấp

- **Bullet/Numbered list:** Danh sách

- **Link, Image, Table:** Chèn đa phương tiện

- **Undo/Redo:** Hoàn tác

- **Save:** Lưu tự động + thủ công

---

### 3.4. Module 4 : Trợ lý AI thông minh

#### Panel AI (Sidebar phải)

**4.1. Tạo nội dung**

*Giao diện:*

```plaintext
┌─────────────────────────────┐
│ 🤖 TRỢ LÝ AI               │
├─────────────────────────────┤
│                             │
│ 💡 Tạo nội dung             │
│                             │
│ Bạn đang viết: [Lý do chọn │
│ đề tài]                     │
│                             │
│ Nhập gợi ý (tùy chọn):     │
│ ┌─────────────────────┐    │
│ │ VD: Đề tài về AI    │    │
│ │ trong giáo dục      │    │
│ └─────────────────────┘    │
│                             │
│ Độ dài: ○ Ngắn ● Vừa ○ Dài│
│                             │
│ Văn phong: ○ Học thuật     │
│            ● Dễ hiểu       │
│                             │
│ [✨ Tạo nội dung]           │
│                             │
├─────────────────────────────┤
│ 📝 Kết quả:                │
│ ┌─────────────────────┐    │
│ │ [Nội dung AI tạo]   │    │
│ │                     │    │
│ │                     │    │
│ └─────────────────────┘    │
│                             │
│ [📋 Sao chép] [➕ Chèn]    │
│ [🔄 Tạo lại]               │
└─────────────────────────────┘
```

**4.2. Chỉnh sửa văn bản**

*Giao diện:*

```plaintext
┌─────────────────────────────┐
│ ✏️ Chỉnh sửa văn bản        │
│                             │
│ Chọn đoạn văn cần sửa, sau │
│ đó chọn hành động:          │
│                             │
│ [📏 Rút gọn]               │
│ [📖 Mở rộng]               │
│ [🎯 Làm rõ ý]              │
│ [🔄 Diễn đạt khác]         │
│ [📚 Học thuật hóa]         │
│ [💬 Dễ hiểu hóa]           │
│ [✅ Sửa lỗi chính tả]      │
│ [🔍 Kiểm tra ngữ pháp]     │
│                             │
└─────────────────────────────┘
```

**4.3. Gợi ý mẫu câu**

*Giao diện:*

```plaintext
┌─────────────────────────────┐
│ 📝 Mẫu câu theo ngữ cảnh   │
│                             │
│ Phần đang viết: Lý do chọn │
│ đề tài                      │
│                             │
│ Mẫu câu phù hợp:           │
│                             │
│ 1. "Trong bối cảnh..."     │
│    [Chèn]                   │
│                             │
│ 2. "Xuất phát từ thực      │
│    tiễn..."                 │
│    [Chèn]                   │
│                             │
│ 3. "Thực tế cho thấy..."   │
│    [Chèn]                   │
│                             │
│ [Xem thêm mẫu câu]         │
└─────────────────────────────┘
```

**4.4. Kiểm tra chất lượng**

*Giao diện:*

```plaintext
┌─────────────────────────────┐
│ 🔍 Kiểm tra chất lượng     │
│                             │
│ Phần: Lý do chọn đề tài    │
│                             │
│ ✅ Đạt (3):                │
│ • Có trích dẫn nguồn       │
│ • Ngôn ngữ khoa học        │
│ • Cấu trúc logic           │
│                             │
│ ⚠️ Cần cải thiện (2):      │
│ • Thiếu số liệu cụ thể     │
│   → Gợi ý: Thêm thống kê   │
│ • Câu dài (45 từ, dòng 3) │
│   → [Tự động rút gọn]      │
│                             │
│ ❌ Lỗi (1):                │
│ • Lỗi chính tả: "nghên cứu"│
│   → [Sửa thành "nghiên cứu"]│
│                             │
│ Điểm tổng: 7.5/10          │
│ [Xem chi tiết]             │
└─────────────────────────────┘
```

---

### 3.5. Module 5 : Quản lý tài liệu tham khảo

#### Giao diện Thư viện tài liệu

```plaintext
┌─────────────────────────────────────────┐
│ 📚 Tài liệu tham khảo                  │
├─────────────────────────────────────────┤
│ [+ Thêm tài liệu]  [📥 Import]         │
│                                         │
│ 🔍 [Tìm kiếm...]          [Lọc ▼]     │
│                                         │
│ ┌─────────────────────────────────┐   │
│ │ [1] Nguyễn Văn A (2024)         │   │
│ │     Phương pháp nghiên cứu...   │   │
│ │     📖 Sách | 🏷️ Giáo dục       │   │
│ │     [✏️ Sửa] [🗑️ Xóa] [📋 Trích dẫn]│
│ └─────────────────────────────────┘   │
│                                         │
│ ┌─────────────────────────────────┐   │
│ │ [2] UNESCO (2023)               │   │
│ │     Education for Sustainable...│   │
│ │     🌐 Website | 🏷️ Quốc tế     │   │
│ │     [✏️ Sửa] [🗑️ Xóa] [📋 Trích dẫn]│
│ └─────────────────────────────────┘   │
│                                         │
│ [Xem tất cả (15)]                      │
└─────────────────────────────────────────┘
```

#### Form thêm tài liệu

```plaintext
┌─────────────────────────────────────────┐
│ ➕ Thêm tài liệu tham khảo             │
├─────────────────────────────────────────┤
│                                         │
│ Loại tài liệu:                         │
│ ○ Sách  ● Bài báo  ○ Website  ○ Luận văn│
│                                         │
│ Tác giả: [________________]            │
│ Năm:     [____]                        │
│ Tiêu đề: [________________]            │
│ Tạp chí: [________________]            │
│ Số/Tập:  [____]                        │
│ Trang:   [____]                        │
│                                         │
│ 🤖 AI tự động điền từ DOI/URL:        │
│ [________________] [Tìm kiếm]          │
│                                         │
│ [Hủy]  [Lưu]                           │
└─────────────────────────────────────────┘
```

#### Chèn trích dẫn vào văn bản

```plaintext
Khi viết: "Theo nghiên cứu..."
→ Click [📚 Trích dẫn]
→ Chọn tài liệu từ danh sách
→ Tự động chèn: "Theo nghiên cứu của Nguyễn Văn A (2024)..."
→ Tự động thêm vào danh mục tài liệu tham khảo
```

---

### 3.6. Module 6: Biểu đồ & Hình ảnh

#### Công cụ tạo biểu đồ

```plaintext
┌─────────────────────────────────────────┐
│ 📊 Tạo biểu đồ                         │
├─────────────────────────────────────────┤
│                                         │
│ Loại biểu đồ:                          │
│ [Cột] [Tròn] [Đường] [Thanh] [Phân tán]│
│                                         │
│ Nhập dữ liệu:                          │
│ ┌─────────────────────────────────┐   │
│ │ Nhãn        | Giá trị           │   │
│ │ ─────────────┼──────────────     │   │
│ │ Nhóm A      | 45                │   │
│ │ Nhóm B      | 32                │   │
│ │ Nhóm C      | 23                │   │
│ │ [+ Thêm hàng]                   │   │
│ └─────────────────────────────────┘   │
│                                         │
│ Tiêu đề: [________________]            │
│ Màu sắc: [🎨 Chọn bảng màu]           │
│                                         │
│ Xem trước:                             │
│ ┌─────────────────────────────────┐   │
│ │     [Biểu đồ preview]           │   │
│ │                                 │   │
│ └─────────────────────────────────┘   │
│                                         │
│ [Hủy]  [Chèn vào văn bản]             │
└─────────────────────────────────────────┘
```

#### Quản lý hình ảnh

```plaintext
┌─────────────────────────────────────────┐
│ 🖼️ Thư viện hình ảnh                   │
├─────────────────────────────────────────┤
│ [📤 Tải lên]  [🔗 Từ URL]              │
│                                         │
│ ┌───────┐ ┌───────┐ ┌───────┐         │
│ │ [IMG] │ │ [IMG] │ │ [IMG] │         │
│ │ Ảnh 1 │ │ Ảnh 2 │ │ Ảnh 3 │         │
│ │[Chèn] │ │[Chèn] │ │[Chèn] │         │
│ └───────┘ └───────┘ └───────┘         │
│                                         │
│ Khi chèn:                              │
│ • Tự động đánh số (Hình 1, Hình 2...)  │
│ • Thêm caption                         │
│ • Tối ưu kích thước                    │
└─────────────────────────────────────────┘
```

---

### 3.7. Module 7: Xuất file

#### Giao diện Xuất file

```plaintext
┌─────────────────────────────────────────┐
│ 📥 Xuất đề tài                         │
├─────────────────────────────────────────┤
│                                         │
│ Chọn định dạng:                        │
│ ☑ Word (.docx)                         │
│ ☑ PDF (.pdf)                           │
│ ☐ HTML (.html)                         │
│                                         │
│ Tùy chọn:                              │
│ ☑ Bao gồm mục lục tự động             │
│ ☑ Đánh số trang                        │
│ ☑ Đánh số hình/bảng/biểu đồ           │
│ ☑ Danh mục tài liệu tham khảo          │
│ ☐ Watermark (dự thảo)                  │
│                                         │
│ Định dạng trang:                       │
│ Khổ giấy: [A4 ▼]                      │
│ Lề:       [Chuẩn ▼]                   │
│ Font:     [Times New Roman ▼]         │
│ Cỡ chữ:   [13 ▼]                      │
│                                         │
│ 🔍 Kiểm tra trước khi xuất:            │
│ ✓ Không lỗi chính tả                   │
│ ✓ Tất cả hình ảnh có caption           │
│ ⚠ Thiếu 2 tài liệu tham khảo           │
│                                         │
│ [Hủy]  [📥 Xuất file]                  │
└─────────────────────────────────────────┘
```

#### Xem trước trước khi xuất

```plaintext
┌─────────────────────────────────────────┐
│ 👁️ Xem trước                           │
├─────────────────────────────────────────┤
│                                         │
│ [Trang trước] Trang 1/25 [Trang sau]   │
│                                         │
│ ┌─────────────────────────────────┐   │
│ │                                 │   │
│ │   [Nội dung trang 1]            │   │
│ │                                 │   │
│ │                                 │   │
│ │                                 │   │
│ │                                 │   │
│ └─────────────────────────────────┘   │
│                                         │
│ Zoom: [-] 100% [+]                     │
│                                         │
│ [Đóng]  [Xuất]                         │
└─────────────────────────────────────────┘
```

---

### 3.8. Module 8: Checklist & Theo dõi tiến độ

#### Panel Checklist

```plaintext
┌─────────────────────────────────────────┐
│ ✅ Checklist hoàn thành                │
├─────────────────────────────────────────┤
│                                         │
│ 📋 Phần Mở đầu (60%)                   │
│ ☑ Lý do chọn đề tài                    │
│ ☑ Mục đích nghiên cứu                  │
│ ☑ Câu hỏi nghiên cứu                   │
│ ☐ Giả thuyết khoa học                  │
│ ☐ Phương pháp nghiên cứu               │
│                                         │
│ 📋 Nội dung nghiên cứu (30%)           │
│ ☑ Chương 1: Cơ sở lý luận              │
│ ☐ Chương 2: Thực trạng                 │
│ ☐ Chương 3: Giải pháp                  │
│ ☐ Chương 4: Kết luận                   │
│                                         │
│ 📋 Phụ lục (0%)                        │
│ ☐ Danh mục tài liệu tham khảo          │
│ ☐ Phiếu khảo sát                       │
│ ☐ Bảng số liệu                         │
│                                         │
│ Tổng tiến độ: ████████░░ 45%          │
│                                         │
│ [Xem chi tiết]                         │
└─────────────────────────────────────────┘
```

#### Lịch sử chỉnh sửa

```plaintext
┌─────────────────────────────────────────┐
│ 📜 Lịch sử chỉnh sửa                   │
├─────────────────────────────────────────┤
│                                         │
│ 🕐 Hôm nay, 14:30                      │
│ Thanh Trần đã chỉnh sửa "Lý do chọn   │
│ đề tài" (+120 từ)                      │
│ [Xem] [Khôi phục]                      │
│                                         │
│ 🕐 Hôm nay, 10:15                      │
│ AI đã gợi ý nội dung cho "Mục tiêu"   │
│ [Xem]                                   │
│                                         │
│ 🕐 Hôm qua, 16:45                      │
│ Minh Anh đã thêm biểu đồ 1             │
│ [Xem]                                   │
│                                         │
│ [Xem tất cả]                           │
└─────────────────────────────────────────┘
```

---

### 3.9. Module 9: Thư viện mẫu

#### Giao diện Thư viện

```plaintext
┌─────────────────────────────────────────┐
│ 📚 Thư viện đề tài mẫu                 │
├─────────────────────────────────────────┤
│                                         │
│ 🔍 [Tìm kiếm...]                       │
│                                         │
│ Lọc theo lĩnh vực:                     │
│ [Tất cả ▼] [Cấp độ ▼] [Năm ▼]        │
│                                         │
│ ┌─────────────────────────────────┐   │
│ │ 🏆 Ứng dụng AI trực quan hóa    │   │
│ │    bài toán thực tế             │   │
│ │    Lĩnh vực: Toán học           │   │
│ │    Cấp: Thành phố | Năm: 2025   │   │
│ │    ⭐⭐⭐⭐⭐ (4.8/5)              │   │
│ │    [Xem chi tiết] [Sao chép]    │   │
│ └─────────────────────────────────┘   │
│                                         │
│ ┌─────────────────────────────────┐   │
│ │ 🏆 Biện pháp phát triển năng    │   │
│ │    lực tự học Địa lý...         │   │
│ │    Lĩnh vực: Khoa học xã hội    │   │
│ │    Cấp: Thành phố | Năm: 2025   │   │
│ │    ⭐⭐⭐⭐⭐ (4.9/5)              │   │
│ │    [Xem chi tiết] [Sao chép]    │   │
│ └─────────────────────────────────┘   │
│                                         │
│ [Xem thêm]                             │
└─────────────────────────────────────────┘
```

#### Chi tiết đề tài mẫu

```plaintext
┌─────────────────────────────────────────┐
│ 📄 Ứng dụng AI trực quan hóa bài toán  │
├─────────────────────────────────────────┤
│                                         │
│ 📊 Thông tin:                          │
│ • Lĩnh vực: Toán học                   │
│ • Cấp độ: Thành phố                    │
│ • Năm: 2025                            │
│ • Giải thưởng: Nhất                    │
│                                         │
│ 📝 Tóm tắt:                            │
│ Đề tài nghiên cứu ứng dụng các công   │
│ cụ AI như ChatGPT, Veo 3 để tạo video  │
│ và hình ảnh minh họa cho các bài toán  │
│ thực tế...                             │
│                                         │
│ 🎯 Điểm nổi bật:                       │
│ • Phương pháp thực nghiệm rõ ràng     │
│ • Có số liệu định lượng cụ thể        │
│ • Giải pháp sáng tạo, khả thi         │
│                                         │
│ 📥 Bạn có thể:                         │
│ [📖 Đọc toàn bộ]                       │
│ [📋 Sao chép cấu trúc]                 │
│ [💡 Lấy ý tưởng]                       │
│                                         │
│ [Đóng]                                 │
└─────────────────────────────────────────┘
```

---

### 3.10. Module 10: Cộng tác nhóm (Optional)

#### Chia sẻ dự án

```plaintext
┌─────────────────────────────────────────┐
│ 👥 Chia sẻ dự án                       │
├─────────────────────────────────────────┤
│                                         │
│ Link chia sẻ:                          │
│ ┌─────────────────────────────────┐   │
│ │ https://khkt.app/share/abc123   │   │
│ │ [📋 Sao chép]                    │   │
│ └─────────────────────────────────┘   │
│                                         │
│ Quyền truy cập:                        │
│ ○ Chỉ xem                              │
│ ● Chỉnh sửa                            │
│ ○ Quản trị                             │
│                                         │
│ Thành viên (3):                        │
│ • Thanh Trần (Chủ sở hữu)              │
│ • Minh Anh (Chỉnh sửa) [Xóa]          │
│ • Hải Phong (Xem) [Xóa]               │
│                                         │
│ [+ Thêm thành viên]                    │
│                                         │
│ [Đóng]                                 │
└─────────────────────────────────────────┘
```

---

## 4. QUY TRÌNH XỬ LÝ AI

### 4.1. Luồng tạo nội dung

```plaintext
Input từ user
    ↓
Phân tích ngữ cảnh (phần đang viết, lĩnh vực, độ dài hiện tại)
    ↓
Truy vấn knowledge base (file data kiến thức)
    ↓
Tạo prompt cho AI API:
  - System: "Bạn là trợ lý viết đề tài KHKT chuyên nghiệp..."
  - Context: [Thông tin dự án, phần đang viết]
  - Knowledge: [Trích xuất từ knowledge base]
  - User input: [Gợi ý của user]
    ↓
Gọi AI API (OpenAI/Gemini)
    ↓
Xử lý response:
  - Làm sạch format
  - Kiểm tra độ dài
  - Highlight từ khóa
    ↓
Hiển thị cho user với các tùy chọn:
  - Sao chép
  - Chèn vào văn bản
  - Tạo lại
  - Chỉnh sửa
```

### 4.2. Luồng kiểm tra chất lượng

```plaintext
User click "Kiểm tra"
    ↓
Lấy nội dung phần hiện tại
    ↓
Chạy các rule kiểm tra:
  1. Chính tả (spell check)
  2. Ngữ pháp (grammar check)
  3. Độ dài câu (> 40 từ = cảnh báo)
  4. Số liệu (có/không có)
  5. Trích dẫn (có/không có)
  6. Cấu trúc (logic/không logic)
    ↓
Tính điểm từng tiêu chí
    ↓
Tổng hợp điểm tổng (0-10)
    ↓
Tạo gợi ý cải thiện cụ thể
    ↓
Hiển thị kết quả với:
  - Điểm số
  - Danh sách lỗi
  - Gợi ý sửa (có thể click để tự động sửa)
```

### 4.3. Luồng gợi ý mẫu câu

```plaintext
User đặt con trỏ tại vị trí trong văn bản
    ↓
Xác định:
  - Phần đang viết (VD: "Lý do chọn đề tài")
  - Đoạn văn trước đó (context)
  - Lĩnh vực dự án
    ↓
Truy vấn knowledge base:
  - Lọc mẫu câu theo phần đang viết
  - Lọc theo lĩnh vực (nếu có)
    ↓
Sắp xếp theo độ phù hợp:
  - Mẫu câu mở đầu (nếu đầu phần)
  - Mẫu câu nối (nếu giữa phần)
  - Mẫu câu kết (nếu cuối phần)
    ↓
Hiển thị top 5 mẫu câu phù hợp nhất
    ↓
User click [Chèn] → Chèn vào vị trí con trỏ
```

---

## 5. TÍCH HỢP AI API

### 5.1. Cấu hình AI Service

```javascript
// ai-service.js

const AI_CONFIG = {
  provider: 'openai', // hoặc 'gemini'
  apiKey: process.env.AI_API_KEY,
  model: 'gpt-4o', // hoặc 'gemini-pro'
  temperature: 0.7,
  maxTokens: 2000
};

async function generateContent(params) {
  const { section, userInput, projectInfo, knowledgeBase } = params;
  
  const systemPrompt = `Bạn là trợ lý viết đề tài KHOA HỌC KỸ THUẬT chuyên nghiệp cho học sinh THPT.
  
Nhiệm vụ: Tạo nội dung cho phần "${section}" của đề tài.

Yêu cầu:
- Ngôn ngữ: Tiếng Việt, văn phong khoa học nhưng dễ hiểu
- Độ dài: 200-400 từ
- Cấu trúc: Rõ ràng, logic, có dẫn chứng
- Tránh: Văn học hóa, cảm tính, lặp từ

Thông tin dự án:
- Tên đề tài: ${projectInfo.title}
- Lĩnh vực: ${projectInfo.field}
- Vấn đề: ${projectInfo.problem}

Kiến thức tham khảo:
${knowledgeBase}`;

  const userPrompt = userInput || `Viết phần "${section}" cho đề tài trên.`;
  
  // Gọi API...
  const response = await callAI(systemPrompt, userPrompt);
  
  return response;
}

async function improveText(text, action) {
  const actions = {
    'shorten': 'Rút gọn đoạn văn sau nhưng giữ nguyên ý chính',
    'expand': 'Mở rộng đoạn văn sau với thêm chi tiết và ví dụ',
    'clarify': 'Làm rõ ý nghĩa của đoạn văn sau',
    'rephrase': 'Diễn đạt lại đoạn văn sau theo cách khác',
    'academic': 'Chuyển đoạn văn sau sang văn phong học thuật hơn',
    'simplify': 'Đơn giản hóa đoạn văn sau để dễ hiểu hơn'
  };
  
  const prompt = `${actions[action]}:

"${text}"`;
  
  const response = await callAI('Bạn là biên tập viên chuyên nghiệp.', prompt);
  
  return response;
}

async function checkQuality(text, section) {
  const prompt = `Kiểm tra chất lượng đoạn văn sau cho phần "${section}" của đề tài KHKT:

"${text}"

Đánh giá theo các tiêu chí (cho điểm 0-10 và giải thích):
1. Chính tả và ngữ pháp
2. Ngôn ngữ khoa học
3. Cấu trúc logic
4. Có số liệu/dẫn chứng
5. Độ dài câu phù hợp

Trả về JSON format:
{
  "scores": {
    "spelling": 8,
    "language": 7,
    "structure": 9,
    "evidence": 6,
    "sentence_length": 7
  },
  "total": 7.4,
  "issues": [
    {"type": "warning", "message": "Thiếu số liệu cụ thể", "suggestion": "Thêm thống kê hoặc kết quả khảo sát"},
    {"type": "error", "message": "Lỗi chính tả: 'nghên cứu'", "suggestion": "Sửa thành 'nghiên cứu'"}
  ],
  "strengths": ["Cấu trúc rõ ràng", "Ngôn ngữ phù hợp"]
}`;

  const response = await callAI('Bạn là chuyên gia đánh giá đề tài KHKT.', prompt);
  
  return JSON.parse(response);
}
```

### 5.2. Quản lý Knowledge Base

```javascript
// knowledge-base.js

class KnowledgeBase {
  constructor(dataFile) {
    this.data = loadJSON(dataFile); // Load file data đã tạo
  }
  
  // Lấy mẫu câu theo phần và lĩnh vực
  getSampleSentences(section, field = null) {
    let samples = this.data.sampleSentences[section] || [];
    
    if (field) {
      samples = samples.filter(s => 
        !s.field || s.field === field || s.field === 'all'
      );
    }
    
    return samples;
  }
  
  // Lấy hướng dẫn viết cho phần cụ thể
  getWritingGuide(section) {
    return this.data.writingGuides[section] || {};
  }
  
  // Lấy checklist cho phần
  getChecklist(section) {
    return this.data.checklists[section] || [];
  }
  
  // Lấy ví dụ đề tài theo lĩnh vực
  getExamples(field, limit = 5) {
    return this.data.examples
      .filter(e => e.field === field)
      .slice(0, limit);
  }
  
  // Tìm kiếm trong knowledge base
  search(query) {
    // Implement full-text search
    // Có thể dùng Fuse.js hoặc tương tự
  }
}
```

---

## 6. XỬ LÝ XUẤT FILE

### 6.1. Xuất Word (.docx)

```javascript
// export-service.js

import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';

async function exportToWord(projectData) {
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 567, // 2cm
            right: 567, // 2cm
            bottom: 567, // 2cm
            left: 850 // 3cm
          }
        }
      },
      children: [
        // Trang bìa
        new Paragraph({
          text: projectData.title,
          heading: HeadingLevel.TITLE,
          alignment: 'center'
        }),
        
        // Mục lục (tự động)
        new Paragraph({
          text: 'MỤC LỤC',
          heading: HeadingLevel.HEADING_1
        }),
        // ... generate TOC
        
        // Nội dung
        ...generateContent(projectData),
        
        // Tài liệu tham khảo
        ...generateReferences(projectData.references)
      ]
    }]
  });
  
  const blob = await Packer.toBlob(doc);
  return blob;
}

function generateContent(data) {
  const paragraphs = [];
  
  // Phần mở đầu
  paragraphs.push(
    new Paragraph({
      text: 'A. MỞ ĐẦU',
      heading: HeadingLevel.HEADING_1
    })
  );
  
  paragraphs.push(
    new Paragraph({
      text: '1. Lý do chọn đề tài',
      heading: HeadingLevel.HEADING_2
    })
  );
  
  // Parse HTML content từ editor
  const content = parseHTMLToDocx(data.introduction.reason);
  paragraphs.push(...content);
  
  // ... tiếp tục với các phần khác
  
  return paragraphs;
}
```

### 6.2. Xuất PDF

```javascript
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

async function exportToPDF(projectData) {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });
  
  // Render content to HTML
  const htmlContent = renderToHTML(projectData);
  
  // Convert to canvas
  const canvas = await html2canvas(htmlContent);
  const imgData = canvas.toDataURL('image/png');
  
  // Add to PDF
  const imgWidth = 210; // A4 width in mm
  const pageHeight = 297; // A4 height in mm
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  let heightLeft = imgHeight;
  let position = 0;
  
  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;
  
  while (heightLeft >= 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }
  
  return pdf.output('blob');
}
```

---

## 7. RESPONSIVE DESIGN

### 7.1. Breakpoints

```css
/* Mobile: < 640px */
/* Tablet: 640px - 1024px */
/* Desktop: > 1024px */

@media (max-width: 640px) {
  /* Sidebar ẩn, chuyển thành drawer */
  /* Editor full width */
  /* AI panel ẩn, hiện khi click button */
}

@media (min-width: 641px) and (max-width: 1024px) {
  /* Sidebar thu gọn */
  /* Editor và AI panel chia đều */
}

@media (min-width: 1025px) {
  /* Layout 3 cột đầy đủ */
}
```

### 7.2. Mobile UI

```plaintext
Mobile Layout:

┌─────────────────────────┐
│ [☰] KHKT Writer [👤]   │ ← Header
├─────────────────────────┤
│                         │
│   [Editor Content]      │ ← Full screen
│                         │
│                         │
├─────────────────────────┤
│ [💾] [🤖] [📊] [📥]    │ ← Bottom toolbar
└─────────────────────────┘

Khi click [🤖]:
→ AI panel slide up từ dưới (bottom sheet)

Khi click [☰]:
→ Sidebar slide in từ trái
```

---

## 8. TRẠNG THÁI & LƯU TRỮ

### 8.1. State Management

```javascript
// store.js (Zustand)

const useProjectStore = create((set, get) => ({
  // State
  currentProject: null,
  projects: [],
  isLoading: false,
  
  // Actions
  createProject: (data) => {
    const newProject = {
      id: generateId(),
      ...data,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      progress: 0,
      content: {
        introduction: {},
        body: {},
        conclusion: {},
        appendix: {}
      }
    };
    
    set(state => ({
      projects: [...state.projects, newProject],
      currentProject: newProject
    }));
    
    saveToStorage(newProject);
  },
  
  updateContent: (section, content) => {
    const project = get().currentProject;
    project.content[section] = content;
    project.updatedAt = Date.now();
    
    set({ currentProject: project });
    saveToStorage(project);
  },
  
  loadProjects: () => {
    const projects = loadFromStorage();
    set({ projects });
  }
}));
```

### 8.2. Auto-save

```javascript
// Auto-save mỗi 30 giây hoặc khi có thay đổi

let saveTimeout;

function handleContentChange(content) {
  clearTimeout(saveTimeout);
  
  saveTimeout = setTimeout(() => {
    updateContent(currentSection, content);
    showNotification('Đã lưu tự động', 'success');
  }, 30000); // 30 seconds
}

// Lưu ngay khi user rời khỏi trang
window.addEventListener('beforeunload', (e) => {
  saveCurrentProject();
});
```

---

## 9. TESTING & VALIDATION

### 9.1. Test Cases

```javascript
// Các test case quan trọng

describe('Project Creation', () => {
  test('Tạo dự án mới với thông tin đầy đủ', () => {
    // ...
  });
  
  test('Validate tên đề tài không được trống', () => {
    // ...
  });
  
  test('Wizard phải hoàn thành 5 bước', () => {
    // ...
  });
});

describe('AI Integration', () => {
  test('Tạo nội dung với AI thành công', async () => {
    // ...
  });
  
  test('Xử lý lỗi khi AI API fail', async () => {
    // ...
  });
  
  test('Kiểm tra chất lượng văn bản', async () => {
    // ...
  });
});

describe('Export', () => {
  test('Xuất Word file thành công', async () => {
    // ...
  });
  
  test('PDF có đầy đủ nội dung và format đúng', async () => {
    // ...
  });
});
```

---

## 10. DEPLOYMENT

### 10.1. Build & Deploy

```bash
# Build production
npm run build

# Deploy to Vercel/Netlify
vercel deploy --prod

# Hoặc
netlify deploy --prod
```

### 10.2. Environment Variables

```plaintext
# .env.production

VITE_AI_API_KEY=your_openai_api_key
VITE_AI_PROVIDER=openai
VITE_APP_URL=https://khkt-writer.app
```

---

## 11. HƯỚNG DẪN SỬ DỤNG CHO NGƯỜI DÙNG

### 11.1. Onboarding Flow

**Lần đầu sử dụng:**

```plaintext
1. Màn hình chào mừng
   → "Chào mừng đến với KHKT Writer Pro!"
   → [Bắt đầu]

2. Giới thiệu tính năng (3 slides)
   → Slide 1: "Viết đề tài dễ dàng với AI"
   → Slide 2: "Kiểm tra chất lượng tự động"
   → Slide 3: "Xuất file chuyên nghiệp"
   → [Tiếp tục]

3. Tạo dự án đầu tiên
   → Wizard 5 bước
```

### 11.2. Tooltips & Help

```javascript
// Hiển thị tooltip khi hover
<tooltip content="Nhập tên đề tài của bạn. VD: Ứng dụng AI trong giáo dục"><input placeholder="Tên đề tài"></tooltip>

// Help button ở mỗi phần
<helpbutton onclick="{()" ==""> showGuide('ly-do-chon-de-tai')} />
</helpbutton>
```

---

## 12. PERFORMANCE OPTIMIZATION

### 12.1. Lazy Loading

```javascript
// Lazy load các module không cần thiết ngay

const Editor = lazy(() => import('./components/Editor'));
const AIPanel = lazy(() => import('./components/AIPanel'));
const ExportModal = lazy(() => import('./components/ExportModal'));
```

### 12.2. Caching

```javascript
// Cache AI responses
const aiCache = new Map();

async function generateWithCache(key, params) {
  if (aiCache.has(key)) {
    return aiCache.get(key);
  }
  
  const result = await generateContent(params);
  aiCache.set(key, result);
  
  return result;
}
```

---

## KẾT LUẬN

Đây là prompt chi tiết để xây dựng app KHKT Writer Pro. Các điểm chính :

✅ **Giao diện:** Thiết kế chi tiết từng màn hình, component✅ **Tính năng:** 10 module đầy đủ từ tạo dự án đến xuất file✅ **Quy trình:** Wizard 5 bước, luồng xử lý AI rõ ràng✅ **Tích hợp AI:** Code mẫu cho OpenAI/Gemini API✅ **Xuất file:** Word và PDF với format chuẩn✅ **UX/UI:** Responsive, mobile-friendly✅ **Performance:** Optimization, caching, lazy loading

**Lưu ý quan trọng:**

- File data kiến thức (đã tạo trước) sẽ được load vào `knowledge-base.json`

- AI API key cần được cấu hình trong environment variables

- Có thể customize thêm theo nhu cầu cụ thể

Bạn có thể dán prompt này vào AI Studio và bổ sung file data kiến thức đã tạo để bắt đầu xây dựng app ! 🚀