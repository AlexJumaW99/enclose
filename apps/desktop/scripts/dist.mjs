// The app as something to install: the production build made into Enclose (Alpha).app,
// and that into a disk image to download, one for each kind of Mac. They are written to
// release/.
// It needs a Mac.
//   npm run dist                build, then make both
//   npm run dist -- --arm64     ...only the one for Apple silicon (--x64: for Intel)
//
// A Mac opens an app that was downloaded only if a developer Apple knows has signed it
// and Apple has looked it over (notarized it). Both are done here where they can be:
//   signed      with the "Developer ID Application" certificate in the keychain, which
//               is found by itself
//   notarized   with what APPLE_KEYCHAIN_PROFILE names, a profile kept by `xcrun
//               notarytool store-credentials`; or with an App Store Connect key, given
//               as APPLE_API_KEY (its file), APPLE_API_KEY_ID and APPLE_API_ISSUER
// With neither the app is still made, and runs on the Mac that made it.
import { resolve } from "node:path"

import { Arch, Platform, build } from "electron-builder"

const ROOT = resolve(import.meta.dirname, "..")

const asked = ["arm64", "x64"].filter((arch) =>
  process.argv.includes(`--${arch}`)
)
const archs = asked.length > 0 ? asked : ["arm64", "x64"]

const notarized = Boolean(
  process.env.APPLE_KEYCHAIN_PROFILE ||
  (process.env.APPLE_API_KEY &&
    process.env.APPLE_API_KEY_ID &&
    process.env.APPLE_API_ISSUER)
)

const made = await build({
  projectDir: ROOT,
  targets: Platform.MAC.createTarget("dmg", ...archs.map((arch) => Arch[arch])),
  config: {
    // what a Mac knows the app by, and files what it lets the app do under: not to be
    // changed once people have the app
    appId: "dev.enclose.desktop",
    copyright: "Copyright © 2026 Glauber",
    directories: { output: "release" },
    // The build, and of the icons the ones a window is given. Of node_modules, what the
    // Electron side loads as it runs comes along by itself: the package's dependencies,
    // which is why what Vite bundles into the window is listed as a devDependency.
    files: [
      "dist",
      "dist-electron",
      "icons/icon-512.png",
      "icons/icon.ico",
      "!**/*.map",
      // The agent SDK brings a Claude Code of its own, a quarter of a gigabyte of it.
      // The app runs the one on the user's machine (see `running` in electron/claude.ts).
      "!**/node_modules/@anthropic-ai/claude-agent-sdk-*/**",
    ],
    // The kit goes in as it is, beside the app's archive and not in it: Python reads it,
    // and an agent copies from it (`TOP` in electron/main.ts is where it is looked for).
    extraResources: [
      {
        from: "../../kit",
        to: "kit",
        filter: ["**/*", "!**/__pycache__", "!**/.DS_Store"],
      },
    ],
    mac: {
      category: "public.app-category.graphics-design",
      icon: "icons/icon.icns",
      // (by the name alone: what the app is shown as has spaces in it, and a download
      // is linked to by this)
      artifactName: "Enclose-${version}-${arch}.${ext}",
      notarize: notarized,
      // A Mac asks its user before an app, or anything the app runs, reads one of these
      // folders, and shows them this as the reason.
      extendInfo: {
        NSDocumentsFolderUsageDescription:
          "Enclose keeps its projects in your Documents folder, and opens the ones you have there.",
        NSDesktopFolderUsageDescription:
          "Enclose opens the projects and CAD files you have on your Desktop.",
        NSDownloadsFolderUsageDescription:
          "Enclose opens the projects and CAD files you have in Downloads.",
      },
    },
    // The window the disk image opens: the app, and the Applications folder it is
    // dragged to, with an arrow between them. The arrow is in the picture behind
    // (installer/background.svg, which `npm run icons` makes pictures of), and the
    // window is the size of that picture. It is a light one: Finder writes the names
    // under the icons in black whatever is behind them.
    dmg: {
      title: "${productName}",
      background: "installer/background.png",
      iconSize: 128,
      iconTextSize: 13,
      contents: [
        { x: 180, y: 166, type: "file" },
        { x: 480, y: 166, type: "link", path: "/Applications" },
      ],
    },
    // (the app does not update itself: there is nowhere to tell it of)
    publish: null,
  },
})

for (const file of made.filter((one) => one.endsWith(".dmg")))
  console.log(`[dist] ${file}`)
if (!notarized)
  console.warn(
    "[dist] not notarized: a Mac that downloads this will not open it. Set APPLE_KEYCHAIN_PROFILE, or the APPLE_API_KEY three (see the top of scripts/dist.mjs)"
  )
