import { defineConfig } from 'drizzle-kit'
import { env } from './src/config/env'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env['DATABASE_URL'] ?? env.DATABASE_URL },
  schemaFilter: ['ai'],
  verbose: true,
  strict: true,
})
