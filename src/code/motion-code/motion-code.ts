import type { MotionCodeProps } from './motion-code.types.js'
export type { MotionCodeProps } from './motion-code.types.js'

import { LitElement, html, css, svg, nothing } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { unsafeHTML } from 'lit/directives/unsafe-html.js'
import { animate } from 'motion'
import type { AnimationPlaybackControls } from 'motion'
import { Controllable, PlaybackController, frameLoop } from '../../utils/playback.js'

interface Token {
  text: string
  cls?: string
}

@customElement('motion-code')
export class MotionCode extends Controllable(LitElement) implements MotionCodeProps {
  @property({ type: String }) filename = 'app.html'
  @property({ type: String, attribute: 'code-lang' }) codeLang = ''
  @property({ type: Boolean, attribute: 'hide-chrome' }) hideChrome = false
  @property({ type: Boolean }) copy = false
  @property({ type: Boolean, attribute: 'copy-label' }) copyLabel = false
  @property({ type: Boolean, reflect: true }) compact = false
  @property({ type: Boolean }) type = false
  @property({ type: Number, attribute: 'type-speed' }) typeSpeed = 80
  @property({ type: Number, attribute: 'type-delay' }) typeDelay = 0
  @property({ type: Boolean, attribute: 'no-loop' }) noLoop = false
  @property({ type: Number, attribute: 'type-loop-delay' }) typeLoopDelay = 1500

  @state() private copied = false
  @state() private highlighted = ''
  @state() private visibleChars = -1
  @state() private typing = false

  private tokens: Token[] = []
  private raw = ''
  private typePhase: 'delay' | 'typing' | 'gap' = 'delay'
  private phaseElapsed = 0
  private typeLoop = frameLoop((dt) => this.typeTick(dt))
  private resolveTyped: (() => void) | null = null
  private cursorControls: AnimationPlaybackControls | null = null
  private revealObserver: IntersectionObserver | null = null
  private isIntersecting = false
  private hasCode = false

