import { Controller, Get, Param, ParseIntPipe, Put, UseGuards } from '@nestjs/common'
import { AuthGuard } from '../common/auth.guard'
import { CurrentUser } from '../common/current-user.decorator'
import { NotificationsService } from './notifications.service'

@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: any) {
    return this.notificationsService.list(user)
  }

  @Put('read-all')
  readAll(@CurrentUser() user: any) {
    return this.notificationsService.readAll(user)
  }

  @Put(':id/read')
  read(@CurrentUser() user: any, @Param('id', ParseIntPipe) id: number) {
    return this.notificationsService.read(user, id)
  }
}
