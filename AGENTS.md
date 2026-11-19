# Architecture

- Keep the authentication context and hook separate from the provider component so hot refresh cannot replace the shared context independently of its consumers.
- Enforce the shared monthly allowance in Postgres with identity-scoped locks and final deferred checks; use the same quantity-based consumption function for validation and display so unmapped codes, legacy headers, and edits cannot bypass it.