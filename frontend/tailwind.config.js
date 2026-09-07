/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
  	extend: {
  		// ── Typography ──────────────────────────────────────────────────────
  		// font-sans (default body) → IBM Plex Sans. font-display → Manrope,
  		// used for page titles/headings — see PharmaCare Design System/colors_and_type.css.
  		fontFamily: {
  			sans:    ['"IBM Plex Sans"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
  			display: ['Manrope', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
		// ── PharmaCare brand tokens ──────────────────────────────────────────
		// Use these instead of raw hex. Change here → updates everywhere.
		//   text-brand / bg-brand         → #4682B4  (Steel Blue, primary)
		//   hover:bg-brand-dark           → #3a6d96  (hover on primary)
		//   bg-brand-tint                 → #f0f7ff  (table row hover)
		//   bg-brand-subtle               → #4682B4/10% (selected rows)
		'brand': {
			DEFAULT:  '#4682B4',
			dark:     '#3a6d96',
			tint:     '#f0f7ff',
			subtle:   'rgba(70,130,180,0.10)',
		},
		// ── Surface tokens ─────────────────────────────────────────────────────
		// bg-page    → #F8FAFB  (every page root background — replaces bg-[#F8FAFB])
		// bg-sidebar → #1a2332  (dark sidebar shell — replaces bg-[#1a2332])
		'page':    '#F8FAFB',
		'sidebar': '#1a2332',
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
  			}
  		},
  		keyframes: {
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
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		},
		// ── Animation tokens ─────────────────────────────────────────────────────
		// Use duration-fast/base/slow/slower instead of arbitrary ms values.
		// Use ease-out-smooth for entrances, ease-in-smooth for exits.
		// Example: className="transition-colors duration-base"
		//          className="transition-transform duration-slower ease-out-smooth"
		transitionDuration: {
			fast:   '100ms',   // hover states, button press
			base:   '150ms',   // default — use for most transitions
			slow:   '250ms',   // modals opening, panels sliding
			slower: '350ms',   // page-level transitions, Sheet drawers
		},
		transitionTimingFunction: {
			'ease-out-smooth': 'cubic-bezier(0.16, 1, 0.3, 1)',   // Sheet/drawer slide-in
			'ease-in-smooth':  'cubic-bezier(0.4, 0, 1, 1)',       // dismiss/close
		},
		// ── Elevation tokens ────────────────────────────────────────────────────
		// Mirrors PharmaCare Design System/colors_and_type.css's --elevation-0..4.
		// Redefining shadow-sm/md/lg/xl here means every existing shadow-sm/md/lg/xl
		// usage app-wide automatically gets these values — no call-site changes
		// needed. The semantic names (card/dropdown/modal/toast) are aliases for
		// the same values, for new code that wants to name the shadow by what
		// it's for rather than by size.
		//   shadow-sm / shadow-card     → E1, cards, inputs, default surface
		//   shadow-md / shadow-dropdown → E2, dropdowns, popovers, tooltips
		//   shadow-lg / shadow-modal    → E3, modals, drawers, command palette
		//   shadow-xl / shadow-toast    → E4, toasts, critical alerts, max depth
		boxShadow: {
			sm:       '0 1px 2px 0 rgba(0,0,0,0.05)',
			card:     '0 1px 2px 0 rgba(0,0,0,0.05)',
			md:       '0 4px 6px -1px rgba(0,0,0,0.10), 0 2px 4px -2px rgba(0,0,0,0.08)',
			dropdown: '0 4px 6px -1px rgba(0,0,0,0.10), 0 2px 4px -2px rgba(0,0,0,0.08)',
			lg:       '0 10px 25px -5px rgba(0,0,0,0.12), 0 4px 6px -2px rgba(0,0,0,0.07)',
			modal:    '0 10px 25px -5px rgba(0,0,0,0.12), 0 4px 6px -2px rgba(0,0,0,0.07)',
			xl:       '0 20px 40px -8px rgba(0,0,0,0.18), 0 8px 16px -4px rgba(0,0,0,0.10)',
			toast:    '0 20px 40px -8px rgba(0,0,0,0.18), 0 8px 16px -4px rgba(0,0,0,0.10)',
		},
  	}
  },
  plugins: [require("tailwindcss-animate")],
};