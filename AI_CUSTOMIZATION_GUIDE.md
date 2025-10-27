# 🎨 AI Assistant Customization Guide

## 📍 Where to Find the AI's Personality

The AI's behavior, tone, and capabilities are defined in:

**File:** `lib/ai/inventoryAssistant.ts`  
**Function:** `getInventoryAssistantResponse`  
**Lines:** 82-113

---

## 🧠 AI System Prompt (The "Personality")

```typescript
// Location: lib/ai/inventoryAssistant.ts (line 82)

const systemPrompt = `You are an expert inventory management assistant for LastCall, a smart inventory system. Your role is to help users understand their stock levels, identify issues, and provide actionable recommendations.

CURRENT INVENTORY DATA:
${inventoryContext}

YOUR CAPABILITIES:
- Analyze stock levels and identify low stock items
- Predict when items will run out based on current levels
- Recommend reorder quantities and timing
- Identify items expiring soon and suggest actions
- Provide insights on inventory turnover
- Alert about potential stockouts
- Suggest optimal reorder points
- Group items by invoice/batch for bulk actions
- Compare stock across categories

GUIDELINES:
1. Be concise and actionable - prioritize urgent issues
2. Use specific numbers and item names from the inventory
3. Always mention invoice numbers when relevant for batch operations
4. Highlight urgent items with 🚨 and good status with ✅
5. Provide specific recommendations (e.g., "Order 50 more units by Friday")
6. If asked about items not in inventory, clearly state they don't exist
7. Use bullet points for multiple recommendations
8. Calculate days of stock remaining when relevant

EXAMPLE RESPONSES:
- "🚨 URGENT: 3 items need immediate attention..."
- "Based on current stock, you should reorder [item] within 7 days"
- "Items in invoice INV-123 are all expiring within 2 weeks..."

Always base your answers ONLY on the provided inventory data. Never make up stock levels or items.`;
```

---

## 🎯 How to Customize the AI

### **1. Change the Tone**

**Make it more casual:**

```typescript
const systemPrompt = `Hey! You're a friendly inventory helper for LastCall...`;
```

**Make it more professional:**

```typescript
const systemPrompt = `You are a professional inventory management consultant...`;
```

**Make it more fun:**

```typescript
const systemPrompt = `You're an enthusiastic inventory expert who loves helping businesses succeed! 🎉...`;
```

### **2. Add Industry-Specific Knowledge**

For **food/meat products** (like Angus Biltong):

```typescript
YOUR CAPABILITIES:
- ...existing capabilities...
- Understand food safety and FIFO (First In, First Out) principles
- Prioritize perishable items based on expiry dates
- Recommend temperature-sensitive storage considerations
- Alert about food safety compliance issues
```

For **retail/fashion**:

```typescript
YOUR CAPABILITIES:
- ...existing capabilities...
- Understand seasonal inventory patterns
- Identify slow-moving vs fast-moving items
- Recommend clearance/discount strategies
- Track SKU performance
```

### **3. Adjust Response Style**

**More concise:**

```typescript
GUIDELINES:
1. Keep responses under 200 words
2. Use bullet points only
3. One action item per recommendation
```

**More detailed:**

```typescript
GUIDELINES:
1. Provide detailed explanations
2. Include calculations and reasoning
3. Offer multiple solution options
4. Explain potential consequences
```

### **4. Change Emoji Usage**

**Minimal emojis:**

```typescript
4. Highlight urgent items with [URGENT] and good status with [OK]
```

**More emojis:**

```typescript
4. Use emojis liberally: 🚨 urgent, ✅ good, ⚠️ warning, 📦 stock, 📅 expiry, 💰 cost
```

---

## 🧠 Memory System Explained

### **How It Works**

**1. Local Storage (Persistent)**

- Conversations saved in browser's localStorage
- Key: `ai-chat-${orgId}` (separate history per organization)
- Survives page refreshes and browser restarts
- Automatic cleanup (keeps last 12 messages)

**2. Conversation Context (Sent to OpenAI)**

- Last 10 messages sent with each query (5 pairs)
- Welcome message filtered out to save tokens
- Maintains context for follow-up questions
- Fresh inventory data on every query

**3. Message Management**

```typescript
// Location: components/inventory/AIAssistant.tsx

// Load from storage on mount (line 45-64)
useEffect(() => {
  const savedMessages = localStorage.getItem(`ai-chat-${orgId}`);
  // ... loads and restores conversation
}, [orgId]);

// Save to storage on every message (line 77-83)
useEffect(() => {
  const messagesToSave = messages.slice(-12); // Keep last 12
  localStorage.setItem(`ai-chat-${orgId}`, JSON.stringify(messagesToSave));
}, [messages, orgId]);

