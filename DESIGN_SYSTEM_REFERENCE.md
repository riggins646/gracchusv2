# DESIGN SYSTEM SOURCE OF TRUTH: Styling Patterns from Dashboard.jsx

## Document Scope
This document extracts EVERY styling pattern from the three main views:
1. **Economy → Economic Output** (view === "economy.output") - Lines 11128-11760
2. **Economy → Cost of Living** (view === "economy.costOfLiving") - Lines 11763+
3. **Government → Civil Service** (view === "government") - Lines 10085-10334
4. **Accountability → Political Donations** (view === "transparency.donations") - Lines 6675-6846+

---

## COMPONENT DEFINITIONS (FOUNDATIONAL)

### 1. ACCENT_MAP Constant
**Lines 226-234**
```
const ACCENT_MAP = {
  red: "text-red-500",
  amber: "text-amber-400",
  blue: "text-blue-400",
  green: "text-green-500",
  cyan: "text-cyan-400",
  orange: "text-orange-400",
  emerald: "text-emerald-400",
};
```
**Function**: resolveAccent (line 236-240)
- Returns "text-white" if no accent
- Passthrough if accent.startsWith("text-")
- Maps shorthand to ACCENT_MAP or "text-white"

### 2. StatCard Component
**Lines 242-273**

**Wrapper div (line 244-247)**
- Classes: `"border-l-2 border-gray-800 pl-5 py-3 hover:border-gray-600 transition-colors"`
- Left border accent, hover state

**Icon + Label row (line 248-259)**
- Icon: `size={12}` with `className="text-gray-600"`
- Label: `"text-gray-500 text-[10px] uppercase tracking-[0.15em] font-medium"`

**Value div (line 260-265)**
- Classes: `"text-2xl font-bold tracking-tight " + resolveAccent(accent)`
- Default accent: "text-white"

**Sub text (line 266-270)**
- Classes: `"text-gray-600 text-xs mt-0.5"`

### 3. SectionHeader Component
**Lines 275-295**

**Wrapper (line 277)**
- Classes: `"mb-6"`

**Label/Eyebrow (line 279-283)**
- Classes: `"text-[10px] uppercase tracking-[0.2em] font-medium mb-2 " + (accent || "text-gray-500")`
- Default color: text-gray-500

**h2 Title (line 287-291)**
- Classes: `"text-2xl md:text-3xl font-black uppercase tracking-tight"`

### 4. ChartPair Component (Grid Wrapper)
**Lines 297-305**
- Wrapper classes: `"grid grid-cols-1 md:grid-cols-2 gap-4"`
- Used for 2-column chart layouts

### 5. ChartCard Component
**Lines 308-435**

**Wrapper (line 317-320)**
- Classes: `"py-1 border border-gray-800/40 bg-gray-950/20 px-4 pb-4 pt-3"`
- Very subtle border and background

**Header flex row (line 321-324)**
- Classes: `"flex items-start justify-between mb-2"`

**Title section wrapper (line 325)**
- Classes: `"flex-1 min-w-0"`

**Label/Eyebrow inside ChartCard (line 327-331)**
- Classes: `"text-[10px] uppercase tracking-[0.2em] font-medium text-gray-600 mb-0.5"`

**h3 Title inside ChartCard (line 336-340)**
- Classes: `"text-[14px] font-bold lowercase text-gray-300 leading-tight"`
- **Key difference from SectionHeader**: "lowercase" instead of "uppercase"

**Action buttons container (line 345-348)**
- Classes: `"flex items-center gap-2 shrink-0 ml-2 mt-0.5"`

**Info button (line 364-374)**
- Classes: `"w-5 h-5 rounded-full border border-gray-700 flex items-center justify-center text-[10px] font-bold text-gray-600 hover:text-gray-400 hover:border-gray-500 transition-colors"`

**Info tooltip box (line 380-386)**
- Classes: `"absolute right-0 top-7 z-40 w-64 bg-gray-950 border border-gray-700 shadow-xl px-3 py-2.5"`

**Info tooltip text (line 387-390)**
- Classes: `"text-[11px] text-gray-400 leading-relaxed"`

**Share button (line 410-414)**
- Classes: `"text-gray-700 hover:text-gray-400 transition-colors"`

**Editorial/callout box (line 422-431)**
- Classes: `"text-[12px] text-gray-500 leading-relaxed mb-3 border-l-2 border-gray-800 pl-2.5"`
- Left border accent, gray text

### 6. ChartMeta Component
**Lines 1004-1046**

