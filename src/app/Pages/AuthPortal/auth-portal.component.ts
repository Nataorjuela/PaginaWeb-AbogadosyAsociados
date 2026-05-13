import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';

type AccessCard = { icon: string; title: string; text: string; button: string; href: string };
type PortalMetric = { label: string; value: string };
type ReferralRow = { client: string; caseType: string; date: string; status: string; commission: string; action: string };
type CaseRow = { caseType: string; status: string; updatedAt: string; lawyer: string; nextAction: string };
type ClientPortalCase = {
  id: number;
  title: string;
  type: string;
  status: string;
  lawyer: string;
  startDate: string;
  updatedAt: string;
  nextAction: string;
  description: string;
  timeline: { date: string; title: string; description: string; status: string }[];
  tasks: string[];
};
type ClientDocument = { id: number; caseTitle: string; name: string; uploadedBy: string; uploadedAt: string; status: string; observations: string; size: string };
type ClientPayment = { concept: string; caseTitle: string; amount: number; dueDate: string; status: string; receipt: string };
type ClientAppointment = { title: string; caseTitle: string; date: string; type: string; status: string; location: string };
type ClientMessage = { caseTitle: string; from: string; date: string; unread: boolean; text: string; attachmentName?: string };
type ClientNotification = { title: string; description: string; date: string; type: string; unread: boolean };
type LegalServiceRequest = { service_type: string; description: string; urgency: string; documents: string; city: string; email: string; phone: string };
type PartnerNetworkSummary = Record<string, number>;
type AdminLead = {
  name: string;
  phone: string;
  email: string;
  caseType: string;
  source: string;
  status: string;
  owner: string;
  date: string;
  nextAction: string;
  priority: string;
};
type PartnerNetwork = {
  partner?: any;
  summary?: PartnerNetworkSummary;
  settings?: any;
  team?: any[];
  direct_referrals?: any[];
  network_referrals?: any[];
  commissions?: any[];
  share?: any;
};

@Component({
  selector: 'app-auth-portal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HttpClientModule],
  templateUrl: './auth-portal.component.html',
  styleUrls: ['./auth-portal.component.scss']
})
export class AuthPortalComponent implements OnInit {
  path = typeof window !== 'undefined' ? window.location.pathname : '/ingresar';
  loginForm!: FormGroup;
  partnerRegisterForm!: FormGroup;
  recoveryForm!: FormGroup;
  networkReferralForm!: FormGroup;
  invitationForm!: FormGroup;
  commissionSettingsForm!: FormGroup;
  clientDocumentForm!: FormGroup;
  clientAppointmentForm!: FormGroup;
  clientMessageForm!: FormGroup;
  clientServiceForm!: FormGroup;
  clientProfileForm!: FormGroup;
  registerStep = 1;
  showPassword = false;
  loading = false;
  message = '';
  error = '';
  currentUser: any = null;
  adminSection = 'dashboard';
  partnerSection = 'overview';
  clientSection = 'dashboard';
  partnerNetwork: PartnerNetwork = {};
  partnerAdvanced: any = {};
  adminNetwork: any = { allies: [], referrals: [], commissions: [], settings: {} };
  formMessage = '';
  formError = '';
  clientFormMessage = '';
  clientFormError = '';
  clientMessageAttachmentName = '';
  clientServiceAttachmentName = '';
  selectedClientCaseId = 1;
  readonly environment = this.resolveEnvironment();

  accessCards: AccessCard[] = [
    { icon: 'bi-diagram-3', title: 'Soy aliado', text: 'Gestiona tus referidos y consulta tus comisiones.', button: 'Ingresar como aliado', href: '/aliados/login' },
    { icon: 'bi-folder-check', title: 'Soy cliente', text: 'Consulta el estado de tu caso y tus documentos.', button: 'Ingresar como cliente', href: '/clientes/login' },
    { icon: 'bi-shield-lock', title: 'Administración', text: 'Acceso interno para el equipo jurídico y administrativo.', button: 'Ingresar al panel', href: '/admin/login' }
  ];

  partnerMetrics: PortalMetric[] = [
    { label: 'Referidos enviados', value: '12' },
    { label: 'Casos activos', value: '4' },
    { label: 'Comisión estimada', value: '$480.000' },
    { label: 'Comisión pagada', value: '$320.000' }
  ];

  clientMetrics: PortalMetric[] = [
    { label: 'Casos activos', value: '1' },
    { label: 'Próxima cita', value: '16 may' },
    { label: 'Documentos pendientes', value: '2' },
    { label: 'Estado general', value: 'En revisión' }
  ];

  adminMetrics: PortalMetric[] = [
    { label: 'Nuevos leads', value: '18' },
    { label: 'Casos activos', value: '42' },
    { label: 'Referidos del mes', value: '16' },
    { label: 'Clientes activos', value: '31' },
    { label: 'Comisiones pendientes', value: '$450.000' },
    { label: 'Ingresos estimados', value: '$38.5M' }
  ];

  leadMetrics: PortalMetric[] = [
    { label: 'Leads nuevos', value: '18' },
    { label: 'Contactados', value: '11' },
    { label: 'Agendados', value: '6' },
    { label: 'Propuestas enviadas', value: '4' }
  ];

  referrals: ReferralRow[] = [
    { client: 'María Rodríguez', caseType: 'Derecho inmobiliario', date: '2026-05-08', status: 'En evaluación', commission: '$180.000', action: 'Revisión de documentos' },
    { client: 'Carlos Pérez', caseType: 'Cobro de cartera', date: '2026-05-04', status: 'Contactado', commission: '$120.000', action: 'Agendar asesoría' },
    { client: 'Empresa Andina', caseType: 'Contratos', date: '2026-04-29', status: 'Comisión aprobada', commission: '$450.000', action: 'Pago programado' }
  ];

  clientCases: CaseRow[] = [
    { caseType: 'Contrato de compraventa', status: 'En revisión', updatedAt: '2026-05-12', lawyer: 'Equipo inmobiliario', nextAction: 'Enviar certificado actualizado' },
    { caseType: 'Sucesión', status: 'Documentos solicitados', updatedAt: '2026-05-09', lawyer: 'Área civil y familia', nextAction: 'Cargar registros civiles' }
  ];

