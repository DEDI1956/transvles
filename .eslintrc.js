module.exports = {
  root: true,
  env: {
    node: true,
    browser: true,
    es2022: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    // JavaScript/Node.js specific
    'no-console': 'off', // Allow console in development
    'no-unused-vars': ['error', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_' 
    }],
    'no-undef': 'error',
    'no-redeclare': 'error',
    'no-unused-expressions': 'error',
    'no-trailing-spaces': 'error',
    'no-multiple-empty-lines': ['error', { max: 2 }],
    'prefer-const': 'error',
    'no-var': 'error',
    
    // Security rules
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    
    // Code style
    'indent': ['error', 2],
    'quotes': ['error', 'single', { avoidEscape: true }],
    'semi': ['error', 'always'],
    'comma-dangle': ['error', 'never'],
    'object-curly-spacing': ['error', 'always'],
    'array-bracket-spacing': ['error', 'never'],
    'space-before-function-paren': ['error', 'never'],
    'keyword-spacing': 'error',
    'space-infix-ops': 'error',
    'eol-last': 'error',
    
    // Error handling
    'handle-callback-err': 'error',
    
    // Node.js specific
    'no-mixed-requires': 'error',
    'no-new-require': 'error',
    'no-path-concat': 'error'
  },
  overrides: [
    {
      files: ['**/*.test.js', '**/*.spec.js'],
      env: {
        jest: true,
        mocha: true
      },
      rules: {
        'no-console': 'off',
        'no-unused-expressions': 'off'
      }
    },
    {
      files: ['public/js/**/*.js'],
      env: {
        browser: true
      },
      rules: {
        'no-console': 'off', // Allow console in browser code
        'no-undef': 'off' // Browser globals
      }
    }
  ]
};