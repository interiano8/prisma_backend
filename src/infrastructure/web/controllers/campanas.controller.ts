import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import type { CampanasRepository } from '../../../domain/ports/out/campanas-repository.interface';

const TIPOS = [
  'TOTAL_FACTURA',
  'CANTIDAD_ITEM',
  'CATEGORIA',
  'TIPO_CLIENTE',
  'SIN_DESCUENTO',
  'SIN_ACUMULAR_PUNTOS',
];
const OPERADORES = ['GTE', 'LTE', 'EQ', 'NEQ', 'IN', 'CONTAINS'];

@Controller('campanas')
export class CampanasController {
  constructor(
    @Inject('CampanasRepository')
    private readonly campanasRepo: CampanasRepository,
  ) {}

  @Get()
  listCampanas() {
    return this.campanasRepo.listCampanas();
  }

  @Post()
  async createCampana(@Body() body: any) {
    return this.campanasRepo.createCampana(this.validateCampana(body));
  }

  @Put(':id')
  async updateCampana(@Param('id') id: string, @Body() body: any) {
    return this.campanasRepo.updateCampana(
      this.parseId(id),
      this.validateCampana(body),
    );
  }

  @Delete(':id')
  deleteCampana(@Param('id') id: string) {
    return this.campanasRepo.deleteCampana(this.parseId(id));
  }

  @Post(':id/condiciones')
  async createCondicion(@Param('id') id: string, @Body() body: any) {
    return this.campanasRepo.createCondicion(
      this.parseId(id),
      this.validateCondicion(body),
    );
  }

  @Put('condiciones/:cid')
  async updateCondicion(@Param('cid') cid: string, @Body() body: any) {
    return this.campanasRepo.updateCondicion(
      this.parseId(cid),
      this.validateCondicion(body),
    );
  }

  @Delete('condiciones/:cid')
  deleteCondicion(@Param('cid') cid: string) {
    return this.campanasRepo.deleteCondicion(this.parseId(cid));
  }

  @Get('tickets/:correlativo')
  async verificarTicket(@Param('correlativo') correlativo: string) {
    const ticket = await this.campanasRepo.getTicketByCorrelativo(correlativo);
    return { valido: !!ticket, ticket };
  }

  private parseId(raw: string): number {
    const id = Number(raw);
    if (isNaN(id)) throw new BadRequestException(`id inválido: ${raw}`);
    return id;
  }

  private validateCampana(body: any) {
    const modo = (body.modoEvaluacion || 'ALL').toUpperCase();
    if (!['ALL', 'ANY'].includes(modo)) {
      throw new BadRequestException(`modoEvaluacion inválido: ${modo}`);
    }
    return {
      nombre: body.nombre ?? null,
      fechaInicio: body.fechaInicio ? new Date(body.fechaInicio) : null,
      fechaFin: body.fechaFin ? new Date(body.fechaFin) : null,
      activo: body.activo ?? true,
      textoTicket: body.textoTicket ?? null,
      modoEvaluacion: modo,
      limitePorCliente:
        body.limitePorCliente != null ? Number(body.limitePorCliente) : null,
    };
  }

  private validateCondicion(body: any) {
    const tipo = (body.tipoEvaluacion || '').toUpperCase();
    const op = (body.operador || '').toUpperCase();
    if (!TIPOS.includes(tipo)) {
      throw new BadRequestException(`tipoEvaluacion inválido: ${tipo}`);
    }
    if (!OPERADORES.includes(op)) {
      throw new BadRequestException(`operador inválido: ${op}`);
    }
    return {
      tipoEvaluacion: tipo,
      operador: op,
      valorTexto: body.valorTexto ?? null,
      valorMonto: body.valorMonto != null ? Number(body.valorMonto) : null,
      valorCantidad:
        body.valorCantidad != null ? Number(body.valorCantidad) : null,
    };
  }
}