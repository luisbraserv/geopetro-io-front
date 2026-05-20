import { CommonModule } from '@angular/common';
import { Component, computed, HostListener, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TuiIcon } from '@taiga-ui/core';
import { Store } from '@ngxs/store';

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

  protected readonly navEntries: NavEntry[] = [
    {
      kind: 'leaf',
      label: 'Dashboard',
      icon: '@tui.layout-dashboard',
      route: '/app/dashboard',
    },
    {
      kind: 'group',
      label: 'Cimentação',
      icon: '@tui.layers',
      children: [
        { kind: 'leaf', label: 'Simulador', icon: '@tui.flask-conical', route: '/app/simulador' },
        { kind: 'leaf', label: 'Químicos', icon: '@tui.package', route: '/app/quimicos' },
      ],
    },
    {
      kind: 'group',
      label: 'Administração',
      icon: '@tui.settings',
      children: [
        { kind: 'leaf', label: 'Usuário', icon: '@tui.users', route: '/app/administracao/usuarios' },
      ],
    },
  ];

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
