import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // One step larger than Tailwind's defaults (12/14px): small text stays readable on a phone
      // in the canteen and for older staff. Body copy is text-sm (15px).
      fontSize: {
        xs: ['0.8125rem', { lineHeight: '1.125rem' }],
        sm: ['0.9375rem', { lineHeight: '1.375rem' }],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        warning: { DEFAULT: 'hsl(var(--warning))', foreground: 'hsl(var(--warning-foreground))' },
        success: { DEFAULT: 'hsl(var(--success))', foreground: 'hsl(var(--success-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        canvas: 'hsl(var(--canvas))',
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
      },
      // Blocks are set apart by soft shadows rather than borders. The faint 1px ring keeps a
      // white block visible on a white card; "raised" is for floating layers (menus, popovers).
      boxShadow: {
        // Not "card": that is also a colour, and shadow-card would set the shadow colour to white.
        block:
          '0 0 0 1px rgb(41 37 36 / 0.06), 0 1px 2px rgb(41 37 36 / 0.06), 0 4px 12px -4px rgb(41 37 36 / 0.10)',
        raised:
          '0 0 0 1px rgb(41 37 36 / 0.05), 0 4px 12px -2px rgb(41 37 36 / 0.10), 0 2px 4px -2px rgb(41 37 36 / 0.06)',
        overlay:
          '0 0 0 1px rgb(41 37 36 / 0.05), 0 16px 40px -8px rgb(41 37 36 / 0.20), 0 4px 12px -4px rgb(41 37 36 / 0.10)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [animate],
};

export default config;