  playback: PlaybackController = new PlaybackController(this, {
    start: () => {
      if (!this.totalChars) return { handle: this.typeHandle(), done: Promise.resolve() }
      this.beginTyping()
      if (!this.noLoop) return { handle: this.typeHandle() }
      return {
        handle: this.typeHandle(),
        done: new Promise<void>((resolve) => {
          this.resolveTyped = resolve
        }),
      }
    },
    applyFinalState: () => {
      this.visibleChars = this.totalChars
      this.typing = false
    },
    applyInitialState: () => {
      this.visibleChars = this.type ? 0 : -1
      this.typing = false
    },
  })

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      width: 100%;
      min-width: 0;
      background: var(--color-surface-2, #f0f0f8);
      border: 1px solid var(--color-border, #dddde8);
      border-radius: 16px;
      overflow: hidden;
      font-family: ui-monospace, 'Cascadia Code', 'Fira Code', monospace;
    }

    :host([compact]) {
      border-radius: 10px;
    }

    .chrome {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 0.75rem 1.25rem;
      border-bottom: 1px solid var(--color-border, #dddde8);
    }

    :host([compact]) .chrome {
      padding: 0.3rem 0.75rem;
      gap: 5px;
    }

    .dot {
      width: 11px;
      height: 11px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    :host([compact]) .dot {
      width: 7px;
      height: 7px;
    }

    .dot-red {
      background: #ff5f57;
    }
    .dot-yellow {
      background: #febc2e;
    }
    .dot-green {
      background: #28c840;
    }

    .filename {
      font-size: 0.78rem;
      color: var(--color-muted, #60608a);
      margin-left: 0.5rem;
      flex: 1;
    }

    :host([compact]) .filename {
      font-size: 0.68rem;
      margin-left: 0.35rem;
    }

    .copy-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.4em;
      background: transparent;
      border: 1px solid var(--color-border, #dddde8);
      border-radius: 6px;
      padding: 0.3rem;
      font-size: 0.72rem;
      color: var(--color-muted, #60608a);
      cursor: pointer;
      font-family: inherit;
      transition:
        color 0.15s,
        border-color 0.15s;
      line-height: 1;
    }

    .copy-btn:hover {
      color: var(--color-accent, #2563eb);
      border-color: var(--color-accent, #2563eb);
    }

    .copy-btn.has-label {
      padding: 0.25rem 0.5rem;
    }

    .copy-btn svg {
      width: 13px;
      height: 13px;
      display: block;
    }

    .body {
      flex: 1;
      background: var(--color-surface, #ffffff);
      padding: 1.5rem 1.75rem;
      overflow-x: auto;
    }

    .code-area {
      display: grid;
    }

    .code-area > pre {
      grid-area: 1 / 1;
    }

    .sizer {
      visibility: hidden;
    }

    :host([compact]) .body {
      padding: 0.75rem 1rem;
    }

    pre {
      margin: 0;
      font-size: 0.875rem;
      line-height: 1.85;
      font-family: inherit;
      white-space: pre;
    }

    :host([compact]) pre {
      font-size: 0.8rem;
      line-height: 1.6;
    }

    .cursor {
      display: inline-block;
      width: 2px;
      height: 1em;
      background: var(--color-muted, #60608a);
      vertical-align: text-bottom;
      margin-left: 1px;
    }

    /* ── Token colours — all overridable via CSS custom properties ──────────
       Map any external theme's values to these variables on :root.           */
    .cw-comment {
      color: var(--cw-comment, var(--color-muted, #60608a));
    }
    .cw-keyword {
      color: var(--cw-keyword, #7c3aed);
    }
    .cw-string {
      color: var(--cw-string, #16a34a);
    }
    .cw-tag {
      color: var(--cw-tag, #0369a1);
    }
    .cw-attr {
      color: var(--cw-attr, #be123c);
    }
    .cw-num {
      color: var(--cw-num, #b45309);
    }
  `

  connectedCallback() {
    super.connectedCallback()
    this.injectThemeVars()
    this.processCode()
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.cursorControls?.stop()
    this.cursorControls = null
    this.revealObserver?.disconnect()
  }

  /** Restart the typing animation from the beginning */
  replay() {
    if (this.type) {
      this.cancel()
      void this.play()
    }
  }

  /** Set code programmatically — used by the Astro wrapper component */
  setCode(raw: string) {
    this.raw = raw
    const dedented = this.dedent(raw)
    this.tokens = this.tokenize(dedented)
    this.highlighted = this.renderTokens(this.tokens)
    this.hasCode = true
    this.playback.teardown()
    if (this.type) {
      if (this.noLoop) {
        // The observer fires immediately with the current intersection state,
        // so this covers both already-visible and scrolled-to-later windows.
        this.setupRevealObserver()
      } else {
        requestAnimationFrame(() => void this.play())
      }
    }
    this.requestUpdate()
  }

  protected updated() {
    if (this.typing) {
      const cursor = this.shadowRoot?.querySelector<HTMLElement>('.cursor')
      if (cursor && !this.cursorControls) {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
        this.cursorControls = animate(
          cursor,
          { opacity: [1, 0] },
          { duration: 0.45, repeat: Infinity, repeatType: 'reverse' },
        )
      }
    } else {
      this.cursorControls?.stop()
      this.cursorControls = null
    }
  }

  // ── Theming ───────────────────────────────────────────────────────────────

  private injectThemeVars() {
    const id = 'cw-token-vars'
    if (document.getElementById(id)) return
    const style = document.createElement('style')
    style.id = id
    style.textContent = `
      :root {
        --cw-keyword: #7c3aed; --cw-string: #16a34a;
        --cw-tag:     #0369a1; --cw-attr:   #be123c; --cw-num: #b45309;
      }
      [data-theme="dark"] {
        --cw-keyword: #c084fc; --cw-string: #86efac;
        --cw-tag:     #7dd3fc; --cw-attr:   #fda4af; --cw-num: #fcd34d;
      }
      @media (prefers-color-scheme: dark) {
        :root:not([data-theme="light"]) {
          --cw-keyword: #c084fc; --cw-string: #86efac;
          --cw-tag:     #7dd3fc; --cw-attr:   #fda4af; --cw-num: #fcd34d;
        }
      }
    `
    document.head.appendChild(style)
  }

  // ── Code processing ───────────────────────────────────────────────────────

  private processCode() {
    const raw = this.extractRaw()
    this.raw = raw
    this.tokens = this.tokenize(raw)
    this.highlighted = this.renderTokens(this.tokens)
    if (!raw) return
    this.hasCode = true
    if (this.type) {
      if (this.noLoop) {
        this.setupRevealObserver()
      } else {
        void this.play()
      }
    }
  }

  private setupRevealObserver() {
    this.revealObserver?.disconnect()
    this.revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          this.isIntersecting = entry.isIntersecting
          if (entry.isIntersecting && this.hasCode) {
            void this.play()
            this.revealObserver?.disconnect()
            this.revealObserver = null
          }
        }
      },
      { threshold: 0.2 },
    )
    this.revealObserver.observe(this)
  }

  private extractRaw(): string {
    const scriptEl = this.querySelector('script[type="text/plain"]')
    if (scriptEl) return this.dedent(scriptEl.textContent ?? '')
    return Array.from(this.querySelectorAll('div'))
      .map((el) => el.textContent ?? '')
      .join('\n')
  }

  private dedent(code: string): string {
    const lines = code.split('\n')
    while (lines.length && !lines[0].trim()) lines.shift()
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
    const minIndent = Math.min(
      ...lines.filter((l) => l.trim()).map((l) => (l.match(/^(\s*)/) ?? ['', ''])[1].length),
    )
    return lines.map((l) => l.slice(minIndent)).join('\n')
  }

  private getLang(): string {
    if (this.codeLang) return this.codeLang
    const ext = this.filename.split('.').pop()?.toLowerCase() ?? ''
    if (['html', 'astro', 'svelte', 'vue'].includes(ext)) return 'html'
    if (['js', 'ts', 'jsx', 'tsx', 'mjs', 'cjs'].includes(ext)) return 'js'
    if (['css', 'scss'].includes(ext)) return 'css'
    if (['sh', 'bash', 'zsh'].includes(ext)) return 'sh'
    if (ext === 'json') return 'json'
    if (ext === 'py') return 'python'
    return 'text'
  }

  // ── Typing animation ──────────────────────────────────────────────────────

  private get totalChars(): number {
    return this.tokens.reduce((sum, t) => sum + t.text.length, 0)
  }

  private typeHandle() {
    return {
      pause: () => {
        this.typeLoop.stop()
        this.cursorControls?.pause()
      },
      resume: () => {
        this.typeLoop.start()
        this.cursorControls?.play()
      },
      finish: () => {
        this.stopTyping()
        this.visibleChars = this.totalChars
        this.typing = false
      },
      cancel: () => this.stopTyping(),
    }
  }

  private beginTyping() {
    this.typePhase = 'delay'
    this.phaseElapsed = 0
    this.visibleChars = 0
    this.typing = true
    this.typeLoop.start()
  }

  private stopTyping() {
    this.typeLoop.stop()
    this.resolveTyped = null
  }

  private typeTick(dt: number) {
    this.phaseElapsed += dt
    if (this.typePhase === 'delay') {
      if (this.phaseElapsed < this.typeDelay) return
      this.typePhase = 'typing'
      this.phaseElapsed = 0
      return
    }
    if (this.typePhase === 'typing') {
      const total = this.totalChars
      const duration = (total / this.typeSpeed) * 1000
      const progress = Math.min(this.phaseElapsed / duration, 1)
      this.visibleChars = Math.floor(progress * total)
      if (progress < 1) return
      this.typing = false
      if (this.noLoop) {
        this.typeLoop.stop()
        this.resolveTyped?.()
        this.resolveTyped = null
        return
      }
      this.typePhase = 'gap'
      this.phaseElapsed = 0
      return
    }
    if (this.phaseElapsed >= this.typeLoopDelay) {
      this.typePhase = 'delay'
      this.phaseElapsed = 0
      this.visibleChars = 0
      this.typing = true
    }
  }

  private renderPartial(): string {
    if (!this.type || this.visibleChars < 0) return this.highlighted

    let charsLeft = this.visibleChars
    let result = ''

    for (const token of this.tokens) {
      if (charsLeft <= 0) break
      const visibleText =
        charsLeft >= token.text.length ? token.text : token.text.slice(0, charsLeft)
      result += token.cls
        ? `<span class="${token.cls}">${this.esc(visibleText)}</span>`
        : this.esc(visibleText)
      charsLeft -= token.text.length
    }

    return result
  }

  // ── Tokenization ──────────────────────────────────────────────────────────

  private tokenize(code: string): Token[] {
    const lang = this.getLang()
    if (lang === 'html') return this.tokenizeHtml(code)
    if (lang === 'js') return this.tokenizeJs(code)
    if (lang === 'css') return this.tokenizeCss(code)
    if (lang === 'json') return this.tokenizeJson(code)
    if (lang === 'python') return this.tokenizePython(code)
    return [{ text: code }]
  }

  private renderTokens(tokens: Token[]): string {
    return tokens
      .map((t) => (t.cls ? `<span class="${t.cls}">${this.esc(t.text)}</span>` : this.esc(t.text)))
      .join('')
  }

  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  // HTML / Astro / Svelte / Vue
  private tokenizeHtml(code: string): Token[] {
    const tokens: Token[] = []
    let i = 0
    while (i < code.length) {
      if (code.startsWith('<!--', i)) {
        const end = code.indexOf('-->', i + 4)
        const text = end === -1 ? code.slice(i) : code.slice(i, end + 3)
        tokens.push({ text, cls: 'cw-comment' })
        i += text.length
        continue
      }
      if (code[i] === '<' && /[a-zA-Z/!?]/.test(code[i + 1] ?? '')) {
        const tagEnd = this.findTagEnd(code, i)
        tokens.push(...this.tokenizeHtmlTag(code.slice(i, tagEnd)))
        i = tagEnd
        continue
      }
      let j = i + 1
      while (j < code.length && code[j] !== '<') j++
      tokens.push({ text: code.slice(i, j) })
      i = j
    }
    return tokens
  }

  private findTagEnd(code: string, start: number): number {
    let i = start + 1
    let inStr: string | null = null
    while (i < code.length) {
      const c = code[i]
      if (inStr) {
        if (c === inStr) inStr = null
      } else if (c === '"' || c === "'") {
        inStr = c
      } else if (c === '>') {
        return i + 1
      }
      i++
    }
    return i
  }

  private tokenizeHtmlTag(tag: string): Token[] {
    const tokens: Token[] = []
    let i = 0
    const open = tag.match(/^(<\/?)((?:[a-zA-Z][a-zA-Z0-9-]*(?::[a-zA-Z][a-zA-Z0-9-]*)?)?)/)
    if (!open) {
      tokens.push({ text: tag, cls: 'cw-tag' })
      return tokens
    }
    tokens.push({ text: open[1] + open[2], cls: 'cw-tag' })
    i = open[1].length + open[2].length
    while (i < tag.length) {
      const rest = tag.slice(i)
      const ws = rest.match(/^\s+/)
      if (ws) {
        tokens.push({ text: ws[0] })
        i += ws[0].length
        continue
      }
      if (rest[0] === '>' || rest.startsWith('/>')) {
        const br = rest.startsWith('/>') ? '/>' : '>'
        tokens.push({ text: br, cls: 'cw-tag' })
        i += br.length
        continue
      }
      const attr = rest.match(/^[a-zA-Z_:@#.][a-zA-Z0-9_:\-.@#]*/)
      if (attr) {
        tokens.push({ text: attr[0], cls: 'cw-attr' })
        i += attr[0].length
        continue
      }
      if (rest[0] === '=') {
        tokens.push({ text: '=' })
        i++
        continue
      }
      if (rest[0] === '"' || rest[0] === "'") {
        const q = rest[0]
        const end = rest.indexOf(q, 1)
        const str = end === -1 ? rest : rest.slice(0, end + 1)
        tokens.push({ text: str, cls: 'cw-string' })
        i += str.length
        continue
      }
      if (rest[0] === '{') {
        const end = rest.indexOf('}')
        const expr = end === -1 ? rest : rest.slice(0, end + 1)
        tokens.push({ text: expr })
        i += expr.length
        continue
      }
      tokens.push({ text: rest[0] })
      i++
    }
    return tokens
  }

  // JS / TS
  private tokenizeJs(code: string): Token[] {
    const keywords = new Set([
      'import',
      'export',
      'from',
      'default',
      'as',
      'const',
      'let',
      'var',
      'function',
      'class',
      'extends',
      'return',
      'if',
      'else',
      'for',
      'while',
      'do',
      'switch',
      'case',
      'break',
      'continue',
      'new',
      'this',
      'typeof',
      'instanceof',
      'in',
      'of',
      'async',
      'await',
      'try',
      'catch',
      'finally',
      'throw',
      'true',
      'false',
      'null',
      'undefined',
      'type',
      'interface',
      'enum',
      'declare',
      'abstract',
      'readonly',
      'keyof',
    ])
    const tokens: Token[] = []
    let i = 0
    while (i < code.length) {
      if (code[i] === '/' && code[i + 1] === '/') {
        const end = code.indexOf('\n', i)
        const text = end === -1 ? code.slice(i) : code.slice(i, end)
        tokens.push({ text, cls: 'cw-comment' })
        i += text.length
        continue
      }
      if (code[i] === '/' && code[i + 1] === '*') {
        const end = code.indexOf('*/', i + 2)
        const text = end === -1 ? code.slice(i) : code.slice(i, end + 2)
        tokens.push({ text, cls: 'cw-comment' })
        i += text.length
        continue
      }
      if (code[i] === '`') {
        let j = i + 1
        while (j < code.length && code[j] !== '`') {
          if (code[j] === '\\') j++
          j++
        }
        tokens.push({ text: code.slice(i, j + 1), cls: 'cw-string' })
        i = j + 1
        continue
      }
      if (code[i] === '"' || code[i] === "'") {
        const q = code[i]
        let j = i + 1
        while (j < code.length && code[j] !== q && code[j] !== '\n') {
          if (code[j] === '\\') j++
          j++
        }
        tokens.push({ text: code.slice(i, j + 1), cls: 'cw-string' })
        i = j + 1
        continue
      }
      if (/\d/.test(code[i]) && (i === 0 || /[^a-zA-Z$_]/.test(code[i - 1]))) {
        const m = code.slice(i).match(/^\d+(\.\d+)?/)
        if (m) {
          tokens.push({ text: m[0], cls: 'cw-num' })
          i += m[0].length
          continue
        }
      }
      if (/[a-zA-Z_$]/.test(code[i])) {
        const m = code.slice(i).match(/^[a-zA-Z_$][a-zA-Z0-9_$]*/)
        if (m) {
          tokens.push({ text: m[0], cls: keywords.has(m[0]) ? 'cw-keyword' : undefined })
          i += m[0].length
          continue
        }
      }
      tokens.push({ text: code[i] })
      i++
    }
    return tokens
  }

  // CSS / SCSS
  private tokenizeCss(code: string): Token[] {
    const tokens: Token[] = []
    let i = 0
    while (i < code.length) {
      if (code.startsWith('/*', i)) {
        const end = code.indexOf('*/', i + 2)
        const text = end === -1 ? code.slice(i) : code.slice(i, end + 2)
        tokens.push({ text, cls: 'cw-comment' })
        i += text.length
        continue
      }
      if (code[i] === '"' || code[i] === "'") {
        const q = code[i]
        let j = i + 1
        while (j < code.length && code[j] !== q) j++
        tokens.push({ text: code.slice(i, j + 1), cls: 'cw-string' })
        i = j + 1
        continue
      }
      if (/\d/.test(code[i]) && (i === 0 || /[^a-zA-Z]/.test(code[i - 1]))) {
        const m = code.slice(i).match(/^\d+(\.\d+)?(px|em|rem|%|vh|vw|dvh|dvw|s|ms|deg|fr|ch|ex)?/)
        if (m) {
          tokens.push({ text: m[0], cls: 'cw-num' })
          i += m[0].length
          continue
        }
      }
      if (/[a-zA-Z-]/.test(code[i])) {
        const m = code.slice(i).match(/^-?[a-zA-Z][a-zA-Z0-9-]*/)
        if (m) {
          const after = code.slice(i + m[0].length).match(/^\s*(:)(?!:)/)
          tokens.push({ text: m[0], cls: after ? 'cw-attr' : 'cw-tag' })
          i += m[0].length
          continue
        }
      }
      tokens.push({ text: code[i] })
      i++
    }
    return tokens
  }

  // JSON
  private tokenizeJson(code: string): Token[] {
    const tokens: Token[] = []
    let i = 0
    while (i < code.length) {
      if (code[i] === '"') {
        let j = i + 1
        while (j < code.length && !(code[j] === '"' && code[j - 1] !== '\\')) j++
        const str = code.slice(i, j + 1)
        const after = code.slice(j + 1).match(/^\s*:/)
        tokens.push({ text: str, cls: after ? 'cw-attr' : 'cw-string' })
        i = j + 1
        continue
      }
      if (/[-\d]/.test(code[i]) && (i === 0 || /[^a-zA-Z]/.test(code[i - 1]))) {
        const m = code.slice(i).match(/^-?\d+(\.\d+)?([eE][+-]?\d+)?/)
        if (m) {
          tokens.push({ text: m[0], cls: 'cw-num' })
          i += m[0].length
          continue
        }
      }
      const kw = code.slice(i).match(/^(true|false|null)/)
      if (kw) {
        tokens.push({ text: kw[0], cls: 'cw-keyword' })
        i += kw[0].length
        continue
      }
      tokens.push({ text: code[i] })
      i++
    }
    return tokens
  }

  // Python
  private tokenizePython(code: string): Token[] {
    const keywords = new Set([
      'def',
      'class',
      'import',
      'from',
      'return',
      'if',
      'elif',
      'else',
      'for',
      'while',
      'with',
      'as',
      'try',
      'except',
      'finally',
      'raise',
      'yield',
      'lambda',
      'not',
      'and',
      'or',
      'in',
      'is',
      'pass',
      'break',
      'continue',
      'True',
      'False',
      'None',
      'async',
      'await',
      'global',
      'nonlocal',
      'del',
      'assert',
    ])
    const tokens: Token[] = []
    let i = 0
    while (i < code.length) {
      if (code[i] === '#') {
        const end = code.indexOf('\n', i)
        const text = end === -1 ? code.slice(i) : code.slice(i, end)
        tokens.push({ text, cls: 'cw-comment' })
        i += text.length
        continue
      }
      if (code.startsWith('"""', i) || code.startsWith("'''", i)) {
        const q = code.slice(i, i + 3)
        const end = code.indexOf(q, i + 3)
        const text = end === -1 ? code.slice(i) : code.slice(i, end + 3)
        tokens.push({ text, cls: 'cw-string' })
        i += text.length
        continue
      }
      if (code[i] === '"' || code[i] === "'") {
        const q = code[i]
        let j = i + 1
        while (j < code.length && code[j] !== q && code[j] !== '\n') {
          if (code[j] === '\\') j++
          j++
        }
        tokens.push({ text: code.slice(i, j + 1), cls: 'cw-string' })
        i = j + 1
        continue
      }
      if (code[i] === '@') {
        const m = code.slice(i).match(/^@[a-zA-Z_][a-zA-Z0-9_.]*/)
        if (m) {
          tokens.push({ text: m[0], cls: 'cw-attr' })
          i += m[0].length
          continue
        }
      }
      if (/\d/.test(code[i]) && (i === 0 || /[^a-zA-Z_]/.test(code[i - 1]))) {
        const m = code.slice(i).match(/^\d+(\.\d+)?/)
        if (m) {
          tokens.push({ text: m[0], cls: 'cw-num' })
          i += m[0].length
          continue
        }
      }
      if (/[a-zA-Z_]/.test(code[i])) {
        const m = code.slice(i).match(/^[a-zA-Z_][a-zA-Z0-9_]*/)
        if (m) {
          tokens.push({ text: m[0], cls: keywords.has(m[0]) ? 'cw-keyword' : undefined })
          i += m[0].length
          continue
        }
      }
      tokens.push({ text: code[i] })
      i++
    }
    return tokens
  }

  // ── Copy ──────────────────────────────────────────────────────────────────

  private async handleCopy() {
    await navigator.clipboard.writeText(this.raw || this.extractRaw())
    this.copied = true
    setTimeout(() => {
      this.copied = false
    }, 1800)
  }

  private copyIcon() {
    if (this.copied) {
      return svg`<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="2 8 6 12 14 4"/>
      </svg>`
    }
    return svg`<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="5" y="5" width="9" height="9" rx="2"/>
      <path d="M11 5V3a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
    </svg>`
  }

  // ── Render ────────────────────────────────────────────────────────────────

  render() {
    return html`
      ${this.hideChrome
        ? nothing
        : html` <div class="chrome">
            <span class="dot dot-red"></span>
            <span class="dot dot-yellow"></span>
            <span class="dot dot-green"></span>
            <span class="filename">${this.filename}</span>
            ${this.copy
              ? html` <button
                  class="copy-btn ${this.copyLabel ? 'has-label' : ''}"
                  @click=${this.handleCopy}
                  aria-label=${this.copied ? 'Copied' : 'Copy'}
                >
                  ${this.copyIcon()}
                  ${this.copyLabel
                    ? html`<span>${this.copied ? 'Copied!' : 'Copy'}</span>`
                    : nothing}
                </button>`
              : nothing}
          </div>`}
      <div class="body">
        <div class="code-area">
          ${this.type
            ? html`<pre class="sizer" aria-hidden="true">${unsafeHTML(this.highlighted)}</pre>`
            : nothing}
          <pre>
${unsafeHTML(this.renderPartial())}${this.typing
              ? html`<span class="cursor"></span>`
              : nothing}</pre
          >
        </div>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'motion-code': MotionCode
  }
}
