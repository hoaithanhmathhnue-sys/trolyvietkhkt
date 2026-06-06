import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // AI Routes
  app.post('/api/ai/generate', async (req, res) => {
    const { section, userInput, projectInfo } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    const mockResponse = () => {
      let result = '';
      if (section === 'Lý do chọn đề tài') {
        result = `Trong bối cảnh hiện nay, khi công nghệ ngày càng phát triển, việc ứng dụng các giải pháp số vào học tập và sinh hoạt đang trở thành xu hướng tất yếu. Qua quan sát thực tế tại môi trường học đường, chúng em nhận thấy học sinh thường gặp khó khăn trong việc tổ chức và quản lý thời gian cá nhân hiệu quả, dẫn đến căng thẳng và giảm sút kết quả học tập.

Xuất phát từ thực tiễn đó, kết hợp với niềm đam mê công nghệ và mong muốn đem lại một công cụ hữu ích cho cộng đồng học sinh, chúng em quyết định chọn đề tài nghiên cứu về "${projectInfo?.title || 'Giải pháp hỗ trợ học sinh'}". Đề tài nhằm mục đích thiết kế và thử nghiệm một ứng dụng thông minh, giúp học sinh có thể lập kế hoạch và theo dõi tiến độ một cách khoa học. ${userInput ? 'Đặc biệt tập trung vào: ' + userInput : ''}`;
      } else {
        result = `Đây là nội dung được tạo tự động cho phần: ${section}. Với chủ đề "${projectInfo?.title}", nghiên cứu tập trung vào việc áp dụng các phương pháp luận khoa học, khảo sát thực tế và phân tích số liệu để đưa ra những kết luận khách quan nhất. Nội dung chi tiết tiếp theo sẽ làm rõ hơn giả thuyết được đặt ra và phương pháp xác minh giả thuyết đó...`;
      }
      return result;
    };

    if (!apiKey) {
      // Simulate delay for realistic feeling
      await new Promise(r => setTimeout(r, 1500));
      return res.json({ content: mockResponse() });
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const systemPrompt = `Bạn là trợ lý viết đề tài KHOA HỌC KỸ THUẬT chuyên nghiệp cho học sinh THPT.
Nhiệm vụ: Tạo nội dung cho phần "${section}" của đề tài.
Yêu cầu:
- Ngôn ngữ: Tiếng Việt, văn phong khoa học nhưng dễ hiểu
- Độ dài: 200-400 từ
- Cấu trúc: Rõ ràng, logic, có dẫn chứng
- Tránh: Văn học hóa cảm tính, lặp từ

Thông tin dự án:
- Tên đề tài: ${projectInfo?.title || 'Chưa xác định'}
- Lĩnh vực: ${projectInfo?.field || 'Chưa xác định'}
- Vấn đề: ${projectInfo?.problem || 'Chưa xác định'}`;

      const userPrompt = userInput || `Viết phần "${section}" cho đề tài trên.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
            { role: 'user', parts: [{ text: systemPrompt + '\\n\\n' + userPrompt }] }
        ],
      });

      res.json({ content: response.text });
    } catch (error: any) {
      console.error('Error generating AI content:', error);
      res.status(500).json({ error: 'Failed to generate content', details: error.message });
    }
  });

  app.post('/api/ai/improve', async (req, res) => {
    const { text, action } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      await new Promise(r => setTimeout(r, 1000));
      return res.json({ content: `[Bản đã chỉnh sửa - ${action}]: ${text}` });
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const actions: Record<string, string> = {
        'shorten': 'Rút gọn đoạn văn sau nhưng giữ nguyên ý chính',
        'expand': 'Mở rộng đoạn văn sau với thêm chi tiết và ví dụ',
        'clarify': 'Làm rõ ý nghĩa của đoạn văn sau',
        'rephrase': 'Diễn đạt lại đoạn văn sau theo cách khác',
        'academic': 'Chuyển đoạn văn sau sang văn phong học thuật hơn',
        'simplify': 'Đơn giản hóa đoạn văn sau để dễ hiểu hơn'
      };

      const prompt = `${actions[action] || 'Chỉnh sửa'}:\n\n"${text}"`;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: "Bạn là biên tập viên chuyên nghiệp. " + prompt,
      });

      res.json({ content: response.text });
    } catch (error: any) {
      console.error('Error improving text:', error);
      res.status(500).json({ error: 'Failed to improve text' });
    }
  });

  app.post('/api/ai/check', async (req, res) => {
    const { text, section } = req.body;
    // Mock response for quality check
    await new Promise(r => setTimeout(r, 1500));
    const mockCheck = {
      scores: { spelling: 8, language: 7, structure: 9, evidence: 6, sentence_length: 7 },
      total: 7.4,
      issues: [
        { type: "warning", message: "Thiếu số liệu cụ thể", suggestion: "Thêm thống kê hoặc kết quả khảo sát" },
        { type: "error", message: "Có vài lỗi chính tả nhỏ", suggestion: "Dùng công cụ kiểm tra chính tả" }
      ],
      strengths: ["Cấu trúc rõ ràng", "Ngôn ngữ phù hợp"]
    };
    res.json(mockCheck);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
