# Supabase Setup Guide for LastCall 2.0

This guide will walk you through setting up Supabase with multi-tenant support for LastCall 2.0.

---

## 🚀 Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click **"Start your project"** or **"New Project"**
3. Create an organization if you don't have one
4. Create a new project:

   - **Name**: `lastcall-inventory` (or your choice)
   - **Database Password**: Generate a strong password (save this!)
   - **Region**: Choose closest to your users
   - **Pricing Plan**: Free tier is perfect to start

5. Wait 2-3 minutes for project to provision

---

## 🔑 Step 2: Get Your Credentials

Once your project is ready:

1. Go to **Project Settings** (gear icon in sidebar)
2. Click **API** in the left menu
3. You'll see:

   - **Project URL**: `https://xxxxx.supabase.co`
   - **Project API keys**:
     - `anon` `public` key (this is safe for browser)
     - `service_role` key (keep this SECRET - server only)

4. Copy the **Project URL** and **anon public** key

---

## 📝 Step 3: Configure Environment Variables

1. In your project root, create `.env.local`:

```bash
# In terminal:
cd /Users/dillanmilosevich/Desktop/Lastcall2.0
cp env.example .env.local
```

2. Edit `.env.local` and add your credentials:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# OpenAI Configuration (optional for now)
OPENAI_API_KEY=your_openai_key_here
```

---

## 🗄️ Step 4: Set Up Database Schema

1. In Supabase Dashboard, click **SQL Editor** (in left sidebar)
2. Click **New Query**
3. Copy and paste the SQL from `SUPABASE_SCHEMA.sql`
4. Click **RUN** (or press Cmd+Enter / Ctrl+Enter)

You should see: ✅ **Success. No rows returned**

This creates:

- ✅ `users` table
- ✅ `organizations` table
- ✅ `inventory_items` table
- ✅ `imports` table
- ✅ Row Level Security (RLS) policies
- ✅ Indexes for performance

---

## 👥 Step 5: Create Test Organization & User

Let's create a test organization for development:

```sql
-- Run this in SQL Editor

-- 1. Create a test organization (Angus Biltong as alpha client)
INSERT INTO organizations (id, name, subscription_tier)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Angus Biltong',
  'growth'
);

-- 2. Create a test user (replace with your email)
INSERT INTO users (id, email, full_name, org_id)
VALUES (
  gen_random_uuid(),
  'test@angusbiltong.com',  -- Replace with your email
  'Test User',
  '00000000-0000-0000-0000-000000000001'
);

-- 3. View what we created
SELECT * FROM organizations;
SELECT * FROM users;
```

---

## 🔐 Step 6: Set Up Authentication

### Enable Email Authentication

1. In Supabase Dashboard, go to **Authentication** → **Providers**
2. Make sure **Email** is enabled
3. Configure email settings:
   - **Enable Email Confirmations**: Turn OFF for development (turn ON in production)
   - **Enable Email Signup**: ON

### ⚠️ IMPORTANT: Email Confirmations Must Be Disabled

For development/testing, **email confirmations MUST be turned OFF**, otherwise:
- Users won't receive signup emails
- Signup will fail with "Check your email" message
- You'll need to manually confirm users in Supabase Dashboard

**To disable email confirmations:**
1. Go to **Authentication** → **Settings** (not Providers)
2. Scroll to **Email Auth**
3. Turn OFF **Enable email confirmations**
4. Click **Save**

### (Optional) Enable Google OAuth

1. Go to **Authentication** → **Providers**
2. Enable **Google**
3. Follow the setup instructions to get Google OAuth credentials

---

## 🧪 Step 7: Test Your Setup

1. **Restart your dev server**:

```bash
# Stop current server (Ctrl+C)
npm run dev
```

2. **Open your app**: http://localhost:3000

3. **Test Sign In**:

   - Go to `/auth/signin`
   - Try signing in with the test email you created
   - Check Supabase Dashboard → **Authentication** → **Users** to see registered users

4. **Test Import**:

   - Create a simple CSV file:

   ```csv
   name,sku,quantity,reorder_threshold,expiration_date
   Test Product,TEST-001,100,20,2025-12-31
   Sample Item,SAMPLE-01,50,10,2025-06-30
   ```

   - Go to `/dashboard/import`
   - Upload the CSV
   - Should import successfully!

5. **View Inventory**:
   - Go to `/dashboard/inventory`
   - You should see your imported items

---

## 🏢 Multi-Tenant Architecture

### How It Works

LastCall 2.0 is built for **multi-tenancy**:

```
Organization (Angus Biltong)
├── User 1 (owner@angus.com)
├── User 2 (manager@angus.com)
└── Inventory Items (only their items)

