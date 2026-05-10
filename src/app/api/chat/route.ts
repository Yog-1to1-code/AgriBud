import { NextResponse } from 'next/server';
import { getGeminiModel } from '@/lib/gemini';
import { GoogleAIFileManager, FileState } from '@google/generative-ai/server';
import { createClient } from '@/utils/supabase/server';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

export const maxDuration = 60; // Allow more time for video processing

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
    
    // Pre-uploaded media references
    const supabaseUrl = formData.get('supabaseUrl') as string | null;
    const geminiFileUri = formData.get('geminiFileUri') as string | null;
    const mimeType = formData.get('mimeType') as string | null;

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Ensure profile exists and get language
    const { data: profile } = await supabase.from('profiles').select('id, preferred_language').eq('id', user.id).single();
    if (!profile) {
       await supabase.from('profiles').insert({ id: user.id });
    }
    const language = profile?.preferred_language || 'auto';

    // 1. Ensure a session exists
    let cropName = 'Unknown';
    let sowingDate = 'Unknown';
    let sowingLocation = 'Unknown';

    if (!sessionId || sessionId === 'new') {
      // Check crop ownership first
      const { data: cropData, error: cropErr } = await supabase
        .from('farmer_crops')
        .select('user_id, name, date_of_sowing, location')
        .eq('id', cropId)
        .single();
        
      if (cropErr || cropData?.user_id !== user.id) {
        return NextResponse.json({ error: 'Unauthorized to use this crop' }, { status: 403 });
      }

      cropName = cropData.name;
      sowingDate = cropData.date_of_sowing || 'Not specified';
      sowingLocation = cropData.location || 'Not specified';

      // AI-Powered Title Generation (Gemini-style)
      let sessionTitle = prompt.substring(0, 30); // Quick fallback snippet
      try {
        console.log("Generating AI title for prompt:", prompt.substring(0, 50));
        // Use a simple model without tools for fast title generation
        const titleModel = getGeminiModel('gemini-2.0-flash'); 
        const titlePrompt = `Generate a very short, concise, and professional title (max 4 words) for an agricultural chat starting with this prompt: "${prompt}". Respond ONLY with the title.`;
        const titleResult = await titleModel.generateContent(titlePrompt);
        sessionTitle = titleResult.response.text().trim().replace(/["']/g, '');
        console.log("Generated Title:", sessionTitle);
      } catch (err) {
        console.error("AI Title generation failed, using fallback:", err);
      }

      console.log("Creating new chat session for crop:", cropId);
      const { data: session, error } = await supabase
        .from('chat_sessions')
        .insert({ 
          user_id: user.id, 
          crop_id: cropId, 
          title: sessionTitle 
        })
        .select()
        .single();
      
      if (error) {
        console.error("Session creation error:", error);
        throw new Error('Failed to create chat session.');
      }
      sessionId = session.id;
      console.log("New session ID created:", sessionId);
    } else {
      // Verify session ownership and get crop details
      const { data: existingSession, error: sessionErr } = await supabase
        .from('chat_sessions')
        .select('user_id, crop_id')
        .eq('id', sessionId)
        .single();
      
      if (sessionErr || existingSession?.user_id !== user.id) {
        return NextResponse.json({ error: 'Unauthorized to access this session' }, { status: 403 });
      }

      const { data: cropData } = await supabase
        .from('farmer_crops')
        .select('name, date_of_sowing, location')
        .eq('id', existingSession.crop_id)
        .single();

      cropName = cropData?.name || 'Unknown';
      sowingDate = cropData?.date_of_sowing || 'Not specified';
      sowingLocation = cropData?.location || 'Not specified';
    }

    // 2. Fetch past context for this session
    const { data: sessionData } = await supabase
      .from('chat_sessions')
      .select('summary')
      .eq('id', sessionId)
      .single();

    const summaryText = sessionData?.summary || '';

    const { data: pastMessages } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    const userMessages = pastMessages?.filter(msg => msg.role === 'user') || [];
    const messageCount = userMessages.length;

    // Take the last 10 messages (5 pairs) for raw context
    const last10 = pastMessages ? pastMessages.slice(-10) : [];
    let chatHistory = last10.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    console.log("Constructing Gemini parts. Media present:", !!geminiFileUri);
    const parts: any[] = [{ text: prompt }];
    let userImageUrl = supabaseUrl; 

    if (geminiFileUri && mimeType) {
      parts.push({
        fileData: {
          fileUri: geminiFileUri,
          mimeType: mimeType,
        },
      });
    }

    // 4. Generate Content
    const systemInstruction = `You are AgriBud, an elite, professional AI assistant for farmers in India, specializing in crop disease diagnosis and treatment.

CONTEXT FOR THIS CONVERSATION:
- CROP NAME: ${cropName}
- DATE OF SOWING: ${sowingDate}
- LOCATION: ${sowingLocation}

${language === 'auto' ? 'Respond in the same language as the user\'s prompt.' : `Please reply in this language: ${language}.`}

CONCISENESS MANDATE:
- Provide ONLY the direct response to the user's question or media.
- OMIT all greetings (e.g., "Hello", "Namaste"), pleasantries, and generic disclaimers.
- OMIT introductory filler (e.g., "I can help you with that", "Based on the image...").
- START immediately with the diagnosis or the answer.
- KEEP explanations brief and scientific. Focus on ACTIONABLE advice.

CRITICAL INSTRUCTIONS:
1. Always format your output using highly structured Markdown.
2. Use Markdown Tables extensively to present data (e.g., Treatment Plans, Disease Characteristics, Dosages, Timelines).
3. Use clear Headings (##, ###) and Bullet Points to break down complex agricultural science into digestible, actionable advice.
4. Provide scientifically grounded, highly accurate agricultural advice. Avoid hallucination.
${summaryText ? `\nPREVIOUS CONVERSATION SUMMARY:\n${summaryText}` : ''}`;

    const model = getGeminiModel();
    const chat = model.startChat({
      history: [
        { role: 'user', parts: [{ text: systemInstruction }] },
        { role: 'model', parts: [{ text: 'Understood. I will follow these instructions.' }] },
        ...chatHistory
      ]
    });

    console.log("Sending message to Gemini...");
    const result = await chat.sendMessage(parts);
    const responseText = result.response.text();
    console.log("Gemini responded successfully.");

    // Extract grounding metadata/citations
    let citations: any[] = [];
    try {
      const candidate = (result.response as any).candidates?.[0];
      const groundingMetadata = candidate?.groundingMetadata;
      if (groundingMetadata && groundingMetadata.groundingChunks) {
        citations = groundingMetadata.groundingChunks
          .filter((chunk: any) => chunk.web)
          .map((chunk: any) => ({
            title: chunk.web.title,
            url: chunk.web.uri
          }));
        console.log("Extracted citations:", citations.length);
      }
    } catch (citeErr) {
      console.error("Error extracting citations:", citeErr);
    }

    // 5. Save to Database
    // Insert User Message
    await supabase.from('chat_messages').insert({
      session_id: sessionId,
      role: 'user',
      content: prompt,
      image_url: userImageUrl
    });

    // Insert AI Message
    await supabase.from('chat_messages').insert({
      session_id: sessionId,
      role: 'assistant',
      content: responseText,
      metadata: { citations }
    });

    const newCount = messageCount + 1;
    if (newCount % 5 === 0 && newCount > 0) {
      const summaryPrompt = `Please provide a concise summary of the following conversation, focusing on the key symptoms discussed, diseases identified, and treatments recommended.
      
Previous Summary:
${summaryText || 'None'}

Recent Messages:
${chatHistory.map(m => `${m.role}: ${m.parts[0].text}`).join('\n')}
user: ${prompt}
model: ${responseText}

Return ONLY the summary.`;
      
      try {
        const summaryModel = getGeminiModel();
        const summaryResult = await summaryModel.generateContent(summaryPrompt);
        const newSummary = summaryResult.response.text();
        
        await supabase.from('chat_sessions').update({ summary: newSummary }).eq('id', sessionId);
      } catch (sumErr) {
        console.error("Failed to generate summary:", sumErr);
      }
    }

    return NextResponse.json({ 
      response: responseText, 
      sessionId,
      metadata: { citations }
    });

  } catch (error: any) {
    console.error('Gemini API Error:', error);
    
    // Detect 429 Quota Error
    if (error.status === 429 || error.message?.includes('429')) {
      return NextResponse.json(
        { error: 'AgriBud is currently experiencing high demand. Please try again in a few minutes as we have reached our temporary usage limit.' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to process request with AI.', details: error.message },
      { status: 500 }
    );
  }
}
