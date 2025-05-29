import { Routes } from '@angular/router';
import { HomeComponent } from './Pages/Home/home.component';


export const routes: Routes = [
    {path:'',component:HomeComponent},
    { path: '**', redirectTo: '', pathMatch: 'full' }

];
