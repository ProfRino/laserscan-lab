# Facilitator guide

Allow approximately 30–45 minutes. Learners should finish able to distinguish sampling, uncertainty, line-of-sight loss, and registration.

| Exercise | Experiment | Expected observation | Discussion |
| --- | --- | --- | --- |
| Time of flight | Fire one pulse in introduction step 2 | The return produces one measurement; distance is half light speed multiplied by round-trip time | Why divide by two? Animation time is deliberately exaggerated. |
| Resolution | Halve horizontal and vertical steps | More emitted samples; denser surfaces | Halving one step gives roughly twice the samples; halving both gives roughly four times. |
| Range limit | Reduce maximum range to 4 m | Distant surfaces disappear | A cutoff is not an obstacle; moving closer can recover returns. |
| Noise | Compare zero and high noise | Walls become thicker in the cloud | More points do not remove systematic errors; this model includes random range noise only. |
| Occlusion | Inspect behind a wall and beneath a table | Hidden surfaces have no returns | Does a finer angular grid help? No; move the station. |
| Incidence | Lower the incidence cutoff | Grazing-angle surfaces lose returns | Angles are measured from the surface normal. |
| Blind cone | Change vertical FOV and scanner height | The unmeasured floor region changes | Raising the optical origin enlarges the floor gap for the same blind-cone angle. |
| Multiple stations | Add a station on the other side of an obstacle | Station colors expose complementary coverage | Compare visibility and overlap; watch for the global point cap. |
| Target visibility | Move a target behind an internal wall | Shared counts decrease for affected station pairs | Three visible centers alone do not prove a stable fit; target spacing and non-collinearity matter. |
| Reference targets | Scan each room and the corridor in sequence | Shared balls connect adjacent scans | Keep targets fixed until both adjacent scans have been captured. |
| Last room | Move the scanner to the final room and scan | The third cloud joins the existing survey | The two rooms need not share targets directly. |

## Suggested assessment

Ask learners to submit a completed XYZ cloud and explain their station placement. Require an explanation of one remaining shadow, the expected point spacing at a chosen range, and why the reported visibility percentage does not equal survey completeness.

Before exporting, finish the three-scan survey and wait for a completed scan. When importing, set units to metres, map the first three columns to X/Y/Z, and account for the Y-up convention.

## Interpretation checks

Station tripods represent different times in a sequential survey. They are not simultaneous obstacles. Only the active instrument is shown during acquisition.

The multi-room lesson scans the left room, corridor, and right room in sequence. Three fixed reference balls at each doorway link adjacent scans. Previous clouds remain unchanged. There are no artificial offsets or manual alignment exercises.

The corridor exercise supplies six targets before scanning, three at each doorway. Keep each target set fixed until both scans using it have been acquired. Moving a target between those scans breaks correspondence. The exercise uses spare targets instead of relocating already-observed targets; manual target edits invalidate the prior cloud and restart measurement.

- The introduction's scanner body suppresses measurements in its downward blind cone; points belong on the surrounding surfaces.
- An opaque foreground object remains the first hit even when its return is rejected by the incidence threshold. The laser does not pass through it to acquire a background point.
- Visibility estimates do not change with angular resolution, because they measure potential line of sight on an independent probe grid.
- Noise and grazing dropout use random samples, so consecutive point counts can differ slightly.
- The clouds use known simulated coordinates. The lesson teaches target correspondence, not a fitted registration solver.
- The six floor balls are spread across the doorways. In field work, targets at varied heights can further strengthen the registration geometry.
