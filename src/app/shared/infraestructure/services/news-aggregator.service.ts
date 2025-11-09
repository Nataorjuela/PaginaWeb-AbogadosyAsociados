import { Injectable, Inject, Optional } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, catchError, forkJoin, of } from 'rxjs';

export type RawFeedItem = {
  title?: string;
  link?: string;
  pubDate?: string | Date;
  content?: string;
  contentSnippet?: string;
  description?: string;
  author?: string;
  guid?: string;
};

export type Article = {
  title: string;
  url: string;
  date: Date | null;
  excerpt: string;
  source: string;
};

export type WeeklyArticleConfig = {
  sources: string[];           
  proxyBase?: string | null;  
  maxItemsPerFeed?: number;   
};

@Injectable({ providedIn: 'root' })
export class NewsAggregatorService {
  private defaultConfig: WeeklyArticleConfig = {
    sources: [
     
      'https://www.eltiempo.com/rss/politica_gobierno.xml',
      'https://www.eltiempo.com/rss/politica.xml',
      'https://www.elespectador.com/rss/economia',
      'https://www.dinero.com/rss'
    ],

    proxyBase: 'https://api.allorigins.win/raw?url=',
    maxItemsPerFeed: 10
  };

  constructor(
    private http: HttpClient,
    @Optional() @Inject('WEEKLY_ARTICLE_CONFIG') private cfg?: Partial<WeeklyArticleConfig>
  ) {}

  private get config(): WeeklyArticleConfig {
    return { ...this.defaultConfig, ...(this.cfg || {}) };
  }

  
  private getIsoWeek(date = new Date()): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d as any) - (yearStart as any)) / 86400000 + 1) / 7);
  }


  private normalizeItems(items: RawFeedItem[], source: string): Article[] {
    return (items || [])
      .map((it) => {
        const title = it.title?.trim() || '(Sin título)';
        const url = (it.link || it.guid || '').toString();
        const raw = it.pubDate ? new Date(it.pubDate) : null;
        const excerptRaw = (it.contentSnippet || it.description || it.content || '') as string;
        const excerpt = excerptRaw.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        return { title, url, date: raw && isFinite(raw.getTime()) ? raw : null, excerpt, source };
      })
      .filter((a) => !!a.url);
  }

  private parseXmlToItems(xml: string, feedUrl: string): Article[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');

    const isRSS = !!doc.querySelector('rss, channel');
    const isAtom = !!doc.querySelector('feed');

    const items: RawFeedItem[] = [];

    if (isRSS) {
      doc.querySelectorAll('item').forEach((item) => {
        items.push({
          title: item.querySelector('title')?.textContent || undefined,
          link: item.querySelector('link')?.textContent || undefined,
          pubDate: item.querySelector('pubDate')?.textContent || undefined,
          description: item.querySelector('description')?.textContent || undefined
        });
      });
    } else if (isAtom) {
      doc.querySelectorAll('entry').forEach((entry) => {
        const linkEl = entry.querySelector('link[rel="alternate"]') || entry.querySelector('link');
        const href = linkEl?.getAttribute('href') || undefined;
        items.push({
          title: entry.querySelector('title')?.textContent || undefined,
          link: href,
          pubDate:
            entry.querySelector('updated')?.textContent ||
            entry.querySelector('published')?.textContent ||
            undefined,
          description:
            entry.querySelector('summary')?.textContent ||
            entry.querySelector('content')?.textContent ||
            undefined
        });
      });
    }

    return this.normalizeItems(items, feedUrl);
  }

  
  private fetchViaProxy(feedUrl: string) {
    const proxiedUrl = `${this.config.proxyBase}${encodeURIComponent(feedUrl)}`;
    return this.http.get(proxiedUrl, { responseType: 'text' }).pipe(
      map((xml) => this.parseXmlToItems(xml, feedUrl)),
      catchError(() => of([] as Article[]))
    );
  }

  
  private fetchDirect(feedUrl: string) {
    return this.http.get(feedUrl, { responseType: 'text' }).pipe(
      map((xml) => this.parseXmlToItems(xml, feedUrl)),
      catchError(() => of([] as Article[]))
    );
  }

 
  getWeeklyArticle() {
    const useProxy = !!this.config.proxyBase;
    const calls = this.config.sources.map((src) =>
      useProxy ? this.fetchViaProxy(src) : this.fetchDirect(src)
    );

    return forkJoin(calls).pipe(
      map((arrays) => arrays.flat()),
      map((all) => {
      
        const byUrl = new Map<string, Article>();
        for (const a of all) {
          if (!a.url) continue;
          if (!byUrl.has(a.url)) byUrl.set(a.url, a);
        }
        const unique = Array.from(byUrl.values()).sort(
          (a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0)
        );

        if (!unique.length) {
          return null as Article | null;
        }

        const week = this.getIsoWeek(new Date());
        const index = week % unique.length;
        return unique[index];
      }),
      catchError(() => of(null))
    );
  }
}
