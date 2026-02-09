export interface AvailabilityCell {
  date: Date;
  isAvailable: boolean;
  source?: string;
  reason?: string;
}

export interface CheckAvailabilityResult {
  date: Date;
  isAvailable: boolean;
  source: 'override' | 'range' | 'weekly' | 'default' | 'none';
  reason?: string | null;
}
