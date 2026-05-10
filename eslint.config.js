import tsPlugin from '@typescript-eslint/eslint-plugin'
import litPlugin from 'eslint-plugin-lit'
import wcPlugin from 'eslint-plugin-wc'
import prettier from 'eslint-config-prettier'

export default [
  { ignores: ['dist/', 'node_modules/', 'coverage/', '*.js'] },
  ...tsPlugin.configs['flat/recommended'],
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports' },
      ],
    },
  },
  {
    ...litPlugin.configs['flat/recommended'],
    files: ['src/**/*.ts'],
  },
  {
    files: ['src/**/*.ts'],
    plugins: { lit: litPlugin },
    rules: {
      'lit/attribute-names': 'error',
      'lit/lifecycle-super': 'error',
      'lit/no-classfield-shadowing': 'error',
      'lit/no-invalid-escape-sequences': 'error',
      'lit/no-legacy-imports': 'error',
      'lit/no-native-attributes': 'error',
      'lit/no-private-properties': 'error',
      'lit/no-template-arrow': 'error',
      'lit/no-template-bind': 'error',
      'lit/no-this-assign-in-render': 'error',
      'lit/no-useless-template-literals': 'error',
      'lit/no-value-attribute': 'error',
      'lit/prefer-nothing': 'error',
      'lit/prefer-static-styles': 'error',
      'lit/quoted-expressions': 'error',
      'lit/no-invalid-html': 'error',
    },
  },
  {
    ...wcPlugin.configs['flat/best-practice'],
    files: ['src/**/*.ts'],
    rules: {
      ...wcPlugin.configs['flat/best-practice'].rules,
      'wc/guard-super-call': 'off',
    },
  },
  prettier,
]
