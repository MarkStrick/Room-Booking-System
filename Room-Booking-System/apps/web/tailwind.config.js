export default {
  content: ['./src/reference/**/*.{ts,tsx}'],
  important: '.reference-ui',
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        'cp-blue': '#0776bc',
        'cp-blue-dark': '#055a91',
        'cp-blue-light': '#499dd3',
        'cp-sky': '#6CC7EF',
        'cp-navy': '#103b64',
      },
      fontFamily: { sans: ['Sarabun', 'Noto Sans Thai', 'Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
