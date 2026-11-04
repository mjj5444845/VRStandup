import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['archive/**', '.next/**', '.next-lab/**', '.next-pages/**', '.vinext/**', 'out/**', 'dist/**', 'output/**', 'coverage/**', 'next-env.d.ts']),
]);

export default eslintConfig;
