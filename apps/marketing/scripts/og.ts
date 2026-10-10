// Makes public/og.png: the picture a link to the site is given when it is passed on,
// 1200 by 630, the mark over what the page says first. Run again whenever that line,
// or the mark, is changed: `npm run og`.
//
// It is drawn by a browser, so that the words are set as the site sets them. That
// browser is the Chrome on this machine, or whichever CHROME_PATH names.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'
import { drawMark, LOGO, LOGO_PARTS } from '../shell/axes'

const here = dirname(fileURLToPath(import.meta.url))
const from = (path: string) => resolve(here, '..', path)

const chrome =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
if (!existsSync(chrome)) {
  console.error(`No browser at ${chrome}. Say where one is with CHROME_PATH.`)
  process.exit(1)
}

const site = JSON.parse(readFileSync(from('content/site.json'), 'utf8')) as { headline: string }
const inter = readFileSync(
  from('node_modules/@fontsource-variable/inter/files/inter-latin-opsz-normal.woff2'),
).toString('base64')

const page = `<!doctype html>
<meta charset="utf-8" />
<style>
  @font-face {
    font-family: 'Inter Variable';
    font-weight: 100 900;
    src: url(data:font/woff2;base64,${inter}) format('woff2-variations');
  }
  html, body { margin: 0; }
  body {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 40px;
    width: 1200px;
    height: 630px;
    background: #ffffff;
    color: #0a0a0a;
    font-family: 'Inter Variable', sans-serif;
    font-variation-settings: 'opsz' 32;
    -webkit-font-smoothing: antialiased;
  }
  svg { width: 148px; height: 148px; overflow: visible; }
  h1 {
    max-width: 880px;
    margin: 0;
    font-size: 50px;
    font-weight: 500;
    line-height: 1.16;
    letter-spacing: -0.022em;
    text-align: center;
    text-wrap: balance;
  }
</style>
<svg viewBox="-50 -50 100 100">${drawMark(LOGO, LOGO_PARTS)}</svg>
<h1>${site.headline}</h1>`

const browser = await puppeteer.launch({ executablePath: chrome, headless: true })
const tab = await browser.newPage()
await tab.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 })
await tab.setContent(page, { waitUntil: 'load' })
await tab.evaluate(() => document.fonts.ready)
await tab.screenshot({ path: from('public/og.png'), type: 'png' })
await browser.close()
console.log('public/og.png')