**Wrapper (line 1018-1022)**
- Classes: `"flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[10px] text-gray-600 uppercase tracking-[0.1em] mb-3"`

**Metric span (line 1024-1026)**
- Classes: `"text-gray-400 font-medium"`

**Geo/Unit/Freq spans (line 1028-1030)**
- Default inherit from wrapper

**"Available" text (line 1035)**
- Classes: `"text-gray-700"`

**Source text (line 1040-1042)**
- Classes: `"text-gray-700"`

### 7. CustomTooltip Component
**Lines 437-446**

**Wrapper (line 440-443)**
- Classes: `"bg-gray-950 border border-gray-800 rounded p-3 shadow-2xl text-sm"`

### 8. Divider Component
**Lines 449-451**
- Classes: `"border-t border-gray-800/60 my-10"`

---

## ECONOMY OUTPUT VIEW STYLING PATTERNS
**Lines 11128-11760**

### Page Header Block
**Lines 11130-11141**

**Wrapper div (line 11130)**
- Classes: `"py-6 mb-4"`

**Eyebrow div (line 11131-11132)**
- Classes: `"text-[10px] uppercase tracking-[0.2em] font-medium text-gray-600 mb-2"`

**h2 Title (line 11134-11135)**
- Classes: `"text-2xl md:text-3xl font-black uppercase tracking-tight"`

**Description p (line 11137-11140)**
- Classes: `"text-gray-500 text-sm mt-2"`

### StatCard Grid (Headline Cards)
**Lines 11146-11190 (First grid)**
- **Wrapper grid (line 11146)**: `"grid grid-cols-2 md:grid-cols-4 gap-4"`
- Gap: 4 (1rem)
- 2 cols mobile, 4 cols desktop

**Accent colors used in this grid**:
- GDP Growth (line 11167-11170): conditional `"text-emerald-400"` or `"text-red-400"`
- Manufacturing PMI (line 11178-11181): conditional `"text-emerald-400"` or `"text-red-400"`
- Unemployment (line 11188): `"text-amber-400"`

**Lines 11192-11235 (Second grid)**
- **Wrapper grid (line 11192)**: `"grid grid-cols-2 md:grid-cols-4 gap-4"`
- Same grid pattern as first
- Services PMI (line 11205-11208): conditional `"text-emerald-400"` or `"text-red-400"`
- Business Investment (line 11219): `"text-emerald-400"`
- Productivity (line 11229-11232): conditional `"text-emerald-400"` or `"text-red-400"`

### ChartCard for GDP Quarterly Growth
**Lines 11238-11301**

**ChartCard wrapper** (inherited from component):
- Classes: `"py-1 border border-gray-800/40 bg-gray-950/20 px-4 pb-4 pt-3"`

**ChartMeta inside (line 11248-11257)**: 
- metric="GDP Quarterly Growth", unit="%", freq="quarterly"
- Uses standard ChartMeta styling

**Chart inner components**:
- CartesianGrid: `strokeDasharray="3 3" stroke="#374151"`
- XAxis tick: `{{ fill: "#9ca3af", fontSize: 10 }}`
- YAxis tick: `{{ fill: "#9ca3af", fontSize: 11 }}`
- Bar colors: `d.v >= 0 ? "#10b981" : "#ef4444"` (green/red)

### ChartCard for GDP per Capita Comparison
**Lines 11304-11391**

**ChartCard wrapper** (inherited):
- Classes: `"py-1 border border-gray-800/40 bg-gray-950/20 px-4 pb-4 pt-3"`

**Legend div (line 11377-11390)**:
- Classes: `"flex gap-4 mt-2 text-xs text-gray-500 justify-center"`
- Inline legend box with color indicators:
  - `"w-3 h-0.5 bg-blue-500 inline-block"` (UK)
  - `"w-3 h-0.5 bg-emerald-500 inline-block"` (France)
  - `"w-3 h-0.5 bg-amber-500 inline-block"` (Germany)

**Line colors**:
- UK: `stroke="#3b82f6"`
- France: `stroke="#10b981"`
- Germany: `stroke="#f59e0b"`

### ChartPair Wrapper
**Lines 11394-11557**
- Grid: `"grid grid-cols-1 md:grid-cols-2 gap-4"`

### PMI Trends ChartCard
**Lines 11395-11492**

**Same wrapper as all ChartCards**

**50-threshold line (line 11451-11459)**:
- `stroke="#6b728080" strokeWidth={1} strokeDasharray="6 3"`
- Muted gray dashed line

