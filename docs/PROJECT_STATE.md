# MayIonics Project State

Project: MayIonics  
Repository: MayIonics/mayionics.github.io  
Current phase: P1  
Status: baseline ready for review  
Development site target: https://mayionics.github.io/  
Next phase: P2 — D1 schema + migrations

## P1 Baseline

P1 establishes only the static GitHub Pages storefront foundation: repository structure, a minimal responsive homepage, baseline JavaScript, project documentation, and structural tests.

P1 intentionally has no backend, Cloudflare Worker, D1 database, active Stripe integration, active PayPal integration, active EasyPost integration, admin authentication, live checkout, or production commerce activation.

No provider credentials or secrets belong in the repository or browser code.

## Boundaries

MayIonics is isolated from NutriLeaf. P1 does not modify NutriLeaf repositories, deployments, databases, payment configuration, secrets, or other infrastructure.

## Next

P2 will define and implement the MayIonics development D1 schema and migrations in a separate controlled phase. Production resources remain out of scope until explicitly approved later.
