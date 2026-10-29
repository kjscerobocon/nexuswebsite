/**
 * TEAM ROSTER COMMAND — admin console controller for
 * /portal/team-admin.html
 *
 * SECURITY MODEL
 *   • sign-in: Supabase Auth (email + password) — no local password
 *     comparison, no sessionStorage role flags
 *   • authorization: the database allow-list (team_admins). After
 *     sign-in we call the is_team_admin() RPC; a user who is not on
 *     the list is signed out immediately. Every write additionally
 *     passes through RLS policies server-side — this UI is only a
 *     convenience layer, never the boundary.
 *   • removal: remove_team_member() RPC — roster row, linked portal
 *     deactivation and audit entry happen in ONE transaction
 *
 * All rendering uses DOM APIs (textContent / createElement) — user
 * provided values are never interpolated into innerHTML.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  rosterClient,
  supabaseConfigured,
  buildImportPayload,
  type TeamMemberRow,
  type TeamYearRow,
} from './lib/roster';
import { DEPT_LABELS, DEPT_CODES, TEAMS, type DeptKey } from './data/team-data';

/* ------------------------------------------------------------------ */
/* tiny DOM helpers                                                    */
/* ------------------------------------------------------------------ */

const $ = <T extends HTMLElement = HTMLElement>(id: string): T =>
  document.getElementById(id) as T;

const el = (tag: string, cls?: string, text?: string): HTMLElement => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

/* ------------------------------------------------------------------ */
/* state                                                               */
/* ------------------------------------------------------------------ */

const db: SupabaseClient | null = rosterClient;

let yearRows: TeamYearRow[] = [];
let memberRows: TeamMemberRow[] = [];
let linkableMembers: Array<{ id: string; name: string; is_active: boolean }> = [];
let activeYear: number | null = null;
let editingRow: TeamMemberRow | null = null;   // null → "add" mode
let editorRoles: string[] = [];                // ordered roles being edited
let pendingRemoval: TeamMemberRow | null = null;
let lastFocus: HTMLElement | null = null;

const DEPT_ORDER: DeptKey[] = ['mech', 'elec', 'embed', 'auto', 'prm', 'mentor'];

/** every role string ever used in the roster (static data + live DB rows),
 *  ranked by how often — powers the one-click suggestion chips */
function rolePool(): string[] {
  const counts = new Map<string, number>();
  const bump = (r: string): void => {
    const k = r.trim();
    if (!k) return;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  };
  Object.values(TEAMS).forEach((t) => t.members.forEach((m) => m.roles.forEach(bump)));
  memberRows.forEach((m) => (m.roles ?? []).forEach(bump));
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([role]) => role);
}

/* ------------------------------------------------------------------ */
/* boot                                                                */
/* ------------------------------------------------------------------ */

function init(): void {
  wireLogin();
  wireConsole();
  wireModals();

  if (!supabaseConfigured || !db) {
    showLoginError('This console is not configured yet — VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing. See docs/supabase-team-admin-setup.md.');
    ($('login-submit') as HTMLButtonElement).disabled = true;
    return;
  }

  // restore an existing session silently
  void db.auth.getSession().then(({ data }) => {
    if (data.session) void onSignedIn(data.session.user.email ?? data.session.user.id);
    else showLogin();
  });
}

function showLogin(): void {
  $('view-console').hidden = true;
  $('view-login').hidden = false;
}

function showLoginError(msg: string): void {
  const box = $('login-error');
  box.textContent = msg;
  box.hidden = false;
}

/* ------------------------------------------------------------------ */
/* auth                                                                */
/* ------------------------------------------------------------------ */

function wireLogin(): void {
  $('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    void handleSignIn();
  });
}

