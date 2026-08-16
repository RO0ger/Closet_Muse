import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";
import { WardrobeItem, FeedbackEntry, FeedbackAction, StyleSession, ChatMessage, UserProfile, Category, Season, PackingList } from "../constants/mockData";
import { supabase, isSupabaseConfigured, callFunction } from "./supabaseClient";
import {
  fetchWardrobe,
  fetchProfile,
  fetchFeedback,
  fetchSessions,
  updateWardrobeItem,
  removeWardrobeItem,
  insertFeedback,
  removeFeedbackRow,
  createStyleSession,
  createPendingStyleTurn,
  completeStyleTurn as completeStyleTurnApi,
  failStyleTurn as failStyleTurnApi,
  retryStyleTurn as retryStyleTurnApi,
  ProfileFields,
} from "./api";
import type { Session } from "@supabase/supabase-js";

// Result shape of the (real or manually-corrected) auto-tag pipeline —
// carried in the in-progress "add item" draft between screens.
export interface AutoTagResult {
  name: string;
  category: Category;
  primary_colour: string;
  formality: 1 | 2 | 3 | 4 | 5;
  season: Season[];
  confidence: number;
}

const DEFAULT_PROFILE: ProfileFields = {
  name: "",
  email: "",
  preferred_style: "Smart casual",
  size_top: "",
  size_bottom: "",
  climate_sensitivity: "medium",
};

interface AppStore {
  // Auth — real Supabase session (see .env.example).
  hasAccount: boolean;
  session: Session | null;
  authLoading: boolean;
  signOut: () => Promise<void>;

  // Profile
  profile: UserProfile;
  updateProfile: (patch: Partial<UserProfile>) => Promise<void>;

  // Wardrobe
  items: WardrobeItem[];
  refreshWardrobe: () => Promise<void>;
  updateItem: (itemId: string, patch: Partial<WardrobeItem>) => void;
  removeItem: (itemId: string) => void;

  // In-progress "add item" draft — carries state between the
  // choose-source → processing → review → success steps without
  // stuffing large objects through URL params.
  draftItem: { uri: string; result: AutoTagResult | null; itemId?: string } | null;
  setDraftItem: (draft: AppStore["draftItem"]) => void;

  // Feedback
  feedback: FeedbackEntry[];
  addFeedback: (outfitId: string, action: FeedbackAction) => Promise<string>; // resolves feedback_id
  removeFeedback: (feedbackId: string) => void;

  // Style Me sessions
  sessions: StyleSession[];
  createSession: (title: string) => Promise<string>; // resolves session_id
  appendMessage: (sessionId: string, message: ChatMessage) => void;
  createPendingTurn: (sessionId: string, promptText: string, clientRequestId: string) => Promise<{ promptId: string; createdAt: string }>;
  completeTurn: (sessionId: string, promptId: string, clientRequestId: string, response: { content: string; outfit_id?: string; packing?: PackingList }, parsedIntent: Record<string, unknown> | null) => Promise<void>;
  failTurn: (sessionId: string, clientRequestId: string, errorCode: string) => Promise<void>;
  retryTurn: (sessionId: string, clientRequestId: string) => Promise<void>;
}

