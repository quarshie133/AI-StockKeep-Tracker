'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface StockMovement {
  id: number;
  type: string;
  quantity: number;
  note?: string;
  createdAt: string;
}

interface Sale {
  id: number;
  itemId: number;
  quantity: number;
  unitPrice: number;
  total: number;
  note?: string;
  soldAt: string;
  item?: { id: number; name: string; sku: string; category: string };
}

interface Supplier {
  id: number;
  name: string;
  contact?: string;
  phone?: string;
  email?: string;
  address?: string;
  _count?: { items: number };
}

interface Item {
  id: number;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  threshold: number;
  price: number;
  location?: string;
  description?: string;
  expiresAt?: string;
  supplierId?: number;
  supplier?: Supplier;
  updatedAt: string;
  movements?: StockMovement[];
  sales?: Sale[];
}

interface Settings {
  id: number;
  storeName: string;
  notifyEmail: boolean;
  emailAddress?: string;
  resendApiKeyConfigured?: boolean;
  passcodeConfigured?: boolean;
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ item }: { item: Item }) {
  if (item.quantity === 0)
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
        Out of Stock
      </span>
    );
  if (item.quantity < item.threshold)
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Low Stock
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      Healthy
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-[#f0f1f2]">
      <td className="py-4 px-6">
        <div className="skeleton h-4 w-36 mb-2" />
        <div className="skeleton h-3 w-20" />
      </td>
      <td className="py-4 px-6 hidden sm:table-cell"><div className="skeleton h-3.5 w-20" /></td>
      <td className="py-4 px-6 text-right"><div className="skeleton h-4 w-8 ml-auto" /></td>
      <td className="py-4 px-6"><div className="skeleton h-5 w-20 rounded-full" /></td>
      <td className="py-4 px-6" />
    </tr>
  );
}

