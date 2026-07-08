import { Routes } from '@angular/router';
import { HomeComponent } from './Pages/Home/home.component';
import { AuthPortalComponent } from './Pages/AuthPortal/auth-portal.component';


export const routes: Routes = [
    {path:'',component:HomeComponent},
    {path:'admin',redirectTo:'admin/dashboard',pathMatch:'full'},
    {path:'ingresar',component:AuthPortalComponent},
    {path:'aliados/login',component:AuthPortalComponent},
    {path:'aliados/registro',component:AuthPortalComponent},
    {path:'aliados/dashboard',component:AuthPortalComponent},
    {path:'clientes/login',component:AuthPortalComponent},
    {path:'clientes/registro',component:AuthPortalComponent},
    {path:'clientes/dashboard',component:AuthPortalComponent},
    {path:'admin/login',component:AuthPortalComponent},
    {path:'admin/registro',component:AuthPortalComponent},
    {path:'admin/dashboard',component:AuthPortalComponent},
    {path:'recuperar-contrasena',component:AuthPortalComponent},
    {path:'restablecer-contrasena',component:AuthPortalComponent},
    { path: '**', redirectTo: '', pathMatch: 'full' }

];
