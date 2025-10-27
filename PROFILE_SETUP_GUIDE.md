# 👤 Profile & Settings Setup Guide

## ✅ What's New

Your LastCall app now has a complete profile management system!

### Features:

- ✅ **Profile Picture Upload** - Upload and display user avatars
- ✅ **Editable Profile** - Update name, email, phone
- ✅ **Organization Info** - View organization details
- ✅ **Password Change** - Securely update password
- ✅ **Mobile Responsive** - Works beautifully on all devices

---

## 🚀 Setup (Required)

### Step 1: Run SQL Migration

1. Go to your **Supabase Dashboard**
2. Click **SQL Editor** (in left sidebar)
3. Click **New Query**
4. Copy and paste the SQL from `PROFILE_SETUP.sql`
5. Click **RUN** (or press Cmd+Enter)

This will:

- Add `avatar_url` and `phone` fields to users table
- Create Supabase Storage bucket for avatars
- Set up storage policies for secure uploads

**Expected result:** ✅ "Success. No rows returned"

---

## 📱 How to Use

### Access Profile Settings

Navigate to: **Dashboard → Settings**

Or click the **Settings** icon in the navigation.

---

## 🎨 Features Breakdown

### 1. Profile Picture

**Upload Your Photo:**

1. Go to Settings
2. Click **"Upload Photo"** under Profile Picture
3. Select an image (JPG, PNG, or GIF)
4. Max file size: 2MB
5. Photo uploads instantly!

**Your photo will:**

- Display in Settings page
- Show in navigation (when implemented)
- Be accessible across the app

---

### 2. Account Information

**Edit Your Details:**

**Full Name:**

- Your display name
- Shows in dashboard
- Editable anytime

**Email:**

- Your login email
- Changing requires verification
- Secure authentication

**Phone (Optional):**

- Contact number
- Optional field
- Format: +1 (555) 123-4567

**Save Changes:**

- Click "Save Changes" button
- See success message
- Updates immediately

---

### 3. Organization Info

**View:**

- Organization name
- Subscription plan (Growth, Enterprise, Trial)
- Member since date
- Read-only (admins can edit later)

---

### 4. Password Change

**Update Password:**

1. Enter new password (min 6 characters)
2. Confirm new password
3. Click "Update Password"
4. Done! Password updated securely

**Security:**

- Passwords stored securely by Supabase Auth
- No current password needed (magic link auth)
- Immediate effect

---

## 🎨 What It Looks Like

### Mobile View:

```
┌─────────────────────────┐
│   Profile Picture       │
│   [Avatar or Icon]      │
│   [Upload Photo]        │
├─────────────────────────┤
│   Account Information   │
│   Full Name: [____]     │
│   Email: [____]         │
│   Phone: [____]         │
│   [Save Changes]        │
├─────────────────────────┤
│   Organization          │
│   Name: Angus Biltong   │
│   Plan: Growth          │
├─────────────────────────┤
│   Change Password       │
│   New: [____]           │
│   Confirm: [____]       │
│   [Update Password]     │
└─────────────────────────┘
```

### Desktop View:

- Cards laid out vertically
- Profile picture on left with upload button
- All fields easily editable
- Clean, professional design

---

## 🔧 Technical Details

### Database Changes

**users table (new columns):**

```sql
avatar_url TEXT  -- URL to profile picture
phone TEXT       -- Phone number (optional)
```

### Storage Setup

**Bucket:** `avatars`

- Public read access
- Users can only upload/edit their own
- Secure with RLS policies
- Images stored in: `avatars/{user_id}/filename.ext`

---

## 🧪 Test It Out

### Test Checklist:

**Profile Picture:**

- [ ] Upload a photo
- [ ] See it display immediately
- [ ] Try uploading different image
- [ ] Verify it persists after refresh

**Account Info:**

- [ ] Update full name
- [ ] Add phone number
- [ ] Click Save Changes
- [ ] See success message

**Password:**

- [ ] Enter new password
- [ ] Confirm password
- [ ] Update password
- [ ] Sign out and sign in with new password

**Mobile:**

- [ ] Open on phone
- [ ] All fields work
- [ ] Upload photo from phone
- [ ] Save changes

---

## 🎯 User Experience

### Success States:

- ✅ Green success message after updates
- ✅ Loading spinners during operations
- ✅ Immediate visual feedback

### Error Handling:

- ❌ File too large warning
- ❌ Invalid image type warning
- ❌ Password mismatch warning
- ❌ Network error handling

### Mobile Optimized:

- Touch-friendly buttons
- Full-width forms on mobile
- Native file picker
- Responsive layout

---

## 🔐 Security Features

**Row Level Security (RLS):**

- Users can only see/edit their own data
- Avatar uploads restricted to user's folder
- Secure authentication checks

**Data Validation:**

- Image size limits
- File type validation
- Email format validation
- Password strength requirements

---

## 🚀 Next Steps (Optional Enhancements)

### Phase 2:

- [ ] Show avatar in navigation
- [ ] Add avatar next to user name in sidebar
- [ ] Crop/resize tool for avatars
- [ ] Multiple profile views

### Phase 3:

- [ ] Notification preferences
- [ ] Theme customization
- [ ] Language settings
- [ ] API key management

---

## 🐛 Troubleshooting

### Avatar won't upload?

1. Check file is under 2MB
2. Verify it's an image file
3. Check Supabase Storage is enabled
4. Run SQL migration again

### Can't update profile?

1. Verify you're signed in
2. Check internet connection
3. Refresh the page
4. Check browser console for errors

### Photo not showing?

1. Hard refresh (Cmd+Shift+R)
2. Check Supabase Storage bucket exists
3. Verify storage policies are set
4. Try uploading again

---

## 💡 Pro Tips

**Profile Pictures:**

- Use square images (1:1 ratio) for best results
- Recommended size: 400x400px
- Higher quality = better display
- Face should be centered

**Phone Numbers:**

- Include country code (+1 for US)
- Format consistently
- Optional field - leave blank if not needed

**Passwords:**

- Use strong passwords (8+ characters)
- Mix letters, numbers, symbols
- Don't reuse passwords
- Store securely (password manager)

---

## 📊 What's Included

**New Files:**

- `app/dashboard/settings/page.tsx` - Complete settings page
- `PROFILE_SETUP.sql` - Database migration
- `PROFILE_SETUP_GUIDE.md` - This guide

**Updated Files:**

- `types/index.ts` - Added avatar_url and phone to User type

---

## 🎉 You're Ready!

Your profile system is complete! Users can now:

- ✅ Upload profile pictures
- ✅ Edit their account details
- ✅ View organization info
- ✅ Change passwords
- ✅ Use on mobile

**Next:** Run the SQL migration and test it out!

Navigate to: http://localhost:3000/dashboard/settings

---

**Questions?** Check the Supabase Storage docs or verify your SQL migration ran successfully!
