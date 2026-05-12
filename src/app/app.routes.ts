import { Routes } from '@angular/router';
import { HomeComponent } from './Pages/Home/home.component';
import { AdminComponent } from './Pages/Admin/admin.component';
import { AuthPortalComponent } from './Pages/AuthPortal/auth-portal.component';


export const routes: Routes = [
    {path:'',component:HomeComponent},
    {path:'admin',component:AdminComponent},
    {path:'ingresar',component:AuthPortalComponent},
    {path:'aliados/login',component:AuthPortalComponent},
    {path:'aliados/registro',component:AuthPortalComponent},
    {path:'aliados/dashboard',component:AuthPortalComponent},
    {path:'clientes/login',component:AuthPortalComponent},
    {path:'clientes/dashboard',component:AuthPortalComponent},
    {path:'admin/login',component:AuthPortalComponent},
    {path:'admin/dashboard',component:AuthPortalComponent},
    {path:'recuperar-contrasena',component:AuthPortalComponent},
    { path: '**', redirectTo: '', pathMatch: 'full' }

];
