import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { customElementVsCodePlugin } from 'custom-element-vs-code-integration'
import { customElementJetBrainsPlugin } from 'custom-element-jet-brains-integration'

/**
 * The analyzer has no TypeChecker, so `type.text` is the verbatim annotation:
 * `from: StaggerFrom` emits `"StaggerFrom"` rather than the literal union. That
 * leaves every consumer — editor completions, design tooling — with a type name
 * it cannot enumerate. Collect the aliases from the co-located `*.types.ts`
 * files and substitute them in.
 */
function resolveTypeAliases() {
  const aliases = new Map()

  const collect = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        collect(path)
      } else if (entry.name.endsWith('.types.ts')) {
        const source = ts.createSourceFile(
          path,
          readFileSync(path, 'utf8'),
          ts.ScriptTarget.ES2020,
          true,
        )
        source.forEachChild((node) => {
          if (!ts.isTypeAliasDeclaration(node)) return
          if (!ts.isUnionTypeNode(node.type)) return
          const members = node.type.types
          if (!members.every((t) => ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal)))
            return
          aliases.set(node.name.getText(), members.map((t) => `'${t.literal.text}'`).join(' | '))
        })
      }
    }
  }

  return {
    name: 'motion-resolve-type-aliases',
    initialize() {
      collect('src')
    },
    packageLinkPhase({ customElementsManifest }) {
      const substitute = (typed) => {
        const text = typed?.type?.text
        if (text && aliases.has(text)) typed.type.text = aliases.get(text)
      }
      for (const mod of customElementsManifest?.modules ?? []) {
        for (const declaration of mod.declarations ?? []) {
          declaration.attributes?.forEach(substitute)
          declaration.members?.forEach(substitute)
        }
      }
    },
  }
}

/**
 * The analyzer's class-JSDoc handler switches on a fixed set of tags and
 * silently drops everything else, `@example` included. Every component ships
 * usage markup in one, so preserve it under an `examples` array.
 */
function preserveExamples() {
  const commentText = (comment) =>
    typeof comment === 'string'
      ? comment
      : Array.isArray(comment)
        ? comment.map((part) => part.text ?? '').join('')
        : ''

  /** Unwrap the ```html fence so consumers get bare markup. */
  const unfence = (raw) => {
    const fenced = raw.match(/^```[a-z]*\n([\s\S]*?)\n?```$/)
    return (fenced ? fenced[1] : raw).trim()
  }

  return {
    name: 'motion-preserve-examples',
    analyzePhase({ ts, node, moduleDoc }) {
      if (!ts.isClassDeclaration(node) || !node.name) return
      const declaration = moduleDoc?.declarations?.find((d) => d.name === node.name.getText())
      if (!declaration) return

      const examples = (node.jsDoc ?? [])
        .flatMap((doc) => doc.tags ?? [])
        .filter((tag) => tag.tagName?.getText() === 'example')
        .map((tag) => unfence(commentText(tag.comment)))
        .filter(Boolean)

      if (examples.length) declaration.examples = examples
    },
  }
}

const DOCS = 'https://www.motion-components.dev/docs'

/** Elements documented on another element's page. */
const DOCS_PAGE = {
  'motion-theme-icon': 'motion-theme-toggle',
  'motion-state-icon': 'motion-icon-state',
}

/** Docs pages live at `/docs/<section>/<tag>/`, where the section is the element's `src/` folder. */
const sections = new Map(
  readdirSync('src', { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((section) =>
      readdirSync(join('src', section.name))
        .filter((name) => name.startsWith('motion-'))
        .map((name) => [name, section.name]),
    ),
)

function docsReference(tag) {
  const page = DOCS_PAGE[tag] ?? tag
  return { name: 'Documentation', url: `${DOCS}/${sections.get(page)}/${page}/` }
}

const EDITOR_DESCRIPTION = 'editorDescription'

const declarations = (manifest) =>
  (manifest?.modules ?? []).flatMap((mod) => mod.declarations ?? [])

/**
 * The editor plugins list slots, events, CSS properties, parts and methods in
 * an element's hover docs, but not its attributes. Write a description with an
 * attribute list for them to read, and remove it again after they have run.
 */
function editorDescriptions() {
  const line = (attr) => {
    const description = attr.description?.replace(/\s*\n\s*/g, ' ')
    const defaultValue = attr.default === undefined ? '' : ` _(default: ${attr.default})_`
    return `- **${attr.name}**${description ? ` - ${description}` : ''}${defaultValue}`
  }

  return [
    {
      name: 'motion-editor-descriptions',
      packageLinkPhase({ customElementsManifest }) {
        for (const declaration of declarations(customElementsManifest)) {
          if (!declaration.tagName) continue
          const attributes = declaration.attributes ?? []
          declaration[EDITOR_DESCRIPTION] = attributes.length
            ? `${declaration.description ?? ''}\n\n### **Attributes:**\n${attributes.map(line).join('\n')}`
            : declaration.description
        }
      },
    },
    {
      name: 'motion-editor-descriptions-cleanup',
      packageLinkPhase({ customElementsManifest }) {
        for (const declaration of declarations(customElementsManifest)) {
          delete declaration[EDITOR_DESCRIPTION]
        }
      },
    },
  ]
}

const [editorDescription, editorDescriptionCleanup] = editorDescriptions()

export default {
  globs: ['src/**/*.ts'],
  exclude: ['src/**/*.types.ts', 'src/**/*.d.ts', 'src/**/*.test.ts', 'src/test/**'],
  outdir: 'dist',
  litelement: true,
  packagejson: true,
  dev: false,
  plugins: [
    resolveTypeAliases(),
    preserveExamples(),
    editorDescription,
    customElementVsCodePlugin({
      outdir: 'dist',
      descriptionSrc: EDITOR_DESCRIPTION,
      referencesTemplate: (_, tag) => [docsReference(tag)],
    }),
    customElementJetBrainsPlugin({
      outdir: 'dist',
      descriptionSrc: EDITOR_DESCRIPTION,
      referenceTemplate: (_, tag) => docsReference(tag),
    }),
    editorDescriptionCleanup,
  ],
}
