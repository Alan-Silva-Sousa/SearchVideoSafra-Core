import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Response } from 'express';
import * as archiver from 'archiver';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';
import { Gravacao } from './entities/gravacao.entity';
import { S3Service } from '../storage/s3.service';

@Injectable()
export class AudioService {
  constructor(
    @InjectRepository(Gravacao)
    private readonly repository: Repository<Gravacao>,
    private readonly s3Service: S3Service,
  ) {}

  private baseQuery(): SelectQueryBuilder<Gravacao> {
    return this.repository
      .createQueryBuilder('g')
      .select([
        'g.id AS "CallIDMaster"',
        'g.origem AS "ANI"',
        'g.destino AS "DNIS"',
        '(g.data_gravacao + g.hora_inicio) AS "RecordStart"',
        'COALESCE(g.duracao_segundos, 0) AS "RecordDuration"',
        'g.nome_arquivo AS "DestinationFileName"',
        'g.campanha_id AS "CampaignId"',
        'g.agente_id AS "AgentId"',
        'COALESCE(g.tamanho_bytes, 0)::float AS "DestinationFileSize"',
        'g.disposicao_id AS "Disposition"',
        'g.s3_bucket AS "S3Directory"',
        'g.s3_object_key AS "S3FileName"',
        'g.agente_nome AS "Username"',
        'g.agente_login AS "AgentLogin"',
        'g.campanha_nome AS "Campaignname"',
        'g.disposicao_nome AS "Dispositionname"',
        'g.direcao AS "Direction"',
        '\'video\' AS "MediaType"',
        'g.content_type AS "ContentType"',
        'g.cpf AS "CPF"',
        'g.cnpj AS "CNPJ"',
        'g.agencia AS "AGENCIA"',
        'g.conta AS "CONTA"',
        'g.ec AS "EC"',
        'g.contrato AS "CONTRATO"',
        'g.protocolo AS "PROTOCOLO"',
      ]);
  }

  async findAll(filterTypes: string[], filterValues: string[]) {
    let query = this.baseQuery();

    const textColumns: Record<string, string> = {
      ANI: 'g.origem',
      DNIS: 'g.destino',
      Agent: 'g.agente_nome',
      AgentLogin: 'g.agente_login',
      Campaign: 'g.campanha_nome',
      Format: 'g.content_type',
      CPF: 'g.cpf',
      CNPJ: 'g.cnpj',
      AGENCIA: 'g.agencia',
      CONTA: 'g.conta',
      EC: 'g.ec',
      CONTRATO: 'g.contrato',
      PROTOCOLO: 'g.protocolo',
    };
    let startDate: { value: string; index: number } | undefined;
    let endDate: { value: string; index: number } | undefined;
    const filters: Array<{
      condition: string;
      parameters: Record<string, string>;
    }> = [];

    filterTypes.forEach((type, index) => {
      const value = filterValues[index];
      if (!type || !value) return;

      if (type === 'RecordStart' || type === 'RecordStartStart') {
        startDate = { value, index };
      } else if (type === 'RecordStartEnd') {
        endDate = { value, index };
      } else if (type === 'Direction') {
        filters.push({
          condition: `g.direcao = :direction${index}`,
          parameters: { [`direction${index}`]: value },
        });
      } else if (textColumns[type]) {
        filters.push({
          condition: `${textColumns[type]} ILIKE :value${index}`,
          parameters: { [`value${index}`]: `%${value}%` },
        });
      }
    });

    if (startDate || endDate) {
      const dateConditions: string[] = [];
      const dateParameters: Record<string, string> = {};

      if (startDate) {
        dateConditions.push(`g.data_gravacao >= :startDate${startDate.index}`);
        dateParameters[`startDate${startDate.index}`] = startDate.value;
      }
      if (endDate) {
        dateConditions.push(`g.data_gravacao <= :endDate${endDate.index}`);
        dateParameters[`endDate${endDate.index}`] = endDate.value;
      }

      filters.push({
        condition: dateConditions.join(' AND '),
        parameters: dateParameters,
      });
    }

    if (filters.length) {
      query = query.andWhere(
        new Brackets((where) => {
          filters.forEach(({ condition, parameters }) => {
            where.orWhere(condition, parameters);
          });
        }),
      );
    }

    return query
      .orderBy('g.data_gravacao', 'DESC')
      .addOrderBy('g.hora_inicio', 'DESC')
      .limit(500)
      .getRawMany();
  }

  async findOne(id: string, _date?: string) {
    const data = await this.baseQuery()
      .andWhere('g.id = :id', { id })
      .getRawOne();
    return data;
  }

  async findSome(ids: string[], _date?: string) {
    if (!ids?.length) return [];
    return this.baseQuery().andWhere('g.id IN (:...ids)', { ids }).getRawMany();
  }

  async streamZipFromS3(ids: string[], response: Response) {
    const videos = await this.findSome(ids);
    if (!videos.length) {
      throw new BadRequestException('Nenhum vídeo válido foi selecionado');
    }

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', (error) => response.destroy(error));
    archive.pipe(response);

    for (const video of videos) {
      try {
        const object = await this.s3Service.getStream(
          video.S3Directory,
          video.S3FileName,
        );
        archive.append(object.stream, { name: video.DestinationFileName });
      } catch (error) {
        if (error instanceof NotFoundException) continue;
        throw error;
      }
    }

    await archive.finalize();
  }
}
