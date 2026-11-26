// Sunset Ridge — Valley Run: every tunable number for the flight model, the world and the
// missions lives here, so balancing never means hunting through the render code.
export const CONFIG = {
  // Flight model
  maxSpeed: 92, // m/s at full throttle, clean
  maxSpeedFlaps: 58, // m/s with flaps down
  minSpeed: 30, // below this the wing stops flying and the nose drops
  minSpeedFlaps: 21,
  accel: 14, // m/s^2 the engine can add
  drag: 0.10, // drag coefficient pulling speed toward the throttle target
  pitchRate: 0.85, // rad/s of pitch authority
  rollRate: 1.9, // rad/s of roll authority
  maxPitch: 0.55, // rad, about 31 degrees
  maxRoll: 1.05, // rad, about 60 degrees of bank
  turnRate: 0.55, // heading change per radian of bank, per second, at cruise
  pitchStability: 0.35, // 1/s, how fast the nose returns to level with no input
  rollStability: 1.1, // 1/s, how fast the wings level with no input
  gravity: 9.81,
  // Fuel and damage
  fuelCapacity: 100,
  fuelBurnCruise: 0.55, // fuel per second at 70% throttle
  fuelBurnFull: 1.15, // fuel per second at full throttle
  fuelRingRestore: 45,
  damageHardLanding: 35,
  damageGroundGraze: 100, // hitting terrain outside the runway is a crash
  // World
  runway: { x: 0, z: 0, heading: 0, length: 620, width: 26 },
  startAltitude: 12, // metres above the runway at spawn
  // Camera
  cameraDistance: 27, // metres behind the aircraft
  cameraHeight: 8.5, // metres above the aircraft
  focal: 0.92, // projection focal length, as a fraction of canvas height
  // Missions
  ringRadius: 17, // metres, the hole you fly through
  gatePenaltySeconds: 5, // slalom: seconds added for a missed gate
  ringScore: 100,
  landingSoftBonus: 250,
  fuelBonusPerUnit: 2,
  // Scoring helpers
  scoreTimeBonusPerSecond: 4,
};

export const MISSIONS = [
  {
    id: 'rings',
    key: '1',
    name: 'CANYON RINGS',
    subtitle: 'Ring Run',
    blurb: 'Thread all eight rings down the valley. Gold rings are the course, green rings refuel you.',
    goal: 'Fly through all 8 rings',
  },
  {
    id: 'slalom',
    key: '2',
    name: 'SLALOM SPRINT',
    subtitle: 'Valley Slalom',
    blurb: 'Ten gates, left then right, against the clock. Miss a gate and five seconds are added.',
    goal: 'Clear 10 gates as fast as you can',
  },
  {
    id: 'home',
    key: '3',
    name: 'HOME RUN',
    subtitle: 'Home Run',
    blurb: 'Take off, round the beacon two kilometres out, and bring her home to a soft landing.',
    goal: 'Round the beacon, then land on the runway',
  },
];
