# LastCall 2.0 - Quick Start Guide

## ✅ Project Status: Ready to Run!

Your LastCall 2.0 project is fully set up and operational.

---

## 🚀 Running the Project

### Development Server

The server is already running on: **http://localhost:3003**

If you need to restart:

```bash
npm run dev
```

### Production Build

```bash
npm run build
npm start
```

---

## 🔑 Next Steps

### 1. Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. In your Supabase dashboard, go to **Project Settings** → **API**
3. Copy your **Project URL** and **anon/public key**
4. Create a `.env.local` file in the project root:

```bash
cp env.example .env.local
```

5. Edit `.env.local` and add your credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_api_key
```

### 2. Set Up Database

Run the SQL from `SUPABASE_SCHEMA.sql` in your Supabase SQL Editor to create all tables.

### 3. Get OpenAI API Key

1. Go to [platform.openai.com](https://platform.openai.com)
2. Create an API key
3. Add it to your `.env.local` file

---

## 📁 Project Structure

```
lastcall-2.0/
├── app/                      # Next.js pages (App Router)
│   ├── auth/signin/         # Authentication page
│   ├── dashboard/           # Main application
│   │   ├── inventory/       # Inventory management
│   │   ├── import/          # CSV import
│   │   └── settings/        # Settings
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Landing page
├── components/
│   ├── ui/                  # ShadCN UI components
│   ├── dashboard/           # Navigation, etc.
│   └── forms/               # CSV Importer
├── lib/
│   ├── ai/                  # AI functions
│   │   ├── labelGenerator.ts
│   │   └── reorderPredictor.ts
│   ├── utils/               # Utilities
│   └── supabaseClient.ts
├── types/                   # TypeScript definitions
└── context/                 # Project guidelines
```

---

## 🎯 Available Pages

| Route                  | Description                    |
| ---------------------- | ------------------------------ |
| `/`                    | Landing page with sign-in link |
| `/auth/signin`         | Authentication page            |
| `/dashboard`           | Main dashboard with stats      |
| `/dashboard/inventory` | View and manage inventory      |
| `/dashboard/import`    | Import CSV files               |
| `/dashboard/settings`  | Account settings               |

---

## 🧪 Testing Without Setup

You can test the UI without setting up Supabase/OpenAI:

- Visit the landing page
- Browse the dashboard UI (will show empty states)
- Test the CSV import interface (will fail without backend)

---

## 📝 Key Features

✅ **Complete MVP Implementation**

- Authentication flow with Supabase
- Inventory CRUD operations
- CSV import with drag-and-drop
- AI-powered product categorization
- Low stock alerts
- Expiry tracking
- Responsive dashboard

✅ **Tech Stack**

- Next.js 15 (App Router)
- TypeScript
- TailwindCSS + ShadCN/UI
- Supabase (PostgreSQL)
- OpenAI (gpt-4o-mini)

---

## 🐛 Troubleshooting

### Port Already in Use

If port 3000 is occupied, Next.js will automatically use another port (like 3003).

### Build Errors

If you encounter build errors after changes:

```bash
rm -rf .next node_modules package-lock.json
npm install
npm run dev
```

### Environment Variables Not Loading

- Restart the dev server after changing `.env.local`
- Make sure `.env.local` is in the project root
- Never commit `.env.local` to git

---

## 📚 Documentation

All project guidelines are in the `context/` folder:

- `context/ui.md` - UI/UX standards
- `context/backend.md` - Backend practices
- `context/ai.md` - AI integration rules
- `context/claude.md` - General guidelines

Full README: `README.md`

---

## 🔄 Development Workflow

1. Make changes to code
2. Dev server hot-reloads automatically
3. Test in browser
4. Commit changes

### CSV Import Format

Create a CSV with these columns:

```csv
name,sku,quantity,reorder_threshold,expiration_date
Angus Biltong Original,ANG-001,50,10,2025-03-01
Beef Jerky Teriyaki,BJ-TERI,30,5,2025-02-15
```

---

## 🎨 Customization

### Colors

Edit CSS variables in `app/globals.css`

### Logo/Branding

Update in `components/dashboard/Navigation.tsx`

### UI Components

All components are in `components/ui/` following ShadCN patterns

---

## 🚢 Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy automatically

### Environment Variables in Production

Add the same variables from `.env.local` to your hosting platform's environment settings.

---

**Built by Creative Currents LLC**  
**Alpha Client**: Angus Biltong  
**Version**: 2.0.0 (Phase 1 MVP)
