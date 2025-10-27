# 🔧 Troubleshooting: "Error fetching user data"

## 🚨 Quick Fix (2 minutes)

If you're seeing "Error fetching user data: {}" on the settings page, here's how to fix it:

### Option 1: Run the Auto-Fix SQL (Recommended)

1. Open **Supabase Dashboard** → **SQL Editor**
2. Copy and paste from `FIX_USER_SETUP.sql`
3. Click **RUN**
4. Refresh your settings page: http://localhost:3000/dashboard/settings
5. ✅ Should work now!

---

### Option 2: Restart Dev Server

The page now handles missing users gracefully, so just:

```bash
# Stop server (Ctrl+C)
# Restart:
npm run dev
```

Then refresh: http://localhost:3000/dashboard/settings

The page will now load even without a user in the database!

---

## 🎯 What Was the Problem?

Your authenticated user exists in `auth.users` (Supabase Auth) but not in your app's `users` table. This happens when:

1. You sign up via Supabase Auth
2. But no entry is created in your custom `users` table

**The Fix:** The updated settings page now:

- ✅ Works even if user isn't in the users table
- ✅ Creates user entry automatically when you save
- ✅ Shows default values from auth data

---

## 🧪 Test It

1. Go to: http://localhost:3000/dashboard/settings
2. You should now see the settings page (no error!)
3. Fill in your name
4. Click "Save Changes"
5. ✅ Your user will be created in the database

---

## 📋 Create Demo Account

Want a ready-to-use demo account? See `DEMO_ACCOUNT_SETUP.sql`

**Quick Steps:**

1. **Supabase Dashboard** → **Authentication** → **Users**
2. Click **"Add User"**
3. Email: `demo@lastcall.app`
4. Password: `demo123456`
5. Auto Confirm: ✅ YES
6. Click **"Create User"**
7. Run SQL from `DEMO_ACCOUNT_SETUP.sql`
8. Sign in at: http://localhost:3000/auth/signin

---

## 🔍 Verify Your Setup

Run this in Supabase SQL Editor:

```sql
-- Check auth users
SELECT id, email, created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- Check app users
SELECT id, email, full_name, org_id
FROM users
ORDER BY created_at DESC
LIMIT 5;

-- They should match!
```

If auth.users has users but users table is empty, run `FIX_USER_SETUP.sql`.

---

## ✅ Files to Help You

1. **`FIX_USER_SETUP.sql`** - Auto-fixes missing users
2. **`DEMO_ACCOUNT_SETUP.sql`** - Creates demo account
3. **`PROFILE_SETUP.sql`** - Adds avatar/phone columns (run first!)
4. **`PROFILE_QUICK_START.md`** - Quick setup guide

---

## 🚀 Fresh Start?

If you want to start completely fresh:

```sql
-- CAUTION: This deletes all app users (not auth)
TRUNCATE users CASCADE;

-- Then run FIX_USER_SETUP.sql to re-add current auth users
```

---

## 💡 Still Having Issues?

**Settings page not loading at all?**

- Check Supabase credentials in `.env.local`
- Restart dev server
- Hard refresh browser (Cmd+Shift+R)

**Can't save profile changes?**

- Run `PROFILE_SETUP.sql` first (adds columns)
- Check browser console for errors
- Verify Supabase connection

**Storage/avatar errors?**

- Run `PROFILE_SETUP.sql` (creates storage bucket)
- Check Supabase Storage is enabled
- Verify storage policies are set

---

## ✨ Your Page Should Show

Even without database setup, you should now see:

```
Settings
├─ Profile Picture (placeholder icon)
├─ Account Information (editable)
├─ Organization (may be empty)
└─ Change Password (works!)
```

When you save, it will create your user entry automatically! 🎉

---

**Need more help?** Check browser console (F12) for detailed error messages!
