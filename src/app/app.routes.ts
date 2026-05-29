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
import { PaginaNaoEncontradaComponent } from './shared/pages/pagina-nao-encontrada/pagina-nao-encontrada.component';
import { CadastrosPageComponent } from './features/cadastros/pages/cadastros-page/cadastros-page.component';
import { EmpresasPageComponent } from './features/cadastros/pages/empresas-page/empresas-page.component';
import { SetoresPageComponent } from './features/cadastros/pages/setores-page/setores-page.component';
import { UnidadesSondasPageComponent } from './features/cadastros/pages/unidades-sondas-page/unidades-sondas-page.component';
import { ProjetosPageComponent } from './features/cadastros/pages/projetos-page/projetos-page.component';
import { ProcessosPageComponent } from './features/gerenciamento/pages/processos-page/processos-page.component';
import { ProcessoDetailPageComponent } from './features/gerenciamento/pages/processo-detail-page/processo-detail-page.component';
import { ProcessosArquivadosPageComponent } from './features/gerenciamento/pages/processos-arquivados-page/processos-arquivados-page.component';
import { ProcessosResumoPageComponent } from './features/gerenciamento/pages/processos-resumo-page/processos-resumo-page.component';


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
        canActivate: [authGuard],
        data: { roles: ['CIMENTACAO'] },
        children: [
          { path: '', component: SimuladorIndexComponent },
          { path: 'squeeze', component: SimuladorSqueezeComponent },
          { path: 'tampao', component: SimuladorTampaoComponent },
        ],
      },
      {
        path: 'quimicos',
        component: QuimicosPageComponent,
        canActivate: [authGuard],
        data: { roles: ['CIMENTACAO'] },
      },
      {
        path: 'administracao/usuarios',
        redirectTo: 'cadastros/usuarios',
        pathMatch: 'full',
      },
      {
        path: 'cadastros',
        component: CadastrosPageComponent,
        canActivate: [authGuard],
        children: [
          {
            path: '',
            redirectTo: 'projetos',
            pathMatch: 'full',
          },
          {
            path: 'usuarios',
            component: UsuariosAdminPageComponent,
            canActivate: [authGuard],
            data: { roles: ['ADMIN'] },
          },
          {
            path: 'empresas',
            component: EmpresasPageComponent,
            canActivate: [authGuard],
            data: { roles: ['ADMIN'] },
          },
          {
            path: 'setores',
            component: SetoresPageComponent,
            canActivate: [authGuard],
            data: { roles: ['ADMIN'] },
          },
          {
            path: 'unidades-sondas',
            component: UnidadesSondasPageComponent,
            canActivate: [authGuard],
            data: { roles: ['ADMIN'] },
          },
          {
            path: 'projetos',
            component: ProjetosPageComponent,
            canActivate: [authGuard],
            data: { roles: ['ADMIN', 'INTERNO'] },
          },
        ],
      },
      {
        path: 'gerenciamento/processos',
        component: ProcessosPageComponent,
      },
      {
        path: 'gerenciamento/processos/arquivados',
        component: ProcessosArquivadosPageComponent,
      },
      {
        path: 'gerenciamento/processos/:id',
        component: ProcessoDetailPageComponent,
      },
      {
        path: 'monitoramento-sondas',
        loadComponent: () =>
          import('./features/monitoramento/pages/monitoramento-sonda-page/monitoramento-sonda-page.component').then(
            (m) => m.MonitoramentoSondaPageComponent,
          ),
        canActivate: [authGuard],
      },
      {
        path: 'meu-usuario',
        component: MeuUsuarioPageComponent,
      },
      {
        path: 'configuracoes',
        loadComponent: () =>
          import('./features/configuracoes/pages/configuracoes-page/configuracoes-page.component').then(
            (m) => m.ConfiguracoesPageComponent,
          ),
        canActivate: [authGuard],
        data: { roles: ['ADMIN'] },
      },
      {
        path: '**',
        component: PaginaNaoEncontradaComponent,
      },
    ],
  },

  {
    path: 'resumo-processos',
    component: ProcessosResumoPageComponent,
    canActivate: [authGuard],
  },
  {
    path: '404',
    component: PaginaNaoEncontradaComponent,
  },

  // Fallback
  {
    path: '**',
    component: PaginaNaoEncontradaComponent,
  },
];
