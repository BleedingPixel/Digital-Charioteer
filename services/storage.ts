import { Message, UserProfile, StoredData } from '../types';

const DB_KEY = 'THE_DIGITAL_CHARIOTEER_DB_V1';

interface Database {
  users: { [username: string]: StoredData };
}

// Helper to get full DB
const getDB = (): Database => {
  const data = localStorage.getItem(DB_KEY);
  return data ? JSON.parse(data) : { users: {} };
};

// Helper to save full DB
const saveDB = (db: Database) => {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
};

export const storageService = {
  // Check if username exists
  userExists: (username: string): boolean => {
    const db = getDB();
    return !!db.users[username];
  },

  // Create new user
  signup: (username: string, password: string, name: string): boolean => {
    const db = getDB();
    if (db.users[username]) return false; // User exists

    db.users[username] = {
      profile: {
        username,
        passwordHash: btoa(password), // Simple encoding for demo purposes
        name,
        createdAt: Date.now()
      },
      history: []
    };
    saveDB(db);
    return true;
  },

  // Verify credentials
  login: (username: string, password: string): UserProfile | null => {
    const db = getDB();
    const user = db.users[username];
    
    if (!user) return null;
    
    // Simple check
    if (user.profile.passwordHash === btoa(password)) {
      return user.profile;
    }
    return null;
  },

  // Save chat history
  saveHistory: (username: string, messages: Message[]) => {
    const db = getDB();
    if (db.users[username]) {
      db.users[username].history = messages;
      saveDB(db);
    }
  },

  // Load chat history
  getHistory: (username: string): Message[] => {
    const db = getDB();
    return db.users[username]?.history || [];
  },

  // Get user profile
  getProfile: (username: string): UserProfile | null => {
    const db = getDB();
    return db.users[username]?.profile || null;
  }
};