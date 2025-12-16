import { createRequire } from 'node:module'

import antfu from '@antfu/eslint-config'
import globals from 'globals'

const require = createRequire(import.meta.url)
const autoImportGlobals = require('./.eslintrc-auto-import.json').globals

export default antfu(
  {
    unocss: true,
    formatters: {
      css: true,
      html: true,
      markdown: 'prettier',
    },
    ignores: ['**/uni_modules'],

    stylistic: {
      rules: {

        '@stylistic/indent': ['error', 2],
        '@stylistic/padding-line-between-statements': [
          'error',
          { blankline: 'always', prev: ['let', 'const', 'var'], next: ['let', 'const', 'var'] },
        ],
      },
    },
  },
  {
    languageOptions: {
      globals: {
        uni: 'readonly',
        ...globals.browser,
        ...globals.node,
        ...autoImportGlobals,
      },
    },
    rules: {
      '@stylistic/indent': ['error', 2],

      'vue/html-indent': ['error', 2],

      'css/unknown-at-rule': 'off',

      'node/prefer-global/process': 'off',
      '@typescript-eslint/func-style': 'off',
      'unused-imports/no-unused-vars': 'off',
      'no-console': 'off',
      'vue/no-unused-vars': 'off',
      'vue/html-self-closing': 'off',
    },
  },
)
