import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// BASE_PATH is set by the GitHub Pages build (/CitiesExplorer/); Vercel serves from the root.
export default defineConfig({ base: process.env.BASE_PATH || '/', plugins: [react()] });
