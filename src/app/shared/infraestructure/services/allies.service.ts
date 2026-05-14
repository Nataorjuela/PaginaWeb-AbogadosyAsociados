import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface AllyRegistration {
  full_name: string;
  document_number: string;
  phone: string;
  email: string;
  city: string;
  ally_type: string;
  how_known?: string;
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

export interface AllyRecord {
  id: number;
  full_name: string;
  document_number: string;
  phone: string;
  email: string;
  city: string;
  ally_type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ReferralRecord {
  id: number;
  ally_name: string;
  ally_document_number: string;
  referred_full_name: string;
  referred_phone: string;
  referred_email?: string;
  referred_city: string;
  legal_area: string;
  case_description: string;
  status: string;
  created_at: string;
  updated_at: string;
}

@Injectable({ providedIn: 'root' })
export class AlliesService {
  private readonly apiBase = `${environment.apiBaseUrl || ''}/api`;

  constructor(private http: HttpClient) {}

  registerAlly(payload: AllyRegistration): Observable<any> {
    return this.http.post(`${this.apiBase}/allies`, payload);
  }

  sendReferral(payload: ReferralSubmission): Observable<any> {
    return this.http.post(`${this.apiBase}/referrals`, payload);
  }

  adminLogin(password: string): Observable<any> {
    return this.http.post(`${this.apiBase}/admin/login`, { password });
  }

  getAllies(password: string, search: string = '') {
    return this.http.get<AllyRecord[]>(`${this.apiBase}/admin/allies`, {
      headers: this.authHeaders(password),
      params: search ? { search } : {}
    });
  }

  updateAllyStatus(password: string, id: number, status: string) {
    return this.http.patch(`${this.apiBase}/admin/allies/${id}/status`, { status }, {
      headers: this.authHeaders(password)
    });
  }

  getReferrals(password: string, search: string = '') {
    return this.http.get<ReferralRecord[]>(`${this.apiBase}/admin/referrals`, {
      headers: this.authHeaders(password),
      params: search ? { search } : {}
    });
  }

  updateReferralStatus(password: string, id: number, status: string) {
    return this.http.patch(`${this.apiBase}/admin/referrals/${id}/status`, { status }, {
      headers: this.authHeaders(password)
    });
  }

  private authHeaders(password: string): HttpHeaders {
    return new HttpHeaders({ 'x-admin-password': password });
  }
}
