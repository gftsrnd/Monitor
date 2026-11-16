import { version as packageJsonVersion } from '@tianji/shared';

export const isDev = import.meta.env.MODE === 'development';
export const version = import.meta.env.VITE_VERSION || packageJsonVersion;

export const anonymousTelemetryUrl = '';
