import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { Article, NewsAggregatorService } from '../../shared/infraestructure/services/news-aggregator.service';


@Component({
  selector: 'app-weekly-article',
  standalone: true,
  imports: [CommonModule, NgOptimizedImage],
  templateUrl: './weekly-article.component.html',
  styleUrls: ['./weekly-article.component.scss']
})
export class WeeklyArticleComponent implements OnInit {
  article: Article | null = null;
  loading = true;
  error = false;

  constructor(private news: NewsAggregatorService) {}

  ngOnInit(): void {
    this.news.getWeeklyArticle().subscribe({
      next: (a) => {
        this.article = a;
        this.loading = false;
      },
      error: () => {
        this.error = true;
        this.loading = false;
      }
    });
  }

  trackByIndex = (_: number, __: any) => _;
}
