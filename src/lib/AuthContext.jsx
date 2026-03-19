import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);

      // Admins and known agent roles always get subscription access
      const privilegedRoles = ['admin', 'agent', 'team_agent', 'team_lead', 'brokerage_admin'];
      if (privilegedRoles.includes(currentUser.role)) {
        setHasActiveSubscription(true);
      } else {
        const subs = await base44.entities.TerritorySubscription.filter({
          user_id: currentUser.id,
          status: 'active',
        });
        setHasActiveSubscription(subs && subs.length > 0);
      }
    } catch (error) {
      // user_not_registered is a special platform error
      if (error?.data?.extra_data?.reason === 'user_not_registered') {
        setAuthError({ type: 'user_not_registered' });
      }
      // All other errors just mean "not logged in" — fine for a public app
      setIsAuthenticated(false);
      setUser(null);
      setHasActiveSubscription(false);
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const logout = () => base44.auth.logout(window.location.origin + '/Landing');

  const navigateToLogin = () =>
    base44.auth.redirectToLogin(window.location.origin + '/Dashboard');

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        hasActiveSubscription,
        isLoadingAuth,
        isLoadingPublicSettings: false,
        authError,
        appPublicSettings: null,
        logout,
        navigateToLogin,
        checkAppState: checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};