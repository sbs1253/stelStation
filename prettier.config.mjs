/** @type {import("prettier").Config} */
const config = {
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'all',
  printWidth: 120,
  plugins: ['prettier-plugin-tailwindcss'],
};

export default config;
