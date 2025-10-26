import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load .env.local explicitly BEFORE creating PrismaClient
dotenv.config({ path: resolve(__dirname, '.env.local') })

// Also load .env as fallback
dotenv.config({ path: resolve(__dirname, '.env') })

console.log('DATABASE_URL:', process.env.DATABASE_URL)

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || process.env.DIRECT_URL
    }
  }
})

async function main() {
  console.log('🔍 Testing Prisma Client connection to NCP PostgreSQL...\n')

  // Test 1: Count organizations
  const orgCount = await prisma.organizations.count()
  console.log(`✅ Organizations table: ${orgCount} records`)

  // Test 2: Count user_profiles
  const userCount = await prisma.user_profiles.count()
  console.log(`✅ User Profiles table: ${userCount} records`)

  // Test 3: Count aed_data
  const aedCount = await prisma.aed_data.count()
  console.log(`✅ AED Data table: ${aedCount} records`)

  // Test 4: List all tables (via raw query)
  const tables: any[] = await prisma.$queryRaw`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'aedpics'
    ORDER BY table_name
  `

  console.log(`\n📊 Total tables in aedpics schema: ${tables.length}`)
  console.log('Tables:', tables.map(t => t.table_name).join(', '))

  console.log('\n🎉 Prisma Client is working perfectly with NCP PostgreSQL!')
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
