import { create } from "zustand";
import { signIn, signUp, signOut } from "../lib/auth-client";
import { useUIStore } from "./uiStore";

export const useAuthStore = create(() => ({
  login: async (email, password) => {
    const showToast = useUIStore.getState().showToast;
    const { error } = await signIn.email({ email, password });
    if (error) {
      showToast(error.message || "Invalid email or password.", "error");
      return { success: false, error: error.message };
    }
    showToast(`Welcome back!`, "success");
    return { success: true };
  },

  loginWithGoogle: async () => {
    const showToast = useUIStore.getState().showToast;
    const { error } = await signIn.social({
      provider: "google",
    });
    if (error) {
      showToast(error.message || "Failed to sign in with Google.", "error");
      return { success: false, error: error.message };
    }
    return { success: true };
  },

  signup: async (name, email, password) => {
    const showToast = useUIStore.getState().showToast;
    const { error } = await signUp.email({ name, email, password });
    if (error) {
      showToast(error.message || "Failed to register account.", "error");
      return { success: false, error: error.message };
    }
    showToast(
      `Welcome aboard, ${name}! Your account was created successfully.`,
      "success",
    );
    return { success: true };
  },

  logout: async () => {
    const showToast = useUIStore.getState().showToast;
    await signOut();
    showToast("You have been signed out successfully.", "info");
  },
}));
