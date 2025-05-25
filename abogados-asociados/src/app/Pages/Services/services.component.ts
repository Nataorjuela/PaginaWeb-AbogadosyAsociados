import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-services',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './services.component.html',
  styleUrls: ['./services.component.scss']
})
export class ServicesComponent {
  servicios = [
  { nombre: 'Asesoría Legal Integral', icono: 'bi-briefcase-fill' },
  { nombre: 'Contratos y Negociaciones', icono: 'bi-file-earmark-text' },
  { nombre: 'Consultoría Empresarial', icono: 'bi-bar-chart-line' },
  { nombre: 'Representación Judicial', icono: 'bi-shield-check' },
  { nombre: 'Derecho Laboral', icono: 'bi-person-badge' },
  { nombre: 'Trámites Civiles', icono: 'bi-journal-text' }
];
}