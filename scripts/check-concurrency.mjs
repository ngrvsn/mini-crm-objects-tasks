import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const scenario = fileURLToPath(
  new URL('./check-object-delete-race.mjs', import.meta.url)
)
for (const mode of ['create', 'move']) {
  execFileSync(process.execPath, [scenario, mode], { stdio: 'inherit' })
}
