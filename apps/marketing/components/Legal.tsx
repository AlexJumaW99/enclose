import type { ReactNode } from 'react'
import { Footer } from '../shell/Footer'

/** A page of terms: its name, when it was last changed, and what it says. */
export function Legal({
  page,
  title,
  updated,
  children,
}: {
  /** the page's folder, which its root is named for */
  page: string
  title: string
  updated: string
  children: ReactNode
}) {
  return (
    <main className={`${page} legal`}>
      <article className="legal__text">
        <h1>{title}</h1>
        <p className="legal__updated">Last updated {updated}</p>
        {children}
      </article>
      <Footer />
    </main>
  )
}