Organization (Another Client)
├── User 3 (admin@client.com)
└── Inventory Items (separate from above)
```

### Key Features

1. **Data Isolation**: Each organization only sees their own data
2. **Row Level Security (RLS)**: Enforced at database level
3. **Shared Schema**: All organizations use same tables (efficient)
4. **Scalable**: Add new organizations without schema changes

### Current Implementation

Right now, we're using a **hardcoded org_id** in the CSV importer:

```typescript
// In app/dashboard/import/page.tsx
const orgId = "00000000-0000-0000-0000-000000000000"; // Placeholder
```

### Next Steps for Production

To make it fully multi-tenant, we need to:

1. **Get org_id from authenticated user**:

```typescript
const {
  data: { user },
} = await supabase.auth.getUser();
const { data: userData } = await supabase
  .from("users")
  .select("org_id")
  .eq("id", user.id)
  .single();
const orgId = userData.org_id;
```

2. **Add organization context** to all pages
3. **Implement team management** (invite users, roles)

Would you like me to implement the real multi-tenant authentication now?

---

## 📊 View Your Data

You can view/edit data directly in Supabase:

1. Go to **Table Editor** in Supabase Dashboard
2. Click on any table:
   - `organizations` - See all clients
   - `users` - See all users
   - `inventory_items` - See all inventory
   - `imports` - See import logs

---

## 🔒 Security Notes

### ✅ What's Secure

- RLS policies prevent users from seeing other orgs' data
- API keys are environment variables (not in code)
- Supabase `anon` key is safe for browser (limited permissions)

### ⚠️ Important for Production

1. **Enable Email Confirmations** in Auth settings
2. **Set up custom email templates** (branding)
3. **Add rate limiting** (Supabase has built-in)
4. **Use service_role key** only in server-side API routes
5. **Set up backup policies** for your database

---

## 🐛 Troubleshooting

### "Error fetching inventory"

- Check `.env.local` has correct credentials
- Restart dev server after changing `.env.local`
- Verify tables exist in Table Editor

### "Row Level Security policy violation"

- Make sure RLS policies were created (run schema again)
- Check user exists in `users` table with valid `org_id`

### "No items showing after import"

- Check `inventory_items` table in Supabase Table Editor
- Verify `org_id` matches between user and items
- Check browser console for errors

### Auth not working

- Verify email provider is enabled
- Check if user exists in Auth → Users
- Confirm `.env.local` variables are loaded

---

## 📚 Next Steps

Once Supabase is working:

1. ✅ Test CSV import with real data
2. ✅ Create multiple test users
3. ✅ Test RLS (users can't see other org's data)
4. 🔜 Set up OpenAI for AI labeling
5. 🔜 Implement real auth flow
6. 🔜 Add team management
7. 🔜 Deploy to production

---

## 🆘 Need Help?

Check these resources:

- [Supabase Documentation](https://supabase.com/docs)
- [Next.js + Supabase Guide](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
- [RLS Policies Guide](https://supabase.com/docs/guides/auth/row-level-security)

Or see the main README.md for more project information.

