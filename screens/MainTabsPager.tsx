import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenContainer } from '../components/ScreenContainer';
import { assertNever } from '../types/domain';
import {
  MAIN_TABS,
  type MainTabKey,
  type PendingTransactionsFilter,
  type TransactionsTabFilter,
} from '../types/navigation';
import {
  useAppTheme,
  useReduceMotion,
  useResponsiveLayout,
} from '../utils/theme';
import { CategoriesScreen } from './CategoriesScreen';
import { DashboardScreen } from './DashboardScreen';
import {
  MainTabsContext,
  type MainTabsContextValue,
} from './MainTabsContext';
import { ReportsScreen } from './ReportsScreen';
import { TransactionsScreen } from './TransactionsScreen';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function getTabIndex(tab: MainTabKey): number {
  switch (tab) {
    case 'Dashboard':
      return 0;
    case 'Transactions':
      return 1;
    case 'Reports':
      return 2;
    case 'Categories':
      return 3;
    default:
      return assertNever(tab);
  }
}

function getTabIconName(tab: MainTabKey, focused: boolean): IoniconName {
  switch (tab) {
    case 'Dashboard':
      return focused ? 'home' : 'home-outline';
    case 'Transactions':
      return focused ? 'list' : 'list-outline';
    case 'Reports':
      return focused ? 'pie-chart' : 'pie-chart-outline';
    case 'Categories':
      return focused ? 'grid' : 'grid-outline';
    default:
      return assertNever(tab);
  }
}

function getTabLabel(tab: MainTabKey): string {
  switch (tab) {
    case 'Dashboard':
      return 'Home';
    case 'Transactions':
      return 'Transactions';
    case 'Reports':
      return 'Reports';
    case 'Categories':
      return 'Categories';
    default:
      return assertNever(tab);
  }
}

function renderTabPage(tab: MainTabKey): React.ReactElement {
  switch (tab) {
    case 'Dashboard':
      return <DashboardScreen />;
    case 'Transactions':
      return <TransactionsScreen />;
    case 'Reports':
      return <ReportsScreen />;
    case 'Categories':
      return <CategoriesScreen />;
    default:
      return assertNever(tab);
  }
}

interface TabIconAnimations {
  readonly activeOpacity: Animated.AnimatedInterpolation<number>;
  readonly inactiveOpacity: Animated.AnimatedInterpolation<number>;
  readonly activeScale: Animated.AnimatedInterpolation<number> | number;
}

function createTabIconAnimations(
  scrollX: Animated.Value,
  index: number,
  pageWidth: number,
  reduceMotion: boolean,
): TabIconAnimations {
  const isFirst = index === 0;
  const isLast = index === MAIN_TABS.length - 1;

  const inputRange = isFirst
    ? [0, pageWidth]
    : isLast
      ? [(index - 1) * pageWidth, index * pageWidth]
      : [(index - 1) * pageWidth, index * pageWidth, (index + 1) * pageWidth];

  const activeOutputRange = isFirst ? [1, 0] : isLast ? [0, 1] : [0, 1, 0];
  const inactiveOutputRange = isFirst ? [0, 1] : isLast ? [1, 0] : [1, 0, 1];
  const scaleOutputRange = isFirst
    ? [1.06, 1]
    : isLast
      ? [1, 1.06]
      : [1, 1.06, 1];

  return {
    activeOpacity: scrollX.interpolate({
      inputRange,
      outputRange: activeOutputRange,
      extrapolate: 'clamp',
    }),
    inactiveOpacity: scrollX.interpolate({
      inputRange,
      outputRange: inactiveOutputRange,
      extrapolate: 'clamp',
    }),
    activeScale: reduceMotion
      ? 1
      : scrollX.interpolate({
          inputRange,
          outputRange: scaleOutputRange,
          extrapolate: 'clamp',
        }),
  };
}

