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

    // Không trả văn mẫu cố định khi thiếu key: học sinh có thể chép nhầm đoạn không liên quan vào bài
    if (!apiKey) {
      return res.status(503).json({ error: 'Chưa cấu hình GEMINI_API_KEY trên server — không thể tạo nội dung.' });
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
        model: 'gemini-3.6-flash',
        contents: [
            { role: 'user', parts: [{ text: systemPrompt + '\n\n' + userPrompt }] }
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
      return res.status(503).json({ error: 'Chưa cấu hình GEMINI_API_KEY trên server — không thể chỉnh sửa văn bản.' });
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
        model: 'gemini-3.6-flash',
        contents: "Bạn là biên tập viên chuyên nghiệp. " + prompt,
      });

      res.json({ content: response.text });
    } catch (error: any) {
      console.error('Error improving text:', error);
      res.status(500).json({ error: 'Failed to improve text' });
    }
  });

  app.post('/api/ai/check', async (_req, res) => {
    // Chưa có bộ chấm thật: trả lỗi rõ ràng thay vì điểm giả cố định (trước đây mọi bài đều nhận 7.4)
    res.status(501).json({ error: 'Chức năng kiểm tra chất lượng chưa được triển khai trên server.' });
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
