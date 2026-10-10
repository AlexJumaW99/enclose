import { PageOutlet } from 'modulato'
import '@fontsource-variable/inter/opsz.css'
import './styles/global.scss'
import { Header } from './shell/Header'

// The shell: everything outside <PageOutlet/> persists across navigation and
// reacts to the URL through useRoute()/useNavigation().
export default function App() {
  return (
    <>
      <Header />
      <PageOutlet />
    </>
  )
}
