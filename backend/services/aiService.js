const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Generate AI reply
async function generateReply(businessContext, aiPersonality, conversationHistory, newMessage) {
  const systemPrompt = `You are an AI assistant for a business. 

Business Context: ${businessContext || 'A professional business'}
Your Personality: ${aiPersonality || 'helpful, professional, and friendly'}

Your job:
- Reply to customer messages naturally and helpfully
- Keep replies SHORT (1-3 sentences max)
- Be conversational, like a real person
- If customer asks about pricing/services, be helpful but suggest they talk to a human for details
- Reply in the SAME language the customer uses (Urdu/English/Roman Urdu)
- Never reveal you are an AI unless directly asked`;

  const messages = [
    ...conversationHistory.slice(-10).map(m => ({
      role: m.role,
      content: m.content
    })),
    { role: 'user', content: newMessage }
  ];

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    system: systemPrompt,
    messages
  });

  return response.content[0].text;
}

// Score lead based on conversation
async function scoreLead(conversationHistory) {
  if (conversationHistory.length < 2) return { score: 'cold', reason: 'Too early to judge' };

  const lastMessages = conversationHistory.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 150,
    messages: [{
      role: 'user',
      content: `Based on this WhatsApp conversation, score this lead:

${lastMessages}

Respond ONLY with valid JSON like this:
{"score": "hot", "reason": "Customer asked for pricing and wants to buy soon"}

Score rules:
- hot: Customer is ready to buy, asked for price/payment, urgent need
- warm: Interested, asking questions, might buy
- cold: Just browsing, no clear intent, random questions`
    }]
  });

  try {
    const text = response.content[0].text.trim();
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return { score: 'cold', reason: 'Could not determine' };
  }
}

module.exports = { generateReply, scoreLead };
