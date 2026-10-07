// Analytic intersections for normalized rays. Both roots and all caps are
// considered so rays originating inside a solid still hit its exit surface.
export function intersectSolid(c, o, d) {
  const eps = 1e-4;
  if (c.kind === 0) {
    let near = -Infinity, far = Infinity, nearN, farN;
    for (const axis of ['x', 'y', 'z']) {
      if (Math.abs(d[axis]) < 1e-12) {
        if (o[axis] < c['min' + axis] || o[axis] > c['max' + axis]) return null;
        continue;
      }
      let a = (c['min' + axis] - o[axis]) / d[axis];
      let b = (c['max' + axis] - o[axis]) / d[axis];
      const sign = d[axis] > 0 ? -1 : 1;
      if (a > b) [a, b] = [b, a];
      const normal = s => ({x: axis === 'x' ? s : 0, y: axis === 'y' ? s : 0, z: axis === 'z' ? s : 0});
      if (a > near) { near = a; nearN = normal(sign); }
      if (b < far) { far = b; farN = normal(-sign); }
      if (near > far) return null;
    }
    if (near > eps) return {t: near, ...nearN};
    return far > eps && Number.isFinite(far) ? {t: far, ...farN} : null;
  }
  const fx = o.x - c.cx, fz = o.z - c.cz;
  const fy = c.kind === 2 ? o.y - c.cy : 0;
  const a = d.x*d.x + d.z*d.z + (c.kind === 2 ? d.y*d.y : 0);
  const b = 2*(fx*d.x + fz*d.z + fy*d.y);
  const cc = fx*fx + fz*fz + fy*fy - c.r*c.r;
  const disc = b*b - 4*a*cc;
  let hit = null;
  if (a > 1e-12 && disc >= 0) {
    for (const t of [(-b-Math.sqrt(disc))/(2*a), (-b+Math.sqrt(disc))/(2*a)]) {
      const y = o.y + d.y*t;
      if (t > eps && (!hit || t < hit.t) && (c.kind === 2 || (y >= (c.y0 || 0) && y <= c.y1)))
        hit = {t, x: (fx+d.x*t)/c.r, y: c.kind === 2 ? (fy+d.y*t)/c.r : 0, z: (fz+d.z*t)/c.r};
    }
  }
  if (c.kind === 1 && Math.abs(d.y) > 1e-12) {
    for (const [y, normal] of [[c.y0 || 0,-1],[c.y1,1]]) {
      const t = (y-o.y)/d.y;
      if (t > eps && (!hit || t < hit.t) && (fx+d.x*t)**2 + (fz+d.z*t)**2 <= c.r*c.r)
        hit = {t, x:0, y:normal, z:0};
    }
  }
  return hit;
}
