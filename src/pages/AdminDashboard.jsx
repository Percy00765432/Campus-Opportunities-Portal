import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const STATUS_MAP = {
  reviewing: { label: 'Reviewing',    cls: 'status-reviewing', icon: 'pending' },
  approved:  { label: 'Approved',     cls: 'status-approved',  icon: 'check_circle' },
  pending:   { label: 'Pending',      cls: 'status-pending',   icon: 'schedule' },
  rejected:  { label: 'Not Selected', cls: 'status-rejected',  icon: 'cancel' },
}

const NAV_ITEMS = [
  { id: 'dashboard',    label: 'Dashboard',       icon: 'dashboard' },
  { id: 'opportunities',label: 'Opportunities',   icon: 'explore' },
  { id: 'applications', label: 'Applications',    icon: 'assignment' },
  { id: 'users',        label: 'User Management', icon: 'manage_accounts' },
  { id: 'reports',      label: 'Reports',         icon: 'bar_chart' },
  { id: 'settings',     label: 'Settings',        icon: 'settings' },
]

const EMPTY_FORM = {
  title: '', category: '', description: '',
  deadline: '', vacancies: '', stipend: '',
  department: '', eligibility: '',
}

const BAR_COLORS = ['bg-primary', 'bg-tertiary', 'bg-secondary', 'bg-error', 'bg-surface-container-highest']

