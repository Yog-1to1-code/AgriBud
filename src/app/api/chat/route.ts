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

    const { data: profile } = await supabase.from('profiles').select('id, preferred_language').eq('id', user.id).single();
    if (!profile) { await supabase.from('profiles').insert({ id: user.id }); }
    const language = profile?.preferred_language || 'auto';

    // 1. Session & Crop Context
    let cropName = 'Unknown';
    let sowingDate = 'Unknown';
    let sowingLocation = 'Unknown';
    let lat: number | null = null;
    let lng: number | null = null;

    if (!sessionId || sessionId === 'new') {
      const { data: cropData, error: cropErr } = await supabase.from('farmer_crops').select('user_id, name, date_of_sowing, location, latitude, longitude').eq('id', cropId).single();
      if (cropErr || cropData?.user_id !== user.id) { return NextResponse.json({ error: 'Unauthorized' }, { status: 403 }); }
      cropName = cropData.name;
      sowingDate = cropData.date_of_sowing || 'Not specified';
      sowingLocation = cropData.location || 'Not specified';
      lat = cropData.latitude;
      lng = cropData.longitude;

      let sessionTitle = prompt.substring(0, 30);
      try {
        const titleModel = getGeminiModel('gemini-2.0-flash'); 
        const titleResult = await titleModel.generateContent(`Title (max 4 words) for: "${prompt}"`);
        sessionTitle = titleResult.response.text().trim().replace(/["']/g, '');
      } catch (err) {}

      const { data: session, error } = await supabase.from('chat_sessions').insert({ user_id: user.id, crop_id: cropId, title: sessionTitle }).select().single();
      if (error) throw new Error('Session creation failed');
      sessionId = session.id;
    } else {
      const { data: existingSession, error: sessionErr } = await supabase.from('chat_sessions').select('user_id, crop_id').eq('id', sessionId).single();
      if (sessionErr || existingSession?.user_id !== user.id) { return NextResponse.json({ error: 'Unauthorized' }, { status: 403 }); }
      const { data: cropData } = await supabase.from('farmer_crops').select('name, date_of_sowing, location, latitude, longitude').eq('id', existingSession.crop_id).single();
      cropName = cropData?.name || 'Unknown';
      sowingDate = cropData?.date_of_sowing || 'Not specified';
      sowingLocation = cropData?.location || 'Not specified';
      lat = cropData?.latitude || null;
      lng = cropData?.longitude || null;
    }

    // Fetch Weather Context (Open-Meteo)
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

    const { data: sessionData } = await supabase.from('chat_sessions').select('summary').eq('id', sessionId).single();
    const summaryText = sessionData?.summary || '';

    // 2. Build History (Optimization: Use Text Summaries for past Media)
    const { data: pastMessages } = await supabase.from('chat_messages').select('role, content, metadata').eq('session_id', sessionId).order('created_at', { ascending: true }).limit(20);

    let chatHistory: any[] = [];
    if (pastMessages) {
      chatHistory = pastMessages.map(msg => {
        let textContent = msg.content;
        if (msg.role === 'user' && msg.metadata?.media_summary) {
          textContent = `[USER PROMPT]: ${msg.content}\n[IMAGE ANALYSIS]: ${msg.metadata.media_summary}`;
        }
        return {
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: textContent }]
        };
      });
    }

    // 3. Current Parts (With Media if present)
    const currentParts: any[] = [{ text: prompt }];
    if (geminiFileUri && mimeType) {
      currentParts.push({ fileData: { fileUri: geminiFileUri, mimeType: mimeType } });
      currentParts[0].text += `\n\nIMPORTANT: Since you are analyzing new media, you MUST provide a detailed technical summary of what you see in the media for my records. Format this analysis as a JSON block at the absolute end of your response: \`\`\`json {"media_summary": "..."} \`\`\``;
    }

    // 4. AI Call
    const systemInstruction = `You are AgriBud, an elite agricultural AI expert for Indian farmers.
- CROP: ${cropName} (Sown: ${sowingDate}, Location: ${sowingLocation})
- LANGUAGE: ${language === 'auto' ? "Match user's prompt exactly" : language}

LOCAL WEATHER CONTEXT:
${weatherContext}

OUTPUT STRUCTURE (CRITICAL):
1. **Diagnosis/Analysis**: Brief scientific assessment of symptoms.
2. **Treatment Plan**: Provide this ONLY as a structured Markdown Table (Chemical, Organic, Dosage, Timing).
3. **Precautions**: 3-5 concise bullet points for future prevention.

CONCISENESS RULES:
- NO greetings (Hello, Namaste), pleasantries, or introductory filler.
- NO conversational talk.
- Provide scientifically grounded, actionable facts only.
- CONSIDER LOCAL WEATHER: If high rain is forecasted, warn against pesticide spraying. If high heat, suggest irrigation.

${summaryText ? `\nCONVERSATION SUMMARY:\n${summaryText}` : ''}`;

    const model = getGeminiModel('gemini-2.5-flash', systemInstruction);
    const chat = model.startChat({ history: chatHistory });
    const result = await chat.sendMessage(currentParts);
    let fullResponse = result.response.text();

    // 5. Parse and Strip Media Summary
    let mediaSummary = null;
    const jsonMatch = fullResponse.match(/```json\s*({[\s\S]*?})\s*```/);
    if (jsonMatch) {
      try {
        const jsonData = JSON.parse(jsonMatch[1]);
        mediaSummary = jsonData.media_summary;
        fullResponse = fullResponse.replace(jsonMatch[0], '').trim();
      } catch (e) {}
    }

    // 6. Citations
    let citations: any[] = [];
    try {
      const grounding = (result.response as any).candidates?.[0]?.groundingMetadata;
      if (grounding?.groundingChunks) {
        citations = grounding.groundingChunks.filter((c: any) => c.web).map((c: any) => ({ title: c.web.title, url: c.web.uri }));
      }
    } catch (e) {}

    // 7. Save
    await supabase.from('chat_messages').insert({
      session_id: sessionId, role: 'user', content: prompt, image_url: supabaseUrl, 
      metadata: { media_summary: mediaSummary, mimeType }
    });

    await supabase.from('chat_messages').insert({
      session_id: sessionId, role: 'assistant', content: fullResponse, 
      metadata: { citations }
    });

    // 8. Async Summary
    if ((pastMessages?.length || 0 + 1) % 4 === 0) {
      const summaryModel = getGeminiModel('gemini-2.0-flash');
      summaryModel.generateContent(`Summarize symptoms/treatments: ${fullResponse}`).then(res => {
        supabase.from('chat_sessions').update({ summary: res.response.text() }).eq('id', sessionId);
      }).catch(() => {});
    }

    return NextResponse.json({ response: fullResponse, sessionId, metadata: { citations } });

  } catch (error: any) {
    console.error('Chat Error:', error);
    return NextResponse.json({ error: 'AI failed.' }, { status: 500 });
  }
}
