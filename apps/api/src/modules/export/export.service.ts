import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExportJob } from './entities/export-job.entity';
import { Page } from '../pages/entities/page.entity';
import { Book } from '../books/entities/book.entity';
import { Chapter } from '../chapters/entities/chapter.entity';
import { PermissionsService } from '../permissions/permissions.service';
import { RedisService } from '../redis/redis.service';
import * as fs from 'fs';
import * as path from 'path';

const EXPORT_DIR = path.resolve(process.cwd(), 'exports');

@Injectable()
export class ExportService {
  constructor(
    @InjectRepository(ExportJob)
    private readonly jobRepo: Repository<ExportJob>,
    @InjectRepository(Page)
    private readonly pageRepo: Repository<Page>,
    @InjectRepository(Book)
    private readonly bookRepo: Repository<Book>,
    @InjectRepository(Chapter)
    private readonly chapterRepo: Repository<Chapter>,
    private readonly permissionsService: PermissionsService,
    private readonly redis: RedisService,
  ) {
    if (!fs.existsSync(EXPORT_DIR)) {
      fs.mkdirSync(EXPORT_DIR, { recursive: true });
    }
  }

  async createExportJob(
    userId: string,
    tenantId: string,
    format: string,
    entityType: string,
    entityId: string,
    options: Record<string, any> = {},
  ): Promise<ExportJob> {
    const job = this.jobRepo.create({
      userId,
      tenantId,
      type: entityType === 'book' ? 'book' : 'page',
      format,
      entityType,
      entityId,
      options,
      status: 'pending',
    });
    const saved = await this.jobRepo.save(job);

    // Queue the job processing
    this.processJob(saved.id).catch(() => {});

    return saved;
  }

  async getJobStatus(jobId: string, tenantId: string, userId: string): Promise<ExportJob> {
    const job = await this.jobRepo.findOne({ where: { id: jobId, tenantId } });
    if (!job) throw new NotFoundException('Export job not found');
    if (job.userId !== userId) throw new ForbiddenException();
    return job;
  }

  async listJobs(tenantId: string, userId: string, page = 1, limit = 20) {
    const [jobs, total] = await this.jobRepo.findAndCount({
      where: { tenantId, userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data: jobs, meta: { total, page, limit } };
  }

  async cancelJob(jobId: string, tenantId: string, userId: string): Promise<void> {
    const job = await this.jobRepo.findOne({ where: { id: jobId, tenantId, userId } });
    if (!job) throw new NotFoundException();
    if (job.status === 'completed' || job.status === 'cancelled') return;
    await this.jobRepo.update(job.id, { status: 'cancelled' });
  }

  async getFilePath(jobId: string, tenantId: string, userId: string): Promise<string | null> {
    const job = await this.getJobStatus(jobId, tenantId, userId);
    if (job.status !== 'completed' || !job.filePath) return null;
    return job.filePath;
  }

  private async processJob(jobId: string): Promise<void> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job || job.status === 'cancelled') return;

    await this.jobRepo.update(jobId, { status: 'processing', attempts: job.attempts + 1 });

    try {
      let filePath: string;
      let fileSize: number;

      if (job.entityType === 'book') {
        const result = await this.exportBook(job);
        filePath = result.filePath;
        fileSize = result.fileSize;
      } else {
        const result = await this.exportPage(job);
        filePath = result.filePath;
        fileSize = result.fileSize;
      }

      await this.jobRepo.update(jobId, {
        status: 'completed',
        progress: 100,
        filePath,
        fileSize,
        completedAt: new Date(),
      });
    } catch (error: any) {
      const shouldRetry = job.attempts < job.maxAttempts;
      await this.jobRepo.update(jobId, {
        status: shouldRetry ? 'pending' : 'failed',
        error: error.message || 'Unknown error',
        progress: 0,
      });

      if (shouldRetry) {
        // Retry with exponential backoff
        const delay = Math.pow(2, job.attempts) * 1000;
        setTimeout(() => this.processJob(jobId), delay);
      }
    }
  }

