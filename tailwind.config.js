// file: tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,jsx}"
    ],
    darkMode: 'class', // источник: ux_guidelines.dark_theme_default = true
    theme: {
      extend: {
        colors: {
          primary: {
            50: '#eff6ff',
            100: '#dbeafe',
            500: '#3b82f6',
            600: '#2563eb',
            700: '#1d4ed8',
            800: '#1e40af',
            900: '#1e3a8a'
          },
          dark: {
            bg: '#0a0a0a',
            surface: '#1a1a1a',
            elevated: '#252525',
            border: '#2a2a2a',
            text: '#e5e5e5',
            muted: '#a3a3a3',
            subtle: '#525252'
          },
          success: '#22c55e',
          warning: '#f59e0b',
          error: '#ef4444'
        },
        spacing: {
          'touch': '44px' // источник: ux_guidelines.touch_target_px = 44
        },
        fontSize: {
          'base': ['16px', { lineHeight: '1.5' }] // источник: ux_guidelines.font_min_sp = 16
        },
        animation: {
          'slide-up': 'slideUp 0.3s ease-out',
          'fade-in': 'fadeIn 0.2s ease-out'
        },
        keyframes: {
          slideUp: {
            '0%': { transform: 'translateY(100%)' },
            '100%': { transform: 'translateY(0)' }
          },
          fadeIn: {
            '0%': { opacity: '0' },
            '100%': { opacity: '1' }
          }
        }
      }
    },
    plugins: []
  };
