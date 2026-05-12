import 'dotenv/config'
import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { AuthModule } from './auth/auth.module'
import { NotificationsModule } from './notifications/notifications.module'
import { PrismaModule } from './prisma/prisma.module'
import { ProjectsModule } from './projects/projects.module'
import { PunishmentsModule } from './punishments/punishments.module'
import { SuppliersModule } from './suppliers/suppliers.module'
import { UsersModule } from './users/users.module'
import { AppController } from './app.controller'

function getJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim()
  const weakSecrets = new Set([
    ['change', 'me'].join('-'),
    ['dev', 'only', 'change', 'me'].join('-'),
    ['123', '456'].join('')
  ])
  if (!secret || secret.length < 32 || weakSecrets.has(secret)) {
    throw new Error('JWT_SECRET 必须在环境变量中配置为不少于 32 位的强随机字符串')
  }
  return secret
}

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: getJwtSecret(),
      signOptions: { expiresIn: '12h' }
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    SuppliersModule,
    PunishmentsModule,
    ProjectsModule,
    NotificationsModule
  ],
  controllers: [AppController]
})
export class AppModule {}