async function handleSignIn(): Promise<void> {
  if (!db) return;
  const email = ($('login-email') as HTMLInputElement).value.trim();
  const password = ($('login-password') as HTMLInputElement).value;
  const errBox = $('login-error');
  errBox.hidden = true;

  if (!email || !password) {
    showLoginError('Enter both email and password.');
    return;
  }

  setBusy($('login-submit'), true, 'AUTHENTICATING…');

  try {
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      showLoginError(error?.message === 'Invalid login credentials'
        ? 'Invalid email or password.'
        : (error?.message ?? 'Sign-in failed. Try again.'));
      return;
    }

    // allow-list check — the database decides, not this page
    const { data: allowed, error: rpcError } = await db.rpc('is_team_admin');
    if (rpcError || allowed !== true) {
      await db.auth.signOut();
      showLoginError('This account is not authorized for roster command. Ask an existing admin to add your Auth UUID to the team_admins allow-list.');
      return;
    }

    await onSignedIn(email);
  } catch (err) {
    showLoginError(err instanceof Error ? err.message : 'Sign-in failed.');
  } finally {
    setBusy($('login-submit'), false, 'AUTHENTICATE');
  }
}

async function onSignedIn(email: string): Promise<void> {
  $('view-login').hidden = true;
  $('view-console').hidden = false;
  $('admin-userline').textContent = `SIGNED IN // ${email}`;
  await loadRoster();
}

/* ------------------------------------------------------------------ */
/* data loading                                                        */
/* ------------------------------------------------------------------ */

function setStatus(text: string, tone: 'live' | 'warn' | 'error' = 'live'): void {
  $('status-text').textContent = text;
  const bar = $('status-bar');
  bar.classList.toggle('is-warn', tone === 'warn');
  bar.classList.toggle('is-error', tone === 'error');
}

async function loadRoster(): Promise<void> {
  if (!db) return;
  setStatus('LOADING ROSTER…');

  // roster (admin reads the same public tables)
  const roster = await fetchPublicRosterRaw();
  if (!roster.ok) {
    setStatus('FAILED TO LOAD ROSTER — ' + roster.error, 'error');
    return;
  }

  yearRows = roster.years;
  memberRows = roster.members;

  // linkable portal accounts (safe RPC — ids + names only)
  const { data: linkable, error: linkErr } = await db.rpc('list_linkable_members');
  if (!linkErr && Array.isArray(linkable)) {
    linkableMembers = linkable as Array<{ id: string; name: string; is_active: boolean }>;
  } else if (linkErr) {
    // non-fatal — the dropdown just stays empty
    console.warn('[team-admin] list_linkable_members failed:', linkErr.message);
  }

  renderYearRail();
  const empty = memberRows.length === 0;
  $('setup-card').hidden = !empty;
  $('console-body').hidden = empty;

  if (empty) {
    setStatus('ROSTER STORE EMPTY — RUN THE ONE-TIME IMPORT BELOW', 'warn');
  } else {
    const y = activeYear && yearRows.some((r) => r.year === activeYear)
      ? activeYear
      : (yearRows[yearRows.length - 1]?.year ?? null);
    setActiveYear(y);
    setStatus(`LINKED // ${memberRows.length} ROSTER RECORDS ON FILE`);
  }
}

/** admin fetch — raw rows plus the roster-initialized probe */
async function fetchPublicRosterRaw(): Promise<
  { ok: true; years: TeamYearRow[]; members: TeamMemberRow[] } | { ok: false; error: string }
> {
  if (!db) return { ok: false, error: 'not configured' };
  const { data, error } = await db
    .from('team_years')
    .select('id, year, label, status, team_photo_url, created_at, team_members(*)')
    .order('year', { ascending: true });
  if (error) return { ok: false, error: error.message };
  const years = (data ?? []) as unknown as Array<TeamYearRow & { team_members: TeamMemberRow[] | null }>;
  return {
    ok: true,
    years: years.map(({ team_members: _tm, ...y }) => y),
    members: years.flatMap((y) => y.team_members ?? []),
  };
}

/* ------------------------------------------------------------------ */
/* year rail + table                                                   */
/* ------------------------------------------------------------------ */

function renderYearRail(): void {
  const rail = $('year-rail');
  rail.innerHTML = '';
  yearRows
    .slice()
    .sort((a, b) => a.year - b.year)
    .forEach((y) => {
      const b = el('button', 'ta-rail-year') as HTMLButtonElement;
      b.type = 'button';
      b.textContent = String(y.year);
      b.dataset.year = String(y.year);
      const count = memberRows.filter((m) => m.team_year_id === y.id).length;
      b.setAttribute('aria-label', `${y.year} — ${count} members`);
      b.addEventListener('click', () => setActiveYear(y.year));
      rail.appendChild(b);
    });
}

