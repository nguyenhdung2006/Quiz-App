import js from "@eslint/js";
import globals from "globals";

const frontendGlobals = {
  apiOrigin: "readonly",
  showNotification: "readonly",
  updateStats: "readonly",
  updateVocabList: "readonly",
  updateWordCount: "readonly",
  updateAllStats: "readonly",
  loadVocab: "readonly",
  saveVocab: "readonly",
  getData: "readonly",
  setData: "readonly",
  addWord: "readonly",
  deleteWord: "readonly",
  editWord: "readonly",
  startQuiz: "readonly",
  nextQuestion: "readonly",
  selectAnswer: "readonly",
  renderWrongWordsList: "readonly",
  setupLearningStudio: "readonly",
  setupReviewToday: "readonly",
};

const commonRules = {
  ...js.configs.recommended.rules,
  curly: ["error", "multi-line"],
  eqeqeq: ["error", "always", { null: "ignore" }],
  "no-implied-eval": "error",
  "no-new-func": "error",
  "no-redeclare": "error",
  "no-script-url": "error",
  "no-unused-vars": [
    "error",
    {
      args: "after-used",
      argsIgnorePattern: "^_",
      caughtErrors: "all",
      caughtErrorsIgnorePattern: "^_",
      ignoreRestSiblings: true,
      vars: "local",
    },
  ],
};

export default [
  {
    ignores: [
      "archive/**",
      "backend/**",
      "docs/**",
      "node_modules/**",
      "playwright-report/**",
      "release-gate-artifacts/**",
      "test-results/**",
    ],
  },
  {
    files: ["frontend/js/**/*.js", "tests/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...frontendGlobals,
      },
    },
    rules: commonRules,
  },
  {
    files: ["scripts/**/*.mjs", "tests/**/*.mjs", "playwright.config.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.node,
    },
    rules: commonRules,
  },
];
