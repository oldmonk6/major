# RECLAIM - Addiction Recovery Support Platform

Production-quality frontend for a comprehensive addiction recovery support system combining personalized plans, daily task management, AI coaching, emotional tracking, and crisis support.

## 🎯 Overview

RECLAIM is a Next.js 16 + React 19 application designed to support individuals in their recovery journey with:
- **Personalized Recovery Plans**: Multi-step onboarding wizard
- **Daily Task Management**: XP-based progress tracking
- **Emotional Check-ins**: Quick daily mood and craving assessments
- **AI Coaching**: Real-time personalized guidance sessions
- **Risk Assessment**: Continuous monitoring with interventions
- **Private Journal**: Client-side encrypted entries (AES-GCM)
- **Progress Dashboard**: Visual recovery milestones
- **24/7 Crisis Support**: Emergency resources and SOS alerts

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- pnpm (or npm/yarn)

### Installation

```bash
cd frontend
pnpm install
```

### Development

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
pnpm build
pnpm start
```

## ⚙️ Configuration

### Environment Variables

Create a `.env.local` file in the `frontend/` directory:

```env
# Backend API endpoint
NEXT_PUBLIC_API_BASE=http://localhost:8000

# Optional: for production
# NEXT_PUBLIC_API_BASE=https://your-api-domain.com
```

## 📋 Required Backend API Endpoints

The frontend expects a REST API implementing these endpoints:

### Authentication
- `POST /auth/register` - Register new user
  - Body: `{ email, password }`
  - Response: `{ token, user_id }`
- `POST /auth/login` - Sign in
  - Body: `{ email, password }`
  - Response: `{ token, user_id }`

### Onboarding & Plans
- `POST /onboard` - Generate recovery plan
  - Body: `{ addiction, triggers[], goals[], constraints[], preferences }`
  - Response: `{ plan, user_id }`

### Tasks
- `GET /tasks/today` - Get daily tasks
  - Headers: `Authorization: Bearer {token}`
  - Response: `{ tasks[] }`
- `POST /tasks/{id}/complete` - Mark task complete
  - Headers: `Authorization: Bearer {token}`
  - Response: Success confirmation

### Check-ins
- `POST /checkins` - Save emotional check-in
  - Headers: `Authorization: Bearer {token}`
  - Body: `{ craving, urge, mood, triggers[] }`
  - Response: Confirmation with timestamp

### AI Coaching
- `POST /coach/session` - Start coaching session
  - Headers: `Authorization: Bearer {token}`
  - Body: `{ risk_bucket, last_task, streak_days }`
  - Response: `{ steps[] }` where each step has `{ title, instructions, suggested_duration_seconds }`

### Risk & Interventions
- `GET /risk` - Assess current risk level
  - Headers: `Authorization: Bearer {token}`
  - Response: `{ score, bucket, rationale }`
- `POST /jitai/choose` - Get just-in-time intervention
  - Headers: `Authorization: Bearer {token}`
  - Body: `{ risk_score, risk_bucket, recent_events, time_of_day }`
  - Response: `{ event_id, chosen_action, instructions, why }`
- `POST /jitai/feedback` - Provide intervention feedback
  - Headers: `Authorization: Bearer {token}`
  - Body: `{ event_id, reward }`
  - Response: Success confirmation

### Journal
- `POST /journal/upload` - Upload encrypted journal entry
  - Headers: `Authorization: Bearer {token}`
  - Body: FormData with `file` (encrypted) and `emotion_tags` (comma-separated)
  - Response: `{ journal_id }`

### Progress
- `GET /progress/summary` - Get progress statistics
  - Headers: `Authorization: Bearer {token}`
  - Response: `{ total_xp, completed_tasks, total_tasks, streak_days }`

### Crisis
- `POST /sos/alert` - Send crisis alert
  - Headers: `Authorization: Bearer {token}`
  - Body: `{ type, message }`
  - Response: `{ alert_id }`

## 🏗️ Architecture

### Tech Stack
- **Next.js 16**: App Router with React Server Components
- **React 19**: Latest features and optimizations
- **TypeScript**: Full type safety
- **Tailwind CSS**: Utility-first styling with CSS variables
- **Web Crypto API**: Client-side AES-GCM encryption

### Project Structure

```
frontend/
├── app/
│   ├── (pages)
│   │   ├── page.tsx                 # Landing page
│   │   ├── auth/page.tsx            # Auth form
│   │   ├── onboard/page.tsx         # Onboarding wizard
│   │   ├── tasks/page.tsx           # Daily tasks
│   │   ├── checkin/page.tsx         # Emotional check-in
│   │   ├── coach/page.tsx           # AI coaching
│   │   ├── risk/page.tsx            # Risk assessment
│   │   ├── journal/page.tsx         # Private journal
│   │   ├── progress/page.tsx        # Progress dashboard
│   │   ├── sos/page.tsx             # Crisis support
│   │   └── logout/page.tsx          # Logout handler
│   ├── layout.tsx                   # Root layout with nav
│   └── globals.css                  # Design system & tokens
├── components/
│   └── ui.tsx                       # Reusable UI components
├── lib/
│   └── utils.ts                     # Utilities & encryption
├── package.json
└── tsconfig.json
```

## 🎨 Design System

### Colors
- **Primary**: Teal/Cyan (#06b6d4, #0891b2)
- **Success**: Green (#10b981)
- **Warning**: Amber (#f59e0b)
- **Error**: Red (#ef4444)
- **Neutral**: Slate background (#0a0f1e to #334155)

### Typography
- **Font Family**: System stack (-apple-system, BlinkMacSystemFont, Segoe UI, Roboto)
- **Scale**: 32px, 24px, 20px, 18px, 16px, 14px, 12px
- **Weights**: 400 (normal), 500, 600 (semibold), 700, 800 (bold)

### Components
All components are in `components/ui.tsx`:
- Button (primary, secondary, danger variants)
- Input (text, email, number, password)
- Textarea
- Card
- SectionHeader
- Badge
- Pill
- EmptyState
- Toast
- Skeleton
- LoadingSpinner
- ProgressBar
- Slider
- Grid

## 🔒 Security Features

### Authentication
- Token-based auth with Bearer tokens
- Credentials stored in localStorage (keys: `reclaim_token`, `reclaim_user_id`)
- Protected routes redirect unauthenticated users to login

### Encryption
- Client-side AES-GCM encryption for journal entries
- PBKDF2 key derivation (100,000 iterations, SHA-256)
- Random salt (16 bytes) and IV (12 bytes) per entry
- Passphrase optional (defaults to "journal-default")

### Data Validation
- Email format validation
- Password length requirements (8+ characters)
- Form validation before submission
- Error handling with user-friendly messages

## 🔄 Data Flow

1. **Auth Flow**
   - User submits email/password → API validates → Token stored in localStorage
   - Token included in all subsequent requests as Authorization header

2. **Plan Generation**
   - User completes onboarding wizard → Submit to API → Store generated plan
   - Plan details shown in summary, tasks loaded on dashboard

3. **Daily Check-in**
   - User inputs mood, cravings, triggers → POST to /checkins → Show confirmation

4. **Journal Entry**
   - User writes entry → Client-side encryption → FormData upload → Confirmation

5. **Risk Assessment**
   - User requests assessment → GET /risk → Show score/bucket/rationale
   - Optional: request intervention → GET /jitai/choose → Show steps
   - Provide feedback → POST /jitai/feedback → Record reward

## 📱 Responsive Design

- **Mobile**: Single column, full-width inputs
- **Tablet**: 2-column grids for cards
- **Desktop**: 3-column grids, max-width containers
- All touch targets ≥ 44x44px

## ♿ Accessibility

- Semantic HTML (main, header, nav, section)
- ARIA labels on interactive elements
- WCAG AA color contrast (4.5:1 for text)
- Keyboard navigation with visible focus states
- Loading indicators for async operations
- Skip links on main navigation

## 🚀 Performance

- Code splitting via Next.js Route Segments
- Skeleton loaders for perceived performance
- Optimistic updates for instant feedback
- Lazy loading of heavy components
- Minimal JavaScript bundle

## 📡 Local Development with Backend

To develop against the FastAPI backend:

1. Start backend on `http://localhost:8000`
2. Frontend runs on `http://localhost:3000`
3. CORS should be enabled on backend for `http://localhost:3000`

Example backend health check:
```bash
curl http://localhost:8000/health
```

## 🧪 Testing

No tests included in this build. To add tests:

```bash
# Install Jest and React Testing Library
pnpm add -D jest @testing-library/react @testing-library/jest-dom

# Create __tests__ directory and add test files
# Run tests with: pnpm test
```

## 📦 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd frontend
vercel
```

Set environment variable in Vercel dashboard:
- `NEXT_PUBLIC_API_BASE`: Your production API URL

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## 🐛 Troubleshooting

### "API is not responding"
- Ensure backend is running on the correct port
- Check `NEXT_PUBLIC_API_BASE` environment variable
- Verify CORS is enabled on backend

### "localStorage is undefined"
- This error should not occur in production
- Ensure code runs on client side (use "use client" directive)

### "Encryption failed"
- Browser must support Web Crypto API (all modern browsers)
- Check browser console for specific crypto errors

## 📝 Development Notes

- All state is client-side (React hooks)
- No database queries on frontend
- API responses determine UI state
- Error messages are user-friendly
- Loading states prevent duplicate submissions

## 🤝 Contributing

Internal development. Contact the team for guidelines.

## 📞 Support

For issues, contact the development team or visit https://vercel.com/help
