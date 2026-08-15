import { NextRequest, NextResponse } from 'next/server';

// Equivalente ao endpoint /api/image-proxy que existia no server.ts (Express).
// Faz proxy de imagens externas livre de CORS e das restrições de
// User-Agent do Discord/Imgur.
export async function GET(req: NextRequest) {
  const imageUrl = req.nextUrl.searchParams.get('url');

  if (!imageUrl) {
    return new NextResponse('Falta a URL da imagem', { status: 400 });
  }

  // Apenas aceita links http/https
  if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
    return new NextResponse('URL inválida', { status: 400 });
  }

  try {
    const parsedUrl = new URL(imageUrl);
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'image/*, */*',
        Referer: parsedUrl.origin,
      },
    });

    if (!response.ok) {
      console.warn(
        `Proxy falhou ao buscar imagem externa. Status: ${response.status} para URL: ${imageUrl}`
      );
      return new NextResponse(
        `Erro ao buscar imagem externa: ${response.status}`,
        { status: response.status }
      );
    }

    // Repassa o cabeçalho content-type original
    const contentType = response.headers.get('content-type') || 'image/png';
    const arrayBuffer = await response.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        // Libera cabeçalhos de CORS completamente para o Canvas do
        // navegador poder ler a imagem livremente!
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Cache-Control': 'public, max-age=86400', // Cache de 1 dia
      },
    });
  } catch (e) {
    console.error('Erro no proxy de imagem:', e);
    return new NextResponse('Erro de rede no proxy de imagem', {
      status: 500,
    });
  }
}
