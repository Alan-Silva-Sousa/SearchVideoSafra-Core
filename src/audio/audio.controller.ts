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
  BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as archiver from 'archiver';
import { CanonicalVideoService } from './canonical-video.service';
import { JwtAuthGuard } from '../user/jwt-auth.guard';
import { AccessGroupService } from '../access/access-group.service';
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
  constructor(
    private readonly audioService: CanonicalVideoService,
    private readonly accessGroups: AccessGroupService,
  ) {}

  private groups(req: Request & { user?: { genesysGroupIds?: string[] } }) {
    const groups = req.user?.genesysGroupIds || [];
    if (!groups.length) {
      throw new ForbiddenException('Usuário sem grupo autorizado');
    }
    return groups;
  }

  private accessContext(req: Request, queryValue = ''): string {
    const value =
      req.header('x-access-group')?.trim().toLowerCase() ||
      queryValue.trim().toLowerCase();
    if (!/^[a-z0-9-]{1,100}$/.test(value)) {
      throw new ForbiddenException('Contexto de acesso obrigatório');
    }
    return value;
  }

  private async authorize(
    req: Request & { user?: { genesysGroupIds?: string[] } },
    queryValue = '',
  ) {
    const groups = this.groups(req);
    const context = this.accessContext(req, queryValue);
    await this.accessGroups.assertAuthorized(groups, context);
    return { groups, context };
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
  async findAll(
    @Req() req: Request & { user?: { genesysGroupIds?: string[] } },
    @Query('filterType') filterType: string | string[] = '',
    @Query('filterValue') filterValue: string | string[] = '',
    @Query('filterField') filterField: string | string[] = '',
  ) {
    const { groups, context } = await this.authorize(req);
    const types = Array.isArray(filterType) ? filterType : [filterType];
    const values = Array.isArray(filterValue) ? filterValue : [filterValue];
    const fields = Array.isArray(filterField) ? filterField : [filterField];

    return this.audioService.findAll(groups, context, types, values, fields);
  }

  @Get('filter-fields')
  @ApiOperation({
    summary: 'Listar campos de participant data para filtros',
  })
  @ApiResponse({
    status: 200,
    description: 'Nomes de campos disponíveis',
  })
  async listFilterFields(
    @Req() req: Request & { user?: { genesysGroupIds?: string[] } },
  ) {
    const { groups, context } = await this.authorize(req);
    return this.audioService.filterFields(groups, context);
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
    @Query('accessGroup') accessGroup: string = '',
    @Req() req: Request & { user?: { genesysGroupIds?: string[] } },
    @Res() res: Response,
  ) {
    const { groups, context } = await this.authorize(req, accessGroup);
    const video = await this.audioService.getVideoFile(
      groups,
      context,
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
    const { groups, context } = await this.authorize(req);
    const video = await this.audioService.getVideoFile(
      groups,
      context,
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
  async findOne(
    @Param('id') id: string,
    @Query('date') date: string,
    @Query('accessGroup') accessGroup: string = '',
    @Req() req: Request & { user?: { genesysGroupIds?: string[] } },
  ) {
    const { groups, context } = await this.authorize(req, accessGroup);
    return this.audioService.findOne(groups, context, id);
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
    return this.streamZip(ids, req, res);
  }

  @Get('zip/download')
  async downloadZipByGet(
    @Query('id') id: string | string[] = [],
    @Query('accessGroup') accessGroup: string = '',
    @Req() req: Request & { user?: { genesysGroupIds?: string[] } },
    @Res() res: Response,
  ) {
    const ids = Array.isArray(id) ? id : [id];
    return this.streamZip(ids, req, res, accessGroup);
  }

  private async streamZip(
    ids: string[],
    req: Request & { user?: { genesysGroupIds?: string[] } },
    res: Response,
    accessGroup = '',
  ) {
    const uniqueIds = [
      ...new Set(
        (Array.isArray(ids) ? ids : []).filter(
          (id): id is string => typeof id === 'string' && id.trim().length > 0,
        ),
      ),
    ];
    if (!uniqueIds.length) {
      throw new BadRequestException('Nenhum vídeo foi selecionado');
    }
    if (uniqueIds.length > 50) {
      throw new BadRequestException('Selecione no máximo 50 vídeos por ZIP');
    }

    const { groups, context: accessContext } = await this.authorize(
      req,
      accessGroup,
    );
    const authorized = await this.audioService.findSome(
      groups,
      accessContext,
      uniqueIds,
    );
    if (!authorized.length) {
      throw new NotFoundException('Nenhum vídeo autorizado foi encontrado');
    }

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="videos.zip"',
    });
    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', (error) => res.destroy(error));
    archive.pipe(res);

    for (const [index, video] of authorized.entries()) {
      const object = await this.audioService.getVideoStream(
        groups,
        accessContext,
        video.CallIDMaster,
      );
      if (!object) continue;
      archive.append(object.stream, {
        name: `${String(index + 1).padStart(2, '0')}-${object.fileName}`,
      });
    }

    await archive.finalize();
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
    const { groups, context } = await this.authorize(req);
    return this.audioService.findSome(groups, context, ids);
  }
}
