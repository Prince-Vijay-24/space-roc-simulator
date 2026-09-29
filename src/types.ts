export type GameMode = 'SPACEPORT' | 'BUILD' | 'ROLLOUT' | 'FLIGHT' | 'MAP' | 'STATION';

export type PartCategory = 'Command' | 'Propulsion' | 'Fuel' | 'Utility' | 'Aerodynamics' | 'Structural' | 'Station';

export type FuelType = 'kerolox' | 'hydrolox' | 'methalox' | 'nuclear' | 'ion' | 'solid' | 'monoprop' | 'hypergolic';
export type NozzleType = 'bell' | 'vac' | 'aerospike' | 'spike' | 'cone' | 'dual_bell';

// Juno: New Origins Rocket Engine Specific Types
export type EngineType = 'Liquid' | 'Solid' | 'Monopropellant' | 'Nuclear Thermal';
export type LiquidPowerCycle = 'Pressure-Fed' | 'Electric' | 'Gas Generator I' | 'Gas Generator II' | 'Staged' | 'Full Flow Staged' | 'Expander';
export type SolidPowerCycle = 'Booster' | 'Amateur';
export type EnginePowerCycle = LiquidPowerCycle | SolidPowerCycle;
export type LiquidFuelType = 'Kerolox' | 'Hydrolox' | 'Methalox';
export type SolidFuelGrain = 'Steady' | 'Ramp Down' | 'Impulse' | 'Basic' | 'Ramp Up';
export type NuclearFuelType = 'Liquid Hydrogen' | 'Water';
export type JunoNozzleStyle = 'Bell' | 'Cone' | 'Bravo' | 'Delta' | 'Omega' | 'Aerospike' | 'Dual Bell';

export interface JunoEngineConfig {
  engineSizePercent: number; // 25% to 200%, default 50%
  engineType: EngineType;
  powerCycle: EnginePowerCycle;
  liquidFuel: LiquidFuelType;
  solidGrain: SolidFuelGrain;
  nuclearFuel: NuclearFuelType;
  chamberPressureKPa: number; // 1,000 to 25,000 kPa
  gimbalRangeDeg: number; // 0.0 to 15.0 deg
  nozzleStyle: JunoNozzleStyle;
  throatSizePercent: number; // 50% to 150%, default 100%
  nozzleLengthPercent: number; // 0% to 200%, default 50% or 100%
}

// Section 3: Parts System specification types
export type PartRoleCategory = 'MAIN' | 'ATTACHING';

export type MainPartRole = 'COMMAND' | 'ENGINE' | 'FUEL_TANK' | 'FAIRING' | 'CARGO_BAY' | 'GYROSCOPE' | 'HABITATION' | 'LABORATORY';
export type AttachingPartRole = 'DOCKING_PORT' | 'RCS' | 'SOLAR_PANEL' | 'BATTERY' | 'STRUCTURAL' | 'PARACHUTE' | 'ANTENNA' | 'RADIATOR';

export interface Astronaut {
  id: string;
  name: string;
  role: 'Commander' | 'Pilot' | 'Engineer' | 'Scientist';
  status: 'ready' | 'assigned' | 'in-flight';
  missionsFlown: number;
  morale: number; // 0 to 100
  assignedPartUid?: string;
  suitColor?: string;
  avatarSeed: string;
}

export type PartRole = MainPartRole | AttachingPartRole;
export type AttachmentType = 'stack' | 'radial' | 'both';

