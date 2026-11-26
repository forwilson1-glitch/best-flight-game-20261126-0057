// Sunset Ridge — Valley Run: one place for every number the game tunes by.
// Nothing here is read at run time from anywhere else, so changing the feel of
// the flying, the valley or a mission means changing a number below and nothing
// else. Speeds are metres per second, heights are metres, angles are radians.
export const CONFIG = {
  // How the Kestrel answers the stick and the throttle.
  maxSpeed: 92, // flat out, clean, level flight
  maxSpeedFlaps: 58, // with the flaps hanging out
  minSpeed: 30, // under this the wing gives up and the nose falls
  minSpeedFlaps: 21, // flaps buy a slower wing
  accel: 14, // what the engine can add, m/s^2
  drag: 0.10, // how hard the air pushes back
  pitchRate: 0.85, // nose authority, rad/s
  rollRate: 1.9, // wing authority, rad/s
  maxPitch: 0.55, // about 31 degrees either way
  maxRoll: 1.05, // about 60 degrees of bank
  turnRate: 0.55, // heading change per radian of bank, per second, at cruise
  pitchStability: 0.35, // 1/s, the nose settling back to level on its own
  rollStability: 1.1, // 1/s, the wings levelling on their own
  gravity: 9.81,
  // Fuel in the tanks and damage on the airframe.
  fuelCapacity: 100,
  fuelBurnCruise: 0.55, // per second at 70% throttle
  fuelBurnFull: 1.15, // per second at full throttle
  fuelRingRestore: 45, // what a green ring puts back in the tanks
  damageHardLanding: 35, // one thud on the runway
  damageGroundGraze: 100, // the hills do not forgive at all
  // The strip and where the aeroplane starts on it.
  runway: { x: 0, z: 0, heading: 0, length: 620, width: 26 },
  startAltitude: 12, // metres over the runway at spawn
  // The chase camera: close enough that the valley fills the frame, far enough
  // that the next ring is in view while the Kestrel stays a good size.
  cameraDistance: 24, // metres behind the aircraft
  cameraHeight: 7.5, // metres above it
  focal: 0.98, // projection focal length, as a fraction of canvas height
  // The course furniture and what it pays.
  ringRadius: 17, // metres, the hole you have to fly through
  gatePenaltySeconds: 5, // slalom: added for every gate sailed past
  ringScore: 100,
  landingSoftBonus: 250,
  fuelBonusPerUnit: 2,
  scoreTimeBonusPerSecond: 4,
};

// The three sorties, in the order the title screen offers them.
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
