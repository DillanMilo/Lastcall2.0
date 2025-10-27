# 🚀 Profile Setup - Quick Start (5 Minutes)

## Step 1: Run SQL (2 minutes)

1. Open **Supabase Dashboard** → **SQL Editor**
2. Copy all SQL from `PROFILE_SETUP.sql`
3. Paste and click **RUN**
4. ✅ Should see: "Success. No rows returned"

---

## Step 2: Restart Dev Server (1 minute)

```bash
# Stop current server (Ctrl+C)
npm run dev
```

---

## Step 3: Test It! (2 minutes)

1. Go to: **http://localhost:3000/dashboard/settings**
2. Upload a profile picture
3. Update your name
4. Click "Save Changes"
5. ✅ Done!

---

## 🎉 What You'll See

### Desktop Sidebar (Left):

```
┌────────────────────┐
│   LastCall         │
│   Inventory Mgmt   │
├────────────────────┤
│ • Dashboard        │
│ • Inventory        │
│ • Import           │
│ • Settings         │
├────────────────────┤
│ [👤] Your Name     │  ← Profile preview!
│     View Profile   │
├────────────────────┤
│ 🚪 Sign Out        │
└────────────────────┘
```

### Settings Page:

- 📸 Profile picture upload
- ✏️ Edit name, email, phone
- 🏢 Organization info
- 🔐 Change password

---

## ✨ Features

✅ **Profile Picture**

- Upload images (JPG, PNG, GIF)
- Max 2MB size
- Displays in sidebar
- Secure storage

✅ **Editable Details**

- Full name
- Email (with verification)
- Phone number (optional)
- Auto-save

✅ **Organization View**

- Company name
- Subscription tier
- Member since date

✅ **Password Change**

- Update anytime
- Secure & encrypted
- Immediate effect

✅ **Mobile Responsive**

- Works on phone
- Touch-friendly
- Native file picker

---

## 🐛 Troubleshooting

**SQL fails?**

- Make sure you're in the right Supabase project
- Check you have admin permissions
- Try running in sections

**Can't upload photo?**

- Check file is under 2MB
- Must be image format (JPG/PNG/GIF)
- Try a different image

**Profile not showing?**

- Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
- Clear browser cache
- Restart dev server

---

## 📚 Full Documentation

See `PROFILE_SETUP_GUIDE.md` for complete details!

---

**Ready? Go to:** http://localhost:3000/dashboard/settings