  clientPortalCases: ClientPortalCase[] = [
    {
      id: 1,
      title: 'Revisión contrato de compraventa',
      type: 'Derecho inmobiliario',
      status: 'En revisión',
      lawyer: 'Equipo inmobiliario',
      startDate: '2026-05-02',
      updatedAt: '2026-05-12',
      nextAction: 'Enviar certificado de tradición actualizado',
      description: 'Análisis de promesa de compraventa, documentos del inmueble y riesgos jurídicos antes de firma.',
      timeline: [
        { date: '2026-05-02', title: 'Caso recibido', description: 'Se registró la solicitud y documentos iniciales.', status: 'Completado' },
        { date: '2026-05-06', title: 'Revisión documental', description: 'El abogado asignado inició validación de certificados y promesa.', status: 'En curso' },
        { date: '2026-05-12', title: 'Documento solicitado', description: 'Se pidió certificado de tradición actualizado.', status: 'Pendiente' }
      ],
      tasks: ['Cargar certificado de tradición actualizado', 'Confirmar fecha tentativa de firma', 'Enviar paz y salvo de administración']
    },
    {
      id: 2,
      title: 'Sucesión familiar',
      type: 'Familia',
      status: 'Pendiente de documentos',
      lawyer: 'Área civil y familia',
      startDate: '2026-04-22',
      updatedAt: '2026-05-09',
      nextAction: 'Cargar registros civiles',
      description: 'Organización documental para trámite sucesoral y revisión de herederos.',
      timeline: [
        { date: '2026-04-22', title: 'Apertura de caso', description: 'Se creó expediente digital del proceso.', status: 'Completado' },
        { date: '2026-04-29', title: 'Lista documental enviada', description: 'Se compartió listado de documentos requeridos.', status: 'Completado' },
        { date: '2026-05-09', title: 'Pendiente de documentos', description: 'Faltan registros civiles para avanzar.', status: 'Pendiente' }
      ],
      tasks: ['Subir registro civil de nacimiento', 'Subir registro civil de defunción', 'Confirmar datos de contacto de herederos']
    }
  ];

  clientDocuments: ClientDocument[] = [
    { id: 1, caseTitle: 'Revisión contrato de compraventa', name: 'Promesa de compraventa.pdf', uploadedBy: 'Cliente', uploadedAt: '2026-05-03', status: 'Aprobado', observations: 'Documento legible y completo.', size: '1.2 MB' },
    { id: 2, caseTitle: 'Revisión contrato de compraventa', name: 'Certificado de tradición.pdf', uploadedBy: 'Cliente', uploadedAt: '2026-05-04', status: 'Requiere corrección', observations: 'Debe estar actualizado a máximo 30 días.', size: '840 KB' },
    { id: 3, caseTitle: 'Sucesión familiar', name: 'Lista de documentos requeridos.pdf', uploadedBy: 'Firma', uploadedAt: '2026-04-29', status: 'Recibido', observations: 'Documento guía para continuar el trámite.', size: '430 KB' }
  ];

  clientPayments: ClientPayment[] = [
    { concept: 'Honorarios revisión contractual', caseTitle: 'Revisión contrato de compraventa', amount: 850000, dueDate: '2026-05-20', status: 'Pendiente', receipt: 'Pendiente de soporte' },
    { concept: 'Abono inicial sucesión', caseTitle: 'Sucesión familiar', amount: 600000, dueDate: '2026-04-25', status: 'Pagado', receipt: 'RC-2026-041' },
    { concept: 'Gastos notariales estimados', caseTitle: 'Sucesión familiar', amount: 320000, dueDate: '2026-05-28', status: 'Próximo vencimiento', receipt: 'Por generar' }
  ];

  clientAppointments: ClientAppointment[] = [
    { title: 'Revisión de hallazgos', caseTitle: 'Revisión contrato de compraventa', date: '2026-05-16 09:00', type: 'Virtual', status: 'Confirmada', location: 'Google Meet pendiente de envío' },
    { title: 'Organización documental', caseTitle: 'Sucesión familiar', date: '2026-05-21 15:30', type: 'Llamada', status: 'Solicitada', location: 'Llamada a celular registrado' },
    { title: 'Primera asesoría', caseTitle: 'Revisión contrato de compraventa', date: '2026-05-03 10:00', type: 'Virtual', status: 'Realizada', location: 'Google Meet' }
  ];

  clientMessages: ClientMessage[] = [
    { caseTitle: 'Revisión contrato de compraventa', from: 'Equipo inmobiliario', date: '2026-05-12 16:10', unread: true, text: 'Por favor carga el certificado de tradición actualizado para continuar la revisión.', attachmentName: 'lista-observaciones.pdf' },
    { caseTitle: 'Sucesión familiar', from: 'Área civil y familia', date: '2026-05-09 09:20', unread: false, text: 'Te enviamos el listado de documentos necesarios para avanzar con el trámite.' }
  ];

  clientNotifications: ClientNotification[] = [
    { title: 'Documento pendiente', description: 'Certificado de tradición requiere actualización.', date: '2026-05-12', type: 'Documentos', unread: true },
    { title: 'Cita confirmada', description: 'Revisión de hallazgos el 16 de mayo a las 9:00 a. m.', date: '2026-05-11', type: 'Citas', unread: true },
    { title: 'Pago próximo', description: 'Honorarios revisión contractual vencen el 20 de mayo.', date: '2026-05-10', type: 'Pagos', unread: false }
  ];

  clientServiceRequests: Array<LegalServiceRequest & { status: string; createdAt: string }> = [
    { service_type: 'Contratos', description: 'Revisión de contrato de arrendamiento comercial.', urgency: 'Media', documents: 'contrato-preliminar.pdf', city: 'Bogotá', email: 'cliente@orjuela.com', phone: '3000000000', status: 'En análisis', createdAt: '2026-05-10' }
  ];

  clientProfile = {
    full_name: 'Usuario Prueba',
    document_id: '12345678',
    email: 'cliente@orjuela.com',
    phone: '3000000000',
    city: 'Bogotá',
    address: 'Dirección por actualizar',
    created_at: '2026-05-01',
    verified: false
  };

