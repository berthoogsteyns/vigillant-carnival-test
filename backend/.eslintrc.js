module.exports = {
    parser: '@typescript-eslint/parser',
    parserOptions: {
        sourceType: 'module', // Allows for the use of imports  ,
        project: './tsconfig.json', // Required to have rules that rely on Types.
        tsconfigRootDir: './',
    },
    extends: [
        'airbnb-typescript/base',
        'plugin:@typescript-eslint/recommended',
        'prettier',
        'plugin:@typescript-eslint/recommended', // Uses the recommended rules from @typescript-eslint/eslint-plugin
        'prettier/@typescript-eslint', // Uses eslint-config-prettier to disable ESLint rules from @typescript-eslint/eslint-plugin that would conflict with prettier
        'plugin:prettier/recommended', // Enables eslint-plugin-prettier and eslint-config-prettier. This will display prettier errors as ESLint errors. Make sure this is always the last configuration in the extends array.
    ],
    plugins: [
        '@typescript-eslint', // Let's us override rules below.
        'prettier',
    ],
    rules: {
        'import/prefer-default-export': 'off',
        '@typescript-eslint/no-explicit-any': 0,
        '@typescript-eslint/explicit-module-boundary-types': 0,
        'no-restricted-syntax': 0,
        'no-plusplus': 0,
        'func-names': 0,
        'no-await-in-loop': 0,
        'import/no-extraneous-dependencies': [
            'error',
            {
                devDependencies: true,
            },
        ],
    },
    ignorePatterns: ['scripts/lint.js', '.eslintrc.js', 'webpack.config.js'],
    settings: {
        'import/core-modules': ['aws-sdk'],
    },
};
