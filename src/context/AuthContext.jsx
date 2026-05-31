import React, { createContext, useContext, useCallback, useMemo } from "react";
import { useUI } from "./UIContext";
import { useSession, signIn, signUp, signOut } from "../lib/auth-client";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const { showToast } = useUI();
  const { data, isPending } = useSession();

  const user = useMemo(() => {
    if (!data?.user) return null;
    return {
      ...data.user,
      initials: data.user.name
        ? data.user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
        : "US"
    };
  }, [data?.user]);

  const loading = isPending;

  const login = useCallback(async (email, password) => {
    const { error } = await signIn.email({ email, password });
    if (error) {
      showToast(error.message || "Invalid email or password.", "error");
      return { success: false, error: error.message };
    }
    showToast(`Welcome back!`, "success");
    return { success: true };
  }, [showToast]);

  const loginWithGoogle = useCallback(async () => {
    const { error } = await signIn.social({
      provider: "google"
    });
    if (error) {
      showToast(error.message || "Failed to sign in with Google.", "error");
      return { success: false, error: error.message };
    }
    return { success: true };
  }, [showToast]);

  const signupUser = useCallback(async (name, email, password) => {
    const { error } = await signUp.email({ name, email, password });
    if (error) {
      showToast(error.message || "Failed to register account.", "error");
      return { success: false, error: error.message };
    }
    showToast(`Welcome aboard, ${name}! Your account was created successfully.`, "success");
    return { success: true };
  }, [showToast]);

  const logout = useCallback(async () => {
    await signOut();
    showToast("You have been signed out successfully.", "info");
  }, [showToast]);

  const value = {
    user,
    loading,
    login,
    loginWithGoogle,
    signup: signupUser,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