function setActiveYear(year: number | null): void {
  activeYear = year;
  document.querySelectorAll('.ta-rail-year').forEach((b) => {
    const btn = b as HTMLButtonElement;
    btn.classList.toggle('is-active', Number(btn.dataset.year) === year);
    btn.setAttribute('aria-current', Number(btn.dataset.year) === year ? 'true' : 'false');
  });

  const yr = yearRows.find((r) => r.year === year);
  $('year-label-line').textContent = yr ? `${yr.status.toUpperCase()} GENERATION` : '';
  $('year-title').textContent = yr ? `${yr.year} — ${yr.label}` : '';
  renderTable();
}

function renderTable(): void {
  const tbody = $('roster-tbody');
  tbody.innerHTML = '';
  const yr = yearRows.find((r) => r.year === activeYear);
  const rows = memberRows
    .filter((m) => m.team_year_id === yr?.id)
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

  $('roster-empty').hidden = rows.length > 0;

  rows.forEach((m) => {
    const tr = el('tr', 'ta-row');

    const tdName = el('td', 'ta-td ta-td--name');
    tdName.appendChild(el('span', 'ta-td-name', m.name));
    const link = linkableMembers.find((l) => l.id === m.member_id);
    if (m.photo_url || m.photo_base) {
      tdName.appendChild(el('span', 'ta-td-meta', 'photo set'));
    }
    tr.appendChild(tdName);

    const tdRoles = el('td', 'ta-td');
    (m.roles ?? []).forEach((r) => tdRoles.appendChild(el('span', 'ta-tag', r)));
    if (!m.roles?.length) tdRoles.appendChild(el('span', 'ta-td-meta', '—'));
    tr.appendChild(tdRoles);

    const tdDept = el('td', 'ta-td');
    (m.departments ?? []).forEach((d) => {
      tdDept.appendChild(el('span', 'ta-tag ta-tag--dept', DEPT_LABELS[d as DeptKey] ?? d));
    });
    if (!m.departments?.length) tdDept.appendChild(el('span', 'ta-td-meta', '—'));
    tr.appendChild(tdDept);

    const tdTier = el('td', 'ta-td');
    tdTier.appendChild(el('span', `ta-tier ta-tier--${m.tier ?? 'member'}`, (m.tier ?? 'member').toUpperCase()));
    if (m.rank) tdTier.appendChild(el('span', 'ta-td-meta', m.rank.toUpperCase()));
    tr.appendChild(tdTier);

    const tdLink = el('td', 'ta-td');
    tdLink.appendChild(el('span', 'ta-td-meta', m.member_id ? (link ? `LINKED // ${link.name}` : 'LINKED') : '—'));
    tr.appendChild(tdLink);

    const tdAct = el('td', 'ta-td ta-td--actions');
    const editBtn = el('button', 'ta-iconbtn', 'EDIT') as HTMLButtonElement;
    editBtn.type = 'button';
    editBtn.setAttribute('aria-label', `Edit ${m.name}`);
    editBtn.addEventListener('click', () => openEditor(m));
    const rmBtn = el('button', 'ta-iconbtn ta-iconbtn--danger', 'REMOVE') as HTMLButtonElement;
    rmBtn.type = 'button';
    rmBtn.setAttribute('aria-label', `Remove ${m.name} from roster`);
    rmBtn.addEventListener('click', () => openConfirmRemove(m));
    tdAct.append(editBtn, rmBtn);
    tr.appendChild(tdAct);

    tbody.appendChild(tr);
  });
}

/* ------------------------------------------------------------------ */
/* add / edit dialog                                                   */
/* ------------------------------------------------------------------ */

