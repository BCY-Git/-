import { IsString, MaxLength, MinLength } from 'class-validator'

export class LoginDto {
  @IsString()
  username: string

  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password: string
}

export class PasswordChangeDto {
  @IsString()
  @MaxLength(128)
  old_password: string

  @IsString()
  @MinLength(6)
  @MaxLength(128)
  new_password: string
}