// Send last 10 to AI (line 80-85)
const recentMessages = messages.slice(-10).filter(...);
```

---

## 🔧 Customization Options

### **Memory Length**

**Keep more messages (10 pairs = 20 messages):**

```typescript
// In handleSend function (line 80)
const recentMessages = messages.slice(-20); // Was -10

// In save to localStorage (line 80)
const messagesToSave = messages.slice(-24); // Was -12
```

**Keep fewer messages (3 pairs = 6 messages):**

```typescript
const recentMessages = messages.slice(-6);
const messagesToSave = messages.slice(-8);
```

### **Model Selection**

**Current:** `gpt-4o-mini` (fast & cheap)

**Use GPT-4 (smarter, slower, more expensive):**

```typescript
// In lib/ai/inventoryAssistant.ts (line 124)
const response = await openai.chat.completions.create({
  model: "gpt-4", // Was 'gpt-4o-mini'
  messages,
  temperature: 0.7,
  max_tokens: 1000,
});
```

### **Temperature (Creativity)**

**Current:** `0.7` (balanced)

**More consistent/predictable:**

```typescript
temperature: 0.3, // Less creative, more factual
```

**More creative/varied:**

```typescript
temperature: 0.9, // More varied responses
```

### **Response Length**

**Current:** `max_tokens: 1000`

**Shorter responses:**

```typescript
max_tokens: 500, // Faster, more concise
```

**Longer responses:**

```typescript
max_tokens: 1500, // More detailed
```

---

## 🎨 Example Customizations

### **Example 1: Friendly & Casual**

```typescript
const systemPrompt = `Hey there! 👋 You're a super helpful and friendly inventory buddy for LastCall. Think of yourself as the user's right-hand person who always has their back when it comes to managing stock!

YOUR VIBE:
- Warm and approachable
- Use casual language ("Hey!", "Let's check...", "Looks like...")
- Celebrate wins ("Awesome! Everything's stocked well! 🎉")
- Be supportive about issues ("No worries, let's fix this together")

YOUR CAPABILITIES:
[...same as before...]

COMMUNICATION STYLE:
1. Start with friendly greetings
2. Use "we" and "let's" (collaborative)
3. Add encouragement and positivity
4. Keep it conversational
5. End with "Anything else I can help with?"
`;
```

### **Example 2: Data-Driven & Technical**

```typescript
const systemPrompt = `You are a data analyst specializing in inventory optimization. Provide precise, quantitative insights with statistical analysis.

ANALYSIS FRAMEWORK:
- Stock turn rate calculations
- Variance analysis
- Trend identification
- Predictive modeling based on current data
- ROI considerations for reordering

RESPONSE FORMAT:
1. Executive summary (1 sentence)
2. Key metrics (bullet points with numbers)
3. Data-driven recommendations
4. Risk assessment
5. Confidence level (%)
`;
```

### **Example 3: Food Safety Focused**

```typescript
const systemPrompt = `You are a food safety and inventory expert specializing in perishable goods management. Your priority is FIFO compliance and preventing waste.

PRIORITIES (in order):
1. FOOD SAFETY - Expiring items are top priority
2. FIFO COMPLIANCE - Oldest stock first
3. WASTE PREVENTION - Identify at-risk items
4. STOCK OPTIMIZATION - Then reorder recommendations

SPECIAL ALERTS:
- 🚨 URGENT: Items expiring within 7 days
- ⚠️ WARNING: Items expiring within 14 days
- 📅 MONITOR: Items expiring within 30 days
- 🔴 CRITICAL: Items at <25% stock level
`;
```

---

## 💾 Memory System Features

### **✅ What's Implemented**

**Persistent Storage:**

- ✅ Conversations saved to browser localStorage
- ✅ Survives page refreshes
- ✅ Separate history per organization
- ✅ Automatic message limit (12 messages max stored)

**Context Management:**

- ✅ Last 5 message pairs sent to AI (10 messages)
- ✅ Welcome message excluded from context (saves tokens)
- ✅ Real-time inventory data on every query
- ✅ Follow-up question support

**User Controls:**

- ✅ Clear history button (🔄 icon in header)
- ✅ Confirmation before clearing
- ✅ Fresh start anytime

---

## 🔍 Testing Memory

### **Test Conversation Memory:**

1. Open AI Assistant
2. Ask: "What's running low?"
3. AI responds with low stock items
4. Ask: "Tell me more about the first one" (follow-up)
5. AI should reference the previous conversation!

### **Test Persistence:**

1. Have a conversation with AI
2. Close the chat window
3. Refresh the page
4. Open AI Assistant again
5. ✅ Conversation history is still there!

### **Test Clear History:**

1. Click the 🔄 (rotate) icon in header
2. Confirm the clear
3. ✅ Fresh conversation starts

---

## 📊 Memory Limits Explained

**Why limit to 5 pairs (10 messages)?**

1. **Cost optimization**: Less tokens = lower OpenAI costs
2. **Focus**: Recent context is most relevant
3. **Speed**: Smaller context = faster responses
4. **Quality**: Too much context can confuse AI

**Storage Limit (12 messages):**

- Welcome message (1)
- Last 5 user messages (5)
- Last 5 AI responses (5)
- Plus buffer for current exchange

**Sent to AI (10 messages):**

- Last 5 user questions
- Last 5 AI responses
- (Welcome message excluded to save tokens)

---

## 🛠️ Advanced Customizations

### **Add Custom Functions**

You can teach the AI new capabilities by updating the system prompt:

```typescript
YOUR CAPABILITIES:
- ...existing capabilities...
- Calculate profit margins for low stock items
- Suggest bundle deals for slow-moving items
- Identify seasonal patterns
- Compare current vs historical averages
```

### **Add Response Templates**

```typescript
EXAMPLE RESPONSES:
- "🚨 URGENT: 3 items need immediate attention..."
- "Based on current stock, you should reorder [item] within 7 days"
- "Items in invoice INV-123 are all expiring within 2 weeks..."
- "✅ GOOD NEWS: All critical items are well-stocked!"
- "💡 TIP: Consider ordering [item] in bulk for better pricing"
```

### **Add Business Rules**

```typescript
BUSINESS RULES:
- For meat products: Flag items expiring within 5 days as CRITICAL
- For dry goods: Reorder when stock reaches 30% of threshold
- For seasonal items: Increase reorder point during peak months
- For high-value items: Provide conservative recommendations
```

---

## 🎯 Quick Reference

### **Files to Edit:**

**AI Personality & Logic:**

- 📁 `lib/ai/inventoryAssistant.ts` - System prompt, logic, formatting

**Chat Interface:**

- 📁 `components/inventory/AIAssistant.tsx` - UI, memory management

**API Endpoint:**

- 📁 `app/api/ai/assistant/route.ts` - Data fetching, error handling

---

## 📝 Customization Checklist

To customize your AI:

- [ ] Open `lib/ai/inventoryAssistant.ts`
- [ ] Find `systemPrompt` variable (line 82)
- [ ] Edit the prompt text
- [ ] Adjust `GUIDELINES` section
- [ ] Update `EXAMPLE RESPONSES`
- [ ] Save file
- [ ] Restart dev server
- [ ] Test in chat!

---

## 💡 Pro Tips

**Testing Changes:**

1. Edit the system prompt
2. Restart dev server (changes won't apply otherwise)
3. Clear AI chat history (🔄 button)
4. Ask a test question
5. See new personality in action!

**Token Optimization:**

- Keep system prompt under 500 words
- Use concise examples
- Remove unnecessary instructions
- Let AI infer obvious things

**Response Quality:**

- Add specific examples of good responses
- Include industry terminology
- Provide format templates
- Set clear boundaries

---

## 🚀 What You Can Control

### **In lib/ai/inventoryAssistant.ts:**

✅ **AI Personality** - Tone, style, language
✅ **Capabilities** - What AI can do
✅ **Guidelines** - How AI responds
✅ **Examples** - Response templates
✅ **Data Format** - How inventory is presented
✅ **Model Settings** - Temperature, max tokens

### **In components/inventory/AIAssistant.tsx:**

✅ **Memory Length** - How many messages to remember
✅ **Welcome Message** - First greeting
✅ **Suggested Questions** - Quick-start prompts
✅ **UI Elements** - Chat design, colors
✅ **Storage Key** - localStorage identifier

---

## 📊 Current Memory Settings

**Displayed in Chat:**

- **Unlimited** - All messages shown (until you clear)
- Scrollable history
- Timestamps preserved

**Saved to Browser:**

- **Last 12 messages** (6 pairs)
- Stored in localStorage
- Persists across sessions
- Per-organization storage

**Sent to OpenAI:**

- **Last 10 messages** (5 pairs)
- Excludes welcome message
- Recent context only
- Fresh inventory each time

**Why Different Limits?**

- Display: Show full conversation for UX
- Storage: Limit to prevent localStorage bloat
- AI Context: Balance memory vs cost/speed

---

## 🔄 Clear History Feature

**Where:** Header of AI chat (🔄 icon)

**What it does:**

- Clears all messages from chat
- Removes from localStorage
- Resets to welcome message
- Fresh start for new conversation

**When to use:**

- Starting a new topic
- Testing AI changes
- Chat getting too long
- Want fresh context

---

## 🎨 Example: Custom for Angus Biltong

```typescript
const systemPrompt = `You are an expert meat & specialty food inventory advisor for LastCall, specifically trained for Angus Biltong's product line.

COMPANY CONTEXT:
- Specializes in biltong (South African dried meat)
- Products are perishable with strict expiry dates
- FIFO (First In, First Out) is CRITICAL
- Food safety is top priority

PRODUCT KNOWLEDGE:
- Biltong varieties: Original, Peri-Peri, BBQ
- Typical shelf life: 6-12 months
- Storage: Cool, dry conditions
- Reorder lead time: 2-4 weeks from South Africa

YOUR PRIORITIES (in order):
1. 🚨 FOOD SAFETY - Flag items expiring within 14 days
2. 📦 FIFO COMPLIANCE - Ensure oldest batches sold first
3. 🔄 RESTOCK TIMING - Account for 4-week lead time
4. 💰 WASTE PREVENTION - Prevent expiry losses

GUIDELINES:
1. Always prioritize food safety over cost
2. Mention invoice/batch numbers for FIFO tracking
3. Calculate exact days until expiry for perishables
4. Recommend ordering 4 weeks before stockout (lead time)
5. Flag items within 30 days of expiry as "approaching shelf life end"
6. Suggest promotional discounts for items expiring in 60 days

EXAMPLE RESPONSES:
- "🚨 FOOD SAFETY ALERT: Beef Jerky Teriyaki expires in 12 days..."
- "📦 FIFO: Sell INV-321 batch before INV-654 (expires earlier)..."
- "⏰ REORDER NOW: Account for 4-week lead time from South Africa..."
`;
```

---

## 🧪 Testing Your Customizations

### **Step 1: Edit the Prompt**

```bash
# Open in your editor:
lib/ai/inventoryAssistant.ts

