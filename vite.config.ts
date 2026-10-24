import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Lưu ý: mọi biến VITE_* (kể cả VITE_GEMINI_API_KEYS) đều bị đóng gói vào JS gửi xuống trình duyệt.
// Không inline thêm key vào process.env; muốn giấu key thật sự cần proxy phía server.
export default defineConfig(() => {
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve('.'),
      }
    }
  };
});
