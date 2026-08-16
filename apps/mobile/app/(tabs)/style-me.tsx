import { useState, useRef, useEffect } from "react";
import { View, Text, TextInput, FlatList, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, radius, spacing } from "../../constants/theme";
import { useAppStore } from "../../lib/store";
import { useWeather } from "../../lib/useWeather";
import { buildStyleCandidates, parseOutfitId } from "../../lib/recommendationEngine";
import { callFunction, EdgeFunctionError } from "../../lib/supabaseClient";
import { TripType } from "../../constants/mockData";
import { geocodeDestination, fetchForecastRange } from "../../lib/weather";
import { generatePackingList } from "../../lib/packingEngine";
import ChatBubble from "../../components/ChatBubble";
import SuggestedPromptChip from "../../components/SuggestedPromptChip";

interface StyleResult {
  intent?: "styling" | "packing";
  needsClarification: boolean;
  clarifyingQuestion?: string;
  // styling
  chosen_outfit_id?: string;
  rationale?: string;
  // packing extraction
  destination?: string;
  startDate?: string;
  endDate?: string;
  tripType?: TripType;
}

const SUGGESTIONS = ["Smart casual dinner", "Rainy day outfit", "Professional interview", "Weekend brunch look"];
const STYLE_ME_TIMEOUT_MS = 30_000;

function createRequestId(): string {
  const randomUuid = globalThis.crypto?.randomUUID;
  if (randomUuid) return randomUuid.call(globalThis.crypto);
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    return (char === "x" ? value : (value & 0x3) | 0x8).toString(16);
  });
}

