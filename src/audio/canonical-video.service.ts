import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Pool } from 'pg';
import { Readable } from 'stream';
import * as fs from 'fs';

interface CanonicalVideoRow {
  recording_id: string;
  conversation_id: string;
  conversation_start_time: Date;
  duration_ms: string | null;
  initial_direction: string | null;
  ani: string | null;
  dnis: string | null;
  division_name: string | null;
  file_size: string | null;
  content_type: string | null;
  s3_bucket: string;
  s3_object_key: string;
  user_ids: string[] | null;
  cpf: string | null;
  cnpj: string | null;
  agencia: string | null;
  conta: string | null;
  contrato: string | null;
  protocolo: string | null;
  participant_attributes: Record<string, unknown> | null;
}

@Injectable()
export class CanonicalVideoService implements OnModuleDestroy {
  private readonly pool = new Pool({
    host: process.env.INGESTION_DB_HOST || 'ingestion-postgres',
    port: Number(process.env.INGESTION_DB_PORT || 5432),
    database: process.env.INGESTION_DB_NAME || 'safra_ingestion',
    user: process.env.INGESTION_DB_USER || 'safra_ingestion',
    password: process.env.INGESTION_DB_PASSWORD,
    max: 10,
  });
  private readonly s3 = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: this.s3Credentials(),
  });
  private readonly encryptionKey = fs
    .readFileSync(
      process.env.RECORDINGS_KEY_FILE || '/run/secrets/recordings.key',
      'utf8',
    )
    .trim();

  private s3Credentials() {
    const accessKeyId =
      process.env.AWS_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey =
      process.env.AWS_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY;

    return accessKeyId && secretAccessKey
      ? { accessKeyId, secretAccessKey }
      : undefined;
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  private projection(
    groupIds: string[],
    accessContext: string,
    extraWhere = '',
    values: unknown[] = [],
  ) {
    if (!groupIds.length || !accessContext) {
      return { text: '', values: [] as unknown[] };
    }

    // Isolamento POR GRAVAÇÃO (todos os filtros: CPF, skill, telefone, etc.):
    // - membro do access group do contexto
    // - gravação com fila desse access group
    // - gravação sem fila exclusiva de outro access group
    return {
      text: `
        SELECT p.*,
               decrypt_value(p.ani_normalized, $3) AS ani,
               decrypt_value(p.dnis_normalized, $3) AS dnis
        FROM searchvideo_recordings p
        WHERE EXISTS (
          SELECT 1
          FROM access_groups ag
          JOIN conversation_queues cq ON cq.conversation_id = p.conversation_id
          JOIN access_group_queues agq
            ON agq.queue_id = cq.queue_id
           AND agq.access_group_id = ag.id
          WHERE ag.active
            AND ag.slug = $2
            AND ag.genesys_group_id = ANY($1::varchar[])
        )
        AND NOT EXISTS (
          SELECT 1
          FROM conversation_queues cq
          JOIN access_group_queues foreign_agq ON foreign_agq.queue_id = cq.queue_id
          JOIN access_groups foreign_ag
            ON foreign_ag.id = foreign_agq.access_group_id
           AND foreign_ag.active
           AND foreign_ag.slug <> $2
          WHERE cq.conversation_id = p.conversation_id
            AND NOT EXISTS (
              SELECT 1
              FROM access_group_queues context_agq
              JOIN access_groups context_ag
                ON context_ag.id = context_agq.access_group_id
               AND context_ag.active
               AND context_ag.slug = $2
              WHERE context_agq.queue_id = cq.queue_id
            )
        ) ${extraWhere}`,
      values: [groupIds, accessContext, this.encryptionKey, ...values],
    };
  }

  async findAll(
    groupIds: string[],
    accessContext: string,
    filterTypes: string[],
    filterValues: string[],
    filterFields: string[] = [],
  ) {
    const clauses: string[] = [];
    const values: unknown[] = [];
    filterTypes.forEach((type, index) => {
      const value = filterValues[index];
      if (!type || !value) return;
      const parameter = `$${values.length + 4}`;

      if (type === 'RecordStart' || type === 'RecordStartStart') {
        clauses.push(`p.conversation_start_time::date >= ${parameter}::date`);
        values.push(value);
      } else if (type === 'RecordStartEnd') {
        clauses.push(`p.conversation_start_time::date <= ${parameter}::date`);
        values.push(value);
      } else if (type === 'CustomerPhone') {
        clauses.push(`COALESCE(NULLIF(BTRIM(p.participant_attributes->>'Telefone Cliente'), ''), NULLIF(BTRIM(p.participant_attributes->>'telefone'), ''), decrypt_value(p.ani_normalized, $3)) ILIKE ${parameter}`);
        values.push(`%${value}%`);
      } else if (type === 'DestinationPhone') {
        clauses.push(`COALESCE(NULLIF(BTRIM(p.participant_attributes->>'Telefone Destino'), ''), decrypt_value(p.dnis_normalized, $3)) ILIKE ${parameter}`);
        values.push(`%${value}%`);
      } else if (type === 'Document') {
        clauses.push(`COALESCE(
          NULLIF(BTRIM(p.cpf), ''),
          NULLIF(BTRIM(p.cnpj), ''),
          NULLIF(BTRIM(p.participant_attributes->>'Doc Cliente'), ''),
          NULLIF(BTRIM(p.participant_attributes->>'doc_cliente'), ''),
          NULLIF(BTRIM(p.participant_attributes->>'CPF'), ''),
          NULLIF(BTRIM(p.participant_attributes->>'cnpj'), ''),
          NULLIF(BTRIM(p.participant_attributes->>'CNPJ'), ''),
          ''
        ) ILIKE ${parameter}`);
        values.push(`%${value}%`);
      } else if (type === 'QueueSkill') {
        clauses.push(`COALESCE(NULLIF(BTRIM(p.participant_attributes->>'skill'), ''), NULLIF(BTRIM(p.participant_attributes->>'transfer_filas'), '')) ILIKE ${parameter}`);
        values.push(`%${value}%`);
      } else if (type === 'Environment') {
        clauses.push(`COALESCE(p.participant_attributes->>'Ambiente', '') ILIKE ${parameter}`);
        values.push(`%${value}%`);
      } else if (type === 'Duration') {
        clauses.push(`CASE WHEN ${parameter} ~ '^\\d+$' THEN ROUND(COALESCE(p.duration_ms, 0)::numeric / 1000) = ${parameter}::numeric ELSE false END`);
        values.push(value);
      } else if (type === 'Format') {
        clauses.push(`(COALESCE(p.content_type, '') ILIKE ${parameter} OR p.s3_object_key ILIKE ${parameter})`);
        values.push(`%${value}%`);
      } else if (type === 'FileSize') {
        const bytes = Number(value);
        if (Number.isFinite(bytes) && bytes >= 0) {
          const tolerance = Math.max(1, bytes * 0.001);
          clauses.push(`COALESCE(p.file_size, 0)::numeric BETWEEN ${parameter}::numeric AND $${values.length + 5}::numeric`);
          values.push(bytes - tolerance, bytes + tolerance);
        }
      } else if (type === 'ParticipantData') {
        const field = filterFields[index]?.trim();
        if (!field) return;
        values.push(field);
        const valueParameter = `$${values.length + 4}`;
        values.push(`%${value}%`);
        clauses.push(`COALESCE(p.participant_attributes ->> ${parameter}, '') ILIKE ${valueParameter}`);
      }
    });

    const where = clauses.length ? `AND ${clauses.join(' AND ')}` : '';
    const query = this.projection(
      groupIds,
      accessContext,
      `${where} ORDER BY p.conversation_start_time DESC LIMIT 500`,
      values,
    );
    if (!query.text) return [];
    const result = await this.pool.query<CanonicalVideoRow>(
      query.text,
      query.values,
    );
    return result.rows.map((row) => this.toApi(row));
  }

  async filterFields(groupIds: string[], accessContext: string) {
    // Catálogo de filtros compartilhado: não depende de gravações do grupo atual.
    // Grupos sem filas/gravações (ex.: retenção, caça-pos) ficam com o mesmo menu de A/B.
    // Isolamento de acesso continua só na busca/play/download (projection).
    if (!groupIds.length || !accessContext) return [];
    const allowed = await this.pool.query(
      `SELECT 1
       FROM access_groups ag
       WHERE ag.active
         AND ag.slug = $2
         AND ag.genesys_group_id = ANY($1::varchar[])
       LIMIT 1`,
      [groupIds, accessContext],
    );
    if (!allowed.rows.length) return [];

    const result = await this.pool.query<{ field: string }>(
      `SELECT DISTINCT fields.field
       FROM searchvideo_recordings p
       CROSS JOIN LATERAL jsonb_object_keys(
         COALESCE(p.participant_attributes, '{}'::jsonb)
       ) fields(field)
       WHERE p.participant_attributes IS NOT NULL
         AND p.participant_attributes <> '{}'::jsonb
       ORDER BY fields.field`,
    );
    return result.rows.map(({ field }) => field);
  }

  async findOne(
    groupIds: string[],
    accessContext: string,
    recordingId: string,
  ) {
    const query = this.projection(
      groupIds,
      accessContext,
      'AND p.recording_id = $4 LIMIT 1',
      [recordingId],
    );
    if (!query.text) return null;
    const result = await this.pool.query<CanonicalVideoRow>(
      query.text,
      query.values,
    );
    return result.rows[0] ? this.toApi(result.rows[0]) : null;
  }

  async findSome(
    groupIds: string[],
    accessContext: string,
    recordingIds: string[],
  ) {
    if (!recordingIds.length) return [];
    const query = this.projection(
      groupIds,
      accessContext,
      'AND p.recording_id = ANY($4::varchar[])',
      [recordingIds],
    );
    if (!query.text) return [];
    const result = await this.pool.query<CanonicalVideoRow>(
      query.text,
      query.values,
    );
    return result.rows.map((row) => this.toApi(row));
  }

  async getVideoFile(
    groupIds: string[],
    accessContext: string,
    recordingId: string,
  ) {
    const query = this.projection(
      groupIds,
      accessContext,
      'AND p.recording_id = $4 LIMIT 1',
      [recordingId],
    );
    if (!query.text) return null;
    const result = await this.pool.query<CanonicalVideoRow>(
      query.text,
      query.values,
    );
    const row = result.rows[0];
    if (!row) return null;

    const response = await this.s3.send(
      new GetObjectCommand({ Bucket: row.s3_bucket, Key: row.s3_object_key }),
    );
    const chunks: Buffer[] = [];
    for await (const chunk of response.Body as Readable) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return {
      buffer: Buffer.concat(chunks),
      contentType:
        row.content_type || response.ContentType || 'application/octet-stream',
      fileName:
        row.s3_object_key.split('/').pop() || `${recordingId}.bin`,
    };
  }

  async getVideoStream(
    groupIds: string[],
    accessContext: string,
    recordingId: string,
  ) {
    const query = this.projection(
      groupIds,
      accessContext,
      'AND p.recording_id = $4 LIMIT 1',
      [recordingId],
    );
    if (!query.text) return null;
    const result = await this.pool.query<CanonicalVideoRow>(
      query.text,
      query.values,
    );
    const row = result.rows[0];
    if (!row) return null;

    const response = await this.s3.send(
      new GetObjectCommand({ Bucket: row.s3_bucket, Key: row.s3_object_key }),
    );

    return {
      stream: response.Body as Readable,
      fileName:
        row.s3_object_key.split('/').pop() || `${recordingId}.bin`,
    };
  }

  private toApi(row: CanonicalVideoRow) {
    return {
      CallIDMaster: row.recording_id,
      IdOrigem: row.conversation_id,
      ANI: row.ani,
      DNIS: row.dnis,
      RecordStart: row.conversation_start_time,
      RecordDuration: Math.floor(Number(row.duration_ms || 0) / 1000),
      DestinationFileName: row.s3_object_key.split('/').pop(),
      DestinationFileSize: Number(row.file_size || 0),
      S3Directory: row.s3_bucket,
      S3FileName: row.s3_object_key,
      AgentId: row.user_ids?.[0] || null,
      Username: row.user_ids?.[0] || null,
      AgentLogin: row.user_ids?.[0] || null,
      CampaignId: row.division_name,
      Campaignname: row.division_name,
      Disposition: null,
      Dispositionname: null,
      Direction: row.initial_direction,
      MediaType: 'video',
      ContentType: row.content_type,
      CPF: row.cpf,
      CNPJ: row.cnpj,
      AGENCIA: row.agencia,
      CONTA: row.conta,
      EC: null,
      CONTRATO: row.contrato,
      PROTOCOLO: row.protocolo,
      ParticipantData: row.participant_attributes || {},
    };
  }
}
