# Agent Monitor Design System

A pixel-art / retro game UI design system for the Claude Code Agent Team GUI Tool.

---

## Color Palette

All colors are defined in `tailwind.config.js` under the `pixel` namespace.

### Core Colors

| Token             | Hex       | Usage                              |
| ----------------- | --------- | ---------------------------------- |
| `pixel-bg`        | `#1a1a2e` | Page / app background              |
| `pixel-surface`   | `#16213e` | Card & panel background            |
| `pixel-panel`     | `#0f3460` | Elevated surface, hover states     |
| `pixel-accent`    | `#e94560` | Primary accent, destructive action |
| `pixel-dim`       | `#8892b0` | Secondary text, placeholders       |
| `pixel-text`      | `#ccd6f6` | Default body text                  |
| `pixel-bright`    | `#e6f1ff` | Headings, emphasized text          |

### Semantic Colors

| Token             | Hex       | Usage                              |
| ----------------- | --------- | ---------------------------------- |
| `pixel-green`     | `#00d98b` | Success, working status, completed |
| `pixel-yellow`    | `#ffd93d` | Warning, in-progress, planner      |
| `pixel-blue`      | `#4fc3f7` | Info, links, researcher            |
| `pixel-purple`    | `#b388ff` | Decorative, UI designer            |
| `pixel-orange`    | `#ffab40` | Caution, tester role               |

### Agent Role Colors

Defined in `src/types/agent.ts` as `AGENT_COLORS`:

| Role           | Color     |
| -------------- | --------- |
| planner        | `#ffd93d` |
| researcher     | `#4fc3f7` |
| developer      | `#00d98b` |
| ui-designer    | `#b388ff` |
| ux-designer    | `#ff80ab` |
| tester         | `#ffab40` |
| reviewer       | `#e94560` |
| default        | `#8892b0` |

### Status Colors

| Status   | Color     |
| -------- | --------- |
| idle     | `#8892b0` |
| working  | `#00d98b` |
| blocked  | `#e94560` |
| offline  | `#4a4a5e` |

---

## Typography

### Font Families

| Class         | Stack                                       | Usage                         |
| ------------- | ------------------------------------------- | ----------------------------- |
| `font-pixel`  | `"Press Start 2P", monospace`               | Section headings, labels      |
| `font-mono`   | `"JetBrains Mono", "Fira Code", monospace`  | Body text, data, code         |

### Heading Scale

| Level     | Class                                                  | Example usage          |
| --------- | ------------------------------------------------------ | ---------------------- |
| Page h1   | `text-base font-pixel text-pixel-bright`               | App title              |
| Section   | `text-sm font-pixel text-pixel-bright tracking-wider`  | Team name, panel title |
| Label     | `text-[10px] font-pixel text-pixel-dim uppercase tracking-widest` | Sub-headers  |

### Body Text Scale

| Size    | Class                                     | Usage                      |
| ------- | ----------------------------------------- | -------------------------- |
| Default | `text-xs font-mono text-pixel-text`       | General body content       |
| Small   | `text-[10px] font-mono text-pixel-dim`    | Metadata, secondary info   |
| Tiny    | `text-[9px] font-mono text-pixel-dim`     | Counters, timestamps       |

---

## Spacing

Follow Tailwind's default 4px grid system. Key conventions:

| Context                    | Spacing            |
| -------------------------- | ------------------ |
| Page padding               | `p-4` (16px)       |
| Gap between sections       | `gap-3` (12px)     |
| Gap between cards in grid  | `gap-2` (8px)      |
| Card inner padding         | `p-3` (12px)       |
| Inline element gap         | `gap-1.5` (6px)    |
| Tight metadata spacing     | `mb-1` / `mt-0.5`  |

---

## Component Patterns

### Card / Panel Pattern

```
bg-pixel-surface rounded-lg p-3 border-2 border-pixel-panel/50
```

- Background: `bg-pixel-surface`
- Border: 2px solid with pixel-panel at reduced opacity
- Border radius: `rounded-lg` (8px)
- Inner padding: `p-3`

### Pixel Border Pattern

For a retro pixel-art frame effect, use `box-shadow` insets:

```css
box-shadow: inset -2px -2px 0 #0f3460, inset 2px 2px 0 #233a5e;
```

This gives a beveled, 8-bit appearance.

### Interactive States

- **Hover**: `hover:bg-pixel-panel` (surface -> panel)
- **Selected**: `ring-1 ring-opacity-40` + `border-2` with status color
- **Active glow**: `box-shadow: 0 0 12px {color}30`
- **Disabled**: `opacity-50 cursor-not-allowed`

### Status Indicator

- Small colored dot (`w-2 h-2 rounded-full`) with glow: `box-shadow: 0 0 6px {color}60`
- Use `animate-pulse` for active/working states

### Badge / Tag

```
inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider
```

---

## Animation

### Defined Animations

| Name             | Class                  | Behavior                      |
| ---------------- | ---------------------- | ----------------------------- |
| Slow pulse       | `animate-pulse-slow`   | 3s smooth pulse               |
| Pixel bounce     | `animate-bounce-pixel` | Stepped 3-frame bounce (4px)  |
| Blink            | `animate-blink`        | 2-step on/off blink (1s)      |

### Guidelines

- Use `steps()` timing for pixel-art feel
- Keep animations subtle; avoid continuous motion on idle elements
- Reserve `animate-pulse` for active/working status indicators
- Use `transition-all duration-200` for hover/focus transitions

---

## Dark Theme Principles

This is a **dark-first** design system. There is no light mode.

1. **Layered depth**: `pixel-bg` < `pixel-surface` < `pixel-panel` (darkest to lightest)
2. **Text hierarchy**: `pixel-bright` > `pixel-text` > `pixel-dim` (most to least prominent)
3. **Accent sparingly**: Use `pixel-accent` only for critical actions or error states
4. **Glow over shadow**: Prefer colored glow (`box-shadow: 0 0 Npx color`) over drop shadows
5. **High contrast text**: Maintain at least 4.5:1 contrast ratio for body text against surfaces

---

## Pixel Art Style Principles

1. **Crisp edges**: Use `image-rendering: pixelated` on pixel art assets
2. **Stepped animations**: Prefer `steps(N)` over smooth easing
3. **Grid alignment**: Keep dimensions in multiples of 2 or 4 for pixel-perfect rendering
4. **Monospace everything**: All text uses monospace fonts
5. **Beveled borders**: Use inset box-shadows to simulate 8-bit UI frames
6. **8-bit avatars**: Agent avatars are 16x16 SVG pixel grids scaled up
7. **Minimal gradients**: Flat colors with subtle glow; avoid smooth gradients
8. **Retro palette**: Stick to the defined palette; do not introduce arbitrary colors