# Edit lines 82-113 (the systemPrompt variable)
```

### **Step 2: Restart Server**

```bash
# Stop (Ctrl+C)
npm run dev
```

### **Step 3: Clear Chat History**

- Open AI Assistant
- Click 🔄 (clear history) button
- Confirm clear

### **Step 4: Test**

- Ask a question
- See new personality!
- Verify it matches your changes

---

## 📚 Files Reference

### **AI Personality & Prompts:**

**`lib/ai/inventoryAssistant.ts`**

- Line 82-113: System prompt (personality)
- Line 11-64: Inventory context formatter
- Line 70-142: Main AI function
- Line 147-188: Quick insights helper

### **Memory & Chat UI:**

**`components/inventory/AIAssistant.tsx`**

- Line 35-42: Welcome message function
- Line 45-64: Load from localStorage
- Line 77-83: Save to localStorage
- Line 80-85: Recent messages for AI context
- Line 158-163: Clear history function

### **API Endpoint:**

**`app/api/ai/assistant/route.ts`**

- Fetches inventory data
- Calls AI function
- Returns responses

---

## ✅ Quick Customization Examples

### **Make AI More Enthusiastic:**

```typescript
// Line 82 in lib/ai/inventoryAssistant.ts
const systemPrompt = `You're an AMAZING inventory expert who LOVES helping businesses succeed! 🎉

Get excited about good stock levels! Celebrate wins! But also be serious about urgent issues.

Use language like:
- "Great news!" / "Awesome!"
- "Uh oh, we need to act fast!"
- "Let's get this sorted!"
`;
```

### **Make AI More Conservative:**

```typescript
const systemPrompt = `You are a conservative inventory analyst. Always err on the side of caution.

APPROACH:
- Recommend ordering earlier than needed
- Set higher safety stock levels
- Flag items as "low" at 150% of reorder point
- Always mention "better safe than sorry"
`;
```

---

## 🎉 Summary

**Where AI Personality Lives:**

- 📁 File: `lib/ai/inventoryAssistant.ts`
- 📝 Section: `systemPrompt` variable (lines 82-113)

**Memory System:**

- ✅ Remembers last 5 message pairs (10 messages) sent to AI
- ✅ Stores last 6 pairs (12 messages) in localStorage
- ✅ Persists across page refreshes
- ✅ Can be cleared with 🔄 button
- ✅ Separate history per organization

**To Customize:**

1. Edit `lib/ai/inventoryAssistant.ts`
2. Change the `systemPrompt` text
3. Restart dev server
4. Clear chat history
5. Test!

---

**Ready to customize?** The AI's personality is completely under your control! 🎨🤖
