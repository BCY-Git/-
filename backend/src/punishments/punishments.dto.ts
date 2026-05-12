import { IsInt, IsOptional, IsString } from 'class-validator'

export class PunishmentDto {
  @IsInt()
  supplier_id: number

  @IsString()
  start_date: string

  @IsString()
  end_date: string

  @IsOptional()
  @IsString()
  reason?: string
}
