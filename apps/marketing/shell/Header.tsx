import { useNavigation, useRoute } from 'modulato'
import { Mark } from './Mark'

export const REPOSITORY = 'https://github.com/enclosedev/enclose'

/** The mark, which is the way home, and the way to the source. */
export function Header() {
  // which page is up: or, from the moment a way to another is taken, the one coming up
  const route = useRoute()
  const { to } = useNavigation()
  return (
    <header className="header" data-page={(to ?? route).id}>
      <a className="header__mark" href="/" aria-label="Enclose, home">
        <Mark />
      </a>
      <a className="header__source" href={REPOSITORY} data-native>
        Github
      </a>
    </header>
  )
}
