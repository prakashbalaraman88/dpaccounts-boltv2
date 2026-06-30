---
name: RN text node in View
description: Why {someString && <View>} causes "Unexpected text node" in React Native and how to fix it.
---

## Rule
Never use `{someString && <Component />}` as a JSX child of a View when `someString` could be `''` (empty string). Use a ternary returning `null` instead.

```jsx
// BAD — when errorMsg === '' this evaluates to '' which React Native renders as a text node
{(errorMsg || successMsg) && <View><Text>{errorMsg || successMsg}</Text></View>}

// GOOD — ternary returns null, React never creates a text node
{(errorMsg || successMsg) ? <View><Text>{errorMsg || successMsg}</Text></View> : null}
```

**Why:** In JavaScript, `'' && anything` short-circuits and returns `''` (the empty string), NOT `false`. React renders `''` as an empty text fiber. React Native's validator sees a string child of a View (not a Text) and throws "Unexpected text node: . A text node cannot be a child of a <View>." (the `.` after the colon is the period that starts ". A text node..." — the text content is actually the empty string `""`). The same issue occurs with `{0 && ...}` (renders `"0"`).

**How to apply:** Any time you have `{someValue && <JSX>}`, ask: could `someValue` ever be `0` or `''`? If the parent is a View (not a Text), use a ternary. Safe patterns: `{someBoolean && <JSX>}`, `{someValue ? <JSX> : null}`.
