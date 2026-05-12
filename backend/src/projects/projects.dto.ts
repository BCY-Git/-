import { IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator'

export class CreateProjectDto {
  @IsString()
  @MaxLength(256)
  name: string

  @IsOptional()
  @IsString()
  overview?: string

  @IsNumber()
  @Min(0.01)
  budget_wan: number

  @IsIn(['装备类涉密', '信息系统集成类涉密', '公开'])
  secret_level: string

  @IsString()
  @MaxLength(64)
  manager_name: string

  @IsString()
  @MaxLength(128)
  contact: string
}

export class ReviewRerunRequestDto {
  @IsIn(['approved', 'rejected'])
  status: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string
}
