import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    hmr: false, // 禁用 HMR：规避 Vite6+Node24 的 WebSocket 关闭帧崩溃（WS_ERR_INVALID_CLOSE_CODE），改代码后手动刷新页面
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
    },
  },
});
