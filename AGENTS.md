# Architecture

- Keep the authentication context and hook separate from the provider component so hot refresh cannot replace the shared context independently of its consumers.