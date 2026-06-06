# Hướng dẫn sử dụng Curriculum Database & Validator

## 📋 Giới thiệu

**Database chuẩn GDPT 2018** cung cấp:
- ✅ Phạm vi kiến thức chuẩn cho các môn, lớp, cấp học
- ❌ Danh sách keyword cấm (nội dung vượt cấp)
- 📚 Topics hợp lệ cho từng môn/lớp

**Curriculum Validator** kiểm tra:
- Nội dung SKKN có vượt cấp không?
- Đề tài có phù hợp với môn/lớp không?
- Gợi ý topics phù hợp

---

## 🔧 Cách sử dụng trong App SKKN

### 1. Import Database và Validator

```typescript
import curriculumDB from './curriculum-database.json';
import CurriculumValidator from './curriculum-validator';

const validator = new CurriculumValidator();
```

### 2. Validate khi user nhập đề tài

```typescript
// Khi user click "Tạo SKKN"
const subject = "Toán";
const grade = "9";
const outline = "Ứng dụng nguyên hàm tích phân trong giải toán";

const validation = validator.validateOutline(subject, grade, outline);

if (!validation.isValid) {
  // Hiển thị lỗi
  showError(validation.issues.join('\n'));
  showSuggestion(validation.suggestions.join('\n'));
  return; // KHÔNG tiếp tục
}

// Tiếp tục tạo SKKN với dàn ý đã validate
generateSKKN(subject, grade, outline);
```

### 3. Cải thiện Gemini Prompt

Thay vì prompt mở:
```typescript
// ❌ CŨ - Không kiểm soát cấp học
const prompt = `Tạo SKKN cho Toán lớp 9 về: ${outline}`;
```

Dùng prompt chuẩn từ validator:
```typescript
// ✅ MỚI - Cấu hình theo cấp học
const systemPrompt = validator.generateSystemPrompt(subject, grade);

const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  body: JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    system: systemPrompt, // <-- System prompt chuẩn!
    messages: [
      {
        role: 'user',
        content: `Tạo SKKN cho ${subject} lớp ${grade}: ${outline}`
      }
    ],
    max_tokens: 2000
  })
});
```

---

## 📊 Ví dụ System Prompt được tạo

Để Toán lớp 9:

```
Bạn là một chuyên gia trong lĩnh vực SKKN (Sáng kiến kinh nghiệm) giáo dục Việt Nam.
Đang tạo nội dung SKKN cho môn Toán, lớp 9 (THCS).

PHẠM VI KIẾN THỨC ĐƯỢC PHÉP:
- Căn thức bậc hai
- Phương trình bậc hai một ẩn
- Hệ phương trình
- Bất đẳng thức
- Hàm số y = ax²
- Tỉ số lượng giác của góc nhọn
- Hệ thức lượng trong tam giác vuông
- Đường tròn
- Hình trụ, hình nón, hình cầu
- Thống kê và xác suất cơ bản

TUYỆT ĐỐI CẤMER CHỨA:
- nguyên hàm (vượt cấp, thuộc lớp cao hơn)
- tích phân (vượt cấp, thuộc lớp cao hơn)
- lôgarit (vượt cấp, thuộc lớp cao hơn)
- đạo hàm (vượt cấp, thuộc lớp cao hơn)
- hàm mũ (vượt cấp, thuộc lớp cao hơn)

HƯỚNG DẪN:
1. Nội dung SKKN PHẢI nằm trong phạm vi kiến thức GDPT 2018 cho lớp 9
2. KHÔNG được sử dụng kiến thức của lớp cao hơn
3. Dàn ý và nội dung phải phù hợp với trình độ học sinh lớp 9
4. Tập trung vào các chủ đề thích hợp theo chương trình chuẩn

Hãy tạo SKKN phù hợp với yêu cầu trên.
```

---

## 🚀 Integrasi đầy đủ trong React App

### Step 1: Update `generateSKKN` function

