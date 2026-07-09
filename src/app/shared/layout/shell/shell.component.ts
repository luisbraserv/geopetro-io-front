import { CommonModule } from '@angular/common';
import { Component, computed, HostListener, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TuiIcon } from '@taiga-ui/core';
import { Store } from '@ngxs/store';

import { AuthenticatedUser, UserRole } from '../../../features/auth/models/user.model';
import { Logout } from '../../../features/auth/state/auth.actions';
import { AuthState } from '../../../features/auth/state/auth.state';

interface NavLeaf {
  kind: 'leaf';
  label: string;
  icon: string;
  route: string;
}

interface NavGroup {
  kind: 'group';
  label: string;
  icon: string;
  children: NavLeaf[];
}

type NavEntry = NavLeaf | NavGroup;

const MOBILE_BREAKPOINT = 768;
const ALL_NAV_ENTRIES: NavEntry[] = [
  {
    kind: 'leaf',
    label: 'Dashboard',
    icon: '@tui.layout-dashboard',
    route: '/app/dashboard',
  },
  {
    kind: 'group',
    label: 'Sonda',
    icon: '@tui.activity',
    children: [
      { kind: 'leaf', label: 'Monitoramento', icon: '@tui.radio-tower', route: '/app/monitoramento-sondas' },
    ],
  },
  {
    kind: 'group',
    label: 'Cimentação',
    icon: '@tui.layers',
    children: [
      { kind: 'leaf', label: 'Simulador', icon: '@tui.flask-conical', route: '/app/simulador' },
    ],
  },
  {
    kind: 'group',
    label: 'Administração',
    icon: '@tui.shield',
    children: [
      { kind: 'leaf', label: 'Cadastros', icon: '@tui.clipboard-list', route: '/app/cadastros' },
    ],
  },
];

@Component({
  selector: 'app-shell',
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, TuiIcon],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.css',
})
export class ShellComponent {
  private readonly store = inject(Store);
  protected readonly currentUser = this.store.selectSignal(AuthState.currentUser);
  protected readonly sidebarCollapsed = signal(false);
  protected readonly mobileOpen = signal(false);
  private readonly isMobile = signal(window.innerWidth < MOBILE_BREAKPOINT);

  protected readonly showLabels = computed(
    () => (!this.sidebarCollapsed() && !this.isMobile()) || this.mobileOpen(),
  );

  protected readonly toggleIcon = computed(() => {
    if (this.isMobile()) return this.mobileOpen() ? '@tui.x' : '@tui.menu';
    return this.sidebarCollapsed() ? '@tui.chevron-right' : '@tui.chevron-left';
  });

  protected readonly navEntries = computed(() => {
    const roles = obterRolesUsuario(this.currentUser());

    return ALL_NAV_ENTRIES.filter((entry) => {
      if (entry.kind !== 'group') {
        if (entry.label === 'Dashboard') {
          return roles.includes('ADMIN');
        }

        return entry.label === 'Cadastros' ? roles.includes('ADMIN') : true;
      }

      if (entry.label === 'Administração') {
        return roles.includes('ADMIN');
      }

      if (entry.label === 'Cimentação') {
        return roles.includes('CIMENTACAO') || roles.includes('ADMIN');
      }

      if (entry.label === 'Sonda') {
        return roles.includes('SONDA') || roles.includes('ADMIN');
      }

      if (entry.label === 'Gerenciamento') {
        return roles.includes('INTERNO') || roles.includes('CIMENTACAO') || roles.includes('ADMIN');
      }

      return true;
    });
  });

  protected asGroup(e: NavEntry): NavGroup { return e as NavGroup; }
  protected asLeaf(e: NavEntry): NavLeaf { return e as NavLeaf; }

  @HostListener('window:resize')
  onResize(): void {
    this.isMobile.set(window.innerWidth < MOBILE_BREAKPOINT);
    this.mobileOpen.set(false);
  }

  protected toggleSidebar(): void {
    if (this.isMobile()) {
      this.mobileOpen.update((v) => !v);
    } else {
      this.sidebarCollapsed.update((v) => !v);
    }
  }

  protected closeMobileMenu(): void {
    this.mobileOpen.set(false);
  }

  protected logout(): void {
    this.store.dispatch(new Logout());
  }
}

function obterRolesUsuario(user: AuthenticatedUser | null): UserRole[] {
  return normalizarRoles([...(user?.roles ?? []), user?.role].filter(Boolean) as string[]);
}

function normalizarRoles(roles: string[] | undefined): UserRole[] {
  return Array.from(
    new Set(
      (roles ?? [])
        .map((role) => role.replace(/^ROLE_/i, '').toUpperCase())
        .filter(Boolean),
    ),
  ) as UserRole[];
}
