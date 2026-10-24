import test from 'node:test';
import assert from 'node:assert/strict';
import { quantumGeometryToScale } from '../src/bridge/quantum-geometry.mjs';
import { CONE, heat } from '../src/bridge/great-scale.mjs';
function close(a,b,t=1e-10){assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);}

test('zero curvature maps to maximum heat',()=>{const r=quantumGeometryToScale({g11:1,g12:0,g22:1,curvature:0});close(r.curvatureFraction,0);close(r.h,.5);close(r.S,.25);close(r.S,heat(r.h));close(r.normalizedResidual,1);close(r.psi,CONE+.25);});
test('saturation maps to cone floor',()=>{const r=quantumGeometryToScale({g11:1,g12:0,g22:1,curvature:2});close(r.curvatureFraction,1);close(r.h,1);close(r.S,0);close(r.normalizedResidual,0);close(r.detQ,0);close(r.psi,CONE);close(r.cone,.38196601125,1e-10);});
test('intermediate curvature encodes normalized residual',()=>{const r=quantumGeometryToScale({g11:1,g12:0,g22:1,curvature:1});close(r.detQ,.75);close(r.normalizedResidual,.75);close(r.S,.1875);close(r.S,r.normalizedResidual/4);});
test('normalized map invariant under common scaling',()=>{const a=quantumGeometryToScale({g11:1,g12:0,g22:1,curvature:1}),b=quantumGeometryToScale({g11:4,g12:0,g22:4,curvature:4});close(a.curvatureFraction,b.curvatureFraction);close(a.S,b.S);});
test('scalar heat discards curvature sign but diagnostic preserves it',()=>{const a=quantumGeometryToScale({g11:1,g12:0,g22:1,curvature:1}),b=quantumGeometryToScale({g11:1,g12:0,g22:1,curvature:-1});close(a.S,b.S);close(a.signedCurvature,1);close(b.signedCurvature,-1);});
test('metric eigenvalues preserve anisotropy at equal determinant',()=>{const a=quantumGeometryToScale({g11:1,g12:0,g22:1,curvature:0}),b=quantumGeometryToScale({g11:4,g12:0,g22:.25,curvature:0});close(a.detG,b.detG);close(a.S,b.S);close(a.metricAnisotropy,1);close(b.metricAnisotropy,.0625);close(b.metricEigenvalues[0],.25);close(b.metricEigenvalues[1],4);});
test('qutrit family has nonzero metric area at zero curvature',()=>{const x=.3,y=.4,s=1+x*x+y*y,g11=(1+y*y)/(s*s),g12=-x*y/(s*s),g22=(1+x*x)/(s*s),r=quantumGeometryToScale({g11,g12,g22,curvature:0});close(r.detG,1/(s*s*s));close(r.detQ,r.detG);close(r.normalizedResidual,1);close(r.S,.25);});
test('pure-qubit Bloch sphere saturates QGT bound',()=>{const t=.7,r=quantumGeometryToScale({g11:.25,g12:0,g22:Math.sin(t)**2/4,curvature:Math.sin(t)/2});close(r.detG,Math.sin(t)**2/16);close(r.detQ,0,1e-12);close(r.curvatureFraction,1);close(r.S,0);close(r.psi,CONE);});
test('rejects QGT positivity violation',()=>assert.throws(()=>quantumGeometryToScale({g11:1,g12:0,g22:1,curvature:2.01}),/QGT positivity violated/));
test('rejects degenerate metric',()=>assert.throws(()=>quantumGeometryToScale({g11:1,g12:1,g22:1,curvature:0}),/positive and nondegenerate/));
test('rejects negative-definite metric',()=>assert.throws(()=>quantumGeometryToScale({g11:-1,g12:0,g22:-1,curvature:0}),/diagonal entries must be positive/));
test('rejects zero diagonal metric',()=>assert.throws(()=>quantumGeometryToScale({g11:0,g12:0,g22:1,curvature:0}),/diagonal entries must be positive/));

test('bridge scalar is invariant at extreme common scales and avoids determinant underflow',()=>{
 const base=quantumGeometryToScale({g11:1,g12:0,g22:1,curvature:1});
 const tiny=quantumGeometryToScale({g11:1e-200,g12:0,g22:1e-200,curvature:1e-200});
 close(tiny.curvatureFraction,base.curvatureFraction); close(tiny.S,base.S);
 assert.ok(tiny.metricEigenvalues.every(Number.isFinite)); close(tiny.metricEigenvalues[0]/1e-200,1); close(tiny.metricEigenvalues[1]/1e-200,1);
 const huge=quantumGeometryToScale({g11:1e200,g12:0,g22:1e200,curvature:1e200});
 close(huge.curvatureFraction,base.curvatureFraction); close(huge.S,base.S);
 assert.ok(huge.metricEigenvalues.every(Number.isFinite)); close(huge.metricEigenvalues[0]/1e200,1); close(huge.metricEigenvalues[1]/1e200,1);
});
