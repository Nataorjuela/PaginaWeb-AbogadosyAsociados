import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { AlliesService, AllyRecord, ReferralRecord } from '../../shared/infraestructure/services/allies.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, HttpClientModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent implements OnInit {
  loginForm!: FormGroup;
  allies: AllyRecord[] = [];
  referrals: ReferralRecord[] = [];
  searchAllies = '';
  searchReferrals = '';
  isAuthenticated = false;
  loadingAllies = false;
  loadingReferrals = false;
  loginError = '';

  statusOptions = [
    { value: 'pending', label: 'Pendiente' },
    { value: 'active', label: 'Activo' },
    { value: 'inactive', label: 'Inactivo' }
  ];

  referralStatusOptions = [
    { value: 'new', label: 'Nuevo' },
    { value: 'contacted', label: 'Contactado' },
    { value: 'in_progress', label: 'En proceso' },
    { value: 'won', label: 'Ganado' },
    { value: 'rejected', label: 'Rechazado' }
  ];

  allyTypeLabels: Record<string, string> = {
    persona_natural: 'Persona natural',
    empresa: 'Empresa',
    inmobiliaria: 'Inmobiliaria',
    contador: 'Contador',
    asesor_comercial: 'Asesor comercial',
    otro: 'Otro'
  };

  legalAreaLabels: Record<string, string> = {
    derecho_civil: 'Derecho civil',
    derecho_laboral: 'Derecho laboral',
    derecho_comercial: 'Derecho comercial',
    derecho_inmobiliario: 'Derecho inmobiliario',
    derecho_familia: 'Derecho de familia',
    cobranza: 'Cobranza',
    otro: 'Otro'
  };

  constructor(private fb: FormBuilder, private alliesService: AlliesService) {}

  ngOnInit(): void {
    this.loginForm = this.fb.group({
      password: ['', Validators.required]
    });

    const stored = sessionStorage.getItem('orjuelaAdminPassword');
    if (stored) {
      this.isAuthenticated = true;
      this.loadAllData(stored);
    }
  }

  private get adminPassword(): string {
    return sessionStorage.getItem('orjuelaAdminPassword') || '';
  }

  login(): void {
    this.loginError = '';
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const password = this.loginForm.value.password;
    this.alliesService.adminLogin(password).subscribe({
      next: () => {
        sessionStorage.setItem('orjuelaAdminPassword', password);
        this.isAuthenticated = true;
        this.loadAllData(password);
      },
      error: (error) => {
        this.loginError = error?.error?.error || 'Credenciales inválidas.';
      }
    });
  }

  logout(): void {
    sessionStorage.removeItem('orjuelaAdminPassword');
    this.isAuthenticated = false;
    this.allies = [];
    this.referrals = [];
    this.loginForm.reset();
  }

  loadAllData(password: string): void {
    this.loadAllies(password);
    this.loadReferrals(password);
  }

  loadAllies(password: string): void {
    this.loadingAllies = true;
    this.alliesService.getAllies(password, this.searchAllies).subscribe({
      next: (rows) => {
        this.allies = rows;
        this.loadingAllies = false;
      },
      error: () => {
        this.loadingAllies = false;
        this.logout();
      }
    });
  }

  loadReferrals(password: string): void {
    this.loadingReferrals = true;
    this.alliesService.getReferrals(password, this.searchReferrals).subscribe({
      next: (rows) => {
        this.referrals = rows;
        this.loadingReferrals = false;
      },
      error: () => {
        this.loadingReferrals = false;
        this.logout();
      }
    });
  }

  searchAlliesChanged(): void {
    if (this.isAuthenticated) {
      this.loadAllies(this.adminPassword);
    }
  }

  searchReferralsChanged(): void {
    if (this.isAuthenticated) {
      this.loadReferrals(this.adminPassword);
    }
  }

  updateAllyStatus(ally: AllyRecord, status: string): void {
    if (!this.isAuthenticated) return;
    this.alliesService.updateAllyStatus(this.adminPassword, ally.id, status).subscribe({
      next: () => {
        ally.status = status;
      }
    });
  }

  updateReferralStatus(referral: ReferralRecord, status: string): void {
    if (!this.isAuthenticated) return;
    this.alliesService.updateReferralStatus(this.adminPassword, referral.id, status).subscribe({
      next: () => {
        referral.status = status;
      }
    });
  }
}