function wireModals(): void {
  // ordered role editor
  wireRoleEditor();

  // member editor
  $('member-form').addEventListener('submit', (e) => {
    e.preventDefault();
    void saveMember();
  });
  $('modal-close').addEventListener('click', closeEditor);
  $('modal-cancel').addEventListener('click', closeEditor);
  $('member-modal').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeEditor();
  });

  // confirm removal
  $('confirm-cancel').addEventListener('click', closeConfirm);
  $('confirm-ok').addEventListener('click', () => void executeRemoval());
  $('confirm-modal').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeConfirm();
  });

  // backdrop click closes whichever modal is open
  $('modal-backdrop').addEventListener('click', () => {
    closeEditor();
    closeConfirm();
  });
}

function openModal(node: HTMLElement): void {
  lastFocus = document.activeElement as HTMLElement | null;
  $('modal-backdrop').hidden = false;
  node.hidden = false;
  const focusable = node.querySelector<HTMLElement>('input, select, button');
  focusable?.focus();
}

function closeModal(node: HTMLElement): void {
  node.hidden = true;
  const anyOpen = !$('member-modal').hidden || !$('confirm-modal').hidden;
  if (!anyOpen) $('modal-backdrop').hidden = true;
  lastFocus?.focus();
}

function closeEditor(): void {
  closeModal($('member-modal'));
  editingRow = null;
}

function closeConfirm(): void {
  closeModal($('confirm-modal'));
  pendingRemoval = null;
}

function buildDeptChecks(selected: DeptKey[] = []): void {
  const wrap = $('dept-checks');
  wrap.innerHTML = '';
  DEPT_ORDER.forEach((d) => {
    const label = el('label', 'ta-check');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = d;
    cb.checked = selected.includes(d);
    cb.id = `dept-${d}`;
    label.appendChild(cb);
    label.appendChild(el('span', 'ta-check-label', `${DEPT_LABELS[d]} (${DEPT_CODES[d]})`));
    wrap.appendChild(label);
  });
}

/* ------------------------------------------------------------------ */
/* ordered role editor                                                 */
/* ------------------------------------------------------------------ */

function renderRoleEditor(): void {
  const rows = $('role-rows');
  rows.innerHTML = '';

  editorRoles.forEach((role, i) => {
    const row = el('div', 'ta-role-row');
    if (i === 0) row.classList.add('is-primary');

    row.appendChild(el('span', 'ta-role-num', String(i + 1).padStart(2, '0')));

    const name = el('span', 'ta-role-name', role);
    name.title = i === 0 ? 'Primary role — displayed under the name' : '';
    row.appendChild(name);

    const upBtn = el('button', 'ta-role-ordbtn', '↑') as HTMLButtonElement;
    upBtn.type = 'button';
    upBtn.disabled = i === 0;
    upBtn.setAttribute('aria-label', `Move ${role} up`);
    upBtn.addEventListener('click', () => {
      [editorRoles[i - 1], editorRoles[i]] = [editorRoles[i], editorRoles[i - 1]];
      renderRoleEditor();
    });
    row.appendChild(upBtn);

    const downBtn = el('button', 'ta-role-ordbtn', '↓') as HTMLButtonElement;
    downBtn.type = 'button';
    downBtn.disabled = editorRoles.length < 2 || i === editorRoles.length - 1;
    downBtn.setAttribute('aria-label', `Move ${role} down`);
    downBtn.addEventListener('click', () => {
      [editorRoles[i + 1], editorRoles[i]] = [editorRoles[i], editorRoles[i + 1]];
      renderRoleEditor();
    });
    row.appendChild(downBtn);

    const xBtn = el('button', 'ta-role-x', '✕') as HTMLButtonElement;
    xBtn.type = 'button';
    xBtn.setAttribute('aria-label', `Remove ${role}`);
    xBtn.addEventListener('click', () => {
      editorRoles.splice(i, 1);
      renderRoleEditor();
    });
    row.appendChild(xBtn);

    rows.appendChild(row);
  });

  const editor = $('role-editor');
  editor.classList.toggle('is-empty', editorRoles.length === 0);
}

function roleNote(msg: string, warn = false): void {
  const note = $('role-add-note');
  if (!msg) {
    note.hidden = true;
    return;
  }
  note.textContent = msg;
  note.classList.toggle('is-warn', warn);
  note.hidden = false;
}

