import { spawnSync } from 'node:child_process'

const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const result = spawnSync(npmBin, ['run', 'build'], {
  env: {
    ...process.env,
    GITHUB_REPOSITORY: process.env.GITHUB_REPOSITORY ?? 'shauryamalhotra957-wq/terra-sentinel',
  },
  shell: process.platform === 'win32',
  stdio: 'inherit',
})

if (result.error) {
  console.error(result.error)
}

process.exit(result.status ?? 1)
