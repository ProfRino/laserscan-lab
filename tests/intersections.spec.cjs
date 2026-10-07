const {test,expect}=require('@playwright/test');
test('intersection edge cases: inside solids, tangent, caps, parallel misses',async()=>{
  const {intersectSolid:hit}=await import('../src/intersections.js');
  const box={kind:0,minx:-1,maxx:1,miny:0,maxy:2,minz:-1,maxz:1};
  const cyl={kind:1,cx:0,cz:0,r:1,y1:2};
  const sphere={kind:2,cx:0,cy:1,cz:0,r:1};
  for(const shape of [box,cyl,sphere]) expect(hit(shape,{x:0,y:1,z:0},{x:1,y:0,z:0}).t).toBeCloseTo(1);
  expect(hit(box,{x:2,y:1,z:0},{x:0,y:0,z:1})).toBeNull();
  expect(hit(cyl,{x:0,y:3,z:0},{x:0,y:-1,z:0})).toEqual({t:1,x:0,y:1,z:0});
  expect(hit(cyl,{x:0,y:-1,z:0},{x:0,y:1,z:0})).toEqual({t:1,x:0,y:-1,z:0});
  expect(hit(sphere,{x:1,y:1,z:-3},{x:0,y:0,z:1}).t).toBeCloseTo(3);
  expect(hit(cyl,{x:1,y:1,z:-3},{x:0,y:0,z:1}).t).toBeCloseTo(3);
});
