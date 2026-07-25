import { env } from '@/config/env';
import { redisClient } from '@/config/redis';

const localMapCache = new Map<string, Buffer>();

export async function fetchMapStaticBuffer(polyline: string): Promise<Buffer | null> {
  if (!env.MAPSTATIC_URL || !polyline) return null;
  
  const cacheKey = `map:polyline:${polyline}`;

  if (redisClient) {
    try {
      const cachedBuffer = await redisClient.getBuffer(cacheKey); 
      if (cachedBuffer) return cachedBuffer;
    } catch (err) {
      console.error('❌ [Redis] Erro ao ler cache de mapa:', err);
    }
  } else if (localMapCache.has(polyline)) {
    return localMapCache.get(polyline)!;
  }

  try {
    const url = new URL(env.MAPSTATIC_URL);
    url.searchParams.append('path', `weight:3|color:0xff0000ff|enc:${polyline}`);
    url.searchParams.append('size', '600x300');
    const response = await fetch(url.toString());
    if (!response.ok) return null;
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    if (redisClient) await redisClient.set(cacheKey, buffer, 'EX', 60 * 60 * 24 * 30).catch(console.error);
    else localMapCache.set(polyline, buffer);

    return buffer;
  } catch (error) {
    console.error('❌ [MapStatic] Erro de rede interna:', error);
    return null;
  }
}
