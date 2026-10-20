# Design System

This document defines the foundational visual and implementation rules for this application. It is intended to provide a consistent starting point for all screens and components built with React and Tailwind CSS v4.

## Principles

- **Clear hierarchy:** Make the primary action and most important content immediately recognizable.
- **Consistent rhythm:** Use the spacing scale rather than arbitrary values.
- **Purposeful restraint:** Prefer simple layouts, limited colors, and a small component vocabulary.
- **Accessible by default:** Preserve readable contrast, visible focus states, and comfortable hit targets.
- **Responsive first:** Build mobile layouts first and enhance them at larger breakpoints.

## Foundations

### Color

Use neutral colors for structure and a single blue accent for interactive and status elements. The palette is deliberately compact.

| Token | Value | Intended use |
| --- | --- | --- |
| `--color-background` | `#FFFFFF` | Application and page background |
| `--color-surface` | `#FFFFFF` | Cards, dialogs, and raised surfaces |
| `--color-surface-subtle` | `#F8FAFC` | Quiet sections, hover backgrounds |
| `--color-border` | `#E2E8F0` | Borders and dividers |
| `--color-text` | `#0F172A` | Primary text |
| `--color-text-muted` | `#64748B` | Supporting text and icons |
| `--color-primary` | `#2563EB` | Primary actions and links |
| `--color-primary-hover` | `#1D4ED8` | Hovered primary actions |
| `--color-primary-subtle` | `#EFF6FF` | Selected or informational backgrounds |
| `--color-success` | `#16A34A` | Success messaging |
| `--color-warning` | `#D97706` | Warnings |
| `--color-danger` | `#DC2626` | Destructive actions and errors |

Do not use color alone to communicate state. Pair status colors with clear copy and, where appropriate, an icon.

### Typography

Use the system sans-serif stack until a brand typeface is introduced:

```css
font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
  "Segoe UI", sans-serif;
```

| Style | Size / line height | Weight | Usage |
| --- | --- | --- | --- |
| Display | `36px / 44px` | 700 | Page hero or major marketing statement |
| H1 | `30px / 36px` | 700 | Page title |
| H2 | `24px / 32px` | 700 | Major section heading |
| H3 | `20px / 28px` | 600 | Card and subsection headings |
| Body | `16px / 24px` | 400 | Default interface text |
| Body small | `14px / 20px` | 400 | Supporting copy and metadata |
| Label | `14px / 20px` | 500–600 | Form labels and buttons |
| Caption | `12px / 16px` | 500 | Compact supporting information |

Use sentence case for headings, buttons, labels, and navigation. Limit paragraph measure to approximately `65ch` for reading comfort.

### Spacing

Use a four-pixel base unit. Tailwind’s spacing scale maps naturally to this system.

| Token | Value | Tailwind example |
| --- | --- | --- |
| `space-1` | `4px` | `gap-1`, `p-1` |
| `space-2` | `8px` | `gap-2`, `p-2` |
| `space-3` | `12px` | `gap-3`, `p-3` |
| `space-4` | `16px` | `gap-4`, `p-4` |
| `space-5` | `20px` | `gap-5`, `p-5` |
| `space-6` | `24px` | `gap-6`, `p-6` |
| `space-8` | `32px` | `gap-8`, `p-8` |
| `space-10` | `40px` | `gap-10`, `p-10` |
| `space-12` | `48px` | `gap-12`, `p-12` |
| `space-16` | `64px` | `gap-16`, `p-16` |

Use `gap` for layout relationships instead of child margins whenever possible. Reserve margins for spacing between independent blocks.

### Layout

- Use a centered content container: `mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8`.
- Default page vertical padding: `py-8 sm:py-12 lg:py-16`.
- Keep form and reading content within `max-w-xl` or `max-w-2xl`.
- Use `grid` for repeated content and `flex` for single-axis alignment.
- At small sizes, stack adjacent controls and content. Add horizontal layouts at `sm` or `md` only when they remain readable.

### Elevation and shape

- Use `rounded-lg` (`8px`) for controls and standard cards.
- Use `rounded-xl` (`12px`) for prominent cards and dialogs.
- Prefer a `border border-slate-200` to communicate separation.
- Use subtle shadows only for raised, transient surfaces: `shadow-sm` for cards and `shadow-lg` for dialogs.
- Avoid large shadows, gradients, and multiple competing surface treatments.

## Components

### Buttons

All buttons must have a visible label, a minimum height of `40px`, and a visible keyboard focus state. Use the semantic `<button>` element for actions and `<a>` / router link for navigation.

#### Primary

For the main action in a section. Use one primary button per action group.

```tsx
<button
  className="inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
>
  Save changes
</button>
```

#### Secondary

For alternate actions that are still important.

```tsx
<button
  className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
>
  Cancel
</button>
```

#### Ghost and destructive

