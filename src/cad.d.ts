import type { CadApi } from "@shared/api"

declare global {
  interface Window {
    /** the app's own process, as exposed by electron/preload.ts */
    cad: CadApi
  }

  /** The app's version, from package.json, put in when the window is built. */
  const __APP_VERSION__: string
}
