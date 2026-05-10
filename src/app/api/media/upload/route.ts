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

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 1. Upload to Supabase Storage
    const fileExt = file.name.split('.').pop() || 'file';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${user.id}/temp/${fileName}`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('chat_media')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      console.error("Supabase storage upload error:", uploadError);
      return NextResponse.json({ error: 'Failed to upload to storage' }, { status: 500 });
    }

    const { data: publicUrlData } = supabase.storage
      .from('chat_media')
      .getPublicUrl(filePath);
    
    const supabaseUrl = publicUrlData.publicUrl;

    // 2. Upload to Gemini
    let geminiFileUri = null;
    let localFilePath = null;

    if (process.env.GEMINI_API_KEY) {
      const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);
      localFilePath = join(tmpdir(), `${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, '_')}`);
      await writeFile(localFilePath, buffer);

      const uploadResult = await fileManager.uploadFile(localFilePath, {
        mimeType: file.type,
        displayName: file.name,
      });

      geminiFileUri = uploadResult.file.uri;

      // Polling for processing status (especially for video/audio)
      let fileStatus = await fileManager.getFile(uploadResult.file.name);
      while (fileStatus.state === FileState.PROCESSING) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        fileStatus = await fileManager.getFile(uploadResult.file.name);
      }

      if (fileStatus.state === FileState.FAILED) {
        console.error("Gemini file processing failed");
        return NextResponse.json({ error: 'Gemini processing failed' }, { status: 500 });
      }
      
      // Cleanup local temp file
      await unlink(localFilePath).catch(console.error);
    }

    return NextResponse.json({
      supabaseUrl,
      geminiFileUri,
      mimeType: file.type,
      fileName: file.name
    });

  } catch (error: any) {
    console.error('Media Upload Error:', error);
    return NextResponse.json({ error: 'Internal server error during upload' }, { status: 500 });
  }
}