export default function AdminDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [activeNav, setActiveNav]         = useState('dashboard')
  const [sidebarOpen, setSidebarOpen]     = useState(true)
  const [searchVal, setSearchVal]         = useState('')
  const [activeTab, setActiveTab]         = useState('all')
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [focusForm, setFocusForm]         = useState(false)

  const formRef        = useRef(null)
  const profileMenuRef = useRef(null)

  const [applications, setApplications]   = useState([])
  const [opportunities, setOpportunities] = useState([])
  const [users, setUsers]                 = useState([])
  const [appsLoading, setAppsLoading]     = useState(true)
  const [oppsLoading, setOppsLoading]     = useState(true)
  const [usersLoading, setUsersLoading]   = useState(false)

  const [form, setForm]               = useState(EMPTY_FORM)
  const [formLoading, setFormLoading] = useState(false)
  const [formSuccess, setFormSuccess] = useState(false)
  const [formError, setFormError]     = useState(null)

  const [userSearch, setUserSearch]         = useState('')
  const [addUserOpen, setAddUserOpen]       = useState(false)
  const [addUserForm, setAddUserForm]       = useState({ email: '', password: '', name: '', role: 'student', department: '' })
  const [addUserLoading, setAddUserLoading] = useState(false)
  const [addUserError, setAddUserError]     = useState(null)
  const [addUserSuccess, setAddUserSuccess] = useState(false)
  const [roleUpdating, setRoleUpdating]     = useState(new Set())
  const [editingOpp, setEditingOpp]         = useState(null)
  const [notifOpen, setNotifOpen]           = useState(false)
  const notifRef = useRef(null)

  // ── Fetch all applications ──────────────────────────────
  const fetchApplications = useCallback(async () => {
    setAppsLoading(true)
    const { data, error } = await supabase
      .from('applications')
      .select('*, profiles(name, avatar, email), opportunities(title, category, department)')
      .order('applied_at', { ascending: false })
      .limit(100)
    if (!error) setApplications(data ?? [])
    setAppsLoading(false)
  }, [])

  // ── Fetch all opportunities ─────────────────────────────
  const fetchOpportunities = useCallback(async () => {
    setOppsLoading(true)
    const { data, error } = await supabase
      .from('opportunities')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) setOpportunities(data ?? [])
    setOppsLoading(false)
  }, [])

  // ── Fetch all users ─────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setUsersLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) setUsers(data ?? [])
    setUsersLoading(false)
  }, [])

  useEffect(() => { fetchApplications()  }, [fetchApplications])
  useEffect(() => { fetchOpportunities() }, [fetchOpportunities])
  useEffect(() => {
    if (activeNav === 'users') fetchUsers()
  }, [activeNav, fetchUsers])

  // Scroll to form when "New Opportunity" is clicked
  useEffect(() => {
    if (focusForm && activeNav === 'opportunities') {
      setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        setFocusForm(false)
      }, 50)
    }
  }, [focusForm, activeNav])

  // Close profile dropdown on outside click
  useEffect(() => {
    if (!profileMenuOpen) return
    function handleOutside(e) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setProfileMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [profileMenuOpen])

  // Close notification dropdown on outside click
  useEffect(() => {
    if (!notifOpen) return
    function handleOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [notifOpen])

  // ── Update application status ───────────────────────────
  async function handleStatusChange(id, newStatus) {
    await supabase.from('applications').update({ status: newStatus }).eq('id', id)
    setApplications((prev) => prev.map((a) => a.id === id ? { ...a, status: newStatus } : a))
  }

  // ── Toggle opportunity active/closed ────────────────────
  async function handleToggleOpportunityStatus(id, currentStatus) {
    const next = currentStatus === 'active' ? 'closed' : 'active'
    await supabase.from('opportunities').update({ status: next }).eq('id', id)
    setOpportunities((prev) => prev.map((o) => o.id === id ? { ...o, status: next } : o))
  }

  // ── Delete opportunity ──────────────────────────────────
  async function handleDeleteOpportunity(id) {
    if (!window.confirm('Delete this opportunity? This cannot be undone.')) return
    await supabase.from('opportunities').delete().eq('id', id)
    setOpportunities((prev) => prev.filter((o) => o.id !== id))
  }

  // ── Edit opportunity ────────────────────────────────────
  function handleEditOpp(op) {
    setEditingOpp(op)
    setForm({
      title:       op.title ?? '',
      category:    op.category ?? '',
      description: op.description ?? '',
      deadline:    op.deadline ?? '',
      vacancies:   op.vacancies?.toString() ?? '',
      stipend:     op.stipend ?? '',
      department:  op.department ?? '',
      eligibility: op.eligibility ?? '',
    })
    setActiveNav('opportunities')
    setFocusForm(true)
  }

  // ── Post / update opportunity ───────────────────────────
  async function handleFormSubmit(e) {
    e.preventDefault()
    setFormLoading(true)
    setFormError(null)
    const payload = {
      title:       form.title,
      category:    form.category,
      department:  form.department || null,
      description: form.description,
      deadline:    form.deadline,
      vacancies:   form.vacancies ? parseInt(form.vacancies) : null,
      stipend:     form.stipend || null,
      eligibility: form.eligibility || null,
    }
    let error
    if (editingOpp) {
      ;({ error } = await supabase.from('opportunities').update(payload).eq('id', editingOpp.id))
    } else {
      ;({ error } = await supabase.from('opportunities').insert({ ...payload, status: 'active', created_by: user?.id }))
    }
    setFormLoading(false)
    if (error) { setFormError(error.message); return }
    setEditingOpp(null)
    setForm(EMPTY_FORM)
    await fetchOpportunities()
    setFormSuccess(true)
    setTimeout(() => setFormSuccess(false), 3000)
  }

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  // ── Change user role ────────────────────────────────────
  async function handleRoleChange(userId, newRole) {
    if (userId === user?.id) return // prevent self-demotion
    setRoleUpdating((prev) => new Set(prev).add(userId))
    const { error } = await supabase.rpc('admin_set_user_role', { target_user_id: userId, new_role: newRole })
    if (!error) setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole } : u))
    setRoleUpdating((prev) => { const s = new Set(prev); s.delete(userId); return s })
  }

  // ── Delete user ─────────────────────────────────────────
  async function handleDeleteUser(userId) {
    if (userId === user?.id) return window.alert('You cannot delete your own account.')
    if (!window.confirm('Delete this user permanently? This cannot be undone.')) return
    const { error } = await supabase.rpc('admin_delete_user', { target_user_id: userId })
    if (!error) setUsers((prev) => prev.filter((u) => u.id !== userId))
  }

  // ── Add user ────────────────────────────────────────────
  async function handleAddUser(e) {
    e.preventDefault()
    setAddUserLoading(true)
    setAddUserError(null)
    const tempClient = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
    const { error } = await tempClient.auth.signUp({
      email: addUserForm.email,
      password: addUserForm.password,
      options: {
        data: {
          name: addUserForm.name,
          role: addUserForm.role,
          department: addUserForm.department || null,
        },
      },
    })
    setAddUserLoading(false)
    if (error) { setAddUserError(error.message); return }
    setAddUserSuccess(true)
    setAddUserForm({ email: '', password: '', name: '', role: 'student', department: '' })
    await fetchUsers()
    setTimeout(() => { setAddUserSuccess(false); setAddUserOpen(false) }, 2500)
  }

  // ── Filtered applications ───────────────────────────────
  const filteredApps = applications.filter((a) => {
    const matchSearch =
      (a.profiles?.name ?? '').toLowerCase().includes(searchVal.toLowerCase()) ||
      (a.opportunities?.title ?? '').toLowerCase().includes(searchVal.toLowerCase()) ||
      (a.opportunities?.category ?? '').toLowerCase().includes(searchVal.toLowerCase())
    const matchTab = activeTab === 'all' || a.status === activeTab
    return matchSearch && matchTab
  })

  // ── Derived counts ──────────────────────────────────────
  const counts = {
    total:    opportunities.length,
    active:   applications.length,
    pending:  applications.filter((a) => a.status === 'pending' || a.status === 'reviewing').length,
    approved: applications.filter((a) => a.status === 'approved').length,
  }

  // ── Analytics breakdowns ────────────────────────────────
  const categoryBreakdown = (() => {
    const total = applications.length || 1
    const map = {}
    applications.forEach((a) => {
      const cat = a.opportunities?.category ?? 'Other'
      map[cat] = (map[cat] ?? 0) + 1
    })
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([label, count]) => ({ label, count, pct: Math.round((count / total) * 100) }))
  })()

  const statusBreakdown = [
    { label: 'Pending',      count: applications.filter(a => a.status === 'pending').length,   color: 'bg-secondary' },
    { label: 'Reviewing',    count: applications.filter(a => a.status === 'reviewing').length,  color: 'bg-tertiary' },
    { label: 'Approved',     count: applications.filter(a => a.status === 'approved').length,   color: 'bg-primary' },
    { label: 'Not Selected', count: applications.filter(a => a.status === 'rejected').length,   color: 'bg-error' },
  ]

  const deptBreakdown = (() => {
    const total = applications.length || 1
    const map = {}
    applications.forEach((a) => {
      const dept = a.opportunities?.department ?? 'Other'
      map[dept] = (map[dept] ?? 0) + 1
    })
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([label, count]) => ({ label, count, pct: Math.round((count / total) * 100) }))
  })()

  // Shared stat cards used in dashboard + applications views
  const statCards = (
    <div className="grid grid-cols-4 gap-4">
      {[
        { label: 'Total Opportunities', value: oppsLoading ? '…' : counts.total,   icon: 'explore',         delta: `${opportunities.filter(o => o.status === 'active').length} active`, color: 'text-primary bg-primary/10' },
        { label: 'Total Applications',  value: appsLoading ? '…' : counts.active,  icon: 'assignment',      delta: 'All time',        color: 'text-secondary bg-secondary-container' },
        { label: 'Pending Review',      value: appsLoading ? '…' : counts.pending, icon: 'pending_actions', delta: 'Action required', color: 'text-error bg-error-container/20' },
        { label: 'Approved',            value: appsLoading ? '…' : counts.approved,icon: 'verified',        delta: 'Students placed', color: 'text-tertiary bg-tertiary-container' },
      ].map((s) => (
        <div key={s.label} className="stat-card flex items-start gap-4">
          <div className={`w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0 ${s.color}`}>
            <span className="material-symbols-outlined text-[18px]">{s.icon}</span>
          </div>
          <div>
            <p className="font-headline text-xl font-bold text-on-surface">{s.value}</p>
            <p className="text-xs text-on-surface-variant font-label">{s.label}</p>
            <p className="text-xs font-label font-semibold mt-1 text-on-surface-variant">{s.delta}</p>
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div className="min-h-screen bg-background flex font-body">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-60' : 'w-16'} flex-shrink-0 flex flex-col bg-surface/80 backdrop-blur-glass transition-all duration-300 relative z-10`}>
        <div className={`flex items-center ${sidebarOpen ? 'gap-3 px-5' : 'justify-center px-2'} py-5`}>
          <span className="material-symbols-outlined text-primary text-2xl flex-shrink-0">school</span>
          {sidebarOpen && (
            <div>
              <p className="font-headline text-on-surface font-bold text-sm leading-tight">Academic Atelier</p>
              <p className="text-on-surface-variant text-xs font-label">Administrator Edition</p>
            </div>
          )}
        </div>
        <nav className="flex-1 px-2 py-2 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              className={`nav-item w-full ${activeNav === item.id ? 'active' : ''} ${sidebarOpen ? 'justify-start' : 'justify-center'}`}
            >
              <span className="material-symbols-outlined text-[18px] flex-shrink-0">{item.icon}</span>
              {sidebarOpen && <span>{item.label}</span>}
            </button>
          ))}
        </nav>
        <div className="px-2 pb-4 space-y-0.5">
          <button className={`nav-item w-full ${sidebarOpen ? 'justify-start' : 'justify-center'}`}>
            <span className="material-symbols-outlined text-[18px] flex-shrink-0">help</span>
            {sidebarOpen && <span>Help Center</span>}
          </button>
          <button
            onClick={handleLogout}
            className={`nav-item w-full text-error hover:bg-error/10 hover:text-error ${sidebarOpen ? 'justify-start' : 'justify-center'}`}
          >
            <span className="material-symbols-outlined text-[18px] flex-shrink-0">logout</span>
            {sidebarOpen && <span>Sign Out</span>}
          </button>
        </div>
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-surface-container-lowest border border-outline-variant/30 shadow-soft flex items-center justify-center hover:bg-surface-container-high transition-colors"
        >
          <span className="material-symbols-outlined text-[14px] text-on-surface-variant">
            {sidebarOpen ? 'chevron_left' : 'chevron_right'}
          </span>
        </button>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="flex items-center justify-between px-8 py-4 bg-surface/80 backdrop-blur-glass sticky top-0 z-10">
          <div>
            <h2 className="font-headline text-on-surface font-bold text-lg leading-tight">
              {NAV_ITEMS.find((n) => n.id === activeNav)?.label ?? 'Dashboard'}
            </h2>
            <p className="text-on-surface-variant text-xs font-label">
              {user?.department}{user?.title ? ` · ${user.title}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px]">search</span>
              <input
                type="text"
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
                placeholder="Search…"
                className="pl-9 pr-4 py-2 bg-surface-container-low rounded-full text-xs text-on-surface placeholder:text-on-surface-variant outline-none w-52 focus:w-64 transition-all duration-200"
              />
            </div>
            <div ref={notifRef} className="relative">
              <button
                onClick={() => setNotifOpen((v) => !v)}
                className="relative w-9 h-9 rounded-full bg-surface-container flex items-center justify-center hover:bg-surface-container-high transition-colors"
              >
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant">notifications</span>
                {counts.pending > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-error" />}
              </button>
              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 card p-0 overflow-hidden z-50">
                  <div className="px-4 py-3 bg-surface-container-low flex items-center justify-between">
                    <p className="text-sm font-headline font-bold text-on-surface">Notifications</p>
                    {counts.pending > 0 && <span className="text-xs font-label font-semibold text-error bg-error/10 px-2 py-0.5 rounded-full">{counts.pending} pending</span>}
                  </div>
                  {counts.pending === 0 ? (
                    <p className="px-4 py-4 text-xs text-on-surface-variant font-label text-center">No pending applications</p>
                  ) : (
                    applications.filter((a) => a.status === 'pending' || a.status === 'reviewing').slice(0, 6).map((a) => (
                      <div
                        key={a.id}
                        onClick={() => { setActiveNav('applications'); setNotifOpen(false) }}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-surface-container-low transition-colors cursor-pointer border-t border-outline-variant/10"
                      >
                        <span className="material-symbols-outlined text-[18px] mt-0.5 text-error">pending_actions</span>
                        <div className="min-w-0">
                          <p className="text-xs font-label font-semibold text-on-surface truncate">{a.profiles?.name ?? 'Unknown'}</p>
                          <p className="text-xs text-on-surface-variant font-label truncate">{a.opportunities?.title} · {a.status}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            <button
              onClick={() => { setActiveNav('opportunities'); setFocusForm(true) }}
              className="btn-primary text-sm"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              New Opportunity
            </button>
            <div ref={profileMenuRef} className="relative">
              <div
                onClick={() => setProfileMenuOpen((v) => !v)}
                className="w-9 h-9 rounded-full bg-gradient-primary flex items-center justify-center text-white text-xs font-bold font-headline cursor-pointer select-none"
              >
                {user?.avatar || user?.name?.[0] || '?'}
              </div>
              {profileMenuOpen && (
                <div className="absolute right-0 top-11 w-48 bg-surface-container-low rounded-xl shadow-elevated border border-outline-variant/20 py-1.5 z-50">
                  <div className="px-4 py-2 border-b border-outline-variant/20">
                    <p className="text-xs font-label font-semibold text-on-surface truncate">{user?.name ?? 'Admin'}</p>
                    <p className="text-xs text-on-surface-variant truncate">{user?.email ?? ''}</p>
                  </div>
                  <button
                    onClick={() => { setProfileMenuOpen(false); setActiveNav('settings') }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-label text-on-surface hover:bg-surface-container transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px] text-on-surface-variant">settings</span>
                    Settings
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-label text-error hover:bg-error/10 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">logout</span>
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 px-8 py-6 overflow-y-auto scrollbar-hide space-y-6">

          {/* ── DASHBOARD ─────────────────────────────────────── */}
          {activeNav === 'dashboard' && (
            <>
              {statCards}

              <div className="grid grid-cols-3 gap-6">
                {/* Opportunities list */}
                <div className="card overflow-hidden">
                  <div className="px-5 py-4 bg-surface-container-low flex items-center justify-between">
                    <p className="section-title mb-0 text-base">Opportunities</p>
                    <button onClick={() => setActiveNav('opportunities')} className="text-xs text-primary font-label font-semibold hover:underline">Manage →</button>
                  </div>
                  {oppsLoading ? (
                    <div className="p-6 text-center text-on-surface-variant text-xs font-label">Loading…</div>
                  ) : opportunities.length === 0 ? (
                    <div className="p-6 text-center text-on-surface-variant text-xs font-label">No opportunities yet.</div>
                  ) : (
                    <div>
                      {opportunities.slice(0, 6).map((op) => (
                        <div key={op.id} className="px-5 py-3.5 hover:bg-surface-container-low transition-colors flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-label font-semibold text-on-surface truncate">{op.title}</p>
                            <p className="text-xs text-on-surface-variant font-label">{op.category} · Due {new Date(op.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                          </div>
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${op.status === 'active' ? 'bg-tertiary' : 'bg-outline-variant'}`} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Category breakdown */}
                <div className="card p-5">
                  <p className="section-title">Applications by Category</p>
                  {categoryBreakdown.length === 0 ? (
                    <p className="text-on-surface-variant text-xs font-label">No applications yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {categoryBreakdown.map((c, i) => (
                        <div key={c.label}>
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-label text-on-surface">{c.label}</p>
                            <p className="text-xs font-label font-bold text-on-surface">{c.count}</p>
                          </div>
                          <div className="h-1.5 bg-surface-container rounded-full overflow-hidden">
                            <div className={`h-full ${BAR_COLORS[i % BAR_COLORS.length]} rounded-full transition-all duration-500`} style={{ width: `${c.pct}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick actions */}
                <div className="card p-5">
                  <p className="section-title">Quick Actions</p>
                  <div className="space-y-2">
                    {[
                      { label: 'Review Pending Applications', icon: 'pending_actions', count: counts.pending || null, nav: 'applications' },
                      { label: 'Manage Opportunities',        icon: 'explore',         nav: 'opportunities' },
                      { label: 'View User Directory',         icon: 'manage_accounts', nav: 'users' },
                      { label: 'View Reports',                icon: 'bar_chart',       nav: 'reports' },
                      { label: 'Admin Settings',              icon: 'settings',        nav: 'settings' },
                    ].map((a) => (
                      <button
                        key={a.label}
                        onClick={() => setActiveNav(a.nav)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-surface-container transition-colors text-left"
                      >
                        <span className="material-symbols-outlined text-primary text-[18px]">{a.icon}</span>
                        <span className="text-sm font-label text-on-surface flex-1">{a.label}</span>
                        {a.count && (
                          <span className="text-xs font-bold font-label text-error bg-error-container/20 px-2 py-0.5 rounded-full">{a.count}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recent applications */}
              {applications.length > 0 && (
                <div className="card overflow-hidden">
                  <div className="px-6 py-4 bg-surface-container-low flex items-center justify-between">
                    <p className="section-title mb-0 flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[18px]">assignment</span>
                      Recent Applications
                    </p>
                    <button onClick={() => setActiveNav('applications')} className="text-xs text-primary font-label font-semibold hover:underline flex items-center gap-1">
                      View all <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </button>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="bg-surface-container">
                        {['Student', 'Opportunity', 'Submitted', 'Status', 'Action'].map((h) => (
                          <th key={h} className="text-left px-6 py-3 text-xs font-label font-semibold text-on-surface-variant uppercase tracking-widest">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {applications.slice(0, 5).map((app, i) => {
                        const s = STATUS_MAP[app.status] ?? STATUS_MAP.pending
                        return (
                          <tr key={app.id} className={`${i % 2 === 0 ? 'bg-surface-container-lowest' : 'bg-surface-container-low/40'} hover:bg-surface-container transition-colors`}>
                            <td className="px-6 py-3.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold font-headline flex-shrink-0">
                                  {app.profiles?.avatar || app.profiles?.name?.[0] || '?'}
                                </div>
                                <span className="text-sm font-label font-semibold text-on-surface">{app.profiles?.name ?? 'Unknown'}</span>
                              </div>
                            </td>
                            <td className="px-6 py-3.5 text-sm font-label text-on-surface">{app.opportunities?.title}</td>
                            <td className="px-6 py-3.5 text-sm font-label text-on-surface-variant">
                              {new Date(app.applied_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </td>
                            <td className="px-6 py-3.5">
                              <span className={`status-badge ${s.cls}`}>
                                <span className="material-symbols-outlined text-[12px]">{s.icon}</span>{s.label}
                              </span>
                            </td>
                            <td className="px-6 py-3.5">
                              <select
                                value={app.status}
                                onChange={(e) => handleStatusChange(app.id, e.target.value)}
                                className="text-xs font-label bg-surface-container-low rounded-md px-2 py-1.5 text-on-surface outline-none border border-outline-variant/30 cursor-pointer"
                              >
                                <option value="pending">Pending</option>
                                <option value="reviewing">Reviewing</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                              </select>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Footer banner */}
              <div className="bg-gradient-primary rounded-xl p-8 relative overflow-hidden">
                <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10" />
                <div className="absolute bottom-4 right-32 w-32 h-32 rounded-full bg-white/5" />
                <div className="relative">
                  <p className="font-headline text-white text-xl font-extrabold mb-1">"Empowering the Next Generation of Scholars"</p>
                  <p className="text-white/70 text-sm font-label mb-6">Your oversight ensures every student has a fair pathway to excellence.</p>
                  <div className="flex items-center gap-10">
                    {[
                      { value: opportunities.filter(o => o.status === 'active').length || '—', label: 'Active Opportunities' },
                      { value: counts.approved || '—',     label: 'Students Placed' },
                      { value: counts.pending  || '—',     label: 'Pending Review' },
                      { value: applications.length || '—', label: 'Total Applications' },
                    ].map((s) => (
                      <div key={s.label}>
                        <p className="font-headline text-white text-2xl font-extrabold">{s.value}</p>
                        <p className="text-white/60 text-xs font-label">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── OPPORTUNITIES ─────────────────────────────────── */}
          {activeNav === 'opportunities' && (
            <>
              <div className="mb-2">
                <h2 className="font-headline text-on-surface font-bold text-xl">Manage Opportunities</h2>
                <p className="text-on-surface-variant text-xs font-label mt-0.5">
                  {opportunities.length} total · {opportunities.filter(o => o.status === 'active').length} active
                </p>
              </div>

              <div className="card overflow-hidden">
                {oppsLoading ? (
                  <div className="p-8 text-center text-on-surface-variant text-sm font-label">Loading…</div>
                ) : opportunities.length === 0 ? (
                  <div className="p-10 text-center">
                    <span className="material-symbols-outlined text-on-surface-variant text-4xl mb-3">explore</span>
                    <p className="text-on-surface-variant text-sm font-label">No opportunities yet. Create one below.</p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="bg-surface-container">
                        {['Title', 'Category', 'Department', 'Deadline', 'Spots', 'Status', 'Actions'].map((h) => (
                          <th key={h} className="text-left px-5 py-3 text-xs font-label font-semibold text-on-surface-variant uppercase tracking-widest">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {opportunities.map((op, i) => (
                        <tr key={op.id} className={`${i % 2 === 0 ? 'bg-surface-container-lowest' : 'bg-surface-container-low/40'} hover:bg-surface-container transition-colors`}>
                          <td className="px-5 py-3.5">
                            <p className="text-sm font-label font-semibold text-on-surface">{op.title}</p>
                            {op.stipend && <p className="text-xs text-on-surface-variant font-label">{op.stipend}</p>}
                          </td>
                          <td className="px-5 py-3.5 text-xs font-label text-on-surface-variant">{op.category}</td>
                          <td className="px-5 py-3.5 text-xs font-label text-on-surface-variant">{op.department || '—'}</td>
                          <td className="px-5 py-3.5 text-xs font-label text-on-surface-variant">
                            {new Date(op.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </td>
                          <td className="px-5 py-3.5 text-xs font-label text-on-surface-variant">{op.vacancies ?? '—'}</td>
                          <td className="px-5 py-3.5">
                            <span className={`status-badge ${op.status === 'active' ? 'status-approved' : 'status-rejected'}`}>
                              <span className="material-symbols-outlined text-[12px]">{op.status === 'active' ? 'check_circle' : 'cancel'}</span>
                              {op.status === 'active' ? 'Active' : 'Closed'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleEditOpp(op)}
                                className="text-xs font-label font-semibold px-2.5 py-1 rounded-full bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleToggleOpportunityStatus(op.id, op.status)}
                                className="text-xs font-label font-semibold px-2.5 py-1 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors"
                              >
                                {op.status === 'active' ? 'Close' : 'Reopen'}
                              </button>
                              <button
                                onClick={() => handleDeleteOpportunity(op.id)}
                                className="text-xs font-label font-semibold px-2.5 py-1 rounded-full bg-error/10 hover:bg-error/20 text-error transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Post / Edit opportunity form */}
              <div ref={formRef} className="card overflow-hidden">
                <div className="px-6 py-4 bg-surface-container-low flex items-center justify-between">
                  <div>
                    <p className="section-title mb-0 flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[18px]">{editingOpp ? 'edit' : 'add_circle'}</span>
                      {editingOpp ? 'Edit Opportunity' : 'Post New Opportunity'}
                    </p>
                    <p className="text-xs text-on-surface-variant font-label mt-0.5">
                      {editingOpp ? `Editing: ${editingOpp.title}` : 'Fill in the details below to publish a new campus opportunity.'}
                    </p>
                  </div>
                  {editingOpp && (
                    <button
                      type="button"
                      onClick={() => { setEditingOpp(null); setForm(EMPTY_FORM) }}
                      className="btn-ghost text-sm"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                {formSuccess && (
                  <div className="mx-6 mt-4 flex items-center gap-2 bg-tertiary-container/30 border border-tertiary/20 rounded-md p-3">
                    <span className="material-symbols-outlined text-tertiary text-[18px]">check_circle</span>
                    <p className="text-sm font-label text-on-surface">Opportunity published successfully!</p>
                  </div>
                )}
                {formError && (
                  <div className="mx-6 mt-4 flex items-center gap-2 bg-error-container/20 border border-error/20 rounded-md p-3">
                    <span className="material-symbols-outlined text-error text-[18px]">error</span>
                    <p className="text-sm font-label text-error">{formError}</p>
                  </div>
                )}

                <form onSubmit={handleFormSubmit} className="p-6 grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-label font-semibold text-on-surface-variant uppercase tracking-widest mb-1.5">Opportunity Title *</label>
                    <input required type="text" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Summer Research Fellowship 2025" className="input-field" />
                  </div>
                  <div>
                    <label className="block text-xs font-label font-semibold text-on-surface-variant uppercase tracking-widest mb-1.5">Category *</label>
                    <select required value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="input-field">
                      <option value="">Select a category</option>
                      {['Research Grant', 'Internship', 'Scholarship', 'Teaching Assistant', 'Study Abroad', 'Leadership Program'].map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-label font-semibold text-on-surface-variant uppercase tracking-widest mb-1.5">Department</label>
                    <input type="text" value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} placeholder="e.g. Faculty of Engineering" className="input-field" />
                  </div>
                  <div>
                    <label className="block text-xs font-label font-semibold text-on-surface-variant uppercase tracking-widest mb-1.5">Application Deadline *</label>
                    <input required type="date" value={form.deadline} onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))} className="input-field" />
                  </div>
                  <div>
                    <label className="block text-xs font-label font-semibold text-on-surface-variant uppercase tracking-widest mb-1.5">Number of Vacancies</label>
                    <input type="number" min="1" value={form.vacancies} onChange={(e) => setForm((f) => ({ ...f, vacancies: e.target.value }))} placeholder="e.g. 10" className="input-field" />
                  </div>
                  <div>
                    <label className="block text-xs font-label font-semibold text-on-surface-variant uppercase tracking-widest mb-1.5">Stipend / Compensation</label>
                    <input type="text" value={form.stipend} onChange={(e) => setForm((f) => ({ ...f, stipend: e.target.value }))} placeholder="e.g. $3,000 or Unpaid" className="input-field" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-label font-semibold text-on-surface-variant uppercase tracking-widest mb-1.5">Description *</label>
                    <textarea required rows={4} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Describe the opportunity, responsibilities, and what students will gain…" className="input-field resize-none" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-label font-semibold text-on-surface-variant uppercase tracking-widest mb-1.5">Eligibility Criteria</label>
                    <input type="text" value={form.eligibility} onChange={(e) => setForm((f) => ({ ...f, eligibility: e.target.value }))} placeholder="e.g. Open to 2nd and 3rd year undergrads with GPA ≥ 3.0" className="input-field" />
                  </div>
                  <div className="col-span-2 flex items-center gap-3 pt-2">
                    <button type="submit" disabled={formLoading} className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed">
                      {formLoading ? (
                        <><span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>{editingOpp ? 'Saving…' : 'Publishing…'}</>
                      ) : (
                        <><span className="material-symbols-outlined text-[16px]">{editingOpp ? 'save' : 'publish'}</span>{editingOpp ? 'Save Changes' : 'Publish Opportunity'}</>
                      )}
                    </button>
                    <button type="button" onClick={() => { setForm(EMPTY_FORM); setEditingOpp(null) }} className="btn-ghost">Clear</button>
                  </div>
                </form>
              </div>
            </>
          )}

          {/* ── APPLICATIONS ──────────────────────────────────── */}
          {activeNav === 'applications' && (
            <>
              <div className="mb-2">
                <h2 className="font-headline text-on-surface font-bold text-xl">All Applications</h2>
                <p className="text-on-surface-variant text-xs font-label mt-0.5">{applications.length} total applications</p>
              </div>

              {statCards}

              <div className="card overflow-hidden">
                <div className="px-6 py-4 bg-surface-container-low flex items-center justify-between">
                  <p className="section-title mb-0 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[18px]">assignment</span>
                    Applications
                  </p>
                  <div className="flex items-center gap-1">
                    {['all', 'pending', 'reviewing', 'approved', 'rejected'].map((t) => (
                      <button
                        key={t}
                        onClick={() => setActiveTab(t)}
                        className={`px-3 py-1 rounded-full text-xs font-label font-semibold transition-colors ${
                          activeTab === t ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container'
                        }`}
                      >
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {appsLoading ? (
                  <div className="p-6 text-center text-on-surface-variant text-sm font-label">Loading…</div>
                ) : filteredApps.length === 0 ? (
                  <div className="p-10 text-center">
                    <span className="material-symbols-outlined text-on-surface-variant text-4xl mb-3">assignment</span>
                    <p className="text-on-surface-variant text-sm font-label">No applications found.</p>
                  </div>
                ) : (
                  <>
                    <table className="w-full">
                      <thead>
                        <tr className="bg-surface-container">
                          {['Student', 'Opportunity', 'Category', 'Submitted', 'Status', 'Action'].map((h) => (
                            <th key={h} className="text-left px-6 py-3 text-xs font-label font-semibold text-on-surface-variant uppercase tracking-widest">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredApps.map((app, i) => {
                          const s = STATUS_MAP[app.status] ?? STATUS_MAP.pending
                          return (
                            <tr key={app.id} className={`${i % 2 === 0 ? 'bg-surface-container-lowest' : 'bg-surface-container-low/40'} hover:bg-surface-container transition-colors`}>
                              <td className="px-6 py-3.5">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold font-headline flex-shrink-0">
                                    {app.profiles?.avatar || app.profiles?.name?.[0] || '?'}
                                  </div>
                                  <div>
                                    <p className="text-sm font-label font-semibold text-on-surface">{app.profiles?.name ?? 'Unknown'}</p>
                                    <p className="text-xs font-label text-on-surface-variant">{app.profiles?.email}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-3.5 text-sm font-label text-on-surface">{app.opportunities?.title}</td>
                              <td className="px-6 py-3.5 text-sm font-label text-on-surface-variant">{app.opportunities?.category}</td>
                              <td className="px-6 py-3.5 text-sm font-label text-on-surface-variant">
                                {new Date(app.applied_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </td>
                              <td className="px-6 py-3.5">
                                <span className={`status-badge ${s.cls}`}>
                                  <span className="material-symbols-outlined text-[12px]">{s.icon}</span>{s.label}
                                </span>
                              </td>
                              <td className="px-6 py-3.5">
                                <select
                                  value={app.status}
                                  onChange={(e) => handleStatusChange(app.id, e.target.value)}
                                  className="text-xs font-label bg-surface-container-low rounded-md px-2 py-1.5 text-on-surface outline-none border border-outline-variant/30 cursor-pointer"
                                >
                                  <option value="pending">Pending</option>
                                  <option value="reviewing">Reviewing</option>
                                  <option value="approved">Approved</option>
                                  <option value="rejected">Rejected</option>
                                </select>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    <div className="px-6 py-3 bg-surface-container-low">
                      <p className="text-xs text-on-surface-variant font-label">Showing {filteredApps.length} of {applications.length} applications</p>
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {/* ── USER MANAGEMENT ───────────────────────────────── */}
          {activeNav === 'users' && (
            <>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h2 className="font-headline text-on-surface font-bold text-xl">User Management</h2>
                  <p className="text-on-surface-variant text-xs font-label mt-0.5">{users.length} registered users</p>
                </div>
                <button
                  onClick={() => { setAddUserOpen((v) => !v); setAddUserError(null); setAddUserSuccess(false) }}
                  className="btn-primary text-sm"
                >
                  <span className="material-symbols-outlined text-[16px]">person_add</span>
                  Add User
                </button>
              </div>

              {/* Add User Form */}
              {addUserOpen && (
                <div className="card overflow-hidden">
                  <div className="px-6 py-4 bg-surface-container-low flex items-center justify-between">
                    <p className="section-title mb-0 flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[18px]">person_add</span>
                      Create New User
                    </p>
                    <button onClick={() => setAddUserOpen(false)} className="text-on-surface-variant hover:text-on-surface">
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </div>
                  {addUserSuccess && (
                    <div className="mx-6 mt-4 flex items-center gap-2 bg-tertiary-container/30 border border-tertiary/20 rounded-md p-3">
                      <span className="material-symbols-outlined text-tertiary text-[18px]">check_circle</span>
                      <p className="text-sm font-label text-on-surface">User created! A confirmation email has been sent.</p>
                    </div>
                  )}
                  {addUserError && (
                    <div className="mx-6 mt-4 flex items-center gap-2 bg-error-container/20 border border-error/20 rounded-md p-3">
                      <span className="material-symbols-outlined text-error text-[18px]">error</span>
                      <p className="text-sm font-label text-error">{addUserError}</p>
                    </div>
                  )}
                  <form onSubmit={handleAddUser} className="p-6 grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-label font-semibold text-on-surface-variant uppercase tracking-widest mb-1.5">Full Name *</label>
                      <input required type="text" value={addUserForm.name} onChange={(e) => setAddUserForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Jane Smith" className="input-field" />
                    </div>
                    <div>
                      <label className="block text-xs font-label font-semibold text-on-surface-variant uppercase tracking-widest mb-1.5">Role *</label>
                      <select required value={addUserForm.role} onChange={(e) => setAddUserForm((f) => ({ ...f, role: e.target.value }))} className="input-field">
                        <option value="student">Student</option>
                        <option value="mentor">Mentor</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-label font-semibold text-on-surface-variant uppercase tracking-widest mb-1.5">Email *</label>
                      <input required type="email" value={addUserForm.email} onChange={(e) => setAddUserForm((f) => ({ ...f, email: e.target.value }))} placeholder="user@university.edu" className="input-field" />
                    </div>
                    <div>
                      <label className="block text-xs font-label font-semibold text-on-surface-variant uppercase tracking-widest mb-1.5">Temporary Password *</label>
                      <input required type="password" minLength={6} value={addUserForm.password} onChange={(e) => setAddUserForm((f) => ({ ...f, password: e.target.value }))} placeholder="Min. 6 characters" className="input-field" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-label font-semibold text-on-surface-variant uppercase tracking-widest mb-1.5">Department</label>
                      <input type="text" value={addUserForm.department} onChange={(e) => setAddUserForm((f) => ({ ...f, department: e.target.value }))} placeholder="e.g. Computer Science" className="input-field" />
                    </div>
                    <div className="col-span-2 flex items-center gap-3 pt-2">
                      <button type="submit" disabled={addUserLoading} className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed">
                        {addUserLoading ? (
                          <><span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>Creating…</>
                        ) : (
                          <><span className="material-symbols-outlined text-[16px]">person_add</span>Create User</>
                        )}
                      </button>
                      <button type="button" onClick={() => setAddUserOpen(false)} className="btn-ghost">Cancel</button>
                    </div>
                  </form>
                </div>
              )}

              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'Total Users',    value: usersLoading ? '…' : users.length,                                     icon: 'group',                color: 'text-primary bg-primary/10' },
                  { label: 'Students',       value: usersLoading ? '…' : users.filter(u => u.role === 'student').length,    icon: 'person',               color: 'text-secondary bg-secondary-container' },
                  { label: 'Mentors',        value: usersLoading ? '…' : users.filter(u => u.role === 'mentor').length,     icon: 'psychology',           color: 'text-tertiary bg-tertiary-container' },
                  { label: 'Administrators', value: usersLoading ? '…' : users.filter(u => u.role === 'admin').length,      icon: 'admin_panel_settings', color: 'text-error bg-error-container/20' },
                ].map((s) => (
                  <div key={s.label} className="stat-card flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0 ${s.color}`}>
                      <span className="material-symbols-outlined text-[18px]">{s.icon}</span>
                    </div>
                    <div>
                      <p className="font-headline text-xl font-bold text-on-surface">{s.value}</p>
                      <p className="text-xs text-on-surface-variant font-label">{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="card overflow-hidden">
                <div className="px-6 py-4 bg-surface-container-low flex items-center justify-between">
                  <p className="section-title mb-0 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[18px]">manage_accounts</span>
                    All Users
                  </p>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[14px]">search</span>
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Search users…"
                      className="pl-8 pr-3 py-1.5 bg-surface-container rounded-full text-xs text-on-surface placeholder:text-on-surface-variant outline-none w-44"
                    />
                  </div>
                </div>
                {usersLoading ? (
                  <div className="p-8 text-center text-on-surface-variant text-sm font-label">Loading…</div>
                ) : users.length === 0 ? (
                  <div className="p-10 text-center">
                    <span className="material-symbols-outlined text-on-surface-variant text-4xl mb-3">group</span>
                    <p className="text-on-surface-variant text-sm font-label">No users found.</p>
                  </div>
                ) : (
                  <>
                    <table className="w-full">
                      <thead>
                        <tr className="bg-surface-container">
                          {['User', 'Role', 'Department', 'Joined', 'Actions'].map((h) => (
                            <th key={h} className="text-left px-6 py-3 text-xs font-label font-semibold text-on-surface-variant uppercase tracking-widest">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {users
                          .filter((u) => {
                            const q = userSearch.toLowerCase()
                            return !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.role?.includes(q)
                          })
                          .map((u, i) => (
                          <tr key={u.id} className={`${i % 2 === 0 ? 'bg-surface-container-lowest' : 'bg-surface-container-low/40'} hover:bg-surface-container transition-colors`}>
                            <td className="px-6 py-3.5">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold font-headline flex-shrink-0 ${u.role === 'mentor' ? 'bg-tertiary' : 'bg-gradient-primary'}`}>
                                  {u.avatar || u.name?.[0] || '?'}
                                </div>
                                <div>
                                  <p className="text-sm font-label font-semibold text-on-surface">{u.name}</p>
                                  <p className="text-xs font-label text-on-surface-variant">{u.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-3.5">
                              {u.id === user?.id ? (
                                <span className="status-badge status-approved">Admin (you)</span>
                              ) : (
                                <select
                                  value={u.role}
                                  disabled={roleUpdating.has(u.id)}
                                  onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                  className="text-xs font-label bg-surface-container-low rounded-md px-2 py-1.5 text-on-surface outline-none border border-outline-variant/30 cursor-pointer disabled:opacity-50"
                                >
                                  <option value="student">Student</option>
                                  <option value="mentor">Mentor</option>
                                  <option value="admin">Admin</option>
                                </select>
                              )}
                            </td>
                            <td className="px-6 py-3.5 text-sm font-label text-on-surface-variant">{u.department || '—'}</td>
                            <td className="px-6 py-3.5 text-sm font-label text-on-surface-variant">
                              {u.created_at ? new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                            </td>
                            <td className="px-6 py-3.5">
                              {u.id !== user?.id && (
                                <button
                                  onClick={() => handleDeleteUser(u.id)}
                                  className="text-xs font-label font-semibold px-2.5 py-1 rounded-full bg-error/10 hover:bg-error/20 text-error transition-colors"
                                >
                                  Delete
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="px-6 py-3 bg-surface-container-low">
                      <p className="text-xs text-on-surface-variant font-label">{users.length} users total</p>
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {/* ── REPORTS ───────────────────────────────────────── */}
          {activeNav === 'reports' && (
            <>
              <div className="mb-2">
                <h2 className="font-headline text-on-surface font-bold text-xl">Reports & Analytics</h2>
                <p className="text-on-surface-variant text-xs font-label mt-0.5">Overview of all platform activity</p>
              </div>

              {statCards}

              <div className="grid grid-cols-2 gap-6">
                {/* Applications by status */}
                <div className="card p-5">
                  <p className="section-title">Applications by Status</p>
                  {applications.length === 0 ? (
                    <p className="text-on-surface-variant text-xs font-label">No data yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {statusBreakdown.map((s) => {
                        const pct = Math.round((s.count / (applications.length || 1)) * 100)
                        return (
                          <div key={s.label}>
                            <div className="flex items-center justify-between mb-1.5">
                              <p className="text-xs font-label text-on-surface">{s.label}</p>
                              <p className="text-xs font-label font-bold text-on-surface">
                                {s.count} <span className="text-on-surface-variant font-normal">({pct}%)</span>
                              </p>
                            </div>
                            <div className="h-2 bg-surface-container rounded-full overflow-hidden">
                              <div className={`h-full ${s.color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Applications by category */}
                <div className="card p-5">
                  <p className="section-title">Applications by Category</p>
                  {categoryBreakdown.length === 0 ? (
                    <p className="text-on-surface-variant text-xs font-label">No data yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {categoryBreakdown.map((c, i) => (
                        <div key={c.label}>
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-xs font-label text-on-surface">{c.label}</p>
                            <p className="text-xs font-label font-bold text-on-surface">
                              {c.count} <span className="text-on-surface-variant font-normal">({c.pct}%)</span>
                            </p>
                          </div>
                          <div className="h-2 bg-surface-container rounded-full overflow-hidden">
                            <div className={`h-full ${BAR_COLORS[i % BAR_COLORS.length]} rounded-full transition-all duration-500`} style={{ width: `${c.pct}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Applications by department */}
                <div className="card p-5">
                  <p className="section-title">Applications by Department</p>
                  {deptBreakdown.length === 0 ? (
                    <p className="text-on-surface-variant text-xs font-label">No data yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {deptBreakdown.map((d, i) => (
                        <div key={d.label}>
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-xs font-label text-on-surface truncate max-w-[65%]">{d.label}</p>
                            <p className="text-xs font-label font-bold text-on-surface">{d.count}</p>
                          </div>
                          <div className="h-2 bg-surface-container rounded-full overflow-hidden">
                            <div className={`h-full ${BAR_COLORS[i % BAR_COLORS.length]} rounded-full transition-all duration-500`} style={{ width: `${d.pct}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Opportunity stats */}
                <div className="card p-5">
                  <p className="section-title">Opportunity Overview</p>
                  <div className="space-y-3">
                    {[
                      { label: 'Active Opportunities', value: opportunities.filter(o => o.status === 'active').length },
                      { label: 'Closed Opportunities', value: opportunities.filter(o => o.status === 'closed').length },
                      { label: 'Total Vacancies',      value: opportunities.reduce((sum, o) => sum + (o.vacancies || 0), 0) },
                      { label: 'With Stipend',         value: opportunities.filter(o => o.stipend && o.stipend.toLowerCase() !== 'unpaid').length },
                    ].map((s) => (
                      <div key={s.label} className="flex items-center justify-between px-4 py-3 bg-surface-container-low rounded-lg">
                        <p className="text-sm font-label text-on-surface">{s.label}</p>
                        <p className="text-sm font-headline font-bold text-on-surface">{oppsLoading ? '…' : s.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── SETTINGS ──────────────────────────────────────── */}
          {activeNav === 'settings' && (
            <div className="max-w-2xl">
              <h2 className="font-headline text-on-surface font-bold text-xl mb-6">Settings</h2>

              <div className="card p-6 mb-6">
                <p className="section-title">Admin Profile</p>
                <div className="flex items-center gap-5 mb-6">
                  <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center text-white text-xl font-bold font-headline flex-shrink-0">
                    {user?.avatar || user?.name?.[0] || '?'}
                  </div>
                  <div>
                    <p className="font-headline text-on-surface font-bold text-lg">{user?.name}</p>
                    <p className="text-on-surface-variant text-sm font-label">{user?.email}</p>
                    <span className="status-badge status-approved mt-1 inline-flex">Administrator</span>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { label: 'Department', value: user?.department || '—', icon: 'account_balance' },
                    { label: 'Job Title',  value: user?.title     || '—', icon: 'work' },
                  ].map((f) => (
                    <div key={f.label} className="flex items-center gap-3 p-3 bg-surface-container-low rounded-lg">
                      <span className="material-symbols-outlined text-on-surface-variant text-[18px]">{f.icon}</span>
                      <div>
                        <p className="text-xs text-on-surface-variant font-label uppercase tracking-wide">{f.label}</p>
                        <p className="text-sm text-on-surface font-label font-semibold">{f.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card p-6 mb-6">
                <p className="section-title">Your Activity</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Opportunities Posted',  value: oppsLoading ? '…' : opportunities.filter(o => o.created_by === user?.id).length },
                    { label: 'Applications Reviewed', value: appsLoading ? '…' : applications.filter(a => a.status !== 'pending').length },
                    { label: 'Students Approved',     value: appsLoading ? '…' : counts.approved },
                    { label: 'Active Listings',       value: oppsLoading ? '…' : opportunities.filter(o => o.status === 'active').length },
                  ].map((s) => (
                    <div key={s.label} className="flex items-center gap-3 p-4 bg-surface-container-low rounded-lg">
                      <div>
                        <p className="font-headline text-on-surface font-bold text-lg">{s.value}</p>
                        <p className="text-xs text-on-surface-variant font-label">{s.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card p-6">
                <p className="section-title">Notification Preferences</p>
                <div className="space-y-4">
                  {[
                    { label: 'New application submitted',        defaultChecked: true },
                    { label: 'Application status changed',       defaultChecked: true },
                    { label: 'New user registered',              defaultChecked: false },
                    { label: 'Opportunity deadline approaching', defaultChecked: true },
                  ].map((pref) => (
                    <label key={pref.label} className="flex items-center gap-3 cursor-pointer select-none">
                      <input type="checkbox" defaultChecked={pref.defaultChecked} className="sr-only peer" />
                      <div className="w-10 h-5 rounded-full bg-surface-container-high peer-checked:bg-primary transition-colors relative flex-shrink-0 pointer-events-none">
                        <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
                      </div>
                      <span className="text-sm font-label text-on-surface">{pref.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  )
}
