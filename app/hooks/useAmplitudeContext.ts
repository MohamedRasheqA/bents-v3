"use client";
import { useContext } from "react";
import { AmplitudeContext } from "../context/AmplitudeContext";

export const useAmplitudeContext = () => {
  const context = useContext(AmplitudeContext);
  if (context === undefined) {
    throw new Error("useAmplitudeContext must be used within an AmplitudeProvider");
  }
  return context;
};