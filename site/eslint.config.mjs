import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

// Next.js 15 flat-config pattern (FlatCompat over the official next configs).
// Scope: the app/components/lib TypeScript surface. scripts/ are plain Node
// utilities already gated by syntax checks + the asset/CSS gates; out/ and
// .next/ are generated output.
const eslintConfig = [
  {
    ignores: ['out/**', '.next/**', 'node_modules/**', 'scripts/**', 'fetch-fonts.mjs', 'next-env.d.ts']
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript')
];

export default eslintConfig;
