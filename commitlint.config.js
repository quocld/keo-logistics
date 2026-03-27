module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Default is 100; allow longer conventional commit subjects.
    'header-max-length': [2, 'always', 500],
  },
};
