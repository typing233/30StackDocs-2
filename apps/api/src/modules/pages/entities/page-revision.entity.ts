import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { Page } from './page.entity';

@Entity('page_revisions')
export class PageRevision {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  pageId: string;

  @ManyToOne(() => Page, (page) => page.revisions)
  page: Page;

  @Column({ type: 'text' })
  contentHtml: string;

  @Column({ type: 'text', nullable: true })
  contentMarkdown: string | null;

  @Column()
  versionNumber: number;

  @Column('uuid')
  createdBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'text', nullable: true })
  summary: string | null;
}
