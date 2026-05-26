export async function getEstimatedTravelTime(
  originLat: number, originLon: number, 
  destLat: number, destLon: number, 
  destAddress: string
): Promise<number> {
  try {
    const url = `http://router.project-osrm.org/route/v1/driving/${originLon},${originLat};${destLon},${destLat}?overview=false`;
    const res = await fetch(url);
    const data = await res.json() as { routes?: { duration: number }[] };

    let durationSeconds = data.routes?.[0]?.duration || 0;
    let minutes = Math.round(durationSeconds / 60);

    // Margem conservadora para provas fora de base
    if (!destAddress.includes('São Paulo') && !destAddress.includes('SP')) {
      minutes = Math.round(minutes * 1.5) + 30;
    }
    return minutes;
  } catch (error) {
    console.error('Erro na API OSRM:', error);
    return 60; // Fallback conservador de segurança
  }
}
