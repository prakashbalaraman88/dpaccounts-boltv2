'use strict';

const React = require('react');
const { View } = require('react-native');

const createAnimationBuilder = () => ({
  duration: () => createAnimationBuilder(),
  delay: () => createAnimationBuilder(),
  springify: () => createAnimationBuilder(),
  damping: () => createAnimationBuilder(),
});

const FadeIn = createAnimationBuilder();
const FadeInDown = createAnimationBuilder();
const FadeOut = createAnimationBuilder();
const SlideInRight = createAnimationBuilder();

const useSharedValue = (initial) => ({ value: initial });
const useAnimatedStyle = (fn) => fn();
const withSpring = (value) => value;
const withTiming = (value) => value;

const Animated = {
  View: View,
  Text: require('react-native').Text,
  ScrollView: require('react-native').ScrollView,
  FlatList: require('react-native').FlatList,
  Image: require('react-native').Image,
  createAnimatedComponent: (Component) => Component,
};

module.exports = {
  ...Animated,
  default: Animated,
  FadeIn,
  FadeInDown,
  FadeOut,
  SlideInRight,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing: { linear: (t) => t, ease: (t) => t },
};
