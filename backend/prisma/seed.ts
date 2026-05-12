import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

function getInitialAdminPassword() {
  const password = process.env.INIT_ADMIN_PASSWORD?.trim()
  if (!password || password.length < 12 || password === ['123', '456'].join('')) {
    throw new Error('INIT_ADMIN_PASSWORD 必须在环境变量中配置为不少于 12 位的强初始密码')
  }
  return password
}

async function upsertUser(username: string, password: string, role: string, displayName: string, email: string) {
  const passwordHash = await bcrypt.hash(password, 10)
  await prisma.user.upsert({
    where: { username },
    update: { role, displayName, email, isActive: true },
    create: { username, passwordHash, role, displayName, email, isActive: true }
  })
}

async function main() {
  await upsertUser('admin', getInitialAdminPassword(), 'super_admin', '超级管理员', '')

  await prisma.systemConfig.upsert({
    where: { key: 'global_pointer' },
    update: { value: '0' },
    create: { key: 'global_pointer', value: '0' }
  })

  const count = await prisma.supplier.count({ where: { isDeleted: false } })
  if (count === 0) {
    await prisma.supplier.createMany({
      data: [
        {
          name: 'A供应商',
          rank: 1,
          qualEquipment: true,
          qualSystem: true,
          activeProjectCount: 0,
          contactName: '联系人一'
        },
        {
          name: 'B供应商',
          rank: 2,
          qualEquipment: true,
          qualSystem: true,
          activeProjectCount: 0,
          contactName: '联系人二'
        },
        {
          name: 'C供应商',
          rank: 3,
          qualEquipment: false,
          qualSystem: true,
          activeProjectCount: 0,
          contactName: '联系人三'
        }
      ]
    })
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