  adminLeads: AdminLead[] = [
    { name: 'Laura Méndez', phone: '300 456 7890', email: 'laura@example.com', caseType: 'Derecho civil', source: 'Web', status: 'Nuevo', owner: 'Comercial', date: '2026-05-12', nextAction: 'Llamar hoy antes de las 5:00 p. m.', priority: 'Alta' },
    { name: 'Inmobiliaria Norte', phone: '311 222 3344', email: 'contacto@inmobiliaria.test', caseType: 'Contratos', source: 'Aliado', status: 'Contactado', owner: 'Asistente', date: '2026-05-11', nextAction: 'Enviar propuesta de revisión contractual', priority: 'Media' },
    { name: 'Jorge Salinas', phone: '315 987 1122', email: 'jorge@example.com', caseType: 'Cobro de cartera', source: 'WhatsApp', status: 'Agendado', owner: 'Abogado civil', date: '2026-05-10', nextAction: 'Preparar cita y documentos requeridos', priority: 'Alta' },
    { name: 'María Fernanda Ruiz', phone: '302 555 8844', email: 'maria@example.com', caseType: 'Derecho inmobiliario', source: 'Orgánico', status: 'Propuesta enviada', owner: 'Equipo inmobiliario', date: '2026-05-09', nextAction: 'Hacer seguimiento a aceptación de propuesta', priority: 'Media' }
  ];

  selectedLead: AdminLead = this.adminLeads[0];
  partnerTypes = ['Inmobiliaria', 'Asesor comercial', 'Cliente', 'Empresa', 'Independiente', 'Otro'];
  legalAreas = ['Familia', 'Civil', 'Laboral', 'Comercial', 'Penal', 'Inmobiliario', 'Otro'];
  referralStatuses = ['Nuevo referido', 'En revision', 'Contactado', 'En negociacion', 'Cliente vinculado', 'Caso rechazado', 'Comision aprobada', 'Comision pagada'];
  commissionStatuses = ['pending', 'approved', 'paid', 'rejected'];
  constructor(private fb: FormBuilder, private http: HttpClient) {}

