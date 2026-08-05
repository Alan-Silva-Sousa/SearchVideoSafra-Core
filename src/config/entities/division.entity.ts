import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'config_divisoes', schema: 'searchvideo' })
export class Division {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'division_id', type: 'varchar', length: 255, unique: true })
  divisionId: string;

  @Column({ name: 'nome', type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'retention_days', type: 'int', nullable: true })
  retentionDays: number | null;
}
