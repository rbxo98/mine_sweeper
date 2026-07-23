import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { UNLIMITED_ACTION_BUDGET, type Params } from '../engine';

// 게임 시작 전 설정 화면. 시야 반경 / 맵 유형(유한·무한) / (유한이면 맵 크기,
// 무한이면 행동력)만 아주 단순하게 노출하고, 하단에 "게임 시작" 버튼을 둔다.
// App.tsx가 이 화면을 먼저 보여주고, "게임 시작"을 누르면 여기서 만든
// Partial<Params>를 그대로 GameScreen(→GameBController→createParams)에 넘긴다.

const COLOR = {
  background: '#0b0c10',
  card: '#15171d',
  cardBorder: '#2a2d35',
  text: '#f2f2f2',
  muted: '#9aa0ab',
  accent: '#ffcc4d',
  accentText: '#181a20',
  button: '#181a20',
  buttonBorder: '#2a2d35',
} as const;

const VISION_RADIUS_MIN = 1;
const VISION_RADIUS_MAX = 4;

const MAP_SIZE_MIN = 21;
const MAP_SIZE_MAX = 101;
const MAP_SIZE_STEP = 10;

const ACTION_BUDGET_MIN = 20;
const ACTION_BUDGET_MAX = 300;
const ACTION_BUDGET_STEP = 10;

type MapMode = 'finite' | 'infinite';

export interface GameStartConfig {
  paramOverrides: Partial<Params>;
}

export interface MainMenuScreenProps {
  onStart: (config: GameStartConfig) => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

interface StepperProps {
  label: string;
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  step: number;
  format?: (value: number) => string;
}

function Stepper({ label, value, onChange, min, max, step, format }: StepperProps): React.JSX.Element {
  const atMin = value <= min;
  const atMax = value >= max;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.stepper}>
        <Pressable
          style={[styles.stepperButton, atMin && styles.stepperButtonDisabled]}
          onPress={() => onChange(clamp(value - step, min, max))}
          disabled={atMin}
        >
          <Text style={styles.stepperButtonText}>−</Text>
        </Pressable>
        <Text style={styles.stepperValue}>{format ? format(value) : String(value)}</Text>
        <Pressable
          style={[styles.stepperButton, atMax && styles.stepperButtonDisabled]}
          onPress={() => onChange(clamp(value + step, min, max))}
          disabled={atMax}
        >
          <Text style={styles.stepperButtonText}>＋</Text>
        </Pressable>
      </View>
    </View>
  );
}

const HOW_TO_PLAY_TEXT =
  '탭: 인접 칸으로 이동 선언\n' +
  '롱프레스: 인접 칸에 지뢰 해체 선언\n' +
  '테두리 있는 확정 칸으로는 후퇴만 가능\n' +
  '칸의 숫자: 주변 8칸에 있는 지뢰 수\n' +
  '라이프가 0이 되거나 행동력을 다 쓰면 게임 종료\n' +
  '목표: 최대한 오래 살아남아 점수를 높이 쌓기';

