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
    userRoles: string[],
    format: string,
    entityType: string,
    entityId: string,
    options: Record<string, any> = {},
  ): Promise<ExportJob> {
    // Permission check: user must have view access to the target entity
    const hasAccess = await this.permissionsService.hasPermission(
      userId,
      tenantId,
      entityType,
      entityId,
      ['view'],
    );
    if (!hasAccess && !userRoles.includes('admin')) {
      throw new ForbiddenException('You do not have permission to export this resource');
    }

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

    let filePath: string;

    switch (job.format) {
      case 'markdown': {
        const content = this.generateBookMarkdown(book, chapters, pages);
        filePath = this.writeFile(job.tenantId, `${book.slug}-${Date.now()}.md`, content);
        break;
      }
      case 'html': {
        const content = this.generateBookHtml(book, chapters, pages, job.options);
        filePath = this.writeFile(job.tenantId, `${book.slug}-${Date.now()}.html`, content);
        break;
      }
      case 'pdf': {
        await this.jobRepo.update(job.id, { progress: 50 });
        const htmlContent = this.generateBookHtml(book, chapters, pages, job.options);
        filePath = await this.htmlToPdf(job.tenantId, `${book.slug}-${Date.now()}.pdf`, htmlContent);
        break;
      }
      default:
        throw new Error(`Unsupported format: ${job.format}`);
    }

    await this.jobRepo.update(job.id, { progress: 90 });
    const fileSize = fs.statSync(filePath).size;
    return { filePath, fileSize };
  }

  private async exportPage(job: ExportJob): Promise<{ filePath: string; fileSize: number }> {
    const page = await this.pageRepo.findOne({ where: { id: job.entityId, tenantId: job.tenantId } });
    if (!page) throw new Error('Page not found');

    await this.jobRepo.update(job.id, { progress: 40 });

    let filePath: string;

    switch (job.format) {
      case 'markdown': {
        const content = this.generatePageMarkdown(page);
        filePath = this.writeFile(job.tenantId, `${page.slug}-${Date.now()}.md`, content);
        break;
      }
      case 'html': {
        const content = this.generatePageHtml(page, job.options);
        filePath = this.writeFile(job.tenantId, `${page.slug}-${Date.now()}.html`, content);
        break;
      }
      case 'pdf': {
        await this.jobRepo.update(job.id, { progress: 60 });
        const htmlContent = this.generatePageHtml(page, job.options);
        filePath = await this.htmlToPdf(job.tenantId, `${page.slug}-${Date.now()}.pdf`, htmlContent);
        break;
      }
      default:
        throw new Error(`Unsupported format: ${job.format}`);
    }

    const fileSize = fs.statSync(filePath).size;
    return { filePath, fileSize };
  }

  private writeFile(tenantId: string, filename: string, content: string): string {
    const filePath = path.join(EXPORT_DIR, tenantId, filename);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf-8');
    return filePath;
  }

  /**
   * Convert HTML to a real PDF using PDFKit.
   * Strips HTML tags and renders text content as a properly formatted PDF document.
   */
  private async htmlToPdf(tenantId: string, filename: string, html: string): Promise<string> {
    const PDFDocument = (await import('pdfkit')).default;
    const filePath = path.join(EXPORT_DIR, tenantId, filename);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    return new Promise<string>((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 60, bottom: 60, left: 50, right: 50 },
        info: {
          Title: this.extractTitle(html),
          Creator: 'StackDocs',
        },
      });

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Parse HTML into structured blocks and render to PDF
      const blocks = this.parseHtmlToBlocks(html);
      for (const block of blocks) {
        switch (block.type) {
          case 'h1':
            doc.fontSize(22).font('Helvetica-Bold').text(block.text, { align: 'left' });
            doc.moveDown(0.8);
            doc.moveTo(doc.x, doc.y).lineTo(doc.x + 495, doc.y).lineWidth(1).stroke('#333333');
            doc.moveDown(0.8);
            break;
          case 'h2':
            doc.fontSize(17).font('Helvetica-Bold').text(block.text);
            doc.moveDown(0.5);
            break;
          case 'h3':
            doc.fontSize(14).font('Helvetica-Bold').text(block.text);
            doc.moveDown(0.3);
            break;
          case 'code':
            doc.fontSize(9).font('Courier').fillColor('#333333')
              .text(block.text, { indent: 10 });
            doc.font('Helvetica').fillColor('#000000');
            doc.moveDown(0.5);
            break;
          case 'li':
            doc.fontSize(11).font('Helvetica').text(`  •  ${block.text}`, { indent: 15 });
            doc.moveDown(0.2);
            break;
          case 'hr':
            doc.moveDown(0.5);
            doc.moveTo(doc.x, doc.y).lineTo(doc.x + 495, doc.y).lineWidth(0.5).stroke('#cccccc');
            doc.moveDown(0.5);
            break;
          default:
            if (block.text.trim()) {
              doc.fontSize(11).font('Helvetica').text(block.text, { align: 'left', lineGap: 3 });
              doc.moveDown(0.4);
            }
            break;
        }

        // Add new page if near bottom
        if (doc.y > 720) {
          doc.addPage();
        }
      }

      doc.end();
      stream.on('finish', () => resolve(filePath));
      stream.on('error', reject);
    });
  }

  private extractTitle(html: string): string {
    const match = html.match(/<title>([^<]*)<\/title>/i) || html.match(/<h1[^>]*>([^<]*)<\/h1>/i);
    return match ? match[1] : 'StackDocs Export';
  }

  private parseHtmlToBlocks(html: string): Array<{ type: string; text: string }> {
    const blocks: Array<{ type: string; text: string }> = [];
    // Remove script/style tags entirely
    let cleaned = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');

    // Split on block-level tags
    const blockRegex = /<(h1|h2|h3|h4|h5|h6|p|li|pre|hr|div|section|blockquote|tr)[^>]*>([\s\S]*?)<\/\1>|<hr\s*\/?>/gi;
    let match: RegExpExecArray | null;
    let lastIdx = 0;

    while ((match = blockRegex.exec(cleaned)) !== null) {
      // Capture any text between blocks
      if (match.index > lastIdx) {
        const between = this.stripTags(cleaned.slice(lastIdx, match.index)).trim();
        if (between) blocks.push({ type: 'p', text: between });
      }
      lastIdx = match.index + match[0].length;

      if (match[0].match(/^<hr/i)) {
        blocks.push({ type: 'hr', text: '' });
        continue;
      }

      const tag = match[1].toLowerCase();
      const content = this.stripTags(match[2]).trim();
      if (!content && tag !== 'hr') continue;

      if (tag === 'pre') {
        blocks.push({ type: 'code', text: content });
      } else if (['h1', 'h2', 'h3'].includes(tag)) {
        blocks.push({ type: tag, text: content });
      } else if (tag === 'li') {
        blocks.push({ type: 'li', text: content });
      } else {
        blocks.push({ type: 'p', text: content });
      }
    }

    // Remaining text after last block
    if (lastIdx < cleaned.length) {
      const remaining = this.stripTags(cleaned.slice(lastIdx)).trim();
      if (remaining) blocks.push({ type: 'p', text: remaining });
    }

    // If no blocks extracted, just strip all tags and add as paragraphs
    if (blocks.length === 0) {
      const text = this.stripTags(cleaned).trim();
      if (text) {
        text.split(/\n{2,}/).forEach((para) => {
          if (para.trim()) blocks.push({ type: 'p', text: para.trim() });
        });
      }
    }

    return blocks;
  }

  private stripTags(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');
  }

  private generateBookMarkdown(book: any, chapters: any[], pages: any[]): string {
    const lines: string[] = [];
    lines.push(`# ${book.name}\n`);
    if (book.description) lines.push(`${book.description}\n`);
    lines.push(`\n---\n\n## 目录\n`);

    const chapterPages = new Map<string | null, any[]>();
    for (const page of pages) {
      const key = page.chapterId || null;
      if (!chapterPages.has(key)) chapterPages.set(key, []);
      chapterPages.get(key)!.push(page);
    }

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

    for (const page of directPages) {
      lines.push(`\n## ${page.name}\n`);
      lines.push(page.contentMarkdown || this.stripTags(page.contentHtml || ''));
      lines.push('\n');
    }

    for (const chapter of chapters) {
      lines.push(`\n## ${chapter.name}\n`);
      const cPages = chapterPages.get(chapter.id) || [];
      for (const page of cPages) {
        lines.push(`\n### ${page.name}\n`);
        lines.push(page.contentMarkdown || this.stripTags(page.contentHtml || ''));
        lines.push('\n');
      }
    }

    return lines.join('\n');
  }

  private generateBookHtml(book: any, chapters: any[], pages: any[], options: Record<string, any> = {}): string {
    const chapterPages = new Map<string | null, any[]>();
    for (const page of pages) {
      const key = page.chapterId || null;
      if (!chapterPages.has(key)) chapterPages.set(key, []);
      chapterPages.get(key)!.push(page);
    }

    const toc: string[] = [];
    const directPages = chapterPages.get(null) || [];
    for (const page of directPages) {
      toc.push(`<li><a href="#page-${page.id}">${page.name}</a></li>`);
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
    return `# ${page.name}\n\n${page.contentMarkdown || this.stripTags(page.contentHtml || '')}`;
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
}
