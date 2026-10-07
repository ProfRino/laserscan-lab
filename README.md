# LaserScan Lab

[![Validate](https://github.com/ProfRino/laserscan-lab/actions/workflows/ci.yml/badge.svg)](https://github.com/ProfRino/laserscan-lab/actions/workflows/ci.yml)
[![Offline application](https://img.shields.io/badge/Offline-single%20HTML%20file-1f5b96)](https://github.com/ProfRino/laserscan-lab/raw/refs/heads/main/LaserScan-Lab.html)

LaserScan Lab is an interactive **terrestrial laser scanning training simulator** for the browser. Follow a laser pulse, watch a spinning mirror build a point cloud, and experiment with resolution, noise, occlusion, scanner placement and registration.

The application runs from **one self-contained HTML file**. No installation, no server, no account, and no internet connection are needed. Three.js, the interface and all scene geometry are included.

<img src="assets/demo.png" alt="LaserScan Lab showing a scanned room, tripod, furniture and the resulting point cloud" width="100%">

> **Educational model:** this application demonstrates scanning principles. It is not a calibrated instrument simulator or a real ICP registration solver.

## Project lead

<a href="https://github.com/ProfRino">
  <img src="https://github.com/ProfRino.png?size=100" width="100" alt="Prof Rino Lovreglio"><br>
  <strong>Prof Rino Lovreglio</strong>
</a><br>
Massey University

## Features

* **How a scanner works.** Four animated steps explain the spinning mirror, round-trip time of flight, vertical profiles and horizontal rotation.
* **Four room scenarios.** Explore an empty room, structural columns, a furnished office, or two rooms connected by a corridor.
* **Six guided lessons.** Investigate resolution, noise, occlusion, placement, reference targets and a registration exercise.
* **Interactive settings.** Change horizontal and vertical sampling, range, range noise, incidence cutoff, vertical field of view and scanner height.
* **Occlusion and blind spots.** Walls, columns, boxes, table tops and target spheres produce nearest-surface returns and scan shadows. Moving a station changes what it can see.
* **Multiple stations.** Position up to three tripods, color returns by station, compare room-shell visibility and overlap, and inspect shared targets for each station pair.
* **Registration exercise.** Manually align a displaced scan using translation and yaw, or reveal the known solution. The exercise does not run ICP.
* **Point-cloud display.** Switch between orbit, top and scanner views; hide solid geometry; color points by range, incidence, station or a single color; highlight potential coverage gaps.
* **XYZ export.** Download completed clouds as ASCII `x y z r g b`, with coordinates in metres, Y up, and RGB values from 0 to 255. Storage is capped at 1,200,000 points.
* **Offline delivery.** All runtime code is bundled locally. The downloadable application makes no HTTP requests.

## How to use it

### Download and double-click

1. Download **[LaserScan-Lab.html](https://github.com/ProfRino/laserscan-lab/raw/refs/heads/main/LaserScan-Lab.html)** and save it on your computer.
2. Double-click the file to open it in a browser with JavaScript and WebGL enabled.
3. Follow **How it works**, then switch to **Room scan** and try the lessons.

If the link displays source instead of downloading it, use **Save link as...** or download the repository ZIP and open `LaserScan-Lab.html` from the extracted folder. The development entry point, `index.html`, requires the optional developer server. The standalone file does not.

### Controls

| Action | Control |
| --- | --- |
| Orbit | Drag empty space |
| Pan | Right-drag; in Top view, drag empty space |
| Zoom | Mouse wheel; two-finger pinch on touch screens |
| Move a station or obstacle | Drag the tripod or object |
| Touch navigation | One finger to orbit, two fingers to pan and zoom |
| Show mobile controls | Use the menu button |

Changes invalidate the previous cloud. Enable **Auto-rescan on change** to rebuild it automatically, or press **Scan** when ready. A scanner origin placed inside an obstacle is rejected with a message.

## Teaching sequence

1. **Time of flight:** explain why distance is half the speed of light multiplied by round-trip time.
2. **Resolution:** halve both angular steps and compare the increase in emitted samples.
3. **Noise:** compare zero noise with exaggerated range noise on a flat wall.
4. **Occlusion:** identify missing surfaces behind a wall and beneath a table. Explain why finer sampling cannot recover a blocked view.
5. **Placement:** add a station on the other side of an obstruction and compare visibility and overlap.
6. **Registration:** inspect shared targets and align station 2 in the corridor exercise.

See **[TRAINING.md](TRAINING.md)** for facilitator notes, expected observations and assessment suggestions.

## Model limitations

* Geometry uses single nearest returns from axis-aligned boxes, cylinders, spheres and the room shell. Other scanners are approximate cylindrical occluders.
* Noise is random Gaussian range error scaled by distance and incidence. Grazing returns have probabilistic dropout. Reflectivity, glass transmission, mixed pixels, multipath and atmospheric effects are not modeled.
* Coverage estimates geometric visibility on a 0.5 m grid over the outer room shell. It does not measure actual point density, furniture coverage or internal-wall surface area.
* Shared targets indicate center-line visibility, not successful sphere fitting or registration quality. Each target-based registration link needs sufficient non-collinear targets.
* **Show correct alignment** reveals a known translation and yaw. It does not solve arbitrary six-degree-of-freedom registration.
* A capped cloud can underrepresent later stations. Partial scans and unfinished alignment exercises cannot be exported.

## For developers

Use Node.js 22 or newer:

```sh
git clone https://github.com/ProfRino/laserscan-lab.git
cd laserscan-lab
npm ci
npm start
npm run build
npx playwright install chromium
npm test
```

`npm start` launches an optional development server. `npm run build` regenerates the offline HTML and creates `dist/` for optional web hosting.

The GitHub Actions validation workflow builds the application and runs browser and geometry tests. Tests include direct file loading with networking disabled, all scenes and lessons, occlusion cases, export, resource disposal, the point cap and responsive layouts. See **[VALIDATION.md](VALIDATION.md)** for scope and platform limits.

```text
LaserScan-Lab.html        Ready-to-open offline application
index.html               Development UI and teaching content
src/app.js               Rendering, scan engine, controls and lessons
src/intersections.js     Analytic ray/solid intersections
src/styles.css           Responsive interface styles
scripts/standalone.cjs   Single-file packaging and syntax validation
tests/                   Browser and geometry regression tests
assets/demo.png          Application screenshot
.github/workflows/       Validation and optional Pages deployment
```

To enable GitHub Pages, select **GitHub Actions** as the repository's Pages source, then run **Deploy Pages**. Hosting is optional. The downloaded HTML remains fully offline.

## Stack

[Three.js](https://threejs.org/) r128 for rendering, [Vite](https://vite.dev/) for bundling, and [Playwright](https://playwright.dev/) for automated checks. Only the bundled application is needed by learners.

## Citation

If you reference this work, please cite:

> Lovreglio, R. *LaserScan Lab*. Massey University.
> https://github.com/ProfRino/laserscan-lab

A machine-readable [`CITATION.cff`](CITATION.cff) is included for GitHub's **Cite this repository** feature.

## License

A project license has not yet been selected. Bundled Three.js retains its MIT license; see [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt). Its notice is also embedded in the standalone HTML.
