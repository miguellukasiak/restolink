/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origin of the RestoLink API, e.g. `https://restolink-api.onrender.com`. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
