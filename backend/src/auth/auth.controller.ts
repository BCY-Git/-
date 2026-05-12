import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../common/current-user.decorator'
import { toUserRead } from '../common/formatters'
import { AuthGuard } from '../common/auth.guard'
import { AuthService } from './auth.service'
import { LoginDto, PasswordChangeDto } from './auth.dto'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto)
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: any) {
    return toUserRead(user)
  }

  @Put('password')
  @UseGuards(AuthGuard)
  changePassword(@CurrentUser() user: any, @Body() dto: PasswordChangeDto) {
    return this.authService.changePassword(user, dto)
  }
}
