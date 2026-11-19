import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requireAuth } from '@/lib/auth-server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limiter';

export const dynamic = 'force-dynamic';

const ALLOWED_AUDIO_TYPES = ['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-m4a'];
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_AUDIO_SIZE = 26214400; // 25 MB
const MAX_IMAGE_SIZE = 5242880;  // 5 MB

export async function POST(request: Request) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.response) return authResult.response;

    const userId = authResult.caller.user.id;

    const rate = await checkRateLimit(`upload:${userId}`, 10, 60000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: rate.message || `Too many upload attempts. Please wait ${rate.retryAfterSeconds} seconds before trying again.` },
        { status: 429 }
      );
    }

    // Verify upload credit
    if (supabaseAdmin) {
      const { data: credit, error: creditErr } = await supabaseAdmin
        .from('upload_credits')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'available')
        .limit(1)
        .maybeSingle();

      if (creditErr || !credit) {
        return NextResponse.json(
          { error: 'An available upload credit (₹20 entry fee) is required to upload files.' },
          { status: 403 }
        );
      }
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const type = (formData.get('type') as string) || 'audio';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const mime = file.type;
    const size = file.size;

    if (type === 'audio') {
      if (size > MAX_AUDIO_SIZE) {
        return NextResponse.json({ error: 'Audio file size exceeds 25 MB limit' }, { status: 400 });
      }
      if (!ALLOWED_AUDIO_TYPES.includes(mime) && !mime.startsWith('audio/')) {
        return NextResponse.json({ error: 'Invalid audio format. Allowed: webm, mp3, m4a, ogg, wav' }, { status: 400 });
      }
    } else {
      if (size > MAX_IMAGE_SIZE) {
        return NextResponse.json({ error: 'Cover image exceeds 5 MB limit' }, { status: 400 });
      }
      if (!ALLOWED_IMAGE_TYPES.includes(mime)) {
        return NextResponse.json({ error: 'Invalid image format. Allowed: jpeg, png, webp' }, { status: 400 });
      }
    }

    const ext = file.name.split('.').pop() || (type === 'audio' ? 'webm' : 'jpg');
    const storagePath = `${userId}/${Date.now()}.${ext}`;
    const bucketName = type === 'audio' ? 'story-audio' : 'story-covers';
    const buffer = Buffer.from(await file.arrayBuffer());

    if (supabaseAdmin) {
      const { error: uploadErr } = await supabaseAdmin.storage
        .from(bucketName)
        .upload(storagePath, buffer, {
          contentType: mime,
          upsert: false,
        });

      if (uploadErr) {
        return NextResponse.json({ error: uploadErr.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        url: storagePath,
        bucket: bucketName,
        path: storagePath,
        size,
        mime,
      });
    }

    // Local filesystem storage fallback
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', type);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filename = `${userId}-${Date.now()}.${ext}`;
    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, buffer);
    const publicUrl = `/uploads/${type}/${filename}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
      filename,
      size,
      mime,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
