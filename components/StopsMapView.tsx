import { useEffect, useRef } from "react";
import { View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { colors } from "@/lib/theme";

export interface MapStop {
  id: string;
  lat: number;
  lng: number;
  done: boolean;
}

interface StopsMapViewProps {
  stops: MapStop[];
  onStopPress?: (id: string) => void;
  height?: number;
}

// Self-contained Leaflet + OpenStreetMap page, no API key. Leaflet is
// DOM-based so it can't run as a native RN view — this WebView is the
// standard way to get a free map in Expo. Pin taps post back via
// window.ReactNativeWebView.postMessage; stop updates are pushed in via
// injectJavaScript (not a WebView reload) so the map doesn't flicker or
// lose pan/zoom when a stop flips from pending to delivered.
function buildHtml(initialStops: MapStop[]) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: ${colors.background}; }
    .leaflet-control-attribution { font-size: 9px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var PENDING = "${colors.steel}";
    var DONE = "${colors.success}";
    var DEFAULT_CENTER = [3.15905, 101.71204];
    var map = L.map('map', { zoomControl: false });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(map);

    function makeIcon(done) {
      return L.divIcon({
        className: '',
        html: '<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:' + (done ? DONE : PENDING) + ';transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.45)"></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 22],
      });
    }

    var markers = {};

    function render(stops) {
      Object.keys(markers).forEach(function (id) { map.removeLayer(markers[id]); });
      markers = {};
      var bounds = [];
      stops.forEach(function (s) {
        var m = L.marker([s.lat, s.lng], { icon: makeIcon(s.done) }).addTo(map);
        m.on('click', function () {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'stopTapped', id: s.id }));
        });
        markers[s.id] = m;
        bounds.push([s.lat, s.lng]);
      });
      if (bounds.length === 1) {
        map.setView(bounds[0], 15);
      } else if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [30, 30] });
      } else {
        map.setView(DEFAULT_CENTER, 12);
      }
    }

    window.updateStops = function (json) {
      render(JSON.parse(json));
    };

    render(${JSON.stringify(initialStops)});
  </script>
</body>
</html>`;
}

export default function StopsMapView({ stops, onStopPress, height = 220 }: StopsMapViewProps) {
  const webviewRef = useRef<WebView>(null);
  const htmlRef = useRef(buildHtml(stops));
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    webviewRef.current?.injectJavaScript(
      `window.updateStops(${JSON.stringify(JSON.stringify(stops))}); true;`
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops]);

  const handleMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as { type: string; id: string };
      if (msg.type === "stopTapped" && onStopPress) onStopPress(msg.id);
    } catch {
      // ignore malformed messages from the page
    }
  };

  return (
    <View style={{ height, borderRadius: 12, overflow: "hidden" }}>
      {/* react-native-webview's WebView<P = undefined> makes its props type
          collapse to `never` unless the generic is explicitly instantiated. */}
      <WebView<object>
        ref={webviewRef}
        originWhitelist={["*"]}
        source={{ html: htmlRef.current }}
        onMessage={handleMessage}
      />
    </View>
  );
}
