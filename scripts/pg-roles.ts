// ============================================================
// NOVA — создание ролей/БД для локального PG песочницы
// (минимальный набор бинарников @embedded-postgres без psql)
// ============================================================
import { PrismaClient } from '@prisma/client'

const ADMIN_URL = 'postgresql://postgres:postgres@127.0.0.1:5433/postgres'

async function main() {
  const admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } })

  // Роли (идемпотентно)
  const roles: Array<[string, string]> = [
    ['nova', "CREATE ROLE nova LOGIN SUPERUSER PASSWORD 'nova_local'"],
    ['nova_app', "CREATE ROLE nova_app LOGIN NOSUPERUSER PASSWORD 'nova_app_local'"],
    ['anon', "CREATE ROLE anon LOGIN NOSUPERUSER PASSWORD 'anon_local'"],
    ['authenticated', "CREATE ROLE authenticated LOGIN NOSUPERUSER PASSWORD 'auth_local'"],
  ]
  for (const [name, ddl] of roles) {
    const exists = await admin.$queryRawUnsafe<Array<{ c: bigint }>>(
      `SELECT 1 AS c FROM pg_roles WHERE rolname = '${name}'`,
    )
    if (exists.length === 0) {
      await admin.$executeRawUnsafe(ddl)
      console.log(`роль ${name} создана`)
    } else {
      console.log(`роль ${name} уже существует`)
    }
  }

  // База nova (CREATE DATABASE нельзя в транзакции — через unprepared execute)
  const dbs = await admin.$queryRawUnsafe<Array<{ datname: string }>>(
    `SELECT datname FROM pg_database WHERE datname = 'nova'`,
  )
  if (dbs.length === 0) {
    await admin.$executeRawUnsafe(`CREATE DATABASE nova OWNER nova`)
    console.log('база nova создана')
  } else {
    console.log('база nova уже существует')
  }
  await admin.$executeRawUnsafe(`ALTER DATABASE nova OWNER TO nova`)
  await admin.$disconnect()
  console.log('=== Роли и БД готовы ===')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
