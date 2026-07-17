import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { AlliesService, AllyRegistration, ReferralSubmission } from '../../shared/infraestructure/services/allies.service';
import { APP_PUBLIC_CONFIG } from '../../shared/config/app-public-config';

declare const google: any;

type Option = { value: string; label: string };
type Benefit = { icon: string; title: string; description: string };

@Component({
  selector: 'app-allies-program',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HttpClientModule],
  templateUrl: './allies-program.component.html',
  styleUrls: ['./allies-program.component.scss']
})
export class AlliesProgramComponent implements OnInit {
  registerForm!: FormGroup;
  referralForm!: FormGroup;
  registerStep = 1;
  referralStep = 1;
  registerMessage = '';
  referralMessage = '';
  registerError = '';
  referralError = '';
  isRegistering = false;
  isSendingReferral = false;
  isGoogleRegistering = false;
  private googleScriptPromise?: Promise<void>;
  readonly strongPasswordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

  allyTypes: Option[] = [
    { value: 'inmobiliaria', label: 'Inmobiliaria' },
    { value: 'asesor_comercial', label: 'Asesor comercial' },
    { value: 'cliente', label: 'Cliente' },
    { value: 'empresa', label: 'Empresa' },
    { value: 'independiente', label: 'Independiente' },
    { value: 'otro', label: 'Otro' }
  ];

  accountTypes: Option[] = [
    { value: 'ahorros', label: 'Cuenta de ahorros' },
    { value: 'corriente', label: 'Cuenta corriente' }
  ];

  legalAreas: Option[] = [
    { value: 'derecho_civil', label: 'Derecho civil' },
    { value: 'derecho_laboral', label: 'Derecho laboral' },
    { value: 'derecho_comercial', label: 'Derecho comercial' },
    { value: 'derecho_inmobiliario', label: 'Derecho inmobiliario' },
    { value: 'derecho_familia', label: 'Derecho de familia' },
    { value: 'cobranza', label: 'Cobranza' },
    { value: 'contratos', label: 'Contratos' },
    { value: 'sucesiones', label: 'Sucesiones' },
    { value: 'otro', label: 'Otro' }
  ];

  urgencyOptions: Option[] = [
    { value: 'baja', label: 'Puede esperar' },
    { value: 'media', label: 'Esta semana' },
    { value: 'alta', label: 'Urgente' }
  ];

  benefits: Benefit[] = [
    { icon: 'bi-cash-stack', title: 'Comisión por cliente efectivo', description: 'Recibe reconocimiento económico cuando un cliente potencial se convierte en cliente.' },
    { icon: 'bi-kanban', title: 'Seguimiento de clientes potenciales', description: 'Consulta estados y próximas acciones desde una experiencia privada.' },
    { icon: 'bi-clock-history', title: 'Historial de oportunidades', description: 'Mantén trazabilidad de cada contacto enviado a la firma.' },
    { icon: 'bi-shield-check', title: 'Transparencia en estados', description: 'Estados claros: recibido, contactado, evaluación, cliente activo y comisión.' },
    { icon: 'bi-headset', title: 'Soporte jurídico', description: 'Equipo disponible para orientar el proceso comercial y legal.' },
    { icon: 'bi-diagram-3', title: 'Red de aliados', description: 'Invita aliados y diferencia la red comercial de los clientes potenciales con caso legal.' }
  ];

  constructor(private fb: FormBuilder, private alliesService: AlliesService) {}

