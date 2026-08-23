import { useEffect, useState } from "react";
import { View, Text, TextInput, ScrollView, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import {
  listJobTypes,
  listClients,
  createSelfTask,
  getCurrentLocation,
  reverseGeocode,
  type Coords,
} from "@/lib/tasks";
import type { JobType, Client, TaskPriority } from "@/lib/types";
import { colors, radius, space, type } from "@/lib/theme";
import ScreenHeader from "@/components/ui/ScreenHeader";
import Chip from "@/components/ui/Chip";
import Button from "@/components/ui/Button";
import StopsMapView from "@/components/StopsMapView";

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
  const [radius_, setRadiusM] = useState(150);
  const [pin, setPin] = useState<Coords | null>(null);
  const [placingPin, setPlacingPin] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [resolvingAddress, setResolvingAddress] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!profile?.org_id) return;
    Promise.all([listJobTypes(profile.org_id), listClients(profile.org_id)]).then(([jt, c]) => {
      setJobTypes(jt);
      setClients(c);
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
      setAddress(null);
      setResolvingAddress(true);
      reverseGeocode(coords.lat, coords.lng)
        .then(setAddress)
        .finally(() => setResolvingAddress(false));
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
        address,
        radiusM: radius_,
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
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingBottom: space.xxl + 8 }}>
      <ScreenHeader title="New job" />

      <View style={{ paddingHorizontal: space.lg }}>
        <Text style={{ fontSize: 12.5, color: colors.muted, marginBottom: space.lg }}>
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

        <Label>Job type (optional)</Label>
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
        <Button
          label={placingPin ? "" : pin ? "Update pin to my location" : "Use my current location"}
          onPress={handlePlacePin}
          loading={placingPin}
          variant="outline"
          icon={!placingPin && <Ionicons name={pin ? "refresh" : "locate-outline"} size={16} color={colors.steel} />}
          style={{ marginBottom: 6 }}
        />
        {pin && (
          <>
            <View style={{ marginBottom: 6 }}>
              <StopsMapView stops={[{ id: "pin", lat: pin.lat, lng: pin.lng, done: false }]} height={140} />
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: space.sm,
                backgroundColor: colors.cardRaised,
                borderRadius: radius.sm,
                padding: space.sm + 2,
                marginBottom: 6,
              }}
            >
              <Ionicons name="location" size={16} color={colors.success} />
              {resolvingAddress ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                  <ActivityIndicator size="small" color={colors.steel} />
                  <Text style={{ color: colors.muted, fontSize: 12.5 }}>Finding address…</Text>
                </View>
              ) : (
                <Text style={{ color: colors.body, fontSize: 12.5, flex: 1 }} numberOfLines={2}>
                  {address ?? `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`}
                </Text>
              )}
            </View>
          </>
        )}
        <Text style={{ fontSize: 11, color: colors.muted, marginBottom: space.lg }}>
          Sets the pin to where you're standing right now — tap again to update it.
        </Text>

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
          <Label noMargin>Upload radius</Label>
          <Text style={{ ...type.mono, color: colors.primary }}>{radius_}m</Text>
        </View>
        <ChipRow>
          {RADIUS_PRESETS.map((r) => (
            <Chip key={r} label={`${r}m`} active={radius_ === r} onPress={() => setRadiusM(r)} />
          ))}
        </ChipRow>
        <Text style={{ fontSize: 11.5, color: colors.muted, marginTop: 6, marginBottom: space.lg + 2 }}>
          Workers can only upload proof for this job from within {radius_}m of the pin. Uploads from the web
          dashboard are never location-gated — that&apos;s admin access.
        </Text>

        <Button label="Create & start job" onPress={handleSubmit} loading={submitting} />
      </View>
    </ScrollView>
  );
}

function Label({ children, noMargin }: { children: React.ReactNode; noMargin?: boolean }) {
  return <Text style={{ ...type.label, color: colors.muted, marginBottom: noMargin ? 0 : space.sm }}>{children}</Text>;
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: space.lg }}>{children}</View>;
}

const input = {
  width: "100%",
  borderWidth: 1,
  borderColor: colors.inputBorder,
  borderRadius: radius.sm,
  paddingHorizontal: space.md,
  paddingVertical: 10,
  fontSize: 14,
  color: colors.ink,
  marginBottom: space.lg,
  backgroundColor: colors.card,
} as const;
