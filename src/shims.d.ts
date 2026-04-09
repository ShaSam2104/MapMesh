/**
 * Ambient module shims for third-party packages that lack their own type
 * definitions. Prefer fixing upstream or pinning exact runtime APIs here
 * rather than sprinkling `any` through the codebase.
 *
 * Currently empty — every library we depend on either ships its own
 * `.d.ts` or is used through a typed wrapper. This file is kept as the
 * canonical place for future shims.
 */

export {};
