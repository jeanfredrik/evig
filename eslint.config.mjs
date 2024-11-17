import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: 'tsconfig.eslint.json',
        // projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    ignores: ['dist/**', 'coverage/**'],
  },
);
