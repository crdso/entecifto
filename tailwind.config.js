/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	extend: {
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  			void: '#070708',
  			energy: '#171719',
  			signal: '#B9BCC3',
  			lavender: '#E2E3E6',
  			pulse: '#858A93',
  			data: '#F7F7F8',
  			dim: '#A4A7AD',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		fontFamily: {
  			heading: ['var(--font-heading)'],
  			body: ['var(--font-body)'],
  			display: ['var(--font-display)'],
  			tech: ['var(--font-tech)'],
  			mono: ['var(--font-mono)']
  		},
  		keyframes: {
  			'float': {
  				'0%, 100%': { transform: 'translateY(0)' },
  				'50%': { transform: 'translateY(-12px)' }
  			},
  			'pulse-glow': {
  				'0%, 100%': { boxShadow: '0 0 0 0 rgba(185,188,195,0.4)' },
  				'50%': { boxShadow: '0 0 0 16px rgba(185,188,195,0)' }
  			},
  			'scan-line': {
  				'0%': { transform: 'translateY(-100%)', opacity: '0' },
  				'10%': { opacity: '1' },
  				'90%': { opacity: '1' },
  				'100%': { transform: 'translateY(100%)', opacity: '0' }
  			},
  			'circuit-pulse': {
  				'0%, 100%': { opacity: '0.25' },
  				'50%': { opacity: '0.85' }
  			},
  			'particle-drift': {
  				'0%': { transform: 'translate(0, 0)', opacity: '0' },
  				'20%': { opacity: '1' },
  				'80%': { opacity: '1' },
  				'100%': { transform: 'translate(var(--dx), var(--dy))', opacity: '0' }
  			},
  			'fade-in-up': {
  				'0%': { opacity: '0', transform: 'translateY(24px)' },
  				'100%': { opacity: '1', transform: 'translateY(0)' }
  			},
  			'shimmer': {
  				'0%': { backgroundPosition: '-200% center' },
  				'100%': { backgroundPosition: '200% center' }
  			},
  			'aurora-1': {
  				'0%, 100%': { transform: 'translate(0, 0) scale(1)' },
  				'50%': { transform: 'translate(6%, 5%) scale(1.15)' }
  			},
  			'aurora-2': {
  				'0%, 100%': { transform: 'translate(0, 0) scale(1)' },
  				'50%': { transform: 'translate(-8%, 6%) scale(1.1)' }
  			},
  			'aurora-3': {
  				'0%, 100%': { transform: 'translate(0, 0) scale(1)' },
  				'50%': { transform: 'translate(5%, -8%) scale(1.2)' }
  			},
  			'aurora-4': {
  				'0%, 100%': { transform: 'translate(0, 0) scale(1)' },
  				'50%': { transform: 'translate(-6%, -6%) scale(1.12)' }
  			},
  			'spin-slow': {
  				'0%': { transform: 'rotate(0deg)' },
  				'100%': { transform: 'rotate(360deg)' }
  			},
  			'drift-grid': {
  				'0%, 100%': { transform: 'translate(0, 0)' },
  				'50%': { transform: 'translate(-16px, -16px)' }
  			},
  			'fabric-drift': {
  				'0%': { transform: 'scale(1.06) translate(0, 0)' },
  				'50%': { transform: 'scale(1.10) translate(-1.5%, 1%)' },
  				'100%': { transform: 'scale(1.06) translate(0, 0)' }
  			},
  			'fabric-drift-2': {
  				'0%': { transform: 'scale(1.12) translate(0, 0)' },
  				'50%': { transform: 'scale(1.16) translate(1.2%, -0.8%)' },
  				'100%': { transform: 'scale(1.12) translate(0, 0)' }
  			},
  			'chrome-shimmer': {
  				'0%': { backgroundPosition: '-250% center' },
  				'100%': { backgroundPosition: '250% center' }
  			},
  			'silver-glow': {
  				'0%, 100%': { opacity: '0.7' },
  				'50%': { opacity: '1' }
  			},
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
   		animation: {
  			'float': 'float 4s ease-in-out infinite',
  			'pulse-glow': 'pulse-glow 2s ease-out infinite',
  			'scan-line': 'scan-line 4s ease-in-out infinite',
  			'circuit-pulse': 'circuit-pulse 5s ease-in-out infinite',
  			'particle-drift': 'particle-drift 8s linear infinite',
  			'fade-in-up': 'fade-in-up 0.8s ease-out forwards',
  			'shimmer': 'shimmer 3s linear infinite',
 			'aurora-1': 'aurora-1 26s ease-in-out infinite',
 			'aurora-2': 'aurora-2 32s ease-in-out infinite',
 			'aurora-3': 'aurora-3 38s ease-in-out infinite',
 			'aurora-4': 'aurora-4 44s ease-in-out infinite',
 			'spin-slow': 'spin-slow 110s linear infinite',
 			'drift-grid': 'drift-grid 18s ease-in-out infinite',
  			'fabric-drift': 'fabric-drift 42s ease-in-out infinite',
  			'fabric-drift-2': 'fabric-drift-2 58s ease-in-out infinite',
  			'chrome-shimmer': 'chrome-shimmer 5.5s linear infinite',
  			'silver-glow': 'silver-glow 4s ease-in-out infinite',
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}
