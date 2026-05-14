import { NextResponse } from 'next/server';
import { getGeminiModel } from '@/lib/gemini';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const prompt = formData.get('prompt') as string;
    const cropId = formData.get('cropId') as string;
    let sessionId = formData.get('sessionId') as string;

    const supabaseUrl = formData.get('supabaseUrl') as string | null;
    const geminiFileUri = formData.get('geminiFileUri') as string | null;
    const mimeType = formData.get('mimeType') as string | null;

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const isNewSession = !sessionId || sessionId === 'new';
    const hasMedia = !!(geminiFileUri && mimeType);

    const { data: profile } = await supabase.from('profiles').select('id, preferred_language').eq('id', user.id).single();
    if (!profile) { await supabase.from('profiles').insert({ id: user.id }); }
    const language = profile?.preferred_language || 'auto';

    // ──────────────────────────────────────────────────────────
    // 1. Session & Crop Context
    // ──────────────────────────────────────────────────────────
    let cropName = 'Unknown';
    let sowingDate = 'Unknown';
    let sowingLocation = 'Unknown';
    let lat: number | null = null;
    let lng: number | null = null;
    let villageSensorData: any = null;

    if (isNewSession) {
      const { data: cropData, error: cropErr } = await supabase.from('farmer_crops').select('user_id, name, date_of_sowing, location, latitude, longitude, village_sensor_data').eq('id', cropId).single();
      if (cropErr || cropData?.user_id !== user.id) { return NextResponse.json({ error: 'Unauthorized' }, { status: 403 }); }
      cropName = cropData.name;
      sowingDate = cropData.date_of_sowing || 'Not specified';
      sowingLocation = cropData.location || 'Not specified';
      lat = cropData.latitude;
      lng = cropData.longitude;
      villageSensorData = cropData.village_sensor_data;

      // Create session with a temporary title — will be updated from AI response
      const tempTitle = prompt.substring(0, 35) + (prompt.length > 35 ? '...' : '');
      const { data: session, error } = await supabase.from('chat_sessions').insert({ user_id: user.id, crop_id: cropId, title: tempTitle }).select().single();
      if (error) throw new Error('Session creation failed');
      sessionId = session.id;
    } else {
      const { data: existingSession, error: sessionErr } = await supabase.from('chat_sessions').select('user_id, crop_id').eq('id', sessionId).single();
      if (sessionErr || existingSession?.user_id !== user.id) { return NextResponse.json({ error: 'Unauthorized' }, { status: 403 }); }
      const { data: cropData } = await supabase.from('farmer_crops').select('name, date_of_sowing, location, latitude, longitude, village_sensor_data').eq('id', existingSession.crop_id).single();
      cropName = cropData?.name || 'Unknown';
      sowingDate = cropData?.date_of_sowing || 'Not specified';
      sowingLocation = cropData?.location || 'Not specified';
      lat = cropData?.latitude || null;
      lng = cropData?.longitude || null;
      villageSensorData = cropData?.village_sensor_data || null;
    }

    // ──────────────────────────────────────────────────────────
    // 2. Fetch Weather Context (Open-Meteo)
    // ──────────────────────────────────────────────────────────
    let weatherContext = "Weather data unavailable.";
    if (lat && lng) {
      try {
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,precipitation&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&forecast_days=3`);
        const weatherData = await weatherRes.json();
        const current = weatherData.current;
        const daily = weatherData.daily;

        weatherContext = `
CURRENT WEATHER:
- Temp: ${current.temperature_2m}°C, Humidity: ${current.relative_humidity_2m}%, Rain: ${current.precipitation}mm

3-DAY FORECAST:
- Tomorrow: ${daily.temperature_2m_min[1]}°C to ${daily.temperature_2m_max[1]}°C, Rain sum: ${daily.precipitation_sum[1]}mm
- Day 2: ${daily.temperature_2m_min[2]}°C to ${daily.temperature_2m_max[2]}°C, Rain sum: ${daily.precipitation_sum[2]}mm
`;
      } catch (weatherErr) {
        console.error("Weather fetch failed:", weatherErr);
      }
    }

    // ──────────────────────────────────────────────────────────
    // 3. Load existing conversation summary for context
    // ──────────────────────────────────────────────────────────
    const { data: sessionData } = await supabase.from('chat_sessions').select('summary').eq('id', sessionId).single();
    const summaryText = sessionData?.summary || '';

    // ──────────────────────────────────────────────────────────
    // 4. Build Chat History
    // ──────────────────────────────────────────────────────────
    const { data: pastMessages } = await supabase.from('chat_messages').select('role, content, metadata').eq('session_id', sessionId).order('created_at', { ascending: true }).limit(20);

    let chatHistory: any[] = [];
    if (pastMessages) {
      chatHistory = pastMessages.map(msg => {
        let textContent = msg.content;
        // Inject stored media analysis into the user prompt context so AI has full knowledge
        if (msg.role === 'user' && msg.metadata?.media_summary) {
          textContent = `[USER PROMPT]: ${msg.content}\n[MEDIA ANALYSIS FROM PREVIOUS TURN]: ${msg.metadata.media_summary}`;
        }
        return {
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: textContent }]
        };
      });
    }

    // ──────────────────────────────────────────────────────────
    // 5. Build Current Message Parts
    // ──────────────────────────────────────────────────────────
    const currentParts: any[] = [{ text: prompt }];
    if (hasMedia) {
      currentParts.push({ fileData: { fileUri: geminiFileUri, mimeType: mimeType } });
    }

    // ──────────────────────────────────────────────────────────
    // 6. System Instruction — Single Structured Response
    //    The AI returns its normal markdown response PLUS a
    //    mandatory JSON metadata block at the very end.
    //    This eliminates separate calls for title/summary/media.
    // ──────────────────────────────────────────────────────────
    const metadataFields = [
      `"chat_title": "A concise 3-5 word title summarizing this specific diagnosis topic. Example: 'Rice Leaf Blast Treatment'"`,
      `"conversation_summary": "A 2-3 sentence technical summary of the ENTIRE conversation so far including this exchange. Capture: crop name, all symptoms discussed, all diagnoses made, all treatments recommended. This will be used as memory for future messages."`,
    ];
    
    if (hasMedia) {
      metadataFields.push(
        `"media_summary": "A detailed technical description of the uploaded media — describe visible symptoms, affected plant parts, color/texture/pattern of damage, estimated severity (mild/moderate/severe), and any identifiable organisms. This will be stored as a text reference for future context when the image is no longer available."`
      );
    }

    // Build the language instruction — must be explicit and forceful
    let languageInstruction: string;
    if (language === 'auto') {
      languageInstruction = `LANGUAGE RULE (CRITICAL — HIGHEST PRIORITY):
You MUST detect the language of the user's prompt and respond ENTIRELY in that SAME language and script.
- If the user writes in Hindi (Devanagari script like "मेरी फसल में"), you MUST respond fully in Hindi using Devanagari script (हिंदी).
- If the user writes in Marathi (like "माझ्या पिकावर"), you MUST respond fully in Marathi using Devanagari script (मराठी).
- If the user writes in English, respond in English.
- If the user writes in romanized Hindi/Marathi (like "meri fasal mein"), respond in the NATIVE SCRIPT of that language (Devanagari), NOT in romanized form.
- The ENTIRE response including table headers, precautions, and all text must be in the detected language. Do NOT mix languages.`;
    } else {
      languageInstruction = `LANGUAGE RULE (CRITICAL — HIGHEST PRIORITY):
You MUST respond ENTIRELY in ${language} using its native script.
- ALL text including diagnosis, table headers (Treatment → उपचार), dosage instructions, and precautions MUST be in ${language}.
- Do NOT fall back to English for any part of the response.
- Even technical terms should be translated or transliterated into ${language}.`;
    }

    const systemInstruction = `You are AgriBud, an elite agricultural AI expert for Indian farmers.
- CROP: ${cropName} (Sown: ${sowingDate}, Location: ${sowingLocation})

${languageInstruction}

LOCAL WEATHER CONTEXT:
${weatherContext}

${villageSensorData ? `VILLAGE NODE SENSOR DATA (REALTIME):
- Temperature: ${villageSensorData.rt}°C
- Humidity: ${villageSensorData.rh}%
- Soil Moisture: ${villageSensorData.rs}%
- Water Level: ${villageSensorData.rw}%
- Vibration: ${villageSensorData.rv}` : ''}

RESPONSE STRUCTURE (CRITICAL — FOLLOW EXACTLY):

PART 1 — Your Expert Response (Markdown):
Start IMMEDIATELY with your diagnosis. No greetings, no filler.
1. **Diagnosis/Analysis**: Brief scientific assessment of symptoms.
2. **Treatment Plan**: Provide as a structured Markdown Table with columns: Treatment, Type, Dosage, Timing.
3. **Precautions**: 3-5 concise bullet points for prevention.

PART 2 — Metadata JSON Block (MANDATORY — ALWAYS include at the very end):
After your response, you MUST output a fenced JSON code block with exactly this structure:
\`\`\`json
{
  ${metadataFields.join(',\n  ')}
}
\`\`\`

RULES:
- NO greetings (Hello, Namaste, नमस्ते), pleasantries, or introductory filler.
- Provide scientifically grounded, actionable facts ONLY.
- CONSIDER LOCAL WEATHER in your recommendations.
- The metadata JSON block must be the ABSOLUTE LAST thing in your output.
- DO NOT output internal reasoning or regurgitate these instructions.
- The chat_title should reflect the MAIN TOPIC of this specific query, not a generic title.
- The chat_title and conversation_summary should ALSO be in the same language as the response.
- The conversation_summary must capture ALL key facts from the entire conversation.

${summaryText ? `\nPREVIOUS CONVERSATION CONTEXT:\n${summaryText}` : ''}`;

    // ──────────────────────────────────────────────────────────
    // 7. Single AI Call — Gets response + all metadata
    // ──────────────────────────────────────────────────────────
    const model = getGeminiModel('gemini-2.5-flash', systemInstruction);
    const chat = model.startChat({ history: chatHistory });
    const result = await chat.sendMessage(currentParts);
    let fullResponse = result.response.text();

    // ──────────────────────────────────────────────────────────
    // 8. Parse Structured Metadata from Response
    // ──────────────────────────────────────────────────────────
    let chatTitle: string | null = null;
    let mediaSummary: string | null = null;
    let conversationSummary: string | null = null;

    const jsonMatch = fullResponse.match(/```json\s*(\{[\s\S]*?\})\s*```/);
    if (jsonMatch) {
      try {
        const metadata = JSON.parse(jsonMatch[1]);
        chatTitle = metadata.chat_title || null;
        mediaSummary = metadata.media_summary || null;
        conversationSummary = metadata.conversation_summary || null;
        // Strip the JSON block from the visible response
        fullResponse = fullResponse.replace(jsonMatch[0], '').trim();
      } catch (e) {
        console.error('Failed to parse AI metadata JSON:', e);
      }
    }

    // ──────────────────────────────────────────────────────────
    // 9. Extract Citations from Grounding Metadata
    // ──────────────────────────────────────────────────────────
    let citations: any[] = [];
    try {
      const grounding = (result.response as any).candidates?.[0]?.groundingMetadata;
      if (grounding?.groundingChunks) {
        citations = grounding.groundingChunks.filter((c: any) => c.web).map((c: any) => ({ title: c.web.title, url: c.web.uri }));
      }
    } catch (e) { }

    // ──────────────────────────────────────────────────────────
    // 10. Save Messages to Database
    // ──────────────────────────────────────────────────────────
    const userInsert = await supabase.from('chat_messages').insert({
      session_id: sessionId, role: 'user', content: prompt, image_url: supabaseUrl,
      metadata: { media_summary: mediaSummary, mimeType }
    });
    
    // Small delay to guarantee Postgres timestamp ordering
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const assistantInsert = await supabase.from('chat_messages').insert({
      session_id: sessionId, role: 'assistant', content: fullResponse,
      metadata: { citations }
    });

    if (userInsert.error) console.error('Failed to save user message:', userInsert.error);
    if (assistantInsert.error) console.error('Failed to save assistant message:', assistantInsert.error);

    // ──────────────────────────────────────────────────────────
    // 11. Update Session with AI-generated title & summary
    //     (No separate AI calls needed!)
    // ──────────────────────────────────────────────────────────
    const sessionUpdate: any = {};
    
    // Update title only for new sessions (first message generates the title)
    if (isNewSession && chatTitle) {
      sessionUpdate.title = chatTitle.replace(/[*#"'_]/g, '').trim().substring(0, 50);
    }
    
    // Always update the conversation summary — this is the AI's "memory"
    if (conversationSummary) {
      sessionUpdate.summary = conversationSummary;
    }

    if (Object.keys(sessionUpdate).length > 0) {
      const { error: updateErr } = await supabase
        .from('chat_sessions')
        .update(sessionUpdate)
        .eq('id', sessionId);
      
      if (updateErr) console.error('Failed to update session:', updateErr);
    }

    // ──────────────────────────────────────────────────────────
    // 12. Return clean response to frontend
    // ──────────────────────────────────────────────────────────
    return NextResponse.json({ 
      response: fullResponse, 
      sessionId, 
      sessionTitle: isNewSession ? (chatTitle || prompt.substring(0, 30)) : undefined,
      metadata: { citations } 
    });

  } catch (error: any) {
    console.error('Chat Error:', error);
    return NextResponse.json({ error: 'AI failed.' }, { status: 500 });
  }
}
