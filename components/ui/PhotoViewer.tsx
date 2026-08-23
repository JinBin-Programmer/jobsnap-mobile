import { Modal, View, Image, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface PhotoViewerProps {
  uri: string | null;
  onClose: () => void;
}

// A full-screen tap-to-enlarge viewer — thumbnails elsewhere in the app
// (gallery, capture previews) were display-only with no way to actually
// look closely at a photo you or a teammate took.
export default function PhotoViewer({ uri, onClose }: PhotoViewerProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {uri && <Image source={{ uri }} style={styles.image} resizeMode="contain" />}
        <Pressable onPress={onClose} style={[styles.closeBtn, { top: insets.top + 12 }]} hitSlop={12}>
          <Ionicons name="close" size={22} color="#fff" />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(8,9,10,0.94)", alignItems: "center", justifyContent: "center" },
  image: { width: "100%", height: "82%" },
  closeBtn: {
    position: "absolute",
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
});
