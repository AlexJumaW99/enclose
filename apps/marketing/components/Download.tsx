import { useEffect, useState } from 'react'
import { REPOSITORY } from '../shell/Header'
import { AppleIcon } from './app/icons'

const LATEST = `${REPOSITORY}/releases/latest`

type Release = { version: string; silicon: string; intel: string }

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
 * The way to the app: the disk image for Apple silicon, and beside it the one for
 * Intel. Until GitHub has said which files those are, and if it never does, both go
 * to the page of the newest release, where they are.
 */
export function Download() {
  const [release, setRelease] = useState<Release | null>(null)
  useEffect(() => {
    let gone = false
    void newest().then(
      (found) => !gone && setRelease(found),
      () => {},
    )
    return () => {
      gone = true
    }
  }, [])

  return (
    <div className="download">
      <a className="download__button" href={release?.silicon ?? LATEST} data-native>
        <AppleIcon />
        Download for Mac
      </a>
      <p className="download__note">
        {release ? `Version ${release.version}, for Apple silicon.` : 'For Apple silicon.'}{' '}
        <a href={release?.intel ?? LATEST} data-native>
          Intel Mac?
        </a>
      </p>
    </div>
  )
}