```typescript
// pages/SKKNGenerator.tsx
import { curriculumValidator } from '@/utils/curriculum-validator';

async function handleGenerateSKKN(subject: string, grade: string, outline: string) {
  // 1. Validate
  const validation = curriculumValidator.validateOutline(subject, grade, outline);
  
  if (!validation.isValid) {
    setErrors(validation.issues);
    setSuggestions(validation.suggestions);
    return;
  }

  // 2. Generate system prompt chuẩn
  const systemPrompt = curriculumValidator.generateSystemPrompt(subject, grade);

  // 3. Call Gemini API với system prompt chuẩn
  setLoading(true);
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Tạo dàn ý chi tiết cho SKKN: ${outline}`
        }],
        max_tokens: 2000
      })
    });

    const data = await response.json();
    const outline = data.content[0].text;
    
    // 4. Post-validate output (kiểm tra lại output có vượt cấp không)
    const outputValidation = curriculumValidator.validateOutline(
      subject, 
      grade, 
      outline
    );
    
    if (!outputValidation.isValid) {
      console.warn('Output lỗi:', outputValidation.issues);
      // Re-generate hoặc notify user
    }

    setSKKNOutline(outline);
  } finally {
    setLoading(false);
  }
}
```

### Step 2: Add validation UI component

```typescript
// components/ValidationAlert.tsx
export function ValidationAlert({ validation }) {
  if (validation.isValid) {
    return (
      <div style={{ 
        padding: '1rem', 
        background: '#eaf3de', 
        borderRadius: '8px',
        marginBottom: '1rem'
      }}>
        <p style={{ margin: 0, color: '#3b6d11', fontWeight: 500 }}>
          ✓ Dàn ý phù hợp với {validation.subject} lớp {validation.grade}
        </p>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '1rem', 
      background: '#fcebeb', 
      borderRadius: '8px',
      marginBottom: '1rem'
    }}>
      <p style={{ margin: 0, color: '#a32d2d', fontWeight: 500 }}>
        ⚠ Lỗi kiểm tra:
      </p>
      <ul style={{ margin: '8px 0 0 0', fontSize: '13px' }}>
        {validation.issues.map((issue, i) => (
          <li key={i}>{issue}</li>
        ))}
      </ul>
      {validation.suggestions.length > 0 && (
        <div style={{ marginTop: '8px', fontSize: '13px', color: '#5F5E5A' }}>
          <strong>Gợi ý:</strong>
          <ul style={{ margin: '4px 0 0 0' }}>
            {validation.suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

---

## ✅ Kiểm tra lỗi từng bước

### Test case 1: Toán lớp 9 - Nguyên hàm (VỀT CẤP)

```typescript
const validation = validator.validateOutline(
  'Toán',
  '9',
  'Ứng dụng nguyên hàm tích phân trong giải toán'
);

// Result:
// isValid: false
// issues: ['Dàn ý chứa nội dung vượt cấp: nguyên hàm, tích phân']
// suggestions: ['Nội dung này thuộc lớp cao hơn. Hãy chọn lớp phù hợp hoặc thay đổi đề tài.']
```

### Test case 2: Toán lớp 9 - Phương trình bậc 2 (OK)

```typescript
const validation = validator.validateOutline(
  'Toán',
  '9',
  'Rèn luyện kỹ năng giải phương trình bậc hai'
);

// Result:
// isValid: true
// issues: []
// suggestions: []
```

### Test case 3: Địa lí lớp 8 - Kinh tế xã hội (KHÔNG PHẢI LỚP)

```typescript
const validation = validator.validateOutline(
  'Địa lí',
  '8',
  'Phát triển kinh tế-xã hội Việt Nam'
);

// Result:
// isValid: false
// issues: ['Đề tài có vẻ nằm ngoài phạm vi kiến thức chuẩn']
// suggestions: ['Đề tài phù hợp: Địa lí tự nhiên Việt Nam, Vị trí, Biên giới, Khí hậu, Thủy văn, Tài nguyên']
```

---

## 📁 Cấu trúc file

```
app/
├── src/
│   ├── utils/
│   │   ├── curriculum-database.json      ← Database chuẩn
│   │   ├── curriculum-validator.ts       ← Logic validate
│   │   └── index.ts
│   ├── components/
│   │   └── ValidationAlert.tsx           ← UI component hiển thị lỗi
│   ├── pages/
│   │   └── SKKNGenerator.tsx             ← Component chính
│   └── config/
│       └── gemini.ts                     ← Cấu hình Gemini API
└── public/
```

---

## 🔍 Kiểm tra output từ Gemini

**SỰ CỐ CHUNG**: Gemini vẫn sinh output vượt cấp dù có system prompt chuẩn

**GIẢI PHÁP**: Post-validate output

```typescript
// Sau khi nhận response từ Gemini
const gemiOutline = data.content[0].text;

// Validate output
const outputCheck = validator.validateOutline(subject, grade, gemiOutline);

if (!outputCheck.isValid) {
  console.error('Gemini sinh output vượt cấp!');
  console.error('Issues:', outputCheck.issues);
  
  // Option 1: Re-generate với prompt chặt hơn
  // Option 2: Notify user + dùng outline original
  // Option 3: Filter output tự động
}
```

---

## 📖 Tài liệu tham khảo

- **GDPT 2018**: Chương trình Giáo dục Phổ thông 2018 chính thức
- **Thông tư 32/2018/TT-BGDĐT**: Thông tư ban hành GDPT 2018
- **Database file**: `curriculum-database.json` (JSON hoàn chỉnh)
- **Validator**: `curriculum-validator.ts` (TypeScript utility)

---

## 🎯 Kết quả mong đợi

Sau khi integrate:

✅ **Toán lớp 9**: KHÔNG còn sinh nguyên hàm, tích phân, đạo hàm
✅ **Địa lí lớp 8**: KHÔNG sinh kinh tế-xã hội (nên lớp 9)
✅ **Bất kỳ môn/lớp**: Output phù hợp phạm vi chuẩn GDPT 2018
✅ **User feedback**: Cảnh báo rõ ràng khi dàn ý vượt cấp

---

## 🆘 Troubleshooting

### Q: Validator không nhận ra topic mới thêm?
**A**: Cập nhật curriculum-database.json, thêm topic vào `grades[X].topics`

### Q: Gemini vẫn sinh content vượt cấp?
**A**: Tăng cường system prompt hoặc post-validate output + re-generate

### Q: Muốn thêm môn học mới?
**A**: Thêm entry mới vào `subjects` object trong database, theo cấu trúc hiện tại

### Q: Muốn update năm học GDPT mới?
**A**: Tạo version mới (v2.0) curriculum-database.json, maintain version cũ cho compatibility

---

## 📝 Ghi chú

- Database được xây dựng dựa trên Thông tư 32/2018/TT-BGDĐT chính thức
- Forbidden keywords là những nội dung **KHÔNG NÊN** xuất hiện ở cấp đó
- Topics là những nội dung **NÊN** xuất hiện ở cấp đó
- Validator là tool hỗ trợ, không thay thế sự phán đoán của người dùng
