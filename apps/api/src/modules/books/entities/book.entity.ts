import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/interfaces/base.entity';
import { Chapter } from '../../chapters/entities/chapter.entity';
import { Page } from '../../pages/entities/page.entity';

@Entity('books')
export class Book extends BaseEntity {
  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'tsvector', select: false, nullable: true })
  searchVector: string;

  @OneToMany(() => Chapter, (chapter) => chapter.book)
  chapters: Chapter[];

  @OneToMany(() => Page, (page) => page.book)
  directPages: Page[];
}
