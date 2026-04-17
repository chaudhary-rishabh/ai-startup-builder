import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? 'postgresql://postgres:devpassword@localhost:5432/aistartup',
  },
  schemaFilter: ['billing'],
  verbose: true,
  strict: true,
})
