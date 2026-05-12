import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

type Servicio = {
  nombre: string;
  icono: string;
  resumen: string;
  etiqueta: string;
};

@Component({
  selector: 'app-services',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './services.component.html',
  styleUrls: ['./services.component.scss']
})
export class ServicesComponent {
  @Output() adviceClick = new EventEmitter<string>();

  servicios: Servicio[] = [
    { nombre: 'Derecho inmobiliario', icono: 'bi-buildings', etiqueta: 'Patrimonio', resumen: 'Compra, venta, arriendos, promesas, estudios de títulos y conflictos sobre inmuebles.' },
    { nombre: 'Derecho civil', icono: 'bi-shield-check', etiqueta: 'Conflictos', resumen: 'Responsabilidad civil, obligaciones, incumplimientos, arrendamientos y reclamaciones.' },
    { nombre: 'Derecho comercial', icono: 'bi-briefcase', etiqueta: 'Empresas', resumen: 'Contratos, sociedades, negociaciones, cartera comercial y acompañamiento empresarial.' },
    { nombre: 'Derecho de familia', icono: 'bi-people', etiqueta: 'Familia', resumen: 'Sucesiones, alimentos, divorcios, custodia y acuerdos familiares con enfoque humano.' },
    { nombre: 'Cobro de cartera', icono: 'bi-cash-coin', etiqueta: 'Recuperación', resumen: 'Gestión prejurídica y judicial para recuperar dinero con trazabilidad y estrategia.' },
    { nombre: 'Contratos', icono: 'bi-file-earmark-text', etiqueta: 'Prevención', resumen: 'Redacción, revisión y negociación de contratos claros y ejecutables.' },
    { nombre: 'Sucesiones', icono: 'bi-diagram-3', etiqueta: 'Patrimonio', resumen: 'Acompañamiento en sucesiones notariales o judiciales y distribución de bienes.' },
    { nombre: 'Asesoría legal empresarial', icono: 'bi-graph-up-arrow', etiqueta: 'Crecimiento', resumen: 'Soporte jurídico continuo para decisiones, operaciones y riesgos de negocio.' }
  ];

  requestAdvice(serviceName: string): void {
    this.adviceClick.emit(`Hola, necesito asesoría sobre ${serviceName}`);
  }
}
