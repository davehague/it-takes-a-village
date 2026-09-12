# Fixture — stage 01 research

The gate every change to this villager must still pass. It tests the **rule/shape**, not the live web, so it runs offline and deterministically.

## Given

- Query: the line in `query.txt` (`open-source agent evaluation harnesses 2026`), `num_results = 5`.
- Golden search response: `results.golden.json` (a real Exa response captured at birth).

## How to run offline

`search.sh` caches by `sha256(query|num)[:16]`. For this query+count the key is `d3ba6d2b3fe3d0ec`. Seed the cache and run with the network off:

```sh
mkdir -p output/cache
cp fixtures/results.golden.json output/cache/d3ba6d2b3fe3d0ec.json
SEARCH_OUT_DIR=output EXA_API_KEY= scripts/search.sh "$(cat fixtures/query.txt)" 5
```

## Must hold

1. `search.sh` exits `0`.
2. `output/results.json` has **≥ 3** results, each with a non-empty `title` and a `url`.
3. The brief the villager writes **cites ≥ 3** of those result URLs (a claim without a source is a fail).
4. The brief **ends with a `Confidence:` line** (high / medium / low) plus a one-clause reason.

Rules 3–4 are the villager's learned behavior; new knowledge atoms add assertions here so a correction, once confirmed, is enforced on every future run.