export interface PartDefinition {
  id: string;
  name: string;
  category: PartCategory;
  description: string;
  roleCategory: PartRoleCategory; // Section 3: 'MAIN' vs 'ATTACHING'
  partRole: PartRole; // Section 3.1 & 3.2 roles
  attachmentType: AttachmentType; // Section 3.3 Stack vs Radial vs Both
  width: number;  // Grid units (1 unit = 0.5 or 1 meter)
  height: number; // Grid units
  dryMass: number; // in tonnes
  fuelMass: number; // in tonnes
  maxThrust: number; // in kN (0 if not an engine)
  ispSL: number; // Specific impulse at sea level (seconds)
  ispVac: number; // Specific impulse in vacuum (seconds)
  dragCoeff: number;
  maxTemp: number; // in Kelvin
  fuelType?: FuelType;
  nozzleType?: NozzleType;
  gimbalRange?: number; // degrees e.g. 5
  expansionRatio?: number;
  hasReactionWheel?: boolean;
  torque?: number; // kN*m
  isDecoupler?: boolean;
  isTopDecoupler?: boolean;
  isSideSeparator?: boolean;
  ejectionForce?: number; // kN
  isFairing?: boolean;
  isParachute?: boolean;
  parachuteType?: 'parachute_main' | 'parachute_drogue' | 'parachute_ram_air' | 'parachute_tri_cluster' | string;
  deployedDrag?: number;
  isHeatShield?: boolean;
  ablatorMass?: number;
  isRCS?: boolean;
  rcsThrusterType?: 'rcs_fixed_single' | 'rcs_3way_cluster' | 'rcs_gimbal_vernier' | string; // 3 distinct selectable RCS architectures
  rcsNozzleCount?: 1 | 2 | 3 | 4 | 5;
  rcsThrustKn?: number;
  rcsPropellantType?: 'cold_gas' | 'monoprop' | 'hypergolic';
  rcsGimbalRangeDeg?: number; // For gimbaling vernier RCS
  isSolarPanel?: boolean;
  solarPanelType?: 'classic' | 'circular' | 'hexagonal'; // Classic N*M array, circular fan, or hexagonal honeycomb
  solarPanelStyle?: 'Silicon Blue Ultra' | 'Triple-Junction GaAs' | 'Gold Kapton Flexible' | 'Hex Honeycomb Mesh';
  solarGridM?: number; // Number of panel rows (e.g. 4)
  solarGridN?: number; // Number of panel columns (e.g. 2)
  solarSectors?: number; // Circular fan sector count
  solarHexRings?: number; // Hexagonal ring count (1 or 2)
  isLandingLeg?: boolean;
  landingLegType?: 'standard' | 'heavy_carbon' | 'wide_spreader' | 'micro_hopper' | 'spider_articulated' | string; // 5 distinct landing leg types
  legDeployAngleDeg?: number;
  legFootpadType?: 'Standard' | 'Heavy' | 'Wide Terrain' | 'Spike Claw';
  impactToleranceMs?: number; // Maximum impact velocity (m/s) before strut failure
  springStiffness?: number; // Spring stiffness coefficient (0.2 to 3.0)
  suspensionDamping?: number; // Shock absorption damping coefficient (0.2 to 3.0)
  groundClearanceM?: number; // Ground clearance provided when deployed (m)
  stanceWidthM?: number; // Stance width footprint (m) for tip-over prevention
  deploySpeed?: number; // Deployment rate (progress per sec, e.g. 0.67 = 1.5s deploy)
  maxCompressionM?: number; // Strut travel distance before bottoming out (m)
  isWheel?: boolean; // Planetary Rover Wheels
  wheelType?: 'rover_compact' | 'rover_heavy';
  wheelRadiusM?: number;
  wheelDrivePowerKw?: number;
  isDockingPort?: boolean;
  isRadial?: boolean;
  isSRB?: boolean;
  burnDuration?: number; // seconds for SRB
  crewCapacity?: number; // Cockpit crew e.g. 1 or 3 (0 for probe cores)
  batteryCapacity?: number; // Electric charge in kWh (e.g. 50 EC)
  powerDrawKw?: number; // Power draw when active (e.g. 0.2 kW for probe, 1.5 kW for gyroscope)
  antennaRangeKm?: number; // Antenna communication range back to Astronet HQ
  solarAreaM2?: number; // Solar panel surface area in m^2
  solarOutputKw?: number; // Base generation at 1 AU direct sunlight
  monopropMass?: number; // Monopropellant storage in tonnes (for RCS tanks)
  jettisonAltitude?: number; // Fairing auto-jettison altitude in meters
  jettisonMaxQ?: number; // Fairing auto-jettison max Q in kPa
  // Mining, Refining, and Smelting System
  isMiningDrill?: boolean;
  isRefinery?: boolean;
  isSmelter?: boolean;
  isOreTank?: boolean;
  miningRateKgS?: number; // kg/s raw ore extraction
  refiningRateKgS?: number; // kg/s refining speed
  smeltingRateKgS?: number; // kg/s ingot smelting speed
  oreCapacityKg?: number;
  refinedOreCapacityKg?: number;
  ingotCapacityKg?: number;
  scalable?: boolean; // Juno: New Origins continuous scaling supported
  snapPoints: { x: number; y: number; type: 'top' | 'bottom' | 'side' | 'any' }[];
  color: string;
  accentColor: string;
}