  ngOnInit(): void {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required]],
      password: ['', Validators.required],
      remember: [true]
    });

    this.partnerRegisterForm = this.fb.group({
      full_name: ['', Validators.required],
      document_id: ['', Validators.required],
      phone: ['', [Validators.required, Validators.minLength(7)]],
      email: ['', [Validators.required, Validators.email]],
      city: ['', Validators.required],
      partner_type: ['', Validators.required],
      company: [''],
      how_known: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirm_password: ['', [Validators.required, Validators.minLength(8)]],
      terms: [false, Validators.requiredTrue],
      data_auth: [false, Validators.requiredTrue]
    });

    this.recoveryForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });

    this.networkReferralForm = this.fb.group({
      client_name: ['', Validators.required],
      client_identification: ['', Validators.required],
      client_phone: ['', Validators.required],
      client_email: ['', Validators.email],
      city: ['', Validators.required],
      legal_area: ['', Validators.required],
      description: ['', Validators.required],
      referral_channel: ['', Validators.required],
      data_authorization: [false, Validators.requiredTrue]
    });

    this.invitationForm = this.fb.group({
      full_name: ['', Validators.required],
      document_id: ['', Validators.required],
      phone: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      city: ['', Validators.required],
      occupation: ['', Validators.required],
      message: ['']
    });

    this.commissionSettingsForm = this.fb.group({
      direct_percentage: [10, Validators.required],
      level_1_percentage: [3, Validators.required],
      level_2_percentage: [1, Validators.required]
    });

    this.clientDocumentForm = this.fb.group({
      caseTitle: ['Revisión contrato de compraventa', Validators.required],
      fileName: ['', Validators.required],
      fileType: ['', Validators.required],
      fileSizeMb: [1, [Validators.required, Validators.max(10)]],
      observations: ['']
    });

    this.clientAppointmentForm = this.fb.group({
      caseTitle: ['Revisión contrato de compraventa', Validators.required],
      type: ['Virtual', Validators.required],
      requestedDate: ['', Validators.required],
      reason: ['', Validators.required]
    });

    this.clientMessageForm = this.fb.group({
      caseTitle: ['Revisión contrato de compraventa', Validators.required],
      message: ['', [Validators.required, Validators.minLength(8)]],
      attachment: ['']
    });

    this.clientServiceForm = this.fb.group({
      service_type: ['', Validators.required],
      description: ['', [Validators.required, Validators.minLength(12)]],
      urgency: ['Media', Validators.required],
      documents: [''],
      city: ['', Validators.required],
      email: [this.clientProfile.email, [Validators.required, Validators.email]],
      phone: [this.clientProfile.phone, Validators.required]
    });

    this.clientProfileForm = this.fb.group({
      full_name: [this.clientProfile.full_name, Validators.required],
      phone: [this.clientProfile.phone, Validators.required],
      city: [this.clientProfile.city, Validators.required],
      address: [this.clientProfile.address]
    });

    this.restoreSession();
    this.enforceDashboardAccess();
    if (this.mode === 'partner-dashboard') {
      this.loadPartnerNetwork();
      this.loadPartnerAdvanced();
    }
    if (this.mode === 'admin-dashboard') this.loadAdminNetwork();
  }

  get mode(): string {
    if (this.path === '/ingresar') return 'access';
    if (this.path === '/aliados/login') return 'partner-login';
    if (this.path === '/aliados/registro') return 'partner-register';
    if (this.path === '/aliados/dashboard') return 'partner-dashboard';
    if (this.path === '/clientes/login') return 'client-login';
    if (this.path === '/clientes/dashboard') return 'client-dashboard';
    if (this.path === '/admin/login') return 'admin-login';
    if (this.path === '/admin/dashboard') return 'admin-dashboard';
    if (this.path.includes('recuperar')) return 'recovery';
    return 'access';
  }

  get registerProgress(): number {
    return (this.registerStep / 4) * 100;
  }

  login(role: 'ally' | 'client' | 'admin'): void {
    this.error = '';
    this.message = '';
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.error = 'Revisa tus credenciales antes de continuar.';
      return;
    }

    this.loading = true;
    this.http.post<any>('/api/auth/login', {
      email: this.loginForm.value.email,
      password: this.loginForm.value.password,
      role
    }).subscribe({
      next: (response) => {
        localStorage.setItem('orjuelaToken', response.token);
        localStorage.setItem('orjuelaUser', JSON.stringify(response.user));
        this.currentUser = response.user;
        this.loading = false;
        this.go(role === 'ally' ? '/aliados/dashboard' : role === 'client' ? '/clientes/dashboard' : '/admin/dashboard');
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error || 'No fue posible iniciar sesión.';
      }
    });
  }

  registerPartner(): void {
    this.error = '';
    this.message = '';
    if (this.partnerRegisterForm.invalid) {
      this.partnerRegisterForm.markAllAsTouched();
      this.error = 'Completa los campos obligatorios antes de crear tu cuenta.';
      return;
    }
    if (this.partnerRegisterForm.value.password !== this.partnerRegisterForm.value.confirm_password) {
      this.error = 'Las contraseñas no coinciden.';
      return;
    }

    this.loading = true;
    this.http.post<any>('/api/auth/register-partner', this.partnerRegisterForm.value).subscribe({
      next: (response) => {
        localStorage.setItem('orjuelaToken', response.token);
        localStorage.setItem('orjuelaUser', JSON.stringify(response.user));
        this.currentUser = response.user;
        this.message = 'Tu cuenta de aliado fue creada exitosamente.';
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error || 'No fue posible crear la cuenta.';
      }
    });
  }

  recoverPassword(): void {
    this.error = '';
    this.message = '';
    if (this.recoveryForm.invalid) {
      this.recoveryForm.markAllAsTouched();
      return;
    }
    this.http.post<any>('/api/auth/recovery/request', this.recoveryForm.value).subscribe({
      next: (response) => this.message = response.message || 'Te enviamos instrucciones para recuperar el acceso.',
      error: (err) => this.error = err?.error?.error || 'No fue posible procesar la solicitud.'
    });
  }

  nextRegisterStep(): void {
    const controls: Record<number, string[]> = {
      1: ['full_name', 'document_id', 'phone', 'email', 'city'],
      2: ['partner_type', 'how_known'],
      3: ['password', 'confirm_password'],
      4: ['terms', 'data_auth']
    };
    const names = controls[this.registerStep];
    names.forEach((name) => this.partnerRegisterForm.get(name)?.markAsTouched());
    if (names.every((name) => this.partnerRegisterForm.get(name)?.valid)) {
      this.registerStep = Math.min(4, this.registerStep + 1);
    }
  }

  previousRegisterStep(): void {
    this.registerStep = Math.max(1, this.registerStep - 1);
  }

  setAdminSection(section: string): void {
    this.adminSection = section;
    if (section === 'partner-network') this.loadAdminNetwork();
  }

  setPartnerSection(section: string): void {
    this.partnerSection = section;
    if (['crm', 'activity', 'level', 'goals', 'notifications', 'ally-profile', 'finance', 'tree', 'academy'].includes(section)) {
      this.loadPartnerAdvanced();
    }
  }

  setClientSection(section: string): void {
    this.clientSection = section;
    this.clientFormError = '';
    this.clientFormMessage = '';
  }

  selectClientCase(caseId: number): void {
    this.selectedClientCaseId = caseId;
    this.clientSection = 'case-detail';
  }

  selectLead(lead: AdminLead): void {
    this.selectedLead = lead;
  }

  logout(): void {
    localStorage.removeItem('orjuelaToken');
    localStorage.removeItem('orjuelaUser');
    this.currentUser = null;
    this.go('/ingresar');
  }

  get partnerNetworkMetrics(): PortalMetric[] {
    const summary = this.partnerNetwork.summary || {};
    return [
      { label: 'Total referidos enviados', value: String(summary['total_referrals'] || 0) },
      { label: 'Referidos en revision', value: String(summary['in_review'] || 0) },
      { label: 'Clientes vinculados', value: String(summary['converted'] || 0) },
      { label: 'Comision pendiente', value: this.formatCurrency(summary['pending_commission']) },
      { label: 'Comision aprobada', value: this.formatCurrency(summary['approved_commission']) },
      { label: 'Comision pagada', value: this.formatCurrency(summary['paid_commission']) },
      { label: 'Aliados activos en mi red', value: String(summary['active_team_members'] || 0) },
      { label: 'Codigo unico', value: this.partnerNetwork.partner?.referral_code || 'Pendiente' }
    ];
  }

  get commissionSummary() {
    const commissions = this.partnerNetwork.commissions || [];
    const direct = commissions.filter((item) => item.commission_type === 'direct').reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const indirect = commissions.filter((item) => item.commission_type !== 'direct').reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const total = direct + indirect;
    const pending = commissions.filter((item) => item.status === 'pending').reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const approved = commissions.filter((item) => item.status === 'approved').reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const paid = commissions.filter((item) => item.status === 'paid').reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const rejected = commissions.filter((item) => item.status === 'rejected').reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return { direct, indirect, total, pending, approved, paid, rejected, receivable: pending + approved };
  }

  get payableCommissions(): any[] {
    return (this.partnerNetwork.commissions || []).filter((item) => item.status === 'approved' || item.status === 'pending');
  }

  get paidCommissions(): any[] {
    return (this.partnerNetwork.commissions || []).filter((item) => item.status === 'paid');
  }

  get partnerDynamicTree() {
    const directReferrals = this.partnerNetwork.direct_referrals || [];
    const commissions = this.partnerNetwork.commissions || [];
    const team = this.partnerNetwork.team || [];
    const totalCommissions = commissions.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return {
      name: this.partnerNetwork.partner?.full_name || this.currentUser?.full_name || 'Aliado Orjuela',
      level: 'Aliado principal',
      status: this.partnerNetwork.partner?.status || this.currentUser?.status || 'Activo',
      referrals_count: directReferrals.length,
      commissions: totalCommissions,
      children: team.map((ally) => ({
        name: ally.full_name,
        level: 'Nivel 1',
        status: ally.status === 'active' ? 'Activo' : ally.status === 'pending' ? 'Invitado' : 'Inactivo',
        referrals_count: Number(ally.referrals_count || 0),
        commissions: Number(ally.generated_commissions || 0),
        city: ally.city
      }))
    };
  }

  commissionTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      direct: 'Directa',
      indirect_level_1: 'Red nivel 1',
      indirect_level_2: 'Red nivel 2'
    };
    return labels[type] || type || 'Comisión';
  }

  commissionStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: 'Pendiente de validación',
      approved: 'Aprobada para pago',
      paid: 'Pagada',
      rejected: 'Rechazada'
    };
    return labels[status] || status || 'Pendiente';
  }

  get unreadNotifications(): number {
    return (this.partnerAdvanced.notifications || []).filter((item: any) => !item.is_read).length;
  }

  get selectedClientCase(): ClientPortalCase {
    return this.clientPortalCases.find((item) => item.id === this.selectedClientCaseId) || this.clientPortalCases[0];
  }

  get clientDashboardMetrics(): PortalMetric[] {
    const pendingDocs = this.clientDocuments.filter((item) => item.status === 'Requiere corrección' || item.status === 'En revisión').length;
    const pendingPayments = this.clientPayments.filter((item) => item.status !== 'Pagado').length;
    const unread = this.clientMessages.filter((item) => item.unread).length + this.clientNotifications.filter((item) => item.unread).length;
    return [
      { label: 'Procesos activos', value: String(this.clientPortalCases.filter((item) => item.status !== 'Finalizado').length) },
      { label: 'Próxima cita', value: '16 may' },
      { label: 'Documentos pendientes', value: String(pendingDocs) },
      { label: 'Pagos por revisar', value: String(pendingPayments) },
      { label: 'Mensajes nuevos', value: String(unread) }
    ];
  }

  get latestClientDocuments(): ClientDocument[] {
    return this.clientDocuments.slice(0, 3);
  }

  get nextClientAppointment(): ClientAppointment | undefined {
    return this.clientAppointments.find((item) => item.status !== 'Realizada' && item.status !== 'Cancelada');
  }

  get pendingClientPayment(): ClientPayment | undefined {
    return this.clientPayments.find((item) => item.status !== 'Pagado');
  }

  submitNetworkReferral(): void {
    this.formError = '';
    this.formMessage = '';
    if (this.networkReferralForm.invalid) {
      this.networkReferralForm.markAllAsTouched();
      this.formError = 'Completa los datos obligatorios del referido.';
      return;
    }
    this.loading = true;
    this.http.post<any>('/api/partner/network/referrals', this.networkReferralForm.value, { headers: this.authHeaders() }).subscribe({
      next: (response) => {
        this.loading = false;
        this.formMessage = response.message || 'Referido enviado correctamente.';
        this.networkReferralForm.reset({ data_authorization: false });
        this.loadPartnerNetwork();
      },
      error: (err) => {
        this.loading = false;
        this.formError = err?.error?.error || 'No fue posible registrar el referido.';
      }
    });
  }

  submitInvitation(): void {
    this.formError = '';
    this.formMessage = '';
    if (this.invitationForm.invalid) {
      this.invitationForm.markAllAsTouched();
      this.formError = 'Completa los datos obligatorios del nuevo aliado.';
      return;
    }
    this.loading = true;
    this.http.post<any>('/api/partner/network/invitations', this.invitationForm.value, { headers: this.authHeaders() }).subscribe({
      next: (response) => {
        this.loading = false;
        this.formMessage = response.message || 'Invitacion enviada correctamente.';
        this.invitationForm.reset();
        this.loadPartnerNetwork();
      },
      error: (err) => {
        this.loading = false;
        this.formError = err?.error?.error || 'No fue posible enviar la invitacion.';
      }
    });
  }

  loadPartnerNetwork(): void {
    const token = this.getToken();
    if (!token) return;
    this.http.get<PartnerNetwork>('/api/partner/network', { headers: this.authHeaders() }).subscribe({
      next: (response) => this.partnerNetwork = this.applyDemoPartnerDataIfNeeded(response),
      error: () => {
        if (this.environment.enableDemoData) this.partnerNetwork = this.demoPartnerNetwork();
      }
    });
  }

  loadPartnerAdvanced(): void {
    const token = this.getToken();
    if (!token) return;
    this.http.get<any>('/api/partner/advanced', { headers: this.authHeaders() }).subscribe({
      next: (response) => this.partnerAdvanced = response,
      error: () => {
        if (this.environment.enableDemoData) this.partnerAdvanced = this.demoPartnerAdvanced();
      }
    });
  }

  loadAdminNetwork(): void {
    const token = this.getToken();
    if (!token) return;
    this.http.get<any>('/api/admin/partner-network', { headers: this.authHeaders() }).subscribe({
      next: (response) => {
        this.adminNetwork = response;
        this.commissionSettingsForm.patchValue(response.settings || {});
      },
      error: () => {
        if (this.environment.enableDemoData) {
          this.adminNetwork = this.demoAdminNetwork();
          this.commissionSettingsForm.patchValue(this.adminNetwork.settings);
        }
      }
    });
  }

  updateNetworkReferralStatus(id: number, status: string): void {
    this.http.patch(`/api/admin/network-referrals/${id}/status`, { status }, { headers: this.authHeaders() }).subscribe({
      next: () => this.loadAdminNetwork()
    });
  }

  updateCommissionStatus(id: number, status: string, amount?: string): void {
    this.http.patch(`/api/admin/commissions/${id}/status`, { status, amount: amount ? Number(amount) : undefined }, { headers: this.authHeaders() }).subscribe({
      next: () => this.loadAdminNetwork()
    });
  }

  saveCommissionSettings(): void {
    if (this.commissionSettingsForm.invalid) return;
    this.http.patch('/api/admin/commission-settings', this.commissionSettingsForm.value, { headers: this.authHeaders() }).subscribe({
      next: () => this.loadAdminNetwork()
    });
  }

  copyText(value: string): void {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(value || '');
      this.formMessage = 'Texto copiado al portapapeles.';
    }
  }

  markNotificationRead(id: number): void {
    this.http.post(`/api/partner/notifications/${id}/read`, {}, { headers: this.authHeaders() }).subscribe({
      next: () => this.loadPartnerAdvanced()
    });
  }

  markAllNotificationsRead(): void {
    this.http.post('/api/partner/notifications/read-all', {}, { headers: this.authHeaders() }).subscribe({
      next: () => this.loadPartnerAdvanced()
    });
  }

  submitClientDocument(): void {
    this.clientFormError = '';
    this.clientFormMessage = '';
    if (this.clientDocumentForm.invalid) {
      this.clientDocumentForm.markAllAsTouched();
      this.clientFormError = 'Completa los datos del documento. Tamaño máximo: 10 MB.';
      return;
    }
    const fileName = this.clientDocumentForm.value.fileName;
    const fileType = String(this.clientDocumentForm.value.fileType || '').toLowerCase();
    if (!['pdf', 'jpg', 'jpeg', 'png', 'docx'].includes(fileType)) {
      this.clientFormError = 'Formato no permitido. Usa PDF, JPG, PNG o DOCX.';
      return;
    }
    this.clientDocuments.unshift({
      id: Date.now(),
      caseTitle: this.clientDocumentForm.value.caseTitle,
      name: fileName,
      uploadedBy: 'Cliente',
      uploadedAt: new Date().toISOString().slice(0, 10),
      status: 'Recibido',
      observations: this.clientDocumentForm.value.observations || 'Pendiente de revisión por el abogado.',
      size: `${this.clientDocumentForm.value.fileSizeMb} MB`
    });
    this.clientFormMessage = 'Documento registrado correctamente. Quedó pendiente de revisión.';
    this.clientDocumentForm.patchValue({ fileName: '', fileType: '', fileSizeMb: 1, observations: '' });
  }

  submitClientAppointment(): void {
    this.clientFormError = '';
    this.clientFormMessage = '';
    if (this.clientAppointmentForm.invalid) {
      this.clientAppointmentForm.markAllAsTouched();
      this.clientFormError = 'Completa la información para solicitar la cita.';
      return;
    }
    this.clientAppointments.unshift({
      title: this.clientAppointmentForm.value.reason,
      caseTitle: this.clientAppointmentForm.value.caseTitle,
      date: this.clientAppointmentForm.value.requestedDate,
      type: this.clientAppointmentForm.value.type,
      status: 'Solicitada',
      location: 'Pendiente de confirmación'
    });
    this.clientFormMessage = 'Solicitud de cita enviada. El equipo confirmará disponibilidad.';
    this.clientAppointmentForm.patchValue({ requestedDate: '', reason: '' });
  }

  submitClientMessage(): void {
    this.clientFormError = '';
    this.clientFormMessage = '';
    if (this.clientMessageForm.invalid) {
      this.clientMessageForm.markAllAsTouched();
      this.clientFormError = 'Escribe un mensaje claro para el abogado asignado.';
      return;
    }
    this.clientMessages.unshift({
      caseTitle: this.clientMessageForm.value.caseTitle,
      from: this.currentUser?.full_name || 'Cliente',
      date: new Date().toISOString(),
      unread: false,
      text: this.clientMessageForm.value.message,
      attachmentName: this.clientMessageForm.value.attachment || undefined
    });
    this.clientFormMessage = 'Mensaje enviado a la firma.';
    this.clientMessageAttachmentName = '';
    this.clientMessageForm.patchValue({ message: '', attachment: '' });
  }

  onClientMessageAttachmentChange(event: Event): void {
    this.clientFormError = '';
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      this.clientMessageAttachmentName = '';
      this.clientMessageForm.patchValue({ attachment: '' });
      return;
    }

    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/webp'
    ];

    if (!allowedTypes.includes(file.type)) {
      this.clientFormError = 'Adjunta únicamente documentos PDF, DOC, DOCX o imágenes JPG, PNG, WEBP.';
      input.value = '';
      this.clientMessageAttachmentName = '';
      this.clientMessageForm.patchValue({ attachment: '' });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      this.clientFormError = 'El archivo adjunto no puede superar 10 MB.';
      input.value = '';
      this.clientMessageAttachmentName = '';
      this.clientMessageForm.patchValue({ attachment: '' });
      return;
    }

    this.clientMessageAttachmentName = file.name;
    this.clientMessageForm.patchValue({ attachment: file.name });
  }

  onClientServiceDocumentChange(event: Event): void {
    this.clientFormError = '';
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      this.clientServiceAttachmentName = '';
      this.clientServiceForm.patchValue({ documents: '' });
      return;
    }

    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/webp'
    ];

    if (!allowedTypes.includes(file.type)) {
      this.clientFormError = 'Adjunta únicamente documentos PDF, DOC, DOCX o imágenes JPG, PNG, WEBP.';
      input.value = '';
      this.clientServiceAttachmentName = '';
      this.clientServiceForm.patchValue({ documents: '' });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      this.clientFormError = 'El documento inicial no puede superar 10 MB.';
      input.value = '';
      this.clientServiceAttachmentName = '';
      this.clientServiceForm.patchValue({ documents: '' });
      return;
    }

    this.clientServiceAttachmentName = file.name;
    this.clientServiceForm.patchValue({ documents: file.name });
  }

  submitClientServiceRequest(): void {
    this.clientFormError = '';
    this.clientFormMessage = '';
    if (this.clientServiceForm.invalid) {
      this.clientServiceForm.markAllAsTouched();
      this.clientFormError = 'Completa los campos obligatorios para solicitar el servicio.';
      return;
    }
    this.clientServiceRequests.unshift({
      ...this.clientServiceForm.value,
      status: 'Enviada',
      createdAt: new Date().toISOString().slice(0, 10)
    });
    this.clientFormMessage = 'Solicitud enviada. Queda lista para registrarse en el panel administrativo cuando se conecte al API.';
    this.clientServiceAttachmentName = '';
    this.clientServiceForm.reset({ urgency: 'Media', email: this.clientProfile.email, phone: this.clientProfile.phone });
  }

  saveClientProfile(): void {
    this.clientFormError = '';
    this.clientFormMessage = '';
    if (this.clientProfileForm.invalid) {
      this.clientProfileForm.markAllAsTouched();
      this.clientFormError = 'Revisa los datos básicos antes de guardar.';
      return;
    }
    this.clientProfile = { ...this.clientProfile, ...this.clientProfileForm.value };
    this.clientFormMessage = 'Datos actualizados correctamente.';
  }

  markClientNotificationsRead(): void {
    this.clientNotifications = this.clientNotifications.map((item) => ({ ...item, unread: false }));
    this.clientFormMessage = 'Notificaciones marcadas como leídas.';
  }

  formatCurrency(value: any): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(value || 0));
  }

  pipelineCount(status: string): number {
    return (this.partnerAdvanced.crm_referrals || []).filter((item: any) => item.current_status === status).length;
  }

  private getToken(): string {
    return localStorage.getItem('orjuelaToken') || '';
  }

  private authHeaders(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.getToken()}` });
  }

  go(path: string): void {
    if (typeof window !== 'undefined') {
      window.location.href = path;
    }
  }

  private restoreSession(): void {
    const raw = localStorage.getItem('orjuelaUser');
    this.currentUser = raw ? JSON.parse(raw) : null;
  }

  private enforceDashboardAccess(): void {
    if (!this.mode.endsWith('dashboard')) return;
    if (!this.currentUser) {
      this.go('/ingresar');
      return;
    }
    if (this.mode === 'client-dashboard' && this.currentUser.role !== 'client') {
      this.go(this.currentUser.role === 'ally' ? '/aliados/dashboard' : '/admin/dashboard');
    }
    if (this.mode === 'partner-dashboard' && this.currentUser.role !== 'ally') {
      this.go(this.currentUser.role === 'client' ? '/clientes/dashboard' : '/admin/dashboard');
    }
    if (this.mode === 'admin-dashboard' && !['admin', 'abogado', 'asistente'].includes(this.currentUser.role)) {
      this.go(this.currentUser.role === 'client' ? '/clientes/dashboard' : '/aliados/dashboard');
    }
  }

  private resolveEnvironment() {
    const host = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
    const isPreviewHost = ['localhost', '127.0.0.1'].includes(host)
      || host.includes('qa')
      || host.includes('staging')
      || host.includes('preprod');

    return {
      ...environment,
      name: isPreviewHost ? 'qa' : environment.name,
      enableDemoData: environment.enableDemoData || isPreviewHost,
      showEnvironmentBadge: environment.showEnvironmentBadge || isPreviewHost
    };
  }

  private demoPartnerNetwork(): PartnerNetwork {
    const invite = 'http://localhost:4200/aliados/registro?ref=ORJUELAQA';
    const directReferrals = [
      { id: 1, referred_full_name: 'Maria Rodriguez', legal_area: 'Inmobiliario', created_at: '2026-05-08', status: 'Contactado', commission_amount: 180000 },
      { id: 2, referred_full_name: 'Carlos Perez', legal_area: 'Civil', created_at: '2026-05-04', status: 'Nuevo', commission_amount: 120000 },
      { id: 3, referred_full_name: 'Empresa Andina', legal_area: 'Contratos', created_at: '2026-04-29', status: 'Cliente activo', commission_amount: 320000 },
      { id: 4, referred_full_name: 'Laura Mendez', legal_area: 'Familia', created_at: '2026-05-12', status: 'En revision', commission_amount: 240000 },
      { id: 5, referred_full_name: 'Jorge Salinas', legal_area: 'Cobro de cartera', created_at: '2026-05-10', status: 'Caso cerrado', commission_amount: 0 }
    ];
    const networkReferrals = [
      { id: 6, masked_name: 'Juliana M.', legal_area: 'Familia', source_ally_name: 'Camila Red Aliada', status: 'En revision', commission_amount: 90000, created_at: '2026-05-11' },
      { id: 7, masked_name: 'Inmobiliaria N.', legal_area: 'Contratos', source_ally_name: 'Camila Red Aliada', status: 'Cliente activo', commission_amount: 135000, created_at: '2026-05-09' },
      { id: 8, masked_name: 'Daniel R.', legal_area: 'Laboral', source_ally_name: 'Andres Red Aliado', status: 'Comision pagada', commission_amount: 60000, created_at: '2026-04-25' },
      { id: 9, masked_name: 'Sofia P.', legal_area: 'Comercial', source_ally_name: 'Camila Red Aliada', status: 'Nuevo referido', commission_amount: 45000, created_at: '2026-05-13' }
    ];
    const commissions = [
      { id: 1, commission_type: 'direct', percentage: 10, amount: 180000, status: 'approved', referred_full_name: 'Maria Rodriguez', created_at: '2026-05-08' },
      { id: 2, commission_type: 'direct', percentage: 10, amount: 120000, status: 'pending', referred_full_name: 'Carlos Perez', created_at: '2026-05-04' },
      { id: 3, commission_type: 'direct', percentage: 10, amount: 320000, status: 'paid', referred_full_name: 'Empresa Andina', created_at: '2026-04-29' },
      { id: 4, commission_type: 'direct', percentage: 10, amount: 240000, status: 'approved', referred_full_name: 'Laura Mendez', created_at: '2026-05-12' },
      { id: 5, commission_type: 'indirect_level_1', percentage: 3, amount: 90000, status: 'pending', referred_full_name: 'Juliana M.', source_ally_name: 'Camila Red Aliada', created_at: '2026-05-11' },
      { id: 6, commission_type: 'indirect_level_1', percentage: 3, amount: 135000, status: 'approved', referred_full_name: 'Inmobiliaria Norte', source_ally_name: 'Camila Red Aliada', created_at: '2026-05-09' },
      { id: 7, commission_type: 'indirect_level_1', percentage: 3, amount: 60000, status: 'paid', referred_full_name: 'Daniel Rojas', source_ally_name: 'Andres Red Aliado', created_at: '2026-04-25' },
      { id: 8, commission_type: 'indirect_level_1', percentage: 3, amount: 45000, status: 'pending', referred_full_name: 'Sofia Parra', source_ally_name: 'Camila Red Aliada', created_at: '2026-05-13' }
    ];
    return {
      partner: { referral_code: 'ORJUELAQA', invite_link: invite },
      summary: { total_referrals: directReferrals.length, in_review: 2, converted: 2, pending_commission: 255000, approved_commission: 555000, paid_commission: 380000, active_team_members: 2 },
      settings: { direct_percentage: 10, level_1_percentage: 3, level_2_percentage: 1 },
      team: [
        { full_name: 'Camila Red Aliada', city: 'Medellin', status: 'active', referrals_count: 3, generated_commissions: 270000 },
        { full_name: 'Andres Red Aliado', city: 'Cali', status: 'active', referrals_count: 1, generated_commissions: 60000 }
      ],
      direct_referrals: directReferrals,
      network_referrals: networkReferrals,
      commissions,
      share: {
        client_message: `Hola, quiero recomendarte a Orjuela Abogados. Pueden ayudarte con asesoria juridica personalizada. Puedes dejar tus datos aqui: ${invite}`,
        ally_message: `Hola, quiero invitarte al programa de aliados de Orjuela Abogados. Puedes referir personas que necesiten servicios legales y recibir comisiones por casos efectivos. Registrate aqui: ${invite}`
      }
    };
  }

  private applyDemoPartnerDataIfNeeded(response: PartnerNetwork): PartnerNetwork {
    const hasReferralData = Boolean(response?.direct_referrals?.length || response?.network_referrals?.length || response?.commissions?.length);
    if (!this.environment.enableDemoData || hasReferralData) return response;
    const demo = this.demoPartnerNetwork();
    return {
      ...demo,
      partner: {
        ...demo.partner,
        ...(response.partner || {}),
        referral_code: response.partner?.referral_code || demo.partner?.referral_code,
        invite_link: response.partner?.invite_link || demo.partner?.invite_link
      },
      settings: response.settings || demo.settings
    };
  }

  private demoPartnerAdvanced() {
    return {
      resources: [
        { title: 'Mensaje para cliente', resource_type: 'WhatsApp', content: this.partnerNetwork.share?.client_message || 'Hola, quiero recomendarte a Orjuela Abogados.' },
        { title: 'Mensaje para invitar aliado', resource_type: 'WhatsApp', content: this.partnerNetwork.share?.ally_message || 'Hola, quiero invitarte al programa de aliados.' },
        { title: 'Texto para redes sociales', resource_type: 'Redes', content: 'Acompañamiento legal claro, profesional y personalizado con Orjuela Abogados.' },
        { title: 'Flyer servicios legales', resource_type: 'Flyer', url: '/assets/logoCompleto.jpg' },
        { title: 'PDF portafolio de servicios', resource_type: 'PDF', url: '/assets/logoCompleto.jpg' },
        { title: 'Logo autorizado', resource_type: 'Logo', url: '/assets/logoCompleto.jpg' }
      ],
      activity: [
        { date: '2026-05-13', type: 'Referido contactado', description: 'El equipo contactó a Maria Rodriguez.', icon: 'bi-telephone', status: 'Contactado' },
        { date: '2026-05-12', type: 'Comisión aprobada', description: 'Comisión directa aprobada por referido efectivo.', icon: 'bi-cash-coin', status: 'approved' },
        { date: '2026-05-11', type: 'Nuevo aliado unido a mi red', description: 'Camila Red Aliada se unió a tu red.', icon: 'bi-diagram-3', status: 'Activo' }
      ],
      crm_referrals: [
        { name: 'Maria Rodriguez', phone: '301 444 7788', case_type: 'Inmobiliario', registered_at: '2026-05-08', current_status: 'Contactado', updated_at: '2026-05-13', observations: 'Cliente solicitó revisión de documentos.' },
        { name: 'Carlos Perez', phone: '312 456 8899', case_type: 'Civil', registered_at: '2026-05-04', current_status: 'Consulta agendada', updated_at: '2026-05-12', observations: 'Cita programada con el equipo civil.' }
      ],
      level: { current: { name: 'Plata', benefits: 'Prioridad en soporte y plantillas avanzadas.' }, next: { name: 'Oro', min_converted_referrals: 8, min_commissions: 1500000, min_active_allies: 3 }, progress: 58 },
      goals: { referral_goal: 8, converted_goal: 2, commission_goal: 700000, referral_progress: 62, converted_progress: 50, commission_progress: 46, message: 'Vas avanzando bien: prioriza referidos con información completa.' },
      notifications: [
        { id: 1, title: 'Comisión aprobada', description: 'Tu comisión por Maria Rodriguez fue aprobada.', notification_type: 'Comisión aprobada', is_read: 0, created_at: '2026-05-13' },
        { id: 2, title: 'Perfil pendiente', description: 'Completa tus datos de contacto para mantener activo el seguimiento de pagos.', notification_type: 'Perfil', is_read: 0, created_at: '2026-05-12' }
      ],
      profile: { ...(this.partnerNetwork.partner || {}), document_id: '900111222', phone: '300 111 2233', city: 'Bogotá', occupation: 'Asesor comercial', status: 'Activo', joined_at: '2026-05-01', bank_name: 'Dato sensible protegido', account_type: 'Dato sensible protegido', account_number: '****' },
      charts: { commissions_by_month: [{ label: '2026-04', value: 380000 }, { label: '2026-05', value: 810000 }], referrals_by_month: [{ label: '2026-04', value: 2 }, { label: '2026-05', value: 7 }], network_growth: [{ label: '2026-05', value: 2 }], direct_vs_indirect: [{ label: 'Directas', value: 860000 }, { label: 'Indirectas', value: 330000 }], pending_vs_paid: [{ label: 'Pendientes', value: 255000 }, { label: 'Pagadas', value: 380000 }] },
      academy: [
        { title: 'Cómo funciona el programa', description: 'Reglas, estados y comisiones.', progress: 80, progress_status: 'completado' },
        { title: 'Protección de datos personales', description: 'Buenas prácticas de habeas data.', progress: 40, progress_status: 'pendiente' }
      ]
    };
  }

  private demoAdminNetwork() {
    const partner = this.demoPartnerNetwork();
    return {
      settings: partner.settings,
      allies: [
        { user_id: 1, full_name: 'Aliado Demo Orjuela', email: 'aliado@orjuela.demo', city: 'Bogota', status: 'active', referral_code: 'ORJUELAQA', invited_by_name: '', referrals_count: 12, commissions_total: 500000 },
        { user_id: 2, full_name: 'Camila Red Aliada', email: 'camila.red@orjuela.demo', city: 'Medellin', status: 'active', referral_code: 'CAMILAQA', invited_by_name: 'Aliado Demo Orjuela', referrals_count: 4, commissions_total: 90000 }
      ],
      referrals: [
        { id: 1, referred_full_name: 'Maria Rodriguez', legal_area: 'Inmobiliario', ally_name: 'Aliado Demo Orjuela', status: 'En revision', created_at: '2026-05-08' },
        { id: 2, referred_full_name: 'Juliana Mendez', legal_area: 'Familia', ally_name: 'Camila Red Aliada', status: 'Nuevo referido', created_at: '2026-05-11' }
      ],
      commissions: partner.commissions?.map((item: any) => ({ ...item, ally_name: 'Aliado Demo Orjuela', source_ally_name: item.source_ally_name || 'Aliado Demo Orjuela' }))
    };
  }
}

