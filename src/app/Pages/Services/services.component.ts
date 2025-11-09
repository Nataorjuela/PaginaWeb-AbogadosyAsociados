import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

type Servicio = {
  nombre: string;
  icono: string;
  resumen: string;
  detalle: string;
  expandido?: boolean;
};

@Component({
  selector: 'app-services',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './services.component.html',
  styleUrls: ['./services.component.scss']
})
export class ServicesComponent {
  servicios: Servicio[] = [
    {
      nombre: 'Asesoría Legal Integral',
      icono: 'bi-briefcase-fill',
      resumen: 'Acompañamiento jurídico completo y personalizado.',
      detalle:
        'Ofrecemos acompañamiento jurídico completo y personalizado para personas naturales, empresas y entidades. Nuestro equipo analiza cada situación desde una perspectiva estratégica y preventiva, garantizando soluciones efectivas y seguras que protejan sus intereses y fortalezcan su posición ante cualquier desafío legal.'
    },
    {
      nombre: 'Contratos y Negociaciones',
      icono: 'bi-file-earmark-text',
      resumen: 'Redacción, revisión y negociación de contratos.',
      detalle:
        'Redactamos, revisamos y negociamos todo tipo de contratos con enfoque técnico y práctico, asegurando claridad, equilibrio y protección jurídica. Nuestro objetivo es blindar sus relaciones comerciales y evitar futuros conflictos, logrando acuerdos sólidos que impulsen su crecimiento empresarial.'
    },
    {
      nombre: 'Consultoría Empresarial',
      icono: 'bi-bar-chart-line',
      resumen: 'Asesoría jurídica y estratégica para empresas.',
      detalle:
        'Brindamos asesoría jurídica y estratégica a empresas en sus diferentes etapas: constitución, operación, expansión y reestructuración. Optimizamos la gestión legal, contractual y tributaria de su negocio para garantizar cumplimiento normativo, eficiencia y sostenibilidad a largo plazo.'
    },
    {
      nombre: 'Representación Judicial y Litigios',
      icono: 'bi-shield-check',
      resumen: 'Defensa y representación ante todas las jurisdicciones.',
      detalle:
        'Defendemos sus derechos ante todas las jurisdicciones con rigor técnico, ética profesional y una estrategia jurídica sólida. Actuamos con determinación y compromiso para obtener los mejores resultados en litigios civiles, comerciales, laborales, administrativos y penales.'
    },
    {
      nombre: 'Derecho Laboral',
      icono: 'bi-person-badge',
      resumen: 'Relaciones laborales, contratos y conciliaciones.',
      detalle:
        'Asesoramos empleadores y trabajadores en la gestión de relaciones laborales, elaboración de contratos, procesos disciplinarios, reclamaciones y conciliaciones. Protegemos los intereses de su empresa o de su vínculo laboral mediante estrategias legales efectivas y preventivas.'
    },
    {
      nombre: 'Derecho Penal',
      icono: 'bi-journal-text',
      resumen: 'Defensa penal con confidencialidad y estrategia.',
      detalle:
        'Defendemos sus derechos en investigaciones y procesos penales con absoluta confidencialidad, profesionalismo y enfoque estratégico. Asumimos casos de delitos económicos, patrimoniales y contra la administración pública, garantizando una representación técnica y humana en cada etapa del proceso.'
    },
    {
      nombre: 'Derecho Civil',
      icono: 'bi-journal-text',
      resumen: 'Propiedad, sucesiones, arrendamientos y más.',
      detalle:
        'Prestamos asesoría en temas de propiedad, sucesiones, arrendamientos, responsabilidad civil y obligaciones. Diseñamos soluciones jurídicas que previenen conflictos y resuelven controversias mediante acuerdos o procesos judiciales efectivos, orientados a la protección de su patrimonio.'
    },
    {
      nombre: 'Recuperación de Cartera',
      icono: 'bi-journal-text',
      resumen: 'Cobro prejurídico y judicial, con seguimiento.',
      detalle:
        'Recupere su dinero de manera ágil, efectiva y legal. Implementamos estrategias de cobro prejurídico y judicial adaptadas a cada caso, con seguimiento constante y resultados medibles. Transformamos sus cuentas por cobrar en liquidez para su negocio.'
    },
    {
      nombre: 'Derecho Tributario',
      icono: 'bi-cash-coin',
      resumen: 'Planeación y cumplimiento fiscal.',
      detalle:
        'Asesoramos en la planeación y cumplimiento de obligaciones fiscales, reduciendo riesgos y optimizando la carga impositiva. Combinamos conocimiento normativo y estrategia financiera para lograr eficiencia tributaria y tranquilidad frente a la DIAN y otras autoridades.'
    }
  ];

  toggle(i: number) {
    this.servicios[i].expandido = !this.servicios[i].expandido;
  }
}
