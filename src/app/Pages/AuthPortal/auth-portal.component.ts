import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { APP_PUBLIC_CONFIG } from '../../shared/config/app-public-config';
import { NavbarComponent } from '../../Navbar/navbar.component';

declare const google: any;

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
type ClientDocument = { id: number; caseTitle: string; name: string; uploadedBy: string; uploadedAt: string; status: string; observations: string; size: string; fileUrl?: string };
type ClientPayment = { id?: number; concept: string; caseTitle: string; amount: number; dueDate: string; status: string; receipt: string; supportUrl?: string; paymentMethod?: string };
type ClientAppointment = { id?: number; title: string; caseTitle: string; date: string; type: string; status: string; location: string };
type ClientMessage = { caseTitle: string; from: string; date: string; unread: boolean; text: string; attachmentName?: string; attachmentUrl?: string };
type ClientNotification = { id?: number; title: string; description: string; date: string; type: string; unread: boolean };
type LegalServiceRequest = { service_type: string; description: string; urgency: string; documents: string; city: string; email: string; phone: string; status?: string; createdAt?: string };
type ClientProfile = {
  full_name: string;
  document_id: string;
  email: string;
  phone: string;
  city: string;
  address: string;
  created_at: string;
  updated_at: string;
  verified: boolean;
  assigned_lawyer?: string;
};
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
  imports: [CommonModule, FormsModule, ReactiveFormsModule, HttpClientModule, NavbarComponent],
  templateUrl: './auth-portal.component.html',
  styleUrls: ['./auth-portal.component.scss']
})
export class AuthPortalComponent implements OnInit {
  path = typeof window !== 'undefined' ? window.location.pathname : '/ingresar';
  loginForm!: FormGroup;
  partnerRegisterForm!: FormGroup;
  accountRegisterForm!: FormGroup;
  recoveryForm!: FormGroup;
  resetPasswordForm!: FormGroup;
  networkReferralForm!: FormGroup;
  invitationForm!: FormGroup;
  commissionSettingsForm!: FormGroup;
  clientDocumentForm!: FormGroup;
  clientAppointmentForm!: FormGroup;
  clientMessageForm!: FormGroup;
  clientPaymentSupportForm!: FormGroup;
  clientServiceForm!: FormGroup;
  clientProfileForm!: FormGroup;
  allyProfileForm!: FormGroup;
  adminLeadForm!: FormGroup;
  adminCaseForm!: FormGroup;
  adminClientForm!: FormGroup;
  adminAllyForm!: FormGroup;
  adminPaymentForm!: FormGroup;
  adminDocumentForm!: FormGroup;
  adminAgendaForm!: FormGroup;
  adminLevelForm!: FormGroup;
  adminGoalForm!: FormGroup;
  adminResourceForm!: FormGroup;
  adminAcademyForm!: FormGroup;
  adminFraudAlertForm!: FormGroup;
  registerStep = 1;
  showPassword = false;
  showResetPassword = false;
  loading = false;
  googleLoadingRole: 'ally' | 'client' | 'admin' | null = null;
  message = '';
  error = '';
  currentUser: any = null;
  adminSection = 'dashboard';
  partnerSection = 'overview';
  clientSection = 'dashboard';
  partnerNetwork: PartnerNetwork = {};
  partnerAdvanced: any = {};
  adminNetwork: any = { allies: [], referrals: [], commissions: [], settings: {} };
  adminDashboard: any = { metrics: [], recentLeads: [], deadlines: [], appointments: [], reports: {} };
  adminClients: any[] = [];
  adminCases: any[] = [];
  adminPayments: any[] = [];
  adminDocuments: any[] = [];
  adminAgenda: any[] = [];
  adminReports: any = {};
  adminNotifications: any[] = [];
  showAdminLeadForm = false;
  showAdminClientForm = false;
  showAdminAllyForm = false;
  showAdminPaymentForm = false;
  showAdminDocumentForm = false;
  showAdminAgendaForm = false;
  editingAdminClientId: number | null = null;
  editingAdminCaseId: number | null = null;
  editingAdminAllyId: number | null = null;
  editingAdminLevelId: number | null = null;
  editingAdminGoalId: number | null = null;
  editingAdminResourceId: number | null = null;
  editingAdminAcademyId: number | null = null;
  editingAdminFraudAlertId: number | null = null;
  showAllyProfileForm = false;
  selectedPartnerReferral: any = null;
  selectedPartnerTeamAlly: any = null;
  selectedAcademyModule: any = null;
  partnerReferralSearch = '';
  partnerReferralStatus = 'Todos';
  clientCaseSearch = '';
  clientCaseStatus = 'Todos los estados';
  clientPaymentStatus = 'Todos';
  adminLeadSearch = '';
  adminLeadStatus = 'Todos los estados';
  adminLeadSource = 'Todas las fuentes';
  adminCaseSearch = '';
  adminCaseStatus = 'Todos los estados';
  adminPaymentSearch = '';
  adminPaymentStatus = 'Todos los estados';
  formMessage = '';
  formError = '';
  clientFormMessage = '';
  clientFormError = '';
  clientMessageAttachmentName = '';
  clientServiceAttachmentName = '';
  clientDocumentFile: File | null = null;
  clientMessageFile: File | null = null;
  clientServiceFile: File | null = null;
  clientProfileLoading = false;
  clientProfileSaving = false;
  showClientDocument = false;
  selectedClientCaseId = 1;
  selectedClientPaymentId: number | null = null;
  reschedulingAppointmentId: number | null = null;
  resetCode = '';
  private googleScriptPromise?: Promise<void>;
  readonly environment = this.resolveEnvironment();
  readonly strongPasswordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
  readonly passwordRules = [
    'Mínimo 8 caracteres',
    'Una letra mayúscula',
    'Una letra minúscula',
    'Un número',
    'Un símbolo'
  ];

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

