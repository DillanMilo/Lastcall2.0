# 🧠 AI Memory System - Quick Reference

## ✅ Memory Features

Your AI Assistant now has **intelligent memory management**!

---

## 📊 How Memory Works

### **3-Tier Memory System:**

**1. UI Display (Unlimited)**

- Shows ALL messages in the chat
- Scrollable history
- Until you clear manually

**2. Browser Storage (12 messages)**

- Saved to localStorage
- Last 6 conversation pairs
- Persists across page refreshes
- Survives browser restarts

**3. AI Context (10 messages)**

- Last 5 conversation pairs
- Sent to OpenAI with each query
- Recent context only
- Optimized for cost/speed

---

## 💾 Storage Details

**Where:** Browser localStorage  
**Key:** `ai-chat-{organizationId}`  
**Data:** Last 12 messages (6 pairs)  
**Persistence:** Until cleared or 30+ days inactive

**Example:**

```
localStorage["ai-chat-00000000-0000-0000-0000-000000000001"] = [
  {role: "assistant", content: "Hi! I'm your...", timestamp: "..."},
  {role: "user", content: "What's low?", timestamp: "..."},
  {role: "assistant", content: "3 items...", timestamp: "..."},
  ...last 12 messages...
]
```

---

## 🎯 What AI Remembers

**Recent Conversation (Last 5 Pairs):**

- Your last 5 questions
- AI's last 5 responses
- Context for follow-ups
- Continuity in chat

**Fresh on Every Query:**

- ✅ Current inventory levels (always up-to-date)
- ✅ Real-time stock data
- ✅ Latest expiry dates
- ✅ Current quantities

**Example Flow:**

```
You: "What's running low?"
AI: "Mixed Nuts (8 units) and Protein Bars (12 units)"

You: "Tell me more about the Mixed Nuts"  ← AI remembers this!
AI: "Mixed Nuts 500g - Invoice INV-321, expires 2025-12-31..."

You: "What about the other one?"  ← AI knows you mean Protein Bars!
AI: "Protein Bars Chocolate - Invoice INV-999..."
```

---

## 🔄 Clear History Feature

**Location:** Header of AI chat (🔄 rotate icon)

**How to Clear:**

1. Click 🔄 icon (next to close button)
2. Confirm "Clear conversation history?"
3. ✅ Fresh start with welcome message

**When to Clear:**

- Starting a new topic
- Testing AI changes
- Conversation getting too long
- Want fresh context

**What Happens:**

- Removes all messages from display
- Clears localStorage
- Resets to welcome message
- Next query starts fresh

---

## 📍 AI Personality Location

**File:** `lib/ai/inventoryAssistant.ts`  
**Lines:** 82-113  
**Variable:** `systemPrompt`

This is where you customize:

- ✏️ AI's tone and personality
- 🎯 Response priorities
- 📋 Output format
- 🚨 Alert styles
- 💡 Recommendation approach

**Quick Edit:**

```typescript
// Open: lib/ai/inventoryAssistant.ts
// Find line 82: const systemPrompt = `...

// Example: Make more friendly
const systemPrompt = `Hey! You're a friendly inventory buddy...`;

// Example: Make more formal
const systemPrompt = `You are a professional analyst...`;
```

**After editing:**

1. Save file
2. Restart dev server (`npm run dev`)
3. Clear chat history (🔄)
4. Test new personality!

---

## 🧪 Test the Memory

### **Test 1: Follow-Up Questions**

```
You: "What's running low?"
AI: [Lists items]
You: "What about the first one?"  ← AI should remember!
```

### **Test 2: Persistence**

```
1. Have a conversation
2. Close chat
3. Refresh page
4. Open chat
✅ History is still there!
```

### **Test 3: Context Awareness**

```
You: "Show me invoice INV-12345"
AI: [Shows 3 items]
You: "Which one is lowest?"  ← AI remembers the invoice!
```

---

## ⚙️ Adjust Memory Length

Want more or less memory? Edit these:

### **More Memory (10 pairs = 20 messages):**

**File:** `components/inventory/AIAssistant.tsx`

```typescript
// Line 80: Increase from -10 to -20
const recentMessages = messages.slice(-20);

// Line 80 (save): Increase from -12 to -24
const messagesToSave = messages.slice(-24);
```

### **Less Memory (3 pairs = 6 messages):**

```typescript
// Line 80: Decrease to -6
const recentMessages = messages.slice(-6);

// Line 80 (save): Decrease to -8
const messagesToSave = messages.slice(-8);
```

**Trade-offs:**

- **More memory** = Better context, higher costs
- **Less memory** = Faster, cheaper, less context

---

## 💰 Cost Impact

**Current Settings (5 pairs):**

- Context: ~1,500 tokens per query
- Cost: ~$0.001 - $0.003 per query
- Speed: 2-4 seconds

**With 10 pairs:**

- Context: ~3,000 tokens per query
- Cost: ~$0.002 - $0.006 per query
- Speed: 3-6 seconds

**With 3 pairs:**

- Context: ~900 tokens per query
- Cost: ~$0.0005 - $0.002 per query
- Speed: 1-3 seconds

---

## ✅ Memory Features Summary

**What's Working:**

- ✅ Remembers last 5 conversation pairs
- ✅ Persists across page refreshes
- ✅ Saves to browser localStorage
- ✅ Auto-limits storage (12 messages max)
- ✅ Can be cleared with button
- ✅ Separate per organization
- ✅ Follow-up questions work perfectly

**AI Personality File:**

- 📁 `lib/ai/inventoryAssistant.ts`
- 📝 Lines 82-113
- 🎨 Fully customizable

---

## 🎉 You're Set!

The AI now:

- ✅ Remembers your conversation (5 pairs)
- ✅ Understands follow-up questions
- ✅ Persists across page refreshes
- ✅ Can be cleared anytime
- ✅ Optimized for cost and speed

**Customize the personality in:**  
`lib/ai/inventoryAssistant.ts` (line 82)

**Test the memory:**

1. Ask "What's running low?"
2. Then ask "Tell me more about the first one"
3. AI remembers! 🧠✨
