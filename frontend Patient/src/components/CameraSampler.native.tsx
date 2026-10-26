// Phones (Expo Go and builds): the camera runs in a small WebView page (see fingertipCaptureHtml.ts), which
// shows the preview and posts the average colour of each frame. Android asks for camera permission first.
import React, { useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { colors, radii } from '../theme/tokens';
import { FINGERTIP_CAPTURE_HTML } from '../services/fingertipCaptureHtml';
import type { CameraSamplerProps } from './CameraSampler';

export type { CameraSamplerProps };
export const CAMERA_SAMPLER_SUPPORTED = true;

export const CameraSampler: React.FC<CameraSamplerProps> = ({ active, onSample, onStarted, onError, style }) => {
  const [allowed, setAllowed] = useState(Platform.OS !== 'android');
  const handlers = useRef({ onSample, onStarted, onError });
  handlers.current = { onSample, onStarted, onError };

  useEffect(() => {
    if (!active || Platform.OS !== 'android') return;
    let alive = true;
    PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA)
      .then((res) => {
        if (!alive) return;
        if (res === PermissionsAndroid.RESULTS.GRANTED) setAllowed(true);
        else handlers.current.onError('denied');
      })
      .catch(() => alive && handlers.current.onError('failed'));
    return () => { alive = false; };
  }, [active]);

  const onMessage = (e: WebViewMessageEvent) => {
    let msg: { type: string; s?: number[][]; torch?: boolean; name?: string };
    try { msg = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (msg.type === 'samples' && msg.s) {
      for (const [t, r, g, b] of msg.s) handlers.current.onSample({ t, r, g, b });
    } else if (msg.type === 'started') {
      handlers.current.onStarted(!!msg.torch);
    } else if (msg.type === 'error') {
      handlers.current.onError(msg.name === 'NotAllowedError' ? 'denied' : 'failed');
    }
  };

  if (!active || !allowed) return <View style={[styles.box, style]} />;
  return (
    <View style={[styles.box, style]}>
      <WebView
        source={{ html: FINGERTIP_CAPTURE_HTML, baseUrl: 'https://localhost' }}
        originWhitelist={['*']}
        onMessage={onMessage}
        javaScriptEnabled
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        mediaCapturePermissionGrantType="grant"
        scrollEnabled={false}
        style={styles.web}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  box: { width: 96, height: 72, borderRadius: radii.md, overflow: 'hidden', backgroundColor: colors.night },
  web: { flex: 1, backgroundColor: colors.night },
});