  private async exportBook(job: ExportJob): Promise<{ filePath: string; fileSize: number }> {
    const book = await this.bookRepo.findOne({ where: { id: job.entityId, tenantId: job.tenantId } });
    if (!book) throw new Error('Book not found');

    const chapters = await this.chapterRepo.find({
      where: { bookId: book.id, tenantId: job.tenantId },
      order: { priority: 'ASC' },
    });

    const pages = await this.pageRepo.find({
      where: { bookId: book.id, tenantId: job.tenantId },
      order: { priority: 'ASC' },
    });

    await this.jobRepo.update(job.id, { progress: 30 });

    let content: string;
    let ext: string;

    switch (job.format) {
      case 'markdown':
        content = this.generateBookMarkdown(book, chapters, pages);
        ext = 'md';
        break;
      case 'html':
        content = this.generateBookHtml(book, chapters, pages, job.options);
        ext = 'html';
        break;
      case 'pdf':
        content = this.generateBookHtml(book, chapters, pages, job.options);
        ext = 'html'; // PDF rendering done client-side or via headless browser
        break;
      default:
        throw new Error(`Unsupported format: ${job.format}`);
    }

    await this.jobRepo.update(job.id, { progress: 80 });

    const filename = `${book.slug}-${Date.now()}.${ext}`;
    const filePath = path.join(EXPORT_DIR, job.tenantId, filename);

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf-8');
    const fileSize = fs.statSync(filePath).size;

    return { filePath, fileSize };
  }

  private async exportPage(job: ExportJob): Promise<{ filePath: string; fileSize: number }> {
    const page = await this.pageRepo.findOne({ where: { id: job.entityId, tenantId: job.tenantId } });
    if (!page) throw new Error('Page not found');

    await this.jobRepo.update(job.id, { progress: 50 });

    let content: string;
    let ext: string;

    switch (job.format) {
      case 'markdown':
        content = this.generatePageMarkdown(page);
        ext = 'md';
        break;
      case 'html':
        content = this.generatePageHtml(page, job.options);
        ext = 'html';
        break;
      case 'pdf':
        content = this.generatePageHtml(page, job.options);
        ext = 'html';
        break;
      default:
        throw new Error(`Unsupported format: ${job.format}`);
    }

    const filename = `${page.slug}-${Date.now()}.${ext}`;
    const filePath = path.join(EXPORT_DIR, job.tenantId, filename);

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf-8');
    const fileSize = fs.statSync(filePath).size;

    return { filePath, fileSize };
  }

  private generateBookMarkdown(book: any, chapters: any[], pages: any[]): string {
    const lines: string[] = [];
    lines.push(`# ${book.name}\n`);
    if (book.description) lines.push(`${book.description}\n`);
    lines.push(`\n---\n\n## Table of Contents\n`);

    // Group pages by chapter
    const chapterPages = new Map<string | null, any[]>();
    for (const page of pages) {
      const key = page.chapterId || null;
      if (!chapterPages.has(key)) chapterPages.set(key, []);
      chapterPages.get(key)!.push(page);
    }

    // TOC
    let tocNum = 1;
    const directPages = chapterPages.get(null) || [];
    for (const page of directPages) {
      lines.push(`${tocNum}. ${page.name}`);
      tocNum++;
    }
    for (const chapter of chapters) {
      lines.push(`${tocNum}. **${chapter.name}**`);
      const cPages = chapterPages.get(chapter.id) || [];
      for (let i = 0; i < cPages.length; i++) {
        lines.push(`   ${tocNum}.${i + 1}. ${cPages[i].name}`);
      }
      tocNum++;
    }

    lines.push('\n---\n');

    // Content
    for (const page of directPages) {
      lines.push(`\n## ${page.name}\n`);
      lines.push(page.contentMarkdown || this.htmlToSimpleText(page.contentHtml || ''));
      lines.push('\n');
    }

    for (const chapter of chapters) {
      lines.push(`\n## ${chapter.name}\n`);
      const cPages = chapterPages.get(chapter.id) || [];
      for (const page of cPages) {
        lines.push(`\n### ${page.name}\n`);
        lines.push(page.contentMarkdown || this.htmlToSimpleText(page.contentHtml || ''));
        lines.push('\n');
      }
    }

    return lines.join('\n');
  }

