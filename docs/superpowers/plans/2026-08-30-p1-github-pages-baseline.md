# MayIonics P1 GitHub Pages Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a clean, GitHub Pages-compatible MayIonics storefront baseline with a minimal responsive homepage, project structure, static verification, and project documentation, without touching Cloudflare, Stripe, PayPal, EasyPost, or NutriLeaf.

**Architecture:** P1 is a static-only foundation. GitHub Pages will serve plain HTML/CSS/JavaScript from the repository root. No backend calls, secrets, payment SDKs, shipping APIs, or database resources are introduced in this phase. The structure should make later storefront pages and API integration straightforward without overbuilding P1.

**Tech Stack:** HTML5, CSS3, vanilla JavaScript, Node.js built-in test runner for structural/static checks, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-08-30-mayionics-v1-design.md`

## Global Constraints

- Repository is `MayIonics/mayionics.github.io`.
- Initial development URL target is `https://mayionics.github.io/`.
- P1 must not create or modify Cloudflare, Stripe, PayPal, EasyPost, or NutriLeaf resources.
- No secrets, API keys, tokens, passwords, or credentials may be committed.
- Frontend uses HTML, CSS, and vanilla JavaScript only in P1.
- Visual direction is clean, minimal, product-first, responsive, and free of intrusive promotional UI.
- P1 must not implement real checkout, shipping, payments, backend calls, database access, or admin authentication.
- Work remains on `p1-github-pages-baseline` until verification is complete.

---

### Task 1: Establish the static project verification harness

**Files:**
- Create: `package.json`
- Create: `tests/p1-structure.test.mjs`

**Interfaces:**
- Consumes: repository root and the approved P1 file contract.
- Produces: `npm test` as the single P1 verification command.

- [ ] **Step 1: Write the failing structural tests**

Create `tests/p1-structure.test.mjs` using Node's built-in `node:test`, `assert`, `fs`, and `path`. Tests must assert that these files exist once P1 is implemented:

```text
index.html
assets/css/site.css
assets/js/site.js
README.md
docs/PROJECT_STATE.md
```

Add tests that read `index.html` and assert it contains:

```text
MayIonics
Shop
New Arrivals
Shop by Category
Seller Reviews
Secure Payments
Tracked Shipping
```

Add a test that ensures the repository text files do not contain obvious secret assignments for keys named `STRIPE_SECRET_KEY`, `PAYPAL_CLIENT_SECRET`, or `EASYPOST_API_KEY`.

- [ ] **Step 2: Add the test command**

Create `package.json` with no runtime dependencies and this script:

```json
{
  "name": "mayionics-github-pages",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "test": "node --test tests/*.test.mjs"
  }
}
```

- [ ] **Step 3: Run the test and verify RED**

Run:

```bash
npm test
```

Expected result: FAIL because `index.html`, `assets/css/site.css`, `assets/js/site.js`, and `docs/PROJECT_STATE.md` do not yet exist.

- [ ] **Step 4: Commit the failing harness**

Commit message:

```text
test: define P1 storefront baseline contract
```

---

### Task 2: Build the minimal MayIonics homepage shell

**Files:**
- Create: `index.html`
- Create: `assets/css/site.css`
- Create: `assets/js/site.js`

**Interfaces:**
- Consumes: the static contract defined by `tests/p1-structure.test.mjs`.
- Produces: a GitHub Pages-ready homepage with stable semantic section identifiers for later phases.

- [ ] **Step 1: Implement the minimal HTML required by the tests**

Create `index.html` with:

- semantic `header`, `main`, and `footer` elements;
- MayIonics wordmark text;
- primary navigation containing Shop, Categories, Seller Reviews, About, Shipping & Returns, and Cart;
- a compact hero with one heading, a short marketplace description, and one `Shop All` action;
- `New Arrivals` placeholder section;
- `Shop by Category` placeholder section;
- `Featured Items` placeholder section;
- `Seller Reviews` trust section that states feedback is historical eBay seller feedback and includes a placeholder link target for the later reviews page;
- trust row containing `Secure Payments`, `Tracked Shipping`, and `Clearly Described Condition`;
- footer links for About, Shipping & Returns, Contact, Privacy, and Terms;
- references to `/assets/css/site.css` and `/assets/js/site.js`.

P1 placeholders must not pretend that live products, payments, shipping, or reviews are already integrated.

- [ ] **Step 2: Implement clean responsive CSS**

Create `assets/css/site.css` with:

- CSS custom properties for spacing, text, border, background, and one accent color;
- centered content container with a maximum width near 1200px;
- compact sticky header;
- responsive product-placeholder grids using CSS Grid;
- four columns on large screens, two on typical mobile widths where practical;
- consistent square media placeholders;
- restrained borders and hover/focus states;
- visible keyboard focus styling;
- no gradients, large shadows, animation-heavy effects, countdowns, or popups.

- [ ] **Step 3: Add minimal JavaScript only where useful**

