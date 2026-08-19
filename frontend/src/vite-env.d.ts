/// <reference types="vite/client" />

/**
 * `?worker&url` yields the bundled worker's URL as a string. Vite ships types
 * for `?worker` and for `?url` separately, but not for the two combined.
 */
declare module '*?worker&url' {
  const src: string;
  export default src;
}
