export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface UserState {
  name: string;
  username?: string;
  isOnboarded: boolean;
}

export interface UserProfile {
  username: string;
  passwordHash: string; // Simple hash/string for local demo
  name: string;
  createdAt: number;
}

export interface StoredData {
  profile: UserProfile;
  history: Message[];
}

export type Mood = 'Confused' | 'Angry' | 'Sad' | 'Grateful' | 'Anxious';

export interface AppConfig {
  voiceEnabled: boolean;
  sanskritEnabled: boolean;
  isMeditating: boolean;
}