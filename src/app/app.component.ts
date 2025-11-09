// src/app/app.component.ts
import { Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { NavbarComponent } from './Navbar/navbar.component';
import { FooterComponent } from './Footer/footer.component';
import { RouterModule } from '@angular/router';
import { ServicesComponent } from './Pages/Services/services.component';
import { ContactUsComponent } from './Pages/Contactanos/contact-us.component';
import { AboutUsComponent } from './Pages/About us/about-us.component';
import { HomeComponent } from './Pages/Home/home.component';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { WeeklyArticleComponent } from './Pages/weekly-article/weekly-article.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    HttpClientModule,
    NavbarComponent,
    FooterComponent,
    ServicesComponent,
    ContactUsComponent,
    AboutUsComponent,
    HomeComponent,
    WeeklyArticleComponent,
    MatSlideToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule

  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
    @ViewChild('contactRef') contactRef!: ElementRef;
    @ViewChild('aboutUsRef') aboutUsRef!: ElementRef;
    @ViewChild('servicesRef') servicesRef!: ElementRef;
    @ViewChild('weeklyArt') weeklyArt!:ElementRef;

 

  scrollToContact(): void {
    if (this.contactRef) {
      this.contactRef.nativeElement.scrollIntoView({ behavior: 'smooth' });
    }
  }

  scrollAboutUS(): void {
    if (this.aboutUsRef) {
      this.aboutUsRef.nativeElement.scrollIntoView({ behavior: 'smooth' });
    }
  }

  scrollServices():void{
    if(this.servicesRef){
      this.servicesRef.nativeElement.scrollIntoView({ behavior: 'smooth' });
    }
  }

}