export interface PlacedPart {
  uid: string;
  partId: string;
  x: number; // Grid coordinates in VAB
  y: number;
  rotation: number; // In 90 degree increments: 0, 90, 180, 270
  stage: number; // Staging index (1, 2, 3...)
  fuelRemaining: number; // in tonnes
  maxFuel?: number; // maximum fuel capacity in tonnes
  ablatorRemaining: number; // in tonnes
  deployed?: boolean; // For parachutes, solar panels, legs
  deployProgress?: number; // 0.0 (folded/stowed) to 1.0 (fully deployed/unfolded) for continuous smooth animation
  wheelSteerAngle?: number; // Steering angle in radians for rover wheels
  wheelRotation?: number; // Continuous rolling wheel rotation in radians
  destroyed?: boolean;
  activated?: boolean; // Engine or system enabled state
  isEngineOn?: boolean; // Individual engine toggle (like in SFS)
  customWidth?: number; // Custom adjustable width/diameter in meters
  customHeight?: number; // Custom adjustable height/length in meters
  tankSkin?: 'white' | 'orange' | 'steel' | 'dark'; // Custom cosmetic tank material/insulation
  jettisonAltitude?: number; // Custom fairing auto-jettison altitude
  jettisonMaxQ?: number; // Custom fairing auto-jettison max Q
  symmetryPairId?: string; // Group ID linking mirrored/symmetric parts
  adapterTopWidth?: number; // For interstage conical adapters: upper diameter in meters
  adapterBottomWidth?: number; // For interstage conical adapters: lower diameter in meters
  adapterShape?: 'CONICAL_FRUSTUM' | 'CYLINDRICAL' | 'SMOOTH_FAIRING' | string; // Computed shape mode for adapters & decouplers
  autoAdjusted?: boolean; // Indicates if part size was auto-fitted to adjacent stages
  // Fuel Tank Engine Mount Cluster Configuration (Max 3 engines)
  engineMountCount?: 1 | 2 | 3; // Number of engine attachment nodes at the base of the tank (1 to 3, max 3)
  engineMountWidthM?: number; // Configured width/diameter per mounted engine at base (e.g. 0.6m to 3.0m)
  // Juno: New Origins engine tuning & propellant configuration
  engineConfig?: JunoEngineConfig;
  propellantType?: FuelType;
  chamberPressureBar?: number; // e.g. 50 to 300 bar
  throatRadiusM?: number; // e.g. 0.05 to 0.40 m
  expansionRatio?: number; // e.g. 10 to 180
  customNozzleType?: NozzleType;
  // Mining & Smelting In-Flight state
  oreStoredKg?: number;
  refinedOreStoredKg?: number;
  ingotsStoredKg?: number;
  isDrillActive?: boolean;
  isRefineryActive?: boolean;
  isSmelterActive?: boolean;
  // Action Groups & N*M Solar Panel & Parachute Remake fields
  actionGroup?: number; // Action Group assignment 1 to 8
  solarScale?: number; // Solar array overall size bar scale factor (0.5x to 6.0x)
  solarBoomLengthM?: number; // Articulated boom distance extending outwards from craft hull (0.0m to 15.0m)
  solarGridN?: number; // Configured N columns for solar panel grid (1-12)
  solarGridM?: number; // Configured M rows for solar panel grid (1-20)
  solarCellWidthM?: number; // Individual panel cell width in meters
  solarCellHeightM?: number; // Individual panel cell height in meters
  solarPanelStyle?: 'Silicon Blue Ultra' | 'Triple-Junction GaAs' | 'Gold Kapton Flexible' | 'Hex Honeycomb Mesh' | 'Silicon Blue' | 'GaAs Triple' | 'Gold Kapton' | 'Hex Mesh' | string;
  solarEfficiency?: number; // Solar cell efficiency (0.15 to 0.42)
  solarUnfoldSpeed?: number; // Unfolding articulation speed multiplier (0.5 to 3.0)
  solarSunTracking?: boolean; // Automatic solar tracking enabled
  parachuteState?: 'STOWED' | 'PILOT' | 'DROGUE' | 'MAIN'; // 4-stage realistic parachute deployment
  parachuteDeployAltitudeM?: number; // Configured deployment altitude in meters (100m - 10000m)
  parachuteMinPressureAtm?: number; // Minimum atmospheric pressure to arm/deploy (0.01 - 0.5 atm)
  parachuteCanopyDiameterM?: number; // Canopy full diameter in meters (1m - 35m)
  parachuteCordLengthM?: number; // Suspension cord length in meters (4m - 40m)
  parachuteReefingCutAltM?: number; // Reefing cut altitude in meters (200m - 3000m)
  parachuteChuteType?: 'Main' | 'Drogue' | 'Ram-Air' | 'Cluster' | 'Pilot' | string; // Parachute type specialization
  parachuteType?: 'parachute_main' | 'parachute_drogue' | 'parachute_ram_air' | 'parachute_tri_cluster' | string;
  parachuteColorPattern?: 'Apollo' | 'Artemis' | 'Cargo' | 'White';
  parachuteCut?: boolean; // Parachute manually cut / severed
  drogueAltitudeM?: number; // Altitude in meters to trigger drogue reefed chute
  mainAltitudeM?: number; // Altitude in meters to trigger full main canopy inflation
  customParachuteRadiusM?: number; // Configured canopy radius in meters
  // Landing Legs details
  landingLegType?: 'standard' | 'heavy_carbon' | 'wide_spreader' | 'micro_hopper' | 'spider_articulated' | string;
  legSuspensionStiffness?: number; // Suspension stiffness (0.1 to 3.0)
  legSuspensionDamping?: number; // Suspension damping (0.1 to 3.0)
  legDeployAngleDeg?: number; // Deploy angle in degrees (15 to 75 deg)
  legFootpadType?: 'Standard' | 'Heavy' | 'Wide Terrain' | 'Spike Claw'; // Footpad footprint style
  legScale?: number; // Scaling multiplier (0.6 to 2.5)
  legMaterialColor?: string;
  impactToleranceMs?: number; // Maximum impact velocity (m/s)
  springStiffness?: number;
  suspensionDamping?: number;
  groundClearanceM?: number;
  stanceWidthM?: number;
  deploySpeed?: number;
  maxCompressionM?: number;
  isLegBuckled?: boolean; // Leg failed from over-stress or hard impact
  isLegGrounded?: boolean; // Leg contacting surface in flight
  suspensionCompression?: number; // 0.0 to 1.0 real-time compression
  // Solar Panels details
  solarPanelType?: 'classic' | 'circular' | 'hexagonal';
  solarSectors?: number; // Radial fan sectors for circular array (6, 8, 12, 16)
  solarHexRings?: number; // Hexagonal ring count (1 or 2 rings)
  solarDiameterM?: number; // Diameter in meters for circular array
  // Rover Wheels details
  wheelMotorPowerKw?: number; // Drive motor power in kW (0.5 to 30.0)
  wheelBrakeStrength?: number; // Brake torque strength percentage (10% to 100%)
  wheelMaxSteerAngleDeg?: number; // Maximum steering angle in degrees (0 to 60 deg)
  wheelSuspensionTravelM?: number; // Suspension vertical travel in meters (0.1 to 1.2)
  wheelTractionControl?: boolean; // Electronic traction control assist
  // Aerodynamics & Nose Cones
  noseFinenessRatio?: number; // Slenderness ratio (0.5 to 4.0)
  noseTipShape?: 'Ogive' | 'Conical' | 'Parabolic' | 'Von Karman' | 'Blunted';
  finSweepAngleDeg?: number; // Control fin sweep angle (0 to 60 deg)
  finActuatorRangeDeg?: number; // Control surface deflection range (5 to 40 deg)
  // Command Pods & Reaction Wheels
  sasReactionTorque?: number; // Gyroscope SAS torque (5 to 150 kN·m)
  internalBatteryKwh?: number; // Battery capacity (10 to 500 kWh)
  rcsMonopropellantTonnes?: number; // Monopropellant storage (0 to 2.0 tonnes)
  // Decouplers & Separators
  ejectionForceKn?: number; // Separation impulse force (5 to 200 kN)
  explosiveDelaySec?: number; // Delay timer before separation (0 to 5 sec)
  // Heat Shields
  heatShieldAblatorKg?: number; // Ablative heat shield mass (kg)
  heatShieldMaxTempK?: number; // Maximum thermal tolerance (K)
  // RCS Thrusters
  rcsThrusterType?: 'rcs_fixed_single' | 'rcs_3way_cluster' | 'rcs_gimbal_vernier' | string;
  rcsNozzleCount?: 1 | 2 | 3 | 4 | 5; // RCS nozzle count
  rcsThrustKn?: number; // RCS thrust per nozzle (kN)
  rcsPropellantType?: 'cold_gas' | 'monoprop' | 'hypergolic';
  rcsCantAngleDeg?: number; // Cant angle in degrees (0 to 45 deg)
  rcsScale?: number; // Scale factor (0.5 to 2.5)
  rcsFiring?: boolean; // Live test fire state in builder
  rcsFireDirection?: 'ALL' | 'UP' | 'LEFT' | 'RIGHT' | 'DOWN';
  rcsGimbalAngleRad?: number; // Current active gimbal angle in radians for vernier RCS
  rcsActiveThrustVector?: { x: number; y: number }; // Current live thrust vector in body frame
  lastThrustFx?: number; // Last computed horizontal thrust in body frame (kN)
  lastThrustFy?: number; // Last computed vertical thrust in body frame (kN)
  // Antennas & Communication
  antennaDishDiameterM?: number; // Dish diameter (m)
  antennaRangeGm?: number; // Comm range in Gigameters
  // Mining Drills & Processing
  drillDepthM?: number; // Drill reach depth (m)
  drillRateKgPerS?: number; // Extraction rate in kg/s
  unattachedWarning?: boolean; // Part is currently unattached to the rocket stack
}

