import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'gravacoes', schema: 'searchvideo' })
export class Gravacao {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'sistema_origem', length: 100 }) sistemaOrigem: string;
  @Column({ name: 'id_origem', length: 255 }) idOrigem: string;
  @Column({
    name: 'conversation_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  conversationId: string | null;
  @Column({ name: 'data_gravacao', type: 'date' }) dataGravacao: string;
  @Column({ name: 'hora_inicio', type: 'time' }) horaInicio: string;
  @Column({ name: 'hora_fim', type: 'time', nullable: true }) horaFim:
    | string
    | null;
  @Column({ name: 'duracao_segundos', type: 'int', nullable: true })
  duracaoSegundos: number | null;
  @Column({ name: 'agente_id', type: 'varchar', nullable: true }) agenteId:
    | string
    | null;
  @Column({ name: 'agente_login', type: 'varchar', nullable: true })
  agenteLogin: string | null;
  @Column({ name: 'agente_nome', type: 'varchar', nullable: true }) agenteNome:
    | string
    | null;
  @Column({ type: 'varchar', nullable: true }) origem: string | null;
  @Column({ type: 'varchar', nullable: true }) destino: string | null;
  @Column({ type: 'varchar', nullable: true }) direcao: string | null;
  @Column({ name: 'campanha_id', type: 'varchar', nullable: true }) campanhaId:
    | string
    | null;
  @Column({ name: 'campanha_nome', type: 'varchar', nullable: true })
  campanhaNome: string | null;
  @Column({ name: 'disposicao_id', type: 'varchar', nullable: true })
  disposicaoId: string | null;
  @Column({ name: 'disposicao_nome', type: 'varchar', nullable: true })
  disposicaoNome: string | null;
  @Column({ type: 'varchar', nullable: true }) cpf: string | null;
  @Column({ type: 'varchar', nullable: true }) cnpj: string | null;
  @Column({ type: 'varchar', nullable: true }) agencia: string | null;
  @Column({ type: 'varchar', nullable: true }) conta: string | null;
  @Column({ type: 'varchar', nullable: true }) ec: string | null;
  @Column({ type: 'varchar', nullable: true }) contrato: string | null;
  @Column({ type: 'varchar', nullable: true }) protocolo: string | null;
  @Column({ name: 's3_bucket' }) s3Bucket: string;
  @Column({ name: 's3_object_key', type: 'text' }) s3ObjectKey: string;
  @Column({ name: 'nome_arquivo', length: 500 }) nomeArquivo: string;
  @Column({ name: 'tamanho_bytes', type: 'bigint', nullable: true })
  tamanhoBytes: string | null;
  @Column({ name: 'content_type', default: 'video/mp4' }) contentType: string;
  @Column({ name: 'hash_integridade', type: 'varchar', nullable: true })
  hashIntegridade: string | null;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) metadata: Record<
    string,
    unknown
  >;
  @Column({ name: 'criado_em', type: 'timestamptz' }) criadoEm: Date;
  @Column({ name: 'atualizado_em', type: 'timestamptz' }) atualizadoEm: Date;
}
