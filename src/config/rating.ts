export const RATING_CONFIG = {
  points: {
    1: 100,
    2: 80,
    3: 60,
    range4to10: 40,
    participation: 10,
  },
  massBonus: {
    threshold: 50,
    multiplier: 1.2,
  },
  seasonFormat: 'YYYY',
};

export function calculatePointsForPlace(place: number, totalParticipants: number): number {
  let basePoints = RATING_CONFIG.points.participation;
  if (place === 1) basePoints = RATING_CONFIG.points[1];
  else if (place === 2) basePoints = RATING_CONFIG.points[2];
  else if (place === 3) basePoints = RATING_CONFIG.points[3];
  else if (place >= 4 && place <= 10) basePoints = RATING_CONFIG.points.range4to10;

  if (totalParticipants >= RATING_CONFIG.massBonus.threshold) {
    return Math.round(basePoints * RATING_CONFIG.massBonus.multiplier);
  }
  return basePoints;
}
