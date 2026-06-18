/*
 * Handles login, signup, social authentication, and logout state management.
 */
import { create } from "zustand";
import { signIn, signUp, signOut } from "./client";
import { useUIStore } from "../store/uiStore";

const toast = (msg, type) => useUIStore.getState().showToast(msg, type);


export const useAuthStore = create(() => ({
  
  login: async (email, password) => {
    const { error } = await signIn.email({ email, password });
    if (error) {
      toast(error.message || "Invalid email or password.", "error");
      return { success: false, error: error.message };
    }
    toast(`Welcome back!`, "success");
    return { success: true };
  },

  
  loginWithGoogle: async () => {
    const { error } = await signIn.social({
      provider: "google",
    });
    if (error) {
      toast(error.message || "Failed to sign in with Google.", "error");
      return { success: false, error: error.message };
    }
    return { success: true };
  },

  signup: async (name, email, password) => {
    const { error } = await signUp.email({ name, email, password });
    if (error) {
      toast(error.message || "Failed to register account.", "error");
      return { success: false, error: error.message };
    }
    toast(
      `Welcome aboard, ${name}! Your account was created successfully.`,
      "success",
    );
    return { success: true };
  },

  
  logout: async () => {
    await signOut();
    toast("You have been signed out successfully.", "info");
  },
}));