// ── Main Page Component ──────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [stats, setStats] = useState({ total: 0, lowStock: 0, outOfStock: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'lowstock' | 'sales' | 'suppliers' | 'reports' | 'settings' | 'add' | 'detail'>('dashboard');
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  // New modules states
  const [sales, setSales] = useState<Sale[]>([]);
  const [salesSummary, setSalesSummary] = useState({ totalRevenue: 0, totalUnitsSold: 0 });
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [reportsData, setReportsData] = useState<any>(null);
  const [settingsData, setSettingsData] = useState<Settings>({ id: 1, storeName: 'StockKeep Store', notifyEmail: false, emailAddress: '', resendApiKeyConfigured: false, passcodeConfigured: true });
  // Write-only edit buffers: the server never sends back the real passcode
  // or Resend API key (see Technical_Debt_Plan.pdf, TD-06), so these start
  // blank and are only sent to the server when the user actually types a
  // new value — an empty field means "leave unchanged."
  const [newPasscode, setNewPasscode] = useState('');
  const [newResendApiKey, setNewResendApiKey] = useState('');

  // ── Role & Lock State ───────────────────────────────────────────────────────
  const [isAdmin, setIsAdmin] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);

  // ── Analytics State ─────────────────────────────────────────────────────────
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // ── AI State ────────────────────────────────────────────────────────────────
  const [aiInsights, setAiInsights] = useState<any>(null);
  const [aiInsightsLoading, setAiInsightsLoading] = useState(false);
  const [aiForecast, setAiForecast] = useState<any>(null);
  const [aiForecastLoading, setAiForecastLoading] = useState(false);
  const [aiDescLoading, setAiDescLoading] = useState(false);
  // Chat
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'model'; content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Modals
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustType, setAdjustType] = useState<'IN' | 'OUT'>('IN');
  const [adjustQty, setAdjustQty] = useState(1);
  const [adjustNote, setAdjustNote] = useState('');
  const [adjustError, setAdjustError] = useState('');

  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [saleItemId, setSaleItemId] = useState<number>(0);
  const [saleQty, setSaleQty] = useState(1);
  const [salePrice, setSalePrice] = useState(0);
  const [saleNote, setSaleNote] = useState('');
  const [saleError, setSaleError] = useState('');

  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [supplierFormData, setSupplierFormData] = useState({ id: 0, name: '', contact: '', phone: '', email: '', address: '' });
  const [supplierError, setSupplierError] = useState('');

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);

  // Item form data
  const [formData, setFormData] = useState({
    id: 0, name: '', category: 'General',
    quantity: 0, threshold: 5, price: 0, location: '', description: '',
    supplierId: '', expiresAt: '',
  });
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3200);
  }, []);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/items?search=${encodeURIComponent(search)}`);
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      setItems(data.items || []);
      setStats(data.stats || { total: 0, lowStock: 0, outOfStock: 0 });
      if (selectedItem) {
        const updated = data.items?.find((i: Item) => i.id === selectedItem.id);
        if (updated) setSelectedItem(updated);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, selectedItem, router]);

  const fetchSales = async () => {
    try {
      const res = await fetch('/api/sales');
      if (res.ok) {
        const data = await res.json();
        setSales(data.sales || []);
        setSalesSummary(data.summary || { totalRevenue: 0, totalUnitsSold: 0 });
      }
    } catch (err) { console.error(err); }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await fetch('/api/suppliers');
      if (res.ok) {
        setSuppliers(await res.json());
      }
    } catch (err) { console.error(err); }
  };

  const fetchReports = async () => {
    try {
      const res = await fetch('/api/reports/summary');
      if (res.ok) {
        setReportsData(await res.json());
      }
    } catch (err) { console.error(err); }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        setSettingsData(await res.json());
      }
    } catch (err) { console.error(err); }
  };

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const res = await fetch('/api/analytics');
      if (res.ok) setAnalyticsData(await res.json());
    } catch (err) { console.error(err); }
    finally { setAnalyticsLoading(false); }
  };

  const fetchAiInsights = async () => {
    setAiInsightsLoading(true);
    try {
      const res = await fetch('/api/ai/insights');
      if (res.ok) setAiInsights(await res.json());
    } catch (err) { console.error(err); }
    finally { setAiInsightsLoading(false); }
  };

  const fetchAiForecast = async (itemId: number) => {
    setAiForecast(null);
    setAiForecastLoading(true);
    try {
      const res = await fetch(`/api/ai/forecast/${itemId}`);
      if (res.ok) setAiForecast(await res.json());
    } catch (err) { console.error(err); }
    finally { setAiForecastLoading(false); }
  };

  const handleGenerateDescription = async () => {
    if (!formData.name.trim()) return;
    setAiDescLoading(true);
    try {
      const res = await fetch('/api/ai/describe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formData.name, category: formData.category }),
      });
      if (res.ok) {
        const { description } = await res.json();
        setFormData((prev) => ({ ...prev, description }));
        showToast('✨ AI description generated!');
      }
    } catch (err) { console.error(err); }
    finally { setAiDescLoading(false); }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    const newHistory = [...chatMessages, { role: 'user' as const, content: userMsg }];
    setChatMessages(newHistory);
    setChatLoading(true);
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, history: chatMessages }),
      });
      if (res.ok) {
        const { reply } = await res.json();
        setChatMessages([...newHistory, { role: 'model', content: reply }]);
      } else {
        setChatMessages([...newHistory, { role: 'model', content: '⚠️ Sorry, I could not process that request. Please try again.' }]);
      }
    } catch {
      setChatMessages([...newHistory, { role: 'model', content: '⚠️ Connection error. Please check your API configuration.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, [search]);

  useEffect(() => {
    if (activeTab === 'dashboard') fetchAnalytics();
    if (activeTab === 'sales') fetchSales();
    if (activeTab === 'suppliers') fetchSuppliers();
    if (activeTab === 'reports') fetchReports();
    if (activeTab === 'settings') fetchSettings();
    if (activeTab === 'inventory' && !aiInsights) fetchAiInsights();
  }, [activeTab]);

  useEffect(() => {
    fetchAnalytics();
    fetchSuppliers();
    fetchSettings();
    fetchAiInsights();
    // Fetch role / lock mode
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => {
      if (d) { setIsAdmin(d.role === 'admin'); setIsReadOnly(d.readOnly); }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const openForm = (itemToEdit?: Item) => {
    if (itemToEdit) {
      setFormData({
        id: itemToEdit.id,
        name: itemToEdit.name,
        category: itemToEdit.category || 'General',
        quantity: itemToEdit.quantity,
        threshold: itemToEdit.threshold,
        price: itemToEdit.price,
        location: itemToEdit.location || '',
        description: itemToEdit.description || '',
        supplierId: itemToEdit.supplierId ? String(itemToEdit.supplierId) : '',
        expiresAt: itemToEdit.expiresAt ? new Date(itemToEdit.expiresAt).toISOString().split('T')[0] : '',
      });
    } else {
      setFormData({ id: 0, name: '', category: 'General', quantity: 0, threshold: 5, price: 0, location: '', description: '', supplierId: '', expiresAt: '' });
    }
    setFormError('');
    setActiveTab('add');
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { setFormError('Item name is required'); return; }
    setFormError('');
    try {
      const url = formData.id ? `/api/items/${formData.id}` : '/api/items';
      const method = formData.id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name, category: formData.category,
          quantity: Number(formData.quantity), threshold: Number(formData.threshold),
          price: Number(formData.price), location: formData.location, description: formData.description,
          supplierId: formData.supplierId ? Number(formData.supplierId) : null,
          expiresAt: formData.expiresAt || null,
        }),
      });
      const result = await res.json();
      if (!res.ok) { setFormError(result.error || 'Failed to save item'); return; }
      showToast(formData.id ? '✓ Item updated' : '✓ Item added to inventory');
      fetchItems();
      if (formData.id) { setSelectedItem(result); setActiveTab('detail'); }
      else setActiveTab('inventory');
    } catch { setFormError('Failed to connect to server'); }
  };

  const openAdjust = (type: 'IN' | 'OUT', item?: Item) => {
    const target = item || selectedItem;
    if (!target) return;
    setSelectedItem(target);
    setAdjustType(type);
    setAdjustQty(1);
    setAdjustNote('');
    setAdjustError('');
    setAdjustModalOpen(true);
  };

  const handleAdjustStock = async () => {
    if (!selectedItem) return;
    setAdjustError('');
    try {
      const res = await fetch(`/api/items/${selectedItem.id}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: adjustType, quantity: Number(adjustQty), note: adjustNote }),
      });
      const data = await res.json();
      if (!res.ok) { setAdjustError(data.error || 'Failed to adjust stock'); return; }
      setAdjustModalOpen(false);
      showToast(data.message || '✓ Stock adjusted');
      fetchItems();
      const updatedRes = await fetch(`/api/items/${selectedItem.id}`);
      if (updatedRes.ok) setSelectedItem(await updatedRes.json());
    } catch { setAdjustError('Failed to adjust stock'); }
  };

  const openRecordSale = (item?: Item) => {
    const target = item || selectedItem || items[0];
    if (target) {
      setSaleItemId(target.id);
      setSalePrice(target.price);
    }
    setSaleQty(1);
    setSaleNote('');
    setSaleError('');
    setSaleModalOpen(true);
  };

  const handleRecordSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaleError('');
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: saleItemId, quantity: saleQty, unitPrice: salePrice, note: saleNote }),
      });
      const data = await res.json();
      if (!res.ok) { setSaleError(data.error || 'Failed to record sale'); return; }
      setSaleModalOpen(false);
      showToast(data.message || '✓ Sale recorded!');
      fetchItems();
      if (activeTab === 'sales') fetchSales();
    } catch { setSaleError('Failed to record sale'); }
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierFormData.name.trim()) { setSupplierError('Supplier name is required'); return; }
    setSupplierError('');
    try {
      const url = supplierFormData.id ? `/api/suppliers/${supplierFormData.id}` : '/api/suppliers';
      const method = supplierFormData.id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(supplierFormData),
      });
      if (!res.ok) {
        const err = await res.json();
        setSupplierError(err.error || 'Failed to save supplier');
        return;
      }
      setSupplierModalOpen(false);
      showToast(supplierFormData.id ? '✓ Supplier updated' : '✓ Supplier added');
      fetchSuppliers();
    } catch { setSupplierError('Failed to save supplier'); }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: Record<string, unknown> = {
        storeName: settingsData.storeName,
        notifyEmail: settingsData.notifyEmail,
        emailAddress: settingsData.emailAddress,
      };
      // Only send the passcode/API key if the user actually typed a new
      // value — an empty edit buffer means "keep the current one."
      if (newPasscode.trim() !== '') payload.passcode = newPasscode.trim();
      if (newResendApiKey.trim() !== '') payload.resendApiKey = newResendApiKey.trim();

      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setSettingsData(await res.json());
        setNewPasscode('');
        setNewResendApiKey('');
        showToast('✓ Settings updated successfully');
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'Error saving settings');
      }
    } catch { showToast('Error saving settings'); }
  };

  const handleDeleteItem = async () => {
    if (!selectedItem) return;
    try {
      const res = await fetch(`/api/items/${selectedItem.id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteModalOpen(false);
        showToast('Item deleted from inventory');
        fetchItems();
        setActiveTab('inventory');
      }
    } catch (err) { console.error(err); }
  };

  const downloadCSV = () => {
    const headers = ['ID', 'SKU', 'Name', 'Category', 'Quantity', 'Threshold', 'Price ($)', 'Location'];
    const rows = items.map((i) => [i.id, i.sku, `"${i.name}"`, `"${i.category}"`, i.quantity, i.threshold, i.price, `"${i.location || ''}"`]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `StockKeep_Inventory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const alertCount = stats.lowStock + stats.outOfStock;
  const lowStockItems = items.filter((i) => i.quantity < i.threshold);

  const NavItem = ({ tab, icon, label, badge }: { tab: string; icon: string; label: string; badge?: number }) => (
    <button
      onClick={() => {
        if (tab === 'add') openForm();
        else setActiveTab(tab as typeof activeTab);
      }}
      className={`nav-btn w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold ${activeTab === tab ? 'active' : 'text-[#4a5551]'}`}
    >
      <span className={`material-symbols-outlined ${activeTab === tab ? 'icon-fill' : ''}`} style={{ fontSize: '22px' }}>{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="bg-amber-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
          {badge}
        </span>
      )}
    </button>
  );

  return (
    <div className="min-h-screen flex bg-[#f4f5f6] text-[#191c1d]">
      {/* Toast */}
      {toastVisible && (
        <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[9999] anim-fade-up">
          <div className="bg-[#191c1d] text-white px-5 py-3 rounded-xl text-sm font-medium shadow-2xl flex items-center gap-2 whitespace-nowrap">
            <span className="material-symbols-outlined icon-fill text-emerald-400" style={{ fontSize: '18px' }}>check_circle</span>
            {toast}
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="bg-white border-r border-[#eaeceb] w-[240px] hidden md:flex flex-col py-6 px-3 sticky top-0 h-screen shrink-0 z-20">
        <div className="mb-8 px-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0f6e56] to-[#005440] flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined icon-fill text-[#9aedcf]" style={{ fontSize: '20px' }}>inventory_2</span>
            </div>
            <div>
              <h1 className="text-base font-bold text-[#191c1d] tracking-tight leading-tight">{settingsData.storeName || 'StockKeep'}</h1>
              <p className="text-[10px] text-[#9aafaa] font-medium uppercase tracking-wide leading-tight">Inventory System</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 flex flex-col gap-1 overflow-y-auto">
          <NavItem tab="dashboard" icon="dashboard" label="Dashboard" />
          <NavItem tab="inventory" icon="inventory_2" label="Inventory" />
          <NavItem tab="lowstock" icon="warning" label="Low Stock" badge={alertCount} />
          <NavItem tab="sales" icon="point_of_sale" label="Sales & Orders" />
          <NavItem tab="suppliers" icon="local_shipping" label="Suppliers" />
          <NavItem tab="reports" icon="bar_chart" label="Reports" />
          <NavItem tab="settings" icon="settings" label="Settings" />
          <NavItem tab="add" icon="add_circle" label="Add Item" />
        </nav>

        <div className="pt-4 border-t border-[#eaeceb] mt-2">
          {isAdmin && (
            <a
              href="/admin"
              className="nav-btn w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-[#4a5551] mb-1"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>admin_panel_settings</span>
              Admin Panel
            </a>
          )}
          <button onClick={() => setLogoutModalOpen(true)} className="nav-btn w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-[#4a5551]">
            <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>logout</span>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-0">
        {/* Desktop Header */}
        <header className="hidden md:flex bg-white border-b border-[#eaeceb] sticky top-0 z-30 justify-between items-center px-8 h-16 shrink-0">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9aafaa]">search</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search inventory..."
                className="w-full pl-10 pr-4 py-2.5 bg-[#f4f5f6] border border-[#eaeceb] rounded-xl text-sm text-[#191c1d] placeholder:text-[#b0bab5]"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 ml-4">
            <button
              onClick={() => openRecordSale()}
              className="btn-primary px-4 py-2 text-sm font-semibold rounded-xl flex items-center gap-1.5 shadow-sm"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>shopping_cart_checkout</span>
              Record Sale
            </button>
            <button onClick={() => setLogoutModalOpen(true)} className="w-9 h-9 flex items-center justify-center text-[#6b7775] hover:bg-[#f4f5f6] rounded-full">
              <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>logout</span>
            </button>
          </div>
        </header>

        {/* Mobile Header */}
        <header className="md:hidden bg-white border-b border-[#eaeceb] sticky top-0 z-40 flex items-center px-4 h-14 shrink-0 gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0f6e56] to-[#005440] flex items-center justify-center shadow-sm">
            <span className="material-symbols-outlined icon-fill text-[#9aedcf]" style={{ fontSize: '16px' }}>inventory_2</span>
          </div>
          <span className="text-base font-bold text-[#191c1d] tracking-tight flex-1">{settingsData.storeName || 'StockKeep'}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => openRecordSale()} className="p-2 text-[#005440] hover:bg-emerald-50 rounded-full">
              <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>shopping_cart_checkout</span>
            </button>
            <button onClick={() => setLogoutModalOpen(true)} className="p-2 text-[#6b7775] hover:bg-gray-100 rounded-full">
              <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>logout</span>
            </button>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {/* Read-Only Banner */}
          {isReadOnly && !isAdmin && (
            <div className="mb-5 flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold anim-fade-up" style={{ background: 'rgba(250,82,82,0.08)', border: '1px solid rgba(250,82,82,0.25)', color: '#dc2626' }}>
              <span className="material-symbols-outlined icon-fill" style={{ fontSize: '20px' }}>lock</span>
              <span>System is in <strong>read-only mode</strong>. Contact your administrator to make changes.</span>
            </div>
          )}
          {/* ═══ ANALYTICS DASHBOARD TAB ═════════════════════ */}
          {activeTab === 'dashboard' && (
            <div className="anim-fade-up space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-[#191c1d] tracking-tight">Analytics Dashboard</h2>
                  <p className="text-sm text-[#8a9490] mt-0.5">Real-time store performance & stock intelligence</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { fetchAnalytics(); fetchAiInsights(); }}
                    disabled={analyticsLoading}
                    className="btn-ghost px-3.5 py-2 text-xs font-semibold rounded-xl flex items-center gap-1.5 bg-white shadow-sm"
                  >
                    <span className={`material-symbols-outlined ${analyticsLoading ? 'animate-spin' : ''}`} style={{ fontSize: '16px' }}>refresh</span>
                    Refresh Data
                  </button>
                  <button onClick={() => openRecordSale()} className="btn-primary px-4 py-2 text-xs md:text-sm font-semibold rounded-xl flex items-center gap-1.5">
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>shopping_cart_checkout</span>
                    New Sale
                  </button>
                </div>
              </div>

              {/* Pinned AI Recommendation Banner */}
              {aiInsights?.recommendation && (
                <div className="bg-gradient-to-r from-[#0a3d2e] to-[#005440] rounded-2xl p-4 text-white shadow-md flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[#9aedcf] icon-fill" style={{ fontSize: '22px' }}>auto_awesome</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-[#9aedcf] uppercase tracking-wider bg-white/10 px-2 py-0.5 rounded-full">AI Recommendation</span>
                      </div>
                      <p className="text-xs md:text-sm font-medium text-white/90 mt-1">{aiInsights.recommendation}</p>
                    </div>
                  </div>
                  <button onClick={() => setChatOpen(true)} className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-[#9aedcf] text-[#005440] rounded-xl text-xs font-bold shrink-0 hover:bg-white transition-colors">
                    Ask AI <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
                  </button>
                </div>
              )}

              {/* 🏆 Hero KPI Row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-[#0f6e56] to-[#005440] text-white rounded-2xl p-5 shadow-sm relative overflow-hidden">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-medium text-[#9aedcf] uppercase tracking-wider">Total Revenue</span>
                    <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[#9aedcf] icon-fill" style={{ fontSize: '18px' }}>payments</span>
                    </div>
                  </div>
                  <p className="text-2xl md:text-3xl font-bold tracking-tight">
                    ${analyticsData?.kpis?.totalRevenue ? analyticsData.kpis.totalRevenue.toFixed(2) : '0.00'}
                  </p>
                  <p className="text-[11px] text-[#9aedcf]/70 mt-1">All sales transactions</p>
                </div>

                <div className="bg-white border border-[#eaeceb] rounded-2xl p-5 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-medium text-[#8a9490] uppercase tracking-wider">Inventory Value</span>
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#005440] flex items-center justify-center">
                      <span className="material-symbols-outlined icon-fill" style={{ fontSize: '18px' }}>account_balance_wallet</span>
                    </div>
                  </div>
                  <p className="text-2xl md:text-3xl font-bold text-[#191c1d] tracking-tight">
                    ${analyticsData?.kpis?.inventoryValue ? analyticsData.kpis.inventoryValue.toFixed(2) : '0.00'}
                  </p>
                  <p className="text-[11px] text-[#8a9490] mt-1">Stock quantity × unit price</p>
                </div>

                <div className="bg-white border border-[#eaeceb] rounded-2xl p-5 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-medium text-[#8a9490] uppercase tracking-wider">Total Products</span>
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <span className="material-symbols-outlined icon-fill" style={{ fontSize: '18px' }}>inventory</span>
                    </div>
                  </div>
                  <p className="text-2xl md:text-3xl font-bold text-[#191c1d] tracking-tight">
                    {analyticsData?.kpis?.totalItems ?? stats.total}
                  </p>
                  <p className="text-[11px] text-[#8a9490] mt-1">SKUs in database</p>
                </div>

                <div className="bg-white border border-[#eaeceb] rounded-2xl p-5 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-medium text-[#8a9490] uppercase tracking-wider">Units Sold</span>
                    <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                      <span className="material-symbols-outlined icon-fill" style={{ fontSize: '18px' }}>shopping_bag</span>
                    </div>
                  </div>
                  <p className="text-2xl md:text-3xl font-bold text-[#191c1d] tracking-tight">
                    {analyticsData?.kpis?.unitsSold ?? 0}
                  </p>
                  <p className="text-[11px] text-[#8a9490] mt-1">Items fulfilled</p>
                </div>
              </div>

              {/* 📈 Section 2: Charts Grid (Revenue Trend + Stock Health) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 14-day Revenue Trend Bar Chart */}
                <div className="lg:col-span-2 bg-white border border-[#eaeceb] rounded-2xl p-6 shadow-sm flex flex-col">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="font-bold text-[#191c1d] text-base">Sales & Revenue Trend</h3>
                      <p className="text-xs text-[#8a9490]">Daily sales activity over the past 14 days</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[#6b7775]">
                      <span className="w-3 h-3 rounded-sm bg-[#005440]" />
                      <span>Revenue ($)</span>
                    </div>
                  </div>

                  {/* Chart Bars */}
                  {analyticsData?.revenueByDay ? (
                    <div className="flex-1 min-h-[200px] flex items-end gap-2 pt-6 border-b border-[#f0f1f2] pb-2 px-2">
                      {(() => {
                        const maxRev = Math.max(...analyticsData.revenueByDay.map((d: any) => d.revenue), 10);
                        return analyticsData.revenueByDay.map((d: any) => {
                          const heightPct = Math.max(Math.round((d.revenue / maxRev) * 100), 4);
                          const dayLabel = new Date(d.date).toLocaleDateString(undefined, { weekday: 'narrow', month: 'numeric', day: 'numeric' });
                          return (
                            <div key={d.date} className="flex-1 flex flex-col items-center gap-2 group relative">
                              {/* Tooltip */}
                              <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-[#191c1d] text-white text-[10px] py-1 px-2 rounded-lg pointer-events-none whitespace-nowrap z-20 shadow-lg">
                                {d.date}: ${d.revenue.toFixed(2)} ({d.count} sales)
                              </div>
                              <div className="w-full bg-[#f4f5f6] rounded-t-lg h-[160px] flex items-end overflow-hidden">
                                <div
                                  className="w-full bg-gradient-to-t from-[#0f6e56] to-[#005440] rounded-t-lg transition-all duration-500 bar-grow-h"
                                  style={{ height: `${heightPct}%`, '--bar-height': `${heightPct}%` } as React.CSSProperties}
                                />
                              </div>
                              <span className="text-[10px] font-medium text-[#8a9490] truncate max-w-full">{dayLabel}</span>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  ) : (
                    <div className="h-[200px] flex items-center justify-center text-xs text-[#9aafaa]">Loading trend chart...</div>
                  )}
                </div>

                {/* Stock Health Donut & Ratios */}
                <div className="bg-white border border-[#eaeceb] rounded-2xl p-6 shadow-sm flex flex-col">
                  <h3 className="font-bold text-[#191c1d] text-base mb-1">Stock Health Status</h3>
                  <p className="text-xs text-[#8a9490] mb-6">Inventory status distribution</p>

                  {analyticsData?.stockHealth ? (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-6">
                      {/* Conic Gradient Donut */}
                      <div className="relative w-36 h-36 rounded-full flex items-center justify-center shadow-inner" style={{
                        background: (() => {
                          const { healthy, lowStock, outOfStock, total } = analyticsData.stockHealth;
                          if (!total) return '#e5e7eb';
                          const hPct = (healthy / total) * 100;
                          const lPct = (lowStock / total) * 100;
                          return `conic-gradient(#059669 0% ${hPct}%, #d97706 ${hPct}% ${hPct + lPct}%, #dc2626 ${hPct + lPct}% 100%)`;
                        })()
                      }}>
                        <div className="w-24 h-24 rounded-full bg-white flex flex-col items-center justify-center shadow-sm">
                          <span className="text-2xl font-bold text-[#191c1d]">{analyticsData.stockHealth.total}</span>
                          <span className="text-[10px] text-[#8a9490] uppercase font-semibold">Total Items</span>
                        </div>
                      </div>

                      {/* Legend */}
                      <div className="w-full space-y-2 text-xs">
                        <div className="flex justify-between items-center p-2 rounded-xl bg-emerald-50 text-emerald-800 font-semibold">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                            <span>Healthy Stock</span>
                          </div>
                          <span>{analyticsData.stockHealth.healthy}</span>
                        </div>
                        <div className="flex justify-between items-center p-2 rounded-xl bg-amber-50 text-amber-800 font-semibold">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
                            <span>Low Stock</span>
                          </div>
                          <span>{analyticsData.stockHealth.lowStock}</span>
                        </div>
                        <div className="flex justify-between items-center p-2 rounded-xl bg-red-50 text-red-800 font-semibold">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
                            <span>Out of Stock</span>
                          </div>
                          <span>{analyticsData.stockHealth.outOfStock}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-[200px] flex items-center justify-center text-xs text-[#9aafaa]">Loading health status...</div>
                  )}
                </div>
              </div>

              {/* 📊 Section 3: Categories & Top Products 2-Column Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Category Breakdown */}
                <div className="bg-white border border-[#eaeceb] rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-[#191c1d] text-base">Category Performance</h3>
                      <p className="text-xs text-[#8a9490]">Share of total inventory value by category</p>
                    </div>
                    <span className="material-symbols-outlined text-[#8a9490]" style={{ fontSize: '20px' }}>category</span>
                  </div>

                  <div className="space-y-4">
                    {analyticsData?.categoryBreakdown?.map((cat: any) => (
                      <div key={cat.category} className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-[#191c1d]">{cat.category} <span className="text-[#8a9490] font-normal">({cat.count} items)</span></span>
                          <span className="text-[#005440] font-bold">${cat.totalValue.toFixed(2)} ({cat.pct}%)</span>
                        </div>
                        <div className="w-full h-2.5 bg-[#f4f5f6] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-[#0f6e56] to-[#005440] rounded-full transition-all duration-700 bar-grow-w"
                            style={{ width: `${cat.pct}%`, '--bar-width': `${cat.pct}%` } as React.CSSProperties}
                          />
                        </div>
                      </div>
                    ))}
                    {(!analyticsData?.categoryBreakdown || analyticsData.categoryBreakdown.length === 0) && (
                      <p className="text-xs text-[#9aafaa] py-4 text-center">No categories found.</p>
                    )}
                  </div>
                </div>

                {/* Top 5 Products */}
                <div className="bg-white border border-[#eaeceb] rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-[#191c1d] text-base">Top Products by Revenue</h3>
                      <p className="text-xs text-[#8a9490]">Best performing items in your shop</p>
                    </div>
                    <span className="material-symbols-outlined text-amber-500 icon-fill" style={{ fontSize: '20px' }}>workspace_premium</span>
                  </div>

                  <div className="space-y-3">
                    {analyticsData?.topProducts?.map((prod: any, idx: number) => (
                      <div key={prod.sku} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#f8f9fa] transition-colors border border-transparent hover:border-[#eaeceb]">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                          idx === 0 ? 'bg-amber-100 text-amber-800' : idx === 1 ? 'bg-gray-100 text-gray-700' : 'bg-orange-50 text-orange-700'
                        }`}>
                          #{idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-[#191c1d] truncate">{prod.name}</p>
                          <p className="text-[10px] text-[#9aafaa] font-mono">{prod.sku} · {prod.unitsSold} units sold</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold text-emerald-700">${prod.revenue.toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                    {(!analyticsData?.topProducts || analyticsData.topProducts.length === 0) && (
                      <p className="text-xs text-[#9aafaa] py-4 text-center">No sales recorded yet to calculate top products.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* 🕐 Section 4: Recent Store Activity Feed */}
              <div className="bg-white border border-[#eaeceb] rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-[#191c1d] text-base">Recent Store Activity</h3>
                    <p className="text-xs text-[#8a9490]">Live timeline of stock movements & sales</p>
                  </div>
                  <span className="material-symbols-outlined text-[#8a9490]" style={{ fontSize: '20px' }}>history</span>
                </div>

                <div className="divide-y divide-[#f0f1f2]">
                  {analyticsData?.recentActivity?.map((act: any, idx: number) => (
                    <div key={idx} className="py-3 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                          act.type === 'SALE' ? 'bg-emerald-100 text-emerald-800' : act.type === 'IN' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {act.type === 'SALE' ? '💰' : act.type === 'IN' ? '📥' : '📤'}
                        </span>
                        <div>
                          <p className="font-semibold text-[#191c1d]">
                            {act.type === 'SALE' ? `Sale: ${act.itemName}` : `${act.type === 'IN' ? 'Stock In' : 'Stock Out'}: ${act.itemName}`}
                          </p>
                          <p className="text-[10px] text-[#9aafaa]">{act.note}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-bold text-[#191c1d] block">{act.quantity} units</span>
                        <span className="text-[10px] text-[#9aafaa]">{new Date(act.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  ))}
                  {(!analyticsData?.recentActivity || analyticsData.recentActivity.length === 0) && (
                    <p className="text-xs text-[#9aafaa] py-4 text-center">No recent activity logged.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ═══ INVENTORY TAB ═══════════════════════════════ */}
          {activeTab === 'inventory' && (
            <div className="anim-fade-up">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-[#191c1d] tracking-tight">Inventory Overview</h2>
                  <p className="text-sm text-[#8a9490] mt-0.5">{stats.total} items in stock</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={downloadCSV} className="btn-ghost px-3 py-2 text-xs font-semibold rounded-xl flex items-center gap-1">
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>download</span>
                    Export CSV
                  </button>
                  <button onClick={() => openForm()} className="btn-primary hidden md:flex items-center gap-2 px-4 py-2 text-sm rounded-xl">
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                    New Item
                  </button>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-3 md:gap-5 mb-6">
                <div className="stat-card bg-white border border-[#eaeceb] rounded-2xl p-4 md:p-5 shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-[#005440]/10 flex items-center justify-center text-[#005440] mb-2">
                    <span className="material-symbols-outlined icon-fill" style={{ fontSize: '20px' }}>widgets</span>
                  </div>
                  <p className="text-xs text-[#8a9490] font-medium">Total Items</p>
                  <p className="text-2xl font-bold text-[#191c1d]">{stats.total}</p>
                </div>
                <div onClick={() => setActiveTab('lowstock')} className="stat-card bg-white border border-[#eaeceb] rounded-2xl p-4 md:p-5 shadow-sm cursor-pointer hover:border-amber-300">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 mb-2">
                    <span className="material-symbols-outlined icon-fill" style={{ fontSize: '20px' }}>warning</span>
                  </div>
                  <p className="text-xs text-[#8a9490] font-medium">Low Stock</p>
                  <p className="text-2xl font-bold text-amber-600">{stats.lowStock}</p>
                </div>
                <div className="stat-card bg-white border border-[#eaeceb] rounded-2xl p-4 md:p-5 shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600 mb-2">
                    <span className="material-symbols-outlined icon-fill" style={{ fontSize: '20px' }}>production_quantity_limits</span>
                  </div>
                  <p className="text-xs text-[#8a9490] font-medium">Out of Stock</p>
                  <p className="text-2xl font-bold text-red-600">{stats.outOfStock}</p>
                </div>
              </div>

              {/* ── AI Insights Card ───────────────────────────── */}
              <div className="mb-6 bg-gradient-to-br from-[#0a3d2e] to-[#005440] rounded-2xl p-5 shadow-lg relative overflow-hidden">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #9aedcf 0%, transparent 60%)' }} />
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-[#9aedcf] icon-fill" style={{ fontSize: '18px' }}>auto_awesome</span>
                      </div>
                      <div>
                        <h3 className="text-white font-bold text-sm">AI Inventory Insights</h3>
                        <p className="text-[#9aedcf]/70 text-[10px]">Powered by Gemini</p>
                      </div>
                    </div>
                    <button
                      onClick={() => fetchAiInsights()}
                      disabled={aiInsightsLoading}
                      className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                      title="Refresh insights"
                    >
                      <span className={`material-symbols-outlined ${aiInsightsLoading ? 'animate-spin' : ''}`} style={{ fontSize: '16px' }}>refresh</span>
                    </button>
                  </div>

                  {aiInsightsLoading && (
                    <div className="space-y-2">
                      {[1,2,3].map(i => <div key={i} className="h-3 bg-white/10 rounded-full animate-pulse" style={{ width: `${70 + i * 10}%` }} />)}
                    </div>
                  )}

                  {!aiInsightsLoading && aiInsights && (
                    <div className="space-y-3">
                      {aiInsights.urgentAlerts?.length > 0 && (
                        <div className="space-y-1.5">
                          {aiInsights.urgentAlerts.map((a: string, i: number) => (
                            <div key={i} className="flex items-start gap-2 bg-red-500/20 border border-red-400/30 rounded-xl px-3 py-2">
                              <span className="material-symbols-outlined text-red-300 icon-fill shrink-0" style={{ fontSize: '14px' }}>error</span>
                              <span className="text-red-100 text-xs font-medium">{a}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="space-y-1.5">
                        {aiInsights.insights?.map((ins: string, i: number) => (
                          <div key={i} className="flex items-start gap-2">
                            <span className="text-[#9aedcf] text-xs mt-0.5">•</span>
                            <span className="text-white/80 text-xs">{ins}</span>
                          </div>
                        ))}
                      </div>
                      {aiInsights.recommendation && (
                        <div className="mt-3 pt-3 border-t border-white/10">
                          <p className="text-[10px] font-semibold text-[#9aedcf] uppercase tracking-wider mb-1">Today&apos;s Priority Action</p>
                          <p className="text-white text-xs font-medium">{aiInsights.recommendation}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {!aiInsightsLoading && !aiInsights && (
                    <p className="text-white/50 text-xs">Click refresh to generate AI insights for your inventory.</p>
                  )}
                </div>
              </div>

              {/* Table */}
              <div className="bg-white border border-[#eaeceb] rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[550px]">
                    <thead>
                      <tr className="border-b border-[#f0f1f2] bg-[#f8f9fa]">
                        <th className="py-3.5 px-5 text-[11px] font-semibold text-[#8a9490] uppercase tracking-wider">Item Name</th>
                        <th className="py-3.5 px-5 text-[11px] font-semibold text-[#8a9490] uppercase tracking-wider hidden sm:table-cell">Category</th>
                        <th className="py-3.5 px-5 text-[11px] font-semibold text-[#8a9490] uppercase tracking-wider text-right">Qty</th>
                        <th className="py-3.5 px-5 text-[11px] font-semibold text-[#8a9490] uppercase tracking-wider">Status</th>
                        <th className="py-3.5 px-5 text-[11px] font-semibold text-[#8a9490] uppercase tracking-wider text-right hidden md:table-cell">Price</th>
                        <th className="py-3.5 px-5 text-[11px] font-semibold text-[#8a9490] uppercase tracking-wider text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0f1f2] text-sm">
                      {loading
                        ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                        : items.map((item) => (
                          <tr key={item.id} onClick={() => { setSelectedItem(item); setActiveTab('detail'); }} className="inventory-row">
                            <td className="py-4 px-5">
                              <div className="font-semibold text-[#191c1d]">{item.name}</div>
                              <div className="text-xs text-[#9aafaa] font-mono">{item.sku} {item.supplier ? `• ${item.supplier.name}` : ''}</div>
                            </td>
                            <td className="py-4 px-5 text-[#6b7775] hidden sm:table-cell">{item.category}</td>
                            <td className="py-4 px-5 text-right font-bold text-base tabular-nums">{item.quantity}</td>
                            <td className="py-4 px-5"><StatusBadge item={item} /></td>
                            <td className="py-4 px-5 text-right font-medium text-[#6b7775] hidden md:table-cell">${item.price.toFixed(2)}</td>
                            <td className="py-4 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                              <button onClick={() => openRecordSale(item)} className="p-1.5 text-[#005440] hover:bg-emerald-50 rounded-lg">
                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>shopping_cart</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ═══ SALES TAB ═══════════════════════════════════ */}
          {activeTab === 'sales' && (
            <div className="anim-fade-up">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-[#191c1d]">Sales & Transactions</h2>
                  <p className="text-sm text-[#8a9490]">Track revenue and order logs</p>
                </div>
                <button onClick={() => openRecordSale()} className="btn-primary px-4 py-2 text-sm rounded-xl flex items-center gap-1.5">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                  Record Sale
                </button>
              </div>

              {/* Sales KPI */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-white border border-[#eaeceb] rounded-2xl p-5 shadow-sm">
                  <p className="text-xs text-[#8a9490] font-medium uppercase tracking-wider mb-1">Total Sales Revenue</p>
                  <p className="text-3xl font-bold text-[#005440]">${salesSummary.totalRevenue.toFixed(2)}</p>
                </div>
                <div className="bg-white border border-[#eaeceb] rounded-2xl p-5 shadow-sm">
                  <p className="text-xs text-[#8a9490] font-medium uppercase tracking-wider mb-1">Total Units Sold</p>
                  <p className="text-3xl font-bold text-[#191c1d]">{salesSummary.totalUnitsSold} <span className="text-sm text-[#8a9490]">units</span></p>
                </div>
              </div>

              {/* Sales List */}
              <div className="bg-white border border-[#eaeceb] rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#f0f1f2] bg-[#f8f9fa]">
                      <th className="py-3 px-5 text-xs font-semibold text-[#8a9490]">Date</th>
                      <th className="py-3 px-5 text-xs font-semibold text-[#8a9490]">Item Sold</th>
                      <th className="py-3 px-5 text-xs font-semibold text-[#8a9490] text-right">Qty</th>
                      <th className="py-3 px-5 text-xs font-semibold text-[#8a9490] text-right">Unit Price</th>
                      <th className="py-3 px-5 text-xs font-semibold text-[#8a9490] text-right">Total ($)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0f1f2] text-sm">
                    {sales.map((s) => (
                      <tr key={s.id}>
                        <td className="py-3.5 px-5 text-xs text-[#8a9490]">{new Date(s.soldAt).toLocaleString()}</td>
                        <td className="py-3.5 px-5 font-semibold text-[#191c1d]">{s.item?.name || `Item #${s.itemId}`}</td>
                        <td className="py-3.5 px-5 text-right font-bold">{s.quantity}</td>
                        <td className="py-3.5 px-5 text-right text-[#6b7775]">${s.unitPrice.toFixed(2)}</td>
                        <td className="py-3.5 px-5 text-right font-bold text-emerald-700">${s.total.toFixed(2)}</td>
                      </tr>
                    ))}
                    {sales.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-[#9aafaa]">No sales recorded yet. Click "Record Sale" to start logging transactions.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ═══ SUPPLIERS TAB ═══════════════════════════════ */}
          {activeTab === 'suppliers' && (
            <div className="anim-fade-up">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-[#191c1d]">Supplier Directory</h2>
                  <p className="text-sm text-[#8a9490]">Manage vendors and reordering contacts</p>
                </div>
                <button onClick={() => { setSupplierFormData({ id: 0, name: '', contact: '', phone: '', email: '', address: '' }); setSupplierModalOpen(true); }} className="btn-primary px-4 py-2 text-sm rounded-xl flex items-center gap-1.5">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                  Add Supplier
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {suppliers.map((sup) => (
                  <div key={sup.id} className="bg-white border border-[#eaeceb] rounded-2xl p-5 shadow-sm space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-[#191c1d] text-lg">{sup.name}</h3>
                        {sup.contact && <p className="text-xs text-[#8a9490]">Contact: {sup.contact}</p>}
                      </div>
                      <span className="bg-emerald-50 text-[#005440] text-xs font-semibold px-2.5 py-1 rounded-full">
                        {sup._count?.items || 0} items linked
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-[#6b7775]">
                      {sup.phone && (
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>phone</span>
                          <a href={`tel:${sup.phone}`} className="hover:underline font-semibold text-[#005440]">{sup.phone}</a>
                        </div>
                      )}
                      {sup.email && (
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>mail</span>
                          <a href={`mailto:${sup.email}`} className="hover:underline text-[#005440]">{sup.email}</a>
                        </div>
                      )}
                      {sup.address && (
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>location_on</span>
                          <span>{sup.address}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ REPORTS TAB ═════════════════════════════════ */}
          {activeTab === 'reports' && reportsData && (
            <div className="anim-fade-up space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-[#191c1d]">Reports & Analytics</h2>
                  <p className="text-sm text-[#8a9490]">Inventory value, category breakdown, and slow-moving stock</p>
                </div>
                <button onClick={downloadCSV} className="btn-primary px-4 py-2 text-sm rounded-xl flex items-center gap-1.5">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>download</span>
                  Export Inventory CSV
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white border border-[#eaeceb] rounded-2xl p-5 shadow-sm">
                  <p className="text-xs text-[#8a9490] font-medium uppercase mb-1">Total Inventory Value</p>
                  <p className="text-2xl font-bold text-[#005440]">${reportsData.summary?.totalInventoryValue.toFixed(2)}</p>
                </div>
                <div className="bg-white border border-[#eaeceb] rounded-2xl p-5 shadow-sm">
                  <p className="text-xs text-[#8a9490] font-medium uppercase mb-1">Total Stock Units</p>
                  <p className="text-2xl font-bold text-[#191c1d]">{reportsData.summary?.totalStockUnits}</p>
                </div>
                <div className="bg-white border border-[#eaeceb] rounded-2xl p-5 shadow-sm">
                  <p className="text-xs text-[#8a9490] font-medium uppercase mb-1">Total Sales Revenue</p>
                  <p className="text-2xl font-bold text-emerald-700">${reportsData.summary?.totalRevenue.toFixed(2)}</p>
                </div>
                <div className="bg-white border border-[#eaeceb] rounded-2xl p-5 shadow-sm">
                  <p className="text-xs text-[#8a9490] font-medium uppercase mb-1">Dead Stock Items</p>
                  <p className="text-2xl font-bold text-amber-600">{reportsData.summary?.deadStockCount}</p>
                </div>
              </div>

              {/* Dead stock table */}
              <div className="bg-white border border-[#eaeceb] rounded-2xl p-5 shadow-sm">
                <h3 className="font-bold text-[#191c1d] text-base mb-3">Slow Moving / Dead Stock (Unsold Items)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-[#f0f1f2]">
                        <th className="py-2 px-4 text-xs font-semibold text-[#8a9490]">Item Name</th>
                        <th className="py-2 px-4 text-xs font-semibold text-[#8a9490]">Category</th>
                        <th className="py-2 px-4 text-xs font-semibold text-[#8a9490] text-right">Qty</th>
                        <th className="py-2 px-4 text-xs font-semibold text-[#8a9490] text-right">Tied Value ($)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0f1f2]">
                      {reportsData.deadStock?.map((ds: any) => (
                        <tr key={ds.id}>
                          <td className="py-3 px-4 font-semibold text-[#191c1d]">{ds.name}</td>
                          <td className="py-3 px-4 text-[#6b7775]">{ds.category}</td>
                          <td className="py-3 px-4 text-right font-bold">{ds.quantity}</td>
                          <td className="py-3 px-4 text-right text-amber-700 font-bold">${ds.value.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ═══ SETTINGS TAB ════════════════════════════════ */}
          {activeTab === 'settings' && (
            <div className="max-w-xl mx-auto anim-fade-up">
              <h2 className="text-xl md:text-2xl font-bold text-[#191c1d] mb-1">System & Notification Settings</h2>
              <p className="text-sm text-[#8a9490] mb-6">Configure email alerts and store properties</p>

              <form onSubmit={handleSaveSettings} className="bg-white border border-[#eaeceb] rounded-2xl p-6 shadow-sm space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-[#191c1d] mb-1.5">Store Name</label>
                  <input
                    type="text"
                    value={settingsData.storeName}
                    onChange={(e) => setSettingsData({ ...settingsData, storeName: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-[#e5e7eb] rounded-xl text-sm"
                  />
                </div>

                <div className="pt-4 border-t border-[#f0f1f2]">
                  <h3 className="font-bold text-[#191c1d] text-sm mb-3">Low-Stock Email Notifications</h3>
                  
                  <div className="flex items-center gap-3 mb-4">
                    <input
                      type="checkbox"
                      id="notifyEmail"
                      checked={settingsData.notifyEmail}
                      onChange={(e) => setSettingsData({ ...settingsData, notifyEmail: e.target.checked })}
                      className="w-5 h-5 accent-[#005440] rounded"
                    />
                    <label htmlFor="notifyEmail" className="text-sm font-semibold text-[#191c1d]">
                      Enable Automatic Email Notifications
                    </label>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#6b7775] mb-1">Recipient Email Address</label>
                      <input
                        type="email"
                        value={settingsData.emailAddress || ''}
                        onChange={(e) => setSettingsData({ ...settingsData, emailAddress: e.target.value })}
                        placeholder="owner@yourshop.com"
                        className="w-full px-4 py-2.5 border-2 border-[#e5e7eb] rounded-xl text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#6b7775] mb-1">Resend API Key (for sending emails)</label>
                      <input
                        type="password"
                        value={newResendApiKey}
                        onChange={(e) => setNewResendApiKey(e.target.value)}
                        placeholder={settingsData.resendApiKeyConfigured ? '•••••••• already configured — leave blank to keep' : 're_123456789...'}
                        autoComplete="new-password"
                        className="w-full px-4 py-2.5 border-2 border-[#e5e7eb] rounded-xl text-sm font-mono"
                      />
                      <p className="text-[11px] text-[#9aafaa] mt-1">For security, the saved key is never sent back to the browser — this field is write-only. Get your free API key at <a href="https://resend.com" target="_blank" rel="noreferrer" className="text-[#005440] underline">resend.com</a> (3,000 emails/month free)</p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#f0f1f2]">
                  <label className="block text-sm font-semibold text-[#191c1d] mb-1.5">Set New System Access Passcode</label>
                  <input
                    type="text"
                    value={newPasscode}
                    onChange={(e) => setNewPasscode(e.target.value)}
                    placeholder="Leave blank to keep current passcode"
                    autoComplete="new-password"
                    minLength={4}
                    className="w-full px-4 py-2.5 border-2 border-[#e5e7eb] rounded-xl text-sm font-mono text-center tracking-widest font-bold"
                  />
                  <p className="text-[11px] text-[#9aafaa] mt-1">This passcode is now hashed and is the one actually checked at login. Minimum 4 characters.</p>
                </div>

                <div className="pt-4 flex justify-end">
                  <button type="submit" className="btn-primary px-6 py-3 text-sm rounded-xl font-semibold">
                    Save Settings
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ═══ ITEM DETAIL TAB ══════════════════════════════ */}
          {activeTab === 'detail' && selectedItem && (
            <div className="max-w-2xl mx-auto anim-fade-up space-y-5">
              <div className="flex items-center gap-3">
                <button onClick={() => setActiveTab('inventory')} className="p-2 rounded-xl hover:bg-white border border-[#eaeceb] text-[#6b7775]">
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>arrow_back</span>
                </button>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-[#191c1d]">{selectedItem.name}</h2>
                  <p className="text-xs text-[#9aafaa] font-mono">{selectedItem.sku} · {selectedItem.category}</p>
                </div>
                <StatusBadge item={selectedItem} />
              </div>

              {/* Item stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Current Stock', value: selectedItem.quantity, color: selectedItem.quantity === 0 ? 'text-red-600' : selectedItem.quantity < selectedItem.threshold ? 'text-amber-600' : 'text-[#005440]' },
                  { label: 'Threshold', value: selectedItem.threshold, color: 'text-[#191c1d]' },
                  { label: 'Unit Price', value: `$${selectedItem.price.toFixed(2)}`, color: 'text-[#191c1d]' },
                  { label: 'Location', value: selectedItem.location || '—', color: 'text-[#6b7775]' },
                ].map((s) => (
                  <div key={s.label} className="bg-white border border-[#eaeceb] rounded-2xl p-4 shadow-sm">
                    <p className="text-xs text-[#8a9490] font-medium mb-1">{s.label}</p>
                    <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* AI Forecast Panel */}
              <div className="bg-gradient-to-br from-[#0a3d2e] to-[#005440] rounded-2xl p-5 shadow-lg relative overflow-hidden">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #9aedcf 0%, transparent 60%)' }} />
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#9aedcf] icon-fill" style={{ fontSize: '20px' }}>insights</span>
                      <div>
                        <h3 className="text-white font-bold text-sm">AI Demand Forecast</h3>
                        <p className="text-[#9aedcf]/70 text-[10px]">Powered by Gemini</p>
                      </div>
                    </div>
                    <button
                      onClick={() => fetchAiForecast(selectedItem.id)}
                      disabled={aiForecastLoading}
                      className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
                    >
                      <span className={`material-symbols-outlined ${aiForecastLoading ? 'animate-spin' : ''}`} style={{ fontSize: '16px' }}>refresh</span>
                    </button>
                  </div>

                  {aiForecastLoading && (
                    <div className="space-y-2">
                      {[1,2].map(i => <div key={i} className="h-3 bg-white/10 rounded-full animate-pulse" style={{ width: `${60 + i * 15}%` }} />)}
                    </div>
                  )}

                  {!aiForecastLoading && aiForecast && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white/10 rounded-xl p-3 text-center">
                          <p className="text-[10px] text-[#9aedcf]/70 uppercase tracking-wider mb-1">Days Left</p>
                          <p className={`text-2xl font-bold ${aiForecast.daysUntilStockout !== null ? (aiForecast.daysUntilStockout < 7 ? 'text-red-300' : aiForecast.daysUntilStockout < 14 ? 'text-amber-300' : 'text-[#9aedcf]') : 'text-white/50'}`}>
                            {aiForecast.daysUntilStockout !== null ? aiForecast.daysUntilStockout : '∞'}
                          </p>
                        </div>
                        <div className="bg-white/10 rounded-xl p-3 text-center">
                          <p className="text-[10px] text-[#9aedcf]/70 uppercase tracking-wider mb-1">Reorder Qty</p>
                          <p className="text-2xl font-bold text-white">{aiForecast.reorderQty}</p>
                        </div>
                        <div className="bg-white/10 rounded-xl p-3 text-center">
                          <p className="text-[10px] text-[#9aedcf]/70 uppercase tracking-wider mb-1">Confidence</p>
                          <p className="text-sm font-bold text-white capitalize">{aiForecast.confidence}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            aiForecast.urgency === 'critical' ? 'bg-red-500/40 text-red-200' :
                            aiForecast.urgency === 'soon' ? 'bg-amber-500/40 text-amber-200' :
                            'bg-emerald-500/40 text-emerald-200'
                          }`}>{aiForecast.urgency}</span>
                        </div>
                      </div>
                      <p className="text-white/80 text-xs leading-relaxed">{aiForecast.summary}</p>
                      <div className="bg-[#9aedcf]/10 border border-[#9aedcf]/20 rounded-xl px-3 py-2.5">
                        <p className="text-[10px] font-semibold text-[#9aedcf] uppercase tracking-wider mb-1">Recommended Action</p>
                        <p className="text-white text-xs">{aiForecast.action}</p>
                      </div>
                    </div>
                  )}

                  {!aiForecastLoading && !aiForecast && (
                    <button onClick={() => fetchAiForecast(selectedItem.id)} className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white/70 text-sm transition-colors flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>auto_awesome</span>
                      Generate AI Forecast
                    </button>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button onClick={() => openAdjust('IN', selectedItem)} className="flex-1 btn-primary py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add_circle</span> Stock In
                </button>
                <button onClick={() => openAdjust('OUT', selectedItem)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>remove_circle</span> Stock Out
                </button>
                <button onClick={() => openForm(selectedItem)} className="flex-1 btn-ghost py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span> Edit
                </button>
              </div>

              {/* Recent movements */}
              {selectedItem.movements && selectedItem.movements.length > 0 && (
                <div className="bg-white border border-[#eaeceb] rounded-2xl p-5 shadow-sm">
                  <h3 className="font-bold text-sm text-[#191c1d] mb-3">Recent Stock Movements</h3>
                  <div className="space-y-2">
                    {selectedItem.movements.map((m) => (
                      <div key={m.id} className="flex items-center gap-3 py-2 border-b border-[#f0f1f2] last:border-0">
                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                          m.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>{m.type === 'IN' ? '+' : '−'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[#191c1d]">{m.type === 'IN' ? 'Stock In' : 'Stock Out'} · {m.quantity} units</p>
                          {m.note && <p className="text-xs text-[#9aafaa] truncate">{m.note}</p>}
                        </div>
                        <p className="text-xs text-[#9aafaa] shrink-0">{new Date(m.createdAt).toLocaleDateString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Supplier info */}
              {selectedItem.supplier && (
                <div className="bg-white border border-[#eaeceb] rounded-2xl p-5 shadow-sm">
                  <h3 className="font-bold text-sm text-[#191c1d] mb-2">Supplier</h3>
                  <p className="font-semibold text-[#005440]">{selectedItem.supplier.name}</p>
                  {selectedItem.supplier.phone && <p className="text-xs text-[#6b7775]">{selectedItem.supplier.phone}</p>}
                  {selectedItem.supplier.email && <p className="text-xs text-[#6b7775]">{selectedItem.supplier.email}</p>}
                </div>
              )}

              {/* Delete */}
              <button onClick={() => setDeleteModalOpen(true)} className="w-full py-3 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl border border-transparent hover:border-red-100 transition-colors flex items-center justify-center gap-2">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
                Delete This Item
              </button>
            </div>
          )}

          {/* ═══ ADD ITEM TAB ═════════════════════════════════ */}
          {activeTab === 'add' && (
            <div className="max-w-lg mx-auto anim-fade-up">
              <h2 className="text-xl md:text-2xl font-bold text-[#191c1d] mb-1">
                {formData.id ? 'Edit Item' : 'Add New Item'}
              </h2>
              <p className="text-sm text-[#8a9490] mb-6">Fill in details to save to inventory</p>

              <form onSubmit={handleSaveItem} className="bg-white border border-[#eaeceb] rounded-2xl p-6 shadow-sm space-y-4">
                {formError && <div className="bg-red-50 text-red-700 p-3 rounded-xl text-sm">{formError}</div>}

                <div>
                  <label className="block text-sm font-semibold text-[#191c1d] mb-1">Item Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2.5 border-2 border-[#e5e7eb] rounded-xl text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#191c1d] mb-1">Supplier</label>
                  <select
                    value={formData.supplierId}
                    onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                    className="w-full px-4 py-2.5 border-2 border-[#e5e7eb] rounded-xl text-sm bg-white"
                  >
                    <option value="">No Supplier Attached</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-[#191c1d] mb-1">Category</label>
                    <input
                      type="text"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-4 py-2.5 border-2 border-[#e5e7eb] rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#191c1d] mb-1">Expiry Date (Optional)</label>
                    <input
                      type="date"
                      value={formData.expiresAt}
                      onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                      className="w-full px-4 py-2.5 border-2 border-[#e5e7eb] rounded-xl text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-[#191c1d] mb-1">Starting Quantity</label>
                    <input
                      type="number"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 border-2 border-[#e5e7eb] rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#191c1d] mb-1">Low Stock Threshold</label>
                    <input
                      type="number"
                      value={formData.threshold}
                      onChange={(e) => setFormData({ ...formData, threshold: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 border-2 border-[#e5e7eb] rounded-xl text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-[#191c1d] mb-1">Unit Price ($)</label>
                    <input
                      type="number"
                      step={0.01}
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 border-2 border-[#e5e7eb] rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#191c1d] mb-1">Shelf Location</label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full px-4 py-2.5 border-2 border-[#e5e7eb] rounded-xl text-sm"
                    />
                  </div>
                </div>

                {/* Description with AI Generator */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-semibold text-[#191c1d]">Description</label>
                    <button
                      type="button"
                      onClick={handleGenerateDescription}
                      disabled={aiDescLoading || !formData.name.trim()}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-gradient-to-r from-[#005440] to-[#0f6e56] text-white hover:opacity-90 disabled:opacity-50 transition-all"
                    >
                      <span className={`material-symbols-outlined ${aiDescLoading ? 'animate-spin' : ''}`} style={{ fontSize: '14px' }}>{aiDescLoading ? 'refresh' : 'auto_awesome'}</span>
                      {aiDescLoading ? 'Generating...' : '✨ AI Generate'}
                    </button>
                  </div>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    placeholder="Product description (or use AI to generate one)..."
                    className="w-full px-4 py-2.5 border-2 border-[#e5e7eb] rounded-xl text-sm resize-none"
                  />
                </div>

                <div className="pt-3 flex justify-end gap-3">
                  <button type="button" onClick={() => setActiveTab('inventory')} className="btn-ghost px-5 py-2.5 text-sm">Cancel</button>
                  <button type="submit" className="btn-primary px-5 py-2.5 text-sm rounded-xl font-semibold">Save Item</button>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>

      {/* ── RECORD SALE MODAL ────────────────────────────── */}
      {saleModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl modal-card">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-[#191c1d]">Record Sale</h3>
              <button onClick={() => setSaleModalOpen(false)} className="text-[#9aafaa]"><span className="material-symbols-outlined">close</span></button>
            </div>

            {saleError && <div className="bg-red-50 text-red-700 p-3 rounded-xl text-xs mb-4">{saleError}</div>}

            <form onSubmit={handleRecordSale} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#6b7775] mb-1">Select Item</label>
                <select
                  value={saleItemId}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setSaleItemId(id);
                    const itm = items.find((i) => i.id === id);
                    if (itm) setSalePrice(itm.price);
                  }}
                  className="w-full px-3 py-2.5 border-2 border-[#e5e7eb] rounded-xl text-sm bg-white"
                >
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>{i.name} (Stock: {i.quantity})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#6b7775] mb-1">Quantity Sold</label>
                  <input
                    type="number" min={1}
                    value={saleQty}
                    onChange={(e) => setSaleQty(Number(e.target.value))}
                    className="w-full px-3 py-2 border-2 border-[#e5e7eb] rounded-xl text-sm font-bold text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6b7775] mb-1">Unit Price ($)</label>
                  <input
                    type="number" step={0.01}
                    value={salePrice}
                    onChange={(e) => setSalePrice(Number(e.target.value))}
                    className="w-full px-3 py-2 border-2 border-[#e5e7eb] rounded-xl text-sm font-bold text-center"
                  />
                </div>
              </div>

              <div className="bg-emerald-50 p-3 rounded-xl flex justify-between text-sm">
                <span>Total Amount:</span>
                <strong className="text-emerald-700 font-bold">${(saleQty * salePrice).toFixed(2)}</strong>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setSaleModalOpen(false)} className="btn-ghost flex-1 py-2.5 text-sm">Cancel</button>
                <button type="submit" className="btn-primary flex-1 py-2.5 text-sm rounded-xl font-semibold">Confirm Sale</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── SUPPLIER MODAL ──────────────────────────────── */}
      {supplierModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl modal-card">
            <h3 className="text-lg font-bold text-[#191c1d] mb-4">Add / Edit Supplier</h3>
            {supplierError && <div className="bg-red-50 text-red-700 p-3 rounded-xl text-xs mb-3">{supplierError}</div>}
            <form onSubmit={handleSaveSupplier} className="space-y-3">
              <input
                type="text"
                placeholder="Supplier Name *"
                value={supplierFormData.name}
                onChange={(e) => setSupplierFormData({ ...supplierFormData, name: e.target.value })}
                className="w-full px-3 py-2 border-2 border-[#e5e7eb] rounded-xl text-sm"
              />
              <input
                type="text"
                placeholder="Contact Person"
                value={supplierFormData.contact}
                onChange={(e) => setSupplierFormData({ ...supplierFormData, contact: e.target.value })}
                className="w-full px-3 py-2 border-2 border-[#e5e7eb] rounded-xl text-sm"
              />
              <input
                type="text"
                placeholder="Phone Number"
                value={supplierFormData.phone}
                onChange={(e) => setSupplierFormData({ ...supplierFormData, phone: e.target.value })}
                className="w-full px-3 py-2 border-2 border-[#e5e7eb] rounded-xl text-sm"
              />
              <input
                type="email"
                placeholder="Email Address"
                value={supplierFormData.email}
                onChange={(e) => setSupplierFormData({ ...supplierFormData, email: e.target.value })}
                className="w-full px-3 py-2 border-2 border-[#e5e7eb] rounded-xl text-sm"
              />
              <div className="flex gap-3 pt-3">
                <button type="button" onClick={() => setSupplierModalOpen(false)} className="btn-ghost flex-1 py-2 text-sm">Cancel</button>
                <button type="submit" className="btn-primary flex-1 py-2 text-sm rounded-xl">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── STOCK ADJUSTMENT MODAL ──────────────────────── */}
      {adjustModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl p-6 w-full sm:max-w-sm shadow-2xl modal-card">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-[#191c1d]">Adjust Stock</h3>
              <button onClick={() => setAdjustModalOpen(false)} className="text-[#9aafaa]"><span className="material-symbols-outlined">close</span></button>
            </div>
            {adjustError && <div className="bg-red-50 text-red-700 p-3 rounded-xl text-xs mb-4">{adjustError}</div>}
            <div className="flex gap-2 mb-4 p-1 bg-[#f4f5f6] rounded-xl">
              <button type="button" onClick={() => setAdjustType('IN')} className={`type-btn flex-1 py-2 rounded-lg font-semibold text-sm border-2 ${adjustType === 'IN' ? 't-in' : 'border-transparent text-[#6b7775]'}`}>+ Stock In</button>
              <button type="button" onClick={() => setAdjustType('OUT')} className={`type-btn flex-1 py-2 rounded-lg font-semibold text-sm border-2 ${adjustType === 'OUT' ? 't-out' : 'border-transparent text-[#6b7775]'}`}>− Stock Out</button>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <button type="button" onClick={() => setAdjustQty(Math.max(1, adjustQty - 1))} className="qty-btn w-12 h-12 bg-[#f4f5f6] rounded-xl text-xl font-bold">−</button>
              <input type="number" min={1} value={adjustQty} onChange={(e) => setAdjustQty(Math.max(1, Number(e.target.value)))} className="flex-1 text-center py-3 border-2 border-[#e5e7eb] rounded-xl font-bold text-xl" />
              <button type="button" onClick={() => setAdjustQty(adjustQty + 1)} className="qty-btn w-12 h-12 bg-[#f4f5f6] rounded-xl text-xl font-bold">+</button>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setAdjustModalOpen(false)} className="btn-ghost flex-1 py-2.5 text-sm">Cancel</button>
              <button onClick={handleAdjustStock} className="btn-primary flex-1 py-2.5 text-sm rounded-xl font-semibold">Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* ── LOGOUT MODAL ────────────────────────────────── */}
      {logoutModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl modal-card text-center">
            <h3 className="text-lg font-bold text-[#191c1d] mb-2">Logout of {settingsData.storeName || 'StockKeep'}?</h3>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setLogoutModalOpen(false)} className="btn-ghost flex-1 py-2 text-sm">Cancel</button>
              <button onClick={handleLogout} className="btn-primary flex-1 py-2 text-sm rounded-xl font-semibold">Logout</button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE MODAL ────────────────────────────────── */}
      {deleteModalOpen && selectedItem && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl modal-card text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="material-symbols-outlined text-red-600 icon-fill" style={{ fontSize: '24px' }}>delete</span>
            </div>
            <h3 className="text-lg font-bold text-[#191c1d] mb-1">Delete {selectedItem.name}?</h3>
            <p className="text-sm text-[#8a9490] mb-5">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModalOpen(false)} className="btn-ghost flex-1 py-2 text-sm">Cancel</button>
              <button onClick={handleDeleteItem} className="flex-1 py-2 text-sm rounded-xl font-semibold bg-red-500 text-white hover:bg-red-600">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── AI CHAT FLOATING BUTTON ─────────────────────── */}
      <button
        onClick={() => setChatOpen(true)}
        className="fixed bottom-24 md:bottom-8 right-5 md:right-8 z-40 w-14 h-14 rounded-2xl shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95"
        style={{ background: 'linear-gradient(135deg, #0f6e56 0%, #005440 100%)' }}
        title="Ask AI Assistant"
      >
        <span className="material-symbols-outlined text-[#9aedcf] icon-fill" style={{ fontSize: '26px' }}>smart_toy</span>
        {chatMessages.length === 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#9aedcf] rounded-full flex items-center justify-center">
            <span className="text-[7px] font-black text-[#005440]">AI</span>
          </span>
        )}
      </button>

      {/* ── AI CHAT SLIDE-IN PANEL ──────────────────────── */}
      {chatOpen && (
        <>
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50" onClick={() => setChatOpen(false)} />
          <div className="fixed bottom-0 right-0 md:bottom-6 md:right-6 z-50 w-full md:w-[400px] h-[600px] md:h-[580px] bg-white md:rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: '90vh' }}>
            {/* Chat Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-[#eaeceb] shrink-0" style={{ background: 'linear-gradient(135deg, #0f6e56 0%, #005440 100%)' }}>
              <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-[#9aedcf] icon-fill" style={{ fontSize: '18px' }}>smart_toy</span>
              </div>
              <div className="flex-1">
                <h3 className="text-white font-bold text-sm">StockKeep AI</h3>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-[#9aedcf] rounded-full animate-pulse" />
                  <p className="text-[#9aedcf]/70 text-[10px]">Powered by Gemini · Live inventory access</p>
                </div>
              </div>
              <button onClick={() => setChatOpen(false)} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
              </button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.length === 0 && (
                <div className="text-center py-8">
                  <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0f6e56 0%, #005440 100%)' }}>
                    <span className="material-symbols-outlined text-[#9aedcf] icon-fill" style={{ fontSize: '28px' }}>auto_awesome</span>
                  </div>
                  <p className="font-semibold text-[#191c1d] text-sm mb-1">StockKeep AI Assistant</p>
                  <p className="text-xs text-[#9aafaa] mb-4">Ask me anything about your inventory</p>
                  <div className="space-y-2 text-left">
                    {[
                      'What items are critically low on stock?',
                      'Which product generates the most revenue?',
                      'Should I reorder anything this week?',
                    ].map((q) => (
                      <button
                        key={q}
                        onClick={() => { setChatInput(q); }}
                        className="w-full text-left px-3 py-2.5 rounded-xl bg-[#f4f5f6] hover:bg-emerald-50 hover:border-emerald-200 border border-transparent text-xs text-[#4a5551] font-medium transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'model' && (
                    <div className="w-7 h-7 rounded-xl shrink-0 mr-2 flex items-center justify-center mt-1" style={{ background: 'linear-gradient(135deg, #0f6e56, #005440)' }}>
                      <span className="material-symbols-outlined text-[#9aedcf]" style={{ fontSize: '14px' }}>smart_toy</span>
                    </div>
                  )}
                  <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-[#005440] text-white rounded-br-sm'
                      : 'bg-[#f4f5f6] text-[#191c1d] rounded-bl-sm'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div className="flex justify-start">
                  <div className="w-7 h-7 rounded-xl shrink-0 mr-2 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0f6e56, #005440)' }}>
                    <span className="material-symbols-outlined text-[#9aedcf]" style={{ fontSize: '14px' }}>smart_toy</span>
                  </div>
                  <div className="bg-[#f4f5f6] rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5 items-center">
                    {[0,1,2].map(i => <span key={i} className="w-1.5 h-1.5 bg-[#9aafaa] rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            <div className="p-4 border-t border-[#eaeceb] shrink-0">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
                  placeholder="Ask about your inventory..."
                  className="flex-1 px-4 py-2.5 bg-[#f4f5f6] border border-[#eaeceb] rounded-xl text-sm text-[#191c1d] placeholder:text-[#b0bab5] focus:outline-none focus:border-[#005440] focus:bg-white transition-colors"
                  disabled={chatLoading}
                />
                <button
                  onClick={handleSendChat}
                  disabled={!chatInput.trim() || chatLoading}
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-white disabled:opacity-40 transition-all hover:opacity-90 active:scale-95 shrink-0"
                  style={{ background: 'linear-gradient(135deg, #0f6e56, #005440)' }}
                >
                  <span className="material-symbols-outlined icon-fill" style={{ fontSize: '18px' }}>send</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
