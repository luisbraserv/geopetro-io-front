import { Routes } from '@angular/router';

import { LoginPageComponent } from './pages/login/login-page.component';
import { ShellComponent } from './shared/layout/shell/shell.component';
import { DashboardPageComponent } from './features/dashboard/pages/dashboard-page.component';
import { AcessoNegadoComponent } from './shared/pages/acesso-negado/acesso-negado.component';
import { authGuard } from './features/auth/guards/auth.guard';
import { SimuladorIndexComponent } from './features/simulador/pages/simulador-index/simulador-index.component';
import { SimuladorSqueezeComponent } from './features/simulador/pages/simulador-squeeze/simulador-squeeze.component';
import { SimuladorTampaoComponent } from './features/simulador/pages/simulador-tampao/simulador-tampao.component';
import { QuimicosPageComponent } from './features/quimicos/pages/quimicos-page/quimicos-page.component';
import { UsuariosAdminPageComponent } from './features/usuarios/pages/usuarios-admin-page/usuarios-admin-page.component';
import { MeuUsuarioPageComponent } from './features/usuarios/pages/meu-usuario-page/meu-usuario-page.component';


export const routes: Routes = [
  // Rotas públicas
  {
    path: '',
    redirectTo: '/login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    component: LoginPageComponent,
  },
  {
    path: 'acesso-negado',
    component: AcessoNegadoComponent,
  },

  // Rotas privadas — protegidas pelo authGuard
  {
    path: 'app',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        component: DashboardPageComponent,
      },
      {
        path: 'simulador',
        children: [
          { path: '', component: SimuladorIndexComponent },
          { path: 'squeeze', component: SimuladorSqueezeComponent },
          { path: 'tampao', component: SimuladorTampaoComponent },
        ],
      },
      {
        path: 'quimicos',
        component: QuimicosPageComponent,
      },
      {
        path: 'administracao/usuarios',
        component: UsuariosAdminPageComponent,
      },
      {
        path: 'meu-usuario',
        component: MeuUsuarioPageComponent,
      },
    ],
  },

  // Fallback
  {
    path: '**',
    redirectTo: '/login',
  },
];
