import { defineConfig } from 'drizzle-kit'

import { env } from './src/config/env'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: env.DATABASE_URL },
  tablesFilter: ['projects_*', 'project_exports'],
  verbose: true,
  strict: true,
})
