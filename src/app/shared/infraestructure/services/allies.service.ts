import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_PUBLIC_CONFIG } from '../../config/app-public-config';

export interface AllyRegistration {
  full_name: string;
  document_number: string;
  phone: string;
  email: string;
  city: string;
  ally_type: string;
  how_known?: string;
  password: string;
  confirm_password: string;
  bank_name?: string;
  account_type?: string;
  account_number?: string;
  accept_program_terms?: boolean;
  accept_terms: boolean;
}

export interface ReferralSubmission {
  ally_document_number: string;
  ally_email: string;
  referred_full_name: string;
  referred_phone: string;
  referred_email?: string;
  referred_city: string;
  legal_area: string;
  case_description: string;
  urgency?: string;
  file_notes?: string;
  contact_authorization: boolean;
}

@Injectable({ providedIn: 'root' })
export class AlliesService {
  private readonly apiBase = `${APP_PUBLIC_CONFIG.apiBaseUrl || ''}/api`;

  constructor(private http: HttpClient) {}

  registerAlly(payload: AllyRegistration): Observable<any> {
    return this.http.post(`${this.apiBase}/allies`, payload);
  }

  googleAllyAuth(payload: { credential?: string; access_token?: string }): Observable<any> {
    return this.http.post(`${this.apiBase}/auth/google`, { role: 'ally', ...payload });
  }

  sendReferral(payload: ReferralSubmission): Observable<any> {
    return this.http.post(`${this.apiBase}/referrals`, payload);
  }
}