Create `assets/js/site.js` with a small module that updates the cart-count text from a local zero-value baseline and exposes no commerce behavior. It must not call external APIs or contain provider credentials.

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```bash
npm test
```

Expected result: all structural tests PASS.

- [ ] **Step 5: Commit the storefront shell**

Commit message:

```text
feat: add MayIonics GitHub Pages storefront baseline
```

---

### Task 3: Add P1 project state and operating documentation

**Files:**
- Create: `docs/PROJECT_STATE.md`
- Modify: `README.md`
- Modify: `tests/p1-structure.test.mjs`

**Interfaces:**
- Consumes: approved Version 1 design and implemented P1 static structure.
- Produces: a clear checkpoint explaining what P1 contains, what is intentionally absent, and what P2 will do.

- [ ] **Step 1: Extend the test first**

Update `tests/p1-structure.test.mjs` to assert that `docs/PROJECT_STATE.md` contains these exact phase markers:

```text
Current phase: P1
Status: baseline ready for review
Next phase: P2 — D1 schema + migrations
```

Also assert that `README.md` contains `https://mayionics.github.io/` and states that payment/shipping integrations are not active in P1.

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npm test
```

Expected result: FAIL because the current README and project-state documentation do not yet satisfy the new contract.

- [ ] **Step 3: Create `docs/PROJECT_STATE.md`**

Document:

```text
Project: MayIonics
Repository: MayIonics/mayionics.github.io
Current phase: P1
Status: baseline ready for review
Development site target: https://mayionics.github.io/
Next phase: P2 — D1 schema + migrations
```

Include explicit notes that P1 has no backend, database, payments, shipping API, or production commerce activation.

- [ ] **Step 4: Update README**

Keep the existing marketplace description and add:

- project purpose;
- development URL target;
- current P1 scope;
- architecture summary for later phases;
- statement that Stripe, PayPal, EasyPost, Cloudflare Worker, and D1 integrations are planned but not active in P1;
- link to the Version 1 design spec and P1 implementation plan.

- [ ] **Step 5: Run tests and verify GREEN**

Run:

```bash
npm test
```

Expected result: all tests PASS.

- [ ] **Step 6: Commit documentation**

Commit message:

```text
docs: record MayIonics P1 project baseline
```

---

### Task 4: Perform structural, diff, and repository-safety verification

**Files:**
- No new production files expected.
- Modify only files required for narrow fixes if verification exposes a defect.

**Interfaces:**
- Consumes: completed P1 branch.
- Produces: verified evidence that the branch is limited to approved MayIonics P1 work.

- [ ] **Step 1: Run the complete test suite**

Run:

```bash
npm test
```

Expected result: PASS with no warnings or test failures.

- [ ] **Step 2: Verify required files and references**

Confirm the branch contains:

```text
README.md
index.html
assets/css/site.css
assets/js/site.js
docs/PROJECT_STATE.md
docs/superpowers/specs/2026-08-30-mayionics-v1-design.md
docs/superpowers/plans/2026-08-30-p1-github-pages-baseline.md
tests/p1-structure.test.mjs
package.json
```

Confirm HTML references resolve to files that exist on the branch.

- [ ] **Step 3: Verify no secrets or provider activation**

Search the branch for obvious credential patterns and confirm there are no live provider keys, secrets, webhook secrets, account tokens, or production API calls.

Confirm there are no changes to any NutriLeaf repository.

- [ ] **Step 4: Review branch diff against `main`**

Use GitHub compare/diff tooling to confirm every changed file belongs to P1 and that no unrelated files are present.

- [ ] **Step 5: Apply only narrow corrective fixes if needed**

If verification identifies a P1 defect, fix only that defect, rerun the complete verification, and document the correction in the final checkpoint.

---

### Task 5: Open and verify the P1 pull request

**Files:**
- No additional repository files unless a narrow verification fix is required.

**Interfaces:**
- Consumes: verified `p1-github-pages-baseline` branch.
- Produces: a reviewable PR into `main` with verified scope and checkpoint information.

- [ ] **Step 1: Open the pull request**

Create a PR from:

```text
p1-github-pages-baseline
```

to:

```text
main
```

Title:

```text
P1: establish MayIonics GitHub Pages baseline
```

The body must summarize the static storefront baseline, documentation, tests, explicit non-production boundaries, and state that no Cloudflare/payment/shipping/NutriLeaf resources were changed.

- [ ] **Step 2: Verify changed filenames**

List every changed filename in the PR and confirm it matches the approved P1 file set.

- [ ] **Step 3: Verify PR status/checks**

Inspect available status checks and workflow runs. If there are no configured Actions yet, record that fact rather than treating absent CI as a passing workflow.

- [ ] **Step 4: Report P1 checkpoint before any merge/deployment decision**

Report:

1. what P1 created or changed;
2. local/static verification results;
3. repository, branch, latest commit, and PR state;
4. any manual GitHub Pages setting still required;
5. recommendation for P2.

Do not claim `https://mayionics.github.io/` is live until the merged/default-branch state and GitHub Pages publication are actually verified.
