import { Transform } from 'class-transformer'
import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, Min } from 'class-validator'

export class SupplierDto {
  @IsString()
  name: string

  @IsInt()
  @Min(1)
  rank: number

  @IsBoolean()
  qual_equipment: boolean

  @IsBoolean()
  qual_system: boolean

  @IsInt()
  @Min(0)
  active_project_count: number

  @IsOptional()
  @IsString()
  contact_name?: string

  @IsOptional()
  @IsString()
  contact_phone?: string

  @IsOptional()
  @Transform(({ value }) => value || undefined)
  @IsEmail()
  email?: string
}
