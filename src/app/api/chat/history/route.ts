import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId || sessionId === 'new') {
      return NextResponse.json({ messages: [] });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify session ownership
    const { data: session, error: sessionErr } = await supabase
      .from('chat_sessions')
      .select('user_id')
      .eq('id', sessionId)
      .single();

    if (sessionErr || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized to access this session' }, { status: 403 });
    }

    // Fetch messages
    const { data: messages, error: msgErr } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (msgErr) throw msgErr;

    return NextResponse.json({ messages });
  } catch (error: any) {
    console.error('Fetch Messages Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages.', details: error.message },
      { status: 500 }
    );
  }
}
