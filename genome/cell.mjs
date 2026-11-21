// cell.mjs — QuorumVeil's three answers for the birth check (seed.json, genome/).
//
// judge  QuorumVeil's own unveil (kernel.mjs). A claimed released total for an unveil request is verified only when
//        the kernel releases it (at least three shares, every one masked, equal lengths) and gives exactly that total,
//        noise included; unverified when the kernel refuses the release or gives a different total. The birth
//        check's cases are the kernel's own test shares: three masked shares from seed 7 unveil to [9, 12]; the
//        same pool with share 2 swapped for its raw vector (the reconstruction attack) is refused, so a total claimed
//        from it is unverified. Refused when the input is not an unveil request, or the claim is not a list of numbers.
// lane   an unveil request the kernel can take: shares as a list, a whole-number seed, a whole-number noise scale of
//        0 or more (the kernel's own refusals of a malformed request are the edge of the lane). A request for one
//        contributor's raw number is out of lane and goes to Kar: QuorumVeil only ever releases the veiled total.
import { unveil } from '../kernel.mjs';

const isObj = (v) => v !== null && typeof v === 'object';
const isSum = (v) => Array.isArray(v) && v.every(Number.isFinite);
const MALFORMED = ['shares-not-array', 'bad-seed', 'bad-noise-scale'];

export async function judge(input) {
  if (!(await inLane(input)) || !isSum(input.sum)) return 'refused';
  const r = unveil(input.shares, input.seed, input.noiseScale);
  return r.ok === true && r.sum.length === input.sum.length && r.sum.every((x, d) => x === input.sum[d]) ? 'verified' : 'unverified';
}

export async function inLane(input) {
  if (!isObj(input)) return false;
  return !MALFORMED.includes(unveil(input.shares, input.seed, input.noiseScale).why);
}

// health: QuorumVeil cannot see its page's visitors or its callers from inside the repository, so it says so
export async function health() {
  return { used: null, dependedOn: null, lastEarned: null };
}
