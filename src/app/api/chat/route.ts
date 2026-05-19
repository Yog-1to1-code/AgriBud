import { NextResponse } from 'next/server';
import { getGeminiModel } from '@/lib/gemini';
import { createClient } from '@/utils/supabase/server';

// ── Weather Cache (2-hour TTL, persists across requests in same server process) ──
const WEATHER_CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours in ms
const weatherCache = new Map<string, { data: string; timestamp: number }>();

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

    // Parse media — supports new multi-media JSON format + legacy single-field format
    let mediaItems: { supabaseUrl?: string; geminiFileUri?: string; mimeType?: string }[] = [];
    const mediaJson = formData.get('mediaJson') as string | null;
    if (mediaJson) {
      try { mediaItems = JSON.parse(mediaJson); } catch { }
    } else {
      // Legacy fallback: single media fields
      const supabaseUrl = formData.get('supabaseUrl') as string | null;
      const geminiFileUri = formData.get('geminiFileUri') as string | null;
      const mimeType = formData.get('mimeType') as string | null;
      if (geminiFileUri && mimeType) {
        mediaItems = [{ supabaseUrl: supabaseUrl || '', geminiFileUri, mimeType }];
      }
    }
    // Filter out items with empty Gemini URIs
    mediaItems = mediaItems.filter(m => m.geminiFileUri && m.geminiFileUri.length > 0 && m.mimeType && m.mimeType.length > 0);
    const hasMedia = mediaItems.length > 0;

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const isNewSession = !sessionId || sessionId === 'new';
    if (hasMedia) {
      console.log(`[AgriBud] ${mediaItems.length} media file(s) attached: ${mediaItems.map(m => m.mimeType).join(', ')}`);
    }

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
    // 2. Resolve Coordinates (Geocode fallback if lat/lng missing)
    // ──────────────────────────────────────────────────────────
    if (!lat && !lng && sowingLocation && sowingLocation !== 'Not specified') {
      try {
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(sowingLocation)}&limit=1`,
          { headers: { 'User-Agent': 'AgriBud/1.0' } }
        );
        const geoData = await geoRes.json();
        if (geoData && geoData.length > 0) {
          lat = parseFloat(geoData[0].lat);
          lng = parseFloat(geoData[0].lon);
          // Backfill coordinates into the crop so future calls skip geocoding
          // We need the crop ID — for new sessions it's `cropId`, for existing we fetch from session
          const resolvedCropId = isNewSession ? cropId : (
            await supabase.from('chat_sessions').select('crop_id').eq('id', sessionId).single()
          ).data?.crop_id;
          if (resolvedCropId) {
            supabase.from('farmer_crops')
              .update({ latitude: lat, longitude: lng })
              .eq('id', resolvedCropId).then(() => {});
          }
        }
      } catch (geoErr) {
        console.error("Geocoding fallback failed:", geoErr);
      }
    }

    // ──────────────────────────────────────────────────────────
    // 3. Fetch Weather Context (Open-Meteo, 2-hour cache)
    // ──────────────────────────────────────────────────────────
    let weatherContext = "Weather data unavailable — crop location not set.";
    if (lat && lng) {
      const cacheKey = `${lat.toFixed(2)}_${lng.toFixed(2)}`;
      const cached = weatherCache.get(cacheKey);
      const now = Date.now();

      if (cached && (now - cached.timestamp) < WEATHER_CACHE_TTL) {
        weatherContext = cached.data;
      } else {
        try {
          const weatherRes = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
            `&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m` +
            `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max` +
            `&timezone=auto&forecast_days=3`,
            { signal: AbortSignal.timeout(5000) } // 5s timeout
          );
          const weatherData = await weatherRes.json();
          const current = weatherData.current;
          const daily = weatherData.daily;

          weatherContext = `
CURRENT WEATHER (Live):
- Temperature: ${current.temperature_2m}°C
- Humidity: ${current.relative_humidity_2m}%
- Precipitation: ${current.precipitation}mm
- Wind Speed: ${current.wind_speed_10m} km/h

3-DAY FORECAST:
- Today: ${daily.temperature_2m_min[0]}°C to ${daily.temperature_2m_max[0]}°C, Rain: ${daily.precipitation_sum[0]}mm (${daily.precipitation_probability_max?.[0] ?? '?'}% probability)
- Tomorrow: ${daily.temperature_2m_min[1]}°C to ${daily.temperature_2m_max[1]}°C, Rain: ${daily.precipitation_sum[1]}mm (${daily.precipitation_probability_max?.[1] ?? '?'}% probability)
- Day After: ${daily.temperature_2m_min[2]}°C to ${daily.temperature_2m_max[2]}°C, Rain: ${daily.precipitation_sum[2]}mm (${daily.precipitation_probability_max?.[2] ?? '?'}% probability)
`;
          // Cache the result
          weatherCache.set(cacheKey, { data: weatherContext, timestamp: now });
        } catch (weatherErr) {
          console.error("Weather fetch failed:", weatherErr);
          // Use stale cache if available
          if (cached) {
            weatherContext = cached.data + "\n(Note: Weather data may be stale — fetched earlier)";
          }
        }
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
    // 5. Build Current Message Parts (all media files)
    // ──────────────────────────────────────────────────────────
    const currentParts: any[] = [{ text: prompt }];
    if (hasMedia) {
      for (const item of mediaItems) {
        currentParts.push({ fileData: { fileUri: item.geminiFileUri, mimeType: item.mimeType } });
      }
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

${hasMedia ? `MEDIA ANALYSIS (CRITICAL):
The user has attached ${mediaItems.length} media file(s): ${mediaItems.map(m => m.mimeType).join(', ')}.
You MUST analyze ALL of them thoroughly:
- IMAGES: Examine every visible detail — leaf color, spots, lesions, pest bodies, soil condition, growth stage. Identify the specific disease or pest.
- VIDEOS: Watch the entire clip. Describe plant movement, pest behavior, disease spread, environmental conditions shown.
- AUDIO: Listen carefully. The farmer may be describing symptoms verbally. Transcribe and respond to their spoken concerns.
If multiple files are attached, analyze EACH one and correlate findings across them.
Do NOT say "I cannot see/hear the media." You CAN and MUST analyze ALL attached files.
` : ''}
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
    const model = getGeminiModel('gemini-2.5-pro', systemInstruction);
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
      session_id: sessionId, role: 'user', content: prompt, 
      image_url: mediaItems.length > 0 ? mediaItems[0].supabaseUrl || null : null,
      metadata: { 
        media_summary: mediaSummary, 
        mimeType: mediaItems.length > 0 ? mediaItems[0].mimeType : null,
        mediaList: mediaItems.length > 0 ? mediaItems.map(m => ({
          url: m.supabaseUrl || '',
          mimeType: m.mimeType || '',
        })) : undefined,
      }
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
