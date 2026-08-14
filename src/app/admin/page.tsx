'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

// ── Types ─────────────────────────────────────────────────────────────────────
interface OverviewData {
  totalItems: number;
  totalRevenue: number;
  totalUnitsSold: number;
  inventoryValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalSuppliers: number;
  auditLogCount: number;
  activeSessionsToday: number;
}

interface AuditLog {
  id: number;
  action: string;
  entityId?: number;
  details?: string;
  role: string;
  createdAt: string;
}

interface LoginEvent {
  id: number;
  role: string;
  success: boolean;
  ip?: string;
  createdAt: string;
}

interface AdminSettings {
  storeName: string;
  userReadOnly: boolean;
  adminPasscodeConfigured: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const ACTION_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  ITEM_CREATED:          { icon: 'add_circle',           color: '#12b886', label: 'Item Created'       },
  ITEM_UPDATED:          { icon: 'edit',                  color: '#4dabf7', label: 'Item Updated'       },
  ITEM_DELETED:          { icon: 'delete',                color: '#fa5252', label: 'Item Deleted'       },
  STOCK_ADJUSTED:        { icon: 'tune',                  color: '#f59f00', label: 'Stock Adjusted'     },
  SALE_RECORDED:         { icon: 'point_of_sale',         color: '#9775fa', label: 'Sale Recorded'      },
  SUPPLIER_CREATED:      { icon: 'local_shipping',        color: '#12b886', label: 'Supplier Added'     },
  SUPPLIER_UPDATED:      { icon: 'local_shipping',        color: '#4dabf7', label: 'Supplier Updated'   },
  SUPPLIER_DELETED:      { icon: 'local_shipping',        color: '#fa5252', label: 'Supplier Deleted'   },
  SETTINGS_UPDATED:      { icon: 'settings',              color: '#a9e34b', label: 'Settings Updated'   },
  LOCK_MODE_CHANGED:     { icon: 'lock',                  color: '#f59f00', label: 'Lock Mode Changed'  },
  ADMIN_PASSCODE_CHANGED:{ icon: 'admin_panel_settings',  color: '#ff8787', label: 'Admin Passcode Changed'},
};

