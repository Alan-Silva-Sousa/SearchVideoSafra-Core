import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'usuarios', schema: 'searchvideo' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, nullable: true })
  email: string;

  @Column({ name: 'senha_hash', type: 'text', nullable: true })
  passwordHash: string;

  @Column({ name: 'external_id', nullable: true })
  externalId: string;

  @Column({ name: 'auth_provider', default: 'local' })
  authProvider: string;

  @Column({ name: 'nome' })
  displayName: string;

  @Column({ unique: true })
  login: string;

  @Column({ default: 'usuario' })
  perfil: string;

  @Column({ default: true })
  ativo: boolean;

  @Column({ name: 'criado_em', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'ultimo_login', type: 'timestamptz', nullable: true })
  lastLogin: Date;
}