export function MainTabsPager() {
  const theme = useAppTheme();
  const reduceMotion = useReduceMotion();
  const { width: windowWidth, contentMaxWidth } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  const scrollViewRef = useRef<ScrollViewInstance>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const activeIndexRef = useRef(0);
  const programmaticTargetRef = useRef<number | null>(null);
  const lastOffsetXRef = useRef(0);
  const filterNonceRef = useRef(0);

  const [activeTab, setActiveTab] = useState<MainTabKey>('Dashboard');
  const [pagerWidth, setPagerWidth] = useState(windowWidth);
  const [tabBarWidth, setTabBarWidth] = useState(0);
  const [pendingTransactionsFilter, setPendingTransactionsFilter] =
    useState<PendingTransactionsFilter | null>(null);

  const pageWidth = Math.max(1, pagerWidth);

  useEffect(() => {
    const targetX = activeIndexRef.current * pageWidth;
    programmaticTargetRef.current = null;
    lastOffsetXRef.current = targetX;
    scrollViewRef.current?.scrollTo({ x: targetX, y: 0, animated: false });
    scrollX.setValue(targetX);
  }, [pageWidth, scrollX]);

  const clearPendingTransactionsFilter = useCallback(() => {
    setPendingTransactionsFilter(null);
  }, []);

  const switchTab = useCallback(
    (tab: MainTabKey, filter?: TransactionsTabFilter) => {
      const index = getTabIndex(tab);
      if (tab === 'Transactions' && filter !== undefined) {
        filterNonceRef.current += 1;
        setPendingTransactionsFilter({
          ...filter,
          nonce: filterNonceRef.current,
        });
      }

      const targetX = index * pageWidth;
      activeIndexRef.current = index;
      setActiveTab((prev) => (prev === tab ? prev : tab));

      if (reduceMotion) {
        programmaticTargetRef.current = null;
        lastOffsetXRef.current = targetX;
        scrollViewRef.current?.scrollTo({ x: targetX, y: 0, animated: false });
        scrollX.setValue(targetX);
        return;
      }

      if (
        programmaticTargetRef.current === null &&
        Math.abs(lastOffsetXRef.current - targetX) <= 1
      ) {
        scrollViewRef.current?.scrollTo({ x: targetX, y: 0, animated: false });
        scrollX.setValue(targetX);
        return;
      }

      programmaticTargetRef.current = index;
      scrollViewRef.current?.scrollTo({ x: targetX, y: 0, animated: true });
    },
    [pageWidth, reduceMotion, scrollX],
  );

  const handlePagerLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth > 0) {
      setPagerWidth((prev) =>
        Math.abs(prev - nextWidth) > 0.5 ? nextWidth : prev,
      );
    }
  }, []);

  const handleScrollBeginDrag = useCallback(() => {
    programmaticTargetRef.current = null;
  }, []);

  const handleScrollListener = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      lastOffsetXRef.current = offsetX;

      const targetIndex = programmaticTargetRef.current;
      if (targetIndex !== null) {
        if (Math.abs(offsetX - targetIndex * pageWidth) <= 2) {
          programmaticTargetRef.current = null;
        } else {
          return;
        }
      }

      const nearestIndex = Math.max(
        0,
        Math.min(MAIN_TABS.length - 1, Math.round(offsetX / pageWidth)),
      );
      const nextTab = MAIN_TABS[nearestIndex];
      if (nextTab !== undefined && activeIndexRef.current !== nearestIndex) {
        activeIndexRef.current = nearestIndex;
        setActiveTab((prev) => (prev === nextTab ? prev : nextTab));
      }
    },
    [pageWidth],
  );

  const handleScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      lastOffsetXRef.current = offsetX;
      programmaticTargetRef.current = null;

      const nearestIndex = Math.max(
        0,
        Math.min(MAIN_TABS.length - 1, Math.round(offsetX / pageWidth)),
      );
      const nextTab = MAIN_TABS[nearestIndex];
      if (nextTab !== undefined) {
        activeIndexRef.current = nearestIndex;
        setActiveTab((prev) => (prev === nextTab ? prev : nextTab));
      }
    },
    [pageWidth],
  );

  const handleScroll = useMemo(
    () =>
      Animated.event<NativeScrollEvent>(
        [{ nativeEvent: { contentOffset: { x: scrollX } } }],
        {
          useNativeDriver: true,
          listener: handleScrollListener,
        },
      ),
    [handleScrollListener, scrollX],
  );

  const handleTabBarLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth > 0) {
      setTabBarWidth((prev) =>
        Math.abs(prev - nextWidth) > 0.5 ? nextWidth : prev,
      );
    }
  }, []);

  useEffect(() => {
    if (!isFocused || activeTab === 'Dashboard') {
      return;
    }
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        switchTab('Dashboard');
        return true;
      },
    );
    return () => {
      subscription.remove();
    };
  }, [activeTab, isFocused, switchTab]);

  const contextValue = useMemo<MainTabsContextValue>(
    () => ({
      activeTab,
      switchTab,
      pendingTransactionsFilter,
      clearPendingTransactionsFilter,
    }),
    [
      activeTab,
      switchTab,
      pendingTransactionsFilter,
      clearPendingTransactionsFilter,
    ],
  );

  const effectiveBarWidth =
    tabBarWidth > 0 ? tabBarWidth : Math.min(pageWidth, contentMaxWidth);
  const tabWidth = effectiveBarWidth / MAIN_TABS.length;

  const capsuleTranslateX = useMemo(
    () =>
      scrollX.interpolate({
        inputRange: [0, pageWidth, pageWidth * 2, pageWidth * 3],
        outputRange: [0, tabWidth, tabWidth * 2, tabWidth * 3],
        extrapolate: 'clamp',
      }),
    [pageWidth, scrollX, tabWidth],
  );

  const capsuleScaleX = useMemo(() => {
    if (reduceMotion) {
      return 1;
    }
    return scrollX.interpolate({
      inputRange: [
        0,
        pageWidth * 0.5,
        pageWidth,
        pageWidth * 1.5,
        pageWidth * 2,
        pageWidth * 2.5,
        pageWidth * 3,
      ],
      outputRange: [1, 1.16, 1, 1.16, 1, 1.16, 1],
      extrapolate: 'clamp',
    });
  }, [pageWidth, reduceMotion, scrollX]);

  const tabIconAnimations = useMemo(
    () =>
      MAIN_TABS.map((_, index) =>
        createTabIconAnimations(scrollX, index, pageWidth, reduceMotion),
      ),
    [pageWidth, reduceMotion, scrollX],
  );

  const bottomInset = Math.max(insets.bottom, theme.spacing.sm);

  return (
    <MainTabsContext.Provider value={contextValue}>
      <View
        style={[styles.container, { backgroundColor: theme.colors.canvas }]}
      >
        <View style={styles.pagerHost} onLayout={handlePagerLayout}>
          <Animated.ScrollView
            ref={scrollViewRef}
            style={styles.pager}
            contentContainerStyle={styles.pagerContent}
            horizontal={true}
            pagingEnabled={true}
            directionalLockEnabled={true}
            bounces={true}
            overScrollMode="never"
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            keyboardDismissMode="on-drag"
            nestedScrollEnabled={true}
            onScrollBeginDrag={handleScrollBeginDrag}
            onScroll={handleScroll}
            onMomentumScrollEnd={handleScrollEnd}
            onScrollEndDrag={handleScrollEnd}
          >
            {MAIN_TABS.map((tab, index) => (
              <View
                key={tab}
                style={[
                  styles.page,
                  { width: pageWidth },
                  index > 0 && {
                    borderLeftWidth: StyleSheet.hairlineWidth,
                    borderLeftColor: theme.colors.divider,
                  },
                ]}
              >
                {renderTabPage(tab)}
              </View>
            ))}
          </Animated.ScrollView>
        </View>

        <View
          style={[
            styles.tabBarOuter,
            {
              backgroundColor: theme.colors.surface,
              borderTopColor: theme.colors.border,
              paddingBottom: bottomInset,
            },
          ]}
        >
          <ScreenContainer>
            <View
              style={styles.tabRow}
              onLayout={handleTabBarLayout}
              accessibilityRole="tablist"
            >
              {tabWidth > 0 ? (
                <Animated.View
                  pointerEvents="none"
                  accessibilityElementsHidden={true}
                  importantForAccessibility="no-hide-descendants"
                  style={[
                    styles.capsuleTrackSlot,
                    {
                      width: tabWidth,
                      transform: [
                        { translateX: capsuleTranslateX },
                        { scaleX: capsuleScaleX },
                      ],
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.capsulePill,
                      {
                        borderRadius: theme.radius.pill,
                        backgroundColor: theme.colors.accentSoft,
                      },
                    ]}
                  />
                </Animated.View>
              ) : null}

              {MAIN_TABS.map((tab, index) => {
                const isSelected = activeTab === tab;
                const tintColor = isSelected
                  ? theme.colors.accent
                  : theme.colors.textMuted;
                const label = getTabLabel(tab);
                const iconAnim = tabIconAnimations[index];
                if (iconAnim === undefined) {
                  return null;
                }

                return (
                  <Pressable
                    key={tab}
                    onPress={() => switchTab(tab)}
                    android_ripple={{
                      color: theme.colors.ripple,
                      borderless: false,
                    }}
                    style={({ pressed }) => [
                      styles.tabButton,
                      Platform.OS !== 'android' &&
                        pressed &&
                        styles.tabButtonPressed,
                    ]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={label}
                  >
                    <View style={styles.iconSlot}>
                      <Animated.View
                        pointerEvents="none"
                        style={[
                          StyleSheet.absoluteFill,
                          styles.iconCenter,
                          { opacity: iconAnim.inactiveOpacity },
                        ]}
                      >
                        <Ionicons
                          name={getTabIconName(tab, false)}
                          size={21}
                          color={theme.colors.textMuted}
                        />
                      </Animated.View>
                      <Animated.View
                        pointerEvents="none"
                        style={[
                          StyleSheet.absoluteFill,
                          styles.iconCenter,
                          {
                            opacity: iconAnim.activeOpacity,
                            transform: [{ scale: iconAnim.activeScale }],
                          },
                        ]}
                      >
                        <Ionicons
                          name={getTabIconName(tab, true)}
                          size={21}
                          color={theme.colors.accent}
                        />
                      </Animated.View>
                    </View>

                    <Text
                      style={[theme.typography.micro, { color: tintColor }]}
                      numberOfLines={1}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScreenContainer>
        </View>
      </View>
    </MainTabsContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pagerHost: {
    flex: 1,
  },
  pager: {
    flex: 1,
  },
  pagerContent: {
    height: '100%',
  },
  page: {
    height: '100%',
  },
  tabBarOuter: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tabRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  capsuleTrackSlot: {
    position: 'absolute',
    top: 8,
    left: 0,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capsulePill: {
    width: 64,
    height: 32,
  },
  tabButton: {
    flex: 1,
    minHeight: 64,
    paddingTop: 8,
    paddingBottom: 6,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 4,
  },
  tabButtonPressed: {
    opacity: 0.72,
  },
  iconSlot: {
    position: 'relative',
    width: 64,
    height: 32,
  },
  iconCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
