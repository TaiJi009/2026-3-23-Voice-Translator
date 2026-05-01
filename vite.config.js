import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Project Pages 若需子路径，改为 '/仓库名/'
export default defineConfig({
  plugins: [react()],
  base: './',
}); 
