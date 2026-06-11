import { Injectable } from '@nestjs/common';
import * as sanitizeHtml from 'sanitize-html';

@Injectable()
export class PageSanitizer {
  private readonly options: sanitizeHtml.IOptions = {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      'img',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'figure',
      'figcaption',
      'details',
      'summary',
      'mark',
      'sub',
      'sup',
      'pre',
      'code',
      'blockquote',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'span',
      'div',
      'br',
      'hr',
    ],
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ['src', 'alt', 'title', 'width', 'height'],
      a: ['href', 'title', 'target', 'rel'],
      code: ['class'],
      span: ['class', 'style'],
      div: ['class'],
      td: ['colspan', 'rowspan'],
      th: ['colspan', 'rowspan'],
      '*': ['id', 'data-*'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    disallowedTagsMode: 'discard',
  };

  clean(html: string | null | undefined): string {
    if (!html) return '';
    return sanitizeHtml(html, this.options);
  }
}
