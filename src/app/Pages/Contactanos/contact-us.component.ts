import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { APP_PUBLIC_CONFIG } from '../../shared/config/app-public-config';

@Component({
  selector: 'app-contactUs',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HttpClientModule],
  templateUrl: './contact-us.component.html',
  styleUrls: ['./contact-us.component.scss']
})
export class ContactUsComponent implements OnInit {
  form!: FormGroup;
  successMessage = '';
  errorMessage = '';

  caseTypes = [
    'Derecho inmobiliario',
    'Derecho civil',
    'Derecho comercial',
    'Derecho de familia',
    'Cobro de cartera',
    'Contratos',
    'Sucesiones',
    'Asesoría empresarial',
    'Otro'
  ];

  constructor(private fb: FormBuilder, private http: HttpClient) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      nombre: ['', Validators.required],
      correo: ['', [Validators.required, Validators.email]],
      celular: ['', [Validators.required, Validators.minLength(7)]],
      case_type: ['', Validators.required],
      source: ['Web'],
      notes: ['', [Validators.required, Validators.maxLength(800)]],
      aceptaDatos: [false, Validators.requiredTrue]
    });
  }

  sendEmail(): void {
    this.successMessage = '';
    this.errorMessage = '';
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage = 'Revisa los campos marcados antes de enviar tu caso.';
      return;
    }

    const values = this.form.value;
    this.http.post(`${APP_PUBLIC_CONFIG.apiBaseUrl || ''}/api/leads`, {
      name: values.nombre,
      phone: values.celular,
      email: values.correo,
      case_type: values.case_type,
      source: values.source || 'Web',
      assigned_to: 'Comercial',
      notes: values.notes
    }).subscribe({
      next: () => {
        this.successMessage = 'Tu solicitud fue recibida. Un abogado del equipo te contactará pronto.';
        this.form.reset({ source: 'Web', aceptaDatos: false });
      },
      error: () => {
        this.errorMessage = 'Ocurrió un error al registrar el caso. También puedes escribirnos por WhatsApp.';
      }
    });
  }
}
