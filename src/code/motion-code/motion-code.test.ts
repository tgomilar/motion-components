import { describe, it, expect, beforeEach } from 'vitest'
import { fixture, html, elementUpdated } from '@open-wc/testing-helpers'
import { stubReducedMotion } from '../../test/helpers.js'
import type { MotionCode } from './motion-code.js'
import './motion-code.js'

const codeText = (el: MotionCode) =>
  el.shadowRoot?.querySelector('.body pre:not(.sizer)')?.textContent ?? ''

describe('motion-code', () => {
  beforeEach(() => stubReducedMotion(false))

  it('renders chrome, filename, and highlighted code from slotted content', async () => {
    const el = (await fixture(html`
      <motion-code filename="app.js">
        <div>const x = 1</div>
      </motion-code>
    `)) as MotionCode
    await elementUpdated(el)
    expect(el.shadowRoot?.querySelector('.chrome')).toBeTruthy()
    expect(el.shadowRoot?.querySelector('.filename')?.textContent).toBe('app.js')
    expect(codeText(el)).toContain('const x = 1')
    // js keyword highlighting
    const keyword = el.shadowRoot?.querySelector('.cw-keyword')
    expect(keyword?.textContent).toBe('const')
  })

  it('reads code from a pre child', async () => {
    const el = (await fixture(html`
      <motion-code>
        <pre><code>
        const a = '&lt;b&gt;'
          return a
      </code></pre>
      </motion-code>
    `)) as MotionCode
    await elementUpdated(el)
    expect(codeText(el)).toBe("const a = '<b>'\n  return a")
  })

  it('dedents code given as div lines', async () => {
    const host = document.createElement('div')
    host.innerHTML =
      '<motion-code><div>  if (a) {</div><div>    b()</div><div>  }</div></motion-code>'
    const el = (await fixture(host.firstElementChild!)) as MotionCode
    await elementUpdated(el)
    expect(codeText(el)).toBe('if (a) {\n  b()\n}')
  })

  it('hide-chrome removes the window chrome', async () => {
    const el = (await fixture(html`
      <motion-code hide-chrome><div>hi</div></motion-code>
    `)) as MotionCode
    await elementUpdated(el)
    expect(el.shadowRoot?.querySelector('.chrome')).toBeNull()
    expect(el.hideChrome).toBe(true)
  })

  it('setCode() tokenizes and renders programmatic HTML with tag highlighting', async () => {
    const el = (await fixture(html`<motion-code filename="page.html"></motion-code>`)) as MotionCode
    el.setCode('<div class="a">hi</div>')
    await elementUpdated(el)
    expect(codeText(el)).toContain('<div class="a">hi</div>')
    const tags = el.shadowRoot?.querySelectorAll('.cw-tag')
    expect((tags?.length ?? 0) > 0).toBe(true)
    const attr = el.shadowRoot?.querySelector('.cw-attr')
    expect(attr?.textContent).toBe('class')
  })

  it('reflects the compact attribute', async () => {
    const el = (await fixture(html`
      <motion-code compact><div>x</div></motion-code>
    `)) as MotionCode
    await elementUpdated(el)
    expect(el.hasAttribute('compact')).toBe(true)
  })

  it('type mode with reduced motion shows the full code immediately', async () => {
    stubReducedMotion(true)
    const el = (await fixture(html`
      <motion-code typing typing-loop="false" filename="a.js"><div>let y = 2</div></motion-code>
    `)) as MotionCode
    el.setCode('let y = 2')
    el.finish()
    await elementUpdated(el)
    expect(codeText(el)).toContain('let y = 2')
    expect(el.playState).toBe('finished')
  })

  it('renders empty output for empty input', async () => {
    const el = (await fixture(html`<motion-code filename="a.js"></motion-code>`)) as MotionCode
    await elementUpdated(el)
    expect(codeText(el).trim()).toBe('')
  })

  it('keeps a type-once block empty until it scrolls into view', async () => {
    stubReducedMotion(false)
    const spacer = document.createElement('div')
    spacer.style.height = '3000px'
    document.body.prepend(spacer)
    const el = (await fixture(html`
      <motion-code typing typing-loop="false"><pre>const x = 1</pre></motion-code>
    `)) as MotionCode
    await elementUpdated(el)
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(codeText(el).trim()).toBe('')
    spacer.remove()
  })

  it('shows the full code at once under reduced motion', async () => {
    stubReducedMotion(true)
    const el = (await fixture(html`
      <motion-code typing typing-loop="false"><pre>const x = 1</pre></motion-code>
    `)) as MotionCode
    await elementUpdated(el)
    expect(codeText(el)).toContain('const x = 1')
  })

  it('highlights shell commands, flags, strings, variables and comments', async () => {
    const el = (await fixture(html`
      <motion-code code-lang="sh">
        <pre>
$ npm install --save-dev "a b" # note
echo $HOME | grep -i home</pre
        >
      </motion-code>
    `)) as MotionCode
    await elementUpdated(el)
    const cls = (c: string) =>
      [...el.shadowRoot!.querySelectorAll(`.${c}`)].map((n) => n.textContent)
    expect(cls('cw-keyword')).toEqual(['npm', 'echo', 'grep'])
    expect(cls('cw-attr')).toEqual(['--save-dev', '-i'])
    expect(cls('cw-string')).toEqual(['"a b"'])
    expect(cls('cw-num')).toEqual(['$HOME'])
    expect(cls('cw-comment')).toEqual(['$ ', '# note'])
    expect(cls('cw-tag')).toEqual(['|'])
  })

  it('highlights background jobs, redirects and an unclosed ${ in shell code', async () => {
    const el = (await fixture(html`
      <motion-code code-lang="sh"><pre>npm run dev & cmd 2>&1 | tee log
echo \${HOME</pre></motion-code>
    `)) as MotionCode
    await elementUpdated(el)
    const cls = (c: string) =>
      [...el.shadowRoot!.querySelectorAll(`.${c}`)].map((n) => n.textContent)
    expect(cls('cw-keyword')).toEqual(['npm', 'cmd', 'tee', 'echo'])
    expect(cls('cw-tag')).toEqual(['&', '>&', '|'])
    expect(cls('cw-num')).toEqual(['\${HOME'])
    expect(el.shadowRoot!.textContent).toContain('echo ${HOME')
  })

  it('the code property reads and replaces the source', async () => {
    const el = (await fixture(html`<motion-code></motion-code>`)) as MotionCode
    el.code = 'let x = 1'
    await elementUpdated(el)
    expect(el.code).toBe('let x = 1')
    expect(el.shadowRoot!.textContent).toContain('let x = 1')
  })

  it('keeps code set before it connects, and after it moves', async () => {
    const el = document.createElement('motion-code') as MotionCode
    el.code = 'let x = 1'
    document.body.append(el)
    await elementUpdated(el)
    expect(el.code).toBe('let x = 1')
    expect(el.shadowRoot!.textContent).toContain('let x = 1')
    document.body.append(document.createElement('div'))
    document.body.lastElementChild!.append(el)
    await elementUpdated(el)
    expect(el.code).toBe('let x = 1')
    expect(el.shadowRoot!.textContent).toContain('let x = 1')
    el.parentElement!.remove()
  })
})
