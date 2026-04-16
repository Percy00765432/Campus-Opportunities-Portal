import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useTheme } from '../hooks/useTheme'

const STATUS_MAP = {
  reviewing: { label: 'Under Review', cls: 'status-reviewing', icon: 'pending' },
  approved:  { label: 'Approved',     cls: 'status-approved',  icon: 'check_circle' },
  pending:   { label: 'Pending',      cls: 'status-pending',   icon: 'schedule' },
  rejected:  { label: 'Not Selected', cls: 'status-rejected',  icon: 'cancel' },
}

const CATEGORY_ICON = {
  'Research Grant':    { icon: 'biotech',    color: 'text-tertiary bg-tertiary-container' },
  'Internship':        { icon: 'work',       color: 'text-primary bg-primary/10' },
  'Scholarship':       { icon: 'workspace_premium', color: 'text-secondary bg-secondary-container' },
  'Teaching Assistant':{ icon: 'school',     color: 'text-secondary bg-secondary-container' },
  'Study Abroad':      { icon: 'language',   color: 'text-tertiary bg-tertiary-container' },
  'Leadership Program':{ icon: 'military_tech', color: 'text-primary bg-primary/10' },
}

const NAV_ITEMS = [
  { id: 'dashboard',    label: 'Dashboard',        icon: 'dashboard' },
  { id: 'opportunities',label: 'Opportunities',    icon: 'explore' },
  { id: 'applications', label: 'My Applications',  icon: 'assignment' },
  { id: 'bookmarks',    label: 'Saved',            icon: 'bookmark' },
  { id: 'messages',     label: 'Messages',         icon: 'chat' },
  { id: 'profile',      label: 'Profile',          icon: 'person' },
]

