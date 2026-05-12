import { Routes } from '@angular/router';
import { HomeComponent } from './Pages/Home/home.component';
import { AdminComponent } from './Pages/Admin/admin.component';


export const routes: Routes = [
    {path:'',component:HomeComponent},
    {path:'admin',component:AdminComponent},
    { path: '**', redirectTo: '', pathMatch: 'full' }

];
