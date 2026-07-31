import { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { listJobTypes, listClients, createSelfTask, getCurrentLocation, type Coords } from "@/lib/tasks";
import type { JobType, Client, TaskPriority } from "@/lib/types";
import { colors } from "@/lib/theme";

const PRIORITIES: TaskPriority[] = ["low", "medium", "high", "urgent"];
const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};
const RADIUS_PRESETS = [50, 100, 150, 250, 500];

export default function NewJobScreen() {
  const router = useRouter();
  const { session, profile } = useAuth();

  const [jobTypes, setJobTypes] = useState<JobType[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  const [title, setTitle] = useState("");
  const [jobTypeId, setJobTypeId] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [radius, setRadius] = useState(150);
  const [pin, setPin] = useState<Coords | null>(null);
  const [placingPin, setPlacingPin] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!profile?.org_id) return;
    Promise.all([listJobTypes(profile.org_id), listClients(profile.org_id)]).then(([jt, c]) => {
      setJobTypes(jt);
      setClients(c);
      setJobTypeId(jt[0]?.id ?? null);
      setClientId(c[0]?.id ?? null);
      setLoadingOptions(false);
    });
  }, [profile?.org_id]);

  const handlePlacePin = async () => {
    setPlacingPin(true);
    try {
      const coords = await getCurrentLocation();
      if (!coords) {
        Alert.alert("Location needed", "Enable location access to pin this job's site.");
        return;
      }
      setPin(coords);
    } finally {
      setPlacingPin(false);
    }
  };

  const handleSubmit = async () => {
    if (!session || !profile?.org_id) return;
    if (!title.trim()) {
      Alert.alert("Job title needed", "Give this job a short title first.");
      return;
    }
    if (!pin) {
      Alert.alert("Set the site pin", "Tap \"Use my current location\" to pin where this job is.");
      return;
    }
    setSubmitting(true);
    try {
      const taskId = await createSelfTask({
        orgId: profile.org_id,
        workerId: session.user.id,
        title,
        jobTypeId,
        clientId,
        priority,
        coords: pin,
        radiusM: radius,
      });
      router.replace(`/task/${taskId}`);
    } catch (e) {
      Alert.alert("Could not create job", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingOptions) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ fontSize: 20, color: colors.primary }}>←</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 15, fontWeight: "700", color: colors.ink }}>New job</Text>
      </View>

      <Text style={{ fontSize: 12.5, color: colors.muted, marginBottom: 16 }}>
        Admin left this job out? Add it yourself and start uploading proof right away.
      </Text>

      <Label>Job title</Label>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Extra callback — leak recheck"
        placeholderTextColor={colors.muted}
        style={input}
      />

      <Label>Job type</Label>
      <ChipRow>
        {jobTypes.map((jt) => (
          <Chip key={jt.id} label={jt.name} active={jobTypeId === jt.id} onPress={() => setJobTypeId(jt.id)} />
        ))}
      </ChipRow>

      <Label>Client</Label>
      <ChipRow>
        {clients.map((c) => (
          <Chip key={c.id} label={c.name} active={clientId === c.id} onPress={() => setClientId(c.id)} />
        ))}
      </ChipRow>

      <Label>Priority</Label>
      <ChipRow>
        {PRIORITIES.map((p) => (
          <Chip key={p} label={PRIORITY_LABELS[p]} active={priority === p} onPress={() => setPriority(p)} />
        ))}
      </ChipRow>

      <Label>Job site location</Label>
      <TouchableOpacity
        onPress={handlePlacePin}
        disabled={placingPin}
        style={{
          height: 120,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          backgroundColor: colors.card,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 6,
        }}
      >
        {placingPin ? (
          <ActivityIndicator color={colors.steel} />
        ) : pin ? (
          <>
            <Text style={{ fontSize: 22 }}>📍</Text>
            <Text style={{ fontSize: 11, color: colors.body, fontFamily: "monospace", marginTop: 4 }}>
              {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
            </Text>
          </>
        ) : (
          <Text style={{ fontSize: 12.5, color: colors.steel, fontWeight: "600" }}>Use my current location</Text>
        )}
      </TouchableOpacity>
      <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 14 }}>
        Sets the pin to where you're standing right now — tap again to update it.
      </Text>

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
        <Label noMargin>Upload radius</Label>
        <Text style={{ fontFamily: "monospace", fontSize: 13, color: colors.primary, fontWeight: "700" }}>{radius}m</Text>
      </View>
      <ChipRow>
        {RADIUS_PRESETS.map((r) => (
          <Chip key={r} label={`${r}m`} active={radius === r} onPress={() => setRadius(r)} />
        ))}
      </ChipRow>
      <Text style={{ fontSize: 11.5, color: colors.muted, marginTop: 6, marginBottom: 18 }}>
        Workers can only upload proof for this job from within {radius}m of the pin. Uploads from the web
        dashboard are never location-gated — that&apos;s admin access.
      </Text>

      <TouchableOpacity
        onPress={handleSubmit}
        disabled={submitting}
        style={{
          backgroundColor: colors.primary,
          borderRadius: 9,
          paddingVertical: 13,
          alignItems: "center",
        }}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14.5 }}>Create &amp; start job</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

function Label({ children, noMargin }: { children: React.ReactNode; noMargin?: boolean }) {
  return (
    <Text
      style={{
        fontSize: 12,
        fontWeight: "700",
        color: colors.muted,
        textTransform: "uppercase",
        letterSpacing: 0.3,
        marginBottom: noMargin ? 0 : 6,
      }}
    >
      {children}
    </Text>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>{children}</View>;
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.inputBorder,
        backgroundColor: active ? colors.primary : colors.card,
      }}
    >
      <Text style={{ color: active ? "#fff" : colors.body, fontWeight: "600", fontSize: 12.5 }}>{label}</Text>
    </TouchableOpacity>
  );
}

const input = {
  width: "100%",
  borderWidth: 1,
  borderColor: colors.inputBorder,
  borderRadius: 8,
  paddingHorizontal: 12,
  paddingVertical: 10,
  fontSize: 14,
  color: colors.ink,
  marginBottom: 14,
  backgroundColor: colors.card,
} as const;
