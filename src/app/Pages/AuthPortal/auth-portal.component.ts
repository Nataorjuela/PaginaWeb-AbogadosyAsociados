import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';

type AccessCard = {
  icon: string;
  title: string;
  text: string;
  button: string;
  href: string;
};

type PortalMetric = {
  label: string;
  value: string;
};

type ReferralRow = {
  client: string;
  caseType: string;
  date: string;
  status: string;
  commission: string;
  action: string;
};

type CaseRow = {
  caseType: string;
  status: string;
  updatedAt: string;
  lawyer: string;
  nextAction: string;
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
  registerStep = 1;
  showPassword = false;
  loading = false;
  message = '';
  error = '';
  currentUser: any = null;

  accessCards: AccessCard[] = [
    {
      icon: 'bi-diagram-3',
      title: 'Soy aliado',
      text: 'Gestiona tus referidos y consulta tus comisiones.',
      button: 'Ingresar como aliado',
      href: '/aliados/login'
    },
    {
      icon: 'bi-folder-check',
      title: 'Soy cliente',
      text: 'Consulta el estado de tu caso y tus documentos.',
      button: 'Ingresar como cliente',
      href: '/clientes/login'
    },
    {
      icon: 'bi-shield-lock',
      title: 'Administración',
      text: 'Acceso interno para el equipo jurídico y administrativo.',
      button: 'Ingresar al panel',
      href: '/admin/login'
    }
  ];

  partnerMetrics: PortalMetric[] = [
    { label: 'Referidos enviados', value: '12' },
    { label: 'Casos activos', value: '4' },
    { label: 'Comisión estimada', value: '$2.400.000' },
    { label: 'Comisión pagada', value: '$1.100.000' }
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
    { label: 'Comisiones pendientes', value: '$4.800.000' },
    { label: 'Ingresos estimados', value: '$38.5M' }
  ];

  referrals: ReferralRow[] = [
    { client: 'María Rodríguez', caseType: 'Derecho inmobiliario', date: '2026-05-08', status: 'En evaluación', commission: '$800.000', action: 'Revisión de documentos' },
    { client: 'Carlos Pérez', caseType: 'Cobro de cartera', date: '2026-05-04', status: 'Contactado', commission: '$350.000', action: 'Agendar asesoría' },
    { client: 'Empresa Andina', caseType: 'Contratos', date: '2026-04-29', status: 'Comisión aprobada', commission: '$1.250.000', action: 'Pago programado' }
  ];

  clientCases: CaseRow[] = [
    { caseType: 'Contrato de compraventa', status: 'En revisión', updatedAt: '2026-05-12', lawyer: 'Equipo inmobiliario', nextAction: 'Enviar certificado actualizado' },
    { caseType: 'Sucesión', status: 'Documentos solicitados', updatedAt: '2026-05-09', lawyer: 'Área civil y familia', nextAction: 'Cargar registros civiles' }
  ];

  adminLeads = [
    { name: 'Laura Méndez', caseType: 'Derecho civil', source: 'Web', status: 'Nuevo', owner: 'Comercial', date: '2026-05-12' },
    { name: 'Inmobiliaria Norte', caseType: 'Contratos', source: 'Aliado', status: 'Contactado', owner: 'Asistente', date: '2026-05-11' },
    { name: 'Jorge Salinas', caseType: 'Cobro de cartera', source: 'WhatsApp', status: 'Agendado', owner: 'Abogado civil', date: '2026-05-10' }
  ];

  partnerTypes = ['Inmobiliaria', 'Asesor comercial', 'Cliente', 'Empresa', 'Independiente', 'Otro'];

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

    this.restoreSession();
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

  logout(): void {
    localStorage.removeItem('orjuelaToken');
    localStorage.removeItem('orjuelaUser');
    this.currentUser = null;
    this.go('/ingresar');
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
}
