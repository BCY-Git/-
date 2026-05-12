import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common'
import { AuthGuard } from '../common/auth.guard'
import { Roles } from '../common/roles.decorator'
import { RolesGuard } from '../common/roles.guard'
import { SupplierDto } from './suppliers.dto'
import { SuppliersService } from './suppliers.service'

@Controller('suppliers')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin', 'super_admin')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  list() {
    return this.suppliersService.list()
  }

  @Post()
  create(@Body() dto: SupplierDto) {
    return this.suppliersService.create(dto)
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: SupplierDto) {
    return this.suppliersService.update(id, dto)
  }

  @Delete(':id')
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.suppliersService.delete(id)
  }
}
