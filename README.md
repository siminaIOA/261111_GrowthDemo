# 261111_GrowthDemo

A standalone interactive differential-growth experiment: seven seeded contours fill a 2D field under local repulsion, neighbour cohesion, and edge subdivision. Move the pointer to guide the nearest fold. Built as a static Vite site from the original `growth-demo` canvas (HTML, CSS, and ES modules) with no runtime libraries beyond the browser.

**[Live Demo](https://siminaioa.github.io/261111_GrowthDemo/)**

## Features

- Seven closed contours with independent thickness, curl, drift, pulse, and outward growth
- Local repulsion, neighbour cohesion, and long-edge subdivision (differential growth)
- Pointer guidance: move to attract the nearest contour; drag on touch screens
- Seeded random field with New seed / Reset replay
- Speed, Spacing, and Variation sliders
- Seed, point count, and step counters on the stage
- Reduced-motion pause when the OS prefers less animation
- GitHub Pages-ready production build with relative asset paths

## Getting Started

1. Clone the repository:
   ```
   git clone https://github.com/siminaIOA/261111_GrowthDemo.git
   cd 261111_GrowthDemo
   ```
2. Install dependencies:
   ```
   npm install
   ```
3. Start the development server:
   ```
   npm run dev
   ```
4. Open the local URL shown in the terminal (typically `http://localhost:5173/`).

## Controls

- **Grow / Pause / Resume** -- start or stop the simulation
- **New seed** -- start a different random field
- **Reset** -- replay the current seed with the current slider settings
- **Speed** -- playback rate (0.5×–3×)
- **Spacing** -- repulsion distance; smaller values produce finer folds
- **Variation** -- how strongly local growth rules differ across the field
- **Pointer** -- move over the canvas to guide the nearest contour; drag on touch
- **Mouse / scroll** -- read “Behind the form” below the hero for the three growth rules

## Deployment

### Build locally

```
npm run build
```

This produces a `dist/` folder with the production-ready site.

### Deploy to GitHub Pages

1. Build with relative paths:
   ```
   npx vite build --base=./ --outDir dist-gh-pages
   ```
2. Publish only the contents of `dist-gh-pages/` to the `gh-pages` branch.
3. In the GitHub repo, go to **Settings > Pages** and set the source to **Deploy from a branch** → `gh-pages` / `/ (root)`.
4. The live site URL is: **https://siminaioa.github.io/261111_GrowthDemo/**
