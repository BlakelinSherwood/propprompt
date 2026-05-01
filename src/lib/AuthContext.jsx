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

      // Admins and known agent roles always have full access — no subscription check needed
      const privilegedRoles = ['admin', 'platform_owner', 'agent', 'team_agent', 'team_lead', 'brokerage_admin', 'team_admin', 'brokerage_owner', 'individual_agent', 'assistant'];
      if (privilegedRoles.includes(currentUser.role)) {
        setHasActiveSubscription(true);
        setIsLoadingAuth(false);
        return;
      }

      // Regular users: check for their own active territory subscription,
      // OR if they belong to an org that has active subscriptions (inherited access)
      try {
        const subs = await base44.entities.TerritorySubscription.filter({
          user_id: currentUser.id,
          status: 'active',
        });
        if (subs && subs.length > 0) {
          setHasActiveSubscription(true);
        } else if (currentUser.org_id) {
          // Check if any active subscription exists in their org (inherited team access)
          const orgMembers = await base44.entities.User.filter({ org_id: currentUser.org_id });
          const orgUserIds = orgMembers.map(m => m.id);
          let orgHasSub = false;
          for (const uid of orgUserIds) {
            const orgSubs = await base44.entities.TerritorySubscription.filter({ user_id: uid, status: 'active' });
            if (orgSubs && orgSubs.length > 0) { orgHasSub = true; break; }
          }
          setHasActiveSubscription(orgHasSub);
        } else {
          setHasActiveSubscription(false);
        }
      } catch {
        // Subscription check failed — don't log the user out, just assume no sub
        setHasActiveSubscription(false);
      }
    } catch (error) {
      // user_not_registered is a special platform error
      if (error?.data?.extra_data?.reason === 'user_not_registered') {
        setAuthError({ type: 'user_not_registered' });
      }
      // All other errors mean not logged in — fine for a public app
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