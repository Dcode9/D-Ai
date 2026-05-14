# D'Ai Indique Design Concept

## Design Philosophy

The **Indique** style for D'Ai merges luxurious South Asian-inspired aesthetics with modern AI interface design. This creates a sophisticated, ornate user experience that emphasizes elegance, craftsmanship, and refined visual hierarchy.

## Color Palette

### Primary Colors
- **Dark Background**: `#1a1a1a` - Luxurious charcoal, primary surface
- **Darker Variant**: `#0f0f0f` - Deep black for nested elements
- **Gold Accent**: `#d4af37` - Primary decorative color, represents luxury and tradition
- **Gold Light**: `#f4a460` - Warm variant for highlights
- **Purple**: `#a855f7` - Secondary accent, elegance and creativity
- **Purple Light**: `#c084fc` - Lighter purple for interactive states

### Design Token System
These colors are implemented as Tailwind design tokens:
```
indique-dark: #1a1a1a
indique-darker: #0f0f0f
indique-gold: #d4af37
indique-gold-light: #f4a460
indique-purple: #a855f7
indique-purple-light: #c084fc
```

## Typography

### Font Family
- **Headings & Titles**: Playfair Display (serif) - Elegant, traditional, luxury
- **Body Text**: Inter (sans-serif) - Clean, modern, readable
- **Code/Monospace**: JetBrains Mono - Technical, precise

### Typography Scale
- **Main Title (D'Ai)**: 2.5rem, Playfair Display, 700 weight, letter-spacing 0.05em
- **Feature Labels**: 1.5rem, Playfair Display, 400 weight, letter-spacing 0.08em
- **Button Text**: 0.875rem, Inter, 600 weight, letter-spacing 0.05em
- **Body Text**: 0.95rem, Inter, 400 weight, line-height 1.7

## Layout Structure

### Header Section
- Centered title "D'Ai" within an ornate circular frame
- Navigation buttons (History, New Chat) on the right
- Gradient background with decorative line at top and bottom
- Gradient accent elements in corners

### Main Content Area
- Grid-based layout for feature cards (5 columns on desktop, responsive on mobile)
- Each card represents a content type: Image, Video, Code, Text, Music
- Cards are enclosed in ornate frames with multi-layered borders
- Generous spacing (gap-6) between cards for visual breathing room

### Input Area
- Ornate frame container with multi-layered border styling
- Rounded rectangle with corner ornaments
- Text input with serif font variant for elegance
- Arrow-right icon for send button (symbolic of forward motion)
- Decorative corner elements (input-corner-ornament) at all four corners

## Visual Elements

### Ornate Frames (`.ornate-frame`)
- Dual-layer border gradient (purple to gold)
- Background with subtle gradient
- Corner decorative elements (`.ornate-corner`)
- Hover effect: elevation, glow, border opacity increase
- Animation: `cubic-bezier(0.34, 1.56, 0.64, 1)` for bouncy feel
- Shadow: Dual inset and external glow

### Corner Ornaments
- Positioned at all four corners of frames
- Angled borders creating decorative effect
- Top-left & bottom-right: Gold (#d4af37)
- Top-right & bottom-left: Purple (#a855f7)
- Opacity transitions on hover

### Gradient Accents
- `.gradient-accent-tl`: Top-left radial gradient (purple)
- `.gradient-accent-br`: Bottom-right radial gradient (gold)
- Subtle, non-intrusive background decoration

### Decorative Dividers
- Gold gradient line with ornamental symbols (❦)
- Used to separate content sections
- Opacity: 0.6, positioned centrally

### Title Circle Frame
- Concentric circular borders around main title
- Inner circle (280px): Solid gold border
- Outer circle (320px): Purple dashed border
- Creates elegant focal point

## Interactive States

### Hover Effects
1. **Ornate Frames**:
   - Elevation: `translateY(-4px)`
   - Glow: `0 10px 40px rgba(168, 85, 247, 0.3)`
   - Border opacity increase to 0.8
   - Corner ornament opacity to 0.7

2. **Feature Buttons**:
   - Scale: 1.05
   - Color transition: #d4af37 → #f4e4c3
   - Text-shadow enhancement

3. **Input Area**:
   - Border gradient opacity: 0.4 → 0.7
   - Smooth color transition on text

### Animations
- **Shimmer**: Gold gradient sweep across elements (2s infinite)
- **Glow Pulse**: Box-shadow breathing effect (3s infinite)
- **Smooth Transitions**: 0.3-0.4s cubic-bezier easing

## Responsive Design

### Breakpoints
- **Mobile (< 640px)**: Single column layout for feature cards
- **Tablet (640px - 1024px)**: 2 columns for feature cards
- **Desktop (> 1024px)**: 5 columns for feature cards

## CSS Classes Reference

### Layout Classes
- `.indique-header` - Header with gold border and gradient
- `.indique-title` - Main D'Ai title styling
- `.indique-button` - Navigation buttons
- `.ornate-frame` - Card frame styling
- `.ornate-input-wrapper` - Input container styling

### Decorative Classes
- `.ornate-corner` - Corner ornament positioning
- `.corner-tl`, `.corner-tr`, `.corner-bl`, `.corner-br` - Corner variants
- `.gradient-accent-tl`, `.gradient-accent-br` - Background gradients
- `.ornate-divider` - Divider styling
- `.title-circle-frame` - Title circular frame

### Interactive Classes
- `.feature-button` - Feature card button styling
- `.shimmer` - Shimmer animation
- `.glow-pulse` - Glow animation

## Implementation Notes

1. **Z-index Management**: Pseudo-elements (::before, ::after) use z-index layering to create depth
2. **Pointer Events**: Decorative elements have `pointer-events: none` to prevent blocking interactions
3. **Performance**: Animations use `transform` and `opacity` for smooth 60fps performance
4. **Accessibility**: All interactive elements maintain proper contrast ratios (WCAG AA standard)

## Design Principles Applied

1. **Luxury & Elegance**: Gold and purple color scheme evokes high-end design
2. **Ornamental Detail**: Decorative corners and frames without overwhelming the interface
3. **Visual Hierarchy**: Gradients, shadows, and positioning guide user attention
4. **Balance**: Symmetric layouts with carefully spaced elements
5. **Interactivity Feedback**: Clear hover states and animations provide user feedback
6. **Cultural Inspiration**: South Asian design elements (circular frames, ornamental corners)

## Future Enhancements

- Animated botanical pattern SVGs in corners
- Parallax effects on gradient accents
- Dynamic color adjustments based on content type
- Micro-interactions on button press
- Loading state animations with ornate spinner
