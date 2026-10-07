# Validation record

Validation environment: Windows, Chromium 141 through Playwright, WebGL via software rendering. The source tests use the development server; standalone tests open `LaserScan-Lab.html` through `file://` with browser networking disabled and reject any HTTP request.

The release build was tested on 7 October 2026. All 11 standalone tests passed, including every scene and lesson plus offline export. The source checks cover 19 scenarios, with two additional point-limit/WebGL checks and seven responsive-layout checks (320–1440 px). Dependency audit reported zero vulnerabilities. Tests were run in focused groups while repairing issues; see the commands below to run the complete suite together.

## Regression coverage

| Area | Checks |
| --- | --- |
| Introductory scanner | All four steps, time-of-flight pulse, reset, room switching; recorded points lie on the room shell, not on the scanner |
| Scenes | Empty room, columns, office, two rooms with corridor |
| Lessons | Resolution, noise, occlusion, placement, targets, registration lab |
| Ray casting | Nearest hit on wall, column, sphere and table; unobstructed space under table; doorway passage; self-scanner exclusion; rays starting inside solids; tangents, caps and parallel misses |
| Coverage | Unobstructed full-FOV baseline; grazing-angle probes; wall occlusion; second-station recovery |
| Scan state | Edits invalidate captured data, station removal during scanning, auto-rescan disabled, partial stop, invalid scanner origin |
| Display | Orbit, top and scanner views; four color modes; laser and gap switches; range control endpoints |
| Interaction | Tripod drag via real pointer events; add/remove/clear objects; three-station limit; keyboard-operated switches; mobile viewport |
| Registration | Three shared targets in corridor preset, manual nudge, reveal alignment, block premature completion, finish exercise |
| Export | Download completed XYZ; validate row count, six columns, finite coordinates and RGB bounds |
| Resources | Repeated preset and height changes release old GPU geometry |
| Limits | 1,200,000-point cap with three high-resolution stations; actionable missing-WebGL message |
| Offline delivery | Direct-file startup, pulse animation, scan/export, all four scenes and all six lessons, zero HTTP requests |

Run `npm run build` followed by `npm test` to reproduce. Browser screenshots and failure traces are written to the ignored `test-results/` directory. The browser diagnostic interface exists only on the development server with `?test=1`; it is absent from the standalone release.

## Fixes and corrections

- Removed introductory self-returns from the pedestal and suppressed emission in the downward blind cone.
- Canceled outdated scans and cleared misleading coverage when settings or geometry change.
- Repaired intersections for inside-origin rays, cylinder caps and tangential hits.
- Corrected coverage comparisons for probes inset from surfaces at grazing angles.
- Added origin validation, footprint-aware object bounds, GPU resource disposal, and early stop at the point cap.
- Hid the active scanner housing in scanner-camera view and suppressed false hit markers at the range limit.
- Reported shared targets separately for each station pair and checked actual target identity.
- Renamed the simulated alignment action so it does not claim to run ICP; prevented export of incomplete scans or unfinished alignment exercises.
- Added accessible switches, input labels, clearer scan status, mobile layout refinements and training material.
- Bundled all runtime dependencies into one offline HTML file and retained Three.js licensing information.

## Scope limits

Passing these checks does not establish scientific equivalence to a real scanner. The limitations in README.md and the in-app guide remain intentional. Physical touchscreen hardware, Safari, Firefox, GPU-driver-specific behavior and external XYZ importers have not been validated in this environment. Mobile checks use a resized Chromium viewport. Random noise and dropout mean captured point counts can vary between runs.
