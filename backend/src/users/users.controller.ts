import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Put, UseGuards } from '@nestjs/common'
import { AuthGuard } from '../common/auth.guard'
import { CurrentUser } from '../common/current-user.decorator'
import { Roles } from '../common/roles.decorator'
import { RolesGuard } from '../common/roles.guard'
import { CreateUserDto, UpdateActiveDto, UpdateRoleDto } from './users.dto'
import { UsersService } from './users.service'

@Controller('users')
@UseGuards(AuthGuard, RolesGuard)
@Roles('super_admin')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}// 注入用户服务

  @Get()
  list() {
    return this.usersService.list()
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto)
  }

  @Put(':id/role')
  updateRole(@CurrentUser() user: any, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRoleDto) {
    return this.usersService.updateRole(user, id, dto)
  }

  @Patch(':id/active')
  updateActive(@CurrentUser() user: any, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateActiveDto) {
    return this.usersService.updateActive(user, id, dto)
  }
}
