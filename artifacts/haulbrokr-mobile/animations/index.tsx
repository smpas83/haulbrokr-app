import React, { type ReactNode } from "react";
import Animated, { FadeIn as ReanimatedFadeIn, FadeOut } from "react-native-reanimated";
import { animation } from "@workspace/design-tokens";

const { presets } = animation;

export function FadeIn({ children }: { children: ReactNode }) {
  return (
    <Animated.View entering={ReanimatedFadeIn.duration(presets.fadeIn.duration)} exiting={FadeOut}>
      {children}
    </Animated.View>
  );
}

export function SlideUp({ children }: { children: ReactNode }) {
  return (
    <Animated.View
      entering={ReanimatedFadeIn.duration(presets.slideUp.duration).withInitialValues({ transform: [{ translateY: 16 }] })}
      exiting={FadeOut}
    >
      {children}
    </Animated.View>
  );
}

export function ScaleIn({ children }: { children: ReactNode }) {
  return (
    <Animated.View
      entering={ReanimatedFadeIn.duration(presets.scaleIn.duration).withInitialValues({ transform: [{ scale: 0.95 }] })}
      exiting={FadeOut}
    >
      {children}
    </Animated.View>
  );
}

export function HoverCard({ children }: { children: ReactNode }) {
  return <Animated.View>{children}</Animated.View>;
}

export function LoadingTransition({ children }: { children: ReactNode }) {
  return (
    <Animated.View entering={ReanimatedFadeIn.duration(presets.loading.duration)}>
      {children}
    </Animated.View>
  );
}

export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <Animated.View entering={ReanimatedFadeIn.duration(presets.page.duration)} exiting={FadeOut}>
      {children}
    </Animated.View>
  );
}
