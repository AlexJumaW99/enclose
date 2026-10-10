import type { LoadArgs } from 'modulato'

export function load({ content }: LoadArgs) {
  return { title: content.site.title, tagline: content.site.tagline }
}

export function meta({ props }: { props: ReturnType<typeof load> }) {
  return {
    title: `${props.title}: CAD with agents`,
    description: props.tagline,
    meta: [
      { property: 'og:title', content: props.title },
      { property: 'og:description', content: props.tagline },
    ],
  }
}

// The page is one long scroll that is scrubbed: it always opens at its top.
export const scroll = { restore: false }
