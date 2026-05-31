const RULES: Record<string, string> = {
  'motion-reveal': 'motion-reveal:not(:defined){opacity:0}',
  'motion-stagger': 'motion-stagger:not(:defined)>*{opacity:0}',
  'motion-split': 'motion-split:not(:defined){opacity:0}',
  'motion-headline': 'motion-headline:not(:defined){opacity:0}',
  'motion-ticker': 'motion-ticker:not(:defined){opacity:0}',
  'motion-slider': 'motion-slider:not(:defined){opacity:0}',
  'motion-gallery': 'motion-gallery:not(:defined)>*{opacity:0}',
  'motion-blur': 'motion-blur:not(:defined){opacity:0}',
  'motion-blur-in': 'motion-blur-in:not(:defined){opacity:0}',
  'motion-counter': 'motion-counter:not(:defined){opacity:0}',
  'motion-glitch': 'motion-glitch:not(:defined){opacity:0}',
  'motion-scramble': 'motion-scramble:not(:defined){opacity:0}',
  'motion-typewriter': 'motion-typewriter:not(:defined){opacity:0}',
  'motion-flip-card': 'motion-flip-card:not(:defined){opacity:0}',
  'motion-swap': 'motion-swap:not(:defined){opacity:0}',
  'motion-dialog': 'motion-dialog:not(:defined){display:none}',
}

export const preloadCSS: string = Object.values(RULES).join('')

export function preload(tags: string[] = Object.keys(RULES)): void {
  if (typeof document === 'undefined') return
  const css = tags
    .map((tag) => RULES[tag])
    .filter(Boolean)
    .join('')
  if (!css) return
  const style = document.createElement('style')
  style.textContent = css
  document.head.appendChild(style)
}
