# Accountability Section - Design System Styling Guide

**Reference File**: Dashboard.jsx  
**Political Donations View**: Lines 6675-6846+ (view === "transparency.donations")

This guide documents EVERY styling pattern used in the Accountability → Political Donations view to serve as the canonical reference for fixing the Accountability section.

---

## PAGE HEADER BLOCK

### Wrapper Container (Line 6828)
```jsx
<div className="py-6 mb-4">
```
**Classes**: `py-6 mb-4`
- `py-6` = 1.5rem padding top/bottom
- `mb-4` = 1rem margin bottom

### Eyebrow/Breadcrumb (Lines 6829-6832)
```jsx
<div className={
  "text-[10px] uppercase tracking-[0.2em] " +
  "font-medium text-gray-600 mb-2"
}>
  Accountability {"\u2192"} Political Finance
</div>
```
**Classes**: `text-[10px] uppercase tracking-[0.2em] font-medium text-gray-600 mb-2`
- `text-[10px]` = 10px font size
- `uppercase` = all caps
- `tracking-[0.2em]` = letter spacing (0.2em)
- `font-medium` = 500 weight
- `text-gray-600` = medium gray color
- `mb-2` = 0.5rem bottom margin

### h2 Main Title (Lines 6835-6838)
```jsx
<h2 className={
  "text-2xl md:text-3xl font-black " +
  "uppercase tracking-tight"
}>
  Political Donations
</h2>
```
**Classes**: `text-2xl md:text-3xl font-black uppercase tracking-tight`
- `text-2xl` = 1.5rem (24px) on mobile
- `md:text-3xl` = 1.875rem (30px) on tablet+
- `font-black` = 900 weight (boldest)
- `uppercase` = all caps
- `tracking-tight` = tighter letter spacing

### Description Text (Lines 6841-6845)
```jsx
<p className="text-gray-500 text-sm mt-2">
  {"Every donation over £500 reported to the Electoral Commission since 2001. " +
   "Covering " + dd.summary.totalDonations.toLocaleString() + " donations totalling " +
   fmt(dd.summary.totalValue) + " across all UK political parties."}
</p>
```
**Classes**: `text-gray-500 text-sm mt-2`
- `text-gray-500` = lighter gray text
- `text-sm` = 0.875rem (14px)
- `mt-2` = 0.5rem top margin

---

## FILTER PILLS/CHIPS - PERIOD SELECTOR

### Wrapper Container (Line 6849)
```jsx
<div className="flex flex-wrap gap-2">
```
**Classes**: `flex flex-wrap gap-2`
- `flex` = flexbox layout
- `flex-wrap` = wrap to next line if needed
- `gap-2` = 0.5rem gap between pills

### Active Pill Button (Lines 6854-6860)
```jsx
className={
  "px-3 py-1.5 rounded-full text-xs font-medium transition-all " +
  "bg-red-500/20 text-red-300 ring-1 ring-red-500/40"
}
```
**Classes**: `px-3 py-1.5 rounded-full text-xs font-medium transition-all bg-red-500/20 text-red-300 ring-1 ring-red-500/40`
- `px-3` = 0.75rem horizontal padding
- `py-1.5` = 0.375rem vertical padding
- `rounded-full` = fully rounded (border-radius: 9999px)
- `text-xs` = 0.75rem (12px) font size
- `font-medium` = 500 weight
- `transition-all` = smooth transition on all properties
- `bg-red-500/20` = red background with 20% opacity
- `text-red-300` = light red text
- `ring-1` = 1px outline
- `ring-red-500/40` = red outline with 40% opacity

### Inactive Pill Button (Lines 6854-6858)
```jsx
className={
  "px-3 py-1.5 rounded-full text-xs font-medium transition-all " +
  "bg-gray-800/60 text-gray-400 hover:bg-gray-700/60 hover:text-gray-300"
}
```
**Classes**: `px-3 py-1.5 rounded-full text-xs font-medium transition-all bg-gray-800/60 text-gray-400 hover:bg-gray-700/60 hover:text-gray-300`
- `px-3 py-1.5` = same padding as active
- `rounded-full` = fully rounded
- `text-xs font-medium` = same typography as active
- `transition-all` = smooth transition
- `bg-gray-800/60` = dark gray background with 60% opacity
- `text-gray-400` = medium-light gray text
- `hover:bg-gray-700/60` = slightly lighter gray on hover
- `hover:text-gray-300` = lighter text on hover

---

## STAT CARDS GRID

