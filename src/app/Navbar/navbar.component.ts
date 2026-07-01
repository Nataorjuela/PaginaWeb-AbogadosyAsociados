import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
    selector: 'app-navbar',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './navbar.component.html',
    styleUrls: ['./navbar.component.scss']
  })
export class NavbarComponent {

   @Output() contactClick = new EventEmitter<void>();
   @Output() aboutUsClick = new EventEmitter<void>();
   @Output() servicesClick = new EventEmitter<void>();
   @Output() howClick = new EventEmitter<void>();
   @Output() alliesClick = new EventEmitter<void>();
   @Output() blogClick = new EventEmitter<void>();
  
  onContactClick() {
    this.emitOrGo(this.contactClick, '/#contacto');
  }

  onAboutUsClick(){
    this.emitOrGo(this.aboutUsClick, '/#equipo');
  }

  onServicesClick(){
    this.emitOrGo(this.servicesClick, '/#servicios');
  }

  onHowClick() {
    this.emitOrGo(this.howClick, '/#como-funciona');
  }

  onAlliesClick() {
    this.emitOrGo(this.alliesClick, '/#aliados');
  }

  onBlogClick() {
    this.emitOrGo(this.blogClick, '/#blog');
  }

  private emitOrGo(event: EventEmitter<void>, fallback: string): void {
    if (event.observed) {
      event.emit();
      return;
    }
    window.location.href = fallback;
  }
  
}
