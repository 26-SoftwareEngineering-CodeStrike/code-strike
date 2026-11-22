/**
 * The bundler replaces `import.meta.env` at build time. The declaration keeps
 * the shared package type-correct on its own; it merges with the one the
 * applications already get from `vite/client`.
 */
interface ImportMetaEnv {
  [key: string]: any
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
