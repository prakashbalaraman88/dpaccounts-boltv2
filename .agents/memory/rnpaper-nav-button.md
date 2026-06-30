---
name: RN Paper nav button pattern
description: How to make navigation buttons work reliably on web in this Expo/react-native-paper app.
---

## Rule
Always wrap `IconButton` in a `Pressable` for navigation on web. Never put navigation logic in `IconButton.onPress`.

```jsx
<Pressable
  testID="unique-testid"
  style={styles.btnContainer}
  onPress={() => router.replace('/')}
>
  <IconButton icon="close" size={22} style={{ margin: 0, pointerEvents: 'none' }} />
</Pressable>
```

**Why:** On React Native web, `react-native-paper`'s `IconButton` without `onPress` renders as `<button disabled>`. Clicking a disabled button does NOT fire `onClick` on parent elements in some browsers. Adding `pointerEvents: 'none'` via the `style` prop (not the deprecated `props.pointerEvents`) makes the icon transparent to pointer events, so clicks fall through to the `Pressable`. The `Pressable` renders as a `<div role="button">` and reliably fires `onPress`.

**How to apply:** Any time you add a close/back/icon button that needs to navigate: wrap with `Pressable(onPress=router call)`, child `IconButton(style.pointerEvents:'none', no onPress)`. The unique `testID` goes on the outer `Pressable` for e2e targeting. This is the same pattern used by `NavButton` in `index.js`.