function addRole(raw: string, opts: { silent?: boolean } = {}): boolean {
  const role = raw.trim().replace(/\s+/g, ' ');
  if (!role) return false;
  if (role.length > 80) {
    if (!opts.silent) roleNote('Role is too long (max 80 chars).', true);
    return false;
  }
  const dup = editorRoles.find((r) => r.toLowerCase() === role.toLowerCase());
  if (dup) {
    if (!opts.silent) roleNote(`"${dup}" is already on the list.`, true);
    return false;
  }
  editorRoles.push(role);
  renderRoleEditor();
  return true;
}

function renderSuggestions(): void {
  const wrap = $('role-suggest');
  const input = $('role-add-input') as HTMLInputElement;
  const filter = input.value.trim().toLowerCase();
  const pool = rolePool().filter((r) => !editorRoles.includes(r));
  const picks = (filter
    ? pool.filter((r) => r.toLowerCase().includes(filter))
    : pool.slice(0, 8))
    .slice(0, 8);

  wrap.innerHTML = '';
  if (picks.length === 0) {
    wrap.hidden = true;
    return;
  }
  picks.forEach((r) => {
    const chip = el('button', 'ta-role-chip', r) as HTMLButtonElement;
    chip.type = 'button';
    chip.addEventListener('click', () => {
      if (addRole(r)) {
        input.value = '';
        roleNote('');
        renderSuggestions();
        input.focus();
      }
    });
    wrap.appendChild(chip);
  });
  wrap.hidden = false;
}

function wireRoleEditor(): void {
  const input = $('role-add-input') as HTMLInputElement;

  $('role-add-btn').addEventListener('click', () => {
    if (addRole(input.value)) {
      input.value = '';
      roleNote('');
      renderSuggestions();
    }
    input.focus();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();                       // never submit the form
      if (input.value.trim()) {
        if (addRole(input.value)) {
          input.value = '';
          roleNote('');
          renderSuggestions();
        }
      } else if (editorRoles.length > 0) {
        // Enter on empty input → jump to the next field
        ($('f-tier') as HTMLElement).focus();
      }
    }
  });

  input.addEventListener('input', () => {
    roleNote('');
    renderSuggestions();
  });
}

function openEditor(row: TeamMemberRow | null): void {
  if (!db) return;
  editingRow = row;

  $('modal-kicker').textContent = row ? 'EDIT ROSTER ENTRY' : 'NEW ROSTER ENTRY';
  $('modal-title').textContent = row ? `EDIT — ${row.name}` : `ADD MEMBER // ${activeYear ?? ''}`;
  $('form-error').hidden = true;

  ($('f-name') as HTMLInputElement).value = row?.name ?? '';
  editorRoles = [...(row?.roles ?? [])];
  renderRoleEditor();
  ($('role-add-input') as HTMLInputElement).value = '';
  roleNote('');
  renderSuggestions();
  ($('f-tier') as HTMLSelectElement).value = row?.tier ?? 'member';
  ($('f-rank') as HTMLSelectElement).value = row?.rank ?? '';
  ($('f-photo') as HTMLInputElement).value = row?.photo_url ?? '';
  ($('f-photo-base') as HTMLInputElement).value = row?.photo_base ?? '';
  buildDeptChecks((row?.departments ?? []) as DeptKey[]);

  // portal-link dropdown
  const linkSel = $('f-link') as HTMLSelectElement;
  linkSel.innerHTML = '';
  const noneOpt = el('option', '', '— none —') as HTMLOptionElement;
  noneOpt.value = '';
  linkSel.appendChild(noneOpt);
  linkableMembers.forEach((l) => {
    const opt = el('option', '', `${l.name}${l.is_active ? '' : ' (inactive)'}`) as HTMLOptionElement;
    opt.value = l.id;
    linkSel.appendChild(opt);
  });
  linkSel.value = row?.member_id ?? '';

  openModal($('member-modal'));
}

