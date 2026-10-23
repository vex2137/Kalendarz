import { defineConfig, mergeConfig } from 'vite';
import config from '../vite.config';
import path from 'node:path';
export default defineConfig(env => mergeConfig(config(env), { build: { rollupOptions: { input: { app: path.resolve('index.html'), evaluation: path.resolve('tests/model-evaluation.html') } } } }));
