import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import emailjs from '@emailjs/browser';

@Component({
  selector: 'app-contactUs',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
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

  constructor(private fb: FormBuilder) {}

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

    const formValues = this.form.value;
    const templateParams = {
      from_name: formValues.nombre,
      reply_to: formValues.correo,
      celular: formValues.celular,
      case_type: formValues.case_type,
      source: formValues.source,
      notes: formValues.notes,
      fecha_envio: new Date().toLocaleString('es-CO', {
        timeZone: 'America/Bogota',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    };

    emailjs.send(
      'service_s0s3k19',
      'template_5nnggub',
      templateParams,
      'bXZOYmlHdQTKmeclq'
    ).then(
      () => {
        this.successMessage = 'Tu solicitud fue recibida. Un abogado del equipo te contactará pronto.';
        this.form.reset({ source: 'Web', aceptaDatos: false });
      },
      () => {
        this.errorMessage = 'Ocurrió un error al enviar el mensaje. También puedes escribirnos por WhatsApp.';
      }
    );
  }
}
