import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { UsersModule } from '../users/users.module'
import { SsoController } from './sso.controller'
import { SsoService } from './sso.service'

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [SsoController],
  providers: [SsoService]
})

export class SsoModule {}