**Line colors**:
- Manufacturing: `stroke="#3b82f6"`
- Services: `stroke="#a855f7"`

**Legend (line 11478-11491)**:
- `"flex gap-4 mt-2 text-xs text-gray-500 justify-center"`

### Unemployment AreaChart
**Lines 11495-11555**

**Area fill colors**:
- `stroke="#ef4444" fill="#ef444420"` (red with transparency)

### Productivity Comparison
**Lines 11560-11652**

**Line colors**:
- UK: `stroke="#3b82f6"`
- France: `stroke="#10b981"`
- Germany: `stroke="#f59e0b"`

**Legend**: Same pattern as GDP per Capita

### Business Investment
**Lines 11656-11750**

**Line colors** (same as Productivity):
- UK: `stroke="#3b82f6"`
- France: `stroke="#10b981"`
- Germany: `stroke="#f59e0b"`

### Source Attribution
**Lines 11753-11758**

```
<div className="text-gray-600 text-xs px-1">
  Sources: ONS National Accounts; S&amp;P Global /
  CIPS PMI; ONS Labour Force Survey; OECD
  Productivity Statistics; World Bank; ONS Gross
  Fixed Capital Formation.
</div>
```

Classes: `"text-gray-600 text-xs px-1"`

---

## COST OF LIVING VIEW STYLING PATTERNS
**Lines 11763-11963**

### Page Header Block
**Lines 11765-11776**

**Wrapper (line 11765)**:
- Classes: `"py-6 mb-4"`

**Eyebrow (line 11766-11767)**:
- Classes: `"text-[10px] uppercase tracking-[0.2em] font-medium text-gray-600 mb-2"`

**h2 (line 11769-11770)**:
- Classes: `"text-2xl md:text-3xl font-black uppercase tracking-tight"`

**Description p (line 11772-11775)**:
- Classes: `"text-gray-500 text-sm mt-2"`

### StatCard Grid
**Lines 11781-11839**

**Wrapper (line 11781)**:
- Classes: `"grid grid-cols-2 md:grid-cols-3 gap-4"`
- **Note**: Different from Economy Output - only 3 cols on desktop, not 4
- 6 cards arranged 2x3

**Accent colors in this view**:
- CPI Inflation (line 11787): `"text-red-400"`
- Real Wage Growth (line 11798-11802): conditional `"text-emerald-400"` or `"text-red-400"`
- Energy Price Cap (line 11821): `"text-amber-400"`
- Food Inflation (line 11828): `"text-orange-400"`

### CPI Inflation ChartCard
**Lines 11843-11906**

**ChartCard wrapper** (inherited):
- Classes: `"py-1 border border-gray-800/40 bg-gray-950/20 px-4 pb-4 pt-3"`

**Area fill**:
- `stroke="#ef4444" fill="#ef444420"`

### Wage Growth ChartCard
**Lines 11909-11969** (continues beyond first read)

**Line colors**:
- Nominal: (not explicitly colored in CSS class, chart-based)
- Real: conditionally `"text-emerald-400"` or `"text-red-400"`

---

## GOVERNMENT CIVIL SERVICE VIEW STYLING PATTERNS
**Lines 10085-10334**

### Page Header Block
**Lines 10087-10098**

**Wrapper (line 10087)**:
- Classes: `"py-6 mb-4"`

**Eyebrow (line 10088-10089)**:
- Classes: `"text-[10px] uppercase tracking-[0.2em] font-medium text-gray-600 mb-2"`

**h2 (line 10091-10092)**:
- Classes: `"text-2xl md:text-3xl font-black uppercase tracking-tight"`

**Description p (line 10094-10097)**:
- Classes: `"text-gray-500 text-sm mt-2"`

### StatCard Grid (Headline Cards)
**Lines 10102-10123**

**Wrapper (line 10102)**:
- Classes: `"grid grid-cols-2 md:grid-cols-4 gap-4"`

**Accent colors**:
- Total Headcount (line 10105): `"text-white"`
- Since 2016 (line 10110): `"text-red-400"`
- Since 2019 (line 10115): `"text-amber-400"`
- In London (line 10120): `"text-cyan-400"`

### ChartPair Wrapper
**Lines 10125-10213**

**Grid (inherited from ChartPair)**:
- Classes: `"grid grid-cols-1 md:grid-cols-2 gap-4"`

### Civil Service Headcount ChartCard
**Lines 10126-10171**

