import React from "react";

export const router = {
  back: () => {},
  push: () => {},
  replace: () => {},
  navigate: () => {},
};

export function useFocusEffect(effect: () => void | (() => void)) {
  React.useEffect(() => effect(), [effect]);
}
