import type { CadApi } from "@shared/api"

declare global {
  interface Window {
    /** the app's own process, as exposed by electron/preload.ts */
    cad: CadApi
  }
}