  ngOnInit(): void {
    this.registerForm = this.fb.group({
      full_name: ['', Validators.required],
      document_number: ['', [Validators.required, Validators.pattern(/^[0-9A-Za-z-]+$/)]],
      phone: ['', [Validators.required, Validators.minLength(7)]],
      email: ['', [Validators.required, Validators.email]],
      city: ['', Validators.required],
      password: ['', [Validators.required, Validators.pattern(this.strongPasswordPattern)]],
      confirm_password: ['', [Validators.required, Validators.pattern(this.strongPasswordPattern)]],
      ally_type: ['', Validators.required],
      how_known: [''],
      bank_name: [''],
      account_type: [''],
      account_number: [''],
      accept_program_terms: [false, Validators.requiredTrue],
      accept_terms: [false, Validators.requiredTrue]
    });

    this.referralForm = this.fb.group({
      ally_document_number: ['', [Validators.required, Validators.pattern(/^[0-9A-Za-z-]+$/)]],
      ally_email: ['', [Validators.required, Validators.email]],
      referred_full_name: ['', Validators.required],
      referred_phone: ['', [Validators.required, Validators.minLength(7)]],
      referred_email: ['', Validators.email],
      referred_city: ['', Validators.required],
      legal_area: ['', Validators.required],
      case_description: ['', [Validators.required, Validators.maxLength(800)]],
      urgency: ['', Validators.required],
      file_notes: [''],
      contact_authorization: [false, Validators.requiredTrue]
    });
  }

  get registerProgress(): number {
    return (this.registerStep / 4) * 100;
  }

  get referralProgress(): number {
    return (this.referralStep / 4) * 100;
  }

  get selectedLegalAreaLabel(): string {
    const value = this.referralForm?.value?.legal_area;
    return this.legalAreas.find((item) => item.value === value)?.label || 'Sin seleccionar';
  }

  nextRegisterStep(): void {
    if (!this.isRegisterStepValid()) return;
    this.registerStep = Math.min(this.registerStep + 1, 4);
  }

  previousRegisterStep(): void {
    this.registerStep = Math.max(this.registerStep - 1, 1);
  }

  nextReferralStep(): void {
    if (!this.isReferralStepValid()) return;
    this.referralStep = Math.min(this.referralStep + 1, 4);
  }

  previousReferralStep(): void {
    this.referralStep = Math.max(this.referralStep - 1, 1);
  }

  isRegisterStepValid(): boolean {
    const controlsByStep: Record<number, string[]> = {
      1: ['full_name', 'document_number', 'phone', 'email', 'city', 'password', 'confirm_password'],
      2: ['ally_type'],
      3: [],
      4: ['accept_program_terms', 'accept_terms']
    };
    return this.validateControls(this.registerForm, controlsByStep[this.registerStep]);
  }

  isReferralStepValid(): boolean {
    const controlsByStep: Record<number, string[]> = {
      1: ['ally_document_number', 'ally_email'],
      2: ['referred_full_name', 'referred_phone', 'referred_city'],
      3: ['legal_area', 'case_description', 'urgency'],
      4: ['contact_authorization']
    };
    return this.validateControls(this.referralForm, controlsByStep[this.referralStep]);
  }

  private validateControls(form: FormGroup, controlNames: string[]): boolean {
    controlNames.forEach((controlName) => form.get(controlName)?.markAsTouched());
    if (form === this.registerForm && controlNames.includes('confirm_password') && form.value.password !== form.value.confirm_password) {
      form.get('confirm_password')?.setErrors({ mismatch: true });
    } else if (form === this.registerForm && controlNames.includes('confirm_password')) {
      const confirmPassword = form.get('confirm_password');
      if (confirmPassword?.hasError('mismatch')) {
        const errors = { ...(confirmPassword.errors || {}) };
        delete errors['mismatch'];
        confirmPassword.setErrors(Object.keys(errors).length ? errors : null);
      }
    }
    return controlNames.every((controlName) => form.get(controlName)?.valid);
  }

  submitRegistration(): void {
    this.registerMessage = '';
    this.registerError = '';
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      this.registerError = 'Revisa los campos marcados antes de enviar tu registro.';
      return;
    }
    if (this.registerForm.value.password !== this.registerForm.value.confirm_password) {
      this.registerError = 'Las contraseñas no coinciden.';
      return;
    }

