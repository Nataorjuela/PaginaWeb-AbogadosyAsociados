// src/app/app.component.ts
import { Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { NavbarComponent } from './Navbar/navbar.component';
import { FooterComponent } from './Footer/footer.component';
import { RouterModule } from '@angular/router';
import { ServicesComponent } from './Pages/Services/services.component';
import { ContactUsComponent } from './Pages/Contactanos/contact-us.component';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { AlliesProgramComponent } from './Pages/AlliesProgram/allies-program.component';
import { AdminComponent } from './Pages/Admin/admin.component';
import { AuthPortalComponent } from './Pages/AuthPortal/auth-portal.component';

type StatItem = { value: string; label: string; detail: string };
type StepItem = { title: string; description: string; icon: string };
type FeatureItem = { title: string; description: string; icon: string };
type TestimonialItem = { quote: string; name: string; role: string };
type FaqItem = { question: string; answer: string };
type BlogItem = { title: string; summary: string; category: string; date: string };
type DashboardReferral = { name: string; type: string; date: string; status: string; nextAction: string };
type ClientCase = { title: string; status: string; lawyer: string; nextAppointment: string; pendingPayment: string };

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
    AlliesProgramComponent,
    AdminComponent,
    AuthPortalComponent,
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
    @ViewChild('servicesRef') servicesRef!: ElementRef;
    @ViewChild('alliesRef') alliesRef!: ElementRef;
    @ViewChild('howRef') howRef!: ElementRef;
    @ViewChild('blogRef') blogRef!: ElementRef;
    isAdminPath = typeof window !== 'undefined' && window.location.pathname === '/admin';
    isPlatformPath = typeof window !== 'undefined' && (
      window.location.pathname === '/ingresar' ||
      window.location.pathname.startsWith('/aliados/') ||
      window.location.pathname.startsWith('/clientes/') ||
      window.location.pathname.startsWith('/admin/') ||
      window.location.pathname.startsWith('/recuperar-contrasena')
    );
    whatsappMessage = 'Hola, quiero recibir asesoría legal';

    trustStats: StatItem[] = [
      { value: '+15', label: 'años de experiencia', detail: 'Dato editable desde configuración' },
      { value: '+3.000', label: 'clientes asesorados', detail: 'Acompañamiento claro y oportuno' },
      { value: '+500', label: 'procesos acompañados', detail: 'Estrategia jurídica por etapas' },
      { value: 'Colombia', label: 'atención nacional', detail: 'Canales digitales y presenciales' }
    ];

    howSteps: StepItem[] = [
      { title: 'Cuéntanos tu caso', description: 'Recibimos tus datos y la necesidad legal principal.', icon: 'bi-chat-dots' },
      { title: 'Evaluamos la situación', description: 'Revisamos riesgos, documentos y opciones reales.', icon: 'bi-search' },
      { title: 'Te asignamos un abogado', description: 'Un profesional especializado acompaña el proceso.', icon: 'bi-person-check' },
      { title: 'Haces seguimiento digital', description: 'Consulta avances, documentos y próximas acciones.', icon: 'bi-kanban' }
    ];

    differentiators: FeatureItem[] = [
      { title: 'Atención rápida', description: 'Priorizamos cada solicitud y mantenemos comunicación clara.', icon: 'bi-lightning-charge' },
      { title: 'Seguimiento del caso', description: 'Conoce el estado de tu caso sin tener que llamar.', icon: 'bi-activity' },
      { title: 'Documentos organizados', description: 'Centralizamos archivos, fechas y próximos pasos.', icon: 'bi-folder2-open' },
      { title: 'Abogados especializados', description: 'Asignación según área legal y complejidad.', icon: 'bi-award' },
      { title: 'WhatsApp conectado', description: 'Canales humanos y directos para resolver dudas.', icon: 'bi-whatsapp' },
      { title: 'Portal digital', description: 'Experiencia preparada para clientes y aliados.', icon: 'bi-window-sidebar' }
    ];

    testimonials: TestimonialItem[] = [
      { quote: 'Me explicaron cada etapa del proceso y pude tomar decisiones con tranquilidad.', name: 'Cliente inmobiliario', role: 'Compra de inmueble' },
      { quote: 'El seguimiento fue claro, rápido y profesional desde el primer contacto.', name: 'Empresario local', role: 'Contratos comerciales' },
      { quote: 'Como aliado, registrar oportunidades es sencillo y transparente.', name: 'Aliado comercial', role: 'Programa de aliados' }
    ];

    faqs: FaqItem[] = [
      { question: '¿Cómo agendo una asesoría?', answer: 'Puedes hacerlo desde el botón Agendar asesoría o por WhatsApp. El equipo revisa tu solicitud y confirma disponibilidad.' },
      { question: '¿Puedo hacer seguimiento a mi caso?', answer: 'Sí. La experiencia está preparada para consultar estado, documentos, próximas citas y abogado asignado.' },
      { question: '¿Cómo funciona el programa de aliados?', answer: 'Te registras, envías referidos y el equipo comercial/jurídico actualiza el estado de cada oportunidad.' },
      { question: '¿Qué pasa después de enviar un referido?', answer: 'Validamos la información, contactamos a la persona referida y dejamos trazabilidad del avance.' },
      { question: '¿La primera consulta tiene costo?', answer: 'Depende del tipo de caso y profundidad requerida. Nuestro equipo te lo confirma antes de agendar.' }
    ];

    blogPosts: BlogItem[] = [
      { title: 'Cómo verificar un inmueble antes de comprar', summary: 'Checklist legal para reducir riesgos antes de firmar promesa o escritura.', category: 'Derecho inmobiliario', date: '2026-05-12' },
      { title: 'Qué hacer si un arrendatario no paga', summary: 'Opciones de cobro, conciliación y restitución de inmueble en Colombia.', category: 'Arrendamientos', date: '2026-05-12' },
      { title: 'Cómo hacer un contrato seguro en Colombia', summary: 'Cláusulas clave para proteger acuerdos personales y comerciales.', category: 'Contratos', date: '2026-05-12' },
      { title: 'Cuándo necesito un abogado inmobiliario', summary: 'Señales de alerta en compraventas, arriendos y saneamiento jurídico.', category: 'Derecho inmobiliario', date: '2026-05-12' },
      { title: 'Cómo funciona una sucesión en Colombia', summary: 'Pasos básicos, documentos y tiempos habituales del trámite sucesoral.', category: 'Familia', date: '2026-05-12' }
    ];

    partnerMetrics = [
      { label: 'Referidos enviados', value: '12' },
      { label: 'Contactados', value: '8' },
      { label: 'En evaluación', value: '4' },
      { label: 'Casos ganados', value: '3' },
      { label: 'Comisión pagada', value: '$1.100.000' }
    ];

    partnerReferrals: DashboardReferral[] = [
      { name: 'María R.', type: 'Derecho inmobiliario', date: '2026-05-08', status: 'En evaluación', nextAction: 'Revisión de documentos' },
      { name: 'Carlos P.', type: 'Cobro de cartera', date: '2026-05-04', status: 'Contactado', nextAction: 'Agendar asesoría' },
      { name: 'Empresa Andina', type: 'Contratos', date: '2026-04-29', status: 'Comisión aprobada', nextAction: 'Pago programado' }
    ];

    clientCases: ClientCase[] = [
      { title: 'Revisión contrato de compraventa', status: 'En revisión', lawyer: 'Equipo inmobiliario', nextAppointment: '2026-05-16 9:00 a. m.', pendingPayment: '$0' }
    ];

 

  scrollToContact(): void {
    if (this.contactRef) {
      this.contactRef.nativeElement.scrollIntoView({ behavior: 'smooth' });
    }
  }

  scrollServices():void{
    if(this.servicesRef){
      this.servicesRef.nativeElement.scrollIntoView({ behavior: 'smooth' });
    }
  }

  scrollHow(): void {
    if (this.howRef) {
      this.howRef.nativeElement.scrollIntoView({ behavior: 'smooth' });
    }
  }

  scrollBlog(): void {
    if (this.blogRef) {
      this.blogRef.nativeElement.scrollIntoView({ behavior: 'smooth' });
    }
  }

  scrollAllies(): void {
    if (this.alliesRef) {
      this.alliesRef.nativeElement.scrollIntoView({ behavior: 'smooth' });
    }
  }

  updateWhatsAppContext(message: string): void {
    this.whatsappMessage = message;
  }

  get whatsappUrl(): string {
    return `https://wa.me/573144278339?text=${encodeURIComponent(this.whatsappMessage)}`;
  }

}

