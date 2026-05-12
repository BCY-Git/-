import { IsString, MinLength } from 'class-validator'

export class LoginDto {
  @IsString()
  username: string

  @IsString()
  password: string
}

export class PasswordChangeDto {
  @IsString()
  old_password: string

  @IsString()
  @MinLength(6)
  new_password: string
}

