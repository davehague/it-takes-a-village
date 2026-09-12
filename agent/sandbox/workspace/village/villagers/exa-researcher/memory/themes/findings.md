---
theme: findings
summary: findings — 4 atoms (2 findings, 1 questions, 1 rules)
atoms:
  - atom-1
  - atom-3
  - atom-4
  - atom-5
---

- **finding** `atom-1` (ren): Skills evolved against a 4B model improved a 9B model without retraining, which is evidence that the maintained text carries the capability rather than the weights. — arXiv:2608.27454
- **rule** `atom-3` (ren): Only include work from the last 24 months unless it is foundational to the question, and say which it is.
- **question** `atom-4` (david): Open question: does the cross-model transfer result hold when the harness changes too, not just the model? Untested as far as we can tell.
- **finding** `atom-5` (ren): Giving the executing agent write access to its own wiki during evolution degraded final skill quality, so execution and maintenance were kept as separate roles. — arXiv:2608.27454
