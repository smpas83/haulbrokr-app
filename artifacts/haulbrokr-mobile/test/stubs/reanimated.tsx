import React from "react";
import { View } from "react-native";

const passthrough = (Comp: any) =>
  React.forwardRef((props: any, ref: any) => <Comp ref={ref} {...props} />);

const Animated: any = {
  View: passthrough(View),
  Text: passthrough(View),
  ScrollView: passthrough(View),
  createAnimatedComponent: (Comp: any) => passthrough(Comp),
};

const entering = () => {
  const chain: any = {};
  chain.delay = () => chain;
  chain.springify = () => chain;
  chain.duration = () => chain;
  return chain;
};

export const FadeInDown: any = entering();
export const FadeIn: any = entering();
export const FadeOut: any = entering();
export const FadeInUp: any = entering();
export const FadeOutUp: any = entering();
export default Animated;
