# 🤖 AI Assistant - Quick Start (2 Minutes)

## ✅ What's New

Your LastCall inventory app now has an **AI-powered assistant** that can answer any stock-related question!

---

## 🚀 Setup (1 Minute)

### **Step 1: Add OpenAI API Key**

1. Get your key from: https://platform.openai.com/api-keys
2. Open your `.env.local` file
3. Add this line:
   ```env
   OPENAI_API_KEY=sk-proj-...your-key-here...
   ```
4. Save the file

### **Step 2: Restart Server**

```bash
# Stop server (Ctrl+C)
npm run dev
```

That's it! ✅

---

## 💬 How to Use

### **Open AI Assistant**

1. Go to: http://localhost:3000/dashboard/inventory
2. Click the **"AI Assistant"** button (sparkles icon ✨)
3. Chat window opens!

### **Ask Questions**

Try these:

- "What items are running low?"
- "What's expiring soon?"
- "What should I reorder today?"
- "Show me invoice INV-12345"
- "Which items are critically low?"

### **Get Instant Answers**

The AI knows your **entire inventory** and provides:

- 🚨 Urgent alerts
- ✅ Status updates
- 💡 Actionable recommendations
- 📊 Specific data & numbers

---

## 🎯 Example

**You:** "What items are running low?"

**AI:**

```
🚨 URGENT: 3 items need attention:

1. Angus Biltong Original 100g
   - Current: 45 units
   - Reorder point: 50
   - Recommendation: Order 100 units

2. Mixed Nuts 500g
   - Only 8 units left!
   - CRITICAL - order immediately

3. Protein Bars
   - 12 units (reorder at 15)
```

---

## ✨ Features

**Real-Time Knowledge:**

- ✅ Knows all your current stock levels
- ✅ Tracks expiration dates
- ✅ Monitors low stock items
- ✅ Analyzes by invoice/batch

**Smart Recommendations:**

- ✅ Suggests reorder quantities
- ✅ Predicts stockouts
- ✅ Prioritizes urgent items
- ✅ Identifies expiring products

**Conversational:**

- ✅ Remembers context
- ✅ Understands follow-ups
- ✅ Natural language
- ✅ Instant responses

---

## 🐛 Troubleshooting

**"AI assistant is not configured"?**

- Missing OpenAI API key
- Add to `.env.local` and restart server

**Slow responses?**

- Normal: 2-5 seconds for first response
- OpenAI processing time

**Generic answers?**

- Be more specific with questions
- Example: "Show items below 20 units" vs "low stock"

---

## 💰 Cost

**Very Affordable:**

- Uses GPT-4o-mini (cheapest model)
- ~$0.001 per query
- 100 queries ≈ $0.50
- 1000 queries ≈ $5-10

---

## 📚 Learn More

See **`AI_ASSISTANT_GUIDE.md`** for:

- Complete feature list
- Example conversations
- Advanced use cases
- Technical details

---

## 🎉 Try It Now!

1. **Add OpenAI key** to `.env.local`
2. **Restart server**
3. **Go to Inventory page**
4. **Click "AI Assistant"**
5. **Ask:** "What needs attention today?"

Your AI inventory expert is ready! 🤖✨
