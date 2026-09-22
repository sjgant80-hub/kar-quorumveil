import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as K from './kernel.mjs';

// Mutation-gate round 3. Survivors addressed:
//   line 19  `> 0` → `>= 0`      — killed: empty-vector tests (maskShare + unveil)
//   line 26  `n < 2` → `n <= 2`  — killed: n=2 boundary pinned CLEAN
//   line 27  `dim < 1` → `<= 1`  — killed: dim=1 boundary pinned CLEAN
//   line 27  `||` → `&&`         — killed: dim=0 (integer, <1) and dim=1.5
//                                  (non-integer, >=1) each defeat one arm
//   line 30/75 `+ 101` → `- 101` — the double-mod was provably dead (step()
//                                  normalizes any congruent state), i.e. an
//                                  unkillable equivalent surface; deleted from
//                                  the kernel, congruent-seed determinism
//                                  pinned by test instead.
//   line 43  `i < n` → `i <= n`  — was an argued equivalent under the old
//                                  i<j triangular loop (phantom iteration had
//                                  an empty inner loop). The kernel's pair
//                                  loop is RESTRUCTURED to visit pair (j,i)
//                                  when the outer index reaches the larger
//                                  element: the phantom i===n iteration now
//                                  runs a full inner loop and writes the
//                                  nonexistent masks[n] — it throws, so the
//                                  boundary test (and every pinned legal
//                                  call) kills it. Equivalent surface
//                                  deleted, not baselined. For n<=3 the draw
//                                  stream is byte-identical, so all prior
//                                  pins hold unchanged.

const VECS = [[1, 2], [3, 4], [5, 6]]; // true sum [9, 12]

function sharesFor(seed) {
  const { masks } = K.makeMasks(3, 2, seed);
  return VECS.map((v, i) => K.maskShare(v, masks[i]).share);
}

test('masks pairwise cancel: every coordinate of the mask matrix sums to 0', () => {
  const r = K.makeMasks(3, 2, 7);
  assert.equal(r.ok, true);
  assert.deepEqual(r.masks[0], [6, -13]); // pinned draw from seed 7
  const colSums = r.masks.reduce((a, m) => a.map((x, d) => x + m[d]), [0, 0]);
  assert.deepEqual(colSums, [0, 0]);
});

// KILLS line 43 (`i < n` → `i <= n`): under the mutant the phantom outer
// iteration i === n runs its full inner loop and writes masks[n] (undefined)
// — the call throws instead of returning. A legal call completing, with
// EXACTLY n rows and cancelling columns, is the kill. n=4 also exercises the
// restructured enumeration beyond the pinned n<=3 cases.
test('outer boundary binds: a legal call returns exactly n mask rows, no phantom row, and never throws', () => {
  const r = K.makeMasks(4, 1, 7);
  assert.equal(r.ok, true);
  assert.equal(r.masks.length, 4);
  assert.equal(r.masks.reduce((a, m) => a + m[0], 0), 0);
});

test('round-trip: masked shares hide the raw vector yet unveil to the exact sum at noiseScale 0', () => {
  const shares = sharesFor(7);
  assert.deepEqual(shares[0].data, [7, -11]); // [1,2]+[6,-13] — not the raw contribution
  const r = K.unveil(shares, 1, 0);
  assert.deepEqual(r, { ok: true, sum: [9, 12], noised: false, quorum: 3, live: 3 });
});

test('below quorum: a sum of 2 is refused as data, not prose', () => {
  const shares = sharesFor(7).slice(0, 2);
  const r = K.unveil(shares, 1, 0);
  assert.deepEqual(r, { ok: false, why: 'below-quorum', quorum: 3, live: 2 });
});

test('an unmasked (raw) share in the pool is structurally refused', () => {
  const shares = sharesFor(7);
  shares[1] = { data: [3, 4] }; // raw vector, no masked tag
  const r = K.unveil(shares, 1, 0);
  assert.equal(r.ok, false);
  assert.equal(r.why, 'unmasked-share');
  assert.equal(r.index, 1);
});

test('DP noise at unveiling is deterministic from the seed: seed 1, scale 2 shifts [9,12] to [7,10]', () => {
  const r = K.unveil(sharesFor(7), 1, 2);
  assert.deepEqual(r, { ok: true, sum: [7, 10], noised: true, quorum: 3, live: 3 });
});

// KILLS line 19 (`v.length > 0` → `>= 0`): an empty vector is not a vector,
// anywhere it can appear.
test('empty vectors are refused: [] is not a contribution and not a share payload', () => {
  assert.deepEqual(K.maskShare([], []), { ok: false, why: 'non-finite-vector' });
  const empties = [
    { masked: true, data: [] },
    { masked: true, data: [] },
    { masked: true, data: [] },
  ];
  const r = K.unveil(empties, 1, 0);
  assert.deepEqual(r, { ok: false, why: 'unmasked-share', index: 0 });
});

// KILLS line 26 (`n < 2` → `<= 2`) AND line 27 (`dim < 1` → `<= 1`):
// the smallest legal instance — 2 contributors, 1 coordinate — is CLEAN,
// with the exact draw pinned (seed 7 → first LCG state 98 → r = 4).
test('boundary is legal: n=2, dim=1 succeeds with the pinned draw and still cancels', () => {
  assert.deepEqual(K.makeMasks(2, 1, 7), { ok: true, masks: [[4], [-4]], n: 2, dim: 1 });
});

// KILLS line 27 (`||` → `&&`): each refusal arm probed alone.
// dim=0 is an integer below 1 (right arm alone); dim=1.5 is a non-integer
// at/above 1 (left arm alone — under the && mutant it reaches new Array(1.5)
// and throws, so totality itself is the kill).
test('bad dim is refused as data on either arm alone: integer-below-1 and non-integer-above-1', () => {
  assert.deepEqual(K.makeMasks(3, 0, 7), { ok: false, why: 'bad-dim', dim: 0 });
  assert.deepEqual(K.makeMasks(3, 1.5, 7), { ok: false, why: 'bad-dim', dim: 1.5 });
});

// PINS the behavior the deleted double-mod used to provide (lines 30/75):
// congruent seeds — including negative ones — draw identical streams.
test('congruent-seed determinism: seeds equal mod 101 (incl. negative) give identical masks and noise', () => {
  // -94 = 7 (mod 101)
  assert.deepEqual(K.makeMasks(3, 2, -94), K.makeMasks(3, 2, 7));
  // -100 = 1 (mod 101): same noise stream as the pinned seed-1 unveiling
  const r = K.unveil(sharesFor(7), -100, 2);
  assert.deepEqual(r, { ok: true, sum: [7, 10], noised: true, quorum: 3, live: 3 });
});

test('totality: bad input returns {ok:false}, never throws', () => {
  assert.equal(K.makeMasks(1, 2, 7).ok, false);
  assert.equal(K.makeMasks(3, 2, 0.5).ok, false);
  assert.equal(K.maskShare([1, 'x'], [0, 0]).ok, false);
  assert.equal(K.maskShare([1, 2], [0]).ok, false);
  assert.equal(K.unveil(null, 1, 0).ok, false);
  assert.equal(K.unveil(sharesFor(7), 1, -1).ok, false);
});
