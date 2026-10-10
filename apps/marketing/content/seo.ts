import type { MetaResult } from 'modulato'
import site from './site.json'

/**
 * What a page says of itself to whatever reads it without looking at it: a search
 * engine, or the card a link to it is given when it is passed on. The picture on that
 * card, and what is the same on every page, are in modulato.config.ts.
 */
export function seo({
  path,
  title,
  description,
}: {
  /** the page's address on the site, from its root: "/", "/terms" */
  path: string
  title: string
  description: string
}): MetaResult {
  const address = `${site.url}${path}`
  return {
    title,
    description,
    link: [{ rel: 'canonical', href: address }],
    meta: [
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: address },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
    ],
  }
}
