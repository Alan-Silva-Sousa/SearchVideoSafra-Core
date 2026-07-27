import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Response } from 'express';
import * as archiver from 'archiver';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { FilesystemService } from '../filesystem.service';
import { Gravacao } from './entities/gravacao.entity';

@Injectable()
export class AudioService {
  constructor(
    @InjectRepository(Gravacao)
    private readonly repository: Repository<Gravacao>,
    private readonly filesystemService: FilesystemService,
  ) {}

  private query(): SelectQueryBuilder<Gravacao> {
    return this.repository.createQueryBuilder('g').select([
      'g.id as "CallIDMaster"',
      'g.id_origem as "SourceId"',
      'g.origem as "ANI"',
      'g.destino as "DNIS"',
      '(g.data_gravacao + g.hora_inicio) as "RecordStart"',
      'COALESCE(g.duracao_segundos, 0) as "RecordDuration"',
      'g.nome_arquivo as "DestinationFileName"',
      'g.campanha_id as "CampaignId"',
      'g.campanha_nome as "Campaignname"',
      'g.agente_id as "AgentId"',
      'g.agente_nome as "Username"',
      'g.agente_login as "AgentLogin"',
      'COALESCE(g.tamanho_bytes, 0)::float as "DestinationFileSize"',
      'g.disposicao_id as "Disposition"',
      'g.disposicao_nome as "Dispositionname"',
      'g.s3_bucket as "S3Directory"',
      'g.s3_object_key as "S3FileName"',
      'g.direcao as "Direction"',
      '\'video\' as "MediaType"',
      'g.content_type as "ContentType"',
      'g.cpf as "CPF"',
      'g.cnpj as "CNPJ"',
      'g.agencia as "AGENCIA"',
      'g.conta as "CONTA"',
      'g.ec as "EC"',
      'g.contrato as "CONTRATO"',
      'g.protocolo as "PROTOCOLO"',
    ]);
  }

  private textFilter(query: SelectQueryBuilder<Gravacao>, column: string, value: string, index: number) {
    return query.andWhere(`${column} ILIKE :filter${index}`, {
      [`filter${index}`]: `%${value}%`,
    });
  }

  async findAll(types: string[], values: string[]) {
    let query = this.query();
    const range: { start?: string; end?: string } = {};

    types.forEach((type, index) => {
      const value = values[index];
      if (!type || !value) return;

      if (type === 'RecordStartStart') range.start = value;
      else if (type === 'RecordStartEnd') range.end = value;
      else if (type === 'RecordStart') query = query.andWhere('g.data_gravacao = :date', { date: value });
      else if (type === 'RecordStartHour') query = query.andWhere('EXTRACT(HOUR FROM g.hora_inicio) = :hour', { hour: Number(value.split(':')[0]) });
      else if (type === 'ANI') query = this.textFilter(query, 'g.origem', value, index);
      else if (type === 'DNIS') query = this.textFilter(query, 'g.destino', value, index);
      else if (type === 'AgentLogin') query = this.textFilter(query, 'g.agente_login', value, index);
      else if (type === 'Direction') query = query.andWhere(`g.direcao = :direction${index}`, { [`direction${index}`]: value });
      else if (type === 'Format') query = this.textFilter(query, 'g.content_type', value, index);
      else if (type === 'Agent') query = query.andWhere(`(g.agente_id = :agent${index} OR g.agente_nome ILIKE :agentLike${index} OR g.agente_login ILIKE :agentLike${index})`, { [`agent${index}`]: value, [`agentLike${index}`]: `%${value}%` });
      else if (type === 'Campaign') query = query.andWhere(`(g.campanha_id = :campaign${index} OR g.campanha_nome ILIKE :campaignLike${index})`, { [`campaign${index}`]: value, [`campaignLike${index}`]: `%${value}%` });
      else if (type === 'Disposition') query = query.andWhere(`(g.disposicao_id = :disposition${index} OR g.disposicao_nome ILIKE :dispositionLike${index})`, { [`disposition${index}`]: value, [`dispositionLike${index}`]: `%${value}%` });
      else {
        const columns: Record<string, string> = { CPF: 'g.cpf', CNPJ: 'g.cnpj', AGENCIA: 'g.agencia', CONTA: 'g.conta', EC: 'g.ec', CONTRATO: 'g.contrato', PROTOCOLO: 'g.protocolo' };
        if (columns[type]) query = this.textFilter(query, columns[type], value, index);
      }
    });

    if (range.start) query = query.andWhere('g.data_gravacao >= :dateStart', { dateStart: range.start });
    if (range.end) query = query.andWhere('g.data_gravacao <= :dateEnd', { dateEnd: range.end });

    return query.orderBy('g.data_gravacao', 'DESC').addOrderBy('g.hora_inicio', 'DESC').limit(500).getRawMany();
  }

  async findOne(id: string, _date?: string) {
    const data = await this.query().andWhere('g.id = :id', { id }).getRawOne();
    if (!data) return;

    const fileExists = data.S3Directory && data.S3FileName
      ? this.filesystemService.fileExists(data.S3Directory, data.S3FileName)
      : false;

    return {
      ...data,
      fileExists,
      filePath: data.S3Directory && data.S3FileName ? `s3://${data.S3Directory}/${data.S3FileName}` : null,
    };
  }

  async findSome(ids: string[], _date?: string) {
    if (!ids?.length) return [];
    return this.query().andWhere('g.id IN (:...ids)', { ids }).getRawMany();
  }

  async streamZipFromFilesystem(ids: string[], res: Response, date?: string) {
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    for (const id of ids) {
      try {
        const video = await this.findOne(id, date);
        if (!video?.fileExists) continue;
        const { stream } = this.filesystemService.getStream(video.S3Directory, video.S3FileName);
        archive.append(stream, { name: video.DestinationFileName || video.S3FileName });
      } catch (error) {
        console.error(`Erro ao adicionar o vídeo ${id}:`, error instanceof Error ? error.message : error);
      }
    }

    await archive.finalize();
  }
}
