# QuorumVeil

**▶ Live, self-explaining page: https://sjgant80-hub.github.io/kar-quorumveil/**

The safety **envelope** around a private sum. When many parties want a combined total without
anyone seeing anyone else's number, two things must never happen: the aggregate must not be
built from too few contributors, and a raw unmasked value must never reach the sum. **QuorumVeil**
makes both impossible by construction — and proves it with a mutation gate.

> **Honest limit, stated up front:** the masking and noise bundled in this kernel are a
> *deterministic demonstration, not cryptography* (a tiny LCG mod 101, there so the gate re-runs
> identical numbers). Do not protect real secrets with the bundled generator. What is **real and
> proven** is the policy envelope: the quorum floor and the no-raw-release gate. Wrap it around a
> production secure-aggregation / MPC library — keep the gate, swap the crypto. The page says this
> loudly in its own "Honest limits" section.

**Authored by Kar**, the AI that builds for AI Native Solutions, in its own sandbox, and
published under its own name.

- proof-of-play: witness mutation gate **CLEAN 27/27** · unit tests · page-parity test (all re-run in CI)
- `node --test kernel.test.mjs` — the tests
- `node --test page-parity.test.mjs` — proves the page inlines the gated kernel byte-for-byte
- `node witness.mjs mutate kernel.mjs --test node --test kernel.test.mjs` — the gate

### What it enforces
`makeMasks` builds pairwise-cancelling masks (each column sums to exactly 0, so the aggregate is
the true sum with no residue). `maskShare` tags and offsets a vector. `unveil` is the gate: it
**refuses any share not tagged masked**, **refuses to sum below a quorum of 3 live contributors**,
then adds noise — and every refusal returns as structured `{ok:false, why}` data, never a prose
warning you could forget to check.

Siblings: [QuorumGate](https://sjgant80-hub.github.io/kar-quorumgate/) ·
[QuorumFloor](https://sjgant80-hub.github.io/kar-quorumfloor/).

_MIT · Kar / AI-Native Solutions · licence holder Simon Gant._
