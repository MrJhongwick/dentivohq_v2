import { Button, cn } from '@dentivohq/ui';
import { Bell, ChevronDown, HelpCircle, Menu, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { authClient } from '../../lib/auth-client';
import type { DashboardUser } from './dashboard-types';
import { initials } from './dashboard-types';

type Props = {
  user: DashboardUser;
  query: string;
  onMenu: () => void;
  onQueryChange: (value: string) => void;
  onAction: (label: string) => void;
};

export function DashboardTopbar({ user, query, onMenu, onQueryChange, onAction }: Props) {
  const [newOpen, setNewOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  return <header className="dashboard-topbar sticky top-0 flex min-h-[76px] items-center gap-3 border-b border-border bg-card px-4 lg:grid lg:grid-cols-[minmax(280px,520px)_1fr_auto] lg:gap-5 lg:px-7">
    <Button aria-label="Open navigation" className="lg:hidden" onClick={onMenu} size="sm" variant="ghost"><Menu /></Button>
    <label className="hidden h-[42px] items-center gap-2.5 rounded-[10px] border border-border px-3 text-[#91a0b8] sm:flex"><Search className="size-4" /><input aria-label="Search dashboard" className="min-w-0 flex-1 border-0 bg-transparent text-sm text-foreground outline-none" onChange={(event) => onQueryChange(event.target.value)} placeholder="Search patients, appointments, services..." value={query} /><kbd className="rounded-md border border-border bg-[#f7f9fc] px-1.5 py-0.5 text-[10px]">⌘ K</kbd></label>
    <div className="hidden lg:block" />
    <div className="ml-auto flex items-center gap-1.5 lg:gap-2">
      <div className="relative"><Button aria-expanded={newOpen} onClick={() => setNewOpen((value) => !value)}><Plus data-icon="inline-start" />New<ChevronDown data-icon="inline-end" /></Button>{newOpen ? <div className="dashboard-menu right-0 top-12 w-44">{['Book appointment', 'Add patient', 'Invite staff'].map((label) => <button key={label} onClick={() => { onAction(label); setNewOpen(false); }} type="button">{label}</button>)}</div> : null}</div>
      <Button aria-label="Notifications" className="relative" size="sm" variant="ghost"><Bell /><span className="absolute right-0.5 top-0 grid size-4 place-items-center rounded-full border-2 border-white bg-[#ef4150] text-[8px] text-white">0</span></Button>
      <Button aria-label="Help" className="hidden sm:inline-flex" onClick={() => onAction('Help')} size="sm" variant="ghost"><HelpCircle /></Button>
      <div className="relative"><button aria-expanded={profileOpen} className="flex items-center gap-2 rounded-[10px] p-1.5 text-left hover:bg-muted" onClick={() => setProfileOpen((value) => !value)} type="button"><span className="grid size-[34px] place-items-center rounded-full bg-gradient-to-br from-[#d9e6f6] to-[#8ba6c2] text-xs font-extrabold text-[#28425f]">{initials(user.name || user.email)}</span><span className="hidden max-w-36 lg:block"><strong className="block truncate text-xs">{user.name || user.email}</strong><small className="block truncate text-[10px] text-muted-foreground">Clinic team member</small></span><ChevronDown className="hidden size-4 text-muted-foreground lg:block" /></button>{profileOpen ? <div className={cn('dashboard-menu right-0 top-12 w-40')}><button onClick={() => onAction('Profile')} type="button">Profile</button><button onClick={() => void authClient.signOut()} type="button">Sign out</button></div> : null}</div>
    </div>
  </header>;
}
