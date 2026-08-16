import { AppState, type AppStateStatus } from "react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { WeatherSnapshot } from "../constants/mockData";
import { fetchDeviceWeather, FALLBACK_WEATHER } from "./weather";

interface UseWeatherState {
  weather: WeatherSnapshot;
  loading: boolean;
  permissionDenied: boolean;
  canAskAgain: boolean;
  weatherAvailable: boolean;
  error: string | null;
}

export function useWeather() {
  const [state, setState] = useState<UseWeatherState>({
    weather: FALLBACK_WEATHER,
    loading: false,
    permissionDenied: true,
    canAskAgain: true,
    weatherAvailable: false,
    error: null,
  });

  const load = useCallback(async (requestPermission = false) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    const result = await fetchDeviceWeather(requestPermission);
    setState({
      weather: result.weather,
      loading: false,
      permissionDenied: result.status === "permission_denied",
      canAskAgain: result.status === "permission_denied" ? result.canAskAgain : true,
      weatherAvailable: result.status === "ok",
      error: result.status === "error" ? result.message : null,
    });
  }, []);

  useEffect(() => {
    // Inspect existing access without prompting. A first permission request
    // only occurs after the user taps Enable Location.
    load(false);
  }, [load]);

  const appState = useRef<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const returnedFromSettings = /inactive|background/.test(appState.current) && nextState === "active";
      appState.current = nextState;
      if (returnedFromSettings) load(false);
    });
    return () => subscription.remove();
  }, [load]);

  return { ...state, enableLocation: () => load(true), refresh: () => load(false) };
}
