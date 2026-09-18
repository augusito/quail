import { postgresAdapter } from '@payloadcms/db-postgres'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { AlumniProfiles } from './collections/AlumniProfiles'
import { Announcements } from './collections/Announcements'
import { Cohorts } from './collections/Cohorts'
import { Contracts } from './collections/Contracts'
import { Documents } from './collections/Documents'
import { Enrollments } from './collections/Enrollments'
import { Evaluations } from './collections/Evaluations'
import { Files } from './collections/Files'
import { LogbookEntries } from './collections/LogbookEntries'
import { Media } from './collections/Media'
import { MediaAssets } from './collections/MediaAssets'
import { ModuleNotes } from './collections/ModuleNotes'
import { Modules } from './collections/Modules'
import { Scores } from './collections/Scores'
import { TrainingSessions } from './collections/TrainingSessions'
import { Users } from './collections/Users'
import { Workplans } from './collections/Workplans'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Postgres is the production adapter (§7, §10 of the proposal). SQLite is used
// for local development and tests so contributors don't need a Postgres
// instance running. Select via PAYLOAD_DATABASE=postgres|sqlite (defaults to
// sqlite outside of production).
const databaseAdapter =
  process.env.PAYLOAD_DATABASE === 'postgres' ||
  (process.env.PAYLOAD_DATABASE !== 'sqlite' && process.env.NODE_ENV === 'production')
    ? postgresAdapter({
        pool: {
          connectionString: process.env.DATABASE_URL || '',
        },
      })
    : sqliteAdapter({
        client: {
          url: process.env.DATABASE_URL || 'file:./she-delivers.db',
        },
      })

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [
    Users,
    Media,
    Files,
    Cohorts,
    Enrollments,
    Contracts,
    Modules,
    TrainingSessions,
    ModuleNotes,
    Scores,
    LogbookEntries,
    Evaluations,
    Workplans,
    Documents,
    MediaAssets,
    AlumniProfiles,
    Announcements,
  ],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: databaseAdapter,
  sharp,
  plugins: [],
})