export function MainMenuScreen({ onStart }: MainMenuScreenProps): React.JSX.Element {
  const [visionRadius, setVisionRadius] = useState(1);
  const [mapMode, setMapMode] = useState<MapMode>('infinite');
  const [mapSize, setMapSize] = useState(41);
  const [actionBudget, setActionBudget] = useState(80);
  const [howToPlayVisible, setHowToPlayVisible] = useState(false);

  const handleStart = (): void => {
    // 유한 맵은 행동력 설정 UI 자체가 없다 — 대신 사실상 무제한 값을 채워서
    // "라이프 소진으로만 끝난다"는 규칙이 되게 한다(UNLIMITED_ACTION_BUDGET,
    // src/engine/params.ts 참고). 무한 맵은 mapSize=0(엔진 기본값 = 무한).
    const paramOverrides: Partial<Params> =
      mapMode === 'finite'
        ? { visionRadius, mapSize, actionBudget: UNLIMITED_ACTION_BUDGET }
        : { visionRadius, mapSize: 0, actionBudget };
    onStart({ paramOverrides });
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>지뢰밭 정찰대</Text>
        <Text style={styles.subtitle}>설정을 고르고 정찰을 시작하세요</Text>

        <View style={styles.card}>
          <Stepper
            label="시야 반경"
            value={visionRadius}
            onChange={setVisionRadius}
            min={VISION_RADIUS_MIN}
            max={VISION_RADIUS_MAX}
            step={1}
          />

          <View style={styles.row}>
            <Text style={styles.rowLabel}>맵</Text>
            <View style={styles.toggleGroup}>
              <Pressable
                style={[styles.toggleButton, mapMode === 'infinite' && styles.toggleButtonActive]}
                onPress={() => setMapMode('infinite')}
              >
                <Text style={[styles.toggleButtonText, mapMode === 'infinite' && styles.toggleButtonTextActive]}>무한</Text>
              </Pressable>
              <Pressable
                style={[styles.toggleButton, mapMode === 'finite' && styles.toggleButtonActive]}
                onPress={() => setMapMode('finite')}
              >
                <Text style={[styles.toggleButtonText, mapMode === 'finite' && styles.toggleButtonTextActive]}>유한</Text>
              </Pressable>
            </View>
          </View>

          {mapMode === 'finite' ? (
            <Stepper
              label="맵 크기"
              value={mapSize}
              onChange={setMapSize}
              min={MAP_SIZE_MIN}
              max={MAP_SIZE_MAX}
              step={MAP_SIZE_STEP}
              format={(v) => `${v}×${v}`}
            />
          ) : (
            <Stepper
              label="행동력"
              value={actionBudget}
              onChange={setActionBudget}
              min={ACTION_BUDGET_MIN}
              max={ACTION_BUDGET_MAX}
              step={ACTION_BUDGET_STEP}
            />
          )}
        </View>
      </ScrollView>

      <Pressable style={styles.startButton} onPress={handleStart}>
        <Text style={styles.startButtonText}>게임 시작</Text>
      </Pressable>

      <Pressable style={styles.howToPlayButton} onPress={() => setHowToPlayVisible(true)}>
        <Text style={styles.howToPlayButtonText}>게임 방법</Text>
      </Pressable>

      <Modal visible={howToPlayVisible} transparent animationType="fade" onRequestClose={() => setHowToPlayVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setHowToPlayVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>게임 방법</Text>
            <Text style={styles.modalBody}>{HOW_TO_PLAY_TEXT}</Text>
            <Pressable style={styles.modalCloseButton} onPress={() => setHowToPlayVisible(false)}>
              <Text style={styles.modalCloseButtonText}>닫기</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLOR.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  title: {
    color: COLOR.text,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: COLOR.muted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 28,
  },
  card: {
    backgroundColor: COLOR.card,
    borderColor: COLOR.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomColor: COLOR.cardBorder,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: {
    color: COLOR.text,
    fontSize: 15,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepperButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLOR.button,
    borderColor: COLOR.buttonBorder,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonDisabled: {
    opacity: 0.35,
  },
  stepperButtonText: {
    color: COLOR.text,
    fontSize: 16,
    fontWeight: '700',
  },
  stepperValue: {
    color: COLOR.text,
    fontSize: 15,
    minWidth: 56,
    textAlign: 'center',
  },
  toggleGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLOR.button,
    borderColor: COLOR.buttonBorder,
    borderWidth: 1,
  },
  toggleButtonActive: {
    backgroundColor: COLOR.accent,
    borderColor: COLOR.accent,
  },
  toggleButtonText: {
    color: COLOR.muted,
    fontSize: 14,
    fontWeight: '600',
  },
  toggleButtonTextActive: {
    color: COLOR.accentText,
  },
  startButton: {
    marginHorizontal: 24,
    marginBottom: 24,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: COLOR.accent,
    alignItems: 'center',
  },
  startButtonText: {
    color: COLOR.accentText,
    fontSize: 17,
    fontWeight: '700',
  },
  howToPlayButton: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: COLOR.button,
    borderColor: COLOR.buttonBorder,
    borderWidth: 1,
  },
  howToPlayButtonText: {
    color: COLOR.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLOR.card,
    borderColor: COLOR.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    color: COLOR.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  modalBody: {
    color: COLOR.text,
    fontSize: 14,
    lineHeight: 22,
  },
  modalCloseButton: {
    marginTop: 18,
    alignSelf: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLOR.button,
    borderColor: COLOR.buttonBorder,
    borderWidth: 1,
  },
  modalCloseButtonText: {
    color: COLOR.text,
    fontSize: 14,
    fontWeight: '600',
  },
});
