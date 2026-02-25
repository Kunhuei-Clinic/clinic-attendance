import { NextRequest, NextResponse } from 'next/server';

type VisionRequestBody = {
  images: string[];
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as VisionRequestBody;
    const images = Array.isArray(body.images) ? body.images : [];

    if (!images.length) {
      return NextResponse.json(
        { error: 'images array is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_VISION_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GOOGLE_VISION_API_KEY is not configured' },
        { status: 500 }
      );
    }

    const visionBody = {
      requests: images.map((content) => ({
        image: { content },
        features: [{ type: 'TEXT_DETECTION' }],
      })),
    };

    const res = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(visionBody),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error('Google Vision API error:', res.status, text);
      return NextResponse.json(
        { error: 'Vision API request failed', detail: text },
        { status: 502 }
      );
    }

    const json = await res.json();
    const responses: any[] = json.responses || [];

    const results = responses.map((r) => {
      const words =
        r.textAnnotations
          ?.slice(1)
          .map((ann: any) => {
            const xs =
              ann.boundingPoly?.vertices?.map((v: any) => v.x || 0) || [0];
            return {
              text: ann.description as string,
              x: Math.min(...xs),
            };
          }) || [];

      return { words };
    });

    return NextResponse.json({ results });
  } catch (err: any) {
    console.error('Vision API handler error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error', detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}