export type RocketBuildMode = 'ENTIRE' | 'STAGE_WISE' | 'HYBRID';

export type StageRole = 'PAYLOAD' | 'UPPER_STAGE' | 'FIRST_STAGE' | 'BOOSTER' | 'CUSTOM';

export interface StageAssembly {
  id: string;
  name: string;
  role: StageRole;
  parts: PlacedPart[];
  decouplerBelow?: boolean; // Auto-place interstage decoupler below when stacking
  radialMount?: boolean; // If true, mounts radially as a side booster
  radialSide?: 'left' | 'right' | 'both'; // Radial booster symmetry sides
  radialOffset?: number; // X distance offset from core centerline
}

export interface CelestialBody {
  id: string;
  name: string;
  category?: 'planet' | 'moon' | 'dwarf' | 'star';
  parent?: string; // parent body id e.g. 'earth'
  radius: number; // meters (Earth = 315,000m, Moon = 73,000m)
  mass: number;
  mu: number; // Standard gravitational parameter: G*M (m^3/s^2)
  surfaceGravity: number; // m/s^2 (Earth = 9.80, Moon = 1.62)
  atmosphereHeight: number; // meters (Earth = 30,000m, Moon = 0)
  scaleHeight: number; // meters (Earth = 5,000m)
  orbitRadius: number; // meters (Moon = 3,000,000m from Earth)
  orbitPeriod: number; // seconds
  orbitSpeed: number; // m/s
  soiRadius: number; // meters (Moon = 150,000m)
  color: string;
  atmosphereColor: string;
  semiMajorAxisAU?: number;
}

