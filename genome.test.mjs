// QuorumVeil as a cell of the estate genome: its judge (the kernel's own unveil), its lane and its health.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as K from './kernel.mjs';
import { judge, inLane, health } from './genome/cell.mjs';

const seed = JSON.parse(readFileSync(new URL('./seed.json', import.meta.url), 'utf8'));
const VECS = [[1, 2], [3, 4], [5, 6]]; // true sum [9, 12]
function sharesFor(s) {
  const { masks } = K.makeMasks(3, 2, s);
  return VECS.map((v, i) => K.maskShare(v, masks[i]).share);
}
const SHARES = sharesFor(7);

test('judge: the seed cases are the kernel test shares — the masked pool verifies, the raw-swapped pool does not', async () => {
  assert.deepEqual(seed.judge.cases.good.shares, SHARES);
  assert.equal(await judge(seed.judge.cases.good), 'verified');
  assert.deepEqual(seed.judge.cases.bad.shares[1], { data: [3, 4] });
  assert.equal(await judge(seed.judge.cases.bad), 'unverified');
});

test('judge: the claimed total must be exactly what the kernel releases, noise included', async () => {
  assert.equal(await judge({ shares: SHARES, seed: 1, noiseScale: 0, sum: [9, 12] }), 'verified');
  assert.equal(await judge({ shares: SHARES, seed: 1, noiseScale: 0, sum: [9, 13] }), 'unverified');
  assert.equal(await judge({ shares: SHARES, seed: 1, noiseScale: 0, sum: [8, 12] }), 'unverified');
  assert.equal(await judge({ shares: SHARES, seed: 1, noiseScale: 0, sum: [9] }), 'unverified');
  assert.equal(await judge({ shares: SHARES, seed: 1, noiseScale: 0, sum: [9, 12, 0] }), 'unverified');
  assert.equal(await judge({ shares: SHARES, seed: 1, noiseScale: 0, sum: [] }), 'unverified');
  // seed 1, scale 2 shifts [9,12] to [7,10]: the noised total verifies, the un-noised one does not
  assert.equal(await judge({ shares: SHARES, seed: 1, noiseScale: 2, sum: [7, 10] }), 'verified');
  assert.equal(await judge({ shares: SHARES, seed: 1, noiseScale: 2, sum: [9, 12] }), 'unverified');
});

test('judge: a release the kernel refuses is never verified, whatever total is claimed', async () => {
  assert.equal(await judge({ shares: SHARES.slice(0, 2), seed: 1, noiseScale: 0, sum: [16, 6] }), 'unverified');   // below quorum
  assert.equal(await judge({ shares: [], seed: 1, noiseScale: 0, sum: [] }), 'unverified');
  const unmasked = SHARES.map((s) => ({ ...s })); unmasked[0] = { masked: false, data: [1, 2] };
  assert.equal(await judge({ shares: unmasked, seed: 1, noiseScale: 0, sum: [9, 12] }), 'unverified');
});

test('judge: anything that is not an unveil request with a claimed total is refused', async () => {
  for (const bad of [null, undefined, 'x', 5, {}, [], { shares: SHARES, seed: 1, noiseScale: 0 },
    { shares: 'x', seed: 1, noiseScale: 0, sum: [9, 12] }, { shares: SHARES, seed: 1.5, noiseScale: 0, sum: [9, 12] },
    { shares: SHARES, seed: 1, noiseScale: -1, sum: [9, 12] }, { shares: SHARES, seed: 1, noiseScale: 0, sum: 'x' },
    { shares: SHARES, seed: 1, noiseScale: 0, sum: 5 }, { shares: SHARES, seed: 1, noiseScale: 0, sum: [9, '12'] },
    { shares: SHARES, seed: 1, noiseScale: 0, sum: [9, null] }]) {
    assert.equal(await judge(bad), 'refused', String(JSON.stringify(bad)));
  }
});

test('lane: an unveil request is in lane, even one the kernel will refuse to release; a raw-number request is not', async () => {
  assert.equal(await inLane(seed.boundary.inLane), true);
  assert.equal(seed.boundary.inLane.shares.length, 2);
  assert.equal(await inLane(seed.boundary.outOfLane), false);
  assert.equal(await inLane({ shares: SHARES, seed: 1, noiseScale: 0 }), true);
  assert.equal(await inLane({ shares: [{ data: [1] }], seed: -3, noiseScale: 0 }), true);
  for (const bad of [null, undefined, 'x', 5, {}, [], () => {}, { shares: SHARES }, { shares: 'x', seed: 1, noiseScale: 0 },
    { shares: SHARES, seed: '1', noiseScale: 0 }, { shares: SHARES, seed: 1, noiseScale: -1 }, { shares: SHARES, seed: 1, noiseScale: 0.5 }]) {
    assert.equal(await inLane(bad), false, String(JSON.stringify(bad)));
  }
});

test('health says what QuorumVeil cannot measure from inside its repository', async () => {
  assert.deepEqual(await health(), { used: null, dependedOn: null, lastEarned: null });
});