- **Ghost:** Use for low-emphasis actions in toolbars and dense interfaces. Keep the hover background visible.
- **Destructive:** Use red only for irreversible actions. Prefer confirming destructive actions in a dialog when the consequence is meaningful.
- **Icon-only:** Add an accessible `aria-label`, use a square `40px` hit area, and provide a tooltip where the purpose is not obvious.

### Cards

Cards group related content, actions, or settings. Do not use cards for every element on a page; use whitespace and headings first.

```tsx
<section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
  <div className="flex items-start justify-between gap-4">
    <div>
      <h2 className="text-lg font-semibold text-slate-900">Card title</h2>
      <p className="mt-1 text-sm leading-5 text-slate-500">
        Supporting information appears here.
      </p>
    </div>
  </div>
</section>
```

- Standard padding: `p-5 sm:p-6`.
- Internal element gap: `gap-3` or `gap-4`.
- Use `divide-y divide-slate-200` for structured lists within a card.
- Put card actions at the bottom or top-right, not scattered through the content.

### Forms

- Place labels above fields, using `text-sm font-medium text-slate-700`.
- Use `mt-1.5` between a label and its input, and `space-y-5` between field groups.
- Inputs should use `min-h-10 rounded-lg border border-slate-300 px-3 text-sm`.
- On focus, use `border-blue-600 outline-none ring-2 ring-blue-100`.
- Show help text below a field in `text-sm text-slate-500`.
- Show errors beside or below the affected field in `text-sm text-red-600`; describe the error in words.
- Do not rely on placeholder text as the only label.

### Navigation

- Keep primary navigation concise and task-oriented.
- Use `text-sm font-medium` for navigation items.
- Communicate the current page with both color and a structural indicator, such as a border or background.
- On narrow screens, preserve access to all essential destinations; do not merely hide navigation.

### Feedback

- **Loading:** Use a progress indicator or skeleton that matches the content structure. Keep labels available for longer operations.
- **Empty states:** Explain what is missing, why it matters, and offer a clear next action.
- **Success:** Confirm the completed action briefly and near its trigger.
- **Errors:** State what happened and how the user can recover. Keep field-level errors next to the relevant field.

## Implementation Rules

### Tailwind usage

- Use Tailwind utilities directly in JSX.
- Keep repeated component class sets close to the component until repetition justifies a reusable component.
- Prefer existing scale utilities (`p-4`, `gap-6`, `text-sm`) over arbitrary values.
- Use arbitrary values only when a design requirement cannot be expressed by the scale.
- Keep responsive variants mobile-first: base classes, then `sm:`, `md:`, and `lg:`.

### Accessibility

- Maintain at least WCAG AA color contrast: 4.5:1 for normal text and 3:1 for large text and interface boundaries.
- Every interactive control needs a clear focus-visible state.
- Use native semantic elements before adding ARIA attributes.
- Associate every input with a programmatic label.
- Preserve keyboard navigation, logical heading order, and a visible focus location.
- Honor reduced-motion preferences for nonessential animation.

### Review checklist

Before considering a UI complete, confirm:

- Typography follows the defined scale and hierarchy.
- Spacing uses the system scale and layout uses consistent gaps.
- Primary, secondary, and destructive actions are visually distinct.
- Cards are used only when they meaningfully group content.
- Hover, focus, disabled, loading, empty, and error states are accounted for where applicable.
- The interface remains usable at mobile and desktop widths.
- Controls are keyboard accessible and labels are clear.

## Gallery theme (Figma "Concept A - Personal Gallery")

The public gallery follows the Figma design at `figma.com/design/OirZXRVHOOQ9hC3THRiAWZ` (node `8:3`). Where this section conflicts with the foundations above, **this section wins for the gallery pages**; focus, hit-target, and contrast rules still apply.

| Token | Value | Intended use |
| --- | --- | --- |
| `--color-paper` (`bg-paper`) | `#FAFAF8` | Page background |
| `--color-line` (`border-line`) | `#D8DCCF` | Dividers, pill outlines, hover tints |
| `--color-ink` (`text-ink`, `bg-ink`) | `#2B2E2A` | Primary text, active pills, primary buttons, focus ring |
| `--color-stone` (`text-stone`) | `#6B7066` | Secondary text (darkened from Figma `#8A8F85` to meet WCAG AA 4.5:1) |
| `--color-stone-soft` | `#8A8F85` | Figma muted value, decorative use only |

- **Typeface:** Parkinsans (400 / 500 / 600) with Inter as fallback.
- **Shape:** pills (`rounded-full`) for filters, outlined actions and badges; sharp corners for photographs and the footer call to action.
- **Layout:** content width up to `1440px` with `px-4 sm:px-8 lg:px-16`; a 104px navigation bar and the full-bleed "Photo of the day" hero.
- **Type scale (px):** nav identity 48, hero heading 58, section title 36, caption title 17, body 13, labels 10-12, eyebrow labels 9-11 uppercase.
- **Images:** the hero is the LCP image (`fetchpriority="high"`); every grid image uses `loading="lazy"` alone.
- Pages outside the gallery (Collections, About, Admin studio) still use the foundations above and will be migrated to this theme.