export interface ManeuverNode {
  id: string;
  timeToNode: number; // seconds from current time
  deltaVPrograde: number; // m/s
  deltaVRadial: number; // m/s
  burnDuration: number; // seconds estimated
  executed: boolean;
}

export interface OrbitParameters {
  apoapsis: number; // Altitude in meters
  periapsis: number; // Altitude in meters
  semiMajorAxis: number;
  semiMinorAxis: number;
  eccentricity: number;
  period: number; // seconds
  inclination: number;
  trueAnomaly: number; // radians
  argumentOfPeriapsis: number; // radians
  specificAngularMomentum: number;
  specificEnergy: number;
  timeToApoapsis: number; // seconds
  timeToPeriapsis: number; // seconds
  isOrbiting: boolean;
  isSuborbital: boolean;
  isHyperbolic: boolean;
  maneuverNode?: ManeuverNode | null;
  closestApproachMoon?: {
    distance: number;
    timeToClosest: number;
    intersectsSOI: boolean;
    encounterPoint?: { x: number; y: number };
    moonAtEncounter?: { x: number; y: number };
  };
}

export interface VesselState {
  x: number; // Position relative to Earth center (meters)
  y: number;
  vx: number; // Velocity (m/s)
  vy: number;
  angle: number; // Orientation in radians (0 = Up/North, PI/2 = East)
  angularVelocity: number; // rad/s
  mass: number; // Total wet mass in tonnes
  dryMass: number; // Total dry mass in tonnes
  fuelMass: number; // Total remaining fuel in tonnes
  maxFuelMass: number; // Max fuel capacity in tonnes
  fuelPercent: number; // 0 to 100%
  currentTWR: number; // Thrust to weight ratio
  throttle: number; // 0.0 to 1.0
  activeStageIndex: number;
  soi: string; // 'earth' | 'moon' | others
  altitude: number; // meters above surface
  surfaceSpeed: number;
  verticalSpeed: number;
  horizontalSpeed: number;
  orbitalSpeed: number;
  dynamicPressure: number; // kPa (Q = 0.5 * rho * v^2)
  maxQValue: number; // peak Q encountered
  isMaxQ: boolean; // boolean flag when hitting high aerodynamic dynamic pressure
  machTransonicFactor: number; // transonic drag rise multiplier (Mach 0.8-1.2)
  gForce: number; // G's
  atmosphericDensity: number; // kg/m^3
  machNumber: number;
  heatFlux: number; // Re-entry heating flux (MW/m^2)
  reentryVapor: number; // 0 to 1 intensity of reentry condensation vapor ribbons & ionization wake
  hasBeenInSpace?: boolean; // Track if vessel has traversed space / vacuum
  hullTemperature: number; // Kelvin
  isLanded: boolean;
  isCrashed: boolean;
  parts: PlacedPart[];
  debris: DebrisObject[];
  rcsActive: boolean;
  rcsLateralCommand?: number; // Real-time translation input or autopilot command
  rcsPitchCommand?: number; // Real-time pitch/yaw RCS command
  rcsTranslationX?: number; // -1.0 (left) to +1.0 (right) body translation
  rcsTranslationY?: number; // -1.0 (aft) to +1.0 (forward) body translation
  liveCoMX?: number; // Live center of mass X in body coordinates
  liveCoMY?: number; // Live center of mass Y in body coordinates
  rcsTorqueNm?: number; // Current instantaneous torque from positional RCS thrusters (kN*m)
  rcsThrustKnTotal?: number; // Current instantaneous net translation thrust from RCS (kN)
  sasMode: 'OFF' | 'STABILITY' | 'PROGRADE' | 'RETROGRADE' | 'RADIAL_OUT' | 'RADIAL_IN' | 'TARGET';
  landingLegsDeployed: boolean;
  landingGearCompression?: number; // 0.0 to 1.0 instantaneous suspension compression
  activeLandingGearStats?: {
    totalLegs: number;
    deployedLegs: number;
    buckledLegs: number;
    maxImpactTolerance: number;
    stanceWidth: number;
    effectiveGroundClearance: number;
    primaryType: 'standard' | 'heavy_carbon' | 'wide_spreader' | 'micro_hopper' | 'none';
  };
  parachutesDeployed: boolean;
  solarPanelsDeployed: boolean;
  maxAltitudeReached: number;
  hasReachedOrbit: boolean;
  hasLandedOnMoon: boolean;
  fuelFlowRate: number; // tonnes per second
  estimatedBurnTime: number; // seconds of fuel remaining at current throttle
  totalFuelMass: number; // current fuel in tonnes
  stageFuelMass: number; // current active stage fuel in tonnes
  stageMaxFuelMass: number; // max active stage fuel capacity in tonnes
  selectedTankUids: string[]; // SFS propellant tank inspection & transfer
  isTransferringFuel: boolean; // Active fuel transfer in progress
  transferDirection: 'in' | 'out'; // Direction of transfer between selected tanks
  targetPhaseAngle?: number; // Target Moon injection phase angle (degrees)
  currentPhaseAngle?: number; // Current Earth-Moon phase angle (degrees)
  gimbalAngle?: number; // Real-time engine TVC gimbal deflection in radians
  aoa?: number; // Angle of attack relative to airflow (degrees)
  missionTime?: number; // Mission elapsed time in seconds (MET)
  // Section 3: Parts System - Power, Auto-fed RCS, Command & Astronet Relay
  isEngineOn?: boolean; // Master engine toggle state
  lowFuelWarning?: boolean; // True when propellant is <= 10%
  isFuelCritical?: boolean; // True when propellant is <= 5% (flameout imminent / sputtering)
  engineFlameout?: boolean; // True when propellant hits 0 and engines shut off
  batteryCharge: number; // Electric Charge remaining in kWh
  batteryMax: number; // Max Electric Charge capacity in kWh
  batteryDrainRate: number; // Current power draw in kW (gyroscopes, probes)
  solarPowerGen: number; // Current solar power generation in kW
  monopropRemaining: number; // Auto-fed monopropellant remaining in tonnes
  monopropMax: number; // Max monopropellant capacity in tonnes
  hasCommand: boolean; // Section 3.1: True if craft has functional Command Unit
  commandType: 'CREWED' | 'PROBE' | 'NONE'; // Control source
  hasAstronetSignal: boolean; // Section 3.2: Unbroken link back to Astronet HQ
  astronetSignalStrength: number; // 0 to 100% signal strength
  astronetDistanceKm: number; // Distance to Earth Astronet HQ
  inEclipse: boolean; // True if in planetary shadow (solar panel output = 0)
  fairingsJettisoned: boolean; // True if fairings released
  // Mining, Refining, and Smelting In-Flight state
  totalOreKg: number;
  totalRefinedOreKg: number;
  totalIngotsKg: number;
  isDrilling: boolean;
  isRefining: boolean;
  isSmelting: boolean;
  miningRateKgS: number;
}

