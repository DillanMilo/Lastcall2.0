# 🚀 Live Setup Instructions - Follow Along!

## Current Step: Creating .env.local File

Once your Supabase project is ready, follow these steps:

### Step 2: Get Your Credentials

1. In your Supabase dashboard, click the **Settings** icon (⚙️ gear icon) in the sidebar
2. Click **API** in the settings menu
3. You'll see two important things:

**Project URL:**

```
https://xxxxxxxxxxxxx.supabase.co
```

Copy this entire URL!

**API Keys:**
Look for the **anon** **public** key (NOT the service_role key)

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ey...
```

Copy this entire key!

### Step 3: Create .env.local File

1. In your project root (`/Users/dillanmilosevich/Desktop/Lastcall2.0/`)
2. Create a new file called `.env.local`
3. Add this content (replace with YOUR values):

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ey...

# OpenAI Configuration (optional - add later)
OPENAI_API_KEY=
```

4. **Save the file**

### Step 4: You're Ready!

Tell me when you've:

- ✅ Created Supabase project
- ✅ Copied your credentials
- ✅ Created `.env.local` with real values
- ✅ Saved the file

Then we'll move to setting up the database!
