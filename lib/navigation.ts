import { Alert, Linking } from "react-native";

// Universal links — work whether or not the app is installed (fall back to
// the mobile web version), no API key needed for either.
export function googleMapsDirectionsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

export function wazeUrl(lat: number, lng: number) {
  return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
}

export async function openNavigation(url: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert("Couldn't open the app", "Make sure Google Maps or Waze is installed, or try the other one.");
  }
}
