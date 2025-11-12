# 🔗 Supabase Redirect URL Configuration

## ⚠️ Important: Configure Redirect URLs in Supabase

When users click email confirmation links, Supabase needs to know which URLs are allowed for redirects. If your production URL isn't configured, it will default to localhost.

---

## 🚀 Step 1: Add Production URL to Supabase

1. **Go to your Supabase Dashboard**: https://supabase.com/dashboard
2. **Select your project**
3. **Go to**: **Authentication** → **URL Configuration** (in the left sidebar)
4. **Find the "Redirect URLs" section**

### Add These URLs:

```
https://lastcall2-0-fhth.vercel.app/**
http://localhost:3000/**
```

**Important Notes:**
- The `/**` wildcard allows all paths on that domain
- Add both production and localhost for development
- Click **"Add URL"** after each one
- Click **"Save"** at the bottom

---

## 🔍 Step 2: Verify Site URL

In the same **URL Configuration** page:

1. **Set "Site URL"** to: `https://lastcall2-0-fhth.vercel.app`
2. This is the default redirect URL if none is specified
3. Click **"Save"**

---

## ✅ Step 3: Verify Environment Variable in Vercel

Make sure your Vercel project has:

```
NEXT_PUBLIC_SITE_URL=https://lastcall2-0-fhth.vercel.app
```

**To check:**
1. Go to Vercel Dashboard → Your Project
2. **Settings** → **Environment Variables**
3. Verify `NEXT_PUBLIC_SITE_URL` is set correctly
4. If missing, add it and **Redeploy**

---

## 🧪 Step 4: Test Email Confirmation

1. **Sign up** with a new email on your production site
2. **Check your email** for the confirmation link
3. **Click the link** - it should redirect to:
   - ✅ `https://lastcall2-0-fhth.vercel.app/dashboard`
   - ❌ NOT `http://localhost:3000/dashboard`

---

## 🐛 Troubleshooting

### Still redirecting to localhost?

1. **Clear browser cache** and cookies
2. **Check Supabase Dashboard** - make sure URLs are saved
3. **Redeploy Vercel** - environment variables need a redeploy
4. **Check the email link** - hover over it to see the actual URL

### Link shows localhost in the email?

- The redirect URL is set when the user signs up
- If they signed up on localhost, the link will have localhost
- **Solution**: Have them sign up again on production

### "Invalid redirect URL" error?

- Supabase is blocking the redirect
- **Fix**: Add the exact URL to Supabase's allowed redirect URLs
- Make sure there's no trailing slash mismatch

---

## 📋 Quick Checklist

- [ ] Production URL added to Supabase Redirect URLs
- [ ] Localhost URL added to Supabase Redirect URLs (for dev)
- [ ] Site URL set in Supabase to production URL
- [ ] `NEXT_PUBLIC_SITE_URL` set in Vercel environment variables
- [ ] Vercel project redeployed after adding env var
- [ ] Tested email confirmation link on production

---

## 🎯 Current Configuration Needed

**Supabase Dashboard → Authentication → URL Configuration:**

```
Site URL: https://lastcall2-0-fhth.vercel.app

Redirect URLs:
- https://lastcall2-0-fhth.vercel.app/**
- http://localhost:3000/**
```

**Vercel Environment Variables:**

```
NEXT_PUBLIC_SITE_URL=https://lastcall2-0-fhth.vercel.app
```

Once both are configured, your email confirmation links will work correctly! 🎉
