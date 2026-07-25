import polyline from '@mapbox/polyline';

/**
 * Transforma uma polyline em uma URL de mapa estático, processando downsampling
 * para evitar o estouro de limite de tamanho em requisições GET.
 */
export function generateStaticMapUrl(stravaPolyline: string): string {
  if (!stravaPolyline) return '';

  try {
    // Decodifica a polyline usando a biblioteca oficial
    const decoded = polyline.decode(stravaPolyline);
    
    if (decoded.length === 0) return '';

    // Downsampling: limitando a ~80 pontos
    const maxPoints = 80;
    const step = Math.ceil(decoded.length / maxPoints);
    const sampledPoints = decoded.filter((_, index) => index % step === 0);

    // Garante que o último ponto seja incluído (chegada)
    if (sampledPoints[sampledPoints.length - 1] !== decoded[decoded.length - 1]) {
      sampledPoints.push(decoded[decoded.length - 1]);
    }

    // Monta o path no formato esperado pelo container MapStatic (lat,lon|lat,lon|...)
    const pathString = sampledPoints.map(point => `${point[0]},${point[1]}`).join('|');
    const pathParam = `color:0xff0000ff|weight:3|${pathString}`;

    // Obtém a URL do MapStatic pela variável de ambiente ou usa o default
    const mapStaticUrl = process.env.MAPSTATIC_URL || 'https://kinetix-hub.onrender.com/image';
    return `${mapStaticUrl}?width=800&height=400&path=${encodeURIComponent(pathParam)}`;
  } catch (error) {
    console.error('Erro ao processar a polyline para o mapa estático:', error);
    return '';
  }
}
