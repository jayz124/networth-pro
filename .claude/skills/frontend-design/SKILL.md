# Frontend Design Skill

Create distinctive, memorable frontends that avoid the generic "AI slop" aesthetic. Make creative, unexpected choices that surprise and delight users.

## Typography

Choose fonts that are beautiful, unique, and interesting:

**Avoid (overused/generic):**
- Inter, Roboto, Arial, system fonts
- Space Grotesk (commonly overused by AI)

**Consider instead:**
- Display fonts: Playfair Display, Fraunces, Clash Display, Cabinet Grotesk
- Sans-serif: Satoshi, General Sans, Switzer, Plus Jakarta Sans
- Mono: JetBrains Mono, Berkeley Mono, Fira Code
- Serifs: Newsreader, Literata, Source Serif Pro
- Experimental: Variable fonts, custom font pairings

## Color & Theme

Commit to a cohesive aesthetic:

- Use CSS variables for consistency (`--color-primary`, `--color-accent`, etc.)
- Dominant colors with sharp accents outperform timid, evenly-distributed palettes
- Draw inspiration from IDE themes (Dracula, Tokyo Night, Catppuccin, Nord, Gruvbox)
- Explore cultural aesthetics (Japanese minimalism, Bauhaus, Art Deco, Brutalism)

**Avoid:**
- Purple gradients on white backgrounds (clichéd AI aesthetic)
- Predictable blue/purple tech palettes
- Safe, committee-approved color choices

**Try instead:**
- High contrast with unexpected accent colors
- Monochromatic with one bold highlight
- Earth tones, jewel tones, or muted pastels with punch
- Dark themes with neon accents
- Warm neutrals with cool highlights

## Motion & Animation

Use animations for effects and micro-interactions:

- Prioritize CSS-only solutions for HTML projects
- Use Motion library (Framer Motion) for React when available
- Focus on high-impact moments over scattered micro-interactions

**Key technique:** One well-orchestrated page load with staggered reveals (`animation-delay`) creates more delight than random hover effects.

```css
/* Staggered reveal example */
.item {
  opacity: 0;
  animation: fadeSlideIn 0.5s ease forwards;
}
.item:nth-child(1) { animation-delay: 0.1s; }
.item:nth-child(2) { animation-delay: 0.2s; }
.item:nth-child(3) { animation-delay: 0.3s; }
```

## Backgrounds & Atmosphere

Create depth rather than defaulting to solid colors:

- Layer CSS gradients (multiple gradients, mesh gradients)
- Use geometric patterns (dots, grids, diagonal lines)
- Add contextual effects (noise textures, grain, subtle shadows)
- Consider glassmorphism, neumorphism, or claymorphism when appropriate

```css
/* Layered background example */
background:
  radial-gradient(circle at 20% 80%, rgba(120, 80, 255, 0.15) 0%, transparent 50%),
  radial-gradient(circle at 80% 20%, rgba(255, 100, 100, 0.1) 0%, transparent 40%),
  linear-gradient(to bottom, #0a0a0a, #1a1a2e);
```

## Anti-Patterns to Avoid

- Generic card layouts with rounded corners and shadows
- Cookie-cutter hero sections
- Predictable grid arrangements
- Safe, forgettable color choices
- Components that look like every other SaaS landing page

## Creative Direction

For each project, ask:

1. What's the emotional tone? (Playful, serious, luxurious, technical, warm?)
2. What cultural or design movements could inspire this?
3. What would make someone remember this interface?
4. What unexpected choice would elevate this beyond generic?

**Vary your approach:** Alternate between light/dark themes, different font families, different aesthetic directions. Each project deserves its own identity.

Think outside the box. Be bold. Create interfaces that feel genuinely designed, not generated.