export interface DebrisObject {
  id: string;
  parts: PlacedPart[];
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  angularVelocity: number;
  mass: number;
}

export interface StageMetric {
  stage: number;
  deltaV: number;
  twrSL: number;
  twrVac: number;
  thrust: number;
  wetMass: number;
  dryMass: number;
  fuelMass: number;
  burnTime: number;
}

export interface RocketMetrics {
  wetMass: number; // tonnes
  dryMass: number; // tonnes
  totalFuelMass: number; // tonnes
  fuelMass?: number; // alias for totalFuelMass
  fuelPercent?: number; // fuel percentage
  maxFuelMass?: number; // max fuel capacity
  totalThrust: number; // kN
  twrSeaLevel: number;
  twrVacuum: number;
  estimatedDeltaV: number; // m/s
  stageBreakdown: StageMetric[];
  com: { x: number; y: number }; // Center of Mass (grid units)
  cot: { x: number; y: number }; // Center of Thrust (grid units)
  partCount: number;
  ullageLossPercent?: number; // 3-8% ullage
  boiloffRateKgPerHour?: number; // LH2 / LOX boiloff
  mixtureWarning?: string | null; // e.g. "O:F ratio mismatch warning"
  // Section 3: Parts System Metrics & Validation
  hasCommandUnit: boolean;
  commandUnitCount: number;
  crewCapacity: number;
  batteryCapacity: number; // kWh
  monopropCapacity: number; // tonnes
  maxAntennaRangeKm: number; // km
  gyroscopeTorque: number; // kN*m total
  solarMaxOutputKw: number; // kW total
}