export default function StudentDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { dark, toggle: toggleTheme } = useTheme()

  const [activeNav, setActiveNav]     = useState('dashboard')
  const [sidebarOpen, setSidebarOpen]   = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [notifOpen, setNotifOpen]     = useState(false)
  const [selectedOpp, setSelectedOpp] = useState(null)
  const [profileEdit, setProfileEdit] = useState(false)
  const [profileForm, setProfileForm] = useState({ name: '', department: '', year: '' })
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const notifRef = useRef(null)
  const [searchVal, setSearchVal]     = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')

  const [opportunities, setOpportunities] = useState([])
  const [applications, setApplications]   = useState([])
  const [appliedIds, setAppliedIds]       = useState(new Set())
  const [bookmarks, setBookmarks]         = useState(new Set())
  const [oppsLoading, setOppsLoading]     = useState(true)
  const [appsLoading, setAppsLoading]     = useState(true)

  // Messages
  const [messages, setMessages]                   = useState([])
  const [mentors, setMentors]                     = useState([])
  const [selectedChatUser, setSelectedChatUser]   = useState(null)
  const [messageInput, setMessageInput]           = useState('')
  const [chatSearch, setChatSearch]               = useState('')
  const [msgSending, setMsgSending]               = useState(false)
  const chatEndRef = useRef(null)

  // ── Fetch active opportunities ─────────────────────────────
  const fetchOpportunities = useCallback(async () => {
    setOppsLoading(true)
    const { data, error } = await supabase
      .from('opportunities')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    if (!error) setOpportunities(data ?? [])
    setOppsLoading(false)
  }, [])

  // ── Fetch student's applications ───────────────────────────
  const fetchApplications = useCallback(async () => {
    if (!user?.id) return
    setAppsLoading(true)
    const { data, error } = await supabase
      .from('applications')
      .select('*, opportunities(title, category, department)')
      .eq('student_id', user.id)
      .order('applied_at', { ascending: false })
    if (!error) {
      setApplications(data ?? [])
      setAppliedIds(new Set((data ?? []).map((a) => a.opportunity_id)))
    }
    setAppsLoading(false)
  }, [user?.id])

  useEffect(() => { fetchOpportunities() }, [fetchOpportunities])
  useEffect(() => { fetchApplications()  }, [fetchApplications])
  useEffect(() => {
    if (user) setProfileForm({ name: user.name || '', department: user.department || '', year: user.year || '' })
  }, [user])

  async function saveProfile() {
    setProfileSaving(true)
    await supabase.from('profiles').update({
      name: profileForm.name,
      department: profileForm.department,
      year: profileForm.year,
    }).eq('id', user.id)
    setProfileSaving(false)
    setProfileEdit(false)
    setProfileSaved(true)
    setTimeout(() => setProfileSaved(false), 3000)
  }

  // ── Load bookmarks from localStorage ──────────────────
  useEffect(() => {
    if (!user?.id) return
    try {
      const saved = JSON.parse(localStorage.getItem(`bookmarks_${user.id}`) ?? '[]')
      setBookmarks(new Set(saved))
    } catch { /* noop */ }
  }, [user?.id])

  // ── Apply / withdraw ────────────────────────────────────────
  async function toggleApply(opportunityId) {
    if (!user?.id) return
    if (appliedIds.has(opportunityId)) {
      // Withdraw (only allowed for pending)
      await supabase
        .from('applications')
        .delete()
        .eq('student_id', user.id)
        .eq('opportunity_id', opportunityId)
    } else {
      await supabase
        .from('applications')
        .insert({ student_id: user.id, opportunity_id: opportunityId, status: 'pending' })
    }
    await fetchApplications()
  }

  function toggleBookmark(id) {
    setBookmarks((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      if (user?.id) localStorage.setItem(`bookmarks_${user.id}`, JSON.stringify([...next]))
      return next
    })
  }

  // ── Messages ────────────────────────────────────────────────
  const fetchMentors = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, name, avatar, department, title, role')
      .eq('role', 'mentor')
      .order('name')
    setMentors(data ?? [])
  }, [])

  const fetchMessages = useCallback(async () => {
    if (!user?.id) return
    const { data } = await supabase
      .from('messages')
      .select(`*, sender:profiles!messages_sender_id_fkey(id, name, avatar, role), receiver:profiles!messages_receiver_id_fkey(id, name, avatar, role)`)
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: true })
    setMessages(data ?? [])
  }, [user?.id])

  useEffect(() => {
    if (activeNav !== 'messages') return
    fetchMentors()
    fetchMessages()
    const channel = supabase
      .channel(`student-msgs-${user?.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user?.id}` }, () => fetchMessages())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [activeNav, user?.id, fetchMentors, fetchMessages])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, selectedChatUser])

  // Close notification dropdown on outside click
  useEffect(() => {
    if (!notifOpen) return
    function handleOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [notifOpen])

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

  const featured    = opportunities[0] ?? null
  const categories  = ['All', ...new Set(opportunities.map((o) => o.category))]

  const filtered = opportunities.filter((o) => {
    const matchSearch =
      o.title.toLowerCase().includes(searchVal.toLowerCase()) ||
      (o.department ?? '').toLowerCase().includes(searchVal.toLowerCase()) ||
      o.category.toLowerCase().includes(searchVal.toLowerCase())
    const matchCat = categoryFilter === 'All' || o.category === categoryFilter
    return matchSearch && matchCat
  })

  // Upcoming deadlines: sort by deadline asc, next 4
  const deadlines = [...opportunities]
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
    .slice(0, 4)

  function daysUntil(dateStr) {
    return Math.ceil((new Date(dateStr) - new Date()) / 86400000)
  }

  // Derived: conversations and chat messages
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

  const newMentors = mentors.filter(
    (m) => !conversationUserIds.has(m.id) && m.name?.toLowerCase().includes(chatSearch.toLowerCase())
  )
  const filteredConversations = conversations.filter(
    (c) => c.user?.name?.toLowerCase().includes(chatSearch.toLowerCase())
  )

  const DEADLINE_COLORS = ['bg-error', 'bg-primary', 'bg-tertiary', 'bg-secondary']

  return (
    <div className="min-h-screen bg-background flex font-body">
      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 flex flex-col bg-surface backdrop-blur-glass shadow-elevated z-50">
            <div className="flex items-center gap-3 px-5 py-5">
              <span className="material-symbols-outlined text-primary text-2xl flex-shrink-0">school</span>
              <div>
                <p className="font-headline text-on-surface font-bold text-sm leading-tight">Academic Atelier</p>
                <p className="text-on-surface-variant text-xs font-label">Student Portal</p>
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

      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col flex-shrink-0 ${sidebarOpen ? 'w-60' : 'w-16'} bg-surface/80 backdrop-blur-glass transition-all duration-300 relative z-10`}
      >
        <div className={`flex items-center ${sidebarOpen ? 'gap-3 px-5' : 'justify-center px-2'} py-5`}>
          <span className="material-symbols-outlined text-primary text-2xl flex-shrink-0">school</span>
          {sidebarOpen && (
            <div>
              <p className="font-headline text-on-surface font-bold text-sm leading-tight">Academic Atelier</p>
              <p className="text-on-surface-variant text-xs font-label">Student Portal</p>
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

      {/* Main content */}
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
                Good morning, {user?.name?.split(' ')[0]} 👋
              </h2>
              <p className="text-on-surface-variant text-xs font-label hidden md:block">
                {user?.department}{user?.year ? ` · ${user.year}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <div className="relative hidden md:block">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px]">search</span>
              <input
                type="text"
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
                placeholder="Search opportunities…"
                className="pl-9 pr-4 py-2 bg-surface-container-low rounded-full text-xs text-on-surface placeholder:text-on-surface-variant outline-none w-52 focus:w-64 transition-all duration-200"
              />
            </div>

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
                {applications.some((a) => a.status === 'approved') && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-2rem)] card p-0 overflow-hidden z-50">
                  <div className="px-4 py-3 bg-surface-container-low">
                    <p className="text-sm font-headline font-bold text-on-surface">Notifications</p>
                  </div>
                  {applications.filter((a) => a.status === 'approved').length === 0 ? (
                    <p className="px-4 py-3 text-xs text-on-surface-variant font-label">No new notifications</p>
                  ) : (
                    applications.filter((a) => a.status === 'approved').map((a) => (
                      <div key={a.id} className="flex items-start gap-3 px-4 py-3 hover:bg-surface-container-low transition-colors cursor-pointer">
                        <span className="material-symbols-outlined text-[18px] mt-0.5 text-tertiary">check_circle</span>
                        <div>
                          <p className="text-xs text-on-surface font-label">{a.opportunities?.title} application approved!</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="w-9 h-9 rounded-full bg-gradient-primary flex items-center justify-center text-white text-xs font-bold font-headline cursor-pointer">
              {user?.avatar || user?.name?.[0] || '?'}
            </div>
          </div>
        </header>

        {/* Page body */}
        <main className={`flex-1 ${activeNav === 'messages' ? 'overflow-hidden flex flex-col' : 'px-4 py-4 md:px-8 md:py-6 pb-20 md:pb-6 overflow-y-auto scrollbar-hide'}`}>

          {/* ── DASHBOARD ─────────────────────────────────────── */}
          {activeNav === 'dashboard' && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                  { label: 'Opportunities Available', value: oppsLoading ? '…' : opportunities.length, icon: 'explore', delta: 'Active now' },
                  { label: 'Applications Submitted',  value: appsLoading  ? '…' : applications.length,  icon: 'assignment', delta: `${applications.filter(a=>a.status==='pending').length} pending` },
                  { label: 'Under Review',            value: appsLoading  ? '…' : applications.filter(a=>a.status==='reviewing').length, icon: 'pending', delta: 'Awaiting decision' },
                  { label: 'Approved',                value: appsLoading  ? '…' : applications.filter(a=>a.status==='approved').length,  icon: 'verified', delta: 'Congratulations!' },
                ].map((s) => (
                  <div key={s.label} className="stat-card flex items-start gap-4">
                    <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-primary text-[18px]">{s.icon}</span>
                    </div>
                    <div>
                      <p className="font-headline text-xl font-bold text-on-surface">{s.value}</p>
                      <p className="text-xs text-on-surface-variant font-label">{s.label}</p>
                      <p className="text-xs text-primary font-label font-semibold mt-1">{s.delta}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {featured ? (
                  <div className="md:col-span-2 bg-gradient-primary rounded-xl p-6 relative overflow-hidden">
                    <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10" />
                    <div className="absolute bottom-4 right-16 w-28 h-28 rounded-full bg-white/5" />
                    <div className="relative">
                      <div className="flex items-center gap-2 mb-4">
                        <span className="bg-white/20 text-white text-xs font-label font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide">Featured</span>
                        <span className="bg-white/20 text-white text-xs font-label px-2.5 py-1 rounded-full">{featured.category}</span>
                      </div>
                      <h3 className="font-headline text-white text-2xl font-extrabold mb-2 leading-snug">{featured.title}</h3>
                      <p className="text-white/70 text-sm font-label mb-3">{featured.department}</p>
                      <p className="text-white/80 text-sm leading-relaxed mb-5 line-clamp-2">{featured.description}</p>
                      <div className="flex items-center gap-6 mb-6">
                        {featured.stipend && (
                          <div>
                            <p className="text-white/60 text-xs font-label uppercase tracking-wide">Stipend</p>
                            <p className="text-white font-bold font-headline">{featured.stipend}</p>
                          </div>
                        )}
                        {featured.vacancies && (
                          <div>
                            <p className="text-white/60 text-xs font-label uppercase tracking-wide">Spots</p>
                            <p className="text-white font-bold font-headline">{featured.vacancies}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-white/60 text-xs font-label uppercase tracking-wide">Deadline</p>
                          <p className="text-white font-bold font-headline">
                            {new Date(featured.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleApply(featured.id)}
                          className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold font-label transition-all ${
                            appliedIds.has(featured.id) ? 'bg-white/20 text-white' : 'bg-white text-primary hover:bg-white/90'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            {appliedIds.has(featured.id) ? 'check' : 'send'}
                          </span>
                          {appliedIds.has(featured.id) ? 'Applied' : 'Apply Now'}
                        </button>
                        <button
                          onClick={() => toggleBookmark(featured.id)}
                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                            bookmarks.has(featured.id) ? 'bg-white/20 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            {bookmarks.has(featured.id) ? 'bookmark' : 'bookmark_border'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="md:col-span-2 bg-surface-container rounded-xl p-6 flex items-center justify-center">
                    <p className="text-on-surface-variant text-sm font-label">
                      {oppsLoading ? 'Loading opportunities…' : 'No opportunities available yet.'}
                    </p>
                  </div>
                )}

                <div className="card p-5">
                  <p className="section-title flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[18px]">schedule</span>
                    Upcoming Deadlines
                  </p>
                  {deadlines.length === 0 ? (
                    <p className="text-on-surface-variant text-xs font-label">No upcoming deadlines.</p>
                  ) : (
                    <div className="space-y-3">
                      {deadlines.map((d, i) => (
                        <div key={d.id} className="flex items-center gap-3">
                          <div className={`w-1.5 h-10 rounded-full ${DEADLINE_COLORS[i % 4]} flex-shrink-0`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-on-surface font-label truncate">{d.title}</p>
                            <p className="text-xs text-on-surface-variant font-label">{daysUntil(d.deadline)} days left</p>
                          </div>
                          <button onClick={() => setActiveNav('opportunities')} className="text-primary">
                            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between mb-4">
                <h2 className="section-title mb-0">Recent Opportunities</h2>
                <button onClick={() => setActiveNav('opportunities')} className="text-xs text-primary font-label font-semibold hover:underline flex items-center gap-1">
                  View all
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {opportunities.slice(0, 3).map((opp) => {
                  const meta = CATEGORY_ICON[opp.category] ?? { icon: 'work', color: 'text-primary bg-primary/10' }
                  return (
                    <div key={opp.id} className="card p-5 flex flex-col gap-3 hover:shadow-editorial transition-shadow">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                          <span className="material-symbols-outlined text-[18px]">{meta.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-headline font-bold text-on-surface leading-snug">{opp.title}</p>
                          <p className="text-xs text-on-surface-variant font-label mt-0.5 truncate">{opp.department}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="status-badge bg-surface-container text-on-surface-variant">{opp.category}</span>
                        <span className="text-xs text-on-surface-variant font-label ml-auto">
                          Due {new Date(opp.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleApply(opp.id)}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-xs font-semibold font-label transition-all ${
                            appliedIds.has(opp.id) ? 'bg-tertiary-container text-tertiary' : 'btn-primary py-2 text-xs'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[14px]">{appliedIds.has(opp.id) ? 'check' : 'send'}</span>
                          {appliedIds.has(opp.id) ? 'Applied' : 'Apply'}
                        </button>
                        <button
                          onClick={() => toggleBookmark(opp.id)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                            bookmarks.has(opp.id) ? 'bg-primary/10 text-primary' : 'bg-surface-container text-on-surface-variant hover:text-primary'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]">{bookmarks.has(opp.id) ? 'bookmark' : 'bookmark_border'}</span>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {applications.length > 0 && (
                <div className="card overflow-hidden">
                  <div className="px-6 py-4 bg-surface-container-low flex items-center justify-between">
                    <p className="section-title mb-0 flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[18px]">assignment</span>
                      Recent Applications
                    </p>
                    <button onClick={() => setActiveNav('applications')} className="text-xs text-primary font-label font-semibold hover:underline flex items-center gap-1">
                      View all
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </button>
                  </div>
                  <div className="overflow-x-auto"><table className="w-full">
                    <thead>
                      <tr className="bg-surface-container">
                        {['Opportunity', 'Category', 'Applied', 'Status', ''].map((h) => (
                          <th key={h} className="text-left px-6 py-3 text-xs font-label font-semibold text-on-surface-variant uppercase tracking-widest">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {applications.slice(0, 3).map((app, i) => {
                        const s = STATUS_MAP[app.status] ?? STATUS_MAP.pending
                        return (
                          <tr key={app.id} className={`${i % 2 === 0 ? 'bg-surface-container-lowest' : 'bg-surface-container-low/40'} hover:bg-surface-container transition-colors`}>
                            <td className="px-6 py-4 text-sm font-label font-semibold text-on-surface">{app.opportunities?.title}</td>
                            <td className="px-6 py-4 text-sm font-label text-on-surface-variant">{app.opportunities?.category}</td>
                            <td className="px-6 py-4 text-sm font-label text-on-surface-variant">
                              {new Date(app.applied_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`status-badge ${s.cls}`}>
                                <span className="material-symbols-outlined text-[12px]">{s.icon}</span>
                                {s.label}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              {app.status === 'pending' && (
                                <button onClick={() => toggleApply(app.opportunity_id)} className="btn-ghost text-xs py-1 px-2 text-error hover:bg-error/10 hover:text-error">
                                  Withdraw
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table></div>
                </div>
              )}
            </>
          )}

          {/* ── OPPORTUNITIES ─────────────────────────────────── */}
          {activeNav === 'opportunities' && (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                <div>
                  <h2 className="font-headline text-on-surface font-bold text-xl">Browse Opportunities</h2>
                  <p className="text-on-surface-variant text-xs font-label mt-0.5">{opportunities.length} active opportunities available</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat)}
                      className={`text-xs font-label font-semibold px-3 py-1.5 rounded-full transition-colors ${
                        categoryFilter === cat
                          ? 'bg-primary text-on-primary'
                          : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {oppsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[1,2,3,4,5,6].map((i) => (
                    <div key={i} className="card p-5 animate-pulse">
                      <div className="h-4 bg-surface-container rounded w-3/4 mb-2" />
                      <div className="h-3 bg-surface-container rounded w-1/2" />
                    </div>
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="card p-10 text-center">
                  <span className="material-symbols-outlined text-on-surface-variant text-4xl mb-3">search_off</span>
                  <p className="text-on-surface-variant text-sm font-label">No opportunities match your search.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {filtered.map((opp) => {
                    const meta = CATEGORY_ICON[opp.category] ?? { icon: 'work', color: 'text-primary bg-primary/10' }
                    return (
                      <div key={opp.id} className="card p-5 flex flex-col gap-3 hover:shadow-editorial transition-shadow cursor-pointer" onClick={() => setSelectedOpp(opp)}>
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                            <span className="material-symbols-outlined text-[18px]">{meta.icon}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-headline font-bold text-on-surface leading-snug">{opp.title}</p>
                            <p className="text-xs text-on-surface-variant font-label mt-0.5 truncate">{opp.department}</p>
                          </div>
                        </div>
                        <p className="text-xs text-on-surface-variant font-label line-clamp-2 leading-relaxed">{opp.description}</p>
                        <div className="flex items-center gap-2">
                          <span className="status-badge bg-surface-container text-on-surface-variant">{opp.category}</span>
                          <span className="text-xs text-on-surface-variant font-label ml-auto">
                            Due {new Date(opp.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-on-surface-variant font-label">
                          {opp.stipend && <span><span className="text-on-surface font-semibold">{opp.stipend}</span></span>}
                          {opp.vacancies && <span>{opp.vacancies} spots</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-auto pt-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleApply(opp.id) }}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-xs font-semibold font-label transition-all ${
                              appliedIds.has(opp.id) ? 'bg-tertiary-container text-tertiary' : 'btn-primary py-2 text-xs'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[14px]">{appliedIds.has(opp.id) ? 'check' : 'send'}</span>
                            {appliedIds.has(opp.id) ? 'Applied' : 'Apply'}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleBookmark(opp.id) }}
                            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                              bookmarks.has(opp.id) ? 'bg-primary/10 text-primary' : 'bg-surface-container text-on-surface-variant hover:text-primary'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[16px]">{bookmarks.has(opp.id) ? 'bookmark' : 'bookmark_border'}</span>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* ── MY APPLICATIONS ───────────────────────────────── */}
          {activeNav === 'applications' && (
            <>
              <div className="mb-6">
                <h2 className="font-headline text-on-surface font-bold text-xl">My Applications</h2>
                <p className="text-on-surface-variant text-xs font-label mt-0.5">{applications.length} total applications</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'Submitted',    value: applications.length, icon: 'assignment', color: 'text-primary bg-primary/10' },
                  { label: 'Pending',      value: applications.filter(a=>a.status==='pending').length,   icon: 'schedule',      color: 'text-secondary bg-secondary-container' },
                  { label: 'Under Review', value: applications.filter(a=>a.status==='reviewing').length, icon: 'pending',       color: 'text-tertiary bg-tertiary-container' },
                  { label: 'Approved',     value: applications.filter(a=>a.status==='approved').length,  icon: 'check_circle',  color: 'text-primary bg-primary/10' },
                ].map((s) => (
                  <div key={s.label} className="stat-card flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0 ${s.color}`}>
                      <span className="material-symbols-outlined text-[18px]">{s.icon}</span>
                    </div>
                    <div>
                      <p className="font-headline text-xl font-bold text-on-surface">{appsLoading ? '…' : s.value}</p>
                      <p className="text-xs text-on-surface-variant font-label">{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="card overflow-hidden">
                <div className="px-6 py-4 bg-surface-container-low">
                  <p className="section-title mb-0 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[18px]">assignment</span>
                    All Applications
                  </p>
                </div>
                {appsLoading ? (
                  <div className="p-6 text-center text-on-surface-variant text-sm font-label">Loading…</div>
                ) : applications.length === 0 ? (
                  <div className="p-10 text-center">
                    <span className="material-symbols-outlined text-on-surface-variant text-4xl mb-3">assignment</span>
                    <p className="text-on-surface-variant text-sm font-label mb-4">You haven't applied to anything yet.</p>
                    <button onClick={() => setActiveNav('opportunities')} className="btn-primary px-6 py-2 text-sm">
                      Browse Opportunities
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto"><table className="w-full">
                    <thead>
                      <tr className="bg-surface-container">
                        {['Opportunity', 'Department', 'Applied', 'Status', ''].map((h) => (
                          <th key={h} className="text-left px-6 py-3 text-xs font-label font-semibold text-on-surface-variant uppercase tracking-widest">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {applications.map((app, i) => {
                        const s = STATUS_MAP[app.status] ?? STATUS_MAP.pending
                        return (
                          <tr key={app.id} className={`${i % 2 === 0 ? 'bg-surface-container-lowest' : 'bg-surface-container-low/40'} hover:bg-surface-container transition-colors`}>
                            <td className="px-6 py-4">
                              <p className="text-sm font-label font-semibold text-on-surface">{app.opportunities?.title}</p>
                              <p className="text-xs text-on-surface-variant font-label">{app.opportunities?.category}</p>
                            </td>
                            <td className="px-6 py-4 text-sm font-label text-on-surface-variant">{app.opportunities?.department}</td>
                            <td className="px-6 py-4 text-sm font-label text-on-surface-variant">
                              {new Date(app.applied_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`status-badge ${s.cls}`}>
                                <span className="material-symbols-outlined text-[12px]">{s.icon}</span>
                                {s.label}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              {app.status === 'pending' && (
                                <button onClick={() => toggleApply(app.opportunity_id)} className="btn-ghost text-xs py-1 px-2 text-error hover:bg-error/10 hover:text-error">
                                  Withdraw
                                </button>
                              )}
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

          {/* ── SAVED ─────────────────────────────────────────── */}
          {activeNav === 'bookmarks' && (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="font-headline text-on-surface font-bold text-xl">Saved Opportunities</h2>
                  <p className="text-on-surface-variant text-xs font-label mt-0.5">
                    {bookmarks.size} saved {bookmarks.size === 1 ? 'opportunity' : 'opportunities'}
                  </p>
                </div>
                {bookmarks.size > 0 && (
                  <button onClick={() => setActiveNav('opportunities')} className="btn-secondary text-sm">
                    <span className="material-symbols-outlined text-[16px]">explore</span>
                    Browse More
                  </button>
                )}
              </div>

              {bookmarks.size === 0 ? (
                <div className="card p-16 flex flex-col items-center justify-center text-center">
                  <span className="material-symbols-outlined text-on-surface-variant text-5xl mb-4">bookmark_border</span>
                  <p className="font-headline text-on-surface font-bold text-lg mb-1">Nothing saved yet</p>
                  <p className="text-on-surface-variant text-sm font-label mb-6">
                    Click the bookmark icon on any opportunity to save it here for later.
                  </p>
                  <button onClick={() => setActiveNav('opportunities')} className="btn-primary px-6 py-2.5 text-sm">
                    Browse Opportunities
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {opportunities.filter((o) => bookmarks.has(o.id)).map((opp) => {
                    const meta = CATEGORY_ICON[opp.category] ?? { icon: 'work', color: 'text-primary bg-primary/10' }
                    return (
                      <div key={opp.id} className="card p-5 flex flex-col gap-3 hover:shadow-editorial transition-shadow cursor-pointer" onClick={() => setSelectedOpp(opp)}>
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                            <span className="material-symbols-outlined text-[18px]">{meta.icon}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-headline font-bold text-on-surface leading-snug">{opp.title}</p>
                            <p className="text-xs text-on-surface-variant font-label mt-0.5 truncate">{opp.department}</p>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleBookmark(opp.id) }}
                            className="text-primary hover:text-on-surface-variant transition-colors flex-shrink-0"
                            title="Remove bookmark"
                          >
                            <span className="material-symbols-outlined text-[18px]">bookmark</span>
                          </button>
                        </div>
                        <p className="text-xs text-on-surface-variant font-label line-clamp-2 leading-relaxed">{opp.description}</p>
                        <div className="flex items-center gap-2">
                          <span className="status-badge bg-surface-container text-on-surface-variant">{opp.category}</span>
                          <span className="text-xs text-on-surface-variant font-label ml-auto">
                            Due {new Date(opp.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-on-surface-variant font-label">
                          {opp.stipend && <span className="text-on-surface font-semibold">{opp.stipend}</span>}
                          {opp.vacancies && <span>{opp.vacancies} spots</span>}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleApply(opp.id) }}
                          className={`flex items-center justify-center gap-1.5 py-2 rounded-full text-xs font-semibold font-label transition-all mt-auto ${
                            appliedIds.has(opp.id) ? 'bg-tertiary-container text-tertiary' : 'btn-primary py-2 text-xs'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[14px]">{appliedIds.has(opp.id) ? 'check' : 'send'}</span>
                          {appliedIds.has(opp.id) ? 'Applied' : 'Apply'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* ── MESSAGES ─────────────────────────────────────── */}
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
                      placeholder="Search mentors…"
                      className="w-full pl-9 pr-3 py-2 bg-surface-container-low rounded-full text-xs text-on-surface placeholder:text-on-surface-variant outline-none"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto">
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

                  {newMentors.length > 0 && (
                    <div>
                      <p className="px-4 pt-3 pb-1 text-[10px] font-label font-semibold text-on-surface-variant uppercase tracking-widest">All Mentors</p>
                      {newMentors.map((mentor) => (
                        <button
                          key={mentor.id}
                          onClick={() => setSelectedChatUser(mentor)}
                          className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-container-low transition-colors text-left ${selectedChatUser?.id === mentor.id ? 'bg-primary/5 border-l-2 border-primary' : ''}`}
                        >
                          <div className="w-9 h-9 rounded-full bg-tertiary/15 flex items-center justify-center text-tertiary text-xs font-bold flex-shrink-0">
                            {mentor.avatar || mentor.name?.[0] || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-label font-semibold text-on-surface truncate">{mentor.name}</p>
                            <p className="text-xs text-on-surface-variant font-label truncate">{mentor.department || 'Mentor'}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {mentors.length === 0 && conversations.length === 0 && (
                    <div className="p-6 text-center">
                      <span className="material-symbols-outlined text-on-surface-variant text-3xl mb-2">person_search</span>
                      <p className="text-xs text-on-surface-variant font-label">No mentors available yet</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right panel: chat */}
              {selectedChatUser ? (
                <div className="flex-1 flex flex-col bg-background">
                  <div className="px-4 md:px-6 py-4 bg-surface border-b border-outline-variant/20 flex items-center gap-3">
                    <button className="md:hidden text-on-surface-variant hover:text-on-surface" onClick={() => setSelectedChatUser(null)}>
                      <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div className="w-9 h-9 rounded-full bg-tertiary/15 flex items-center justify-center text-tertiary text-xs font-bold flex-shrink-0">
                      {selectedChatUser.avatar || selectedChatUser.name?.[0] || '?'}
                    </div>
                    <div>
                      <p className="text-sm font-headline font-bold text-on-surface">{selectedChatUser.name}</p>
                      <p className="text-xs text-on-surface-variant font-label">{selectedChatUser.department || 'Mentor'}</p>
                    </div>
                  </div>

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
                    <p className="text-sm font-label text-on-surface-variant">Select a mentor from the left to start a conversation</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── PROFILE ───────────────────────────────────────── */}
          {activeNav === 'profile' && (
            <div className="max-w-lg">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-headline text-on-surface font-bold text-xl">My Profile</h2>
                {!profileEdit && (
                  <button onClick={() => setProfileEdit(true)} className="btn-secondary flex items-center gap-2 py-2 px-4 text-sm">
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                    Edit Profile
                  </button>
                )}
              </div>

              {profileSaved && (
                <div className="flex items-center gap-2 bg-tertiary-container/40 text-tertiary border border-tertiary/20 rounded-lg px-4 py-3 mb-4 text-sm font-label">
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  Profile updated successfully
                </div>
              )}

              <div className="card p-6 mb-4">
                <div className="flex items-center gap-5 mb-6">
                  <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center text-white text-xl font-bold font-headline flex-shrink-0">
                    {user?.avatar || profileForm.name?.[0] || user?.name?.[0] || '?'}
                  </div>
                  <div>
                    <p className="font-headline text-on-surface font-bold text-lg">{profileForm.name || user?.name}</p>
                    <p className="text-on-surface-variant text-sm font-label">{user?.email}</p>
                    <span className="status-badge bg-primary/10 text-primary mt-1 inline-flex">Student</span>
                  </div>
                </div>

                {profileEdit ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-label font-semibold text-on-surface-variant uppercase tracking-widest mb-1.5">Full Name</label>
                      <input className="input-field" value={profileForm.name} onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs font-label font-semibold text-on-surface-variant uppercase tracking-widest mb-1.5">Department</label>
                      <input className="input-field" value={profileForm.department} onChange={e => setProfileForm(f => ({ ...f, department: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs font-label font-semibold text-on-surface-variant uppercase tracking-widest mb-1.5">Year of Study</label>
                      <select className="input-field" value={profileForm.year} onChange={e => setProfileForm(f => ({ ...f, year: e.target.value }))}>
                        <option value="">Select year</option>
                        {['1st Year','2nd Year','3rd Year','4th Year','Postgraduate'].map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-3 pt-1">
                      <button onClick={saveProfile} disabled={profileSaving} className="btn-primary flex-1 py-2.5 disabled:opacity-60">
                        {profileSaving ? 'Saving…' : 'Save Changes'}
                      </button>
                      <button onClick={() => { setProfileEdit(false); setProfileForm({ name: user?.name || '', department: user?.department || '', year: user?.year || '' }) }} className="btn-secondary flex-1 py-2.5">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {[
                      { label: 'Department', value: profileForm.department || '—', icon: 'account_balance' },
                      { label: 'Year of Study', value: profileForm.year || '—', icon: 'school' },
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
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="stat-card flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary text-[20px]">assignment</span>
                  <div>
                    <p className="font-headline text-xl font-bold text-on-surface">{applications.length}</p>
                    <p className="text-xs text-on-surface-variant font-label">Applications</p>
                  </div>
                </div>
                <div className="stat-card flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary text-[20px]">verified</span>
                  <div>
                    <p className="font-headline text-xl font-bold text-on-surface">{applications.filter(a=>a.status==='approved').length}</p>
                    <p className="text-xs text-on-surface-variant font-label">Approved</p>
                  </div>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Opportunity Detail Modal */}
      {selectedOpp && (() => {
        const meta = CATEGORY_ICON[selectedOpp.category] ?? { icon: 'work', color: 'text-primary bg-primary/10' }
        return (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={() => setSelectedOpp(null)}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="relative bg-surface-container-lowest rounded-t-2xl md:rounded-2xl w-full md:max-w-lg max-h-[90vh] overflow-y-auto shadow-elevated" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-start gap-4 p-6 border-b border-outline-variant/20">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                  <span className="material-symbols-outlined text-[22px]">{meta.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-headline text-on-surface font-bold text-lg leading-snug">{selectedOpp.title}</h2>
                  <p className="text-sm text-on-surface-variant font-label mt-0.5">{selectedOpp.department}</p>
                </div>
                <button onClick={() => setSelectedOpp(null)} className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center hover:bg-surface-container-high transition-colors flex-shrink-0">
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant">close</span>
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5">
                {/* Meta pills */}
                <div className="flex flex-wrap gap-2">
                  <span className="status-badge bg-surface-container text-on-surface-variant">{selectedOpp.category}</span>
                  {selectedOpp.stipend && <span className="status-badge bg-primary/10 text-primary">{selectedOpp.stipend}</span>}
                  {selectedOpp.vacancies && <span className="status-badge bg-surface-container text-on-surface-variant">{selectedOpp.vacancies} spots</span>}
                  <span className="status-badge bg-error/10 text-error">Due {new Date(selectedOpp.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>

                {/* Description */}
                <div>
                  <p className="text-xs font-label font-semibold text-on-surface-variant uppercase tracking-widest mb-2">Description</p>
                  <p className="text-sm text-on-surface font-label leading-relaxed">{selectedOpp.description}</p>
                </div>

                {/* Eligibility */}
                {selectedOpp.eligibility && (
                  <div>
                    <p className="text-xs font-label font-semibold text-on-surface-variant uppercase tracking-widest mb-2">Eligibility</p>
                    <p className="text-sm text-on-surface font-label leading-relaxed">{selectedOpp.eligibility}</p>
                  </div>
                )}
              </div>

              {/* Footer actions */}
              <div className="flex gap-3 px-6 pb-6">
                <button
                  onClick={() => { toggleApply(selectedOpp.id); setSelectedOpp(null) }}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-full text-sm font-semibold font-label transition-all ${
                    appliedIds.has(selectedOpp.id) ? 'bg-tertiary-container text-tertiary' : 'btn-primary'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">{appliedIds.has(selectedOpp.id) ? 'check' : 'send'}</span>
                  {appliedIds.has(selectedOpp.id) ? 'Already Applied' : 'Apply Now'}
                </button>
                <button
                  onClick={() => toggleBookmark(selectedOpp.id)}
                  className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                    bookmarks.has(selectedOpp.id) ? 'bg-primary/10 text-primary' : 'bg-surface-container text-on-surface-variant hover:text-primary'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">{bookmarks.has(selectedOpp.id) ? 'bookmark' : 'bookmark_border'}</span>
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-sm border-t border-outline-variant/20 z-30">
        <div className="flex items-center justify-around py-1 safe-bottom">
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
