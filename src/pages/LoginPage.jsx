import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { login, signUp, loading, error, clearError } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState('login')   // 'login' | 'signup'
  const [form, setForm] = useState({
    email: '', password: '', name: '', department: '', year: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [signupSuccess, setSignupSuccess] = useState(false)

  function setField(key, val) {
    setForm((f) => ({ ...f, [key]: val }))
    clearError()
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (mode === 'login') {
      const ok = await login(form.email, form.password)
      // onAuthStateChange will update user; App routing handles redirect via ProtectedRoute
      // But we also push manually for speed
      if (ok) {
        // role comes from profile — wait briefly then push based on profile
        // The auth listener will set user; we listen to it in App via ProtectedRoute
        // Navigate to a neutral route and let the redirect happen
        navigate('/', { replace: true })
      }
    } else {
      const ok = await signUp({
        email: form.email,
        password: form.password,
        name: form.name,
        role: 'student',
        department: form.department,
        year: form.year || null,
      })
      if (ok) setSignupSuccess(true)
    }
  }

  if (signupSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full card p-8 text-center">
          <span className="material-symbols-outlined text-tertiary text-5xl mb-4">mark_email_read</span>
          <h2 className="font-headline text-2xl font-bold text-on-surface mb-2">Check your email</h2>
          <p className="text-on-surface-variant text-sm font-label mb-6">
            We sent a confirmation link to <span className="text-primary font-semibold">{form.email}</span>.
            Confirm your email then come back to sign in.
          </p>
          <button
            onClick={() => { setSignupSuccess(false); setMode('login') }}
            className="btn-primary w-full py-3"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-2/5 bg-gradient-primary p-12 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-white/5" />
        <div className="absolute -bottom-16 -left-16 w-72 h-72 rounded-full bg-white/5" />
        <div className="absolute top-1/2 right-8 w-48 h-48 rounded-full bg-white/5 -translate-y-1/2" />

        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-white/90 text-3xl">school</span>
            <span className="font-headline text-white text-lg font-bold tracking-wide uppercase">
              Academic Atelier
            </span>
          </div>
          <p className="text-white/60 text-sm font-label">Campus Opportunities Portal</p>
        </div>

        <div className="relative">
          <h2 className="font-headline text-white text-4xl font-extrabold leading-tight mb-6">
            Your Gateway to Campus Excellence
          </h2>
          <p className="text-white/70 text-base leading-relaxed mb-10">
            Discover research fellowships, internships, scholarships, and more — all curated for
            your academic journey.
          </p>
          <div className="grid grid-cols-2 gap-5">
            {[
              { icon: 'workspace_premium', label: 'Active Opportunities', value: '1,284' },
              { icon: 'group', label: 'Enrolled Students', value: '12,500+' },
              { icon: 'verified', label: 'Placements This Year', value: '3,200' },
              { icon: 'stars', label: 'Partner Institutions', value: '48' },
            ].map((s) => (
              <div key={s.label} className="bg-white/10 rounded-lg p-4">
                <span className="material-symbols-outlined text-white/80 mb-2">{s.icon}</span>
                <p className="text-white text-xl font-bold font-headline">{s.value}</p>
                <p className="text-white/60 text-xs font-label mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-white/40 text-xs font-label">
          © 2024 Academic Atelier · All rights reserved
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 overflow-y-auto">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <span className="material-symbols-outlined text-primary text-2xl">school</span>
            <span className="font-headline text-on-surface font-bold text-lg">Academic Atelier</span>
          </div>

          {/* Mode toggle */}
          <div className="bg-surface-container-low rounded-lg p-1 flex gap-1 mb-6">
            {[
              { id: 'login', label: 'Sign In' },
              { id: 'signup', label: 'Create Account' },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => { setMode(m.id); clearError() }}
                className={`flex-1 py-2.5 rounded-md text-sm font-semibold font-label transition-all duration-200 ${
                  mode === m.id
                    ? 'bg-surface-container-lowest text-primary shadow-soft'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <h1 className="font-headline text-3xl font-extrabold text-on-surface mb-1">
            {mode === 'login' ? 'Welcome back' : 'Join the portal'}
          </h1>
          <p className="text-on-surface-variant text-sm mb-6">
            {mode === 'login'
              ? 'Sign in to access your campus opportunities.'
              : 'Create your account to start exploring opportunities.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Signup extras */}
            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-xs font-label font-semibold text-on-surface-variant uppercase tracking-widest mb-1.5">
                    Full Name *
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">badge</span>
                    <input
                      required
                      type="text"
                      value={form.name}
                      onChange={(e) => setField('name', e.target.value)}
                      placeholder="Your full name"
                      className="input-field pl-10"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-label font-semibold text-on-surface-variant uppercase tracking-widest mb-1.5">
                    Department
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">account_balance</span>
                    <input
                      type="text"
                      value={form.department}
                      onChange={(e) => setField('department', e.target.value)}
                      placeholder="e.g. Computer Science"
                      className="input-field pl-10"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-label font-semibold text-on-surface-variant uppercase tracking-widest mb-1.5">
                    Year of Study
                  </label>
                  <select
                    value={form.year}
                    onChange={(e) => setField('year', e.target.value)}
                    className="input-field"
                  >
                    <option value="">Select year</option>
                    {['1st Year', '2nd Year', '3rd Year', '4th Year', 'Postgraduate'].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* Email */}
            <div>
              <label className="block text-xs font-label font-semibold text-on-surface-variant uppercase tracking-widest mb-1.5">
                Institutional Email *
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">mail</span>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setField('email', e.target.value)}
                  placeholder="your.name@university.edu"
                  className="input-field pl-10"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-label font-semibold text-on-surface-variant uppercase tracking-widest">
                  Password *
                </label>
                {mode === 'login' && (
                  <button type="button" className="text-xs text-primary font-label font-semibold hover:underline">
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">lock</span>
                <input
                  required
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setField('password', e.target.value)}
                  placeholder={mode === 'signup' ? 'Minimum 6 characters' : 'Enter your password'}
                  minLength={mode === 'signup' ? 6 : undefined}
                  className="input-field pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-base">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 bg-error-container/20 border border-error/20 rounded-md p-3">
                <span className="material-symbols-outlined text-error text-base mt-0.5">error</span>
                <p className="text-error text-sm font-label">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 text-base disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                  {mode === 'login' ? 'Signing in…' : 'Creating account…'}
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">
                    {mode === 'login' ? 'login' : 'person_add'}
                  </span>
                  {mode === 'login' ? 'Sign into Portal' : 'Create Account'}
                </>
              )}
            </button>
          </form>

          {mode === 'login' && (
            <>
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-outline-variant/40" />
                <span className="text-xs text-on-surface-variant font-label">or</span>
                <div className="flex-1 h-px bg-outline-variant/40" />
              </div>
              <button
                type="button"
                className="w-full flex items-center justify-center gap-3 py-3 rounded-full bg-surface-container text-on-surface text-sm font-semibold font-label hover:bg-surface-container-high transition-colors"
              >
                <span className="material-symbols-outlined text-base text-primary">account_balance</span>
                Continue with University SSO
              </button>
            </>
          )}

          <p className="text-xs text-on-surface-variant font-label text-center mt-5">
            By signing in, you agree to our{' '}
            <span className="text-primary cursor-pointer hover:underline">Academic Integrity Policy</span>{' '}
            and{' '}
            <span className="text-primary cursor-pointer hover:underline">Privacy Terms</span>.
          </p>
        </div>
      </div>
    </div>
  )
}
