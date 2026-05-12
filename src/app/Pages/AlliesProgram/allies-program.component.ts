import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { AlliesService, AllyRegistration, ReferralSubmission } from '../../shared/infraestructure/services/allies.service';

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
  registerMessage = '';
  referralMessage = '';
  registerError = '';
  referralError = '';
  isRegistering = false;
  isSendingReferral = false;

  allyTypes = [
    { value: 'persona_natural', label: 'Persona natural' },
    { value: 'empresa', label: 'Empresa' },
    { value: 'inmobiliaria', label: 'Inmobiliaria' },
    { value: 'contador', label: 'Contador' },
    { value: 'asesor_comercial', label: 'Asesor comercial' },
    { value: 'otro', label: 'Otro' }
  ];

  legalAreas = [
    { value: 'derecho_civil', label: 'Derecho civil' },
    { value: 'derecho_laboral', label: 'Derecho laboral' },
    { value: 'derecho_comercial', label: 'Derecho comercial' },
    { value: 'derecho_inmobiliario', label: 'Derecho inmobiliario' },
    { value: 'derecho_familia', label: 'Derecho de familia' },
    { value: 'cobranza', label: 'Cobranza' },
    { value: 'otro', label: 'Otro' }
  ];

  constructor(private fb: FormBuilder, private alliesService: AlliesService) {}

  ngOnInit(): void {
    this.registerForm = this.fb.group({
      full_name: ['', Validators.required],
      document_number: ['', [Validators.required, Validators.pattern(/^[0-9A-Za-z-]+$/)]],
      phone: ['', [Validators.required, Validators.minLength(7)]],
      email: ['', [Validators.required, Validators.email]],
      city: ['', Validators.required],
      ally_type: ['', Validators.required],
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
      contact_authorization: [false, Validators.requiredTrue]
    });
  }

  submitRegistration(): void {
    this.registerMessage = '';
    this.registerError = '';
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      this.registerError = 'Por favor complete los campos obligatorios.';
      return;
    }

    this.isRegistering = true;
    const payload: AllyRegistration = this.registerForm.value;
    this.alliesService.registerAlly(payload).subscribe({
      next: (response) => {
        this.registerMessage = response?.message || 'Tu registro como aliado fue recibido correctamente. Pronto nuestro equipo validará tu información.';
        this.registerForm.reset({ accept_terms: false });
        this.isRegistering = false;
      },
      error: (error) => {
        this.registerError = error?.error?.error || 'Ocurrió un error al enviar el formulario. Intente de nuevo.';
        this.isRegistering = false;
      }
    });
  }

  submitReferral(): void {
    this.referralMessage = '';
    this.referralError = '';
    if (this.referralForm.invalid) {
      this.referralForm.markAllAsTouched();
      this.referralError = 'Por favor complete todos los campos obligatorios y autorice el contacto.';
      return;
    }

    this.isSendingReferral = true;
    const payload: ReferralSubmission = this.referralForm.value;
    this.alliesService.sendReferral(payload).subscribe({
      next: (response) => {
        this.referralMessage = response?.message || 'Referido enviado correctamente. El equipo de Orjuela Abogados se pondrá en contacto con la persona referida.';
        this.referralForm.reset({ contact_authorization: false });
        this.isSendingReferral = false;
      },
      error: (error) => {
        this.referralError = error?.error?.error || 'Ocurrió un error al enviar el referido. Intente de nuevo.';
        this.isSendingReferral = false;
      }
    });
  }
