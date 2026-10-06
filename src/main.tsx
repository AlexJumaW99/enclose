import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import App from "./App.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { connect } from "@/lib/store"

const root = createRoot(document.getElementById("root")!)

if (window.cad) {
  connect()
  root.render(
    <StrictMode>
      <ThemeProvider defaultTheme="dark">
        <App />
      </ThemeProvider>
    </StrictMode>
  )
} else {
  // this page was opened in a browser; it only works inside the app's own window
  root.render(
    <p className="p-6 text-sm text-muted-foreground">
      This is the window of the Enclose desktop app. Start it with{" "}
      <code>npm run dev</code>.
    </p>
  )
}
