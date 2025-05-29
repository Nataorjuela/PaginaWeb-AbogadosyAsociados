import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import emailjs from '@emailjs/browser';

@Component({
  selector: 'app-contactUs',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule
  ],
  templateUrl: './contact-us.component.html',
  styleUrls: ['./contact-us.component.scss']
})
export class ContactUsComponent implements OnInit {
  form!: FormGroup;

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      nombre: ['', Validators.required],
      correo: ['', [Validators.required, Validators.email]],
      celular: ['', Validators.required],
      proveedor: ['', Validators.required],
      cedula: [''],
      descripcion: [''],
      valor: ['']
    });

    this.form.get('proveedor')?.valueChanges.subscribe((valor) => {
      const cedulaControl = this.form.get('cedula');
      const descripcionControl = this.form.get('descripcion');
      const valorControl = this.form.get('valor');

      if (valor === 'si') {
        cedulaControl?.setValidators([Validators.required]);
        descripcionControl?.setValidators([Validators.required]);
        valorControl?.setValidators([Validators.required]);
      } else {
        cedulaControl?.clearValidators();
        descripcionControl?.clearValidators();
        valorControl?.clearValidators();
      }

      cedulaControl?.updateValueAndValidity();
      descripcionControl?.updateValueAndValidity();
      valorControl?.updateValueAndValidity();
    });
  }

  sendEmail(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      console.warn('Formulario inválido', this.form.value);
      return;
    }

    const formValues = this.form.value;
    const templateParams = {
      from_name: formValues.nombre,
      reply_to: formValues.correo,
      celular: formValues.celular,
      proveedor: formValues.proveedor,
      cedula: formValues.proveedor === 'si' ? formValues.cedula : 'No aplica',
      descripcion: formValues.proveedor === 'si' ? formValues.descripcion : 'No aplica',
      valor: formValues.proveedor === 'si' ? formValues.valor : 'No aplica',
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
      'service_s0s3k19',           // Tu Service ID
      'template_5nnggub',          // Tu Template ID
      templateParams,
      'bXZOYmlHdQTKmeclq'         // Reemplaza con tu Public Key real
    ).then(
      response => {
        console.log('Correo enviado', response.status, response.text);
        alert('Mensaje enviado con éxito');
        this.form.reset();
      },
      error => {
        console.error('Error al enviar el correo', error);
        alert('Ocurrió un error al enviar el mensaje');
      }
    );
  }
}