const AppStoreContext = createContext<AppStore | null>(null);

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileBase, setProfileBase] = useState<ProfileFields>(DEFAULT_PROFILE);
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [sessions, setSessions] = useState<StyleSession[]>([]);
  const [draftItem, setDraftItem] = useState<AppStore["draftItem"]>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      // No backend configured — auth screens show a clear notice instead
      // of silently pretending sign-in works (see auth screens).
      setAuthLoading(false);
      return;
    }

    async function bootstrapSession() {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setSession(data.session);
        setAuthLoading(false);
        return;
      }
      setAuthLoading(false);
    }

    bootstrapSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Load (or clear) account data whenever the signed-in user changes —
  // keyed on user id, not the session object, since a token refresh
  // produces a new session reference without changing the user.
  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) {
      setItems([]);
      setProfileBase(DEFAULT_PROFILE);
      setFeedback([]);
      setSessions([]);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const [wardrobe, profileFields, feedbackRows, sessionRows] = await Promise.all([
          fetchWardrobe(),
          fetchProfile(),
          fetchFeedback(),
          fetchSessions(),
        ]);
        if (cancelled) return;
        setItems(wardrobe);
        setProfileBase(profileFields);
        setFeedback(feedbackRows);
        setSessions(sessionRows);
      } catch (err) {
        if (!cancelled) {
          // eslint-disable-next-line no-console
          console.warn("[ClosetMuse] Failed to load account data:", err instanceof Error ? err.message : err);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    setSession(null);
  }, []);

  const updateProfile = useCallback(async (patch: Partial<UserProfile>) => {
    const allowedKeys = ["preferred_style", "size_top", "size_bottom", "climate_sensitivity"] as const;
    const dbPatch: Record<string, unknown> = {};
    for (const key of allowedKeys) {
      if (patch[key] !== undefined) dbPatch[key] = patch[key];
    }
    if (Object.keys(dbPatch).length > 0) {
      await callFunction("create-profile", dbPatch);
    }
    setProfileBase((prev) => ({ ...prev, ...patch }));
  }, []);

  const refreshWardrobe = useCallback(async () => {
    setItems(await fetchWardrobe());
  }, []);

  const updateItem = useCallback((itemId: string, patch: Partial<WardrobeItem>) => {
    setItems((prev) => prev.map((i) => (i.item_id === itemId ? { ...i, ...patch } : i)));
    updateWardrobeItem(itemId, patch).catch((err) =>
      // eslint-disable-next-line no-console
      console.warn("[ClosetMuse] Failed to save item change:", err instanceof Error ? err.message : err),
    );
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setItems((prev) => prev.filter((i) => i.item_id !== itemId));
    removeWardrobeItem(itemId).catch((err) =>
      // eslint-disable-next-line no-console
      console.warn("[ClosetMuse] Failed to delete item:", err instanceof Error ? err.message : err),
    );
  }, []);

  const addFeedback = useCallback(async (outfitId: string, action: FeedbackAction) => {
    const entry = await insertFeedback(outfitId, action);
    setFeedback((prev) => [entry, ...prev]);
    return entry.feedback_id;
  }, []);

  const removeFeedback = useCallback((feedbackId: string) => {
    setFeedback((prev) => prev.filter((f) => f.feedback_id !== feedbackId));
    removeFeedbackRow(feedbackId).catch((err) =>
      // eslint-disable-next-line no-console
      console.warn("[ClosetMuse] Failed to undo feedback:", err instanceof Error ? err.message : err),
    );
  }, []);

  const createSession = useCallback(async (title: string) => {
    const { session_id, created_at } = await createStyleSession(title);
    setSessions((prev) => [{ session_id, title, messages: [], created_at }, ...prev]);
    return session_id;
  }, []);

  const appendMessage = useCallback((sessionId: string, message: ChatMessage) => {
    setSessions((prev) => prev.map((s) => (s.session_id === sessionId ? { ...s, messages: [...s.messages, message] } : s)));
  }, []);

  const createPendingTurn = useCallback(async (sessionId: string, promptText: string, clientRequestId: string) => {
    const row = await createPendingStyleTurn(sessionId, promptText, clientRequestId);
    setSessions((prev) => prev.map((s) => s.session_id !== sessionId ? s : {
      ...s,
      messages: [...s.messages, { id: `${row.prompt_id}-u`, role: "user", content: promptText, created_at: row.created_at, client_request_id: clientRequestId, delivery_status: "pending" }],
    }));
    return { promptId: row.prompt_id, createdAt: row.created_at };
  }, []);

  const completeTurn = useCallback(async (sessionId: string, promptId: string, clientRequestId: string, response: { content: string; outfit_id?: string; packing?: PackingList }, parsedIntent: Record<string, unknown> | null) => {
    await completeStyleTurnApi(clientRequestId, response, parsedIntent);
    const now = new Date().toISOString();
    setSessions((prev) => prev.map((s) => s.session_id !== sessionId ? s : {
      ...s,
      messages: s.messages.flatMap((message) => message.client_request_id !== clientRequestId ? [message] : [{ ...message, delivery_status: "succeeded", error_code: undefined }, { id: `${promptId}-a`, role: "assistant", content: response.content, outfit_id: response.outfit_id, packing: response.packing, created_at: now, client_request_id: clientRequestId, delivery_status: "succeeded" }]),
    }));
  }, []);

  const failTurn = useCallback(async (sessionId: string, clientRequestId: string, errorCode: string) => {
    await failStyleTurnApi(clientRequestId, errorCode);
    setSessions((prev) => prev.map((s) => s.session_id !== sessionId ? s : { ...s, messages: s.messages.map((m) => m.client_request_id === clientRequestId ? { ...m, delivery_status: "failed", error_code: errorCode } : m) }));
  }, []);

  const retryTurn = useCallback(async (sessionId: string, clientRequestId: string) => {
    await retryStyleTurnApi(clientRequestId);
    setSessions((prev) => prev.map((s) => s.session_id !== sessionId ? s : { ...s, messages: s.messages.map((m) => m.client_request_id === clientRequestId ? { ...m, delivery_status: "pending", error_code: undefined } : m) }));
  }, []);

  const profile = useMemo<UserProfile>(() => {
    const worn = feedback.filter((f) => f.action === "worn");
    return {
      ...profileBase,
      itemsCount: items.length,
      outfitsCount: new Set(worn.map((f) => f.outfit_id)).size,
      daysStyled: new Set(worn.map((f) => f.created_at.slice(0, 10))).size,
    };
  }, [profileBase, items, feedback]);

  const value = useMemo<AppStore>(
    () => ({
      hasAccount: Boolean(session),
      session,
      authLoading,
      signOut,
      profile,
      updateProfile,
      items,
      refreshWardrobe,
      updateItem,
      removeItem,
      draftItem,
      setDraftItem,
      feedback,
      addFeedback,
      removeFeedback,
      sessions,
      createSession,
      appendMessage,
      createPendingTurn,
      completeTurn,
      failTurn,
      retryTurn,
    }),
    [
      session,
      authLoading,
      profile,
      items,
      draftItem,
      feedback,
      sessions,
      signOut,
      updateProfile,
      refreshWardrobe,
      updateItem,
      removeItem,
      addFeedback,
      removeFeedback,
      createSession,
      appendMessage,
      createPendingTurn,
      completeTurn,
      failTurn,
      retryTurn,
    ],
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore(): AppStore {
  const ctx = useContext(AppStoreContext);
  if (!ctx) throw new Error("useAppStore must be used within AppStoreProvider");
  return ctx;
}