function getActionConfig(action: string) {
  return ACTION_CONFIG[action] || { icon: 'info', color: '#868e96', label: action };
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, accent }: { icon: string; label: string; value: string | number; sub?: string; accent: string }) {
  return (
    <div
      className="rounded-2xl p-5 relative overflow-hidden transition-all hover:-translate-y-0.5"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        transition: 'transform 0.18s ease, box-shadow 0.18s ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = `0 8px 32px rgba(0,0,0,0.3)`)}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
    >
      <div className="flex justify-between items-start mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</span>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${accent}20` }}>
          <span className="material-symbols-outlined icon-fill" style={{ fontSize: '18px', color: accent }}>{icon}</span>
        </div>
      </div>
      <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{sub}</p>}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AdminDashboardPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'overview' | 'activity' | 'sessions' | 'settings'>('overview');
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotalPages, setLogsTotalPages] = useState(1);
  const [logsFilter, setLogsFilter] = useState('');
  const [logsLoading, setLogsLoading] = useState(false);

  const [sessions, setSessions] = useState<LoginEvent[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const [adminSettings, setAdminSettings] = useState<AdminSettings | null>(null);
  const [userReadOnly, setUserReadOnly] = useState(false);
  const [lockLoading, setLockLoading] = useState(false);
  const [currentAdminPass, setCurrentAdminPass] = useState('');
  const [newAdminPass, setNewAdminPass] = useState('');
  const [confirmAdminPass, setConfirmAdminPass] = useState('');
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');
  const [passLoading, setPassLoading] = useState(false);

  const [toast, setToast] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [liveActivity, setLiveActivity] = useState<AuditLog[]>([]);
  const liveIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3200);
  }, []);

  const fetchOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const res = await fetch('/api/admin/overview');
      if (res.status === 403) { router.push('/admin/login'); return; }
      if (res.ok) setOverview(await res.json());
    } catch (e) { console.error(e); }
    finally { setOverviewLoading(false); }
  }, [router]);

  const fetchLogs = useCallback(async (page = 1, filter = '') => {
    setLogsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (filter) params.set('type', filter);
      const res = await fetch(`/api/admin/activity?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
        setLogsTotal(data.pagination.total);
        setLogsTotalPages(data.pagination.totalPages);
      }
    } catch (e) { console.error(e); }
    finally { setLogsLoading(false); }
  }, []);

  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await fetch('/api/admin/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions);
      }
    } catch (e) { console.error(e); }
    finally { setSessionsLoading(false); }
  }, []);

  const fetchAdminSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/settings');
      if (res.ok) {
        const data = await res.json();
        setAdminSettings(data);
        setUserReadOnly(data.userReadOnly);
      }
    } catch (e) { console.error(e); }
  }, []);

  const fetchLiveActivity = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/activity?page=1');
      if (res.ok) {
        const data = await res.json();
        setLiveActivity(data.logs.slice(0, 12));
      }
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    fetchOverview();
    fetchAdminSettings();
    fetchLiveActivity();
    // Start live activity polling every 15s
    liveIntervalRef.current = setInterval(fetchLiveActivity, 15000);
    return () => { if (liveIntervalRef.current) clearInterval(liveIntervalRef.current); };
  }, [fetchOverview, fetchAdminSettings, fetchLiveActivity]);

  useEffect(() => {
    if (tab === 'activity') fetchLogs(logsPage, logsFilter);
    if (tab === 'sessions') fetchSessions();
    if (tab === 'settings') fetchAdminSettings();
  }, [tab]);

  useEffect(() => {
    fetchLogs(logsPage, logsFilter);
  }, [logsPage, logsFilter]);

  const handleToggleLock = async () => {
    setLockLoading(true);
    try {
      const res = await fetch('/api/admin/lock', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userReadOnly: !userReadOnly }),
      });
      if (res.ok) {
        const data = await res.json();
        setUserReadOnly(data.userReadOnly);
        showToast(data.userReadOnly ? '🔒 System locked for users' : '🔓 System unlocked for users');
        fetchOverview();
      }
    } catch (e) { console.error(e); }
    finally { setLockLoading(false); }
  };

  const handleChangeAdminPass = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');
    if (newAdminPass !== confirmAdminPass) { setPassError('New passcodes do not match'); return; }
    if (newAdminPass.length < 6) { setPassError('Passcode must be at least 6 characters'); return; }
    setPassLoading(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentAdminPasscode: currentAdminPass, newAdminPasscode: newAdminPass }),
      });
      const data = await res.json();
      if (res.ok) {
        setPassSuccess('Admin passcode changed successfully');
        setCurrentAdminPass('');
        setNewAdminPass('');
        setConfirmAdminPass('');
        fetchAdminSettings();
      } else {
        setPassError(data.error || 'Failed to update passcode');
      }
    } catch { setPassError('Connection error'); }
    finally { setPassLoading(false); }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/admin/login');
    router.refresh();
  };

  const navItems = [
    { id: 'overview',  icon: 'dashboard',         label: 'Overview'      },
    { id: 'activity',  icon: 'history',            label: 'Audit Log'     },
    { id: 'sessions',  icon: 'person_check',       label: 'Sessions'      },
    { id: 'settings',  icon: 'admin_panel_settings',label: 'Admin Settings'},
  ] as const;

  return (
    <div className="min-h-screen flex" style={{ background: '#0d1117', color: '#e6edf3' }}>
      {/* ── Sidebar ── */}
      <aside
        className="hidden md:flex flex-col w-[240px] h-screen sticky top-0 shrink-0 py-6 px-3"
        style={{ background: 'rgba(255,255,255,0.02)', borderRight: '1px solid rgba(255,255,255,0.07)' }}
      >
        {/* Logo */}
        <div className="px-3 mb-8">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg"
              style={{ background: 'linear-gradient(135deg, #364fc7 0%, #1971c2 100%)' }}
            >
              <span className="material-symbols-outlined icon-fill text-white" style={{ fontSize: '20px' }}>shield_person</span>
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white leading-tight">Admin Panel</h1>
              <p className="text-[10px] font-medium uppercase tracking-wide leading-tight" style={{ color: 'rgba(255,255,255,0.35)' }}>StockKeep</p>
            </div>
          </div>
          <div
            className="mt-3 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider w-fit"
            style={{ background: 'rgba(224,49,49,0.12)', color: '#fa5252', border: '1px solid rgba(224,49,49,0.25)' }}
          >
            Administrator
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 flex flex-col gap-1">
          {navItems.map(({ id, icon, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: tab === id ? 'rgba(76,110,245,0.15)' : 'transparent',
                color: tab === id ? '#748ffc' : 'rgba(255,255,255,0.5)',
                border: tab === id ? '1px solid rgba(76,110,245,0.25)' : '1px solid transparent',
              }}
              onMouseEnter={(e) => { if (tab !== id) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}}
              onMouseLeave={(e) => { if (tab !== id) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}}
            >
              <span className={`material-symbols-outlined ${tab === id ? 'icon-fill' : ''}`} style={{ fontSize: '20px' }}>{icon}</span>
              <span className="flex-1 text-left">{label}</span>
            </button>
          ))}

          <div className="mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <a
              href="/"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all"
              style={{ color: 'rgba(255,255,255,0.4)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>storefront</span>
              <span>Go to Store App</span>
            </a>
          </div>
        </nav>

        {/* Lock mode indicator */}
        <div className="mt-2 mx-1 mb-3 px-3 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined icon-fill" style={{ fontSize: '16px', color: userReadOnly ? '#fa5252' : '#51cf66' }}>
                {userReadOnly ? 'lock' : 'lock_open'}
              </span>
              <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>Lock Mode</span>
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: userReadOnly ? 'rgba(250,82,82,0.15)' : 'rgba(81,207,102,0.12)', color: userReadOnly ? '#fa5252' : '#51cf66' }}>
              {userReadOnly ? 'ON' : 'OFF'}
            </span>
          </div>
        </div>

        {/* Logout */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all"
            style={{ color: 'rgba(255,255,255,0.4)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(250,82,82,0.08)'; e.currentTarget.style.color = '#fa5252'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>logout</span>
            Logout
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header
          className="sticky top-0 z-30 flex items-center justify-between px-6 md:px-8 h-16 shrink-0"
          style={{ background: 'rgba(13,17,23,0.9)', borderBottom: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)' }}
        >
          <div className="flex items-center gap-3">
            <div className="md:hidden w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #364fc7 0%, #1971c2 100%)' }}>
              <span className="material-symbols-outlined icon-fill text-white" style={{ fontSize: '16px' }}>shield_person</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {tab === 'overview' ? 'System Overview' : tab === 'activity' ? 'Audit Log' : tab === 'sessions' ? 'Session Monitor' : 'Admin Settings'}
              </h2>
              <p className="text-xs hidden md:block" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {tab === 'overview' ? 'Real-time system monitoring dashboard' : tab === 'activity' ? 'Full history of all system actions' : tab === 'sessions' ? 'Login history & active sessions' : 'Admin configuration & security'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: 'rgba(76,110,245,0.12)', color: '#748ffc', border: '1px solid rgba(76,110,245,0.2)' }}>
              Admin
            </div>
            <button
              onClick={fetchOverview}
              className="p-2 rounded-full transition-colors"
              style={{ color: 'rgba(255,255,255,0.4)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
              title="Refresh"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>refresh</span>
            </button>
          </div>
        </header>

        {/* Toast */}
        {toastVisible && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] anim-fade-up">
            <div className="px-5 py-3 rounded-xl text-sm font-medium flex items-center gap-2 whitespace-nowrap" style={{ background: '#1e293b', color: '#e2e8f0', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <span className="material-symbols-outlined icon-fill text-emerald-400" style={{ fontSize: '18px' }}>check_circle</span>
              {toast}
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-8">

          {/* ═══ OVERVIEW TAB ═══════════════════════════════════════════════ */}
          {tab === 'overview' && (
            <div className="space-y-6 anim-fade-up">
              {/* KPI Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {overviewLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="rounded-2xl p-5 h-28 skeleton" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.06)' }} />
                  ))
                ) : (
                  <>
                    <KpiCard icon="inventory_2"   label="Total Products"       value={overview?.totalItems ?? 0}                           sub="Items in inventory"          accent="#4dabf7" />
                    <KpiCard icon="payments"       label="Total Revenue"        value={`$${(overview?.totalRevenue ?? 0).toFixed(2)}`}       sub="All sales combined"          accent="#12b886" />
                    <KpiCard icon="account_balance_wallet" label="Inventory Value" value={`$${(overview?.inventoryValue ?? 0).toFixed(2)}`} sub="Stock × unit price"          accent="#9775fa" />
                    <KpiCard icon="shopping_bag"  label="Units Sold"           value={overview?.totalUnitsSold ?? 0}                        sub="All time"                    accent="#f59f00" />
                    <KpiCard icon="warning"        label="Low Stock Alerts"     value={overview?.lowStockCount ?? 0}                         sub="Below threshold"             accent="#ff6b6b" />
                    <KpiCard icon="remove_shopping_cart" label="Out of Stock"  value={overview?.outOfStockCount ?? 0}                       sub="Zero quantity items"         accent="#fa5252" />
                    <KpiCard icon="local_shipping" label="Suppliers"           value={overview?.totalSuppliers ?? 0}                        sub="Active suppliers"            accent="#a9e34b" />
                    <KpiCard icon="person_check"   label="Sessions Today"      value={overview?.activeSessionsToday ?? 0}                   sub="Successful logins"           accent="#74c0fc" />
                  </>
                )}
              </div>

              {/* Lock Mode & Live Feed side-by-side */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Lock Control */}
                <div
                  className="rounded-2xl p-6"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined icon-fill" style={{ fontSize: '20px', color: '#f59f00' }}>lock</span>
                    <h3 className="text-sm font-bold text-white">User Lock Mode</h3>
                  </div>
                  <p className="text-xs mb-5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    When enabled, regular users cannot add, edit, delete items, record sales, or adjust stock. Admins are never affected.
                  </p>

                  {/* Big Toggle */}
                  <div className="flex items-center justify-between p-4 rounded-xl mb-4" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${userReadOnly ? 'rgba(250,82,82,0.3)' : 'rgba(81,207,102,0.2)'}` }}>
                    <div>
                      <p className="text-sm font-bold" style={{ color: userReadOnly ? '#fa5252' : '#51cf66' }}>
                        {userReadOnly ? '🔒 System Locked' : '🔓 System Open'}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        {userReadOnly ? 'Users in read-only mode' : 'Users have full access'}
                      </p>
                    </div>
                    <button
                      onClick={handleToggleLock}
                      disabled={lockLoading}
                      className="relative w-14 h-7 rounded-full transition-all duration-300 focus:outline-none"
                      style={{
                        background: userReadOnly ? '#fa5252' : '#51cf66',
                        boxShadow: userReadOnly ? '0 0 12px rgba(250,82,82,0.4)' : '0 0 12px rgba(81,207,102,0.3)',
                      }}
                    >
                      <span
                        className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300"
                        style={{ left: userReadOnly ? '32px' : '2px' }}
                      />
                    </button>
                  </div>

                  <p className="text-[11px] text-center" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    Changes take effect immediately system-wide
                  </p>
                </div>

                {/* Live Activity Feed */}
                <div
                  className="lg:col-span-2 rounded-2xl p-6"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <h3 className="text-sm font-bold text-white">Live Activity Feed</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(18,184,134,0.12)', color: '#12b886' }}>AUTO-REFRESH 15s</span>
                    </div>
                    <button
                      onClick={fetchLiveActivity}
                      className="text-xs px-3 py-1 rounded-lg transition-colors"
                      style={{ color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
                    >
                      Refresh
                    </button>
                  </div>

                  {liveActivity.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10" style={{ color: 'rgba(255,255,255,0.2)' }}>
                      <span className="material-symbols-outlined mb-2" style={{ fontSize: '40px' }}>history</span>
                      <p className="text-sm">No activity yet. Actions will appear here.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[280px] overflow-y-auto">
                      {liveActivity.map((log) => {
                        const cfg = getActionConfig(log.action);
                        return (
                          <div
                            key={log.id}
                            className="flex items-center gap-3 p-3 rounded-xl transition-colors"
                            style={{ background: 'rgba(255,255,255,0.025)' }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
                          >
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${cfg.color}18` }}>
                              <span className="material-symbols-outlined icon-fill" style={{ fontSize: '16px', color: cfg.color }}>{cfg.icon}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-white truncate">{cfg.label}</p>
                              {log.entityId && <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>ID #{log.entityId}</p>}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>{timeAgo(log.createdAt)}</p>
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: log.role === 'admin' ? 'rgba(116,143,252,0.15)' : 'rgba(255,255,255,0.06)', color: log.role === 'admin' ? '#748ffc' : 'rgba(255,255,255,0.4)' }}>
                                {log.role.toUpperCase()}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ═══ AUDIT LOG TAB ══════════════════════════════════════════════ */}
          {tab === 'activity' && (
            <div className="space-y-4 anim-fade-up">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="relative flex-1 max-w-xs">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2" style={{ fontSize: '18px', color: 'rgba(255,255,255,0.3)' }}>filter_list</span>
                  <select
                    value={logsFilter}
                    onChange={(e) => { setLogsFilter(e.target.value); setLogsPage(1); }}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: logsFilter ? '#e6edf3' : 'rgba(255,255,255,0.4)', outline: 'none' }}
                  >
                    <option value="">All Actions</option>
                    {Object.entries(ACTION_CONFIG).map(([key, cfg]) => (
                      <option key={key} value={key}>{cfg.label}</option>
                    ))}
                  </select>
                </div>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>{logsTotal} total entries</p>
              </div>

              <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="grid grid-cols-12 gap-2 px-4 py-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <span className="col-span-4">Action</span>
                  <span className="col-span-2 hidden md:block">Entity</span>
                  <span className="col-span-3 hidden md:block">Details</span>
                  <span className="col-span-2">Role</span>
                  <span className="col-span-3 md:col-span-1">Time</span>
                </div>

                {logsLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <span className="material-symbols-outlined anim-spin" style={{ fontSize: '32px', color: '#748ffc' }}>refresh</span>
                  </div>
                ) : logs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16" style={{ color: 'rgba(255,255,255,0.2)' }}>
                    <span className="material-symbols-outlined mb-2" style={{ fontSize: '40px' }}>history</span>
                    <p className="text-sm">No audit log entries yet</p>
                  </div>
                ) : (
                  logs.map((log, i) => {
                    const cfg = getActionConfig(log.action);
                    let detailsStr = '';
                    if (log.details) {
                      try { const d = JSON.parse(log.details); detailsStr = Object.entries(d).map(([k, v]) => `${k}: ${v}`).join(', '); }
                      catch { detailsStr = log.details; }
                    }
                    return (
                      <div
                        key={log.id}
                        className="grid grid-cols-12 gap-2 px-4 py-3.5 items-center transition-colors"
                        style={{ borderBottom: i < logs.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <div className="col-span-4 flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${cfg.color}18` }}>
                            <span className="material-symbols-outlined icon-fill" style={{ fontSize: '14px', color: cfg.color }}>{cfg.icon}</span>
                          </div>
                          <span className="text-xs font-semibold text-white truncate">{cfg.label}</span>
                        </div>
                        <span className="col-span-2 text-xs hidden md:block" style={{ color: 'rgba(255,255,255,0.4)' }}>
                          {log.entityId ? `#${log.entityId}` : '—'}
                        </span>
                        <span className="col-span-3 text-[11px] hidden md:block truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>
                          {detailsStr || '—'}
                        </span>
                        <span className="col-span-2">
                          <span className="text-[10px] px-2 py-1 rounded-full font-bold" style={{ background: log.role === 'admin' ? 'rgba(116,143,252,0.15)' : 'rgba(255,255,255,0.05)', color: log.role === 'admin' ? '#748ffc' : 'rgba(255,255,255,0.5)' }}>
                            {log.role.toUpperCase()}
                          </span>
                        </span>
                        <span className="col-span-3 md:col-span-1 text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          {timeAgo(log.createdAt)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Pagination */}
              {logsTotalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    onClick={() => setLogsPage(p => Math.max(1, p - 1))}
                    disabled={logsPage === 1}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                    style={{ background: 'rgba(255,255,255,0.06)', color: logsPage === 1 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)', cursor: logsPage === 1 ? 'not-allowed' : 'pointer' }}
                  >← Prev</button>
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Page {logsPage} / {logsTotalPages}</span>
                  <button
                    onClick={() => setLogsPage(p => Math.min(logsTotalPages, p + 1))}
                    disabled={logsPage === logsTotalPages}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                    style={{ background: 'rgba(255,255,255,0.06)', color: logsPage === logsTotalPages ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)', cursor: logsPage === logsTotalPages ? 'not-allowed' : 'pointer' }}
                  >Next →</button>
                </div>
              )}
            </div>
          )}

          {/* ═══ SESSIONS TAB ═══════════════════════════════════════════════ */}
          {tab === 'sessions' && (
            <div className="space-y-4 anim-fade-up">
              <div className="flex items-center justify-between">
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>{sessions.length} recent login events</p>
                <button
                  onClick={fetchSessions}
                  className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
                >
                  Refresh
                </button>
              </div>

              <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="grid grid-cols-4 px-4 py-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <span>Role</span>
                  <span>Status</span>
                  <span>IP Address</span>
                  <span>Time</span>
                </div>

                {sessionsLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <span className="material-symbols-outlined anim-spin" style={{ fontSize: '32px', color: '#748ffc' }}>refresh</span>
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16" style={{ color: 'rgba(255,255,255,0.2)' }}>
                    <span className="material-symbols-outlined mb-2" style={{ fontSize: '40px' }}>person_off</span>
                    <p className="text-sm">No session history yet</p>
                  </div>
                ) : (
                  sessions.map((s, i) => (
                    <div
                      key={s.id}
                      className="grid grid-cols-4 px-4 py-3.5 items-center transition-colors"
                      style={{ borderBottom: i < sessions.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined icon-fill" style={{ fontSize: '16px', color: s.role === 'admin' ? '#748ffc' : '#868e96' }}>
                          {s.role === 'admin' ? 'shield_person' : 'person'}
                        </span>
                        <span className="text-xs font-semibold" style={{ color: s.role === 'admin' ? '#748ffc' : 'rgba(255,255,255,0.7)' }}>
                          {s.role.charAt(0).toUpperCase() + s.role.slice(1)}
                        </span>
                      </div>
                      <span>
                        <span
                          className="text-[10px] px-2 py-1 rounded-full font-bold"
                          style={{
                            background: s.success ? 'rgba(18,184,134,0.12)' : 'rgba(250,82,82,0.12)',
                            color: s.success ? '#12b886' : '#fa5252',
                          }}
                        >
                          {s.success ? '✓ Success' : '✗ Failed'}
                        </span>
                      </span>
                      <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        {s.ip || 'Unknown'}
                      </span>
                      <div>
                        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{timeAgo(s.createdAt)}</p>
                        <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>{formatDate(s.createdAt)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ═══ SETTINGS TAB ═══════════════════════════════════════════════ */}
          {tab === 'settings' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 anim-fade-up">
              {/* Lock Mode Card */}
              <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined icon-fill" style={{ fontSize: '20px', color: '#f59f00' }}>lock</span>
                  <h3 className="text-sm font-bold text-white">User Lock Mode</h3>
                </div>
                <p className="text-xs mb-5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  Prevent regular users from making any changes to the system. All write operations will be blocked with an error message.
                </p>

                <div className="flex items-center justify-between p-4 rounded-xl mb-3" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${userReadOnly ? 'rgba(250,82,82,0.3)' : 'rgba(81,207,102,0.2)'}` }}>
                  <div>
                    <p className="text-sm font-bold" style={{ color: userReadOnly ? '#fa5252' : '#51cf66' }}>
                      {userReadOnly ? 'System is LOCKED' : 'System is OPEN'}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {userReadOnly ? 'Regular users are in read-only mode' : 'Regular users have full write access'}
                    </p>
                  </div>
                  <button
                    onClick={handleToggleLock}
                    disabled={lockLoading}
                    className="relative w-14 h-7 rounded-full transition-all duration-300"
                    style={{ background: userReadOnly ? '#fa5252' : '#51cf66', boxShadow: userReadOnly ? '0 0 12px rgba(250,82,82,0.4)' : '0 0 12px rgba(81,207,102,0.3)' }}
                  >
                    <span className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300" style={{ left: userReadOnly ? '32px' : '2px' }} />
                  </button>
                </div>
              </div>

              {/* Change Admin Passcode */}
              <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined icon-fill" style={{ fontSize: '20px', color: '#748ffc' }}>admin_panel_settings</span>
                  <h3 className="text-sm font-bold text-white">Change Admin Passcode</h3>
                </div>
                <p className="text-xs mb-5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  Update the admin passcode. Must be at least 6 characters. You will need the current passcode to confirm the change.
                </p>

                <form onSubmit={handleChangeAdminPass} className="space-y-3">
                  {[
                    { id: 'cur', label: 'Current Admin Passcode', value: currentAdminPass, setter: setCurrentAdminPass },
                    { id: 'new', label: 'New Admin Passcode',     value: newAdminPass,     setter: setNewAdminPass     },
                    { id: 'con', label: 'Confirm New Passcode',   value: confirmAdminPass, setter: setConfirmAdminPass  },
                  ].map(({ id, label, value, setter }) => (
                    <div key={id}>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</label>
                      <input
                        type="password"
                        value={value}
                        onChange={(e) => setter(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl text-sm transition-all"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#e6edf3', outline: 'none' }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = '#748ffc'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(116,143,252,0.15)'; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.boxShadow = 'none'; }}
                      />
                    </div>
                  ))}

                  {passError && <p className="text-xs font-medium" style={{ color: '#fa5252' }}>{passError}</p>}
                  {passSuccess && <p className="text-xs font-medium" style={{ color: '#12b886' }}>{passSuccess}</p>}

                  <button
                    type="submit"
                    disabled={passLoading}
                    className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all"
                    style={{
                      background: passLoading ? 'rgba(116,143,252,0.4)' : 'linear-gradient(135deg, #364fc7 0%, #1971c2 100%)',
                      boxShadow: passLoading ? 'none' : '0 4px 16px rgba(76,110,245,0.3)',
                      cursor: passLoading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {passLoading ? 'Updating…' : 'Update Admin Passcode'}
                  </button>
                </form>
              </div>

              {/* Info card */}
              <div className="lg:col-span-2 rounded-2xl p-5" style={{ background: 'rgba(116,143,252,0.06)', border: '1px solid rgba(116,143,252,0.15)' }}>
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined icon-fill shrink-0 mt-0.5" style={{ fontSize: '18px', color: '#748ffc' }}>info</span>
                  <div>
                    <p className="text-sm font-semibold text-white mb-1">Admin Access Information</p>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      Admin login is available at <span className="font-mono text-[#748ffc]">/admin/login</span>. Admins are granted both
                      user and admin cookies — they have full access to the main system and this admin panel simultaneously.
                      The admin passcode is hashed at rest (scrypt) and is never transmitted or displayed in plain text.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

        </main>

        {/* Mobile Bottom Nav */}
        <nav
          className="md:hidden flex items-center justify-around px-2 pb-safe sticky bottom-0 z-30"
          style={{ background: 'rgba(13,17,23,0.95)', borderTop: '1px solid rgba(255,255,255,0.07)', height: '60px', backdropFilter: 'blur(12px)' }}
        >
          {navItems.map(({ id, icon, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="flex flex-col items-center gap-0.5 flex-1 py-2 transition-colors"
              style={{ color: tab === id ? '#748ffc' : 'rgba(255,255,255,0.35)' }}
            >
              <span className={`material-symbols-outlined ${tab === id ? 'icon-fill' : ''}`} style={{ fontSize: '22px' }}>{icon}</span>
              <span className="text-[9px] font-semibold">{label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
