import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, UseGuards } from '@nestjs/common'
import { AuthGuard } from '../common/auth.guard'
import { CurrentUser } from '../common/current-user.decorator'
import { Roles } from '../common/roles.decorator'
import { RolesGuard } from '../common/roles.guard'
import { PunishmentDto } from './punishments.dto'
import { PunishmentsService } from './punishments.service'

@Controller('punishments')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin', 'super_admin')
export class PunishmentsController {
  constructor(private readonly punishmentsService: PunishmentsService) {}

  @Get()
  list() {
    return this.punishmentsService.list()
  }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: PunishmentDto) {
    return this.punishmentsService.create(user, dto)
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: PunishmentDto) {
    return this.punishmentsService.update(id, dto)
  }

  @Patch(':id/lift')
  @Roles('super_admin')
  lift(@CurrentUser() user: any, @Param('id', ParseIntPipe) id: number) {
    return this.punishmentsService.lift(user, id)
  }

  @Delete(':id')
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.punishmentsService.delete(id)
  }
}
