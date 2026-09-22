// QuorumVeil — additive-mask secure aggregation behind a quorum gate.
// Pure, total, no I/O. Every refusal is pinned as data in the return value,
// never prose (the SumVeil lesson): a below-quorum or unmasked release is
// structurally impossible, not warned about.
// The no-raw-data invariant is a property of the arithmetic:
//   - pairwise masks cancel in the sum (each column of masks sums to 0)
//   - the unveil refuses below QUORUM live contributors
//   - DP noise is added at the moment of unveiling, from a caller seed.
// The PRNG is a tiny deterministic LCG (mod 101) — determinism for the
// witness, NOT cryptography.

export const QUORUM = 3;

// step() fully normalizes into [0, 100] for ANY integer input congruent
// mod 101 — it is the single normalization point for the LCG state.
function step(s) {
  return (((s * 13 + 7) % 101) + 101) % 101;
}

function isVec(v) {
  return Array.isArray(v) && v.length > 0 && v.every((x) => Number.isFinite(x));
}

// Pairwise-cancelling additive masks for n contributors over dim coordinates.
// For each unordered pair {a, b} with a < b one value r is drawn; +r goes to
// a, -r to b, so every coordinate of the mask matrix sums to exactly 0.
export function makeMasks(n, dim, seed) {
  if (!Number.isInteger(n) || n < 2) return { ok: false, why: 'need-at-least-2-contributors', n };
  if (!Number.isInteger(dim) || dim < 1) return { ok: false, why: 'bad-dim', dim };
  if (!Number.isInteger(seed)) return { ok: false, why: 'bad-seed' };
  const masks = Array.from({ length: n }, () => new Array(dim).fill(0));
  // seed % 101 is enough: every use of s goes through step(), which
  // normalizes negatives itself. The old ((seed % 101) + 101) % 101 was
  // provably dead pre-normalization — an unkillable equivalent-mutant
  // surface — so it is deleted, and congruent-seed determinism is now
  // pinned by test instead.
  let s = seed % 101;
  // The pair loop visits pair (j, i) with j < i — i.e. a pair is drawn when
  // the OUTER index reaches its LARGER element. This exists to make the
  // outer boundary OBSERVABLE: the old i<j triangular form left the
  // `i < n` → `i <= n` mutant as an argued equivalent (its phantom outer
  // iteration had an empty inner loop and touched no state). In this form a
  // phantom iteration i === n runs a FULL inner loop and writes masks[n],
  // which does not exist — it throws, and any pinned legal call kills it.
  // Same equivalent surface DELETED, not baselined — the makeMasks lesson
  // as the double-mod. Signs unchanged (+r to the smaller index, -r to the
  // larger), and for n <= 3 the pair order — hence every draw — is
  // byte-identical to the old form, so all existing pins hold.
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++) {
      for (let d = 0; d < dim; d++) {
        s = step(s);
        const r = (s % 21) - 10; // draw in [-10, 10]
        masks[j][d] += r;
        masks[i][d] -= r;
      }
    }
  }
  return { ok: true, masks, n, dim };
}

// A contribution is only ever released as a masked share, tagged as such.
export function maskShare(vector, mask) {
  if (!isVec(vector)) return { ok: false, why: 'non-finite-vector' };
  if (!isVec(mask) || mask.length !== vector.length) return { ok: false, why: 'mask-dim-mismatch' };
  return { ok: true, share: { masked: true, data: vector.map((x, d) => x + mask[d]) } };
}

// The unveil: refuses any share not tagged masked (a "sum" containing a raw
// vector is the reconstruction attack), refuses below quorum, then adds
// deterministic DP noise drawn from `seed` in [-noiseScale, +noiseScale].
export function unveil(shares, seed, noiseScale) {
  if (!Array.isArray(shares)) return { ok: false, why: 'shares-not-array' };
  if (!Number.isInteger(seed)) return { ok: false, why: 'bad-seed' };
  if (!Number.isInteger(noiseScale) || noiseScale < 0) return { ok: false, why: 'bad-noise-scale' };
  for (let i = 0; i < shares.length; i++) {
    const sh = shares[i];
    if (!sh || sh.masked !== true || !isVec(sh.data)) {
      return { ok: false, why: 'unmasked-share', index: i };
    }
  }
  if (shares.length < QUORUM) {
    return { ok: false, why: 'below-quorum', quorum: QUORUM, live: shares.length };
  }
  const dim = shares[0].data.length;
  for (let i = 1; i < shares.length; i++) {
    if (shares[i].data.length !== dim) return { ok: false, why: 'dim-mismatch', index: i };
  }
  const sum = new Array(dim).fill(0);
  for (const sh of shares) {
    for (let d = 0; d < dim; d++) sum[d] += sh.data[d];
  }
  // Same deletion as makeMasks: step() is the normalizer, the double-mod
  // was dead code and an unkillable mutation surface.
  let s = seed % 101;
  const noise = new Array(dim).fill(0);
  for (let d = 0; d < dim; d++) {
    s = step(s);
    noise[d] = (s % (2 * noiseScale + 1)) - noiseScale;
    sum[d] += noise[d];
  }
  return { ok: true, sum, noised: noiseScale > 0, quorum: QUORUM, live: shares.length };
}
