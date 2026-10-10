import { useEffect, useState } from 'react'
import { REPOSITORY } from '../shell/Header'
import { AppleIcon } from './app/icons'

const LATEST = `${REPOSITORY}/releases/latest`

type Chip = 'silicon' | 'intel'
type Release = { version: string } & Record<Chip, string>

const SAID: Record<Chip, string> = {
  silicon: 'for Apple Silicon',
  intel: 'for Intel Macs',
}

/**
 * The newest release, asked of GitHub by whoever is reading the page: its files are
 * named for their version, so there is no one address that is always the newest.
 */
async function newest(): Promise<Release | null> {
  const response = await fetch('https://api.github.com/repos/enclosedev/enclose/releases/latest', {
    headers: { accept: 'application/vnd.github+json' },
  })
  if (!response.ok) return null
  const release = (await response.json()) as {
    tag_name: string
    assets: { name: string; browser_download_url: string }[]
  }
  const image = (ending: string) =>
    release.assets.find((asset) => asset.name.endsWith(`${ending}.dmg`))?.browser_download_url
  const silicon = image('arm64')
  const intel = image('x64')
  if (!silicon || !intel) return null
  return { version: release.tag_name.replace(/^v/, ''), silicon, intel }
}

/**
 * Which kind of Mac the page is being read on, as far as a browser will say. Chrome
 * and its kin say outright. Safari and Firefox call every Mac an Intel one, so there
 * it is told by the graphics: by its name where the browser gives one, and otherwise
 * by the kinds of packed texture it takes, which Apple's own chips do and the Intel
 * Macs' do not. Nothing, where it cannot be told or is no Mac at all.
 */
async function chipOf(): Promise<Chip | null> {
  const said = (
    navigator as Navigator & {
      userAgentData?: {
        platform: string
        getHighEntropyValues(hints: string[]): Promise<{ architecture?: string }>
      }
    }
  ).userAgentData
  if (said) {
    if (said.platform !== 'macOS') return null
    const { architecture } = await said.getHighEntropyValues(['architecture']).catch(() => ({
      architecture: undefined,
    }))
    if (architecture === 'arm') return 'silicon'
    if (architecture === 'x86') return 'intel'
  }
  if (!/Macintosh/.test(navigator.userAgent)) return null

  const gl = document.createElement('canvas').getContext('webgl')
  if (!gl) return null
  const named = gl.getExtension('WEBGL_debug_renderer_info')
  const graphics = named ? String(gl.getParameter(named.UNMASKED_RENDERER_WEBGL)) : ''
  const takes = gl.getSupportedExtensions() ?? []
  gl.getExtension('WEBGL_lose_context')?.loseContext()
  if (/Apple M\d/.test(graphics)) return 'silicon'
  if (/Intel|Radeon|AMD|NVIDIA|GeForce/i.test(graphics)) return 'intel'
  if (takes.some((one) => /compressed_texture_(astc|etc)$/.test(one))) return 'silicon'
  if (takes.some((one) => /compressed_texture_s3tc$/.test(one))) return 'intel'
  return null
}

/**
 * The way to the app: the disk image for the kind of Mac the page is read on, which is
 * taken for Apple Silicon where it cannot be told, and under it which that is. Until
 * GitHub has said which files there are, and if it never does, the button goes to the
 * page of the newest release, where both are.
 */
export function Download() {
  const [release, setRelease] = useState<Release | null>(null)
  const [chip, setChip] = useState<Chip>('silicon')
  useEffect(() => {
    let gone = false
    void newest().then(
      (found) => !gone && setRelease(found),
      () => {},
    )
    void chipOf().then(
      (found) => !gone && found && setChip(found),
      () => {},
    )
    return () => {
      gone = true
    }
  }, [])

  return (
    <div className="download">
      <a className="download__button" href={release?.[chip] ?? LATEST} data-native>
        <AppleIcon />
        Download for Mac
      </a>
      <p className="download__note">
        {release ? `Version ${release.version}, ${SAID[chip]}.` : `${SAID[chip].replace(/^f/, 'F')}.`}
      </p>
    </div>
  )
}