  private generateBookHtml(book: any, chapters: any[], pages: any[], options: Record<string, any> = {}): string {
    const template = options.template || 'default';
    const chapterPages = new Map<string | null, any[]>();
    for (const page of pages) {
      const key = page.chapterId || null;
      if (!chapterPages.has(key)) chapterPages.set(key, []);
      chapterPages.get(key)!.push(page);
    }

    const toc: string[] = [];
    let tocNum = 1;
    const directPages = chapterPages.get(null) || [];
    for (const page of directPages) {
      toc.push(`<li><a href="#page-${page.id}">${page.name}</a></li>`);
      tocNum++;
    }
    for (const chapter of chapters) {
      toc.push(`<li><strong>${chapter.name}</strong><ul>`);
      const cPages = chapterPages.get(chapter.id) || [];
      for (const page of cPages) {
        toc.push(`<li><a href="#page-${page.id}">${page.name}</a></li>`);
      }
      toc.push('</ul></li>');
    }

    const bodyParts: string[] = [];
    for (const page of directPages) {
      bodyParts.push(`<section id="page-${page.id}"><h2>${page.name}</h2>${page.contentHtml || ''}</section>`);
    }
    for (const chapter of chapters) {
      bodyParts.push(`<section><h2>${chapter.name}</h2>`);
      const cPages = chapterPages.get(chapter.id) || [];
      for (const page of cPages) {
        bodyParts.push(`<section id="page-${page.id}"><h3>${page.name}</h3>${page.contentHtml || ''}</section>`);
      }
      bodyParts.push('</section>');
    }

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${book.name}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 900px; margin: 0 auto; padding: 2rem; line-height: 1.6; }
    h1 { border-bottom: 2px solid #333; padding-bottom: 0.5rem; }
    nav { background: #f5f5f5; padding: 1rem; border-radius: 4px; margin: 1rem 0; }
    nav ul { list-style: none; padding-left: 1rem; }
    section { margin: 2rem 0; page-break-inside: avoid; }
    img { max-width: 100%; height: auto; }
    code { background: #f0f0f0; padding: 0.2em 0.4em; border-radius: 3px; }
    pre { background: #f5f5f5; padding: 1rem; overflow-x: auto; border-radius: 4px; }
    @media print { nav { display: none; } section { page-break-before: always; } }
  </style>
</head>
<body>
  <h1>${book.name}</h1>
  ${book.description ? `<p>${book.description}</p>` : ''}
  <nav><h2>目录</h2><ol>${toc.join('\n')}</ol></nav>
  ${bodyParts.join('\n')}
</body>
</html>`;
  }

  private generatePageMarkdown(page: any): string {
    const lines: string[] = [];
    lines.push(`# ${page.name}\n`);
    lines.push(page.contentMarkdown || this.htmlToSimpleText(page.contentHtml || ''));
    return lines.join('\n');
  }

  private generatePageHtml(page: any, options: Record<string, any> = {}): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${page.name}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 900px; margin: 0 auto; padding: 2rem; line-height: 1.6; }
    img { max-width: 100%; height: auto; }
    code { background: #f0f0f0; padding: 0.2em 0.4em; border-radius: 3px; }
    pre { background: #f5f5f5; padding: 1rem; overflow-x: auto; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>${page.name}</h1>
  ${page.contentHtml || ''}
</body>
</html>`;
  }

  private htmlToSimpleText(html: string): string {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}
