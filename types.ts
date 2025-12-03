export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface UserState {
  name: string;
  isOnboarded: boolean;
}

export type Mood = 'Confused' | 'Angry' | 'Sad' | 'Grateful' | 'Anxious';

export interface AppConfig {
  voiceEnabled: boolean;
  sanskritEnabled: boolean;
  isMeditating: boolean;
}