### Grid Wrapper (Line 6867)
```jsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-gray-800/50">
```
**Classes**: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-gray-800/50`
- `grid` = CSS Grid layout
- `grid-cols-1` = 1 column on mobile
- `sm:grid-cols-2` = 2 columns on small devices (640px+)
- `lg:grid-cols-4` = 4 columns on large devices (1024px+)
- `gap-px` = 1px gap between items (NOT gap-4!)
- `bg-gray-800/50` = dark gray background with 50% opacity (creates border effect)

**Key Difference**: Unlike other stat card grids which use `gap-4` (1rem), the Accountability section uses `gap-px` (0.125rem) for a tighter, more connected appearance.

### Individual StatCard (via inherited component)
Uses the standard **StatCard component** (Lines 242-273):

**Wrapper div**:
- Classes: `border-l-2 border-gray-800 pl-5 py-3 hover:border-gray-600 transition-colors`

**Icon + Label**:
- Icon size: 12px
- Icon color: `text-gray-600`
- Label: `text-gray-500 text-[10px] uppercase tracking-[0.15em] font-medium`

**Value**:
- Classes: `text-2xl font-bold tracking-tight` + accent color
- Default accent: `text-white`
- NO accent specified in Donations view (all use default white)

**Sub text**:
- Classes: `text-gray-600 text-xs mt-0.5`

---

## CORE COMPONENT DEFINITIONS USED

### StatCard Component (Lines 242-273)
**Full reference**:
```jsx
function StatCard({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className={
      "border-l-2 border-gray-800 pl-5 py-3 " +
      "hover:border-gray-600 transition-colors"
    }>
      <div className="flex items-center gap-2 mb-1">
        <Icon
          size={12}
          className="text-gray-600"
        />
        <span className={
          "text-gray-500 text-[10px] " +
          "uppercase tracking-[0.15em] font-medium"
        }>
          {label}
        </span>
      </div>
      <div className={
        "text-2xl font-bold tracking-tight " +
        resolveAccent(accent)
      }>
        {value}
      </div>
      {sub && (
        <div className="text-gray-600 text-xs mt-0.5">
          {sub}
        </div>
      )}
    </div>
  );
}
```

**ACCENT_MAP** (Lines 226-234):
```jsx
const ACCENT_MAP = {
  red: "text-red-500",
  amber: "text-amber-400",
  blue: "text-blue-400",
  green: "text-green-500",
  cyan: "text-cyan-400",
  orange: "text-orange-400",
  emerald: "text-emerald-400",
};

function resolveAccent(accent) {
  if (!accent) return "text-white";
  if (accent.startsWith("text-")) return accent;
  return ACCENT_MAP[accent] || "text-white";
}
```

---

## SUMMARY TABLE

| Element | Tailwind Classes | Purpose |
|---------|------------------|---------|
| **Page wrapper** | `py-6 mb-4` | Header container with spacing |
| **Eyebrow label** | `text-[10px] uppercase tracking-[0.2em] font-medium text-gray-600 mb-2` | Breadcrumb style navigation |
| **h2 title** | `text-2xl md:text-3xl font-black uppercase tracking-tight` | Main page heading |
| **Description** | `text-gray-500 text-sm mt-2` | Subtitle/description text |
| **Filter wrapper** | `flex flex-wrap gap-2` | Container for period selector pills |
| **Filter pill (active)** | `px-3 py-1.5 rounded-full text-xs font-medium transition-all bg-red-500/20 text-red-300 ring-1 ring-red-500/40` | Selected time period |
| **Filter pill (inactive)** | `px-3 py-1.5 rounded-full text-xs font-medium transition-all bg-gray-800/60 text-gray-400 hover:bg-gray-700/60 hover:text-gray-300` | Unselected time period |
| **Grid wrapper** | `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-gray-800/50` | Stat cards container |
| **StatCard wrapper** | `border-l-2 border-gray-800 pl-5 py-3 hover:border-gray-600 transition-colors` | Individual card |
| **StatCard label** | `text-gray-500 text-[10px] uppercase tracking-[0.15em] font-medium` | Card label text |
| **StatCard value** | `text-2xl font-bold tracking-tight text-white` | Large metric number |
| **StatCard sub** | `text-gray-600 text-xs mt-0.5` | Supporting text below value |

---

## COLOR PALETTE USED IN ACCOUNTABILITY

### Grayscale
- `text-gray-300` - Light text (hover states)
- `text-gray-400` - Neutral text (inactive pill text)
- `text-gray-500` - Medium gray (descriptions, labels)
- `text-gray-600` - Darker gray (eyebrows, icons, sub text)
- `text-gray-700` - Secondary info
- `text-gray-800` - Borders, dividers
- `bg-gray-800/60` - Inactive pill background
- `bg-gray-800/50` - Grid background
- `bg-gray-950` - Darkest backgrounds

### Red Accent (Political Donations focus)
- `text-red-300` - Active pill text
- `text-red-400` - For accent values
- `text-red-500` - From ACCENT_MAP
- `bg-red-500/20` - Active pill background
- `ring-red-500/40` - Active pill outline

### No other colors used in this view
(Donations view is grayscale + red only, unlike other views which use emerald, amber, etc.)

---

## RESPONSIVE BREAKPOINTS USED

| Breakpoint | Size | StatCard Grid |
|-----------|------|---|
| Default (mobile) | <640px | 1 column |
| `sm:` (small) | 640px+ | 2 columns |
| `lg:` (large) | 1024px+ | 4 columns |

**Typography responsive**:
- h2 title: `text-2xl` → `md:text-3xl`

---

## APPLICATION TO ACCOUNTABILITY SECTION

To fix the Accountability section, use these exact patterns:

1. **Header block**: Wrapper `py-6 mb-4` with eyebrow, h2, and description inside
2. **Period filters**: `flex flex-wrap gap-2` with individual buttons
3. **Stat grid**: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-gray-800/50`
4. **Individual stat cards**: Use StatCard component with proper icons and values
5. **Color scheme**: Use grayscale + red accents (no emerald/amber elsewhere in this view)
6. **Pill states**: Active = red with ring, Inactive = gray with hover effect

---

