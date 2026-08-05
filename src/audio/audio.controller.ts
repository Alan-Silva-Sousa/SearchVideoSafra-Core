import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Res,
  HttpCode,
  Req,
  UseGuards,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { CanonicalVideoService } from './canonical-video.service';
import { JwtAuthGuard } from '../user/jwt-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';

@ApiTags('Áudio')
@Controller('audio')
@UseGuards(JwtAuthGuard)
export class AudioController {
  constructor(private readonly audioService: CanonicalVideoService) {}

  private groups(req: Request & { user?: { genesysGroupIds?: string[] } }) {
    const groups = req.user?.genesysGroupIds || [];
    if (!groups.length) {
      throw new ForbiddenException('Usuário sem grupo autorizado');
    }
    return groups;
  }

  private accessContext(req: Request): string {
    const value = req.header('x-access-group')?.trim().toLowerCase() || '';
    if (!/^[a-z0-9-]{1,100}$/.test(value)) {
      throw new ForbiddenException('Contexto de acesso obrigatório');
    }
    return value;
  }

  @Get()
  @ApiOperation({
    summary: 'Listar áudios com filtros',
    description:
      'Retorna lista de gravações de áudio com filtros opcionais. Máximo 500 registros.',
  })
  @ApiQuery({
    name: 'filterType',
    required: false,
    description:
      'Tipo de filtro (RecordStart, ANI, Agent, Campaign, Disposition)',
    example: 'RecordStart',
  })
  @ApiQuery({
    name: 'filterValue',
    required: false,
    description: 'Valor do filtro',
    example: '2025-01-26',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de áudios retornada com sucesso',
  })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  findAll(
    @Req() req: Request & { user?: { genesysGroupIds?: string[] } },
    @Query('filterType') filterType: string | string[] = '',
    @Query('filterValue') filterValue: string | string[] = '',
  ) {
    const types = Array.isArray(filterType) ? filterType : [filterType];
    const values = Array.isArray(filterValue) ? filterValue : [filterValue];

    return this.audioService.findAll(
      this.groups(req),
      this.accessContext(req),
      types,
      values,
    );
  }

  @Get('download/:id')
  @ApiOperation({
    summary: 'Download de áudio',
    description:
      'Faz download do arquivo de áudio descriptografado (Content-Disposition: attachment)',
  })
  @ApiParam({
    name: 'id',
    description: 'CallIDMaster do áudio',
    example: 'abc123',
  })
  @ApiQuery({
    name: 'date',
    description: 'Data do áudio (YYYY-MM-DD)',
    example: '2025-01-26',
  })
  @ApiResponse({
    status: 200,
    description: 'Arquivo de áudio (stream descriptografado)',
    content: { 'audio/wav': {} },
  })
  @ApiResponse({ status: 404, description: 'Arquivo de áudio não encontrado' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  async downloadOne(
    @Param('id') id: string,
    @Query('date') date: string,
    @Req() req: Request & { user?: { genesysGroupIds?: string[] } },
    @Res() res: Response,
  ) {
    const video = await this.audioService.getVideoFile(
      this.groups(req),
      this.accessContext(req),
      id,
    );

    if (!video) {
      throw new NotFoundException('Vídeo não encontrado');
    }
    res.set({
      'Content-Type': video.contentType,
      'Content-Disposition': `attachment; filename="${video.fileName}"`,
      'Content-Length': video.buffer.length,
    });
    res.send(video.buffer);
  }

  @Get('play/:id')
  @ApiOperation({
    summary: 'Reproduzir áudio (inline)',
    description:
      'Stream do áudio para reprodução no browser (Content-Disposition: inline)',
  })
  @ApiParam({
    name: 'id',
    description: 'CallIDMaster do áudio',
    example: 'abc123',
  })
  @ApiQuery({
    name: 'date',
    description: 'Data do áudio (YYYY-MM-DD)',
    example: '2025-01-26',
  })
  @ApiResponse({
    status: 200,
    description: 'Stream de áudio descriptografado',
    content: { 'audio/wav': {} },
  })
  @ApiResponse({ status: 404, description: 'Arquivo de áudio não encontrado' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  async playAudio(
    @Param('id') id: string,
    @Query('date') date: string,
    @Req() req: Request & { user?: { genesysGroupIds?: string[] } },
    @Res() res: Response,
  ) {
    const video = await this.audioService.getVideoFile(
      this.groups(req),
      this.accessContext(req),
      id,
    );

    if (!video) {
      throw new NotFoundException('Vídeo não encontrado');
    }
    res.set({
      'Content-Type': video.contentType,
      'Content-Disposition': `inline; filename="${video.fileName}"`,
      'Content-Length': video.buffer.length,
    });
    res.send(video.buffer);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Buscar áudio específico',
    description: 'Retorna metadados de um áudio específico',
  })
  @ApiParam({
    name: 'id',
    description: 'CallIDMaster do áudio',
    example: 'abc123',
  })
  @ApiQuery({
    name: 'date',
    description: 'Data do áudio (YYYY-MM-DD)',
    example: '2025-01-26',
  })
  @ApiResponse({ status: 200, description: 'Metadados do áudio retornados' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  findOne(
    @Param('id') id: string,
    @Query('date') date: string,
    @Req() req: Request & { user?: { genesysGroupIds?: string[] } },
  ) {
    return this.audioService.findOne(
      this.groups(req),
      this.accessContext(req),
      id,
    );
  }

  @Post('zip')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Download múltiplos áudios em ZIP',
    description:
      'Baixa múltiplos áudios em um arquivo ZIP (todos descriptografados)',
  })
  @ApiResponse({
    status: 200,
    description: 'Arquivo ZIP com áudios',
    content: { 'application/zip': {} },
  })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  async downloadZip(
    @Body('ids') ids: string[],
    @Body('date') date: string,
    @Req() req: Request & { user?: { genesysGroupIds?: string[] } },
    @Res() res: Response,
  ) {
    this.groups(req);
    this.accessContext(req);
    throw new ForbiddenException(
      'Download em lote será habilitado após auditoria',
    );
  }

  @Post('csv')
  @ApiOperation({
    summary: 'Export metadados (CSV)',
    description:
      'Retorna metadados de múltiplos áudios em formato JSON para export CSV',
  })
  @ApiResponse({ status: 200, description: 'Lista de metadados retornada' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  async downloadCsv(
    @Body('ids') ids: string[],
    @Body('date') date: string,
    @Req() req: Request & { user?: { genesysGroupIds?: string[] } },
  ) {
    return this.audioService.findSome(
      this.groups(req),
      this.accessContext(req),
      ids,
    );
  }
}
