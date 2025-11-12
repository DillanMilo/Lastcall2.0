# LastCall 2.0 - AI-Driven Inventory Management SaaS

LastCall is an AI-powered inventory management platform built by **Creative Currents LLC**. It helps small businesses—especially food retailers, delis, and boutique manufacturers—manage their stock, predict reorders, and avoid waste from expired or low-turnover items.

## 🚀 Features

- **Inventory Management**: Complete CRUD operations for inventory items
- **CSV Import**: Bulk import inventory data with drag-and-drop interface
- **AI-Powered Labeling**: Automatic product categorization and reorder suggestions using GPT-4o-mini
- **Stock Alerts**: Real-time notifications for low stock and expiring items
- **Dashboard Analytics**: Overview of key inventory metrics
- **Multi-tenant Architecture**: Built to support multiple organizations

## 🛠️ Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS + ShadCN/UI
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **AI**: OpenAI (gpt-4o-mini)
- **Deployment**: Vercel + Supabase

## 📦 Installation

### Quick Start (UI Only - No Backend)

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd Lastcall2.0
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Run development server**

   ```bash
   npm run dev
   ```

4. **Open your browser**

   Navigate to [http://localhost:3000](http://localhost:3000)

✨ **The UI will work immediately!** You can browse all pages and see the interface.

### Full Setup (With Backend)

For complete functionality with data persistence and AI features:

📘 **Follow the detailed guide**: `SUPABASE_SETUP.md`

Quick summary:

1. Create Supabase project
2. Add credentials to `.env.local`
3. Run SQL schema in Supabase
4. Restart dev server

Or use the **Setup Checklist**: `SETUP_CHECKLIST.md`

### Legacy Instructions (Database Schema)

If you prefer to set up manually, run the following SQL in your Supabase SQL editor:

```sql
-- USERS
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text UNIQUE NOT NULL,
  full_name text,
  org_id uuid,
  created_at timestamptz DEFAULT now()
);

-- ORGANIZATIONS
CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  subscription_tier text DEFAULT 'growth',
  created_at timestamptz DEFAULT now()
);

-- INVENTORY ITEMS
CREATE TABLE inventory_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid REFERENCES organizations (id),
  name text NOT NULL,
  sku text,
  quantity int DEFAULT 0,
  reorder_threshold int DEFAULT 0,
  ai_label text,
  category text,
  expiration_date date,
  last_restock timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- IMPORT LOGS
CREATE TABLE imports (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid REFERENCES organizations (id),
  source text,
  status text DEFAULT 'completed',
  created_at timestamptz DEFAULT now()
);
```

5. **Run the development server**

   ```bash
   npm run dev
   ```

6. **Open your browser**

   Navigate to [http://localhost:3000](http://localhost:3000)

## 🗂️ Project Structure

```
lastcall-2.0/
├── app/                      # Next.js App Router pages
│   ├── auth/                # Authentication pages
│   ├── dashboard/           # Main dashboard and features
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Landing page
├── components/
│   ├── ui/                  # ShadCN UI components
│   ├── dashboard/           # Dashboard-specific components
│   └── forms/               # Form components (CSV importer, etc.)
├── context/                 # Project documentation and guidelines
│   ├── ui.md                # UI/UX guidelines
│   ├── backend.md           # Backend best practices
│   └── ai.md                # AI integration guidelines
├── lib/
│   ├── ai/                  # AI functions (labeling, predictions)
│   ├── utils/               # Utility functions
│   └── supabaseClient.ts    # Supabase client configuration
├── types/                   # TypeScript type definitions
└── public/                  # Static assets
```

## 📖 Usage

### Import Inventory

1. Navigate to **Dashboard → Import**
2. Drag and drop a CSV file or click to browse
3. Ensure your CSV has at minimum a `name` column
4. Optional columns: `sku`, `quantity`, `reorder_threshold`, `expiration_date`
5. Click **Import** and wait for AI processing

### View Inventory

1. Navigate to **Dashboard → Inventory**
2. Use the search bar to filter items
3. View low stock alerts at the top
4. Items are automatically categorized by AI

### Dashboard Overview

The dashboard shows:

- Total inventory items
- Low stock alerts
- Items expiring soon
- Recommended reorders

## 🧠 AI Features

### Label Generator

Automatically categorizes products and suggests reorder frequency based on product names.

### Reorder Predictor (Phase 2)

Predicts optimal reorder dates based on historical usage patterns.

## 🔒 Environment Variables

Required environment variables:

- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `OPENAI_API_KEY` - Your OpenAI API key

Optional but recommended:

- `NEXT_PUBLIC_DEMO_EMAIL` / `NEXT_PUBLIC_DEMO_PASSWORD` - credentials for the “View live demo” button on the sign-in screen. Make sure the user exists (confirmed) inside Supabase Auth.
- `SUPABASE_SERVICE_ROLE_KEY` - enables the `/api/auth/bootstrap` fallback route that provisions organizations/users when RLS blocks client-side inserts. Store this secret only in server envs (Vercel project settings, `.env.local`)—never expose it via `NEXT_PUBLIC_*`.

## 🚧 Roadmap

### Phase 1 (Current) - MVP

- ✅ Authentication with Supabase
- ✅ Inventory CRUD operations
- ✅ CSV import system
- ✅ AI-powered labeling
- ✅ Dashboard UI

### Phase 2

- [ ] Predictive reordering with AI
- [ ] Email/SMS notifications
- [ ] Analytics dashboard with charts
- [ ] Historical data tracking

### Phase 3

- [ ] Stripe billing integration
- [ ] Multi-tenant team management
- [ ] API integrations (Shopify, Square, BigCommerce)
- [ ] AI chat assistant

## 📝 Development Guidelines

This project follows strict coding conventions documented in the `context/` directory:

- **UI Guidelines** (`context/ui.md`) - ShadCN/UI and TailwindCSS standards
- **UX Guidelines** (`context/ux.md`) - User experience best practices
- **Backend Guidelines** (`context/backend.md`) - Supabase and data handling
- **AI Guidelines** (`context/ai.md`) - OpenAI integration rules
- **General Guidelines** (`context/claude.md`) - Code quality standards

## 🤝 Contributing

This is a proprietary project by Creative Currents LLC. For internal team members:

1. Always read `context/*.md` files before making changes
2. Follow the established coding patterns
3. Keep files under 500 lines
4. Never expose API keys
5. Test all features before committing

## 📄 License

Proprietary - © 2025 Creative Currents LLC

## 🙋 Support

For questions or issues, contact the development team at Creative Currents LLC.

---

**Alpha Client**: Angus Biltong (`angus.lastcall.ai`)  
**Built by**: Creative Currents LLC  
**Version**: 2.0.0 (Phase 1 MVP)
