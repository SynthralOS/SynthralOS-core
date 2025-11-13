import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useUser, useAuth as useClerkAuth } from '@clerk/clerk-react';
import api, { setTokenGetter } from '../lib/api';

interface User {
  id: string;
  email: string;
  name?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  syncUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const { signOut, getToken } = useClerkAuth();
  const [dbUser, setDbUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Sync Clerk user with our database
  const syncUser = async () => {
    if (!clerkUser) {
      setDbUser(null);
      setLoading(false);
      return;
    }

    try {
      const token = await getToken();
      if (!token) {
        setDbUser(null);
        setLoading(false);
        return;
      }

      // Sync user with backend
      const email = clerkUser.emailAddresses[0]?.emailAddress || '';
      const name = clerkUser.firstName || clerkUser.username || undefined;

      await api.post('/auth/sync', {
        clerkUserId: clerkUser.id,
        email,
        name,
      });

      // Get user from backend
      const response = await api.get('/auth/me');
      setDbUser(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error syncing user:', error);
      setLoading(false);
      throw error;
    }
  };

  useEffect(() => {
    // Set up token getter for API client
    setTokenGetter(async () => {
      try {
        return await getToken();
      } catch {
        return null;
      }
    });

    if (clerkLoaded) {
      syncUser().catch((error) => {
        console.error('Failed to sync user:', error);
      });
    }
  }, [clerkUser, clerkLoaded, getToken]);

  const logout = async () => {
    try {
      await signOut();
      setDbUser(null);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const user = dbUser;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading: loading || !clerkLoaded,
        logout,
        isAuthenticated: !!clerkUser,
        syncUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
