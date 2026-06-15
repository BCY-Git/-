import { Transform } from 'class-transformer'
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator'

export class CreateUserDto {
  @IsString()
  username: string

  @IsString()
  @MinLength(6)
  password: string

  @IsOptional()
  @IsString()
  display_name?: string

  @IsOptional()
  @Transform(({ value }) => value || undefined)
  @IsEmail()
  email?: string

  @IsOptional()
  @IsBoolean()
  is_active?: boolean
}

export class UpdateRoleDto {
  @IsIn(['admin', 'user'])
  role: string
}

export class UpdateActiveDto {
  @IsBoolean()
  is_active: boolean
}
