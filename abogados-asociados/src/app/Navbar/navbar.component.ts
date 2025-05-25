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
  
  onContactClick() {
    this.contactClick.emit();
  }

  onAboutUsClick(){
    this.aboutUsClick.emit();
  }

  onServicesClick(){
    this.servicesClick.emit();
  }
  
}