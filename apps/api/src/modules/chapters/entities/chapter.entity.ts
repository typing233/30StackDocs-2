import { Entity, Column, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/interfaces/base.entity';
import { Book } from '../../books/entities/book.entity';
import { Page } from '../../pages/entities/page.entity';

@Entity('chapters')
export class Chapter extends BaseEntity {
  @Column()
  name: string;

  @Column()
  slug: string;

  @Column('uuid')
  bookId: string;

  @ManyToOne(() => Book, (book) => book.chapters)
  book: Book;

  @Column({ type: 'float', default: 0 })
  priority: number;

  @OneToMany(() => Page, (page) => page.chapter)
  pages: Page[];
}
