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
| Registration | Nudge station 2 in the corridor lesson | Corresponding geometry separates or coincides | This exercise changes two translations and yaw. Real rigid registration has six degrees of freedom. |

## Suggested assessment

Ask learners to submit a completed XYZ cloud and explain their station placement. Require an explanation of one remaining shadow, the expected point spacing at a chosen range, and why the reported visibility percentage does not equal survey completeness.

Before exporting, finish any active alignment exercise and wait for a completed scan. When importing, set units to metres, map the first three columns to X/Y/Z, and account for the Y-up convention.

## Interpretation checks

- The introduction's scanner body suppresses measurements in its downward blind cone; points belong on the surrounding surfaces.
- An opaque foreground object remains the first hit even when its return is rejected by the incidence threshold. The laser does not pass through it to acquire a background point.
- Visibility estimates do not change with angular resolution, because they measure potential line of sight on an independent probe grid.
- Noise and grazing dropout use random samples, so consecutive point counts can differ slightly.
- “Show correct alignment” demonstrates a stored answer. Do not teach it as a working ICP implementation.