    this.isRegistering = true;
    const payload: AllyRegistration = this.registerForm.value;
    this.alliesService.registerAlly(payload).subscribe({
      next: (response) => {
        this.registerMessage = response?.message || 'Tu registro como aliado fue recibido correctamente. Pronto nuestro equipo validará tu información.';
        this.registerForm.reset({ accept_terms: false, accept_program_terms: false });
        this.registerStep = 1;
        this.isRegistering = false;
      },
      error: (error) => {
        this.registerError = error?.error?.error || 'Ocurrió un error al enviar el formulario. Intente de nuevo.';
        this.isRegistering = false;
      }
    });
  }

  continueWithGoogle(): void {
    this.registerError = '';
    this.registerMessage = '';
    const clientId = APP_PUBLIC_CONFIG.googleClientId;
    if (!clientId) {
      this.registerError = 'Configura GOOGLE_CLIENT_ID para activar el registro con Google.';
      return;
    }

    this.isGoogleRegistering = true;
    this.loadGoogleScript()
      .then(() => {
        google.accounts.id.initialize({
          client_id: clientId,
          callback: (response: { credential?: string }) => {
            if (!response?.credential) {
              this.requestGoogleAccessToken(clientId);
              return;
            }
            this.completeGoogleAllyAuth({ credential: response.credential });
          },
          auto_select: false,
          cancel_on_tap_outside: true
        });
        google.accounts.id.prompt((notification: any) => {
          if (notification?.isNotDisplayed?.() || notification?.isSkippedMoment?.()) {
            this.requestGoogleAccessToken(clientId);
          }
        });
      })
      .catch(() => {
        this.isGoogleRegistering = false;
        this.registerError = 'No fue posible cargar Google Sign-In.';
      });
  }

  private requestGoogleAccessToken(clientId: string): void {
    try {
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'openid email profile',
        callback: (response: { access_token?: string; error?: string }) => {
          if (response?.error || !response?.access_token) {
            this.isGoogleRegistering = false;
            this.registerError = 'No recibimos la autorización de Google. Intenta de nuevo.';
            return;
          }
          this.completeGoogleAllyAuth({ access_token: response.access_token });
        }
      });
      tokenClient.requestAccessToken({ prompt: 'select_account' });
    } catch {
      this.isGoogleRegistering = false;
      this.registerError = 'No fue posible iniciar la ventana de Google.';
    }
  }

  private completeGoogleAllyAuth(payload: { credential?: string; access_token?: string }): void {
    this.alliesService.googleAllyAuth(payload).subscribe({
      next: (response) => {
        localStorage.setItem('orjuelaToken', response.token);
        localStorage.setItem('orjuelaUser', JSON.stringify(response.user));
        this.isGoogleRegistering = false;
        window.location.href = '/aliados/dashboard';
      },
      error: (error) => {
        this.isGoogleRegistering = false;
        this.registerError = error?.error?.error || 'No fue posible crear la cuenta con Google.';
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

  submitReferral(): void {
    this.referralMessage = '';
    this.referralError = '';
    if (this.referralForm.invalid) {
      this.referralForm.markAllAsTouched();
      this.referralError = 'Revisa los campos obligatorios y confirma la autorización de contacto.';
      return;
    }

    this.isSendingReferral = true;
    const payload: ReferralSubmission = this.referralForm.value;
    this.alliesService.sendReferral(payload).subscribe({
      next: (response) => {
        this.referralMessage = response?.message || 'Cliente potencial enviado correctamente. El equipo de Orjuela Abogados se pondrá en contacto con la persona.';
        this.referralForm.reset({ contact_authorization: false });
        this.referralStep = 1;
        this.isSendingReferral = false;
      },
      error: (error) => {
        this.referralError = error?.error?.error || 'Ocurrió un error al enviar el cliente potencial. Intente de nuevo.';
        this.isSendingReferral = false;
      }
    });
  }
}
