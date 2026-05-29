import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useUI } from "./UIContext";

const AuthContext = createContext();

// Pre-seeded accounts to make direct trial easy and fast
const DEFAULT_ACCOUNTS = [
  {
    name: "Admin Boss",
    email: "admin@imageboss.com",
    password: "password123",
  }
];

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useUI();

  // Initialize Auth state from localStorage
  useEffect(() => {
    // 1. Ensure user accounts list is initialized in localStorage
    const existingUsers = localStorage.getItem("ib_users");
    if (!existingUsers) {
      localStorage.setItem("ib_users", JSON.stringify(DEFAULT_ACCOUNTS));
    }

    // 2. Fetch logged in session if exists
    const activeSession = localStorage.getItem("ib_active_user");
    if (activeSession) {
      try {
        setUser(JSON.parse(activeSession));
      } catch (err) {
        localStorage.removeItem("ib_active_user");
      }
    }
    setLoading(false);
  }, []);

  // Standard interactive Log In action
  const login = useCallback((email, password) => {
    setLoading(true);
    try {
      const usersStr = localStorage.getItem("ib_users") || JSON.stringify(DEFAULT_ACCOUNTS);
      const users = JSON.parse(usersStr);

      const foundUser = users.find(
        (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
      );

      if (foundUser) {
        const sessionUser = {
          name: foundUser.name,
          email: foundUser.email,
          initials: foundUser.name
            ? foundUser.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
            : "US",
        };

        localStorage.setItem("ib_active_user", JSON.stringify(sessionUser));
        setUser(sessionUser);
        showToast(`Welcome back, ${sessionUser.name}!`, "success");
        setLoading(false);
        return { success: true };
      } else {
        showToast("Invalid email or password. Please try again.", "error");
        setLoading(false);
        return { success: false, error: "Invalid email or password" };
      }
    } catch (err) {
      showToast("Authentication failed due to system error.", "error");
      setLoading(false);
      return { success: false, error: "Authentication system error" };
    }
  }, [showToast]);

  // Standard interactive Sign Up registration action
  const signup = useCallback((name, email, password) => {
    setLoading(true);
    try {
      const usersStr = localStorage.getItem("ib_users") || JSON.stringify(DEFAULT_ACCOUNTS);
      const users = JSON.parse(usersStr);

      const alreadyExists = users.some((u) => u.email.toLowerCase() === email.toLowerCase());
      if (alreadyExists) {
        showToast("An account with this email already exists.", "error");
        setLoading(false);
        return { success: false, error: "Email already registered" };
      }

      // Add new profile registry
      const newUser = { name, email, password };
      users.push(newUser);
      localStorage.setItem("ib_users", JSON.stringify(users));

      // Auto login user after registration
      const sessionUser = {
        name,
        email,
        initials: name
          ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
          : "US",
      };
      localStorage.setItem("ib_active_user", JSON.stringify(sessionUser));
      setUser(sessionUser);

      showToast(`Welcome aboard, ${name}! Your account was created successfully.`, "success");
      setLoading(false);
      return { success: true };
    } catch (err) {
      showToast("Registration failed due to a system error.", "error");
      setLoading(false);
      return { success: false, error: "Registration system error" };
    }
  }, [showToast]);

  // Standard logout action
  const logout = useCallback(() => {
    localStorage.removeItem("ib_active_user");
    setUser(null);
    showToast("You have been signed out successfully.", "info");
  }, [showToast]);

  const value = {
    user,
    loading,
    login,
    signup,
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
