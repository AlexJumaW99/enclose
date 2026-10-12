import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { useNavigation, useRoute } from 'modulato'
import { Mark } from './Mark'

export const REPOSITORY = 'https://github.com/enclosedev/enclose'

/**
 * How many have starred the source, asked of GitHub by whoever is reading the page.
 * Nothing, where GitHub will not say.
 */
async function starred(): Promise<number | null> {
  const response = await fetch('https://api.github.com/repos/enclosedev/enclose', {
    headers: { accept: 'application/vnd.github+json' },
  })
  if (!response.ok) return null
  const { stargazers_count: stars } = (await response.json()) as { stargazers_count?: number }
  return typeof stars === 'number' ? stars : null
}

/** A count said short, as GitHub says its own: 1234 is 1.2k. */
const SHORT = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })

/** The mark, which is the way home, and the way to the source, with its stars beside it. */
export function Header() {
  // which page is up: or, from the moment a way to another is taken, the one coming up
  const route = useRoute()
  const { to } = useNavigation()
  const [stars, setStars] = useState<number | null>(null)
  useEffect(() => {
    let gone = false
    void starred().then(
      (found) => !gone && setStars(found),
      () => {},
    )
    return () => {
      gone = true
    }
  }, [])
  return (
    <header className="header" data-page={(to ?? route).id}>
      <a className="header__mark" href="/" aria-label="Enclose, home">
        <Mark />
      </a>
      <a
        className="header__source"
        href={REPOSITORY}
        aria-label={stars === null ? undefined : `Github, ${stars} ${stars === 1 ? 'star' : 'stars'}`}
        data-native
      >
        Github
        {stars !== null && (
          <span className="header__stars">
            <Star aria-hidden />
            {SHORT.format(stars).toLowerCase()}
          </span>
        )}
      </a>
    </header>
  )
}
