import { Entity, Column, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/interfaces/base.entity';
import { Book } from '../../books/entities/book.entity';
import { Chapter } from '../../chapters/entities/chapter.entity';
import { PageRevision } from './page-revision.entity';

@Entity('pages')
export class Page extends BaseEntity {
  @Column()
  name: string;

  @Column()
  slug: string;

  @Column('uuid', { nullable: true })
  chapterId: string | null;

  @ManyToOne(() => Chapter, (chapter) => chapter.pages, { nullable: true })
  chapter: Chapter | null;

  @Column('uuid')
  bookId: string;

  @ManyToOne(() => Book, (book) => book.directPages)
  book: Book;

  @Column({ type: 'text', nullable: true })
  contentHtml: string | null;

  @Column({ type: 'text', nullable: true })
  contentMarkdown: string | null;

  @Column({ type: 'float', default: 0 })
  priority: number;

  @Column({ type: 'boolean', default: false })
  isDraft: boolean;

  @Column({ type: 'tsvector', select: false, nullable: true })
  searchVector: string;

  @OneToMany(() => PageRevision, (revision) => revision.page)
  revisions: PageRevision[];
}