**ChartCard wrapper** (inherited):
- Classes: `"py-1 border border-gray-800/40 bg-gray-950/20 px-4 pb-4 pt-3"`

**Area colors**:
- Headcount: `stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={2}`
- FTE: `stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.1} strokeWidth={2} strokeDasharray="4 4"`

**Tooltip text colors**:
- Year: `className="text-white font-medium"`
- Headcount: `className="text-gray-300 text-xs"`
- FTE: `className="text-cyan-400 text-xs"`

### Department Headcount ChartCard
**Lines 10173-10211**

**Bar color**:
- `fill="#3b82f6" fillOpacity={0.7}`

**Tooltip YoY color**:
- `className={"text-xs " + (d.change > 0 ? "text-red-400" : "text-emerald-400")}`

### Pay Grades ChartCard
**Lines 10215-10256**

**Bar colors** (dynamically generated):
- `fill={"hsl(" + (210 + i * 15) + ", 70%, " + (50 + i * 5) + "%)"}`
- Blue hue gradient starting at 210°, varying saturation and lightness

**Bottom text (line 10253-10254)**:
- Classes: `"text-gray-600 text-xs mt-2 text-center"`

### Regional Distribution ChartCard
**Lines 10258-10298**

**Bar colors**:
- London: `fill="#ef4444" fillOpacity={0.8}`
- Others: `fill="#3b82f6" fillOpacity={0.6}`

### Secondary Section: Welfare & Benefits
**Lines 10303-10334**

**Section divider (line 10303)**:
- Classes: `"border-t border-gray-800/40 mt-10 pt-10"`

**SectionHeader call (line 10304-10307)**:
- label: "Welfare & Benefits"
- title: "Where the Money Goes"
- accent: `"text-green-500"` (custom accent on SectionHeader)

**Description paragraph (line 10309-10311)**:
- Classes: `"text-gray-500 text-sm mb-6 -mt-4"`

**StatCard Grid (line 10314)**:
- Classes: `"grid grid-cols-2 md:grid-cols-4 gap-4"`

**Accent colors in welfare section**:
- Total Welfare Bill (line 10317): `"text-green-400"`
- Per Household (line 10322): `"text-amber-400"`
- State Pension (line 10327): `"text-white"`
- Disability Benefits (line 10332): `"text-red-400"`

---

## ACCOUNTABILITY POLITICAL DONATIONS VIEW STYLING PATTERNS
**Lines 6675-6846+**

### Page Header Block
**Lines 6828-6846**

**Wrapper (line 6828)**:
- Classes: `"py-6 mb-4"`

**Eyebrow div (line 6829-6832)**:
- Classes: `"text-[10px] uppercase tracking-[0.2em] font-medium text-gray-600 mb-2"`

**h2 Title (line 6835-6838)**:
- Classes: `"text-2xl md:text-3xl font-black uppercase tracking-tight"`

**Description p (line 6841-6845)**:
- Classes: `"text-gray-500 text-sm mt-2"`

### Period Selector Chips/Pills
**Lines 6849-6864**

**Wrapper (line 6849)**:
- Classes: `"flex flex-wrap gap-2"`

**Active pill (line 6854-6858 - active state)**:
- Classes: `"px-3 py-1.5 rounded-full text-xs font-medium transition-all bg-red-500/20 text-red-300 ring-1 ring-red-500/40"`
- Rounded-full (completely round)
- Red accent color

**Inactive pill (line 6854-6858 - inactive state)**:
- Classes: `"px-3 py-1.5 rounded-full text-xs font-medium transition-all bg-gray-800/60 text-gray-400 hover:bg-gray-700/60 hover:text-gray-300"`
- Darker background
- Hover state with lighter background

### StatCard Grid
**Lines 6867-6873**

**Wrapper (line 6867)**:
- Classes: `"grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-gray-800/50"`
- **Key difference**: `gap-px` (0.125rem) instead of `gap-4`
- Also has background: `bg-gray-800/50`
- 1 col mobile, 2 cols tablet, 4 cols desktop

---

## SUMMARY OF KEY PATTERNS

