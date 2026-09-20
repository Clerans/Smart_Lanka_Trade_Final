# DOCUMENT 04 — UI/UX DESIGN BRIEF & DESIGN SYSTEM ARCHITECTURE
## SmartLanka Trade – Premium Fintech Obsidian & Emerald Design System

---

### 1. Aesthetic Vision & Design Pillars
- **Theme**: Premium High-Tech Fintech Obsidian Dark Mode
- **Tone**: Trustworthy, Institutional, Crisp, High-Contrast, Data-Dense yet Breathable
- **Inspiration**: Bloomberg Terminal, Linear, Binance Pro, Robinhood

---

### 2. Color Palette & Design Tokens

```
┌──────────────────────────────────────────────────────────────┐
│ BRAND & ACCENT COLORS                                        │
│  Accent Primary (Emerald):     #00E676  (rgb: 0, 230, 118)   │
│  Accent Dark (Forest):         #00C853  (rgb: 0, 200, 83)    │
│  Accent Muted (Emerald Glow):  #1B3A2A  (rgb: 27, 58, 42)    │
│                                                              │
│ SURFACES & BACKGROUNDS                                       │
│  Base Background:              #0A0A0A  (Obsidian Deep)      │
│  Card Surface:                 #111111  (Charcoal Surface)   │
│  Elevated Surface:             #1A1A1A  (Card Header/Pill)   │
│  Input Background:             #1E1E1E  (Form Input Field)   │
│  Border Line:                  #2A2A2A  (Subtle Contrast)    │
│                                                              │
│ FINANCIAL STATUS COLORS                                      │
│  Positive / Gain / Bullish:    #00E676  (+ Change)           │
│  Negative / Loss / Bearish:    #FF4444  (- Change)           │
│  Warning / Neutral / Hold:     #FFB300  (Hold / Warning)     │
│                                                              │
│ TYPOGRAPHY COLORS                                            │
│  Primary Text:                 #FFFFFF  (100% White)         │
│  Secondary Text:               #8A8A8A  (Muted Gray)         │
│  Muted / Placeholder:          #555555  (Subtle Gray)        │
└──────────────────────────────────────────────────────────────┘
```

---

### 3. Spacing Scale & Layout Tokens

| Token | Value | Recommended Usage |
| :--- | :--- | :--- |
| `xs` | `4dp` | Icon-to-text micro gap, tag internal padding |
| `s` | `8dp` | Badge padding, tight horizontal card gap |
| `sm` | `12dp` | Standard list item row gap, card internal micro spacing |
| `m` | `16dp` | Standard screen edge horizontal padding, card content padding |
| `ml` | `20dp` | Section vertical gap, header bottom margin |
| `l` | `24dp` | Top header padding, modal outer padding |
| `xl` | `32dp` | Section separator, hero element top margin |
| `xxl` | `48dp` | Auth screen top spacer, empty state vertical clearance |

#### Layout Border Radii
- `borderRadiusSmall`: `8dp` (Badges, indicators, input boxes)
- `borderRadiusMedium`: `12dp` (Inner icon boxes, action buttons)
- `borderRadius`: `16dp` (Standard cards, modals, dropdown sheets)
- `borderRadiusLarge`: `24dp` (Hero banners, floating buttons)
- `borderRadiusPill`: `50dp` (Filter chips, status pills, CTA buttons)

---

### 4. Typography Hierarchy

| Style Role | Font Size | Weight | Line Height | Color | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Headline 1 (`h1`)** | `32sp` | Bold (`700`) | `38sp` | `#FFFFFF` | Main Screen Titles, Balance Totals |
| **Headline 2 (`h2`)** | `24sp` | Bold (`700`) | `30sp` | `#FFFFFF` | Modal Titles, Section Headers |
| **Headline 3 (`h3`)** | `20sp` | Bold (`700`) | `26sp` | `#FFFFFF` | Card Titles, Subheaders |
| **Body (`body`)** | `16sp` | Regular (`400`) | `22sp` | `#FFFFFF` | Standard Text, Input Field values |
| **Body Small (`bodySmall`)** | `14sp` | Regular (`400`) | `18sp` | `#8A8A8A` | Secondary descriptions, timestamps |
| **Micro Caption (`caption`)** | `12sp` | Medium (`500`) | `16sp` | `#8A8A8A` | Sub-labels, table column headers |
| **Financial Label (`label`)** | `11sp` | SemiBold (`600`)| `14sp` | `#00E676` | Ticker tags, category tags (Uppercase) |
| **Price / Tabular (`price`)**| `28sp`–`32sp` | Bold (`700`) | `34sp` | `#FFFFFF` | Tabular numbers (`fontVariant: ['tabular-nums']`) |

---

### 5. Interaction & Usability Guidelines
1. **Interactive Touch Targets**: Minimum `44dp x 44dp` hit area for all buttons and icons.
2. **Keyboard Management**: All form screens wrapped in `KeyboardAvoidingView` with `keyboardShouldPersistTaps="handled"`.
3. **Tab Bar Clearance**: Scroll containers configured with `paddingBottom: 96` so bottom floating tab bar never obscures interactive elements.
4. **Number Truncation**: Large LKR numbers use `numberOfLines={1}` and `adjustsFontSizeToFit` to maintain single-line layout on small screens.
