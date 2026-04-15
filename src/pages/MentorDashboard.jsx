import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useTheme } from '../hooks/useTheme'

const STATUS_MAP = {
  reviewing: { label: 'Reviewing',    cls: 'status-reviewing', icon: 'pending' },
  approved:  { label: 'Approved',     cls: 'status-approved',  icon: 'check_circle' },
  pending:   { label: 'Pending',      cls: 'status-pending',   icon: 'schedule' },
  rejected:  { label: 'Not Selected', cls: 'status-rejected',  icon: 'cancel' },
}

const NAV_ITEMS = [
  { id: 'dashboard',     label: 'Dashboard',        icon: 'dashboard' },
  { id: 'opportunities', label: 'My Opportunities',  icon: 'explore' },
  { id: 'applications',  label: 'Applications',      icon: 'assignment' },
  { id: 'messages',      label: 'Messages',          icon: 'chat' },
  { id: 'settings',      label: 'Settings',          icon: 'settings' },
]

const EMPTY_FORM = {
  title: '', category: '', description: '',
  deadline: '', vacancies: '', stipend: '',
  department: '', eligibility: '',
}

export default function MentorDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { dark, toggle: toggleTheme } = useTheme()

  // UI state
  const [activeNav, setActiveNav]             = useState('dashboard')
  const [sidebarOpen, setSidebarOpen]             = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [focusForm, setFocusForm]             = useState(false)

  // Data state
  const [myOpportunities, setMyOpportunities] = useState([])
  const [myApplications, setMyApplications]   = useState([])
  const [students, setStudents]               = useState([])
  const [oppsLoading, setOppsLoading]         = useState(true)
  const [appsLoading, setAppsLoading]         = useState(true)

  // Messages state
  const [messages, setMessages]               = useState([])
  const [selectedChatUser, setSelectedChatUser] = useState(null)
  const [messageInput, setMessageInput]       = useState('')
  const [chatSearch, setChatSearch]           = useState('')
  const [msgSending, setMsgSending]           = useState(false)

  // Form state
  const [form, setForm]           = useState(EMPTY_FORM)
  const [formLoading, setFormLoading] = useState(false)
  const [formSuccess, setFormSuccess] = useState(false)
  const [formError, setFormError]     = useState(null)
  const [editingOpp, setEditingOpp]   = useState(null)
  const [notifOpen, setNotifOpen]     = useState(false)

  const formRef        = useRef(null)
  const profileMenuRef = useRef(null)
  const chatEndRef     = useRef(null)
  const notifRef       = useRef(null)

  // ── Fetch my opportunities ──────────────────────────────
  const fetchMyOpportunities = useCallback(async () => {
    if (!user?.id) return
    setOppsLoading(true)
    const { data } = await supabase
      .from('opportunities')
      .select('*')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })
    setMyOpportunities(data ?? [])
    setOppsLoading(false)
  }, [user?.id])

  // ── Fetch applications to my opportunities ──────────────
  const fetchMyApplications = useCallback(async () => {
    setAppsLoading(true)
    const { data } = await supabase
      .from('applications')
      .select('*, profiles(id, name, avatar, email, department, year), opportunities(title, category, department)')
      .order('applied_at', { ascending: false })
    setMyApplications(data ?? [])
    setAppsLoading(false)
  }, [])

  // ── Fetch messages ──────────────────────────────────────
  const fetchMessages = useCallback(async () => {
    if (!user?.id) return
    const { data } = await supabase
      .from('messages')
      .select(`*, sender:profiles!messages_sender_id_fkey(id, name, avatar, role), receiver:profiles!messages_receiver_id_fkey(id, name, avatar, role)`)
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: true })
    setMessages(data ?? [])
  }, [user?.id])

  // ── Fetch students (for messaging) ─────────────────────
  const fetchStudents = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, name, avatar, department, year, role')
      .eq('role', 'student')
      .order('name')
    setStudents(data ?? [])
  }, [])

  useEffect(() => { fetchMyOpportunities() }, [fetchMyOpportunities])
  useEffect(() => { fetchMyApplications()  }, [fetchMyApplications])

  // Lazy-load messages & students when navigating to Messages
  useEffect(() => {
    if (activeNav !== 'messages') return
    fetchMessages()
    fetchStudents()
    const channel = supabase
      .channel(`mentor-msgs-${user?.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user?.id}` }, () => fetchMessages())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [activeNav, user?.id, fetchMessages, fetchStudents])

  // Scroll chat to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, selectedChatUser])

  // Scroll to form when "New Opportunity" clicked
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
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) setProfileMenuOpen(false)
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

  // ── Handlers ────────────────────────────────────────────
  async function handleStatusChange(id, newStatus) {
    await supabase.from('applications').update({ status: newStatus }).eq('id', id)
    setMyApplications((prev) => prev.map((a) => a.id === id ? { ...a, status: newStatus } : a))
  }

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

  async function handleToggleOppStatus(id, current) {
    const next = current === 'active' ? 'closed' : 'active'
    await supabase.from('opportunities').update({ status: next }).eq('id', id)
    setMyOpportunities((prev) => prev.map((o) => o.id === id ? { ...o, status: next } : o))
  }

  async function handleDeleteOpp(id) {
    if (!window.confirm('Delete this opportunity? This cannot be undone.')) return
    await supabase.from('opportunities').delete().eq('id', id)
    setMyOpportunities((prev) => prev.filter((o) => o.id !== id))
  }

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
    await fetchMyOpportunities()
    setFormSuccess(true)
    setTimeout(() => setFormSuccess(false), 3000)
  }

  async function sendMessage() {
    if (!messageInput.trim() || !selectedChatUser) return
    const content = messageInput.trim()
    setMessageInput('')
    setMsgSending(true)
    const { data, error } = await supabase
      .from('messages')
      .insert({ sender_id: user.id, receiver_id: selectedChatUser.id, content })
      .select(`*, sender:profiles!messages_sender_id_fkey(id, name, avatar, role), receiver:profiles!messages_receiver_id_fkey(id, name, avatar, role)`)
      .single()
    setMsgSending(false)
    if (!error && data) setMessages((prev) => [...prev, data])
  }

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  // ── Derived data ─────────────────────────────────────────
  const counts = {
    activeOpps:  myOpportunities.filter((o) => o.status === 'active').length,
    totalApps:   myApplications.length,
    pendingApps: myApplications.filter((a) => a.status === 'pending' || a.status === 'reviewing').length,
    approved:    myApplications.filter((a) => a.status === 'approved').length,
  }

  // Build conversation list from messages
  const conversationsMap = {}
  messages.forEach((m) => {
    const otherId = m.sender_id === user?.id ? m.receiver_id : m.sender_id
    const other   = m.sender_id === user?.id ? m.receiver   : m.sender
    if (!other) return
    if (!conversationsMap[otherId] || new Date(m.created_at) > new Date(conversationsMap[otherId].lastMsg.created_at)) {
      conversationsMap[otherId] = { user: other, lastMsg: m }
    }
  })
  const conversations = Object.values(conversationsMap).sort(
    (a, b) => new Date(b.lastMsg.created_at) - new Date(a.lastMsg.created_at)
  )
  const conversationUserIds = new Set(conversations.map((c) => c.user?.id))

  const chatMessages = selectedChatUser
    ? messages.filter((m) =>
        (m.sender_id === user?.id && m.receiver_id === selectedChatUser.id) ||
        (m.sender_id === selectedChatUser.id && m.receiver_id === user?.id)
      )
    : []

  const newContacts = students.filter(
    (s) => !conversationUserIds.has(s.id) && s.name?.toLowerCase().includes(chatSearch.toLowerCase())
  )
  const filteredConversations = conversations.filter(
    (c) => c.user?.name?.toLowerCase().includes(chatSearch.toLowerCase())
  )

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex font-body">

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 flex flex-col bg-surface shadow-elevated z-50">
            <div className="flex items-center gap-3 px-5 py-5">
              <span className="material-symbols-outlined text-tertiary text-2xl flex-shrink-0">psychology</span>
              <div>
                <p className="font-headline text-on-surface font-bold text-sm leading-tight">Academic Atelier</p>
                <p className="text-on-surface-variant text-xs font-label">Mentor Portal</p>
              </div>
            </div>
            <nav className="flex-1 px-2 py-2 space-y-0.5">
              {NAV_ITEMS.map((item) => (
                <button key={item.id} onClick={() => { setActiveNav(item.id); setMobileSidebarOpen(false) }}
                  className={`nav-item w-full justify-start ${activeNav === item.id ? 'active' : ''}`}>
                  <span className="material-symbols-outlined text-[18px] flex-shrink-0">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
            <div className="px-2 pb-4 space-y-0.5">
              <button onClick={handleLogout} className="nav-item w-full justify-start text-error hover:bg-error/10 hover:text-error">
                <span className="material-symbols-outlined text-[18px] flex-shrink-0">logout</span>
                <span>Sign Out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ── Desktop Sidebar ──────────────────────────────── */}
      <aside className={`hidden md:flex flex-col flex-shrink-0 ${sidebarOpen ? 'w-60' : 'w-16'} bg-surface/80 backdrop-blur-glass transition-all duration-300 relative z-10`}>
        <div className={`flex items-center ${sidebarOpen ? 'gap-3 px-5' : 'justify-center px-2'} py-5`}>
          <span className="material-symbols-outlined text-tertiary text-2xl flex-shrink-0">psychology</span>
          {sidebarOpen && (
            <div>
              <p className="font-headline text-on-surface font-bold text-sm leading-tight">Academic Atelier</p>
              <p className="text-on-surface-variant text-xs font-label">Mentor Portal</p>
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

      {/* ── Main ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <header className="flex items-center justify-between px-4 md:px-8 py-4 bg-surface/80 backdrop-blur-glass sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden w-9 h-9 rounded-full bg-surface-container flex items-center justify-center hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-[20px] text-on-surface-variant">menu</span>
            </button>
            <div>
              <h2 className="font-headline text-on-surface font-bold text-base md:text-lg leading-tight">
                {NAV_ITEMS.find((n) => n.id === activeNav)?.label ?? 'Dashboard'}
              </h2>
              <p className="text-on-surface-variant text-xs font-label hidden md:block">
                {user?.department}{user?.title ? ` · ${user.title}` : ' · Mentor'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <button
              onClick={toggleTheme}
              className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center hover:bg-surface-container-high transition-colors"
              title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                {dark ? 'light_mode' : 'dark_mode'}
              </span>
            </button>

            <div ref={notifRef} className="relative">
              <button
                onClick={() => setNotifOpen((v) => !v)}
                className="relative w-9 h-9 rounded-full bg-surface-container flex items-center justify-center hover:bg-surface-container-high transition-colors"
              >
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant">notifications</span>
                {myApplications.filter((a) => a.status === 'pending' || a.status === 'reviewing').length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-error" />
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] card p-0 overflow-hidden z-50">
                  <div className="px-4 py-3 bg-surface-container-low flex items-center justify-between">
                    <p className="text-sm font-headline font-bold text-on-surface">Notifications</p>
                    {myApplications.filter((a) => a.status === 'pending' || a.status === 'reviewing').length > 0 && (
                      <span className="text-xs font-label font-semibold text-error bg-error/10 px-2 py-0.5 rounded-full">
                        {myApplications.filter((a) => a.status === 'pending' || a.status === 'reviewing').length} pending
                      </span>
                    )}
                  </div>
                  {myApplications.filter((a) => a.status === 'pending' || a.status === 'reviewing').length === 0 ? (
                    <p className="px-4 py-4 text-xs text-on-surface-variant font-label text-center">No pending applications</p>
                  ) : (
                    myApplications.filter((a) => a.status === 'pending' || a.status === 'reviewing').slice(0, 6).map((a) => (
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
              onClick={() => { setActiveNav('messages') }}
              className="relative w-9 h-9 rounded-full bg-surface-container flex items-center justify-center hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">chat</span>
              {messages.filter((m) => m.receiver_id === user?.id && !m.read).length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
              )}
            </button>
            <button
              onClick={() => { setActiveNav('opportunities'); setFocusForm(true) }}
              className="btn-primary text-sm"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span className="hidden sm:inline">New Opportunity</span>
            </button>
            <div ref={profileMenuRef} className="relative">
              <div
                onClick={() => setProfileMenuOpen((v) => !v)}
                className="w-9 h-9 rounded-full bg-tertiary flex items-center justify-center text-white text-xs font-bold font-headline cursor-pointer select-none"
              >
                {user?.avatar || user?.name?.[0] || '?'}
              </div>
              {profileMenuOpen && (
                <div className="absolute right-0 top-11 w-48 bg-surface-container-low rounded-xl shadow-elevated border border-outline-variant/20 py-1.5 z-50">
                  <div className="px-4 py-2 border-b border-outline-variant/20">
                    <p className="text-xs font-label font-semibold text-on-surface truncate">{user?.name ?? 'Mentor'}</p>
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

        {/* Page body */}
        <main className={`flex-1 ${activeNav === 'messages' ? 'overflow-hidden' : 'px-4 py-4 md:px-8 md:py-6 pb-20 md:pb-6 overflow-y-auto scrollbar-hide space-y-6'}`}>

          {/* ── DASHBOARD ─────────────────────────────────── */}
          {activeNav === 'dashboard' && (
            <>
              {/* Welcome banner */}
              <div className="bg-gradient-to-r from-tertiary to-primary rounded-xl p-6 relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10" />
                <div className="absolute bottom-2 right-24 w-24 h-24 rounded-full bg-white/5" />
                <div className="relative">
                  <p className="font-headline text-white text-xl font-extrabold mb-0.5">
                    Welcome back, {user?.name?.split(' ')[0]} 👋
                  </p>
                  <p className="text-white/70 text-sm font-label mb-4">
                    {user?.department ? `${user.department} · ` : ''}Mentor Portal
                  </p>
                  <div className="flex items-center gap-4 flex-wrap">
                    {[
                      { value: counts.activeOpps,  label: 'Active Opportunities' },
                      { value: counts.totalApps,   label: 'Applications Received' },
                      { value: counts.pendingApps, label: 'Pending Review' },
                      { value: counts.approved,    label: 'Students Placed' },
                    ].map((s) => (
                      <div key={s.label}>
                        <p className="font-headline text-white text-2xl font-extrabold">{s.value}</p>
                        <p className="text-white/60 text-xs font-label">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Stat cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Active Opportunities', value: oppsLoading ? '…' : counts.activeOpps,  icon: 'explore',         color: 'text-tertiary bg-tertiary-container' },
                  { label: 'Total Applications',   value: appsLoading ? '…' : counts.totalApps,   icon: 'assignment',      color: 'text-primary bg-primary/10' },
                  { label: 'Pending Review',        value: appsLoading ? '…' : counts.pendingApps, icon: 'pending_actions', color: 'text-error bg-error-container/20' },
                  { label: 'Students Placed',       value: appsLoading ? '…' : counts.approved,    icon: 'verified',        color: 'text-secondary bg-secondary-container' },
                ].map((s) => (
                  <div key={s.label} className="stat-card flex items-start gap-4">
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

              {/* Recent applications + quick actions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Recent applications */}
                <div className="md:col-span-2 card overflow-hidden">
                  <div className="px-5 py-4 bg-surface-container-low flex items-center justify-between">
                    <p className="section-title mb-0">Recent Applications</p>
                    <button onClick={() => setActiveNav('applications')} className="text-xs text-primary font-label font-semibold hover:underline">View all →</button>
                  </div>
                  {appsLoading ? (
                    <div className="p-6 text-center text-on-surface-variant text-xs font-label">Loading…</div>
                  ) : myApplications.length === 0 ? (
                    <div className="p-8 text-center">
                      <span className="material-symbols-outlined text-on-surface-variant text-3xl mb-2">inbox</span>
                      <p className="text-on-surface-variant text-sm font-label">No applications yet. Post opportunities to get started.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto"><table className="w-full">
                      <thead>
                        <tr className="bg-surface-container">
                          {['Student', 'Opportunity', 'Status'].map((h) => (
                            <th key={h} className="text-left px-5 py-3 text-xs font-label font-semibold text-on-surface-variant uppercase tracking-widest">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {myApplications.slice(0, 5).map((app, i) => {
                          const s = STATUS_MAP[app.status] ?? STATUS_MAP.pending
                          return (
                            <tr key={app.id} className={`${i % 2 === 0 ? 'bg-surface-container-lowest' : 'bg-surface-container-low/40'} hover:bg-surface-container transition-colors`}>
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-tertiary/15 flex items-center justify-center text-tertiary text-xs font-bold flex-shrink-0">
                                    {app.profiles?.avatar || app.profiles?.name?.[0] || '?'}
                                  </div>
                                  <span className="text-sm font-label font-semibold text-on-surface">{app.profiles?.name ?? '—'}</span>
                                </div>
                              </td>
                              <td className="px-5 py-3 text-sm font-label text-on-surface-variant">{app.opportunities?.title ?? '—'}</td>
                              <td className="px-5 py-3">
                                <span className={`status-badge ${s.cls}`}>
                                  <span className="material-symbols-outlined text-[12px]">{s.icon}</span>{s.label}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table></div>
                  )}
                </div>

                {/* Quick actions */}
                <div className="card p-5">
                  <p className="section-title mb-4">Quick Actions</p>
                  <div className="space-y-2">
                    {[
                      { label: 'Post New Opportunity', icon: 'add_circle', action: () => { setActiveNav('opportunities'); setFocusForm(true) }, color: 'text-tertiary' },
                      { label: 'Review Applications',  icon: 'assignment_turned_in', action: () => setActiveNav('applications'), color: 'text-primary' },
                      { label: 'Message a Student',    icon: 'chat',                 action: () => setActiveNav('messages'),    color: 'text-secondary' },
                      { label: 'View My Listings',     icon: 'list_alt',             action: () => setActiveNav('opportunities'), color: 'text-on-surface-variant' },
                    ].map((a) => (
                      <button
                        key={a.label}
                        onClick={a.action}
                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-surface-container transition-colors text-left"
                      >
                        <span className={`material-symbols-outlined text-[20px] ${a.color}`}>{a.icon}</span>
                        <span className="text-sm font-label font-semibold text-on-surface">{a.label}</span>
                        <span className="material-symbols-outlined text-[14px] text-on-surface-variant ml-auto">arrow_forward</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── MY OPPORTUNITIES ──────────────────────────── */}
          {activeNav === 'opportunities' && (
            <>
              <div className="mb-2">
                <h2 className="font-headline text-on-surface font-bold text-xl">My Opportunities</h2>
                <p className="text-on-surface-variant text-xs font-label mt-0.5">
                  {myOpportunities.length} posted · {counts.activeOpps} active
                </p>
              </div>

              <div className="card overflow-hidden">
                {oppsLoading ? (
                  <div className="p-8 text-center text-on-surface-variant text-sm font-label">Loading…</div>
                ) : myOpportunities.length === 0 ? (
                  <div className="p-10 text-center">
                    <span className="material-symbols-outlined text-on-surface-variant text-4xl mb-3">explore_off</span>
                    <p className="text-on-surface-variant text-sm font-label">You haven't posted any opportunities yet. Use the form below to get started.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto"><table className="w-full">
                    <thead>
                      <tr className="bg-surface-container">
                        {['Title', 'Category', 'Deadline', 'Spots', 'Status', 'Actions'].map((h) => (
                          <th key={h} className="text-left px-5 py-3 text-xs font-label font-semibold text-on-surface-variant uppercase tracking-widest">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {myOpportunities.map((op, i) => (
                        <tr key={op.id} className={`${i % 2 === 0 ? 'bg-surface-container-lowest' : 'bg-surface-container-low/40'} hover:bg-surface-container transition-colors`}>
                          <td className="px-5 py-3.5">
                            <p className="text-sm font-label font-semibold text-on-surface">{op.title}</p>
                            {op.stipend && <p className="text-xs text-on-surface-variant font-label">{op.stipend}</p>}
                          </td>
                          <td className="px-5 py-3.5 text-xs font-label text-on-surface-variant">{op.category}</td>
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
                                onClick={() => handleToggleOppStatus(op.id, op.status)}
                                className="text-xs font-label font-semibold px-2.5 py-1 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors"
                              >
                                {op.status === 'active' ? 'Close' : 'Reopen'}
                              </button>
                              <button
                                onClick={() => handleDeleteOpp(op.id)}
                                className="text-xs font-label font-semibold px-2.5 py-1 rounded-full bg-error/10 hover:bg-error/20 text-error transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table></div>
                )}
              </div>

              {/* Post / Edit opportunity form */}
              <div ref={formRef} className="card overflow-hidden">
                <div className="px-6 py-4 bg-surface-container-low flex items-center justify-between">
                  <div>
                    <p className="section-title mb-0 flex items-center gap-2">
                      <span className="material-symbols-outlined text-tertiary text-[18px]">{editingOpp ? 'edit' : 'add_circle'}</span>
                      {editingOpp ? 'Edit Opportunity' : 'Post New Opportunity'}
                    </p>
                    <p className="text-xs text-on-surface-variant font-label mt-0.5">
                      {editingOpp ? `Editing: ${editingOpp.title}` : 'Share a new opportunity with students on the portal.'}
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
                <form onSubmit={handleFormSubmit} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-label font-semibold text-on-surface-variant uppercase tracking-widest mb-1.5">Title *</label>
                    <input required type="text" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Research Fellowship 2025" className="input-field" />
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
                    <label className="block text-xs font-label font-semibold text-on-surface-variant uppercase tracking-widest mb-1.5">Deadline *</label>
                    <input required type="date" value={form.deadline} onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))} className="input-field" />
                  </div>
                  <div>
                    <label className="block text-xs font-label font-semibold text-on-surface-variant uppercase tracking-widest mb-1.5">Vacancies</label>
                    <input type="number" min="1" value={form.vacancies} onChange={(e) => setForm((f) => ({ ...f, vacancies: e.target.value }))} placeholder="e.g. 5" className="input-field" />
                  </div>
                  <div>
                    <label className="block text-xs font-label font-semibold text-on-surface-variant uppercase tracking-widest mb-1.5">Stipend / Compensation</label>
                    <input type="text" value={form.stipend} onChange={(e) => setForm((f) => ({ ...f, stipend: e.target.value }))} placeholder="e.g. $2,000 or Unpaid" className="input-field" />
                  </div>
                  <div className="col-span-full">
                    <label className="block text-xs font-label font-semibold text-on-surface-variant uppercase tracking-widest mb-1.5">Description *</label>
                    <textarea required rows={4} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Describe the opportunity, responsibilities, and what students will gain…" className="input-field resize-none" />
                  </div>
                  <div className="col-span-full">
                    <label className="block text-xs font-label font-semibold text-on-surface-variant uppercase tracking-widest mb-1.5">Eligibility</label>
                    <input type="text" value={form.eligibility} onChange={(e) => setForm((f) => ({ ...f, eligibility: e.target.value }))} placeholder="e.g. Open to 2nd and 3rd year students with GPA ≥ 3.0" className="input-field" />
                  </div>
                  <div className="col-span-full flex items-center gap-3 pt-2">
                    <button type="submit" disabled={formLoading} className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed">
                      {formLoading
                        ? <><span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>{editingOpp ? 'Saving…' : 'Publishing…'}</>
                        : <><span className="material-symbols-outlined text-[16px]">{editingOpp ? 'save' : 'publish'}</span>{editingOpp ? 'Save Changes' : 'Publish Opportunity'}</>}
                    </button>
                    <button type="button" onClick={() => { setForm(EMPTY_FORM); setEditingOpp(null) }} className="btn-ghost">Clear</button>
                  </div>
                </form>
              </div>
            </>
          )}

          {/* ── APPLICATIONS ──────────────────────────────── */}
          {activeNav === 'applications' && (
            <>
              <div className="mb-2">
                <h2 className="font-headline text-on-surface font-bold text-xl">Applications</h2>
                <p className="text-on-surface-variant text-xs font-label mt-0.5">
                  {counts.totalApps} total · {counts.pendingApps} need review
                </p>
              </div>

              <div className="card overflow-hidden">
                {appsLoading ? (
                  <div className="p-8 text-center text-on-surface-variant text-sm font-label">Loading…</div>
                ) : myApplications.length === 0 ? (
                  <div className="p-10 text-center">
                    <span className="material-symbols-outlined text-on-surface-variant text-4xl mb-3">inbox</span>
                    <p className="text-on-surface-variant text-sm font-label">No applications received yet.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto"><table className="w-full">
                    <thead>
                      <tr className="bg-surface-container">
                        {['Student', 'Opportunity', 'Applied', 'Status', 'Action'].map((h) => (
                          <th key={h} className="text-left px-5 py-3 text-xs font-label font-semibold text-on-surface-variant uppercase tracking-widest">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {myApplications.map((app, i) => {
                        const s = STATUS_MAP[app.status] ?? STATUS_MAP.pending
                        return (
                          <tr key={app.id} className={`${i % 2 === 0 ? 'bg-surface-container-lowest' : 'bg-surface-container-low/40'} hover:bg-surface-container transition-colors`}>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-tertiary/15 flex items-center justify-center text-tertiary text-xs font-bold flex-shrink-0">
                                  {app.profiles?.avatar || app.profiles?.name?.[0] || '?'}
                                </div>
                                <div>
                                  <p className="text-sm font-label font-semibold text-on-surface leading-tight">{app.profiles?.name ?? '—'}</p>
                                  <p className="text-xs text-on-surface-variant font-label">{app.profiles?.department || app.profiles?.year || ''}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-3.5">
                              <p className="text-sm font-label text-on-surface">{app.opportunities?.title ?? '—'}</p>
                              <p className="text-xs text-on-surface-variant font-label">{app.opportunities?.category ?? ''}</p>
                            </td>
                            <td className="px-5 py-3.5 text-xs font-label text-on-surface-variant">
                              {new Date(app.applied_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </td>
                            <td className="px-5 py-3.5">
                              <span className={`status-badge ${s.cls}`}>
                                <span className="material-symbols-outlined text-[12px]">{s.icon}</span>{s.label}
                              </span>
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2">
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
                                <button
                                  onClick={() => { setSelectedChatUser(app.profiles); setActiveNav('messages') }}
                                  className="text-xs font-label font-semibold px-2.5 py-1.5 rounded-full bg-tertiary/10 hover:bg-tertiary/20 text-tertiary transition-colors flex items-center gap-1"
                                >
                                  <span className="material-symbols-outlined text-[12px]">chat</span>
                                  Message
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table></div>
                )}
              </div>
            </>
          )}

          {/* ── MESSAGES ──────────────────────────────────── */}
          {activeNav === 'messages' && (
            <div className="flex h-[calc(100vh-72px)] -mx-4 md:-mx-8 -mt-4 md:-mt-6">
              {/* Left panel: contacts */}
              <div className={`${selectedChatUser ? 'hidden md:flex' : 'flex'} w-full md:w-72 flex-shrink-0 flex-col bg-surface border-r border-outline-variant/20`}>
                <div className="px-4 pt-5 pb-3 border-b border-outline-variant/20">
                  <p className="font-headline text-on-surface font-bold text-base mb-3">Messages</p>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[15px]">search</span>
                    <input
                      value={chatSearch}
                      onChange={(e) => setChatSearch(e.target.value)}
                      placeholder="Search students…"
                      className="w-full pl-9 pr-3 py-2 bg-surface-container-low rounded-full text-xs text-on-surface placeholder:text-on-surface-variant outline-none"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {/* Existing conversations */}
                  {filteredConversations.length > 0 && (
                    <div>
                      <p className="px-4 pt-3 pb-1 text-[10px] font-label font-semibold text-on-surface-variant uppercase tracking-widest">Recent</p>
                      {filteredConversations.map((conv) => (
                        <button
                          key={conv.user?.id}
                          onClick={() => setSelectedChatUser(conv.user)}
                          className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-container-low transition-colors text-left ${selectedChatUser?.id === conv.user?.id ? 'bg-primary/5 border-l-2 border-primary' : ''}`}
                        >
                          <div className="w-9 h-9 rounded-full bg-tertiary/15 flex items-center justify-center text-tertiary text-xs font-bold flex-shrink-0">
                            {conv.user?.avatar || conv.user?.name?.[0] || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-label font-semibold text-on-surface truncate">{conv.user?.name}</p>
                            <p className="text-xs text-on-surface-variant font-label truncate">{conv.lastMsg?.content}</p>
                          </div>
                          <p className="text-[10px] text-on-surface-variant font-label flex-shrink-0">
                            {new Date(conv.lastMsg?.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* All students (no existing conversation) */}
                  {newContacts.length > 0 && (
                    <div>
                      <p className="px-4 pt-3 pb-1 text-[10px] font-label font-semibold text-on-surface-variant uppercase tracking-widest">All Students</p>
                      {newContacts.map((student) => (
                        <button
                          key={student.id}
                          onClick={() => setSelectedChatUser(student)}
                          className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-container-low transition-colors text-left ${selectedChatUser?.id === student.id ? 'bg-primary/5 border-l-2 border-primary' : ''}`}
                        >
                          <div className="w-9 h-9 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface-variant text-xs font-bold flex-shrink-0">
                            {student.avatar || student.name?.[0] || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-label font-semibold text-on-surface truncate">{student.name}</p>
                            <p className="text-xs text-on-surface-variant font-label truncate">{student.department || 'Student'}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {students.length === 0 && conversations.length === 0 && (
                    <div className="p-6 text-center">
                      <span className="material-symbols-outlined text-on-surface-variant text-3xl mb-2">group</span>
                      <p className="text-xs text-on-surface-variant font-label">No students yet</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right panel: chat */}
              {selectedChatUser ? (
                <div className="flex-1 flex flex-col bg-background">
                  {/* Chat header */}
                  <div className="px-4 md:px-6 py-4 bg-surface border-b border-outline-variant/20 flex items-center gap-3">
                    <button className="md:hidden text-on-surface-variant hover:text-on-surface" onClick={() => setSelectedChatUser(null)}>
                      <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div className="w-9 h-9 rounded-full bg-tertiary/15 flex items-center justify-center text-tertiary text-xs font-bold flex-shrink-0">
                      {selectedChatUser.avatar || selectedChatUser.name?.[0] || '?'}
                    </div>
                    <div>
                      <p className="text-sm font-headline font-bold text-on-surface">{selectedChatUser.name}</p>
                      <p className="text-xs text-on-surface-variant font-label">{selectedChatUser.department || selectedChatUser.year || 'Student'}</p>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-3">
                    {chatMessages.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-full text-center gap-3">
                        <span className="material-symbols-outlined text-on-surface-variant text-4xl">chat_bubble</span>
                        <p className="text-sm font-label text-on-surface-variant">Send a message to start the conversation</p>
                      </div>
                    )}
                    {chatMessages.map((msg) => {
                      const isMe = msg.sender_id === user?.id
                      return (
                        <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                          {!isMe && (
                            <div className="w-7 h-7 rounded-full bg-tertiary/15 flex items-center justify-center text-tertiary text-xs font-bold flex-shrink-0">
                              {selectedChatUser.avatar || selectedChatUser.name?.[0] || '?'}
                            </div>
                          )}
                          <div className={`max-w-[65%] px-4 py-2.5 rounded-2xl text-sm font-label leading-relaxed ${isMe ? 'bg-primary text-white rounded-br-sm' : 'bg-surface-container text-on-surface rounded-bl-sm'}`}>
                            {msg.content}
                            <p className={`text-[10px] mt-1 ${isMe ? 'text-white/60' : 'text-on-surface-variant'}`}>
                              {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Input */}
                  <div className="px-6 py-4 bg-surface border-t border-outline-variant/20 flex items-center gap-3">
                    <input
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                      placeholder={`Message ${selectedChatUser.name}…`}
                      className="flex-1 px-4 py-2.5 bg-surface-container-low rounded-full text-sm text-on-surface placeholder:text-on-surface-variant outline-none"
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!messageInput.trim() || msgSending}
                      className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors flex-shrink-0"
                    >
                      <span className="material-symbols-outlined text-[18px]">send</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8 bg-background">
                  <div className="w-20 h-20 rounded-full bg-surface-container flex items-center justify-center">
                    <span className="material-symbols-outlined text-on-surface-variant text-4xl">chat</span>
                  </div>
                  <div>
                    <p className="font-headline font-bold text-on-surface text-lg mb-1">Your Messages</p>
                    <p className="text-sm font-label text-on-surface-variant">Select a student from the left to start a conversation</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── SETTINGS ──────────────────────────────────── */}
          {activeNav === 'settings' && (
            <div className="max-w-lg">
              <h2 className="font-headline text-on-surface font-bold text-xl mb-6">Settings</h2>

              <div className="card p-6 mb-4">
                <div className="flex items-center gap-5 mb-6">
                  <div className="w-16 h-16 rounded-full bg-tertiary flex items-center justify-center text-white text-xl font-bold font-headline flex-shrink-0">
                    {user?.avatar || user?.name?.[0] || '?'}
                  </div>
                  <div>
                    <p className="font-headline text-on-surface font-bold text-lg">{user?.name}</p>
                    <p className="text-on-surface-variant text-sm font-label">{user?.email}</p>
                    <span className="status-badge bg-tertiary/10 text-tertiary mt-1 inline-flex">Mentor</span>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { label: 'Department', value: user?.department || '—', icon: 'account_balance' },
                    { label: 'Title',      value: user?.title      || '—', icon: 'work' },
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

              <div className="grid grid-cols-2 gap-4">
                <div className="stat-card flex items-center gap-3">
                  <span className="material-symbols-outlined text-tertiary text-[20px]">explore</span>
                  <div>
                    <p className="font-headline text-xl font-bold text-on-surface">{myOpportunities.length}</p>
                    <p className="text-xs text-on-surface-variant font-label">Opportunities Posted</p>
                  </div>
                </div>
                <div className="stat-card flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary text-[20px]">verified</span>
                  <div>
                    <p className="font-headline text-xl font-bold text-on-surface">{counts.approved}</p>
                    <p className="text-xs text-on-surface-variant font-label">Students Placed</p>
                  </div>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-sm border-t border-outline-variant/20 z-30">
        <div className="flex items-center justify-around py-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg transition-all min-w-0 flex-1 ${
                activeNav === item.id ? 'text-primary' : 'text-on-surface-variant'
              }`}
            >
              <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
              <span className="text-[9px] font-label font-semibold leading-tight truncate w-full text-center">{item.label.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
