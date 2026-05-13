import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';

type AccessCard = { icon: string; title: string; text: string; button: string; href: string };
type PortalMetric = { label: string; value: string };
type ReferralRow = { client: string; caseType: string; date: string; status: string; commission: string; action: string };
type CaseRow = { caseType: string; status: string; updatedAt: string; lawyer: string; nextAction: string };
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
  calculatorForm!: FormGroup;
  legalAcceptanceForm!: FormGroup;
  signatureForm!: FormGroup;
  kycForm!: FormGroup;
  registerStep = 1;
  showPassword = false;
  loading = false;
  message = '';
  error = '';
  currentUser: any = null;
  adminSection = 'dashboard';
  partnerSection = 'overview';
  partnerNetwork: PartnerNetwork = {};
  partnerAdvanced: any = {};
  adminNetwork: any = { allies: [], referrals: [], commissions: [], settings: {} };
  formMessage = '';
  formError = '';
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
  commissionTypes = [
    { label: 'Directa', value: 'direct', field: 'direct_percentage' },
    { label: 'Red nivel 1', value: 'level_1', field: 'level_1_percentage' },
    { label: 'Red nivel 2', value: 'level_2', field: 'level_2_percentage' }
  ];

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

    this.calculatorForm = this.fb.group({
      contract_value: [5000000, Validators.required],
      commission_type: ['direct', Validators.required]
    });

    this.legalAcceptanceForm = this.fb.group({
      document_type: ['Contrato de aliado', Validators.required],
      accepted: [false, Validators.requiredTrue]
    });

    this.signatureForm = this.fb.group({
      document_type: ['Contrato de aliado', Validators.required],
      full_name: ['', Validators.required],
      document_number: ['', Validators.required],
      accepted: [false, Validators.requiredTrue]
    });

    this.kycForm = this.fb.group({
      front_document_url: ['', Validators.required],
      back_document_url: ['', Validators.required],
      selfie_url: ['', Validators.required],
      bank_name: ['', Validators.required],
      account_type: ['', Validators.required],
      account_number: ['', Validators.required]
    });

    this.restoreSession();
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
    if (['crm', 'activity', 'level', 'goals', 'calculator', 'notifications', 'ally-profile', 'legal', 'finance', 'tree', 'academy', 'kyc'].includes(section)) {
      this.loadPartnerAdvanced();
    }
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
    const paid = commissions.filter((item) => item.status === 'paid').reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return { direct, indirect, total, pending, paid };
  }

  get calculatorPercentage(): number {
    const type = this.calculatorForm?.value?.commission_type || 'direct';
    const settings = this.partnerNetwork.settings || this.partnerAdvanced.calculator || {};
    if (type === 'level_1') return Number(settings.level_1_percentage || 3);
    if (type === 'level_2') return Number(settings.level_2_percentage || 1);
    return Number(settings.direct_percentage || 10);
  }

  get calculatorResult(): number {
    return Number(this.calculatorForm?.value?.contract_value || 0) * (this.calculatorPercentage / 100);
  }

  get unreadNotifications(): number {
    return (this.partnerAdvanced.notifications || []).filter((item: any) => !item.is_read).length;
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
      next: (response) => this.partnerNetwork = response,
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

  acceptLegalDocument(): void {
    if (this.legalAcceptanceForm.invalid) {
      this.legalAcceptanceForm.markAllAsTouched();
      return;
    }
    this.http.post<any>('/api/partner/legal-acceptances', {
      document_type: this.legalAcceptanceForm.value.document_type,
      version: 'v1.0'
    }, { headers: this.authHeaders() }).subscribe({
      next: (response) => {
        this.formMessage = response.message;
        this.legalAcceptanceForm.patchValue({ accepted: false });
        this.loadPartnerAdvanced();
      }
    });
  }

  submitSignature(): void {
    if (this.signatureForm.invalid) {
      this.signatureForm.markAllAsTouched();
      return;
    }
    this.http.post<any>('/api/partner/electronic-signatures', this.signatureForm.value, { headers: this.authHeaders() }).subscribe({
      next: (response) => {
        this.formMessage = response.message;
        this.signatureForm.patchValue({ accepted: false });
        this.loadPartnerAdvanced();
      }
    });
  }

  submitKyc(): void {
    if (this.kycForm.invalid) {
      this.kycForm.markAllAsTouched();
      return;
    }
    this.http.post<any>('/api/partner/kyc', this.kycForm.value, { headers: this.authHeaders() }).subscribe({
      next: (response) => {
        this.formMessage = response.message;
        this.loadPartnerAdvanced();
      }
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
    return {
      partner: { referral_code: 'ORJUELAQA', invite_link: invite },
      summary: { total_referrals: 12, in_review: 4, converted: 3, pending_commission: 180000, approved_commission: 220000, paid_commission: 320000, active_team_members: 2 },
      settings: { direct_percentage: 10, level_1_percentage: 3, level_2_percentage: 1 },
      team: [
        { full_name: 'Camila Red Aliada', city: 'Medellin', status: 'active', referrals_count: 4, generated_commissions: 90000 },
        { full_name: 'Andres Red Aliado', city: 'Cali', status: 'pending', referrals_count: 1, generated_commissions: 0 }
      ],
      direct_referrals: this.referrals.map((item, index) => ({ id: index + 1, referred_full_name: item.client, legal_area: item.caseType, created_at: item.date, status: item.status, commission_amount: Number(item.commission.replace(/\D/g, '')) })),
      network_referrals: [
        { masked_name: 'Juliana M.', legal_area: 'Familia', source_ally_name: 'Camila Red Aliada', status: 'En revision', commission_amount: 90000, created_at: '2026-05-11' }
      ],
      commissions: [
        { id: 1, commission_type: 'direct', percentage: 10, amount: 180000, status: 'approved', referred_full_name: 'Maria Rodriguez', created_at: '2026-05-08' },
        { id: 2, commission_type: 'indirect_level_1', percentage: 3, amount: 90000, status: 'pending', referred_full_name: 'Juliana M.', source_ally_name: 'Camila Red Aliada', created_at: '2026-05-11' },
        { id: 3, commission_type: 'direct', percentage: 10, amount: 320000, status: 'paid', referred_full_name: 'Empresa Andina', created_at: '2026-04-29' }
      ],
      share: {
        client_message: `Hola, quiero recomendarte a Orjuela Abogados. Pueden ayudarte con asesoria juridica personalizada. Puedes dejar tus datos aqui: ${invite}`,
        ally_message: `Hola, quiero invitarte al programa de aliados de Orjuela Abogados. Puedes referir personas que necesiten servicios legales y recibir comisiones por casos efectivos. Registrate aqui: ${invite}`
      }
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
        { id: 2, title: 'Documento pendiente', description: 'Actualiza tu verificación KYC para solicitar pagos.', notification_type: 'Documento pendiente', is_read: 0, created_at: '2026-05-12' }
      ],
      profile: { ...(this.partnerNetwork.partner || {}), document_id: '900111222', phone: '300 111 2233', city: 'Bogotá', occupation: 'Asesor comercial', status: 'Activo', joined_at: '2026-05-01', bank_name: 'Dato sensible protegido', account_type: 'Dato sensible protegido', account_number: '****' },
      legal_documents: [{ document_type: 'Contrato de aliado', version: 'v1.0', status: 'pending' }, { document_type: 'Habeas data', version: 'v1.0', status: 'accepted', accepted_at: '2026-05-12' }],
      charts: { commissions_by_month: [{ label: '2026-04', value: 120000 }, { label: '2026-05', value: 390000 }], referrals_by_month: [{ label: '2026-04', value: 4 }, { label: '2026-05', value: 8 }], conversion_rate: 25, network_growth: [{ label: '2026-05', value: 2 }], direct_vs_indirect: [{ label: 'Directas', value: 500000 }, { label: 'Indirectas', value: 90000 }], pending_vs_paid: [{ label: 'Pendientes', value: 180000 }, { label: 'Pagadas', value: 320000 }] },
      network_tree: { name: 'Aliado Demo Orjuela', level: 'Principal', status: 'Activo', referrals_count: 12, commissions: 500000, children: [{ name: 'Camila Red Aliada', level: 'Nivel 1', status: 'Activo', referrals_count: 4, commissions: 90000 }] },
      academy: [
        { title: 'Cómo funciona el programa', description: 'Reglas, estados y comisiones.', progress: 80, progress_status: 'completado' },
        { title: 'Protección de datos personales', description: 'Buenas prácticas de habeas data.', progress: 40, progress_status: 'pendiente' }
      ],
      kyc: { status: 'En revisión', phone_validated: 1, email_validated: 1 },
      calculator: { direct_percentage: 10, level_1_percentage: 3, level_2_percentage: 1 }
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
