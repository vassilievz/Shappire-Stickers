/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL pública da API Shappire (apps/api). Valor público — sem segredos (§20/§36). */
  readonly VITE_API_URL?: string;
}