### Spacing & Layout
- **Main section gap**: `space-y-6` (1.5rem between major blocks)
- **Header padding**: `py-6 mb-4` (1.5rem top/bottom, 1rem bottom margin)
- **Card grids common gaps**: `gap-4` (1rem), except Donations which uses `gap-px` (0.125rem)
- **Grid breakpoints**: 
  - 2/3/4 cols: `grid-cols-2 md:grid-cols-3/4` (mobile 2, tablet/up 3-4)
  - Donations: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`
- **ChartPair**: `grid-cols-1 md:grid-cols-2` (1 col mobile, 2 cols desktop)

### Colors - Grayscale Palette
- **Backgrounds**: `bg-gray-950/20` (very subtle card bg), `bg-gray-800/50` (donation grid)
- **Borders**: `border-gray-800/40` (card borders), `border-gray-800` (dividers)
- **Text neutral**: `text-gray-500` (descriptions), `text-gray-600` (labels), `text-gray-300` (titles)
- **Text interactive**: `text-gray-400` (hover state), `text-gray-700` (secondary info)

### Colors - Accent Palette (ACCENT_MAP + Direct Colors)
- **Red**: `text-red-400`, `text-red-500`, `#ef4444` (charts)
- **Emerald/Green**: `text-emerald-400`, `text-green-500`, `#10b981`
- **Amber/Orange**: `text-amber-400`, `text-orange-400`, `#f59e0b`
- **Blue**: `text-blue-400`, `#3b82f6`
- **Cyan**: `text-cyan-400`, `#06b6d4`
- **Purple**: `#a855f7`
- **White**: `text-white` (default)

### Typography
- **Eyebrows**: `text-[10px] uppercase tracking-[0.2em] font-medium`
- **h2 titles**: `text-2xl md:text-3xl font-black uppercase tracking-tight`
- **h3 (in ChartCard)**: `text-[14px] font-bold lowercase` (note: lowercase, not uppercase!)
- **Labels**: `text-[10px] uppercase tracking-[0.15em]` or `tracking-[0.2em]`
- **Body**: `text-xs`, `text-sm`, `text-[11px]`, `text-[12px]`

### Borders & Boxes
- **StatCard left accent**: `border-l-2 border-gray-800 pl-5 py-3`
- **ChartCard**: `border border-gray-800/40 bg-gray-950/20 px-4 pb-4 pt-3`
- **Editorial box**: `text-[12px] text-gray-500 border-l-2 border-gray-800 pl-2.5 mb-3`
- **Info tooltip**: `bg-gray-950 border border-gray-700 shadow-xl px-3 py-2.5`
- **Section divider**: `border-t border-gray-800/40 mt-10 pt-10`

### Transitions & Hover
- **Cards**: `hover:border-gray-600 transition-colors`
- **Buttons**: `hover:text-gray-400 hover:border-gray-500 transition-colors`
- **Pills**: `transition-all`

### Charts (Recharts Integration)
- **Grid lines**: `strokeDasharray="3 3" stroke="#374151"` or `stroke="#1f2937"`
- **Ticks**: `{{ fill: "#9ca3af", fontSize: 10/11 }}`
- **Bar radius**: `radius={[3, 3, 0, 0]}` or `radius={[4, 4, 0, 0]}`
- **Area opacity**: `fillOpacity={0.15}` or `fillOpacity={0.1}`
- **Dashed lines**: `strokeDasharray="6 3"` or `strokeDasharray="4 4"`

### Special Elements
- **Info button**: `w-5 h-5 rounded-full border border-gray-700`
- **Pills/Chips**: `rounded-full text-xs font-medium transition-all`
- **Sort icons**: Monospace arrows (↑↓↕)
- **Legends**: Inline flex with small colored boxes `w-3 h-0.5`

---

## COMPONENT ACCENT USAGE PATTERNS

### StatCard Accent Prop (Direct text-* classes)
- `accent="text-emerald-400"` - positive growth, expansion
- `accent="text-red-400"` - negative, decline, contraction
- `accent="text-amber-400"` - warning/caution
- `accent="text-cyan-400"` - geographic/regional
- `accent="text-orange-400"` - food/prices
- `accent="text-white"` - neutral/primary
- `accent="text-green-400"` - welfare/benefits (welfare section)
- Conditional: `accent={condition ? "text-emerald-400" : "text-red-400"}`

### ChartCard accentColor Prop (Hex colors for charts)
- `accentColor="#ef4444"` - red (most common)
- `accentColor="#DC2626"` - darker red variant
- `accentColor="#8b5cf6"` - purple
- `accentColor="#6366f1"` - indigo
- `accentColor="#f59e0b"` - amber
- `accentColor="#10b981"` - emerald
- Used to style share buttons and chart lines

### SectionHeader accent Prop (Custom text-* classes)
- Default: `"text-gray-500"`
- Custom: `"text-green-500"` (welfare section)
- Passed as computed expression to accent parameter

---

