import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { GoogleAIFileManager, FileState } from '@google/generative-ai/server';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('media') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file size (50MB max)
    if (file.size > 52428800) {
      return NextResponse.json({ error: 'File too large. Maximum size is 50MB.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // ──────────────────────────────────────────────────────────
    // 1. Upload to Supabase Storage
    // ──────────────────────────────────────────────────────────
    const fileExt = file.name.split('.').pop() || 'file';
    const sanitizedExt = fileExt.replace(/[^a-z0-9]/gi, '');
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${sanitizedExt}`;
    const filePath = `${user.id}/media/${fileName}`;
    
    let supabaseUrl: string | null = null;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('chat_media')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      console.error("Supabase storage upload error:", uploadError.message);
      // Don't fail entirely — the Gemini upload can still work for AI analysis
      // The image just won't be persisted for later viewing
      console.warn("Continuing without Supabase storage — media will only be sent to Gemini");
    } else {
      const { data: publicUrlData } = supabase.storage
        .from('chat_media')
        .getPublicUrl(filePath);
      supabaseUrl = publicUrlData.publicUrl;
    }

    // ──────────────────────────────────────────────────────────
    // 2. Upload to Gemini (for AI analysis)
    // ──────────────────────────────────────────────────────────
    let geminiFileUri: string | null = null;
    let localFilePath: string | null = null;

    if (process.env.GEMINI_API_KEY) {
      try {
        const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);
        // Sanitize filename for local temp storage
        const safeName = file.name.replace(/[^a-z0-9.]/gi, '_').substring(0, 100);
        localFilePath = join(tmpdir(), `${Date.now()}-${safeName}`);
        await writeFile(localFilePath, buffer);

        const uploadResult = await fileManager.uploadFile(localFilePath, {
          mimeType: file.type,
          displayName: file.name,
        });

        geminiFileUri = uploadResult.file.uri;

        // Poll for processing status (video/audio files need time to process)
        let fileStatus = await fileManager.getFile(uploadResult.file.name);
        let pollCount = 0;
        const maxPolls = 30; // Max 60 seconds of polling

        while (fileStatus.state === FileState.PROCESSING && pollCount < maxPolls) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          fileStatus = await fileManager.getFile(uploadResult.file.name);
          pollCount++;
        }

        if (fileStatus.state === FileState.FAILED) {
          console.error("Gemini file processing failed for:", file.name);
          // Don't fail entirely — still return the Supabase URL if available
          geminiFileUri = null;
        }
      } catch (geminiErr: any) {
        console.error("Gemini upload error:", geminiErr.message);
        // Continue — at least the file is in Supabase storage
      } finally {
        // Always cleanup local temp file
        if (localFilePath) {
          await unlink(localFilePath).catch(() => {});
        }
      }
    }

    // At least one upload must succeed
    if (!supabaseUrl && !geminiFileUri) {
      return NextResponse.json({ 
        error: 'Media upload failed. Please check that the storage bucket exists in Supabase.' 
      }, { status: 500 });
    }

    return NextResponse.json({
      supabaseUrl: supabaseUrl || '',
      geminiFileUri: geminiFileUri || '',
      mimeType: file.type,
      fileName: file.name
    });

  } catch (error: any) {
    console.error('Media Upload Error:', error);
    return NextResponse.json({ error: `Upload failed: ${error.message}` }, { status: 500 });
  }
}
