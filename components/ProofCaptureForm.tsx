import { useState } from "react";
import { View, Text, TextInput, Pressable, Image, Alert, Linking, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { WORKER_SETTABLE_STATUSES, STATUS_LABELS, type TaskStatus } from "@/lib/types";
import { colors, radius, space, type } from "@/lib/theme";
import type { MediaItem, MediaUploadStatus, UploadProgressCallback } from "@/lib/tasks";
import IconTile from "@/components/ui/IconTile";
import Chip from "@/components/ui/Chip";
import Button from "@/components/ui/Button";
import PhotoViewer from "@/components/ui/PhotoViewer";

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
  onSubmit: (payload: CaptureSubmitPayload, onProgress?: UploadProgressCallback) => Promise<void>;
}

// How long the last thumbnail's checkmark stays visible before the form
// clears itself — long enough to register as a real confirmation, short
// enough not to feel like it's blocking the next photo.
const CLEAR_DELAY_MS = 550;

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
  const [uploadStatus, setUploadStatus] = useState<Record<number, MediaUploadStatus>>({});
  const [viewerUri, setViewerUri] = useState<string | null>(null);

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
    setUploadStatus({});
    try {
      const parsedAmount = amount.trim() ? Number(amount) : null;
      await onSubmit(
        {
          remark,
          media,
          status: mode === "task" ? status : null,
          markDone: mode === "stop" ? markDone : false,
          amountCollected: mode === "task" && parsedAmount != null && Number.isFinite(parsedAmount) ? parsedAmount : null,
        },
        (index, itemStatus) => setUploadStatus((prev) => ({ ...prev, [index]: itemStatus }))
      );
      // Let the worker actually see the last thumbnail flip to a checkmark
      // before the form clears out from under it.
      if (media.length > 0) await new Promise((resolve) => setTimeout(resolve, CLEAR_DELAY_MS));
      setMedia([]);
      setRemark("");
      setStatus(null);
      setMarkDone(false);
      setAmount("");
    } catch (e) {
      Alert.alert("Could not send", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setSubmitting(false);
      setUploadStatus({});
    }
  };

  return (
    <View>
      <Text style={sectionTitle}>Add proof</Text>
      <View style={{ flexDirection: "row", gap: 10, marginBottom: space.md }}>
        <IconTile icon="camera-outline" label="Photo" onPress={() => addFromCamera("photo")} />
        <IconTile icon="videocam-outline" label="Video" onPress={() => addFromCamera("video")} />
        <IconTile icon="images-outline" label="Gallery" onPress={addFromLibrary} />
      </View>

      {media.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: space.md }}>
          {media.map((m, i) => {
            const itemStatus = uploadStatus[i];
            return (
              <View key={m.uri} style={{ position: "relative" }}>
                <Pressable
                  onPress={() => m.type === "photo" && setViewerUri(m.uri)}
                  disabled={m.type === "video" || submitting}
                >
                  <Image
                    source={{ uri: m.uri }}
                    style={{
                      width: 84,
                      height: 84,
                      borderRadius: radius.md,
                      backgroundColor: colors.border,
                      opacity: submitting ? 0.5 : 1,
                    }}
                  />
                </Pressable>
                {m.type === "video" && !submitting && (
                  <View style={videoBadge}>
                    <Ionicons name="play" size={9} color="#fff" />
                    <Text style={{ color: "white", fontSize: 10 }}>video</Text>
                  </View>
                )}
                {submitting ? (
                  <View style={uploadOverlay} pointerEvents="none">
                    {itemStatus === "done" ? (
                      <Ionicons name="checkmark-circle" size={26} color={colors.successFg} />
                    ) : (
                      <ActivityIndicator size="small" color="#fff" />
                    )}
                  </View>
                ) : (
                  <Pressable onPress={() => removeMedia(m.uri)} hitSlop={8} style={removeBtn}>
                    <Ionicons name="close" size={13} color="#fff" />
                  </Pressable>
                )}
              </View>
            );
          })}
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
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          padding: space.md,
          minHeight: 56,
          textAlignVertical: "top",
          color: colors.ink,
          marginBottom: space.md,
          fontSize: 13.5,
        }}
      />

      {mode === "task" ? (
        <>
          <Text style={sectionTitle}>Status</Text>
          <View style={{ flexDirection: "row", gap: 6, marginBottom: space.lg, flexWrap: "wrap" }}>
            {WORKER_SETTABLE_STATUSES.map((s) => (
              <Chip key={s} label={STATUS_LABELS[s]} active={status === s} onPress={() => setStatus(status === s ? null : s)} />
            ))}
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
                  borderRadius: radius.sm,
                  borderWidth: 1,
                  borderColor: colors.inputBorder,
                  padding: space.md,
                  color: colors.ink,
                  marginBottom: 6,
                  fontSize: 13.5,
                }}
              />
              <Text style={{ fontSize: 11.5, color: colors.muted, marginBottom: space.lg }}>
                Cash or e-wallet payment collected — snap it above as proof.
              </Text>
            </>
          )}
        </>
      ) : (
        <Pressable
          onPress={() => setMarkDone((v) => !v)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            marginBottom: space.lg,
            padding: space.md,
            borderRadius: radius.sm,
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
            {markDone && <Ionicons name="checkmark" size={13} color="#fff" />}
          </View>
          <Text style={{ color: markDone ? colors.successFg : colors.body, fontWeight: "700", fontSize: 13.5 }}>
            Mark this stop delivered
          </Text>
        </Pressable>
      )}

      <Button
        label={
          notOnSite
            ? "Move closer to submit"
            : submitting && media.length > 0
              ? `Uploading ${Math.min(Object.values(uploadStatus).filter((s) => s === "done").length + 1, media.length)} of ${media.length}…`
              : mode === "stop"
                ? "Submit stop proof"
                : "Submit proof"
        }
        onPress={handleSubmit}
        loading={submitting}
        disabled={notOnSite}
        icon={!submitting && <Ionicons name="paper-plane-outline" size={16} color="#fff" />}
      />
      <PhotoViewer uri={viewerUri} onClose={() => setViewerUri(null)} />
    </View>
  );
}

const sectionTitle = {
  ...type.label,
  color: colors.muted,
  marginBottom: space.sm,
} as const;

const uploadOverlay = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  borderRadius: radius.md,
  backgroundColor: "rgba(0,0,0,0.4)",
  alignItems: "center",
  justifyContent: "center",
} as const;

const videoBadge = {
  position: "absolute",
  bottom: 4,
  left: 4,
  flexDirection: "row",
  alignItems: "center",
  gap: 3,
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
