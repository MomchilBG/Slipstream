import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import preferArrowFunctions from 'eslint-plugin-prefer-arrow-functions'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    plugins: {
      'prefer-arrow-functions': preferArrowFunctions,
    },
    rules: {
      // Function declarations/expressions are disallowed - use arrow functions instead.
      'prefer-arrow-functions/prefer-arrow-functions': [
        'error',
        {
          allowNamedFunctions: false,
          returnStyle: 'unchanged',
        },
      ],
    },
    languageOptions: {
      globals: globals.browser,
    },
  },
])
