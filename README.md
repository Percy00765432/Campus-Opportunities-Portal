# Campus Opportunities Portal

A full-stack web application that connects students with campus opportunities (internships, research, jobs, events) — with dedicated dashboards for Students, Mentors, and Administrators.


---

## Features

- **Student Dashboard** — Browse and apply to opportunities, track application status, bookmark listings, and message mentors
- **Mentor Dashboard** — Post opportunities, review student applications, and communicate with students
- **Admin Dashboard** — Manage all users, opportunities, and view platform analytics
- **Role-based Auth** — Login redirects automatically based on role (student / mentor / admin)
- **Mobile Responsive** — Fully responsive across all screen sizes with a mobile drawer sidebar and bottom navigation

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite |
| Styling | Tailwind CSS |
| Backend / Auth / DB | Supabase (PostgreSQL + Auth) |
| Routing | React Router v6 |
| Deployment | Vercel |

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
# Clone the repo
git clone https://github.com/Percy00765432/Campus-Opportunities-Portal.git
cd Campus-Opportunities-Portal

# Install dependencies
npm install
```

### Environment Variables

Create a `.env.local` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

You can find these values in your Supabase project under **Settings → API**.

### Run Locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for Production

```bash
npm run build
```

---

## Assigning User Roles

By default, all new sign-ups are assigned the `student` role. To assign a different role (admin or mentor):

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Open your project → **Table Editor** → `users` table
3. Find the user by email
4. Edit the `role` column and set it to `admin` or `mentor`
5. Sign out and sign back in — the app will redirect you to the correct dashboard

---

## Project Structure

```
src/
├── components/
│   └── ProtectedRoute.jsx   # Role-based route guard
├── context/
│   └── AuthContext.jsx      # Global auth state
├── lib/
│   └── supabase.js          # Supabase client
├── pages/
│   ├── LoginPage.jsx
│   ├── StudentDashboard.jsx
│   ├── MentorDashboard.jsx
│   └── AdminDashboard.jsx
└── App.jsx                  # Routes and app shell
```