  clientProfile: ClientProfile = {
    full_name: 'Usuario Prueba',
    document_id: '12345678',
    email: 'cliente@orjuela.com',
    phone: '3000000000',
    city: 'Bogotá',
    address: 'Dirección por actualizar',
    created_at: '2026-05-01',
    updated_at: '2026-05-01',
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
      document_id: [''],
      phone: [''],
      email: ['', [Validators.required, Validators.email]],
      city: [''],
      password: ['', [Validators.required, Validators.pattern(this.strongPasswordPattern)]],
      confirm_password: ['', [Validators.required, Validators.pattern(this.strongPasswordPattern)]],
      terms: [false, Validators.requiredTrue],
      data_auth: [false, Validators.requiredTrue]
    });

    this.accountRegisterForm = this.fb.group({
      full_name: ['', Validators.required],
      document_id: [''],
      phone: [''],
      city: [''],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.pattern(this.strongPasswordPattern)]],
      confirm_password: ['', [Validators.required, Validators.pattern(this.strongPasswordPattern)]],
      admin_registration_code: [''],
      terms: [false, Validators.requiredTrue],
      data_auth: [true]
    });
    this.configureAccountRegisterValidators();

    this.recoveryForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });

    this.resetCode = this.getQueryParam('codigo') || this.getQueryParam('token');
    this.resetPasswordForm = this.fb.group({
      codigo: [this.resetCode, Validators.required],
      password: ['', [Validators.required, Validators.pattern(this.strongPasswordPattern)]],
      confirm_password: ['', [Validators.required, Validators.pattern(this.strongPasswordPattern)]]
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

    this.clientPaymentSupportForm = this.fb.group({
      support_url: ['', Validators.required],
      payment_method: ['Nequi 3118924111', Validators.required],
      payment_date: ['']
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
      full_name: [this.clientProfile.full_name, [Validators.required, Validators.minLength(3), Validators.maxLength(140)]],
      phone: [this.clientProfile.phone, [Validators.required, Validators.pattern(/^3\d{9}$|^\+57\s?3\d{9}$/)]],
      city: [this.clientProfile.city, [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
      address: [this.clientProfile.address, Validators.maxLength(160)]
    });

    this.allyProfileForm = this.fb.group({
      phone: ['', Validators.required],
      city: ['', Validators.required],
      partner_type: ['Independiente', Validators.required],
      company: [''],
      occupation: [''],
      bank_name: [''],
      account_type: [''],
      account_number: ['']
    });

    this.adminLeadForm = this.fb.group({
      name: ['', Validators.required],
      phone: ['', Validators.required],
      email: ['', Validators.email],
      case_type: ['', Validators.required],
      source: ['Web', Validators.required],
      assigned_to: ['Comercial'],
      priority: ['Media'],
      next_action: ['Contactar al lead'],
      notes: ['']
    });

    this.adminCaseForm = this.fb.group({
      client_name: ['', Validators.required],
      client_phone: ['', Validators.required],
      client_email: ['', Validators.email],
      case_type: ['', Validators.required],
      description: [''],
      status: ['Recibido', Validators.required],
      assigned_lawyer: ['Equipo Orjuela'],
      next_action: ['Revisar documentación inicial']
    });

    this.adminClientForm = this.fb.group({
      name: ['', Validators.required],
      document_id: [''],
      phone: ['', Validators.required],
      email: ['', Validators.email],
      city: [''],
      address: [''],
      status: ['Activo'],
      verified: [false]
    });

    this.adminAllyForm = this.fb.group({
      full_name: ['', Validators.required],
      document_id: [''],
      phone: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      city: ['', Validators.required],
      partner_type: ['Independiente'],
      occupation: [''],
      status: ['active']
    });

    this.adminPaymentForm = this.fb.group({
      related_type: ['case', Validators.required],
      related_id: [1, Validators.required],
      concept: [''],
      amount: [0, Validators.required],
      status: ['Pendiente', Validators.required],
      payment_method: ['Nequi 3118924111', Validators.required],
      payment_date: [''],
      support_url: ['']
    });

    this.adminDocumentForm = this.fb.group({
      case_id: [1, Validators.required],
      file_name: ['', Validators.required],
      file_url: ['#'],
      document_type: ['General'],
      status: ['Recibido'],
      observations: ['']
    });

    this.adminAgendaForm = this.fb.group({
      title: ['', Validators.required],
      client_name: [''],
      related_type: ['case'],
      related_id: [''],
      assigned_to: ['Equipo Orjuela'],
      scheduled_at: ['', Validators.required],
      status: ['Programada'],
      notes: ['']
    });

    this.adminLevelForm = this.fb.group({
      name: ['', Validators.required],
      min_converted_referrals: [0, Validators.required],
      min_commissions: [0, Validators.required],
      min_active_allies: [0, Validators.required],
      benefits: [''],
      sort_order: [1, Validators.required]
    });

    this.adminGoalForm = this.fb.group({
      ally_id: [''],
      month: [new Date().toISOString().slice(0, 7), Validators.required],
      referral_goal: [5, Validators.required],
      converted_goal: [1, Validators.required],
      commission_goal: [500000, Validators.required]
    });

    this.adminResourceForm = this.fb.group({
      title: ['', Validators.required],
      resource_type: ['Mensaje', Validators.required],
      description: [''],
      url: [''],
      content: ['']
    });

    this.adminAcademyForm = this.fb.group({
      title: ['', Validators.required],
      description: ['', Validators.required],
      content: [''],
      video_url: [''],
      sort_order: [1, Validators.required]
    });

    this.adminFraudAlertForm = this.fb.group({
      ally_id: [''],
      referral_id: [''],
      risk_level: ['Medio', Validators.required],
      alert_type: ['Revisión manual', Validators.required],
      description: ['', Validators.required],
      status: ['open', Validators.required]
    });

    this.restoreSession();
    this.enforceDashboardAccess();
    if (this.mode === 'partner-dashboard') {
      this.loadPartnerNetwork();
      this.loadPartnerAdvanced();
    }
    if (this.mode === 'client-dashboard') {
      this.loadClientProfile();
      this.loadClientPortal();
    }
    if (this.mode === 'admin-dashboard') {
      this.loadAdminDashboard();
      this.loadAdminSectionData('dashboard');
    }
  }

  get mode(): string {
    if (this.path === '/ingresar') return 'access';
    if (this.path === '/aliados/login') return 'partner-login';
    if (this.path === '/aliados/registro') return 'partner-register';
    if (this.path === '/aliados/dashboard') return 'partner-dashboard';
    if (this.path === '/clientes/login') return 'client-login';
    if (this.path === '/clientes/registro') return 'client-register';
    if (this.path === '/clientes/dashboard') return 'client-dashboard';
    if (this.path === '/admin/login') return 'admin-login';
    if (this.path === '/admin/registro') return 'admin-register';
    if (this.path === '/admin/dashboard') return 'admin-dashboard';
    if (this.path.includes('restablecer-contrasena')) return 'reset-password';
    if (this.path.includes('recuperar')) return 'recovery';
    return 'access';
  }

  get registerProgress(): number {
    return (this.registerStep / 3) * 100;
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
    this.http.post<any>(this.apiUrl('/api/auth/login'), {
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

  continueWithGoogle(role: 'ally' | 'client' | 'admin'): void {
    this.error = '';
    this.message = '';
    const clientId = this.environment.googleClientId;
    if (!clientId) {
      this.error = 'Configura GOOGLE_CLIENT_ID para activar el acceso con Google.';
      return;
    }

    this.googleLoadingRole = role;
    this.loadGoogleScript()
      .then(() => {
        google.accounts.id.initialize({
          client_id: clientId,
          callback: (response: { credential?: string }) => {
            if (!response?.credential) {
              this.requestGoogleAccessToken(role, clientId);
              return;
            }
            this.completeGoogleAuth(role, { credential: response.credential });
          },
          auto_select: false,
          cancel_on_tap_outside: true
        });
        google.accounts.id.prompt((notification: any) => {
          if (notification?.isNotDisplayed?.() || notification?.isSkippedMoment?.()) {
            this.requestGoogleAccessToken(role, clientId);
          }
        });
      })
      .catch(() => {
        this.googleLoadingRole = null;
        this.error = 'No fue posible cargar Google Sign-In.';
      });
  }

  private requestGoogleAccessToken(role: 'ally' | 'client' | 'admin', clientId: string): void {
    try {
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'openid email profile',
        callback: (response: { access_token?: string; error?: string }) => {
          if (response?.error || !response?.access_token) {
            this.googleLoadingRole = null;
            this.error = 'No recibimos la autorización de Google. Intenta de nuevo.';
            return;
          }
          this.completeGoogleAuth(role, { access_token: response.access_token });
        }
      });
      tokenClient.requestAccessToken({ prompt: 'select_account' });
    } catch {
      this.googleLoadingRole = null;
      this.error = 'No fue posible iniciar la ventana de Google.';
    }
  }

  private completeGoogleAuth(role: 'ally' | 'client' | 'admin', googlePayload: { credential?: string; access_token?: string }): void {
    this.http.post<any>(this.apiUrl('/api/auth/google'), { role, ...googlePayload }).subscribe({
      next: (response) => {
        localStorage.setItem('orjuelaToken', response.token);
        localStorage.setItem('orjuelaUser', JSON.stringify(response.user));
        this.currentUser = response.user;
        this.googleLoadingRole = null;
        this.go(role === 'ally' ? '/aliados/dashboard' : role === 'client' ? '/clientes/dashboard' : '/admin/dashboard');
      },
      error: (err) => {
        this.googleLoadingRole = null;
        this.error = err?.error?.error || 'No fue posible continuar con Google.';
      }
    });
  }

  private loadGoogleScript(): Promise<void> {
    if (typeof window === 'undefined') return Promise.reject();
    if ((window as any).google?.accounts?.id) return Promise.resolve();
    if (!this.googleScriptPromise) {
      this.googleScriptPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject();
        document.head.appendChild(script);
      });
    }
    return this.googleScriptPromise;
  }

  registerPartner(): void {
    this.error = '';
    this.message = '';
    if (this.partnerRegisterForm.invalid) {
      this.partnerRegisterForm.markAllAsTouched();
      this.error = this.getPartnerRegisterError();
      return;
    }
    if (this.partnerRegisterForm.value.password !== this.partnerRegisterForm.value.confirm_password) {
      this.error = 'Las contraseñas no coinciden.';
      return;
    }
    if (this.partnerRegisterForm.get('email')?.invalid) {
      this.error = 'Ingresa un correo electrónico válido.';
      return;
    }
    if (!this.strongPasswordPattern.test(this.partnerRegisterForm.value.password || '')) {
      this.error = 'La contraseña debe tener mínimo 8 caracteres, mayúscula, minúscula, número y símbolo.';
      return;
    }

    this.loading = true;
    this.http.post<any>(this.apiUrl('/api/auth/register-partner'), this.partnerRegisterForm.value).subscribe({
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

  private getPartnerRegisterError(): string {
    const email = this.partnerRegisterForm.get('email');
    const password = this.partnerRegisterForm.get('password');
    const confirmPassword = this.partnerRegisterForm.get('confirm_password');

    if (email?.hasError('email')) {
      return 'Ingresa un correo electrónico válido.';
    }
    if (password?.hasError('pattern') || confirmPassword?.hasError('pattern')) {
      return 'La contraseña debe tener mínimo 8 caracteres, mayúscula, minúscula, número y símbolo.';
    }
    if (this.partnerRegisterForm.get('terms')?.invalid || this.partnerRegisterForm.get('data_auth')?.invalid) {
      return 'Acepta las políticas del programa y autoriza el tratamiento de datos.';
    }
    return 'Completa todos los campos obligatorios para crear tu cuenta de aliado.';
  }

  registerAccount(role: 'client' | 'admin'): void {
    this.error = '';
    this.message = '';
    this.configureAccountRegisterValidators(role);
    if (this.accountRegisterForm.invalid) {
      this.accountRegisterForm.markAllAsTouched();
      this.error = this.getAccountRegisterError(role);
      return;
    }
    if (this.accountRegisterForm.value.password !== this.accountRegisterForm.value.confirm_password) {
      this.error = 'Las contraseñas no coinciden.';
      return;
    }
    if (!this.strongPasswordPattern.test(this.accountRegisterForm.value.password || '')) {
      this.error = 'La contraseña debe tener mínimo 8 caracteres, mayúscula, minúscula, número y símbolo.';
      return;
    }
    if (role === 'admin' && !this.accountRegisterForm.value.admin_registration_code) {
      this.error = 'Ingresa el código interno para crear una cuenta administrativa.';
      return;
    }

    this.loading = true;
    const endpoint = role === 'client' ? '/api/auth/register-client' : '/api/auth/register-admin';
    this.http.post<any>(this.apiUrl(endpoint), this.accountRegisterForm.value).subscribe({
      next: (response) => {
        localStorage.setItem('orjuelaToken', response.token);
        localStorage.setItem('orjuelaUser', JSON.stringify(response.user));
        this.currentUser = response.user;
        this.message = role === 'client' ? 'Tu cuenta de cliente fue creada correctamente.' : 'Tu cuenta administrativa fue creada correctamente.';
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error || 'No fue posible crear la cuenta.';
      }
    });
  }

  private configureAccountRegisterValidators(role: 'client' | 'admin' = this.mode === 'admin-register' ? 'admin' : 'client'): void {
    const phone = this.accountRegisterForm.get('phone');
    const city = this.accountRegisterForm.get('city');
    const dataAuth = this.accountRegisterForm.get('data_auth');
    const adminCode = this.accountRegisterForm.get('admin_registration_code');

    if (role === 'client') {
      phone?.clearValidators();
      city?.clearValidators();
      dataAuth?.clearValidators();
      adminCode?.clearValidators();
    } else {
      phone?.clearValidators();
      city?.clearValidators();
      dataAuth?.clearValidators();
      adminCode?.setValidators(Validators.required);
    }

    [phone, city, dataAuth, adminCode].forEach((control) => control?.updateValueAndValidity({ emitEvent: false }));
  }

  private getAccountRegisterError(role: 'client' | 'admin'): string {
    const email = this.accountRegisterForm.get('email');
    const password = this.accountRegisterForm.get('password');
    const confirmPassword = this.accountRegisterForm.get('confirm_password');

    if (email?.hasError('email')) {
      return 'Ingresa un correo electrónico válido.';
    }
    if (password?.hasError('pattern') || confirmPassword?.hasError('pattern')) {
      return 'La contraseña debe tener mínimo 8 caracteres, mayúscula, minúscula, número y símbolo.';
    }
    if (role === 'admin' && this.accountRegisterForm.get('admin_registration_code')?.invalid) {
      return 'Ingresa el código interno para crear una cuenta administrativa.';
    }
    return 'Completa todos los campos obligatorios para crear tu cuenta.';
  }

  recoverPassword(): void {
    this.error = '';
    this.message = '';
    if (this.recoveryForm.invalid) {
      this.recoveryForm.markAllAsTouched();
      return;
    }
    this.loading = true;
    this.http.post<any>(this.apiUrl('/api/auth/recovery/request'), this.recoveryForm.value).subscribe({
      next: (response) => {
        this.loading = false;
        this.message = response.message || 'Te enviamos instrucciones para recuperar el acceso.';
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error || 'No fue posible procesar la solicitud.';
      }
    });
  }

  resetPassword(): void {
    this.error = '';
    this.message = '';
    if (this.resetPasswordForm.invalid) {
      this.resetPasswordForm.markAllAsTouched();
      this.error = this.getResetPasswordError();
      return;
    }
    if (this.resetPasswordForm.value.password !== this.resetPasswordForm.value.confirm_password) {
      this.error = 'Las contraseñas no coinciden.';
      return;
    }
    if (!this.strongPasswordPattern.test(this.resetPasswordForm.value.password || '')) {
      this.error = 'La contraseña debe tener mínimo 8 caracteres, mayúscula, minúscula, número y símbolo.';
      return;
    }

    this.loading = true;
    this.http.post<any>(this.apiUrl('/api/auth/recovery/reset'), {
      codigo: this.resetPasswordForm.value.codigo,
      password: this.resetPasswordForm.value.password
    }).subscribe({
      next: (response) => {
        this.loading = false;
        if (response?.token && response?.user) {
          localStorage.setItem('orjuelaToken', response.token);
          localStorage.setItem('orjuelaUser', JSON.stringify(response.user));
          this.currentUser = response.user;
          this.resetPasswordForm.reset();
          this.go(this.dashboardPathForRole(response.user.role));
          return;
        }
        this.message = response.message || 'Contraseña actualizada correctamente.';
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error || 'No fue posible actualizar la contraseña.';
      }
    });
  }

  private getResetPasswordError(): string {
    if (this.resetPasswordForm.get('codigo')?.invalid) return 'Ingresa el código recibido por correo.';
    if (this.resetPasswordForm.get('password')?.hasError('pattern') || this.resetPasswordForm.get('confirm_password')?.hasError('pattern')) {
      return 'La contraseña debe tener mínimo 8 caracteres, mayúscula, minúscula, número y símbolo.';
    }
    return 'Completa todos los campos para crear una nueva contraseña.';
  }

  nextRegisterStep(): void {
    const controls: Record<number, string[]> = {
      1: ['full_name', 'email'],
      2: ['password', 'confirm_password'],
      3: ['terms', 'data_auth']
    };
    const names = controls[this.registerStep];
    names.forEach((name) => this.partnerRegisterForm.get(name)?.markAsTouched());
    if (names.every((name) => this.partnerRegisterForm.get(name)?.valid)) {
      this.registerStep = Math.min(3, this.registerStep + 1);
    }
  }

  previousRegisterStep(): void {
    this.registerStep = Math.max(1, this.registerStep - 1);
  }

  setAdminSection(section: string): void {
    this.adminSection = section;
    if (section === 'partner-network') this.loadAdminNetwork();
    this.loadAdminSectionData(section);
  }

  setPartnerSection(section: string): void {
    this.partnerSection = section;
    if (['crm', 'activity', 'level', 'goals', 'notifications', 'ally-profile', 'finance', 'tree', 'academy'].includes(section)) {
      this.loadPartnerAdvanced();
    }
    this.formError = '';
    this.formMessage = '';
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

  get partnerReferralStatuses(): string[] {
    const rows = [...(this.partnerNetwork.direct_referrals || []), ...(this.partnerAdvanced.crm_referrals || [])];
    return ['Todos', ...Array.from(new Set(rows.map((item: any) => item.status || item.current_status).filter(Boolean)))];
  }

  get filteredPartnerDirectReferrals(): any[] {
    const term = this.partnerReferralSearch.toLowerCase().trim();
    return (this.partnerNetwork.direct_referrals || []).filter((item: any) => {
      const status = item.status || '';
      const matchesStatus = this.partnerReferralStatus === 'Todos' || status === this.partnerReferralStatus;
      const matchesTerm = !term || [item.masked_name, item.legal_area, item.status].some((value) => String(value || '').toLowerCase().includes(term));
      return matchesStatus && matchesTerm;
    });
  }

  get filteredPartnerCrmReferrals(): any[] {
    const term = this.partnerReferralSearch.toLowerCase().trim();
    return (this.partnerAdvanced.crm_referrals || []).filter((item: any) => {
      const status = item.current_status || '';
      const matchesStatus = this.partnerReferralStatus === 'Todos' || status === this.partnerReferralStatus;
      const matchesTerm = !term || [item.masked_name, item.case_type, item.current_status, item.public_note].some((value) => String(value || '').toLowerCase().includes(term));
      return matchesStatus && matchesTerm;
    });
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

  openPartnerReferralDetail(referral: any): void {
    this.selectedPartnerReferral = referral;
  }

  openPartnerTeamDetail(ally: any): void {
    this.selectedPartnerTeamAlly = ally;
  }

  closePartnerTeamDetail(): void {
    this.selectedPartnerTeamAlly = null;
  }

  get selectedPartnerTeamReferrals(): any[] {
    const ally = this.selectedPartnerTeamAlly;
    if (!ally) return [];
    return (this.partnerNetwork.network_referrals || []).filter((item: any) =>
      item.source_ally_id === ally.user_id || item.source_ally_name === ally.full_name
    );
  }

  openAcademyModule(module: any): void {
    this.selectedAcademyModule = module;
  }

  get unreadNotifications(): number {
    return (this.partnerAdvanced.notifications || []).filter((item: any) => !item.is_read).length;
  }

  get selectedClientCase(): ClientPortalCase {
    return this.clientPortalCases.find((item) => item.id === this.selectedClientCaseId) || this.clientPortalCases[0];
  }

  get filteredClientPortalCases(): ClientPortalCase[] {
    const term = this.clientCaseSearch.toLowerCase().trim();
    return this.clientPortalCases.filter((item) => {
      const matchesStatus = this.clientCaseStatus === 'Todos los estados' || item.status === this.clientCaseStatus;
      const matchesTerm = !term || [item.title, item.type, item.status, item.lawyer, item.nextAction]
        .some((value) => String(value || '').toLowerCase().includes(term));
      return matchesStatus && matchesTerm;
    });
  }

  get filteredClientPayments(): ClientPayment[] {
    return this.clientPayments.filter((item) => {
      if (this.clientPaymentStatus === 'Todos') return true;
      if (this.clientPaymentStatus === 'Pendiente') return item.status !== 'Pagado';
      return item.status === this.clientPaymentStatus;
    });
  }

  get filteredAdminLeads(): AdminLead[] {
    const term = this.adminLeadSearch.toLowerCase().trim();
    return this.adminLeads.filter((item) => {
      const matchesStatus = this.adminLeadStatus === 'Todos los estados' || item.status === this.adminLeadStatus;
      const matchesSource = this.adminLeadSource === 'Todas las fuentes' || item.source === this.adminLeadSource;
      const matchesTerm = !term || [item.name, item.phone, item.email, item.caseType, item.owner, item.priority]
        .some((value) => String(value || '').toLowerCase().includes(term));
      return matchesStatus && matchesSource && matchesTerm;
    });
  }

  get filteredAdminCases(): any[] {
    const term = this.adminCaseSearch.toLowerCase().trim();
    return this.adminCases.filter((item) => {
      const matchesStatus = this.adminCaseStatus === 'Todos los estados' || item.status === this.adminCaseStatus;
      const matchesTerm = !term || [item.client_name, item.client_email, item.case_type, item.assigned_lawyer, item.next_action]
        .some((value) => String(value || '').toLowerCase().includes(term));
      return matchesStatus && matchesTerm;
    });
  }

  get filteredAdminPayments(): any[] {
    const term = this.adminPaymentSearch.toLowerCase().trim();
    return this.adminPayments.filter((item) => {
      const matchesStatus = this.adminPaymentStatus === 'Todos los estados' || item.status === this.adminPaymentStatus;
      const related = `${item.related_type || ''} #${item.related_id || ''}`;
      const matchesTerm = !term || [related, item.concept, item.payment_method, item.amount, item.payment_date, item.support_url]
        .some((value) => String(value || '').toLowerCase().includes(term));
      return matchesStatus && matchesTerm;
    });
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

  get maskedClientDocument(): string {
    const documentId = String(this.clientProfile.document_id || '');
    if (this.showClientDocument || documentId.length <= 4) return documentId || 'Pendiente';
    return `${'*'.repeat(Math.max(documentId.length - 4, 0))}${documentId.slice(-4)}`;
  }

  get clientProfileUpdatedAt(): string {
    return this.clientProfile.updated_at || this.clientProfile.created_at || 'Pendiente';
  }

  get clientProfileCompletion(): number {
    const fields = ['full_name', 'document_id', 'email', 'phone', 'city', 'address'];
    const completed = fields.filter((field) => Boolean((this.clientProfile as any)[field])).length;
    return Math.round((completed / fields.length) * 100);
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
    this.http.post<any>(this.apiUrl('/api/partner/network/referrals'), this.networkReferralForm.value, { headers: this.authHeaders() }).subscribe({
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
    this.http.post<any>(this.apiUrl('/api/partner/network/invitations'), this.invitationForm.value, { headers: this.authHeaders() }).subscribe({
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

  startAllyProfileEdit(): void {
    const profile = this.partnerAdvanced.profile || {};
    this.allyProfileForm.patchValue({
      phone: profile.phone || '',
      city: profile.city || '',
      partner_type: profile.partner_type || 'Independiente',
      company: profile.company || '',
      occupation: profile.occupation || '',
      bank_name: profile.bank_name && !String(profile.bank_name).includes('protegido') ? profile.bank_name : '',
      account_type: profile.account_type && !String(profile.account_type).includes('protegido') ? profile.account_type : '',
      account_number: ''
    });
    this.showAllyProfileForm = true;
  }

  saveAllyProfile(): void {
    this.formError = '';
    this.formMessage = '';
    if (this.allyProfileForm.invalid) {
      this.allyProfileForm.markAllAsTouched();
      this.formError = 'Completa teléfono, ciudad y tipo de aliado.';
      return;
    }
    this.http.patch<any>(this.apiUrl('/api/partner/profile'), this.allyProfileForm.value, { headers: this.authHeaders() }).subscribe({
      next: () => {
        this.formMessage = 'Perfil actualizado. Los datos de pago quedan sujetos a validación administrativa.';
        this.showAllyProfileForm = false;
        this.loadPartnerAdvanced();
        this.loadPartnerNetwork();
      },
      error: (err) => this.formError = err?.error?.error || 'No fue posible actualizar el perfil.'
    });
  }

  acceptPartnerLegalDocument(documentType: string): void {
    this.http.post<any>(this.apiUrl('/api/partner/legal-acceptances'), { document_type: documentType, version: 'v1.0' }, { headers: this.authHeaders() }).subscribe({
      next: () => {
        this.formMessage = 'Documento aceptado correctamente.';
        this.loadPartnerAdvanced();
      },
      error: (err) => this.formError = err?.error?.error || 'No fue posible registrar la aceptación.'
    });
  }

  completeAcademyModule(module: any): void {
    this.http.post<any>(this.apiUrl(`/api/partner/academy/${module.id}/complete`), {}, { headers: this.authHeaders() }).subscribe({
      next: () => {
        this.formMessage = 'Módulo marcado como completado.';
        this.selectedAcademyModule = null;
        this.loadPartnerAdvanced();
      },
      error: (err) => this.formError = err?.error?.error || 'No fue posible actualizar el módulo.'
    });
  }

  loadPartnerNetwork(): void {
    const token = this.getToken();
    if (!token) return;
    this.http.get<PartnerNetwork>(this.apiUrl('/api/partner/network'), { headers: this.authHeaders() }).subscribe({
      next: (response) => {
        this.partnerNetwork = this.applyDemoPartnerDataIfNeeded(response);
        if (!this.partnerAdvanced?.profile) this.loadPartnerAdvanced();
      },
      error: () => {
        if (this.environment.enableDemoData) this.partnerNetwork = this.demoPartnerNetwork();
      }
    });
  }

  loadPartnerAdvanced(): void {
    const token = this.getToken();
    if (!token) return;
    this.http.get<any>(this.apiUrl('/api/partner/advanced'), { headers: this.authHeaders() }).subscribe({
      next: (response) => this.partnerAdvanced = response,
      error: () => {
        if (this.environment.enableDemoData) this.partnerAdvanced = this.demoPartnerAdvanced();
      }
    });
  }

  loadAdminNetwork(): void {
    const token = this.getToken();
    if (!token) return;
    this.http.get<any>(this.apiUrl('/api/admin/partner-network'), { headers: this.authHeaders() }).subscribe({
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
    this.http.patch<any>(this.apiUrl(`/api/admin/network-referrals/${id}/status`), { status }, { headers: this.authHeaders() }).subscribe({
      next: (response) => {
        this.formMessage = response?.message || 'Estado actualizado correctamente.';
        if (status === 'Cliente vinculado' && response?.whatsapp_url) {
          window.open(response.whatsapp_url, '_blank', 'noopener');
        }
        this.loadAdminNetwork();
      },
      error: (err) => {
        this.formError = err?.error?.error || 'No fue posible actualizar el estado del referido.';
      }
    });
  }

  updateCommissionStatus(id: number, status: string, amount?: string): void {
    this.http.patch(this.apiUrl(`/api/admin/commissions/${id}/status`), { status, amount: amount ? Number(amount) : undefined }, { headers: this.authHeaders() }).subscribe({
      next: () => this.loadAdminNetwork()
    });
  }

  saveCommissionSettings(): void {
    if (this.commissionSettingsForm.invalid) return;
    this.http.patch(this.apiUrl('/api/admin/commission-settings'), this.commissionSettingsForm.value, { headers: this.authHeaders() }).subscribe({
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
    this.http.post(this.apiUrl(`/api/partner/notifications/${id}/read`), {}, { headers: this.authHeaders() }).subscribe({
      next: () => this.loadPartnerAdvanced()
    });
  }

  markAllNotificationsRead(): void {
    this.http.post(this.apiUrl('/api/partner/notifications/read-all'), {}, { headers: this.authHeaders() }).subscribe({
      next: () => this.loadPartnerAdvanced()
    });
  }

  async submitClientDocument(): Promise<void> {
    this.clientFormError = '';
    this.clientFormMessage = '';
    if (this.clientDocumentForm.invalid) {
      this.clientDocumentForm.markAllAsTouched();
      this.clientFormError = 'Completa los datos del documento. Tamaño máximo: 10 MB.';
      return;
    }
    if (!this.clientDocumentFile) {
      this.clientFormError = 'Selecciona el archivo que quieres subir.';
      return;
    }
    const fileName = this.clientDocumentForm.value.fileName || this.clientDocumentFile.name;
    const fileType = String(this.clientDocumentForm.value.fileType || '').toLowerCase();
    if (!['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'].includes(fileType)) {
      this.clientFormError = 'Formato no permitido. Usa PDF, DOC, DOCX, JPG o PNG.';
      return;
    }
    const legalCase = this.clientPortalCases.find((item) => item.title === this.clientDocumentForm.value.caseTitle) || this.clientPortalCases[0];
    try {
      this.loading = true;
      const uploaded = await this.uploadClientFile(this.clientDocumentFile, 'documents');
      await firstValueFrom(this.http.post<any>(this.apiUrl('/api/client/documents'), {
        case_id: legalCase?.id,
        file_name: fileName,
        file_url: uploaded.file_url,
        document_type: fileType,
        observations: this.clientDocumentForm.value.observations || 'Pendiente de revisión por el abogado.'
      }, { headers: this.authHeaders() }));
      this.loading = false;
      this.clientFormMessage = 'Documento registrado correctamente. Quedó pendiente de revisión.';
      this.clientDocumentFile = null;
      this.clientDocumentForm.patchValue({ fileName: '', fileType: '', fileSizeMb: 1, observations: '' });
      this.loadClientPortal();
    } catch (err: any) {
      this.loading = false;
      this.clientFormError = err?.error?.error || 'No fue posible registrar el documento.';
    }
  }

  submitClientAppointment(): void {
    this.clientFormError = '';
    this.clientFormMessage = '';
    if (this.clientAppointmentForm.invalid) {
      this.clientAppointmentForm.markAllAsTouched();
      this.clientFormError = 'Completa la información para solicitar la cita.';
      return;
    }
    if (this.reschedulingAppointmentId) {
      this.loading = true;
      this.http.patch<any>(this.apiUrl(`/api/client/appointments/${this.reschedulingAppointmentId}/reschedule`), {
        scheduled_at: this.clientAppointmentForm.value.requestedDate,
        notes: this.clientAppointmentForm.value.reason
      }, { headers: this.authHeaders() }).subscribe({
        next: () => {
          this.loading = false;
          this.clientFormMessage = 'Reprogramación solicitada. El equipo confirmará disponibilidad.';
          this.cancelClientAppointmentReschedule();
          this.loadClientPortal();
        },
        error: (err) => {
          this.loading = false;
          this.clientFormError = err?.error?.error || 'No fue posible reprogramar la cita.';
        }
      });
      return;
    }
    const legalCase = this.clientPortalCases.find((item) => item.title === this.clientAppointmentForm.value.caseTitle) || this.clientPortalCases[0];
    this.loading = true;
    this.http.post<any>(this.apiUrl('/api/client/appointments'), {
      case_id: legalCase?.id,
      title: this.clientAppointmentForm.value.reason,
      scheduled_at: this.clientAppointmentForm.value.requestedDate,
      notes: this.clientAppointmentForm.value.type
    }, { headers: this.authHeaders() }).subscribe({
      next: () => {
        this.loading = false;
        this.clientFormMessage = 'Solicitud de cita enviada. El equipo confirmará disponibilidad.';
        this.clientAppointmentForm.patchValue({ requestedDate: '', reason: '' });
        this.loadClientPortal();
      },
      error: (err) => {
        this.loading = false;
        this.clientFormError = err?.error?.error || 'No fue posible solicitar la cita.';
      }
    });
  }

  startClientAppointmentReschedule(appointment: ClientAppointment): void {
    if (!appointment.id) {
      this.clientFormError = 'No encontramos el identificador de esta cita.';
      return;
    }
    this.reschedulingAppointmentId = appointment.id;
    this.clientFormError = '';
    this.clientFormMessage = '';
    this.clientAppointmentForm.patchValue({
      caseTitle: appointment.caseTitle,
      type: appointment.type === 'Agenda' ? 'Virtual' : appointment.type,
      requestedDate: this.toDateTimeLocalValue(appointment.date),
      reason: `Reprogramar: ${appointment.title}`
    });
  }

  cancelClientAppointmentReschedule(): void {
    this.reschedulingAppointmentId = null;
    this.clientAppointmentForm.patchValue({ requestedDate: '', reason: '', type: 'Virtual' });
  }

  cancelClientAppointment(appointment: ClientAppointment): void {
    if (!appointment.id) {
      this.clientFormError = 'No encontramos el identificador de esta cita.';
      return;
    }
    const reason = window.prompt('Motivo de cancelación', 'No podré asistir a la cita.');
    if (reason === null) return;
    this.loading = true;
    this.http.post<any>(this.apiUrl(`/api/client/appointments/${appointment.id}/cancel`), { reason }, { headers: this.authHeaders() }).subscribe({
      next: () => {
        this.loading = false;
        this.clientFormMessage = 'Cita cancelada correctamente.';
        this.loadClientPortal();
      },
      error: (err) => {
        this.loading = false;
        this.clientFormError = err?.error?.error || 'No fue posible cancelar la cita.';
      }
    });
  }

  downloadClientPaymentSupport(payment: ClientPayment): void {
    this.clientFormError = '';
    const support = payment.supportUrl || '';
    if (!support || support === '#' || support === 'Pendiente de soporte') {
      this.clientFormError = 'Este pago aún no tiene comprobante descargable.';
      return;
    }
    if (!/^https?:\/\//i.test(support)) {
      this.clientFormError = 'El soporte registrado no es un enlace descargable.';
      return;
    }
    window.open(support, '_blank', 'noopener');
  }

  openClientFile(url?: string): void {
    this.clientFormError = '';
    if (!url || url === '#') {
      this.clientFormError = 'Este archivo aún no tiene enlace descargable.';
      return;
    }
    const target = /^https?:\/\//i.test(url) ? url : this.apiUrl(url);
    window.open(target, '_blank', 'noopener');
  }

  isClientFileLink(value?: string): boolean {
    return Boolean(value && (/^https?:\/\//i.test(value) || value.startsWith('/uploads/')));
  }

  startClientPaymentSupport(payment: ClientPayment): void {
    if (!payment.id) {
      this.clientFormError = 'No encontramos el identificador de este pago.';
      return;
    }
    this.selectedClientPaymentId = payment.id;
    this.clientPaymentSupportForm.reset({
      support_url: payment.supportUrl && /^https?:\/\//i.test(payment.supportUrl) ? payment.supportUrl : '',
      payment_method: payment.paymentMethod || 'Nequi 3118924111',
      payment_date: ''
    });
    this.clientFormError = '';
    this.clientFormMessage = '';
  }

  cancelClientPaymentSupport(): void {
    this.selectedClientPaymentId = null;
    this.clientPaymentSupportForm.reset({ support_url: '', payment_method: 'Nequi 3118924111', payment_date: '' });
  }

  submitClientPaymentSupport(): void {
    this.clientFormError = '';
    this.clientFormMessage = '';
    if (!this.selectedClientPaymentId) {
      this.clientFormError = 'Selecciona un pago para registrar soporte.';
      return;
    }
    if (this.clientPaymentSupportForm.invalid) {
      this.clientPaymentSupportForm.markAllAsTouched();
      this.clientFormError = 'Registra el enlace o referencia del comprobante.';
      return;
    }
    this.loading = true;
    this.http.post<any>(this.apiUrl(`/api/client/payments/${this.selectedClientPaymentId}/support`), this.clientPaymentSupportForm.value, { headers: this.authHeaders() }).subscribe({
      next: () => {
        this.loading = false;
        this.clientFormMessage = 'Soporte de pago registrado. Quedó pendiente de validación.';
        this.cancelClientPaymentSupport();
        this.loadClientPortal();
      },
      error: (err) => {
        this.loading = false;
        this.clientFormError = err?.error?.error || 'No fue posible registrar el soporte.';
      }
    });
  }

  onClientDocumentFileChange(event: Event): void {
    this.clientFormError = '';
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      this.clientDocumentFile = null;
      return;
    }
    if (!this.validateClientUploadFile(file, input, 'El documento no puede superar 10 MB.')) return;
    this.clientDocumentFile = file;
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    this.clientDocumentForm.patchValue({
      fileName: file.name,
      fileType: extension === 'jpeg' ? 'jpg' : extension,
      fileSizeMb: Math.max(1, Math.ceil((file.size / (1024 * 1024)) * 10) / 10)
    });
  }

  async submitClientMessage(): Promise<void> {
    this.clientFormError = '';
    this.clientFormMessage = '';
    if (this.clientMessageForm.invalid) {
      this.clientMessageForm.markAllAsTouched();
      this.clientFormError = 'Escribe un mensaje claro para el abogado asignado.';
      return;
    }
    const legalCase = this.clientPortalCases.find((item) => item.title === this.clientMessageForm.value.caseTitle) || this.clientPortalCases[0];
    if (!legalCase?.id) {
      this.clientFormError = 'Selecciona un caso válido para enviar el mensaje.';
      return;
    }
    try {
      this.loading = true;
      const uploaded = this.clientMessageFile ? await this.uploadClientFile(this.clientMessageFile, 'messages') : null;
      await firstValueFrom(this.http.post<any>(this.apiUrl('/api/client/messages'), {
        case_id: legalCase.id,
        message: this.clientMessageForm.value.message,
        attachment_name: uploaded?.file_name || this.clientMessageForm.value.attachment || '',
        attachment_url: uploaded?.file_url || ''
      }, { headers: this.authHeaders() }));
      this.loading = false;
      this.clientFormMessage = 'Mensaje enviado a la firma.';
      this.clientMessageAttachmentName = '';
      this.clientMessageFile = null;
      this.clientMessageForm.patchValue({ message: '', attachment: '' });
      this.loadClientPortal();
    } catch (err: any) {
      this.loading = false;
      this.clientFormError = err?.error?.error || 'No fue posible enviar el mensaje.';
    }
  }

  onClientMessageAttachmentChange(event: Event): void {
    this.clientFormError = '';
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      this.clientMessageAttachmentName = '';
      this.clientMessageFile = null;
      this.clientMessageForm.patchValue({ attachment: '' });
      return;
    }
    if (!this.validateClientUploadFile(file, input, 'El archivo adjunto no puede superar 10 MB.')) return;

    this.clientMessageAttachmentName = file.name;
    this.clientMessageFile = file;
    this.clientMessageForm.patchValue({ attachment: file.name });
  }

  onClientServiceDocumentChange(event: Event): void {
    this.clientFormError = '';
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      this.clientServiceAttachmentName = '';
      this.clientServiceFile = null;
      this.clientServiceForm.patchValue({ documents: '' });
      return;
    }
    if (!this.validateClientUploadFile(file, input, 'El documento inicial no puede superar 10 MB.')) return;

    this.clientServiceAttachmentName = file.name;
    this.clientServiceFile = file;
    this.clientServiceForm.patchValue({ documents: file.name });
  }

  async submitClientServiceRequest(): Promise<void> {
    this.clientFormError = '';
    this.clientFormMessage = '';
    if (this.clientServiceForm.invalid) {
      this.clientServiceForm.markAllAsTouched();
      this.clientFormError = 'Completa los campos obligatorios para solicitar el servicio.';
      return;
    }
    try {
      this.loading = true;
      const uploaded = this.clientServiceFile ? await this.uploadClientFile(this.clientServiceFile, 'service-requests') : null;
      await firstValueFrom(this.http.post<any>(this.apiUrl('/api/client/service-requests'), {
        ...this.clientServiceForm.value,
        documents: uploaded?.file_url || this.clientServiceForm.value.documents || ''
      }, { headers: this.authHeaders() }));
      this.loading = false;
      this.clientFormMessage = 'Solicitud enviada. El equipo la revisará desde el panel administrativo.';
      this.clientServiceAttachmentName = '';
      this.clientServiceFile = null;
      this.clientServiceForm.reset({ urgency: 'Media', email: this.clientProfile.email, phone: this.clientProfile.phone, city: this.clientProfile.city });
      this.loadClientPortal();
      this.loadClientProfile();
    } catch (err: any) {
      this.loading = false;
      this.clientFormError = err?.error?.error || 'No fue posible enviar la solicitud.';
    }
  }

  loadAdminDashboard(): void {
    const token = this.getToken();
    if (!token) return;
    this.http.get<any>(this.apiUrl('/api/admin/dashboard'), { headers: this.authHeaders() }).subscribe({
      next: (response) => {
        this.adminDashboard = response;
        this.adminMetrics = response.metrics || this.adminMetrics;
        this.adminLeads = (response.recentLeads || []).map((item: any) => this.mapAdminLead(item));
        this.selectedLead = this.adminLeads[0] || this.selectedLead;
      }
    });
  }

  loadAdminSectionData(section = this.adminSection): void {
    const token = this.getToken();
    if (!token) return;
    if (section === 'leads') this.loadAdminLeads();
    if (section === 'clients') this.http.get<any[]>(this.apiUrl('/api/admin/clients'), { headers: this.authHeaders() }).subscribe({ next: (rows) => this.adminClients = rows });
    if (section === 'cases') this.http.get<any[]>(this.apiUrl('/api/admin/cases'), { headers: this.authHeaders() }).subscribe({ next: (rows) => this.adminCases = rows });
    if (section === 'payments') this.http.get<any[]>(this.apiUrl('/api/admin/payments'), { headers: this.authHeaders() }).subscribe({ next: (rows) => this.adminPayments = rows });
    if (section === 'agenda') this.http.get<any[]>(this.apiUrl('/api/admin/agenda'), { headers: this.authHeaders() }).subscribe({ next: (rows) => this.adminAgenda = rows });
    if (section === 'documents') this.http.get<any[]>(this.apiUrl('/api/admin/documents'), { headers: this.authHeaders() }).subscribe({ next: (rows) => this.adminDocuments = rows });
    if (section === 'reports') this.http.get<any>(this.apiUrl('/api/admin/reports'), { headers: this.authHeaders() }).subscribe({ next: (report) => this.adminReports = report });
    if (section === 'notifications') this.loadAdminNotifications();
  }

  loadAdminNotifications(): void {
    this.http.get<any[]>(this.apiUrl('/api/admin/notifications'), { headers: this.authHeaders() }).subscribe({
      next: (rows) => this.adminNotifications = rows || []
    });
  }

  markAdminNotificationRead(id: number): void {
    this.http.post(this.apiUrl(`/api/admin/notifications/${id}/read`), {}, { headers: this.authHeaders() }).subscribe({
      next: () => this.loadAdminNotifications()
    });
  }

  markAdminNotificationsRead(): void {
    this.http.post(this.apiUrl('/api/admin/notifications/read-all'), {}, { headers: this.authHeaders() }).subscribe({
      next: () => this.loadAdminNotifications()
    });
  }

  loadAdminLeads(): void {
    this.http.get<any[]>(this.apiUrl('/api/admin/leads'), { headers: this.authHeaders() }).subscribe({
      next: (rows) => {
        this.adminLeads = rows.map((item) => this.mapAdminLead(item));
        this.selectedLead = this.adminLeads[0] || this.selectedLead;
        this.leadMetrics = [
          { label: 'Leads nuevos', value: String(this.adminLeads.filter((item) => item.status === 'Nuevo').length) },
          { label: 'Contactados', value: String(this.adminLeads.filter((item) => item.status === 'Contactado').length) },
          { label: 'Agendados', value: String(this.adminLeads.filter((item) => item.status === 'Agendado').length) },
          { label: 'Propuestas enviadas', value: String(this.adminLeads.filter((item) => item.status === 'Propuesta enviada').length) }
        ];
      }
    });
  }

  createAdminLead(): void {
    this.formError = '';
    this.formMessage = '';
    if (this.adminLeadForm.invalid) {
      this.adminLeadForm.markAllAsTouched();
      this.formError = 'Completa los datos obligatorios del lead.';
      return;
    }
    this.http.post<any>(this.apiUrl('/api/admin/leads'), this.adminLeadForm.value, { headers: this.authHeaders() }).subscribe({
      next: () => {
        this.formMessage = 'Lead creado correctamente.';
        this.showAdminLeadForm = false;
        this.adminLeadForm.reset({ source: 'Web', assigned_to: 'Comercial', priority: 'Media', next_action: 'Contactar al lead' });
        this.loadAdminLeads();
        this.loadAdminDashboard();
      },
      error: (err) => this.formError = err?.error?.error || 'No fue posible crear el lead.'
    });
  }

  updateLeadStatus(status: string): void {
    if (!(this.selectedLead as any)?.id) return;
    this.http.patch<any>(this.apiUrl(`/api/admin/leads/${(this.selectedLead as any).id}`), { status }, { headers: this.authHeaders() }).subscribe({
      next: () => {
        this.formMessage = 'Lead actualizado.';
        this.loadAdminLeads();
        this.loadAdminDashboard();
      },
      error: (err) => this.formError = err?.error?.error || 'No fue posible actualizar el lead.'
    });
  }

  convertSelectedLeadToCase(): void {
    if (!(this.selectedLead as any)?.id) return;
    this.http.post<any>(this.apiUrl(`/api/admin/leads/${(this.selectedLead as any).id}/convert`), {}, { headers: this.authHeaders() }).subscribe({
      next: () => {
        this.formMessage = 'Lead convertido en cliente y caso.';
        this.setAdminSection('cases');
        this.loadAdminDashboard();
      },
      error: (err) => this.formError = err?.error?.error || 'No fue posible convertir el lead.'
    });
  }

  createAdminCase(): void {
    this.formError = '';
    this.formMessage = '';
    if (this.adminCaseForm.invalid) {
      this.adminCaseForm.markAllAsTouched();
      this.formError = 'Completa los datos obligatorios del caso.';
      return;
    }
    this.http.post<any>(this.apiUrl('/api/admin/cases'), this.adminCaseForm.value, { headers: this.authHeaders() }).subscribe({
      next: () => {
        this.formMessage = 'Caso creado correctamente.';
        this.adminCaseForm.reset({ status: 'Recibido', assigned_lawyer: 'Equipo Orjuela', next_action: 'Revisar documentación inicial' });
        this.loadAdminSectionData('cases');
        this.loadAdminDashboard();
      },
      error: (err) => this.formError = err?.error?.error || 'No fue posible crear el caso.'
    });
  }

  updateAdminCaseStatus(id: number, status: string): void {
    this.http.patch(this.apiUrl(`/api/admin/cases/${id}`), { status }, { headers: this.authHeaders() }).subscribe({
      next: () => this.loadAdminSectionData('cases')
    });
  }

  saveAdminClient(): void {
    if (this.adminClientForm.invalid) return this.adminClientForm.markAllAsTouched();
    const request = this.editingAdminClientId
      ? this.http.patch(this.apiUrl(`/api/admin/clients/${this.editingAdminClientId}`), this.adminClientForm.value, { headers: this.authHeaders() })
      : this.http.post(this.apiUrl('/api/admin/clients'), this.adminClientForm.value, { headers: this.authHeaders() });
    request.subscribe({
      next: () => {
        this.formMessage = this.editingAdminClientId ? 'Cliente actualizado.' : 'Cliente creado.';
        this.editingAdminClientId = null;
        this.showAdminClientForm = false;
        this.adminClientForm.reset({ status: 'Activo', verified: false });
        this.loadAdminSectionData('clients');
        this.loadAdminDashboard();
      },
      error: (err) => this.formError = err?.error?.error || 'No fue posible guardar el cliente.'
    });
  }

  editAdminClient(client: any): void {
    this.editingAdminClientId = client.id;
    this.showAdminClientForm = true;
    this.adminClientForm.patchValue({ ...client, verified: Boolean(client.verified) });
  }

  archiveAdminClient(id: number): void {
    this.http.delete(this.apiUrl(`/api/admin/clients/${id}`), { headers: this.authHeaders() }).subscribe({
      next: () => {
        this.formMessage = 'Cliente archivado.';
        this.loadAdminSectionData('clients');
        this.loadAdminDashboard();
      },
      error: (err) => this.formError = err?.error?.error || 'No fue posible archivar el cliente.'
    });
  }

  editAdminCase(item: any): void {
    this.editingAdminCaseId = item.id;
    this.adminCaseForm.patchValue({
      client_name: item.client_name,
      client_phone: item.client_phone,
      client_email: item.client_email,
      case_type: item.case_type,
      description: item.description,
      status: item.status,
      assigned_lawyer: item.assigned_lawyer,
      next_action: item.next_action
    });
  }

  saveAdminCase(): void {
    if (this.editingAdminCaseId) {
      this.http.patch(this.apiUrl(`/api/admin/cases/${this.editingAdminCaseId}`), this.adminCaseForm.value, { headers: this.authHeaders() }).subscribe({
        next: () => {
          this.formMessage = 'Caso actualizado.';
          this.editingAdminCaseId = null;
          this.adminCaseForm.reset({ status: 'Recibido', assigned_lawyer: 'Equipo Orjuela', next_action: 'Revisar documentación inicial' });
          this.loadAdminSectionData('cases');
          this.loadAdminDashboard();
        },
        error: (err) => this.formError = err?.error?.error || 'No fue posible actualizar el caso.'
      });
      return;
    }
    this.createAdminCase();
  }

  archiveAdminCase(id: number): void {
    this.http.delete(this.apiUrl(`/api/admin/cases/${id}`), { headers: this.authHeaders() }).subscribe({
      next: () => {
        this.formMessage = 'Caso archivado.';
        this.loadAdminSectionData('cases');
        this.loadAdminDashboard();
      },
      error: (err) => this.formError = err?.error?.error || 'No fue posible archivar el caso.'
    });
  }

  saveAdminAlly(): void {
    if (this.adminAllyForm.invalid) return this.adminAllyForm.markAllAsTouched();
    const endpoint = this.editingAdminAllyId ? `/api/admin/partner-network/allies/${this.editingAdminAllyId}` : '/api/admin/partner-network/allies';
    const request = this.editingAdminAllyId
      ? this.http.patch(this.apiUrl(endpoint), this.adminAllyForm.value, { headers: this.authHeaders() })
      : this.http.post(this.apiUrl(endpoint), this.adminAllyForm.value, { headers: this.authHeaders() });
    request.subscribe({
      next: () => {
        this.formMessage = this.editingAdminAllyId ? 'Aliado actualizado.' : 'Aliado creado.';
        this.editingAdminAllyId = null;
        this.showAdminAllyForm = false;
        this.adminAllyForm.reset({ partner_type: 'Independiente', status: 'active' });
        this.loadAdminNetwork();
      },
      error: (err) => this.formError = err?.error?.error || 'No fue posible guardar el aliado.'
    });
  }

  editAdminAlly(ally: any): void {
    this.editingAdminAllyId = ally.user_id;
    this.showAdminAllyForm = true;
    this.adminAllyForm.patchValue({ ...ally, full_name: ally.full_name, partner_type: ally.partner_type || 'Independiente' });
  }

  archiveAdminAlly(id: number): void {
    this.http.delete(this.apiUrl(`/api/admin/partner-network/allies/${id}`), { headers: this.authHeaders() }).subscribe({
      next: () => {
        this.formMessage = 'Aliado archivado.';
        this.loadAdminNetwork();
      },
      error: (err) => this.formError = err?.error?.error || 'No fue posible archivar el aliado.'
    });
  }

  saveAdminLevel(): void {
    if (this.adminLevelForm.invalid) return this.adminLevelForm.markAllAsTouched();
    const endpoint = this.editingAdminLevelId ? `/api/admin/partner-network/levels/${this.editingAdminLevelId}` : '/api/admin/partner-network/levels';
    const request = this.editingAdminLevelId
      ? this.http.patch(this.apiUrl(endpoint), this.adminLevelForm.value, { headers: this.authHeaders() })
      : this.http.post(this.apiUrl(endpoint), this.adminLevelForm.value, { headers: this.authHeaders() });
    request.subscribe({
      next: () => {
        this.formMessage = this.editingAdminLevelId ? 'Nivel actualizado.' : 'Nivel creado.';
        this.cancelAdminLevelEdit();
        this.loadAdminNetwork();
      },
      error: (err) => this.formError = err?.error?.error || 'No fue posible guardar el nivel.'
    });
  }

  editAdminLevel(level: any): void {
    this.editingAdminLevelId = level.id;
    this.adminLevelForm.patchValue(level);
  }

  cancelAdminLevelEdit(): void {
    this.editingAdminLevelId = null;
    this.adminLevelForm.reset({ min_converted_referrals: 0, min_commissions: 0, min_active_allies: 0, sort_order: 1 });
  }

  archiveAdminLevel(id: number): void {
    this.http.delete(this.apiUrl(`/api/admin/partner-network/levels/${id}`), { headers: this.authHeaders() }).subscribe({
      next: () => {
        this.formMessage = 'Nivel archivado.';
        this.loadAdminNetwork();
      },
      error: (err) => this.formError = err?.error?.error || 'No fue posible archivar el nivel.'
    });
  }

  saveAdminGoal(): void {
    if (this.adminGoalForm.invalid) return this.adminGoalForm.markAllAsTouched();
    const endpoint = this.editingAdminGoalId ? `/api/admin/partner-network/goals/${this.editingAdminGoalId}` : '/api/admin/partner-network/goals';
    const request = this.editingAdminGoalId
      ? this.http.patch(this.apiUrl(endpoint), this.adminGoalForm.value, { headers: this.authHeaders() })
      : this.http.post(this.apiUrl(endpoint), this.adminGoalForm.value, { headers: this.authHeaders() });
    request.subscribe({
      next: () => {
        this.formMessage = this.editingAdminGoalId ? 'Meta actualizada.' : 'Meta creada.';
        this.cancelAdminGoalEdit();
        this.loadAdminNetwork();
      },
      error: (err) => this.formError = err?.error?.error || 'No fue posible guardar la meta.'
    });
  }

  editAdminGoal(goal: any): void {
    this.editingAdminGoalId = goal.id;
    this.adminGoalForm.patchValue({ ...goal, ally_id: goal.ally_id || '' });
  }

  cancelAdminGoalEdit(): void {
    this.editingAdminGoalId = null;
    this.adminGoalForm.reset({ ally_id: '', month: new Date().toISOString().slice(0, 7), referral_goal: 5, converted_goal: 1, commission_goal: 500000 });
  }

  archiveAdminGoal(id: number): void {
    this.http.delete(this.apiUrl(`/api/admin/partner-network/goals/${id}`), { headers: this.authHeaders() }).subscribe({
      next: () => {
        this.formMessage = 'Meta archivada.';
        this.loadAdminNetwork();
      },
      error: (err) => this.formError = err?.error?.error || 'No fue posible archivar la meta.'
    });
  }

  saveAdminResource(): void {
    if (this.adminResourceForm.invalid) return this.adminResourceForm.markAllAsTouched();
    const endpoint = this.editingAdminResourceId ? `/api/admin/partner-network/resources/${this.editingAdminResourceId}` : '/api/admin/partner-network/resources';
    const request = this.editingAdminResourceId
      ? this.http.patch(this.apiUrl(endpoint), this.adminResourceForm.value, { headers: this.authHeaders() })
      : this.http.post(this.apiUrl(endpoint), this.adminResourceForm.value, { headers: this.authHeaders() });
    request.subscribe({
      next: () => {
        this.formMessage = this.editingAdminResourceId ? 'Recurso actualizado.' : 'Recurso creado.';
        this.cancelAdminResourceEdit();
        this.loadAdminNetwork();
      },
      error: (err) => this.formError = err?.error?.error || 'No fue posible guardar el recurso.'
    });
  }

  editAdminResource(resource: any): void {
    this.editingAdminResourceId = resource.id;
    this.adminResourceForm.patchValue(resource);
  }

  cancelAdminResourceEdit(): void {
    this.editingAdminResourceId = null;
    this.adminResourceForm.reset({ resource_type: 'Mensaje' });
  }

  archiveAdminResource(id: number): void {
    this.http.delete(this.apiUrl(`/api/admin/partner-network/resources/${id}`), { headers: this.authHeaders() }).subscribe({
      next: () => {
        this.formMessage = 'Recurso archivado.';
        this.loadAdminNetwork();
      },
      error: (err) => this.formError = err?.error?.error || 'No fue posible archivar el recurso.'
    });
  }

  saveAdminAcademy(): void {
    if (this.adminAcademyForm.invalid) return this.adminAcademyForm.markAllAsTouched();
    const endpoint = this.editingAdminAcademyId ? `/api/admin/partner-network/academy/${this.editingAdminAcademyId}` : '/api/admin/partner-network/academy';
    const request = this.editingAdminAcademyId
      ? this.http.patch(this.apiUrl(endpoint), this.adminAcademyForm.value, { headers: this.authHeaders() })
      : this.http.post(this.apiUrl(endpoint), this.adminAcademyForm.value, { headers: this.authHeaders() });
    request.subscribe({
      next: () => {
        this.formMessage = this.editingAdminAcademyId ? 'Módulo actualizado.' : 'Módulo creado.';
        this.cancelAdminAcademyEdit();
        this.loadAdminNetwork();
      },
      error: (err) => this.formError = err?.error?.error || 'No fue posible guardar el módulo.'
    });
  }

  editAdminAcademy(module: any): void {
    this.editingAdminAcademyId = module.id;
    this.adminAcademyForm.patchValue(module);
  }

  cancelAdminAcademyEdit(): void {
    this.editingAdminAcademyId = null;
    this.adminAcademyForm.reset({ sort_order: 1 });
  }

  archiveAdminAcademy(id: number): void {
    this.http.delete(this.apiUrl(`/api/admin/partner-network/academy/${id}`), { headers: this.authHeaders() }).subscribe({
      next: () => {
        this.formMessage = 'Módulo archivado.';
        this.loadAdminNetwork();
      },
      error: (err) => this.formError = err?.error?.error || 'No fue posible archivar el módulo.'
    });
  }

  saveAdminFraudAlert(): void {
    if (this.adminFraudAlertForm.invalid) return this.adminFraudAlertForm.markAllAsTouched();
    const endpoint = this.editingAdminFraudAlertId ? `/api/admin/partner-network/fraud-alerts/${this.editingAdminFraudAlertId}` : '/api/admin/partner-network/fraud-alerts';
    const request = this.editingAdminFraudAlertId
      ? this.http.patch(this.apiUrl(endpoint), this.adminFraudAlertForm.value, { headers: this.authHeaders() })
      : this.http.post(this.apiUrl(endpoint), this.adminFraudAlertForm.value, { headers: this.authHeaders() });
    request.subscribe({
      next: () => {
        this.formMessage = this.editingAdminFraudAlertId ? 'Alerta actualizada.' : 'Alerta creada.';
        this.cancelAdminFraudAlertEdit();
        this.loadAdminNetwork();
      },
      error: (err) => this.formError = err?.error?.error || 'No fue posible guardar la alerta.'
    });
  }

  editAdminFraudAlert(alert: any): void {
    this.editingAdminFraudAlertId = alert.id;
    this.adminFraudAlertForm.patchValue({ ...alert, ally_id: alert.ally_id || '', referral_id: alert.referral_id || '' });
  }

  cancelAdminFraudAlertEdit(): void {
    this.editingAdminFraudAlertId = null;
    this.adminFraudAlertForm.reset({ ally_id: '', referral_id: '', risk_level: 'Medio', alert_type: 'Revisión manual', status: 'open' });
  }

  updateAdminFraudAlertStatus(id: number, status: string): void {
    this.http.patch(this.apiUrl(`/api/admin/partner-network/fraud-alerts/${id}`), { status }, { headers: this.authHeaders() }).subscribe({
      next: () => {
        this.formMessage = 'Alerta actualizada.';
        this.loadAdminNetwork();
      },
      error: (err) => this.formError = err?.error?.error || 'No fue posible actualizar la alerta.'
    });
  }

  archiveAdminFraudAlert(id: number): void {
    this.http.delete(this.apiUrl(`/api/admin/partner-network/fraud-alerts/${id}`), { headers: this.authHeaders() }).subscribe({
      next: () => {
        this.formMessage = 'Alerta archivada.';
        this.loadAdminNetwork();
      },
      error: (err) => this.formError = err?.error?.error || 'No fue posible archivar la alerta.'
    });
  }

  createAdminPayment(): void {
    if (this.adminPaymentForm.invalid) return this.adminPaymentForm.markAllAsTouched();
    this.http.post(this.apiUrl('/api/admin/payments'), this.adminPaymentForm.value, { headers: this.authHeaders() }).subscribe({
      next: () => {
        this.formMessage = 'Pago registrado.';
        this.adminPaymentForm.reset({ related_type: 'case', related_id: 1, amount: 0, status: 'Pendiente', payment_method: 'Nequi 3118924111' });
        this.loadAdminSectionData('payments');
      },
      error: (err) => this.formError = err?.error?.error || 'No fue posible registrar el pago.'
    });
  }

  updateAdminPayment(id: number, status: string): void {
    this.http.patch(this.apiUrl(`/api/admin/payments/${id}`), { status }, { headers: this.authHeaders() }).subscribe({ next: () => this.loadAdminSectionData('payments') });
  }

  archiveAdminPayment(id: number): void {
    this.http.delete(this.apiUrl(`/api/admin/payments/${id}`), { headers: this.authHeaders() }).subscribe({ next: () => this.loadAdminSectionData('payments') });
  }

  createAdminDocument(): void {
    if (this.adminDocumentForm.invalid) return this.adminDocumentForm.markAllAsTouched();
    this.http.post(this.apiUrl('/api/admin/documents'), this.adminDocumentForm.value, { headers: this.authHeaders() }).subscribe({
      next: () => {
        this.formMessage = 'Documento registrado.';
        this.adminDocumentForm.reset({ case_id: 1, file_url: '#', document_type: 'General', status: 'Recibido' });
        this.loadAdminSectionData('documents');
      },
      error: (err) => this.formError = err?.error?.error || 'No fue posible registrar el documento.'
    });
  }

  updateAdminDocument(id: number, status: string): void {
    this.http.patch(this.apiUrl(`/api/admin/documents/${id}`), { status }, { headers: this.authHeaders() }).subscribe({ next: () => this.loadAdminSectionData('documents') });
  }

  archiveAdminDocument(id: number): void {
    this.http.delete(this.apiUrl(`/api/admin/documents/${id}`), { headers: this.authHeaders() }).subscribe({ next: () => this.loadAdminSectionData('documents') });
  }

  createAdminAgenda(): void {
    if (this.adminAgendaForm.invalid) return this.adminAgendaForm.markAllAsTouched();
    this.http.post(this.apiUrl('/api/admin/agenda'), this.adminAgendaForm.value, { headers: this.authHeaders() }).subscribe({
      next: () => {
        this.formMessage = 'Agenda registrada.';
        this.adminAgendaForm.reset({ related_type: 'case', assigned_to: 'Equipo Orjuela', status: 'Programada' });
        this.loadAdminSectionData('agenda');
      },
      error: (err) => this.formError = err?.error?.error || 'No fue posible registrar agenda.'
    });
  }

  updateAdminAgenda(id: number, status: string): void {
    this.http.patch(this.apiUrl(`/api/admin/agenda/${id}`), { status }, { headers: this.authHeaders() }).subscribe({ next: () => this.loadAdminSectionData('agenda') });
  }

  archiveAdminAgenda(id: number): void {
    this.http.delete(this.apiUrl(`/api/admin/agenda/${id}`), { headers: this.authHeaders() }).subscribe({ next: () => this.loadAdminSectionData('agenda') });
  }

  loadClientProfile(): void {
    this.clientProfileLoading = true;
    this.http.get<ClientProfile>(this.apiUrl('/api/client/profile'), { headers: this.authHeaders() }).subscribe({
      next: (profile) => {
        this.applyClientProfile(profile);
        this.clientProfileLoading = false;
      },
      error: () => {
        this.applyStoredClientProfile();
        this.clientProfileLoading = false;
      }
    });
  }

  loadClientPortal(): void {
    this.http.get<any>(this.apiUrl('/api/client/portal'), { headers: this.authHeaders() }).subscribe({
      next: (response) => {
        const cases = response.cases || [];
        this.clientPortalCases = cases.map((item: any) => ({
          id: item.id,
          title: item.case_type,
          type: item.case_type,
          status: item.status,
          lawyer: item.assigned_lawyer || 'Equipo Orjuela',
          startDate: item.created_at,
          updatedAt: item.updated_at || item.created_at,
          nextAction: item.next_action || 'Pendiente de actualización',
          description: item.description || '',
          timeline: [
            { date: item.created_at, title: 'Caso recibido', description: 'El expediente fue registrado por la firma.', status: 'Completado' },
            { date: item.updated_at || item.created_at, title: item.status, description: item.next_action || 'Seguimiento en curso.', status: item.status }
          ],
          tasks: item.next_action ? [item.next_action] : []
        }));
        this.clientDocuments = (response.documents || []).map((doc: any) => ({
          id: doc.id,
          caseTitle: doc.case_type || 'Caso',
          name: doc.file_name,
          uploadedBy: 'Cliente/Firma',
          uploadedAt: doc.uploaded_at,
          status: doc.status || 'Recibido',
          observations: doc.observations || '',
          size: doc.document_type || 'Documento',
          fileUrl: doc.file_url || ''
        }));
        this.clientPayments = (response.payments || []).map((payment: any) => ({
          id: payment.id,
          concept: payment.concept || `Pago ${payment.related_type} #${payment.related_id}`,
          caseTitle: payment.related_type === 'case' ? `Caso #${payment.related_id}` : 'Cliente',
          amount: payment.amount,
          dueDate: payment.payment_date || payment.created_at,
          status: payment.status,
          receipt: payment.support_url || payment.payment_method || 'Pendiente de soporte',
          supportUrl: payment.support_url || '',
          paymentMethod: payment.payment_method || 'Nequi 3118924111'
        }));
        this.clientAppointments = (response.appointments || []).map((item: any) => ({
          id: item.id,
          title: item.title,
          caseTitle: item.related_type === 'case' ? `Caso #${item.related_id}` : 'Cliente',
          date: item.date || item.scheduled_at,
          type: 'Agenda',
          status: item.status,
          location: item.notes || 'Pendiente de confirmación'
        }));
        this.clientMessages = (response.messages || []).map((msg: any) => ({
          caseTitle: msg.case_type || 'Caso',
          from: msg.sender_role === 'client' ? (msg.sender_name || 'Cliente') : (msg.sender_name || 'Equipo Orjuela'),
          date: msg.created_at,
          unread: msg.sender_role !== 'client' && !msg.is_read_by_client,
          text: msg.message,
          attachmentName: msg.attachment_name || undefined,
          attachmentUrl: msg.attachment_url || undefined
        }));
        this.clientServiceRequests = (response.serviceRequests || []).map((request: any) => ({
          service_type: request.service_type,
          description: request.description,
          urgency: request.urgency,
          documents: request.documents || '',
          city: request.city || '',
          email: request.email || this.clientProfile.email,
          phone: request.phone || this.clientProfile.phone,
          status: request.status || 'Enviada',
          createdAt: request.created_at
        }));
        this.clientNotifications = (response.notifications || []).map((item: any) => ({
          id: item.id,
          title: item.title,
          description: item.description,
          date: item.created_at,
          type: item.notification_type || 'Portal',
          unread: !item.is_read
        }));
      }
    });
  }

  saveClientProfile(): void {
    this.clientFormError = '';
    this.clientFormMessage = '';
    if (this.clientProfileForm.invalid) {
      this.clientProfileForm.markAllAsTouched();
      this.clientFormError = 'Revisa los datos básicos antes de guardar.';
      return;
    }
    this.clientProfileSaving = true;
    this.http.patch<ClientProfile>(this.apiUrl('/api/client/profile'), this.clientProfileForm.value, { headers: this.authHeaders() }).subscribe({
      next: (profile) => {
        this.applyClientProfile(profile);
        this.clientProfileSaving = false;
        this.clientFormMessage = 'Datos actualizados correctamente.';
      },
      error: (err) => {
        if (err?.status && err.status !== 404) {
          this.clientProfileSaving = false;
          this.clientFormError = err.error?.error || 'No fue posible guardar los datos. Inténtalo nuevamente.';
          return;
        }
        this.applyClientProfile({
          ...this.clientProfile,
          ...this.clientProfileForm.value,
          updated_at: new Date().toISOString().slice(0, 10)
        });
        this.clientProfileSaving = false;
        this.clientFormMessage = 'Datos actualizados localmente. Se sincronizarán cuando el API esté disponible.';
      }
    });
  }

  clientProfileFieldInvalid(field: string): boolean {
    const control = this.clientProfileForm.get(field);
    return Boolean(control?.invalid && (control.dirty || control.touched));
  }

  clientProfileFieldError(field: string): string {
    const control = this.clientProfileForm.get(field);
    if (!control) return '';
    if (control.hasError('required')) return 'Este campo es obligatorio.';
    if (control.hasError('minlength')) return 'Ingresa un dato más completo.';
    if (control.hasError('maxlength')) return 'El texto supera el tamaño permitido.';
    if (control.hasError('pattern')) return 'Ingresa un celular colombiano válido.';
    return 'Revisa este campo.';
  }

  markClientNotificationsRead(): void {
    this.http.post(this.apiUrl('/api/client/notifications/read-all'), {}, { headers: this.authHeaders() }).subscribe({
      next: () => {
        this.clientNotifications = this.clientNotifications.map((item) => ({ ...item, unread: false }));
        this.clientFormMessage = 'Notificaciones marcadas como leídas.';
      },
      error: (err) => this.clientFormError = err?.error?.error || 'No fue posible actualizar notificaciones.'
    });
  }

  markClientNotificationRead(item: ClientNotification): void {
    if (!item.id) return;
    this.http.post(this.apiUrl(`/api/client/notifications/${item.id}/read`), {}, { headers: this.authHeaders() }).subscribe({
      next: () => {
        item.unread = false;
        this.clientFormMessage = 'Notificación marcada como leída.';
      },
      error: (err) => this.clientFormError = err?.error?.error || 'No fue posible actualizar la notificación.'
    });
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

  private apiUrl(path: string): string {
    return `${this.environment.apiBaseUrl || ''}${path}`;
  }

  private validateClientUploadFile(file: File, input: HTMLInputElement, sizeMessage: string): boolean {
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
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.clientFormError = sizeMessage;
      input.value = '';
      return false;
    }
    return true;
  }

  private async uploadClientFile(file: File, context: string): Promise<any> {
    const dataBase64 = await this.fileToBase64(file);
    return firstValueFrom(this.http.post<any>(this.apiUrl('/api/client/uploads'), {
      file_name: file.name,
      mime_type: file.type,
      data_base64: dataBase64,
      context
    }, { headers: this.authHeaders() }));
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
      reader.onerror = () => reject(new Error('No fue posible leer el archivo.'));
      reader.readAsDataURL(file);
    });
  }

  private getQueryParam(name: string): string {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get(name) || '';
  }

  private dashboardPathForRole(role: string): string {
    if (role === 'ally') return '/aliados/dashboard';
    if (role === 'client') return '/clientes/dashboard';
    return '/admin/dashboard';
  }

  private toDateTimeLocalValue(value: string): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value.includes('T') ? value.slice(0, 16) : '';
    const pad = (part: number) => String(part).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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

  private applyClientProfile(profile: Partial<ClientProfile>): void {
    this.clientProfile = {
      ...this.clientProfile,
      ...profile,
      full_name: profile.full_name || this.currentUser?.full_name || this.clientProfile.full_name,
      email: profile.email || this.currentUser?.email || this.clientProfile.email,
      document_id: profile.document_id || this.currentUser?.document_id || this.clientProfile.document_id
    };
    this.clientProfileForm.patchValue({
      full_name: this.clientProfile.full_name,
      phone: this.clientProfile.phone,
      city: this.clientProfile.city,
      address: this.clientProfile.address
    }, { emitEvent: false });
    this.clientServiceForm.patchValue({
      email: this.clientProfile.email,
      phone: this.clientProfile.phone,
      city: this.clientProfile.city
    }, { emitEvent: false });
    localStorage.setItem('orjuelaClientProfile', JSON.stringify(this.clientProfile));
  }

  private applyStoredClientProfile(): void {
    const raw = localStorage.getItem('orjuelaClientProfile');
    if (raw) {
      this.applyClientProfile(JSON.parse(raw));
      return;
    }
    this.applyClientProfile({
      full_name: this.currentUser?.full_name,
      email: this.currentUser?.email,
      document_id: this.currentUser?.document_id
    });
  }

  private mapAdminLead(item: any): AdminLead {
    return {
      ...(item || {}),
      name: item.name,
      phone: item.phone,
      email: item.email,
      caseType: item.case_type || item.caseType,
      source: item.source || 'Web',
      status: item.status || 'Nuevo',
      owner: item.assigned_to || item.owner || 'Comercial',
      date: item.created_at || item.date,
      nextAction: item.next_action || item.nextAction || 'Contactar y calificar necesidad legal',
      priority: item.priority || 'Media'
    };
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
      ...APP_PUBLIC_CONFIG,
      name: isPreviewHost ? 'qa' : APP_PUBLIC_CONFIG.name,
      enableDemoData: APP_PUBLIC_CONFIG.enableDemoData || isPreviewHost,
      showEnvironmentBadge: APP_PUBLIC_CONFIG.showEnvironmentBadge || isPreviewHost
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

