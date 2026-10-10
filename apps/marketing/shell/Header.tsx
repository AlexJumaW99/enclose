import { Mark } from './Mark'

export const REPOSITORY = 'https://github.com/enclosedev/enclose'

/** The mark, which is the way home, and the way to the source. */
export function Header() {
  return (
    <header className="header">
      <a className="header__mark" href="/" aria-label="Enclose, home">
        <Mark />
      </a>
      <a className="header__source" href={REPOSITORY} data-native>
        Github
      </a>
    </header>
  )
}
