// Draws page cards for reading and for the exported website.
import { escapeHtml } from '@shared/defaults'
import type { Page, WikiMeta } from '@shared/types'
import { pageThumb } from '../components/Infobox'
import { imgUrl } from './theme'
import type { CardsData } from './cardsData'
import { cardPicStyle, styleAttr } from './cardPic'

export * from './cardsData'

/**
 * The cards as HTML. `find` decides which pages exist (the website only passes public pages, so private
 * pages show no picture and no link).
 */
export function renderCardsHtml(data: CardsData, find: (title: string) => Page | undefined, meta: WikiMeta): string {
  const groups = data.groups
    .filter((g) => g.cards.length || g.title.trim())
    .map((g) => {
      const cards = g.cards
        .map((c) => {
          const page = find(c.page)
          const pic = c.image || (page ? pageThumb(page, meta.templates.find((t) => t.id === page.templateId)) : null)
          const look = !c.image && page ? styleAttr(cardPicStyle(page)) : ''
          const img = pic ? `<img src="${imgUrl(pic)}" alt="" loading="lazy"${look ? ` style="${look}"` : ''}>` : `<span class="pc-letter">${escapeHtml((c.page.trim()[0] ?? '?').toUpperCase())}</span>`
          return (
            `<a class="pc-card" data-wikilink="${escapeHtml(page?.title ?? c.page)}">` +
            `<span class="pc-img">${img}</span>` +
            (c.tag?.trim() ? `<span class="pc-tag">${escapeHtml(c.tag.trim())}</span>` : '') +
            `<span class="pc-name">${escapeHtml(page?.title ?? c.page)}</span></a>`
          )
        })
        .join('')
      return (
        `<div class="pc-group">` +
        (g.title.trim() ? `<div class="pc-head">${escapeHtml(g.title.trim())}</div>` : '') +
        `<div class="pc-grid">${cards}</div></div>`
      )
    })
    .join('')
  return `<div class="page-cards">${groups}</div>`
}
