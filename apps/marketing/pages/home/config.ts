import type { LoadArgs } from 'modulato'

export function load({ content }: LoadArgs) {
  return { title: content.site.title, tagline: content.site.tagline }
}

export function meta({ content }: LoadArgs) {
  return {
    title: content.site.title,
    description: content.site.tagline,
  }
}
