# PharmaCare — Iconography & Motion
# Version: 1.0 | Last updated: April 18, 2026
# Audience: Claude, all developers
# Rule: One icon library. Consistent sizes. Motion only when it communicates meaning.

---

## ICON LIBRARY

**Lucide React — exclusively.**

```jsx
import { Plus, Trash2, Eye, Edit, Download, Search, ChevronDown } from 'lucide-react';

// ❌ Never mix libraries
import { FaPlus } from 'react-icons/fa';       // Font Awesome — banned
import AddIcon from '@mui/icons-material/Add';  // MUI icons — banned
import { BsSearch } from 'react-icons/bs';      // Bootstrap icons — banned
```

---

## ICON SIZES

Two sizes only. Never freehand.

| Context | Size | Class | Example |
|---------|------|-------|---------|
| Inline with text (buttons, labels, badges) | 16px | `h-4 w-4` | Button icon, tab count |
| Standalone / prominent (empty states, page actions) | 20px | `h-5 w-5` | Action buttons in table rows |
| Large decorative (empty state illustration) | 48px | `h-12 w-12` | EmptyState icon |

```jsx
// ✅ Correct sizes
<AppButton icon={<Plus className="h-4 w-4" />}>New Bill</AppButton>
<Eye className="h-4 w-4 text-gray-500" />           // table row action

// ❌ Freehand sizes
<Plus className="h-6 w-6" />    // use h-5 w-5 or h-4 w-4
<Search className="w-[18px]" /> // never arbitrary pixel sizes
```

---

## STROKE WIDTH

Always `strokeWidth={1.5}` for Lucide icons in this codebase. The default (2) is too heavy for our light UI.

```jsx
// ✅ Correct stroke
<Plus className="h-4 w-4" strokeWidth={1.5} />
<Trash2 className="h-4 w-4" strokeWidth={1.5} />

// Or set globally via CSS if using a wrapper component
// AppButton already applies this for its icon prop
```

---

## ICON COLOURS

```jsx
// ✅ Icon colour follows context
<Plus className="h-4 w-4" />                      // inherits button text color (white on primary)
<Eye className="h-4 w-4 text-gray-500" />         // neutral action in table
<Trash2 className="h-4 w-4 text-red-500" />       // destructive action

// ❌ Never hardcode brand color on icons inside AppButton — AppButton handles it
<AppButton icon={<Plus className="h-4 w-4 text-white" />}>New Bill</AppButton>
```

---

## ICON USAGE RULES

```jsx
// ✅ Icon + label (preferred — always clearest)
<AppButton icon={<Plus className="h-4 w-4" />}>New Bill</AppButton>

// ✅ Icon-only — only for well-known actions in tables (edit, delete, view)
// Must always have aria-label
<AppButton variant="ghost" iconOnly icon={<Eye className="h-4 w-4" />} aria-label="View bill" />

// ❌ Icon-only for primary actions — users may not understand
<AppButton iconOnly icon={<Plus />} />   // what does this create? Always add a label.

// ❌ Text-only for destructive actions — add the icon for clarity
<AppButton variant="danger">Delete</AppButton>   // ✅ acceptable but prefer:
<AppButton variant="danger" icon={<Trash2 className="h-4 w-4" />}>Delete</AppButton>
```

---

## MOTION PHILOSOPHY

Motion must communicate meaning — not decorate. Every animation should answer: "what did just change and where did it go?"

**Three rules:**
1. Motion must be fast. Pharmacy staff are doing repetitive tasks.
2. Motion must be purposeful. Sheet slides in → user knows where to look.
3. Motion must be suppressible. `prefers-reduced-motion` must be respected.

---

## ANIMATION DURATIONS

| Type | Duration | Easing | Used for |
|------|----------|--------|---------|
| Micro-interaction | `150ms` | `ease-out` | Button press, checkbox, toggle |
| Component transition | `200ms` | `ease-out` | Dropdown open, tooltip |
| Panel / Sheet | `250ms` | `cubic-bezier(0.4, 0, 0.2, 1)` | Right-side sheet, modal |
| Page transition | `300ms` | `ease-in-out` | Route changes (if animated) |

```css
/* ✅ Correct Tailwind duration classes */
transition-all duration-150 ease-out    /* micro */
transition-all duration-200 ease-out    /* component */
transition-all duration-[250ms]         /* panel */

/* ❌ Too slow — feels sluggish in a productivity tool */
transition-all duration-500
transition-all duration-700
```

---

## TAILWIND ANIMATION CLASSES

```jsx
// ✅ Loading spinner
<div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />

// ✅ Skeleton shimmer (already in TableSkeleton component)
<div className="animate-pulse bg-gray-200 rounded h-4 w-full" />

// ✅ Fade in on mount
<div className="animate-in fade-in duration-200">

// ✅ Sheet slides in from right (Shadcn Sheet handles this)
// Don't override Shadcn Sheet animation — it's already correct

// ❌ Never use animate-bounce, animate-ping for UI elements — too playful
// These are only for notification dots or alerts
```

---

## REDUCED MOTION

Always respect `prefers-reduced-motion`. Tailwind does this with `motion-safe:` and `motion-reduce:`.

```jsx
// ✅ Suppress animation for users who prefer reduced motion
<div className="motion-safe:animate-spin motion-reduce:hidden">
  <Loader className="h-4 w-4" />
</div>

// ✅ Shadcn components automatically respect prefers-reduced-motion
// Don't override this
```

---

## WHAT SHOULD AND SHOULDN'T ANIMATE

| ✅ Should animate | ❌ Should NOT animate |
|-----------------|---------------------|
| Sheet/drawer sliding in | Page backgrounds |
| Modal fade + scale in | Table rows on load |
| Toast sliding in from corner | Form labels |
| Dropdown opening | Static text |
| Skeleton pulsing | Tab switching (instant) |
| Button loading spinner | Sidebar items |

---

## CHECKLIST (before every PR)

- [ ] Only Lucide icons used — no other icon libraries
- [ ] Inline icons: `h-4 w-4` | Standalone: `h-5 w-5` | Decorative: `h-12 w-12`
- [ ] `strokeWidth={1.5}` on all Lucide icons
- [ ] Icon-only buttons have `aria-label`
- [ ] No animation longer than `300ms`
- [ ] No `animate-bounce` or `animate-ping` on UI elements
- [ ] `motion-safe:` / `motion-reduce:` used for non-essential animations
