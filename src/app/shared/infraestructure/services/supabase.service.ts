import { Injectable } from '@angular/core';
import { createSupabaseBrowserClient } from '../supabase/supabase.client';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  readonly client = createSupabaseBrowserClient();
}
