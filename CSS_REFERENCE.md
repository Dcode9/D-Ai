# Indique CSS Reference Guide

Complete CSS specifications and code examples for the D'Ai Indique design system.

## Table of Contents

1. [Color Variables](#color-variables)
2. [Typography](#typography)
3. [Component Styles](#component-styles)
4. [Animations](#animations)
5. [Utility Classes](#utility-classes)

---

## Color Variables

### Tailwind Config Extension

```javascript
// tailwind.config.js
theme: {
    extend: {
        colors: {
            indique: {
                'dark': '#1a1a1a',
                'darker': '#0f0f0f',
                'gold': '#d4af37',
                'gold-light': '#f4a460',
                'purple': '#a855f7',
                'purple-light': '#c084fc',
                'accent': '#e0a82d'
            }
        }
    }
}
```

### Color Usage Examples

```css
/* Background */
background: linear-gradient(135deg, #0a0a0a 0%, #050505 50%, #0f0f0f 100%);

/* Text */
color: #d4af37;          /* Gold primary */
color: #f4e4c3;          /* Cream (lighter variant) */
color: #c084fc;          /* Purple light */

/* Borders */
border-color: #d4af37;   /* Gold */
border-color: #a855f7;   /* Purple */

/* Shadows */
box-shadow: 0 0 30px rgba(168, 85, 247, 0.4);  /* Purple glow */
box-shadow: inset 0 0 20px rgba(212, 175, 55, 0.15);  /* Gold inset */
```

---

## Typography

### Font Imports

```html
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&display=swap" rel="stylesheet">
```

### Tailwind Font Configuration

```javascript
theme: {
    extend: {
        fontFamily: {
            sans: ['Inter'],
            serif: ['Playfair Display'],
            mono: ['JetBrains Mono']
        }
    }
}
```

### Typography Examples

```css
/* Main Title */
.indique-title {
    font-family: 'Playfair Display', serif;
    font-size: 2.5rem;
    font-weight: 700;
    color: #f4e4c3;
    letter-spacing: 0.05em;
    text-shadow: 0 2px 10px rgba(212, 175, 55, 0.3);
}

/* Feature Button Text */
.feature-button {
    font-family: 'Playfair Display', serif;
    font-size: 1.5rem;
    color: #d4af37;
    font-weight: 400;
    letter-spacing: 0.08em;
    text-shadow: 0 2px 8px rgba(212, 175, 55, 0.3);
}

/* Body Text */
.description {
    font-family: 'Inter', sans-serif;
    font-size: 1rem;
    color: #c084fc;
    line-height: 1.6;
}

/* Code Text */
code {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.85rem;
    color: #f4a460;
}
```

---

## Component Styles

### 1. Ornate Frame

The signature component that wraps feature cards and content areas.

```css
.ornate-frame {
    position: relative;
    background: linear-gradient(135deg, rgba(26, 26, 26, 0.95) 0%, rgba(15, 15, 15, 0.98) 100%);
    border: 2px solid transparent;
    border-radius: 16px;
    padding: 3px;
    overflow: visible;
    transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    box-shadow: inset 0 0 20px rgba(212, 175, 55, 0.08);
}

/* Border gradient */
.ornate-frame::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, 
        #a855f7 0%, 
        #d4af37 25%, 
        #a855f7 50%, 
        #d4af37 75%, 
        #a855f7 100%);
    border-radius: 14px;
    opacity: 0.5;
    z-index: 0;
    transition: all 0.4s ease;
    pointer-events: none;
}

/* Inner background */
.ornate-frame::after {
    content: '';
    position: absolute;
    inset: 3px;
    background: linear-gradient(135deg, rgba(26, 26, 26, 0.98) 0%, rgba(15, 15, 15, 0.99) 100%);
    border-radius: 12px;
    z-index: 1;
    pointer-events: none;
}

/* Hover state */
.ornate-frame:hover {
    transform: translateY(-4px);
    box-shadow: inset 0 0 30px rgba(212, 175, 55, 0.15), 
                0 10px 40px rgba(168, 85, 247, 0.3);
}

.ornate-frame:hover::before {
    opacity: 0.8;
}
```

### HTML Structure

```html
<div class="ornate-frame group">
    <div class="ornate-corner corner-tl"></div>
    <div class="ornate-corner corner-tr"></div>
    <div class="ornate-corner corner-bl"></div>
    <div class="ornate-corner corner-br"></div>
    <div class="relative z-10 p-6 flex flex-col items-center justify-center">
        <div class="feature-button">🖼️</div>
        <div class="feature-button">Image</div>
    </div>
</div>
```

### 2. Corner Ornaments

Decorative corner elements that frame feature cards.

```css
.ornate-corner {
    position: absolute;
    width: 35px;
    height: 35px;
    opacity: 0.3;
    transition: all 0.3s ease;
    z-index: 3;
}

.ornate-frame:hover .ornate-corner {
    opacity: 0.7;
}

/* Top-left corner: Gold */
.corner-tl {
    top: -10px;
    left: -10px;
    border-top: 3px solid #d4af37;
    border-left: 3px solid #d4af37;
    border-radius: 25px 0 0 0;
}

/* Top-right corner: Purple */
.corner-tr {
    top: -10px;
    right: -10px;
    border-top: 3px solid #a855f7;
    border-right: 3px solid #a855f7;
    border-radius: 0 25px 0 0;
}

/* Bottom-left corner: Purple */
.corner-bl {
    bottom: -10px;
    left: -10px;
    border-bottom: 3px solid #a855f7;
    border-left: 3px solid #a855f7;
    border-radius: 0 0 0 25px;
}

/* Bottom-right corner: Gold */
.corner-br {
    bottom: -10px;
    right: -10px;
    border-bottom: 3px solid #d4af37;
    border-right: 3px solid #d4af37;
    border-radius: 0 0 25px 0;
}
```

### 3. Navigation Buttons

Elegant buttons with gradient backgrounds and smooth interactions.

```css
.indique-button {
    position: relative;
    font-family: 'Inter', sans-serif;
    font-weight: 600;
    background: linear-gradient(135deg, 
        rgba(168, 85, 247, 0.12) 0%, 
        rgba(212, 175, 55, 0.1) 100%);
    border: 2px solid #d4af37;
    color: #d4af37;
    padding: 0.7rem 1.4rem;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    overflow: hidden;
    font-size: 0.875rem;
    letter-spacing: 0.05em;
}

.indique-button::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(168, 85, 247, 0.25), transparent);
    transition: left 0.6s ease;
    z-index: -1;
}

.indique-button:hover {
    border-color: #f4e4c3;
    box-shadow: 0 8px 25px rgba(168, 85, 247, 0.35), 
                inset 0 0 15px rgba(212, 175, 55, 0.12);
    transform: translateY(-2px);
    color: #f4e4c3;
}

.indique-button:hover::before {
    left: 100%;
}
```

### 4. Header

Main header with centered title and navigation.

```css
.indique-header {
    background: linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 50%, #1a1a1a 100%);
    border-bottom: 2px solid #d4af37;
    position: relative;
    overflow: hidden;
}

.indique-header::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.5), transparent);
}

.title-circle-frame {
    position: relative;
    display: inline-block;
    padding: 2rem;
}

.title-circle-frame::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 280px;
    height: 280px;
    border: 2px solid #d4af37;
    border-radius: 50%;
    opacity: 0.4;
    box-shadow: inset 0 0 20px rgba(212, 175, 55, 0.2);
}

.title-circle-frame::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 320px;
    height: 320px;
    border: 1px solid rgba(168, 85, 247, 0.3);
    border-radius: 50%;
    opacity: 0.3;
}
```

### 5. Ornate Input Field

Special styled input container with corner ornaments.

```css
.ornate-input-wrapper {
    position: relative;
    background: linear-gradient(135deg, rgba(26, 26, 26, 0.9) 0%, rgba(15, 15, 15, 0.95) 100%);
    border: 3px solid transparent;
    border-radius: 25px;
    padding: 2px;
    transition: all 0.3s ease;
    box-shadow: 0 0 30px rgba(0, 0, 0, 0.8);
}

.ornate-input-wrapper::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, 
        #a855f7 0%, 
        #d4af37 50%, 
        #a855f7 100%);
    border-radius: 23px;
    opacity: 0.4;
    z-index: -1;
    transition: opacity 0.3s ease;
}

.ornate-input-wrapper:hover::before,
.ornate-input-wrapper:focus-within::before {
    opacity: 0.7;
}

.ornate-input-wrapper::after {
    content: '';
    position: absolute;
    inset: 3px;
    background: linear-gradient(135deg, rgba(26, 26, 26, 0.95) 0%, rgba(15, 15, 15, 0.98) 100%);
    border-radius: 22px;
    z-index: -1;
}

/* Corner ornaments */
.input-corner-tl {
    top: 8px; left: 8px;
    border-top: 2px solid #a855f7;
    border-left: 2px solid #a855f7;
    border-radius: 8px 0 0 0;
}

.input-corner-tr {
    top: 8px; right: 8px;
    border-top: 2px solid #d4af37;
    border-right: 2px solid #d4af37;
    border-radius: 0 8px 0 0;
}

.input-corner-bl {
    bottom: 8px; left: 8px;
    border-bottom: 2px solid #d4af37;
    border-left: 2px solid #d4af37;
    border-radius: 0 0 0 8px;
}

.input-corner-br {
    bottom: 8px; right: 8px;
    border-bottom: 2px solid #a855f7;
    border-right: 2px solid #a855f7;
    border-radius: 0 0 8px 0;
}
```

### 6. Gradient Accents

Subtle background decorations for visual depth.

```css
.gradient-accent-tl {
    position: absolute;
    top: 0;
    left: 0;
    width: 200px;
    height: 200px;
    background: radial-gradient(circle at top-left, 
        rgba(168, 85, 247, 0.15) 0%, 
        transparent 70%);
    pointer-events: none;
    border-radius: 0 0 200px 0;
}

.gradient-accent-br {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 200px;
    height: 200px;
    background: radial-gradient(circle at bottom-right, 
        rgba(212, 175, 55, 0.15) 0%, 
        transparent 70%);
    pointer-events: none;
    border-radius: 200px 0 0 0;
}
```

### 7. Ornate Divider

Decorative divider with symbols.

```css
.ornate-divider {
    height: 2px;
    background: linear-gradient(90deg, transparent, #d4af37, transparent);
    margin: 1rem 0;
    opacity: 0.6;
    position: relative;
}

.ornate-divider::before,
.ornate-divider::after {
    content: '❦';
    position: absolute;
    top: -10px;
    font-size: 1.2rem;
    color: #d4af37;
    opacity: 0.4;
}

.ornate-divider::before { left: 50%; transform: translateX(-50%); }
```

---

## Animations

### Shimmer Effect

Gold gradient sweep animation for interactive elements.

```css
@keyframes shimmer-gold {
    0% { background-position: -1000px 0; }
    100% { background-position: 1000px 0; }
}

.shimmer {
    background: linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.3), transparent);
    background-size: 1000px 100%;
    animation: shimmer-gold 2s infinite;
}
```

### Glow Pulse Effect

Breathing glow animation for emphasis.

```css
@keyframes glow-pulse {
    0%, 100% { box-shadow: 0 0 20px rgba(168, 85, 247, 0.3); }
    50% { box-shadow: 0 0 40px rgba(168, 85, 247, 0.6); }
}

.glow-pulse {
    animation: glow-pulse 3s ease-in-out infinite;
}
```

### Slide Up Fade

Entrance animation for content.

```css
@keyframes slideUpFade {
    from {
        opacity: 0;
        transform: translateY(10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.msg-appear {
    animation: slideUpFade 0.3s cubic-bezier(0.2, 0.9, 0.4, 1) forwards;
}
```

---

## Utility Classes

### Quick Apply Classes

```css
/* Text Colors */
.text-indique-gold { color: #d4af37; }
.text-indique-gold-light { color: #f4a460; }
.text-indique-purple { color: #a855f7; }
.text-indique-purple-light { color: #c084fc; }

/* Background Colors */
.bg-indique-dark { background-color: #1a1a1a; }
.bg-indique-darker { background-color: #0f0f0f; }

/* Border Colors */
.border-indique-gold { border-color: #d4af37; }
.border-indique-purple { border-color: #a855f7; }

/* Box Shadows */
.shadow-ornate {
    box-shadow: 0 0 40px rgba(168, 85, 247, 0.25), 
                inset 0 0 20px rgba(212, 175, 55, 0.1);
}

.shadow-ornate-hover {
    box-shadow: 0 0 60px rgba(168, 85, 247, 0.4), 
                inset 0 0 30px rgba(212, 175, 55, 0.15);
}
```

---

## Responsive Patterns

### Feature Grid Layout

```html
<!-- Responsive grid: 1 col → 2 cols → 5 cols -->
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
    <!-- Card items -->
</div>
```

### Header Layout

```html
<header class="flex items-center justify-between px-6 py-6">
    <button></button>
    <div class="title-circle-frame">
        <h1 class="indique-title">D'Ai</h1>
    </div>
    <div class="flex gap-3">
        <button class="indique-button">History</button>
        <button class="indique-button">New Chat</button>
    </div>
</header>
```

---

## Performance Tips

1. **Use `transform` for animations** - GPU-accelerated, smooth performance
2. **Use `opacity` for visibility** - High performance transitions
3. **Avoid `box-shadow` in animations** - Use sparingly in keyframes
4. **Set `will-change` on animated elements** - Hint to browser for optimization
5. **Use `pointer-events: none` on decorative pseudo-elements** - Prevent interaction overhead

---

## Browser Support

- Chrome/Edge: 88+
- Firefox: 85+
- Safari: 14+
- Mobile: iOS Safari 14+, Chrome Android 88+

All CSS features used are supported by modern browsers without vendor prefixes.

---

**Last Updated**: May 2026
**Version**: 1.0