/* ==========================================================================
   SPACE AGENCY ORBITAL STATION SYSTEM TYPES
   ========================================================================== */
export type StationOverlayView = 'fuel' | 'power' | 'pressure' | 'thermal' | 'stress';

export interface StationModuleDef {
  id: string;
  name: string;
  category: 'Core' | 'LifeSupport' | 'Habitation' | 'Utilities' | 'Science';
  description: string;
  powerDrawKw: number; // positive = consumes kW, negative = generates kW (e.g. -80 kW)
  cssClass: string; // e.g. 'module-core', 'module-medbay', 'module-hydroponics', etc.
  crewCapacity: number;
  o2GenerationKgHr: number;
  waterConsumptionLhr: number;
  thermalDissipationKw: number; // positive = cools, negative = generates heat
  fuelStorageL: number;
  monopropStorageL: number;
  researchPointsSec: number;
  specDetails: string;
}

export interface StationPlacedModule {
  uid: string;
  moduleId: string;
  gridX: number; // column index 0..N
  gridY: number; // row index 0..N
  active: boolean;
  damaged: boolean;
  unpowered: boolean;
  tempState: 'cold' | 'optimal' | 'hot' | 'critical';
  pressureState: 'nominal' | 'low' | 'vacuum';
  stressState: 'nominal' | 'warning' | 'critical';
  valveClosed?: boolean;
}

