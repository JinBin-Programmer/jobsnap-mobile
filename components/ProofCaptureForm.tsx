import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Image, ActivityIndicator, Alert, Linking } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { WORKER_SETTABLE_STATUSES, STATUS_LABELS, type TaskStatus } from "@/lib/types";
import { colors } from "@/lib/theme";
import type { MediaItem } from "@/lib/tasks";

export interface CaptureSubmitPayload {
  remark: string;
  media: MediaItem[];
  status: TaskStatus | null; // mode="task" only
  markDone: boolean; // mode="stop" only
  amountCollected: number | null; // mode="task" only, when moneyKpiEnabled
}

interface ProofCaptureFormProps {
  // "task": today's whole-task flow — status chips, unchanged behavior.
  // "stop": one stop within a multi-stop task — a single delivered toggle
  // instead (a worker can still send just a remark/photo without marking
  // the stop done, e.g. "no answer, will retry").
  mode: "task" | "stop";
  notOnSite: boolean;
  // Org tracks money KPI (supabase/kpi.sql) — shows an optional "Amount
  // collected" field alongside the status chips. mode="task" only.
  moneyKpiEnabled?: boolean;
  onSubmit: (payload: CaptureSubmitPayload) => Promise<void>;
}

// Camera/video/gallery capture, remark, status-or-delivered control, submit.
// Extracted out of app/task/[id].tsx so the same capture flow works both
// for a classic single-location task and for one stop inside a multi-stop
// delivery run.
export default function ProofCaptureForm({ mode, notOnSite, moneyKpiEnabled, onSubmit }: ProofCaptureFormProps) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [remark, setRemark] = useState("");
  const [status, setStatus] = useState<TaskStatus | null>(null);
  const [markDone, setMarkDone] = useState(false);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const addFromCamera = async (kind: "photo" | "video") => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      if (!perm.canAskAgain) {
        // Permanently denied — re-requesting silently returns denied again,
        // the only way out is the OS settings screen.
        Alert.alert(
          "Camera access needed",
          "You've previously denied camera access. Open Settings to turn it on for JobSnap.",
          [
            { text: "Not now", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ]
        );
      } else {
        Alert.alert("Camera needed", "Please allow camera access to capture proof of work.");
      }
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: kind === "video" ? ["videos"] : ["images"],
      quality: 0.6,
      videoMaxDuration: 30,
    });
    addAssets(res);
  };

  const addFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      if (!perm.canAskAgain) {
        Alert.alert(
          "Photo access needed",
          "You've previously denied photo library access. Open Settings to turn it on for JobSnap.",
          [
            { text: "Not now", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ]
        );
      } else {
        Alert.alert("Photo access needed", "Please allow photo access to attach existing photos or videos.");
      }
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.6,
      allowsMultipleSelection: true,
      selectionLimit: 6,
    });
    addAssets(res);
  };

  const addAssets = (res: ImagePicker.ImagePickerResult) => {
    if (res.canceled) return;
    const items: MediaItem[] = res.assets.map((a) => ({
      uri: a.uri,
      type: a.type === "video" ? "video" : "photo",
      fileName: a.fileName ?? undefined,
    }));
    setMedia((prev) => [...prev, ...items]);
  };

  const removeMedia = (uri: string) => setMedia((prev) => prev.filter((m) => m.uri !== uri));

  const handleSubmit = async () => {
    const hasContent = remark.trim() || media.length > 0 || (mode === "task" ? status : markDone);
    if (!hasContent) {
      Alert.alert(
        "Nothing to send",
        mode === "stop"
          ? "Add a photo, a remark, or mark this stop delivered first."
          : "Add a photo, a remark, or set a status first."
      );
      return;
    }
    setSubmitting(true);
    try {
      const parsedAmount = amount.trim() ? Number(amount) : null;
      await onSubmit({
        remark,
        media,
        status: mode === "task" ? status : null,
        markDone: mode === "stop" ? markDone : false,
        amountCollected: mode === "task" && parsedAmount != null && Number.isFinite(parsedAmount) ? parsedAmount : null,
      });
      setMedia([]);
      setRemark("");
      setStatus(null);
      setMarkDone(false);
      setAmount("");
    } catch (e) {
      Alert.alert("Could not send", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View>
      <Text style={sectionTitle}>Add proof</Text>
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
        <CaptureBtn label="Photo" icon="📷" onPress={() => addFromCamera("photo")} />
        <CaptureBtn label="Video" icon="🎥" onPress={() => addFromCamera("video")} />
        <CaptureBtn label="Gallery" icon="🖼" onPress={addFromLibrary} />
      </View>

      {media.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {media.map((m) => (
            <View key={m.uri} style={{ position: "relative" }}>
              <Image source={{ uri: m.uri }} style={{ width: 84, height: 84, borderRadius: 10, backgroundColor: colors.border }} />
              {m.type === "video" && (
                <View style={videoBadge}>
                  <Text style={{ color: "white", fontSize: 10 }}>▶ video</Text>
                </View>
              )}
              <TouchableOpacity onPress={() => removeMedia(m.uri)} style={removeBtn}>
                <Text style={{ color: "white", fontWeight: "700", fontSize: 12 }}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <TextInput
        value={remark}
        onChangeText={setRemark}
        placeholder="Add a remark..."
        placeholderTextColor={colors.muted}
        multiline
        style={{
          backgroundColor: colors.card,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          padding: 12,
          minHeight: 56,
          textAlignVertical: "top",
          color: colors.ink,
          marginBottom: 12,
          fontSize: 13.5,
        }}
      />

      {mode === "task" ? (
        <>
          <Text style={sectionTitle}>Status</Text>
          <View style={{ flexDirection: "row", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
            {WORKER_SETTABLE_STATUSES.map((s) => {
              const active = status === s;
              return (
                <TouchableOpacity
                  key={s}
                  onPress={() => setStatus(active ? null : s)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.inputBorder,
                    backgroundColor: active ? colors.primary : colors.card,
                  }}
                >
                  <Text style={{ color: active ? "#fff" : colors.body, fontWeight: "600", fontSize: 12 }}>
                    {STATUS_LABELS[s]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {moneyKpiEnabled && (
            <>
              <Text style={sectionTitle}>Amount collected (RM)</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="e.g. 25.00"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: colors.inputBorder,
                  padding: 12,
                  color: colors.ink,
                  marginBottom: 6,
                  fontSize: 13.5,
                }}
              />
              <Text style={{ fontSize: 11.5, color: colors.muted, marginBottom: 16 }}>
                Cash or e-wallet payment collected — snap it above as proof.
              </Text>
            </>
          )}
        </>
      ) : (
        <TouchableOpacity
          onPress={() => setMarkDone((v) => !v)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            marginBottom: 16,
            padding: 12,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: markDone ? colors.success : colors.inputBorder,
            backgroundColor: markDone ? colors.successBg : colors.card,
          }}
        >
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 5,
              borderWidth: 2,
              borderColor: markDone ? colors.success : colors.inputBorder,
              backgroundColor: markDone ? colors.success : "transparent",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {markDone && <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>✓</Text>}
          </View>
          <Text style={{ color: markDone ? colors.successFg : colors.body, fontWeight: "700", fontSize: 13.5 }}>
            Mark this stop delivered
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        onPress={handleSubmit}
        disabled={submitting || notOnSite}
        style={{
          backgroundColor: notOnSite ? colors.inputBorder : colors.primary,
          borderRadius: 9,
          paddingVertical: 13,
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        {submitting ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={{ color: "white", fontWeight: "700", fontSize: 14.5 }}>
            {notOnSite ? "Move closer to submit" : mode === "stop" ? "Submit stop proof" : "Submit proof"}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

function CaptureBtn({ label, icon, onPress }: { label: string; icon: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flex: 1,
        backgroundColor: colors.card,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.inputBorder,
        paddingVertical: 16,
        alignItems: "center",
      }}
    >
      <Text style={{ fontSize: 22 }}>{icon}</Text>
      <Text style={{ color: colors.body, marginTop: 4, fontWeight: "600", fontSize: 12.5 }}>{label}</Text>
    </TouchableOpacity>
  );
}

const sectionTitle = {
  fontSize: 12,
  fontWeight: "700",
  color: colors.muted,
  textTransform: "uppercase",
  letterSpacing: 0.3,
  marginBottom: 8,
} as const;

const videoBadge = {
  position: "absolute",
  bottom: 4,
  left: 4,
  backgroundColor: "rgba(0,0,0,0.6)",
  borderRadius: 4,
  paddingHorizontal: 4,
  paddingVertical: 1,
} as const;

const removeBtn = {
  position: "absolute",
  top: -6,
  right: -6,
  backgroundColor: colors.danger,
  width: 20,
  height: 20,
  borderRadius: 10,
  alignItems: "center",
  justifyContent: "center",
} as const;
