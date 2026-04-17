import { execSync } from 'node:child_process'
import { join } from 'node:path'
import * as readline from 'node:readline'

import chalk from 'chalk'
import { config as loadEnv } from 'dotenv'
import ora from 'ora'
import pg from 'pg'

import { getRepoRoot } from '../lib/repoRoot.js'

const { Pool } = pg

const SCHEMAS = [
  'analytics',
  'notifications',
  'billing',
  'ai',
  'projects',
  'users',
  'auth',
] as const

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

async function main(): Promise<void> {
  if (process.env['NODE_ENV'] === 'production') {
    console.error(
      chalk.red.bold(
        '\n  REFUSED: reset-db cannot run when NODE_ENV=production.\n  This command drops every application schema.\n',
      ),
    )
    process.exit(1)
  }

  const root = getRepoRoot()
  loadEnv({ path: join(root, '.env.local') })

  console.log(
    chalk.red.bold(
      '\n  EXTREMELY DESTRUCTIVE: This will DROP all application schemas and re-run migrations + seed.\n',
    ),
  )

  const answer = await prompt(chalk.yellow('Type RESET to confirm: '))
  if (answer !== 'RESET') {
    console.log(chalk.dim('Aborted.'))
    process.exit(1)
  }

  const databaseUrl = process.env['DATABASE_URL']
  if (!databaseUrl) {
    console.error(chalk.red('DATABASE_URL is not set.'))
    process.exit(1)
  }

  const pool = new Pool({ connectionString: databaseUrl })
  const shellOpt =
    process.platform === 'win32' ? (process.env['ComSpec'] ?? 'cmd.exe') : '/bin/bash'

  try {
    const s = ora('Dropping schemas…').start()
    for (const schema of SCHEMAS) {
      await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`)
    }
    s.succeed(chalk.green('All schemas dropped.'))
  } catch (e) {
    console.error(chalk.red('Drop failed:'), e)
    process.exitCode = 1
    await pool.end()
    return
  } finally {
    await pool.end()
  }

  try {
    console.log(chalk.cyan('Running migrations (pnpm run db:migrate)…'))
    execSync('pnpm run db:migrate', { cwd: root, stdio: 'inherit', env: process.env, shell: shellOpt })
  } catch {
    console.error(chalk.red('Migrations failed.'))
    process.exit(1)
  }

  try {
    console.log(chalk.cyan('Running seed (pnpm --filter @ai-startup-builder/scripts seed)…'))
    execSync('pnpm --filter @ai-startup-builder/scripts seed', {
      cwd: root,
      stdio: 'inherit',
      env: process.env,
      shell: shellOpt,
    })
  } catch {
    console.error(chalk.red('Seed failed.'))
    process.exit(1)
  }

  console.log(chalk.bold.green('\nDatabase reset complete.\n'))
}

await main()