export interface StationState {
  name: string;
  orbitAltitudeKm: number;
  dayNightPhase: 'sun' | 'eclipse';
  eclipseTimer: number; // seconds remaining in current sun/eclipse phase
  modules: StationPlacedModule[];
  solarOutputKw: number;
  powerLoadKw: number;
  batteryChargeKwh: number;
  batteryMaxKwh: number;
  o2LevelKg: number;
  co2ScrubbedPercent: number;
  potableWaterL: number;
  foodKg: number;
  hypergolicFuelL: number;
  monopropellantL: number;
  researchPoints: number;
  repairKits: number;
  activeOverlay: StationOverlayView;
  crewCount: number;
  structuralIntegrityPercent: number;
  // Mining & Smelting orbital stockpile
  oreKg: number;
  refinedOreKg: number;
  ingotsKg: number;
  // Section 3.3 & 6: Living Space Station life support wiring & automation
  automatedLifeSupport: boolean;
  lifeSupportWired: boolean;
}

/* ==========================================================================
   ASTRONET HQ INDUSTRY CONTRACTS & SECONDARY ECONOMY
   ========================================================================== */
export type ResourceEconomyType = 'raw_ore' | 'refined_ore' | 'ingot' | 'hydrolox_depot';

export interface AstronetContract {
  id: string;
  title: string;
  description: string;
  targetLocation: string; // e.g. 'Moon', 'Mars', 'LEO Orbit', 'Asteroid'
  resourceType: ResourceEconomyType;
  requiredAmountKg: number;
  currentAmountKg: number;
  rewardCredits: number;
  bonusCredits?: number;
  completed: boolean;
  accepted: boolean;
  flavorQuote?: string;
}

export interface AstronetEconomyState {
  credits: number; // Astronet currency
  rawOreStockpileKg: number;
  refinedOreStockpileKg: number;
  ingotStockpileKg: number;
  activeContracts: AstronetContract[];
  constructionDiscountPercent: number; // 0 to 50% discount based on ingots
  totalMinedLifetimeKg: number;
  totalSmeltedLifetimeKg: number;
  contractsCompletedCount: number;
}

export interface UserControls {
  steerLeft: boolean;
  steerRight: boolean;
  stagePressed: boolean;
  translateLeft?: boolean;
  translateRight?: boolean;
  translateUp?: boolean;
  translateDown?: boolean;
}


