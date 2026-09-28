/**
 * Workout Store for managing weekly workout splits, exercises, and daily weight/rep logging.
 */

export interface ExerciseSet {
  setNumber: number;
  weightKg: number;
  reps: number;
  completed: boolean;
}

export interface ExerciseLog {
  id: string;
  name: string;
  muscleGroup: string;
  sets: ExerciseSet[];
}

export interface DaySplit {
  dayName: 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
  focus: string; // e.g. 'Chest & Triceps', 'Rest Day', 'Back & Biceps', 'Shoulders', 'Legs'
  isRestDay: boolean;
  defaultExercises: { name: string; muscleGroup: string; targetSets: number; defaultReps: number }[];
}

export interface WorkoutLogEntry {
  id: string;
  date: string; // YYYY-MM-DD
  dayName: string;
  focus: string;
  exercises: ExerciseLog[];
  totalVolumeKg: number;
  completedAt: string;
}

export const DEFAULT_WEEKLY_SPLIT: DaySplit[] = [
  {
    dayName: 'Sunday',
    focus: 'Chest & Triceps',
    isRestDay: false,
    defaultExercises: [
      { name: 'Barbell Bench Press', muscleGroup: 'Chest', targetSets: 4, defaultReps: 8 },
      { name: 'Incline Dumbbell Press', muscleGroup: 'Upper Chest', targetSets: 3, defaultReps: 10 },
      { name: 'Cable Chest Flyes', muscleGroup: 'Chest', targetSets: 3, defaultReps: 12 },
      { name: 'Rope Tricep Pushdowns', muscleGroup: 'Triceps', targetSets: 4, defaultReps: 12 },
      { name: 'Overhead Tricep Extension', muscleGroup: 'Triceps', targetSets: 3, defaultReps: 10 },
    ],
  },
  {
    dayName: 'Monday',
    focus: 'Rest Day (Active Recovery)',
    isRestDay: true,
    defaultExercises: [],
  },
  {
    dayName: 'Tuesday',
    focus: 'Back & Biceps',
    isRestDay: false,
    defaultExercises: [
      { name: 'Barbell Deadlifts / Rows', muscleGroup: 'Back', targetSets: 4, defaultReps: 6 },
      { name: 'Lat Pulldowns', muscleGroup: 'Lats', targetSets: 4, defaultReps: 10 },
      { name: 'Seated Cable Rows', muscleGroup: 'Mid-Back', targetSets: 3, defaultReps: 12 },
      { name: 'Standing Barbell Bicep Curls', muscleGroup: 'Biceps', targetSets: 4, defaultReps: 10 },
      { name: 'Incline Dumbbell Hammer Curls', muscleGroup: 'Brachialis', targetSets: 3, defaultReps: 12 },
    ],
  },
  {
    dayName: 'Wednesday',
    focus: 'Shoulders & Core',
    isRestDay: false,
    defaultExercises: [
      { name: 'Overhead Military Press', muscleGroup: 'Shoulders', targetSets: 4, defaultReps: 8 },
      { name: 'Dumbbell Lateral Raises', muscleGroup: 'Side Delts', targetSets: 4, defaultReps: 15 },
      { name: 'Reverse Cable Flyes', muscleGroup: 'Rear Delts', targetSets: 3, defaultReps: 15 },
      { name: 'Hanging Leg Raises', muscleGroup: 'Abs', targetSets: 3, defaultReps: 15 },
    ],
  },
  {
    dayName: 'Thursday',
    focus: 'Chest & Triceps',
    isRestDay: false,
    defaultExercises: [
      { name: 'Incline Barbell Bench Press', muscleGroup: 'Chest', targetSets: 4, defaultReps: 8 },
      { name: 'Dumbbell Chest Dips / Press', muscleGroup: 'Lower Chest', targetSets: 3, defaultReps: 10 },
      { name: 'Pec Deck Flyes', muscleGroup: 'Chest', targetSets: 3, defaultReps: 12 },
      { name: 'Skullcrushers (EZ Bar)', muscleGroup: 'Triceps', targetSets: 4, defaultReps: 10 },
      { name: 'Single Arm Cable Kickbacks', muscleGroup: 'Triceps', targetSets: 3, defaultReps: 12 },
    ],
  },
  {
    dayName: 'Friday',
    focus: 'Back & Biceps',
    isRestDay: false,
    defaultExercises: [
      { name: 'Pull-Ups / Wide Lat Pulldowns', muscleGroup: 'Lats', targetSets: 4, defaultReps: 8 },
      { name: 'Single Arm Dumbbell Rows', muscleGroup: 'Back', targetSets: 3, defaultReps: 10 },
      { name: 'Face Pulls', muscleGroup: 'Upper Back', targetSets: 4, defaultReps: 15 },
      { name: 'Preacher Bicep Curls', muscleGroup: 'Biceps', targetSets: 4, defaultReps: 10 },
      { name: 'Cable Rope Bicep Curls', muscleGroup: 'Biceps', targetSets: 3, defaultReps: 12 },
    ],
  },
  {
    dayName: 'Saturday',
    focus: 'Legs & Calves',
    isRestDay: false,
    defaultExercises: [
      { name: 'Barbell Back Squats', muscleGroup: 'Quadriceps', targetSets: 4, defaultReps: 8 },
      { name: 'Romanian Deadlifts', muscleGroup: 'Hamstrings', targetSets: 4, defaultReps: 10 },
      { name: 'Leg Press', muscleGroup: 'Quads / Glutes', targetSets: 3, defaultReps: 12 },
      { name: 'Leg Extensions', muscleGroup: 'Quads', targetSets: 3, defaultReps: 15 },
      { name: 'Standing Calf Raises', muscleGroup: 'Calves', targetSets: 4, defaultReps: 15 },
    ],
  },
];

const STORAGE_KEY_SPLITS = 'solo_workout_splits_v1';
const STORAGE_KEY_LOGS = 'solo_workout_logs_v1';

export function getStoredWeeklySplit(): DaySplit[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SPLITS);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  return DEFAULT_WEEKLY_SPLIT;
}

export function saveStoredWeeklySplit(splits: DaySplit[]) {
  try {
    localStorage.setItem(STORAGE_KEY_SPLITS, JSON.stringify(splits));
  } catch {
    // fallback
  }
}

export function getStoredWorkoutLogs(): WorkoutLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LOGS);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  return [];
}

export function saveWorkoutLogEntry(entry: WorkoutLogEntry) {
  try {
    const existing = getStoredWorkoutLogs();
    const updated = [entry, ...existing.filter((e) => e.date !== entry.date)];
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(updated));
  } catch {
    // fallback
  }
}
