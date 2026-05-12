import { Module } from '@nestjs/common'
import { PunishmentsController } from './punishments.controller'
import { PunishmentsService } from './punishments.service'

@Module({
  controllers: [PunishmentsController],
  providers: [PunishmentsService]
})
export class PunishmentsModule {}