async function withDeadline<T>(promise: Promise<T>, label: string, controller: AbortController | null): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller?.abort();
          reject(new EdgeFunctionError(`${label} timed out`, 408, "STYLE_TIMEOUT"));
        }, STYLE_ME_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function styleErrorCode(error: unknown): string {
  if (error instanceof EdgeFunctionError) return error.code ?? `HTTP_${error.status}`;
  if (error instanceof Error && error.name === "AbortError") return "STYLE_ABORTED";
  return "STYLE_TRANSPORT_FAILED";
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function serviceFailureMessage(error: unknown, stage: "session" | "stylist" | "travel"): string {
  if (error instanceof EdgeFunctionError) {
    if (error.code === "STYLE_RATE_LIMITED" || error.status === 429) {
      return "Style Me is temporarily rate limited (STYLE_RATE_LIMITED). Please try again in a moment.";
    }

    const code = error.code ?? `HTTP_${error.status}`;
    return `Style Me is temporarily unavailable (${code}). Please try again shortly.`;
  }

  if (stage === "travel") {
    return "I couldn't complete the location or forecast lookup for this trip. Please try again shortly.";
  }

  if (stage === "session") {
    return "I couldn't start this chat right now. Please try again.";
  }

  return "I couldn't reach Style Me right now. Please try again.";
}

export default function StyleMeScreen() {
  const insets = useSafeAreaInsets();
  const { items, feedback, profile, sessions, createSession, createPendingTurn, completeTurn, failTurn, retryTurn } = useAppStore();
  const { weather, weatherAvailable } = useWeather();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);
  const sendInFlightRef = useRef(false);
  const requestAbortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const scrollIntentRef = useRef<"none" | "end" | "assistant-start">("none");
  const isNearBottomRef = useRef(true);
  const [expandedPackingMessageIds, setExpandedPackingMessageIds] = useState<Record<string, boolean>>({});

  useEffect(() => () => {
    mountedRef.current = false;
    requestAbortRef.current?.abort();
  }, []);

  const activeSession = sessions.find((s) => s.session_id === activeSessionId);
  const messages = activeSession?.messages ?? [];

  async function handleSend(promptText: string, retry?: { clientRequestId: string; promptId: string }) {
    const text = promptText.trim();
    if (!text || sendInFlightRef.current) return;

    let sessionId = activeSessionId;
    let promptId = retry?.promptId;
    const clientRequestId = retry?.clientRequestId ?? createRequestId();
    sendInFlightRef.current = true;
    // A new user message is an intentional request to follow the thread.
    scrollIntentRef.current = "end";
    setLoading(true);
    setSendError(null);
    // A submitted prompt belongs to its persisted turn. Never repopulate it
    // after a failure; Retry and Edit are explicit user actions.
    if (!retry) setInput("");
    let stage: "session" | "stylist" | "travel" = "session";

    try {
      if (!sessionId) {
        sessionId = await createSession(text.slice(0, 40));
        setActiveSessionId(sessionId);
      }
      if (!retry) {
        const pending = await createPendingTurn(sessionId, text, clientRequestId);
        promptId = pending.promptId;
      }
      if (!promptId) throw new Error("Missing persisted Style Me turn");

      const candidates = buildStyleCandidates(items, weather, feedback);
      if (candidates.length === 0) {
        const content = "I couldn't find enough wardrobe items for that yet — try adding a few more pieces first.";
        scrollIntentRef.current = "assistant-start";
        await completeTurn(sessionId, promptId, clientRequestId, { content }, null);
        return;
      }

      // The prompt is sent separately, so history contains only prior turns.
      // It is chronological, text-only, and deliberately bounded for privacy
      // and predictable Edge Function payload size.
      const history = messages.slice(-10).map(({ role, content }) => ({ role, content }));

      stage = "stylist";
      requestAbortRef.current = new AbortController();
      const result = await withDeadline(callFunction<StyleResult>("style-me", {
        prompt: text,
        // Never describe fallback values as current conditions. The backend
        // accepts omitted weather and labels its response accordingly.
        weather: weatherAvailable
          ? { temperature_c: weather.temperature_c, condition_text: weather.condition_text }
          : undefined,
        profile: { preferred_style: profile.preferred_style, climate_sensitivity: profile.climate_sensitivity },
        candidates,
        history,
      }, { signal: requestAbortRef.current.signal }), "Style Me", requestAbortRef.current);
      if (!mountedRef.current) return;
      const parsedResult = result as unknown as Record<string, unknown>;

      // --- PACKING INTENT ---
      if (result.intent === "packing") {
        if (result.needsClarification === true) {
          if (!hasText(result.clarifyingQuestion)) {
            throw new EdgeFunctionError("Style Me returned an incomplete clarification", 502, "STYLE_RESPONSE_INVALID");
          }
          const content = result.clarifyingQuestion;
          scrollIntentRef.current = "assistant-start";
          await completeTurn(sessionId, promptId, clientRequestId, { content }, parsedResult);
          return;
        }

        if (!hasText(result.destination) || !hasText(result.startDate) || !hasText(result.endDate)) {
          throw new EdgeFunctionError("Style Me returned incomplete trip details", 502, "STYLE_RESPONSE_INVALID");
        }

        // Geocoding and forecast errors use the same guarded path, so the
        // input stays available for retry and the loading state cannot stick.
        stage = "travel";
        const geo = await withDeadline(geocodeDestination(result.destination), "Location lookup", requestAbortRef.current);
        if (!mountedRef.current) return;
        if (!geo) {
          const content = `I couldn't find "${result.destination}" — could you try a more specific city name?`;
          scrollIntentRef.current = "assistant-start";
          await completeTurn(sessionId, promptId, clientRequestId, { content }, parsedResult);
          return;
        }

        const tripWeather = await withDeadline(fetchForecastRange(geo.lat, geo.lon, result.startDate, result.endDate), "Forecast lookup", requestAbortRef.current);
        if (!mountedRef.current) return;
        const tripType: TripType = result.tripType === "business" || result.tripType === "beach" ? result.tripType : "casual";
        const packingList = generatePackingList(items, tripWeather, tripType, feedback, geo.label);
        const content = `Here's your packing list for ${geo.label}!`;
        scrollIntentRef.current = "assistant-start";
        await completeTurn(sessionId, promptId, clientRequestId, { content, packing: packingList }, parsedResult);
        return;
      }

      // --- STYLING INTENT ---
      if (result.needsClarification === true) {
        if (!hasText(result.clarifyingQuestion)) {
          throw new EdgeFunctionError("Style Me returned an incomplete clarification", 502, "STYLE_RESPONSE_INVALID");
        }
        const content = result.clarifyingQuestion;
        scrollIntentRef.current = "assistant-start";
        await completeTurn(sessionId, promptId, clientRequestId, { content }, parsedResult);
        return;
      }

      if (!hasText(result.chosen_outfit_id) || !candidates.some((candidate) => candidate.outfit_id === result.chosen_outfit_id)) {
        throw new EdgeFunctionError("Style Me returned an invalid outfit", 502, "STYLE_RESPONSE_INVALID");
      }

      const content = hasText(result.rationale) ? result.rationale : "Here's a look from your wardrobe that fits.";
      scrollIntentRef.current = "assistant-start";
      await completeTurn(sessionId, promptId, clientRequestId, { content, outfit_id: result.chosen_outfit_id }, parsedResult);
    } catch (error) {
      if (sessionId && promptId) {
        const code = styleErrorCode(error);
        try { await failTurn(sessionId, clientRequestId, code); } catch { /* preserve UI state if persistence is offline */ }
      } else {
        setSendError(serviceFailureMessage(error, stage));
      }
    } finally {
      requestAbortRef.current = null;
      sendInFlightRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={insets.top}>
      <View style={[styles.screen, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Style Me</Text>
            <Text style={styles.subtitle}>AI personal stylist</Text>
          </View>
          {sessions.length > 0 && (
            <Pressable
              style={styles.historyBtn}
              onPress={() => router.push(`/style-session/${sessions[0].session_id}`)}
              accessibilityRole="button"
              accessibilityLabel="View chat history"
            >
              <Ionicons name="time-outline" size={20} color={colors.ink700} />
            </Pressable>
          )}
        </View>

        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            {SUGGESTIONS.map((s) => (
              <SuggestedPromptChip key={s} label={s} onPress={() => handleSend(s)} />
            ))}
            <View style={styles.introBubble}>
              <View style={styles.introAvatar}>
                <Ionicons name="sparkles" size={14} color={colors.white} />
              </View>
              <Text style={styles.introText}>
                Hi! I'm your personal stylist. Tell me where you're going or what style you want and I'll suggest an outfit.
              </Text>
            </View>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: spacing.lg }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            onScroll={({ nativeEvent }) => {
              const distanceFromBottom = nativeEvent.contentSize.height - nativeEvent.layoutMeasurement.height - nativeEvent.contentOffset.y;
              isNearBottomRef.current = distanceFromBottom < 72;
            }}
            scrollEventThrottle={16}
            renderItem={({ item }) => {
              const outfitIds = item.outfit_id ? parseOutfitId(item.outfit_id) : undefined;
              const canRecover = item.role === "user" && item.delivery_status === "failed" && item.client_request_id;
              return (
                <View>
                  <ChatBubble
                    message={item}
                    outfitItemIds={outfitIds}
                    items={items}
                    packingExpanded={expandedPackingMessageIds[item.id]}
                    onPackingExpansionChange={(messageId, expanded) =>
                      setExpandedPackingMessageIds((current) => ({ ...current, [messageId]: expanded }))
                    }
                  />
                  {canRecover && (
                    <View style={styles.turnRecovery}>
                      <Text style={styles.turnError}>Couldn’t send ({item.error_code ?? "STYLE_TRANSPORT_FAILED"}).</Text>
                      <Pressable onPress={async () => {
                        const promptId = item.id.replace(/-u$/, "");
                        await retryTurn(activeSessionId!, item.client_request_id!);
                        handleSend(item.content, { clientRequestId: item.client_request_id!, promptId });
                      }} accessibilityRole="button" accessibilityLabel="Retry message"><Text style={styles.turnAction}>Retry</Text></Pressable>
                      <Pressable onPress={() => setInput(item.content)} accessibilityRole="button" accessibilityLabel="Edit message"><Text style={styles.turnAction}>Edit</Text></Pressable>
                    </View>
                  )}
                </View>
              );
            }}
            onContentSizeChange={() => {
              const intent = scrollIntentRef.current;
              if (intent === "end") {
                listRef.current?.scrollToEnd({ animated: true });
              } else if (intent === "assistant-start" && isNearBottomRef.current) {
                const assistantIndex = messages.length - 1;
                if (assistantIndex >= 0) {
                  listRef.current?.scrollToIndex({ index: assistantIndex, animated: true, viewPosition: 0 });
                }
              }
              // Image loads and packing expansion trigger size changes too;
              // without a new-message intent they preserve the reader's place.
              scrollIntentRef.current = "none";
            }}
          />
        )}

        {sendError && <Text style={styles.errorText}>{sendError}</Text>}

        <View style={[styles.inputRow, { paddingBottom: insets.bottom + spacing.sm }]}>
          <TextInput
            style={styles.input}
            placeholder="Describe your outfit needs..."
            placeholderTextColor={colors.ink300}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => handleSend(input)}
            editable={!loading}
          />
          <Pressable
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={() => handleSend(input)}
            disabled={!input.trim() || loading}
            accessibilityRole="button"
            accessibilityLabel="Send prompt"
          >
            <Ionicons name="send" size={18} color={colors.white} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.blush50 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.ink100 },
  title: { fontFamily: fonts.displayBold, fontSize: 22, color: colors.ink900 },
  subtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.ink500, marginTop: 2 },
  historyBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  emptyState: { padding: spacing.lg },
  introBubble: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, alignItems: "flex-start" },
  introAvatar: { width: 28, height: 28, borderRadius: radius.pill, backgroundColor: colors.ai600, alignItems: "center", justifyContent: "center" },
  introText: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.ink700, backgroundColor: colors.white, padding: spacing.md, borderRadius: radius.lg, borderTopLeftRadius: 4, lineHeight: 20 },
  errorText: { fontFamily: fonts.body, fontSize: 13, color: colors.coral600, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, lineHeight: 18 },
  turnRecovery: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: -spacing.sm, marginBottom: spacing.md, marginLeft: 36 },
  turnError: { flex: 1, fontFamily: fonts.body, fontSize: 12, color: colors.coral600 },
  turnAction: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ai600 },
  inputRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.ink100, backgroundColor: colors.blush50 },
  input: { flex: 1, backgroundColor: colors.white, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 4, fontFamily: fonts.body, fontSize: 14, color: colors.ink900 },
  sendBtn: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.coral600, alignItems: "center", justifyContent: "center" },
  sendBtnDisabled: { opacity: 0.4 },
});
