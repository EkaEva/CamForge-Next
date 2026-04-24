/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{js,ts,jsx,tsx}', './index.html'],
  darkMode: 'class',
  theme: {
    screens: {
      'xs': '475px',    // 小屏手机
      'sm': '640px',    // 大屏手机
      'md': '768px',    // 平板竖屏
      'lg': '1024px',   // 平板横屏/小笔记本
      'xl': '1280px',   // 桌面
      '2xl': '1536px',  // 大屏桌面
    },
    extend: {
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      spacing: {
        'touch': '44px',  // 触摸目标最小尺寸
      },
    },
  },
  plugins: [],
}