async function saveMember(): Promise<void> {
  if (!db) return;
  const errBox = $('form-error');
  errBox.hidden = true;

  const name = ($('f-name') as HTMLInputElement).value.trim();
  const tier = ($('f-tier') as HTMLSelectElement).value as TeamMemberRow['tier'];
  const rank = ($('f-rank') as HTMLSelectElement).value;
  const photoUrl = ($('f-photo') as HTMLInputElement).value.trim();
  const photoBase = ($('f-photo-base') as HTMLInputElement).value.trim();
  const memberId = ($('f-link') as HTMLSelectElement).value || null;
  const departments = Array.from(document.querySelectorAll<HTMLInputElement>('#dept-checks input:checked'))
    .map((c) => c.value as DeptKey);

  // ---- validation ----
  if (!name) return formError('Name is required.');
  if (name.length > 120) return formError('Name is too long (max 120).');
  if (editorRoles.length === 0) return formError('Add at least one role / designation — use the role editor.');
  if (departments.length === 0) return formError('Pick at least one department.');
  if (photoUrl && !/^https?:\/\//i.test(photoUrl)) return formError('Portrait URL must start with http:// or https://.');
  if (photoBase && !/^[a-z0-9-]+$/i.test(photoBase)) return formError('Local photo stem may only contain letters, digits and dashes.');
  if (tier !== 'core' && rank) return formError('Rank is only valid for the CORE tier — clear it or switch tier.');
  if (tier === 'mentor' && !departments.includes('mentor')) return formError('Mentors belong to the GUIDANCE department.');

  const yr = yearRows.find((r) => r.year === activeYear);
  if (!yr) return formError('Select a team year first.');

  // duplicate guard — same person, same year (case/space-insensitive)
  const dup = memberRows.find(
    (m) => m.team_year_id === yr.id
      && m.id !== editingRow?.id
      && m.name.trim().toLowerCase() === name.toLowerCase(),
  );
  if (dup) return formError(`${name} is already on the ${yr.year} roster.`);

  const payload = {
    team_year_id: yr.id,
    name,
    roles: editorRoles,
    departments,
    tier: tier ?? 'member',
    rank: rank || null,
    photo_url: photoUrl || null,
    photo_base: photoBase || null,
    member_id: memberId,
    display_order: editingRow?.display_order ?? memberRows.filter((m) => m.team_year_id === yr.id).length,
  };

  setBusy($('modal-save'), true, 'SAVING…');
  try {
    const res = editingRow
      ? await db.from('team_members').update(payload).eq('id', editingRow.id)
      : await db.from('team_members').insert(payload);
    if (res.error) {
      formError(res.error.message.includes('row-level security')
        ? 'Blocked by database policy — your account is not on the admin allow-list.'
        : res.error.message);
      return;
    }
    closeEditor();
    toast(editingRow ? `${name} updated.` : `${name} added to ${yr.year}.`);
    await loadRoster();
  } catch (err) {
    formError(err instanceof Error ? err.message : 'Save failed.');
  } finally {
    setBusy($('modal-save'), false, 'SAVE ENTRY');
  }
}

function formError(msg: string): void {
  const box = $('form-error');
  box.textContent = msg;
  box.hidden = false;
}

/* ------------------------------------------------------------------ */
/* removal                                                             */
/* ------------------------------------------------------------------ */

function openConfirmRemove(row: TeamMemberRow): void {
  pendingRemoval = row;
  $('confirm-error').hidden = true;
  $('confirm-text').textContent = `Remove ${row.name} from the ${activeYear} public roster?`;

  const list = $('confirm-effects');   // the <ul> itself
  list.innerHTML = '';
  const items = ['Their record disappears from the public Team Archive page.'];
  if (row.member_id) {
    const link = linkableMembers.find((l) => l.id === row.member_id);
    items.push(link
      ? `The linked portal account (${link.name}) is deactivated — it can no longer sign in.`
      : 'The linked portal account is deactivated — it can no longer sign in.');
    items.push('Portal profile and attendance history are preserved (never deleted).');
  }
  items.push('The removal is written to the audit log.');
  items.forEach((t) => list.appendChild(el('li', '', t)));

  openModal($('confirm-modal'));
  $('confirm-ok').focus();
}

async function executeRemoval(): Promise<void> {
  if (!db || !pendingRemoval) return;
  const row = pendingRemoval;
  const errBox = $('confirm-error');
  errBox.hidden = true;

  setBusy($('confirm-ok'), true, 'REMOVING…');
  try {
    const { data, error } = await db.rpc('remove_team_member', { p_roster_id: row.id });
    if (error) {
      errBox.textContent = error.message.includes('NOT_AUTHORIZED')
        ? 'Blocked — your account is not on the admin allow-list.'
        : error.message;
      errBox.hidden = false;
      return;
    }
    const res = (data ?? {}) as { removed?: boolean; deactivated_portal?: boolean; member_name?: string };
    closeConfirm();
    if (res.removed === false) {
      toast('Record was already gone — refreshing.', 'warn');
    } else {
      toast(
        res.deactivated_portal
          ? `${res.member_name ?? row.name} removed — linked portal account deactivated.`
          : `${res.member_name ?? row.name} removed from the roster.`,
      );
    }
    await loadRoster();
  } catch (err) {
    errBox.textContent = err instanceof Error ? err.message : 'Removal failed.';
    errBox.hidden = false;
  } finally {
    setBusy($('confirm-ok'), false, 'CONFIRM REMOVAL');
  }
}

/* ------------------------------------------------------------------ */
/* import                                                              */
/* ------------------------------------------------------------------ */

function wireConsole(): void {
  $('btn-signout').addEventListener('click', () => void signOut());
  $('btn-add').addEventListener('click', () => openEditor(null));
  $('btn-import').addEventListener('click', () => void runImport());
}

async function signOut(): Promise<void> {
  if (db) await db.auth.signOut();
  yearRows = [];
  memberRows = [];
  activeYear = null;
  showLogin();
  ($('login-password') as HTMLInputElement).value = '';
}

async function runImport(): Promise<void> {
  if (!db) return;
  const errBox = $('import-error');
  errBox.hidden = true;
  const note = $('import-note');
  note.textContent = 'Importing…';

  setBusy($('btn-import'), true, 'IMPORTING…');
  try {
    const { data, error } = await db.rpc('import_static_roster', { p_payload: buildImportPayload() });
    if (error) {
      errBox.textContent = error.message;
      errBox.hidden = false;
      note.textContent = '';
      return;
    }
    const res = (data ?? { results: [] }) as { results?: Array<{ year: number; status: string; inserted?: number }>; skipped_members?: number };
    const summary = (res.results ?? [])
      .map((r) => `${r.year}: ${r.status}${r.inserted !== undefined ? ` (${r.inserted} added)` : ''}`)
      .join(' · ');
    note.textContent = summary || 'Done.';
    toast(`Import complete — ${summary}`);
    await loadRoster();
  } catch (err) {
    errBox.textContent = err instanceof Error ? err.message : 'Import failed.';
    errBox.hidden = false;
    note.textContent = '';
  } finally {
    setBusy($('btn-import'), false, 'IMPORT STATIC ROSTER');
  }
}

/* ------------------------------------------------------------------ */
/* misc ui                                                             */
/* ------------------------------------------------------------------ */

function setBusy(btn: HTMLElement, busy: boolean, busyText: string): void {
  const label = btn.querySelector('.ta-btn-label');
  if (busy) {
    btn.setAttribute('data-busy', 'true');
    (btn as HTMLButtonElement).disabled = true;
    if (label) label.textContent = busyText;
  } else {
    btn.removeAttribute('data-busy');
    (btn as HTMLButtonElement).disabled = false;
    if (label) label.textContent = btn.id === 'login-submit' ? 'AUTHENTICATE'
      : btn.id === 'modal-save' ? 'SAVE ENTRY'
      : btn.id === 'confirm-ok' ? 'CONFIRM REMOVAL'
      : 'IMPORT STATIC ROSTER';
  }
}

let toastTimer: number | undefined;
function toast(msg: string, tone: 'ok' | 'warn' = 'ok'): void {
  const t = $('toast');
  t.textContent = msg;
  t.classList.toggle('is-warn', tone === 'warn');
  t.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { t.hidden = true; }, 4200);
}

init();
