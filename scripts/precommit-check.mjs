import { execFileSync } from 'node:child_process'
import path from 'node:path'
import prettier from 'prettier'

const root = path.resolve(import.meta.dirname, '..')
const git = (...args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8' })
const staged = git(
  'diff',
  '--cached',
  '--name-only',
  '--diff-filter=ACMR',
  '-z'
)
  .split('\0')
  .filter(Boolean)
if (staged.length === 0) process.exit(0)

execFileSync('git', ['diff', '--cached', '--check'], {
  cwd: root,
  stdio: 'inherit'
})
const unstaged = new Set(
  git('diff', '--name-only', '-z').split('\0').filter(Boolean)
)
const partial = staged.filter(
  (file) =>
    unstaged.has(file) && /\.(?:[cm]?[jt]sx?|json|ya?ml|sql)$/.test(file)
)
if (partial.length)
  throw new Error(
    `Stage whole code files before committing: ${partial.join(', ')}`
  )

for (const file of staged) {
  const absolute = path.join(root, file)
  const info = await prettier.getFileInfo(absolute, {
    ignorePath: path.join(root, '.prettierignore')
  })
  if (info.ignored || !info.inferredParser) continue
  const content = git('show', `:${file}`)
  const config = await prettier.resolveConfig(absolute)
  if (!(await prettier.check(content, { ...config, filepath: absolute }))) {
    throw new Error(`Format and re-stage ${file}`)
  }
}

const run = (args) =>
  execFileSync('pnpm', args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  })
if (staged.some((file) => !/^[^/]+\.md$|^docs\//.test(file))) {
  run(['lint'])
  run(['typecheck'])
  run(['test'])
}
if (
  staged.some((file) => file === 'package.json' || file === 'pnpm-lock.yaml')
) {
  run(['audit'])
}
